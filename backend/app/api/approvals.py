from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.app.models.db import get_db, Approval, Alert
from backend.app.models.schemas import ApprovalInfo, ApprovalActionResponse, ApproveAlertRequest
from backend.app.api.ws import manager

approvals_router = APIRouter(prefix="/approvals", tags=["approvals"])

@approvals_router.get("", response_model=List[ApprovalInfo])
def list_approvals(
    tier: Optional[str] = Query(None, description="Filter by approval tier"),
    status: Optional[str] = Query("pending", description="Filter by status"),
    db: Session = Depends(get_db)
):
    query = db.query(Approval).order_by(Approval.created_at.desc())
    if tier:
        query = query.filter(Approval.tier == tier)
    if status:
        query = query.filter(Approval.status == status)

    approvals = query.all()
    return [
        ApprovalInfo(
            id=a.id,
            tier=a.tier,
            status=a.status,
            sla_hours=a.sla_hours,
            sla_deadline=a.sla_deadline.isoformat() + "Z",
            created_at=a.created_at.isoformat() + "Z",
            decided_at=a.decided_at.isoformat() + "Z" if a.decided_at else None,
            decided_by=a.decided_by,
            note=a.note,
        )
        for a in approvals
    ]

@approvals_router.post("/{id}/decide", response_model=ApprovalActionResponse)
async def decide_approval(
    id: int,
    req: ApproveAlertRequest,
    action: str = Query("approve", enum=["approve", "reject"]),
    db: Session = Depends(get_db)
):
    app = db.query(Approval).filter(Approval.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail=f"Approval {id} not found")

    now = datetime.utcnow()
    app.status = "approved" if action == "approve" else "rejected"
    app.decided_at = now
    app.decided_by = req.approver
    app.note = req.note

    if app.alert:
        app.alert.status = "approved" if action == "approve" else "rejected"
        if action == "approve" and app.alert.linked_entity_type == "transfer" and app.alert.linked_entity_id:
            try:
                from backend.app.services.redistribution_optimizer import execute_buffer_transfer
                execute_buffer_transfer(db, app.alert.linked_entity_id, approver=req.approver, note=req.note or "")
            except Exception as e:
                print(f"Warning executing transfer on approval: {e}")

    db.commit()

    await manager.broadcast({
        "type": "APPROVAL_DECIDED",
        "approval_id": app.id,
        "status": app.status,
        "decided_by": req.approver,
    })

    return ApprovalActionResponse(
        id=app.id,
        alert_id=app.alert_id,
        status=app.status,
        decided_at=now.isoformat() + "Z",
        decided_by=req.approver,
        note=req.note,
    )
