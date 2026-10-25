from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.app.models.db import get_db, Alert, Approval, Override, KpiThreshold, ProductionRun, Transfer
from backend.app.models.schemas import (
    AlertItem,
    ApprovalInfo,
    RoiTradeOff,
    ApproveAlertRequest,
    OverrideAlertRequest,
    ApprovalActionResponse,
)
from backend.app.agents.approval_router import get_roi_trade_off
from backend.app.api.ws import manager

alerts_router = APIRouter(prefix="/alerts", tags=["alerts"])

@alerts_router.get("", response_model=List[AlertItem])
def list_alerts(
    status: Optional[str] = Query(None, description="Filter by alert status (open, approved, rejected, overridden)"),
    severity: Optional[str] = Query(None, description="Filter by severity (critical, warning, info)"),
    tier: Optional[str] = Query(None, description="Filter by approval tier (planner, supply_lead, coo)"),
    db: Session = Depends(get_db),
):
    query = db.query(Alert).order_by(Alert.triggered_at.desc())

    if status:
        query = query.filter(Alert.status == status)
    if severity:
        query = query.filter(Alert.severity == severity)

    alerts = query.all()
    results: List[AlertItem] = []

    for alert in alerts:
        approval_obj = alert.approvals[0] if alert.approvals else None

        if tier and approval_obj and approval_obj.tier != tier:
            continue

        approval_info = None
        if approval_obj:
            approval_info = ApprovalInfo(
                id=approval_obj.id,
                tier=approval_obj.tier,
                status=approval_obj.status,
                sla_hours=approval_obj.sla_hours,
                sla_deadline=approval_obj.sla_deadline.isoformat() + "Z",
                created_at=approval_obj.created_at.isoformat() + "Z",
                decided_at=approval_obj.decided_at.isoformat() + "Z" if approval_obj.decided_at else None,
                decided_by=approval_obj.decided_by,
                note=approval_obj.note,
            )

        roi_data = get_roi_trade_off(alert.kpi_code, alert)

        results.append(AlertItem(
            id=alert.id,
            kpi_code=alert.kpi_code,
            severity=alert.severity,
            message=alert.message,
            confidence_pct=alert.confidence_pct,
            linked_entity_type=alert.linked_entity_type,
            linked_entity_id=alert.linked_entity_id,
            status=alert.status,
            triggered_at=alert.triggered_at.isoformat() + "Z",
            approval=approval_info,
            roi_trade_off=RoiTradeOff(**roi_data),
        ))

    return results

@alerts_router.post("/{id}/approve", response_model=ApprovalActionResponse)
async def approve_alert(id: int, req: ApproveAlertRequest, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == id).first()
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert {id} not found")

    alert.status = "approved"
    now = datetime.utcnow()

    approval_obj = alert.approvals[0] if alert.approvals else None
    if approval_obj:
        approval_obj.status = "approved"
        approval_obj.decided_at = now
        approval_obj.decided_by = req.approver
        approval_obj.note = req.note
    else:
        approval_obj = Approval(
            alert_id=alert.id,
            tier="supply_lead",
            status="approved",
            sla_hours=12,
            sla_deadline=now,
            decided_at=now,
            decided_by=req.approver,
            note=req.note,
        )
        db.add(approval_obj)

    # Automated action execution on approval:
    # 1. If C1 (Plant Utilization / Co-Packer alert approved): schedule co-packer production run with 14-day lead flag!
    if alert.kpi_code == "C1":
        copacker_run = ProductionRun(
            flavor_id=5,  # Dragon Passion
            date=now.date(),
            bottles_produced=240,
            plant_utilization_pct=0.92,
            source="co_packer",
        )
        db.add(copacker_run)

    # 2. If D2 (Batch transfer recommendation approved): update transfer status to approved/in_transit!
    if alert.kpi_code == "D2" and alert.linked_entity_id:
        transfer = db.query(Transfer).filter(Transfer.batch_id == alert.linked_entity_id).first()
        if transfer:
            try:
                from backend.app.services.redistribution_optimizer import execute_buffer_transfer
                execute_buffer_transfer(db, transfer.id, approver=req.approver, note=req.note or "")
            except Exception:
                transfer.status = "approved"

    # 3. If E1 or transfer alert approved: automatically execute buffer redistribution!
    if alert.linked_entity_type == "transfer" and alert.linked_entity_id:
        try:
            from backend.app.services.redistribution_optimizer import execute_buffer_transfer
            execute_buffer_transfer(db, alert.linked_entity_id, approver=req.approver, note=req.note or "")
        except Exception as e:
            print(f"Warning executing buffer transfer: {e}")

    db.commit()
    db.refresh(approval_obj)

    # Broadcast via WebSocket
    await manager.broadcast({
        "type": "ALERT_APPROVED",
        "alert_id": alert.id,
        "kpi_code": alert.kpi_code,
        "decided_by": req.approver,
        "timestamp": now.isoformat() + "Z",
    })

    return ApprovalActionResponse(
        id=approval_obj.id,
        alert_id=alert.id,
        status="approved",
        decided_at=now.isoformat() + "Z",
        decided_by=req.approver,
        note=req.note,
    )

@alerts_router.post("/{id}/override", response_model=ApprovalActionResponse)
async def override_alert(id: int, req: OverrideAlertRequest, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == id).first()
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert {id} not found")

    alert.status = "overridden"
    now = datetime.utcnow()

    # Log to overrides table (feeds KPI H3: Alert False Positive Rate)
    override_log = Override(
        alert_id=alert.id,
        user=req.user,
        reason_code=req.reason_code,
        note=req.note,
        created_at=now,
    )
    db.add(override_log)

    approval_obj = alert.approvals[0] if alert.approvals else None
    if approval_obj:
        approval_obj.status = "rejected"
        approval_obj.decided_at = now
        approval_obj.decided_by = req.user
        approval_obj.note = f"Overridden [{req.reason_code}]: {req.note or ''}"
    else:
        approval_obj = Approval(
            alert_id=alert.id,
            tier="supply_lead",
            status="rejected",
            sla_hours=12,
            sla_deadline=now,
            decided_at=now,
            decided_by=req.user,
            note=f"Overridden [{req.reason_code}]: {req.note or ''}",
        )
        db.add(approval_obj)

    db.commit()
    db.refresh(approval_obj)

    # Broadcast via WebSocket
    await manager.broadcast({
        "type": "ALERT_OVERRIDDEN",
        "alert_id": alert.id,
        "kpi_code": alert.kpi_code,
        "reason_code": req.reason_code,
        "user": req.user,
        "timestamp": now.isoformat() + "Z",
    })

    return ApprovalActionResponse(
        id=approval_obj.id,
        alert_id=alert.id,
        status="overridden",
        decided_at=now.isoformat() + "Z",
        decided_by=req.user,
        note=f"Overridden: {req.reason_code}",
    )
