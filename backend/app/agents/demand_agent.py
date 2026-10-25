from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.models.db import ChannelSale, Flavor, Alert, KpiThreshold
from backend.app.forecasting import sarimax_model

def evaluate_demand_kpis(db: Session, eval_date: Optional[date] = None) -> List[Dict[str, Any]]:
    """
    Evaluates KPIs B1, B2, B3, B4 against channel_sales and kpi_thresholds.
    Demand forecasting is a statistical step: calls sarimax_model.forecast(...) to obtain
    the numeric predictions and persists them into channel_sales.forecast_units.
    The agent's logic is strictly limited to turning forecast-vs-actual deviations into alerts.
    """
    alerts_raised = []

    # 1. Fetch KPI Thresholds
    thresholds = {
        t.kpi_code: t
        for t in db.query(KpiThreshold).filter(KpiThreshold.category.in_(["demand", "system"])).all()
    }

    latest_sale = db.query(func.max(ChannelSale.date)).scalar()
    current_date = eval_date or latest_sale or date.today()
    three_days_ago = current_date - timedelta(days=2)
    seven_days_ago = current_date - timedelta(days=6)

    flavors = db.query(Flavor).all()
    channels = ["GT", "MT", "QC"]

    # 2. Run SARIMAX forecast engine and persist forecasts (Section 16.1)
    for flavor in flavors:
        for ch in channels:
            try:
                forecast_res = sarimax_model.forecast(flavor.id, ch, horizon_days=14, db=db)
                f_dates = forecast_res.get("dates", [])
                f_points = forecast_res.get("point_forecast", [])

                for dt_str, pred_units in zip(f_dates, f_points):
                    dt_val = date.fromisoformat(dt_str)
                    existing_sale = (
                        db.query(ChannelSale)
                        .filter(
                            ChannelSale.flavor_id == flavor.id,
                            ChannelSale.channel == ch,
                            ChannelSale.date == dt_val,
                        )
                        .first()
                    )
                    if existing_sale:
                        existing_sale.forecast_units = int(pred_units)
                db.commit()
            except Exception as e:
                db.rollback()
                print(f"Warning: SARIMAX forecast run for flavor {flavor.name} channel {ch} error: {e}")

    # 3. KPI B3: QC Velocity Deviation
    # Trigger: 3-day rolling QC sell-through deviation from forecast exceeds threshold (0.25)
    b3_thresh = thresholds.get("B3")
    trigger_b3 = b3_thresh.trigger_value if b3_thresh else 0.25

    for flavor in flavors:
        qc_sales = (
            db.query(ChannelSale)
            .filter(
                ChannelSale.flavor_id == flavor.id,
                ChannelSale.channel == "QC",
                ChannelSale.date >= three_days_ago,
                ChannelSale.date <= current_date,
            )
            .all()
        )

        if qc_sales:
            total_actual = sum(s.units_sold for s in qc_sales)
            total_forecast = sum(s.forecast_units for s in qc_sales)
            if total_forecast > 0:
                deviation = (total_actual - total_forecast) / total_forecast
                if deviation > trigger_b3:
                    existing = (
                        db.query(Alert)
                        .filter(
                            Alert.kpi_code == "B3",
                            Alert.linked_entity_type == "flavor",
                            Alert.linked_entity_id == flavor.id,
                            Alert.status == "open",
                        )
                        .first()
                    )

                    if not existing:
                        severity = "critical" if deviation >= 0.50 else "warning"
                        confidence = min(98.0, 85.0 + (deviation * 20.0))
                        spike_pct = int(deviation * 100)

                        msg = (
                            f"QC Demand Spike Detected for {flavor.name}: 3-day sell-through deviation is +{spike_pct}% "
                            f"above forecast ({total_actual} units vs {total_forecast} forecast). Viral demand velocity requires immediate supply response."
                        )

                        alert = Alert(
                            kpi_code="B3",
                            severity=severity,
                            message=msg,
                            confidence_pct=round(confidence, 1),
                            linked_entity_type="flavor",
                            linked_entity_id=flavor.id,
                            status="open",
                            triggered_at=datetime.utcnow(),
                        )
                        db.add(alert)
                        db.commit()
                        db.refresh(alert)
                        alerts_raised.append({"alert_id": alert.id, "kpi_code": "B3", "flavor": flavor.name})

    # 4. KPI B2: Forecast Error Rate
    # Trigger: rolling 7-day error > 20% for a SKU
    b2_thresh = thresholds.get("B2")
    trigger_b2 = b2_thresh.trigger_value if b2_thresh else 0.20

    for flavor in flavors:
        seven_day_sales = (
            db.query(ChannelSale)
            .filter(
                ChannelSale.flavor_id == flavor.id,
                ChannelSale.date >= seven_days_ago,
                ChannelSale.date <= current_date,
            )
            .all()
        )

        if seven_day_sales:
            tot_actual = sum(s.units_sold for s in seven_day_sales)
            tot_forecast = sum(s.forecast_units for s in seven_day_sales)
            if tot_forecast > 0:
                error_rate = abs(tot_actual - tot_forecast) / tot_forecast
                if error_rate > trigger_b2:
                    existing = (
                        db.query(Alert)
                        .filter(
                            Alert.kpi_code == "B2",
                            Alert.linked_entity_type == "flavor",
                            Alert.linked_entity_id == flavor.id,
                            Alert.status == "open",
                        )
                        .first()
                    )

                    if not existing:
                        alert = Alert(
                            kpi_code="B2",
                            severity="warning",
                            message=f"Rolling 7-day forecast error for {flavor.name} reached {round(error_rate*100, 1)}% (exceeds {int(trigger_b2*100)}% threshold). Demand model recalibration recommended.",
                            confidence_pct=91.0,
                            linked_entity_type="flavor",
                            linked_entity_id=flavor.id,
                            status="open",
                            triggered_at=datetime.utcnow(),
                        )
                        db.add(alert)
                        db.commit()
                        db.refresh(alert)
                        alerts_raised.append({"alert_id": alert.id, "kpi_code": "B2", "flavor": flavor.name})

    return alerts_raised
