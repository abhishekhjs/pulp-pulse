from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.app.models.db import get_db, Transfer, Batch, Depot
from backend.app.models.schemas import TransferResponse, CreateTransferRequest
from backend.app.api.ws import manager

transfers_router = APIRouter(prefix="/transfers", tags=["transfers"])

@transfers_router.get("", response_model=List[TransferResponse])
def list_transfers(
    status: Optional[str] = Query(None, description="Filter by status (recommended, approved, in_transit, completed)"),
    db: Session = Depends(get_db),
):
    query = db.query(Transfer).order_by(Transfer.created_at.desc())
    if status:
        query = query.filter(Transfer.status == status)

    transfers = query.all()
    results: List[TransferResponse] = []
    for t in transfers:
        fl_name = None
        if t.flavor:
            fl_name = t.flavor.name
        elif t.batch and t.batch.flavor:
            fl_name = t.batch.flavor.name

        results.append(TransferResponse(
            id=t.id,
            batch_id=t.batch_id,
            flavor_name=fl_name,
            from_depot=t.from_depot.name if t.from_depot else f"Depot {t.from_depot_id}",
            to_depot=t.to_depot.name if t.to_depot else f"Depot {t.to_depot_id}",
            quantity=t.quantity,
            cost_per_bottle=t.cost_per_bottle,
            total_cost=round(t.quantity * t.cost_per_bottle, 2),
            net_benefit=t.net_benefit,
            reason=t.reason,
            status=t.status,
            created_at=t.created_at.isoformat() + "Z",
        ))
    return results

@transfers_router.post("", response_model=TransferResponse)
async def create_transfer(req: CreateTransferRequest, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == req.batch_id).first() if req.batch_id else None

    from_depot = db.query(Depot).filter(Depot.id == req.from_depot_id).first()
    to_depot = db.query(Depot).filter(Depot.id == req.to_depot_id).first()
    if not from_depot or not to_depot:
        raise HTTPException(status_code=400, detail="Invalid depot ID")

    now = datetime.utcnow()
    transfer = Transfer(
        batch_id=req.batch_id,
        flavor_id=req.flavor_id or (batch.flavor_id if batch else None),
        from_depot_id=req.from_depot_id,
        to_depot_id=req.to_depot_id,
        quantity=req.quantity,
        cost_per_bottle=req.cost_per_bottle,
        alert_id=req.alert_id,
        reason=req.reason,
        status="approved",  # Manually initiated transfer starts as approved
        created_at=now,
    )
    db.add(transfer)
    db.commit()
    db.refresh(transfer)

    fl_name = transfer.flavor.name if transfer.flavor else (batch.flavor.name if batch and batch.flavor else None)

    await manager.broadcast({
        "type": "TRANSFER_CREATED",
        "transfer_id": transfer.id,
        "from": from_depot.name,
        "to": to_depot.name,
        "quantity": transfer.quantity,
    })

    return TransferResponse(
        id=transfer.id,
        batch_id=transfer.batch_id,
        flavor_name=fl_name,
        from_depot=from_depot.name,
        to_depot=to_depot.name,
        quantity=transfer.quantity,
        cost_per_bottle=transfer.cost_per_bottle,
        total_cost=round(transfer.quantity * transfer.cost_per_bottle, 2),
        net_benefit=transfer.net_benefit,
        reason=transfer.reason,
        status=transfer.status,
        created_at=now.isoformat() + "Z",
    )
