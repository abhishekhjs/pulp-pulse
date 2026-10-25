from datetime import datetime, date, timedelta
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from backend.app.models.db import FreightEvent, PulpInventory, Supplier, Alert, KpiThreshold
from backend.app.services.weather_hazard_service import get_current_weather_and_hazard

def evaluate_transportation_kpis(db: Session, eval_date: date = None) -> List[Dict[str, Any]]:
    """
    Evaluates KPIs F1, F2, and F3 against freight_events, pulp_inventory, suppliers,
    kpi_thresholds, and continuous real-time weather & landslide hazard telemetry in the cooperative area.
    """
    alerts_raised = []
    thresholds = {t.kpi_code: t for t in db.query(KpiThreshold).filter(KpiThreshold.category == "transportation").all()}

    # Fetch continuous weather and geological hazard telemetry for the cooperative
    weather_data = get_current_weather_and_hazard()
    weather_state = weather_data["telemetry"]
    hazard_score = weather_state.get("landslide_hazard_score", 0.0)
    road_status = weather_state.get("road_status", "OPEN_CLEAR")
    rainfall_48h = weather_state.get("rainfall_48h_mm", 0.0)

    # --- KPI F1: Route Risk Window & Landslide Weather Surveillance ---
    passionfruit_pulp = db.query(PulpInventory).filter(PulpInventory.ingredient == "Passionfruit Pulp").first()
    pulp_cover = passionfruit_pulp.cover_days if passionfruit_pulp else 14.0

    # Trigger conditions:
    # 1. Pulp cover < 35 days (historical case vulnerability)
    # 2. OR active weather hazard / road block in cooperative area
    is_weather_critical = road_status == "BLOCKED_LANDSLIDE" or hazard_score > 70.0
    is_pulp_cover_breached = pulp_cover < 35.0

    if is_pulp_cover_breached or is_weather_critical:
        existing = db.query(Alert).filter(
            Alert.kpi_code == "F1",
            Alert.status == "open",
        ).first()

        if is_weather_critical and road_status == "BLOCKED_LANDSLIDE":
            alert_msg = (
                f"CRITICAL LANDSLIDE ROADBLOCK: NH-58 km 42 mountain corridor blocked by massive rockfall & debris flow "
                f"following {rainfall_48h}mm 48h rainfall (Hazard Index: {hazard_score}/100, Passability: {weather_state.get('road_passability_pct', 0)}%). "
                f"Pulp cover: {pulp_cover:.1f} days. Estimated road clearance: {weather_state.get('clearance_eta_hrs', 72)}h. "
                f"MANDATE: Activate Foothills Railhead bypass (Rishikesh) and trigger secondary supplier Sahyadri Bio-Organics immediately to avert ₹3.2 Cr emergency air freight penalty."
            )
            confidence = 99.0
            severity = "critical"
        elif hazard_score > 60.0:
            alert_msg = (
                f"Severe Weather & Landslide Threat in Cooperative Area: 48h rainfall reached {rainfall_48h}mm with {weather_state.get('soil_saturation_api_pct', 70)}% "
                f"soil moisture saturation. Single-lane debris risk reported on NH-58. Plant pulp cover is only {pulp_cover:.1f} days (target >= 35 days). "
                f"Mandate forward road dispatch & pre-positioning at foothills cold storage before complete highway closure."
            )
            confidence = 95.0
            severity = "critical"
        else:
            alert_msg = (
                f"Route Vulnerability & Seasonal Landslide Warning: Inbound highway from sole passionfruit supplier "
                f"closed in 3 of the last 5 summers (60% historical probability). Plants currently hold only {pulp_cover:.1f} days "
                f"of cover (target >= 35 days). Mandate forward road transit build immediately before May highway closure window."
            )
            confidence = 95.0
            severity = "critical"

        if not existing:
            alert = Alert(
                kpi_code="F1",
                severity=severity,
                message=alert_msg,
                confidence_pct=confidence,
                linked_entity_type="route",
                linked_entity_id=1,
                status="open",
                triggered_at=datetime.utcnow(),
            )
            db.add(alert)
            db.commit()
            db.refresh(alert)
            alerts_raised.append({"alert_id": alert.id, "kpi_code": "F1"})
        else:
            # Update existing alert message with live weather telemetry if severity changed
            if is_weather_critical and existing.message != alert_msg:
                existing.message = alert_msg
                existing.confidence_pct = confidence
                db.commit()

    # --- KPI F2: Emergency vs Planned Freight Mix ---
    air_freight = db.query(FreightEvent).filter(FreightEvent.type == "air").first()
    if air_freight:
        existing_f2 = db.query(Alert).filter(
            Alert.kpi_code == "F2",
            Alert.status == "open",
        ).first()

        if not existing_f2:
            alert = Alert(
                kpi_code="F2",
                severity="critical",
                message=(
                    f"Emergency Freight Penalty Triggered: Emergency air freight of ₹{air_freight.cost:,.2f} logged "
                    f"(5x standard road freight cost). Expedited logistics burns contribution margin."
                ),
                confidence_pct=100.0,
                linked_entity_type="freight_event",
                linked_entity_id=air_freight.id,
                status="open",
                triggered_at=datetime.utcnow(),
            )
            db.add(alert)
            db.commit()
            db.refresh(alert)
            alerts_raised.append({"alert_id": alert.id, "kpi_code": "F2", "freight_id": air_freight.id})

    # --- KPI F3: Secondary Logistics Carrier Readiness ---
    if hazard_score > 65.0:
        existing_f3 = db.query(Alert).filter(
            Alert.kpi_code == "F3",
            Alert.status == "open",
        ).first()

        if not existing_f3 and not weather_state.get("backup_supplier_activated", False):
            f3_alert = Alert(
                kpi_code="F3",
                severity="warning",
                message=(
                    f"Secondary Logistics Carrier Standby Required: Elevated geological risk (LHI {hazard_score}/100) on NH-58. "
                    f"Ensure standby contract with CONCOR Electric Railhead at Haridwar and secondary supplier Sahyadri Bio-Organics "
                    f"is placed in Hot Standby readiness (target >= 80% readiness score)."
                ),
                confidence_pct=90.0,
                linked_entity_type="supplier",
                linked_entity_id=1,
                status="open",
                triggered_at=datetime.utcnow(),
            )
            db.add(f3_alert)
            db.commit()
            db.refresh(f3_alert)
            alerts_raised.append({"alert_id": f3_alert.id, "kpi_code": "F3"})

    return alerts_raised
