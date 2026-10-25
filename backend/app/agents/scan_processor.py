from datetime import datetime, date
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from backend.app.models.db import ScanEvent, Batch, Depot, Flavor, ChannelSale
from backend.app.models.schemas import ScanEventCreate, ScanEventResponse
from backend.app.agents.inventory_agent import evaluate_inventory_kpis

def process_scan_event(db: Session, scan_data: ScanEventCreate) -> ScanEventResponse:
    """
    Ingests RFID/barcode scan as the sole physical movement write path.
    Atomically updates batches and channel sales within the same transaction,
    and immediately triggers Inventory Freshness Agent evaluation (zero-polling).
    """
    today = date.today()
    now = datetime.utcnow()

    # 1. Create ScanEvent record
    scan_event = ScanEvent(
        parcel_code=scan_data.parcel_code,
        from_node_type=scan_data.from_node_type,
        from_node_id=scan_data.from_node_id,
        to_node_type=scan_data.to_node_type,
        to_node_id=scan_data.to_node_id,
        flavor_id=scan_data.flavor_id,
        batch_id=scan_data.batch_id,
        quantity=scan_data.quantity,
        scanned_at=now,
    )
    db.add(scan_event)

    batch_obj = None
    units_sold_updated = None
    msg = ""

    # 2. Movement logic
    if scan_data.from_node_type == "factory" and scan_data.to_node_type == "depot":
        # New batch created at depot
        batch_obj = Batch(
            flavor_id=scan_data.flavor_id,
            depot_id=scan_data.to_node_id,
            bottled_date=today,
            quantity=scan_data.quantity,
            age_days=0,
            status="fresh",
        )
        db.add(batch_obj)
        db.flush()
        scan_event.batch_id = batch_obj.id
        msg = f"Factory intake scan: Batch #{batch_obj.id} ({scan_data.quantity} btls) created at Depot #{scan_data.to_node_id}"

    elif scan_data.from_node_type == "depot" and scan_data.to_node_type in ["distributor", "retailer"]:
        # Outbound sale: decrement batch and update channel_sales
        if scan_data.batch_id:
            batch_obj = db.query(Batch).filter(Batch.id == scan_data.batch_id).first()
        else:
            # Pick oldest active batch of this flavor at this depot (FIFO)
            batch_obj = (
                db.query(Batch)
                .filter(
                    Batch.depot_id == scan_data.from_node_id,
                    Batch.flavor_id == scan_data.flavor_id,
                    Batch.status.in_(["fresh", "at_risk"]),
                )
                .order_by(Batch.age_days.desc())
                .first()
            )

        if batch_obj:
            batch_obj.quantity = max(0, batch_obj.quantity - scan_data.quantity)
            if batch_obj.quantity == 0:
                batch_obj.status = "sold"
            scan_event.batch_id = batch_obj.id

        # Update channel_sales for today
        ch = scan_data.channel or "MT"
        sale = (
            db.query(ChannelSale)
            .filter(
                ChannelSale.flavor_id == scan_data.flavor_id,
                ChannelSale.channel == ch,
                ChannelSale.date == today,
            )
            .first()
        )
        if sale:
            sale.units_sold += scan_data.quantity
            units_sold_updated = sale.units_sold
        else:
            new_sale = ChannelSale(
                flavor_id=scan_data.flavor_id,
                channel=ch,
                date=today,
                units_sold=scan_data.quantity,
                forecast_units=scan_data.quantity,
            )
            db.add(new_sale)
            units_sold_updated = scan_data.quantity

        msg = f"Outbound dispatch scan: {scan_data.quantity} btls dispatched to {scan_data.to_node_type} #{scan_data.to_node_id}. Channel sales updated."

    elif scan_data.from_node_type == "depot" and scan_data.to_node_type == "depot":
        # Inter-depot physical transfer
        if scan_data.batch_id:
            batch_obj = db.query(Batch).filter(Batch.id == scan_data.batch_id).first()
            if batch_obj:
                batch_obj.depot_id = scan_data.to_node_id
        msg = f"Inter-depot transfer scan: Batch #{scan_data.batch_id or 'N/A'} received at Depot #{scan_data.to_node_id}"

    db.commit()
    db.refresh(scan_event)
    if batch_obj:
        db.refresh(batch_obj)

    # 3. Event-driven zero-polling trigger: evaluate inventory freshness immediately!
    try:
        evaluate_inventory_kpis(db, eval_date=today)
    except Exception as e:
        print(f"Warning: event-driven inventory agent trigger encountered: {e}")

    from_desc = f"{scan_data.from_node_type.title()} #{scan_data.from_node_id}"
    to_desc = f"{scan_data.to_node_type.title()} #{scan_data.to_node_id}"

    return ScanEventResponse(
        scan_id=scan_event.id,
        parcel_code=scan_event.parcel_code,
        from_node=from_desc,
        to_node=to_desc,
        flavor_id=scan_event.flavor_id,
        quantity=scan_event.quantity,
        batch_id=batch_obj.id if batch_obj else scan_event.batch_id,
        batch_status=batch_obj.status if batch_obj else None,
        batch_quantity=batch_obj.quantity if batch_obj else None,
        units_sold_updated=units_sold_updated,
        scanned_at=scan_event.scanned_at.isoformat() + "Z",
        message=msg or "Scan ingested successfully.",
    )
