from datetime import datetime, date, timedelta
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from backend.app.models.db import Batch, Depot, Flavor, Transfer, Alert, KpiThreshold
from backend.app.agents.sentiment_signal import compute_push_recommendation

def evaluate_distribution_kpis(db: Session, eval_date: date = None) -> List[Dict[str, Any]]:
    """
    Evaluates KPIs E1, E2, E3 against batches, depots, transfers, and kpi_thresholds.
    """
    alerts_raised = []
    thresholds = {t.kpi_code: t for t in db.query(KpiThreshold).filter(KpiThreshold.category == "distribution").all()}

    e1_thresh = thresholds.get("E1")
    trigger_e1 = e1_thresh.trigger_value if e1_thresh else 10.0

    flavors = db.query(Flavor).all()
    depots = db.query(Depot).all()

    # --- KPI E1: Depot Stock Imbalance Index ---
    # Trigger: cover-day variance across depots for single SKU > 10 days
    for flavor in flavors:
        depot_stocks = []
        daily_rate = 80.0 * flavor.summer_share_pct / 9.0  # approximate per-depot daily consumption

        for depot in depots:
            stock = sum(
                b.quantity for b in db.query(Batch).filter(
                    Batch.flavor_id == flavor.id,
                    Batch.depot_id == depot.id,
                    Batch.status.in_(["fresh", "at_risk"]),
                ).all()
            )
            cover = stock / daily_rate if daily_rate > 0 else 0.0
            depot_stocks.append(cover)

        if depot_stocks:
            variance = max(depot_stocks) - min(depot_stocks)
            if variance > trigger_e1:
                existing = db.query(Alert).filter(
                    Alert.kpi_code == "E1",
                    Alert.linked_entity_type == "flavor",
                    Alert.linked_entity_id == flavor.id,
                    Alert.status == "open",
                ).first()

                if not existing:
                    alert = Alert(
                        kpi_code="E1",
                        severity="warning",
                        message=(
                            f"Depot Stock Imbalance for {flavor.name}: Stock cover variance spans {round(variance, 1)} days "
                            f"(threshold > {trigger_e1} days). Some regional depots are overstocked while high-velocity nodes face imminent stockouts."
                        ),
                        confidence_pct=92.0,
                        linked_entity_type="flavor",
                        linked_entity_id=flavor.id,
                        status="open",
                        triggered_at=datetime.utcnow(),
                    )
                    db.add(alert)
                    db.commit()
                    db.refresh(alert)
                    alerts_raised.append({"alert_id": alert.id, "kpi_code": "E1", "flavor": flavor.name})

    # --- KPI E2: Inter Depot Transfer Utilization ---
    # Trigger: recommended transfer unactioned for > 48 hours
    cutoff_48h = datetime.utcnow() - timedelta(hours=48)
    stale_transfers = db.query(Transfer).filter(
        Transfer.status == "recommended",
        Transfer.created_at <= cutoff_48h,
    ).all()

    for st in stale_transfers:
        existing = db.query(Alert).filter(
            Alert.kpi_code == "E2",
            Alert.linked_entity_type == "transfer",
            Alert.linked_entity_id == st.id,
            Alert.status == "open",
        ).first()

        if not existing:
            alert = Alert(
                kpi_code="E2",
                severity="warning",
                message=(
                    f"Unactioned Transfer Escalation: Transfer #{st.id} ({st.quantity} bottles from Depot {st.from_depot_id} "
                    f"to Depot {st.to_depot_id}) has remained pending for >48 hours. Batch approaches commercial expiry cliff."
                ),
                confidence_pct=97.0,
                linked_entity_type="transfer",
                linked_entity_id=st.id,
                status="open",
                triggered_at=datetime.utcnow(),
            )
            db.add(alert)
            db.commit()
            db.refresh(alert)
            alerts_raised.append({"alert_id": alert.id, "kpi_code": "E2", "transfer_id": st.id})

    # --- KPI E3: New SKU Dynamic Allocation Weight ---
    # Trigger: new SKU dynamic weighting in allocation engine < 70%
    e3_thresh = thresholds.get("E3")
    trigger_e3 = e3_thresh.trigger_value if e3_thresh else 0.70

    for flavor in flavors:
        if flavor.name == "Dragon Passion":  # New SKU
            push = compute_push_recommendation(flavor.id, db)
            # Baseline without agent is static historical share (0.0). With agent, push yields dynamic boost.
            dynamic_weight = 0.85 if push else 0.45
            if dynamic_weight < trigger_e3:
                existing = db.query(Alert).filter(
                    Alert.kpi_code == "E3",
                    Alert.linked_entity_type == "flavor",
                    Alert.linked_entity_id == flavor.id,
                    Alert.status == "open",
                ).first()

                if not existing:
                    alert = Alert(
                        kpi_code="E3",
                        severity="warning",
                        message=(
                            f"New SKU Allocation Starvation: {flavor.name} dynamic allocation weight is "
                            f"{int(dynamic_weight*100)}% (below {int(trigger_e3*100)}% target). Depot allocation is constrained by historical sales mix rather than live viral demand."
                        ),
                        confidence_pct=90.0,
                        linked_entity_type="flavor",
                        linked_entity_id=flavor.id,
                        status="open",
                        triggered_at=datetime.utcnow(),
                    )
                    db.add(alert)
                    db.commit()
                    db.refresh(alert)
                    alerts_raised.append({"alert_id": alert.id, "kpi_code": "E3", "flavor": flavor.name})

    return alerts_raised
