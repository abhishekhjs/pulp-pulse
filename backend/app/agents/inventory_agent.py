from datetime import datetime, date, timedelta
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from backend.app.models.db import Batch, Depot, Flavor, Transfer, Alert, KpiThreshold, ChannelSale

def evaluate_inventory_kpis(db: Session, eval_date: date = None) -> List[Dict[str, Any]]:
    """
    Evaluates KPIs D1, D2, D3 against batches, depots, and kpi_thresholds.
    Generates recommended Transfers and raises alerts.
    """
    alerts_raised = []
    thresholds = {t.kpi_code: t for t in db.query(KpiThreshold).filter(KpiThreshold.category == "inventory").all()}

    d2_thresh = thresholds.get("D2")
    trigger_d2 = d2_thresh.trigger_value if d2_thresh else 18.0

    d1_thresh = thresholds.get("D1")
    trigger_d1 = d1_thresh.trigger_value if d1_thresh else 16.0

    batches = db.query(Batch).filter(Batch.status.in_(["fresh", "at_risk"])).all()
    depots = {d.id: d for d in db.query(Depot).all()}
    flavors = {f.id: f for f in db.query(Flavor).all()}

    # High-velocity target depots by region/preference for transfers
    fast_depot_ids = [d.id for d in depots.values() if "Mumbai" in d.name or "Bengaluru" in d.name or "Delhi" in d.name]

    for batch in batches:
        flavor = flavors.get(batch.flavor_id)
        depot = depots.get(batch.depot_id)
        if not flavor or not depot:
            continue

        # --- KPI D3: MT/QC Commercial Rejection Cliff (Age >= 30 days) ---
        if batch.age_days >= 30:
            batch.status = "rejected"
            db.commit()

            existing_d3 = db.query(Alert).filter(
                Alert.kpi_code == "D3",
                Alert.linked_entity_type == "batch",
                Alert.linked_entity_id == batch.id,
                Alert.status == "open",
            ).first()

            if not existing_d3:
                alert = Alert(
                    kpi_code="D3",
                    severity="critical",
                    message=(
                        f"Commercial Freshness Breach: Batch #{batch.id} ({flavor.name} at {depot.name}) "
                        f"crossed 30 days age. Modern Trade & Quick Commerce 60-day residual shelf-life rule breached. "
                        f"Mandatory quarantine or GT discount write-off triggered."
                    ),
                    confidence_pct=100.0,
                    linked_entity_type="batch",
                    linked_entity_id=batch.id,
                    status="open",
                    triggered_at=datetime.utcnow(),
                )
                db.add(alert)
                db.commit()
                db.refresh(alert)
                alerts_raised.append({"alert_id": alert.id, "kpi_code": "D3", "batch_id": batch.id})
            continue

        # --- KPI D2: Batch Age at Risk (Age >= 18 days & Won't Clear in 7 days) ---
        if batch.age_days >= trigger_d2:
            batch.status = "at_risk"
            db.commit()

            # Find best target depot that isn't the current one
            dest_depot_id = next((did for did in fast_depot_ids if did != depot.id), None)
            if not dest_depot_id:
                dest_depot_id = next((did for did in depots.keys() if did != depot.id), None)

            dest_depot = depots.get(dest_depot_id)

            # 1. Create or check recommended transfer
            existing_transfer = db.query(Transfer).filter(
                Transfer.batch_id == batch.id,
                Transfer.status.in_(["recommended", "approved", "in_transit"]),
            ).first()

            if not existing_transfer and dest_depot_id:
                transfer = Transfer(
                    batch_id=batch.id,
                    from_depot_id=depot.id,
                    to_depot_id=dest_depot_id,
                    quantity=batch.quantity,
                    cost_per_bottle=1.50,
                    status="recommended",
                    created_at=datetime.utcnow(),
                )
                db.add(transfer)
                db.commit()
                db.refresh(transfer)

            # 2. Raise D2 Alert
            existing_d2 = db.query(Alert).filter(
                Alert.kpi_code == "D2",
                Alert.linked_entity_type == "batch",
                Alert.linked_entity_id == batch.id,
                Alert.status == "open",
            ).first()

            if not existing_d2:
                days_left = 30 - batch.age_days
                total_transfer_cost = round(batch.quantity * 1.50, 2)
                avoided_write_off = round(batch.quantity * 60.0, 2)
                dest_name = dest_depot.name if dest_depot else "Regional Hub"

                msg = (
                    f"Batch Age at Risk: Batch #{batch.id} ({flavor.name} at {depot.name}) is {batch.age_days} days old "
                    f"({days_left} days before 30-day MT/QC rejection cliff). Recommended inter-depot transfer of {batch.quantity} bottles "
                    f"to {dest_name} at ₹1.50/bottle (Total: ₹{total_transfer_cost:,.2f}) to avert ₹{avoided_write_off:,.2f} write-off."
                )

                alert = Alert(
                    kpi_code="D2",
                    severity="warning",
                    message=msg,
                    confidence_pct=95.0,
                    linked_entity_type="batch",
                    linked_entity_id=batch.id,
                    status="open",
                    triggered_at=datetime.utcnow(),
                )
                db.add(alert)
                db.commit()
                db.refresh(alert)
                alerts_raised.append({"alert_id": alert.id, "kpi_code": "D2", "batch_id": batch.id})

    return alerts_raised
