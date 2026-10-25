import os
import json
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.models.db import (
    Depot,
    Flavor,
    Batch,
    Transfer,
    Alert,
    Approval,
    ScanEvent,
    SessionLocal,
)
from backend.app.services.depot_forecasting_service import forecast_depot_flavor

# Known inter-depot reefer transport corridors (Distance km, Transit hrs, Corridor Name)
DEPOT_CORRIDORS: Dict[Tuple[int, int], Dict[str, Any]] = {
    # (from_id, to_id)
    (4, 1): {"name": "Pune - Delhi NCR Golden Quadrilateral Reefer", "distance_km": 1400, "transit_hours": 28.0},
    (5, 1): {"name": "Ahmedabad - Delhi NCR Western Expressway Corridor", "distance_km": 900, "transit_hours": 18.0},
    (2, 1): {"name": "Chandigarh - Delhi NCR Grand Trunk Reefer Link", "distance_km": 250, "transit_hours": 5.0},
    (4, 3): {"name": "Pune - Mumbai Expressway Rapid Transit", "distance_km": 150, "transit_hours": 3.5},
    (3, 4): {"name": "Mumbai - Pune Expressway Rapid Transit", "distance_km": 150, "transit_hours": 3.5},
    (5, 3): {"name": "Ahmedabad - Mumbai Coastal Highway Corridor", "distance_km": 530, "transit_hours": 10.0},
    (7, 6): {"name": "Chennai - Bengaluru Industrial Corridor Link", "distance_km": 350, "transit_hours": 7.0},
    (6, 7): {"name": "Bengaluru - Chennai Industrial Corridor Link", "distance_km": 350, "transit_hours": 7.0},
    (8, 6): {"name": "Hyderabad - Bengaluru Highway Reefer Route", "distance_km": 570, "transit_hours": 11.0},
    (6, 8): {"name": "Bengaluru - Hyderabad Highway Reefer Route", "distance_km": 570, "transit_hours": 11.0},
    (9, 1): {"name": "Kolkata - Delhi NCR Eastern Dedicated Freight Link", "distance_km": 1500, "transit_hours": 32.0},
    (9, 8): {"name": "Kolkata - Hyderabad South-East Coastal Corridor", "distance_km": 1480, "transit_hours": 30.0},
    (3, 1): {"name": "Mumbai - Delhi NCR Freight Corridor", "distance_km": 1420, "transit_hours": 29.0},
    (1, 4): {"name": "Delhi NCR - Pune Return Reefer", "distance_km": 1400, "transit_hours": 28.0},
}

def get_corridor_info(from_depot_id: int, to_depot_id: int, from_name: str, to_name: str) -> Dict[str, Any]:
    """Retrieves corridor metadata or computes safe road transit approximation."""
    key = (from_depot_id, to_depot_id)
    if key in DEPOT_CORRIDORS:
        return DEPOT_CORRIDORS[key]

    rev_key = (to_depot_id, from_depot_id)
    if rev_key in DEPOT_CORRIDORS:
        rev = DEPOT_CORRIDORS[rev_key]
        return {
            "name": f"{from_name.split('(')[0].strip()} - {to_name.split('(')[0].strip()} Dedicated Reefer",
            "distance_km": rev["distance_km"],
            "transit_hours": rev["transit_hours"],
        }

    # Default estimation based on regional pairing
    dist = 950
    hrs = 20.0
    return {
        "name": f"{from_name.split('(')[0].strip()} to {to_name.split('(')[0].strip()} Cold Chain Line",
        "distance_km": dist,
        "transit_hours": hrs,
    }

def find_redistribution_opportunities(
    db: Session,
    target_flavor_id: Optional[int] = None,
    target_deficit_depot_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    Identifies all instances where a flavor faces a demand surge / stockout deficit at one depot,
    while another depot has excess, stagnant, or aging stock of that same flavor.
    Calculates the optimal buffer quantity, verifies the financial viability against the
    ₹1.50/bottle redistribution cost, and ranks compatible transfer paths.
    """
    depots = db.query(Depot).all()
    flavors = db.query(Flavor).all()
    depot_map = {d.id: d for d in depots}

    if target_flavor_id:
        flavors = [f for f in flavors if f.id == target_flavor_id]

    opportunities = []

    # Financial unit constants
    TRANSFER_COST_PER_BOTTLE = 1.50
    WRITE_OFF_VALUE_PER_BOTTLE = 60.00       # Realized price written off on Day 30 cliff breach
    DISTRESS_DISCOUNT_PER_BOTTLE = 30.00    # Distress discount loss if cleared to liquidation brokers
    CONTRIBUTION_MARGIN_PER_BOTTLE = 19.20  # Margin lost per unfulfilled stockout bottle

    for flavor in flavors:
        flavor_depot_states = {}

        # 1. Evaluate demand and cover for each depot
        for d in depots:
            f_eval = forecast_depot_flavor(d.id, flavor.id, horizon_days=14, db=db)
            flavor_depot_states[d.id] = f_eval

        # 2. Identify deficit nodes (demand surge / low cover)
        deficit_nodes = [
            f_data for f_data in flavor_depot_states.values()
            if f_data["status"] == "surge_deficit" or f_data["days_of_cover"] < 7.0
        ]

        if target_deficit_depot_id:
            deficit_nodes = [n for n in deficit_nodes if n["depot_id"] == target_deficit_depot_id]

        # 3. Identify surplus nodes (excess / stagnant stock / aging batches)
        surplus_nodes = [
            f_data for f_data in flavor_depot_states.values()
            if f_data["status"] == "surplus_stagnant" or f_data["days_of_cover"] > 16.0 or f_data["max_batch_age"] >= 18
        ]

        # 4. Pair Deficit and Surplus nodes
        for def_node in deficit_nodes:
            d_dest_id = def_node["depot_id"]
            d_dest_name = def_node["depot_name"]
            dest_daily_rate = max(0.5, def_node["daily_run_rate"])
            dest_cover = def_node["days_of_cover"]

            # Required buffer to achieve 10 days of healthy cover
            needed_buffer_bottles = max(100, int((10.0 - dest_cover) * dest_daily_rate))

            for sur_node in surplus_nodes:
                d_orig_id = sur_node["depot_id"]
                if d_orig_id == d_dest_id:
                    continue

                d_orig_name = sur_node["depot_name"]
                orig_stock = sur_node["on_hand_stock"]
                orig_daily_rate = max(0.5, sur_node["daily_run_rate"])
                orig_cover = sur_node["days_of_cover"]
                surplus_batch_age = sur_node["max_batch_age"]

                # Safe transferable surplus: ensure origin depot keeps at least 7 days cover
                safe_reserve = int(orig_daily_rate * 7.0)
                available_surplus = max(0, orig_stock - safe_reserve)

                if available_surplus < 50:
                    continue

                # Buffer amount is the minimum of need and available surplus
                buffer_bottles = min(needed_buffer_bottles, available_surplus)
                # Round to clean batch multiple of 25
                buffer_bottles = max(50, (buffer_bottles // 25) * 25)

                # Fetch candidate batch at surplus depot
                candidate_batch = (
                    db.query(Batch)
                    .filter(
                        Batch.depot_id == d_orig_id,
                        Batch.flavor_id == flavor.id,
                        Batch.status.in_(["fresh", "at_risk"]),
                    )
                    .order_by(Batch.age_days.desc())
                    .first()
                )
                actual_batch_id = candidate_batch.id if candidate_batch else None
                actual_batch_age = candidate_batch.age_days if candidate_batch else surplus_batch_age

                # Corridor evaluation
                corridor = get_corridor_info(d_orig_id, d_dest_id, d_orig_name, d_dest_name)
                dist_km = corridor["distance_km"]
                transit_hrs = corridor["transit_hours"]

                # ── Financial Arbitrage Calculations (₹1.50/bottle test) ─────────
                total_redist_cost = round(buffer_bottles * TRANSFER_COST_PER_BOTTLE, 2)
                prevented_writeoff = round(buffer_bottles * WRITE_OFF_VALUE_PER_BOTTLE, 2)
                prevented_discount_loss = round(buffer_bottles * DISTRESS_DISCOUNT_PER_BOTTLE, 2)
                protected_cm = round(buffer_bottles * CONTRIBUTION_MARGIN_PER_BOTTLE, 2)

                # Total gross economic value protected = Avoided Write-Off + Protected CM
                gross_economic_value = round(prevented_writeoff + protected_cm, 2)
                net_economic_benefit = round(gross_economic_value - total_redist_cost, 2)
                roi_multiple = round(gross_economic_value / total_redist_cost, 1) if total_redist_cost > 0 else 50.0

                # Must be worth the ₹1.50 redistribution cost
                is_viable = net_economic_benefit > 0 and (prevented_discount_loss > total_redist_cost)

                # Compatibility score (0-100) based on transit speed, batch urgency, and ROI
                time_score = max(20.0, 100.0 - (transit_hrs * 1.8))
                urgency_score = min(100.0, 45.0 + (actual_batch_age * 2.5))
                compat_score = round(0.45 * time_score + 0.35 * urgency_score + 0.20 * min(100.0, roi_multiple * 2.0), 1)

                rec_reason = (
                    f"Surge demand at {d_dest_name} (cover {dest_cover}d) meets stagnant excess at {d_orig_name} (cover {orig_cover}d, "
                    f"batch age {actual_batch_age}d). Buffer transfer of {buffer_bottles} bottles via {corridor['name']} costs ₹{total_redist_cost:,.2f} "
                    f"(@ ₹1.50/btl) but prevents ₹{prevented_writeoff:,.2f} in Day-30 write-offs and protects ₹{protected_cm:,.2f} in Contribution Margin "
                    f"(Net Gain: ₹{net_economic_benefit:,.2f}, {roi_multiple}x ROI)."
                )

                opp_id = f"opp_{flavor.id}_{d_orig_id}_{d_dest_id}"

                # Check if existing transfer or alert already linked
                existing_transfer = (
                    db.query(Transfer)
                    .filter(
                        Transfer.from_depot_id == d_orig_id,
                        Transfer.to_depot_id == d_dest_id,
                        Transfer.flavor_id == flavor.id,
                        Transfer.status.in_(["recommended", "approved", "in_transit"]),
                    )
                    .first()
                )

                transfer_id = existing_transfer.id if existing_transfer else None
                status = existing_transfer.status if existing_transfer else "recommended"

                opportunities.append({
                    "id": opp_id,
                    "flavor_id": flavor.id,
                    "flavor_name": flavor.name,
                    "deficit_depot_id": d_dest_id,
                    "deficit_depot_name": d_dest_name,
                    "deficit_cover_days": dest_cover,
                    "deficit_daily_rate": dest_daily_rate,
                    "surplus_depot_id": d_orig_id,
                    "surplus_depot_name": d_orig_name,
                    "surplus_cover_days": orig_cover,
                    "surplus_batch_id": actual_batch_id,
                    "surplus_batch_age": actual_batch_age,
                    "buffer_bottles": buffer_bottles,
                    "corridor_name": corridor["name"],
                    "distance_km": dist_km,
                    "transit_hours": transit_hrs,
                    "compatibility_score": compat_score,
                    "cost_per_bottle": TRANSFER_COST_PER_BOTTLE,
                    "total_redistribution_cost": total_redist_cost,
                    "prevented_writeoff_loss": prevented_writeoff,
                    "prevented_distress_discount_loss": prevented_discount_loss,
                    "protected_contribution_margin": protected_cm,
                    "net_economic_benefit": net_economic_benefit,
                    "roi_multiple": roi_multiple,
                    "is_financially_viable": is_viable,
                    "recommendation_reason": rec_reason,
                    "transfer_id": transfer_id,
                    "status": status,
                })

    # Sort opportunities: most viable and highest compatibility first
    opportunities.sort(key=lambda o: (o["is_financially_viable"], o["compatibility_score"], o["net_economic_benefit"]), reverse=True)
    return opportunities

def create_redistribution_alert_and_transfer(
    db: Session,
    opp: Dict[str, Any],
    approver_tier: str = "supply_lead",
) -> Tuple[Alert, Transfer, Approval]:
    """
    Creates an actionable Alert, linked Transfer recommendation, and tiered Approval record
    for an optimal surplus-to-deficit buffer transfer.
    """
    now = datetime.utcnow()

    # 1. Create or retrieve Transfer record
    existing_transfer = (
        db.query(Transfer)
        .filter(
            Transfer.from_depot_id == opp["surplus_depot_id"],
            Transfer.to_depot_id == opp["deficit_depot_id"],
            Transfer.flavor_id == opp["flavor_id"],
            Transfer.status.in_(["recommended", "approved", "in_transit"]),
        )
        .first()
    )

    if existing_transfer:
        transfer = existing_transfer
    else:
        transfer = Transfer(
            batch_id=opp.get("surplus_batch_id"),
            flavor_id=opp["flavor_id"],
            from_depot_id=opp["surplus_depot_id"],
            to_depot_id=opp["deficit_depot_id"],
            quantity=opp["buffer_bottles"],
            cost_per_bottle=1.50,
            net_benefit=opp["net_economic_benefit"],
            reason=opp["recommendation_reason"],
            status="recommended",
            created_at=now,
        )
        db.add(transfer)
        db.flush()

    # 2. Create Alert
    existing_alert = (
        db.query(Alert)
        .filter(
            Alert.kpi_code == "E1",
            Alert.linked_entity_type == "transfer",
            Alert.linked_entity_id == transfer.id,
            Alert.status == "open",
        )
        .first()
    )

    if existing_alert:
        alert = existing_alert
    else:
        severity = "critical" if opp["deficit_cover_days"] < 4.0 else "warning"
        alert = Alert(
            kpi_code="E1",
            severity=severity,
            message=(
                f"Surge Deficit Buffer Transfer Recommended: {opp['flavor_name']} demand surging at {opp['deficit_depot_name']} "
                f"({opp['deficit_cover_days']}d cover). Transferring {opp['buffer_bottles']} buffer bottles from surplus stock at "
                f"{opp['surplus_depot_name']} (age {opp['surplus_batch_age']}d, cover {opp['surplus_cover_days']}d). "
                f"₹1.50/btl redistribution cost (₹{opp['total_redistribution_cost']:,.0f}) averts ₹{opp['prevented_writeoff_loss']:,.0f} "
                f"write-off and protects ₹{opp['protected_contribution_margin']:,.0f} Contribution Margin ({opp['roi_multiple']}x ROI)."
            ),
            confidence_pct=96.0,
            linked_entity_type="transfer",
            linked_entity_id=transfer.id,
            status="open",
            triggered_at=now,
        )
        db.add(alert)
        db.flush()
        transfer.alert_id = alert.id

    # 3. Create Approval record
    existing_approval = db.query(Approval).filter(Approval.alert_id == alert.id).first()
    if existing_approval:
        approval = existing_approval
    else:
        approval = Approval(
            alert_id=alert.id,
            tier=approver_tier,
            status="pending",
            sla_hours=12,
            sla_deadline=now + timedelta(hours=12),
            created_at=now,
        )
        db.add(approval)
        db.flush()

    db.commit()
    db.refresh(transfer)
    db.refresh(alert)
    db.refresh(approval)
    return alert, transfer, approval

def execute_buffer_transfer(
    db: Session,
    transfer_id: int,
    approver: str = "supply_lead_1",
    note: str = "Approved optimal surplus-to-deficit buffer redistribution",
) -> Dict[str, Any]:
    """
    Executes an approved transfer:
    - Atomically deducts buffer amount from surplus depot's batch.
    - Creates or updates destination batch at deficit depot.
    - Updates transfer and linked alert status.
    - Ingests RFID/barcode scan event for physical tracking.
    """
    transfer = db.query(Transfer).filter(Transfer.id == transfer_id).first()
    if not transfer:
        raise ValueError(f"Transfer #{transfer_id} not found")

    now = datetime.utcnow()
    today = date.today()

    transfer.status = "in_transit"

    # 1. Deduct buffer quantity from surplus depot batches (FIFO / oldest batch first)
    remaining_to_deduct = transfer.quantity
    surplus_batches = (
        db.query(Batch)
        .filter(
            Batch.depot_id == transfer.from_depot_id,
            Batch.flavor_id == transfer.flavor_id if transfer.flavor_id else Batch.flavor_id,
            Batch.status.in_(["fresh", "at_risk"]),
        )
        .order_by(Batch.age_days.desc())
        .all()
    )

    deducted_batches = []
    source_age = 15
    for b in surplus_batches:
        if remaining_to_deduct <= 0:
            break
        source_age = b.age_days
        deduct_amt = min(b.quantity, remaining_to_deduct)
        b.quantity -= deduct_amt
        remaining_to_deduct -= deduct_amt
        if b.quantity == 0:
            b.status = "transferred"
        deducted_batches.append({"batch_id": b.id, "deducted": deduct_amt, "remaining": b.quantity})

    # 2. Add incoming batch at destination depot (age increments during transit)
    transit_arrival_date = today + timedelta(days=1)
    new_dest_batch = Batch(
        flavor_id=transfer.flavor_id or (surplus_batches[0].flavor_id if surplus_batches else 1),
        depot_id=transfer.to_depot_id,
        bottled_date=today - timedelta(days=source_age + 1),
        quantity=transfer.quantity,
        age_days=source_age + 1,
        status="fresh",
    )
    db.add(new_dest_batch)
    db.flush()

    # 3. Log physical ScanEvent for inter-depot transit dispatch
    scan_event = ScanEvent(
        parcel_code=f"PR-TRF-{transfer.from_depot_id}TO{transfer.to_depot_id}-B{new_dest_batch.id}",
        from_node_type="depot",
        from_node_id=transfer.from_depot_id,
        to_node_type="depot",
        to_node_id=transfer.to_depot_id,
        flavor_id=transfer.flavor_id or new_dest_batch.flavor_id,
        batch_id=new_dest_batch.id,
        quantity=transfer.quantity,
        scanned_at=now,
    )
    db.add(scan_event)

    # 4. Update linked alert and approval
    if transfer.alert_id:
        alert = db.query(Alert).filter(Alert.id == transfer.alert_id).first()
        if alert:
            alert.status = "approved"
            if alert.approvals:
                app = alert.approvals[0]
                app.status = "approved"
                app.decided_at = now
                app.decided_by = approver
                app.note = note

    db.commit()
    db.refresh(transfer)

    return {
        "transfer_id": transfer.id,
        "status": transfer.status,
        "from_depot_id": transfer.from_depot_id,
        "to_depot_id": transfer.to_depot_id,
        "flavor_id": transfer.flavor_id,
        "buffer_bottles": transfer.quantity,
        "cost_inr": round(transfer.quantity * transfer.cost_per_bottle, 2),
        "dest_batch_id": new_dest_batch.id,
        "scan_parcel_code": scan_event.parcel_code,
        "deducted_batches": deducted_batches,
        "executed_at": now.isoformat() + "Z",
    }
