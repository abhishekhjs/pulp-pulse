from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.app.models.db import get_db, ScanEvent
from backend.app.models.schemas import ScanEventCreate, ScanEventResponse
from backend.app.agents import scan_processor

scans_router = APIRouter(prefix="/scans", tags=["scans"])

@scans_router.post("", response_model=ScanEventResponse)
def ingest_scan(payload: ScanEventCreate, db: Session = Depends(get_db)):
    """
    Ingests RFID or barcode scan as the sole physical movement write path.
    Atomically updates batches and channel_sales, and triggers the Inventory Freshness Agent.
    """
    try:
        response = scan_processor.process_scan_event(db, payload)
        return response
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to process scan event: {str(e)}")

@scans_router.get("", response_model=List[dict])
def list_recent_scans(limit: int = Query(25, ge=1, le=100), db: Session = Depends(get_db)):
    """Returns recent scan events for audit."""
    scans = db.query(ScanEvent).order_by(ScanEvent.scanned_at.desc()).limit(limit).all()
    return [
        {
            "id": s.id,
            "parcel_code": s.parcel_code,
            "from_node_type": s.from_node_type,
            "from_node_id": s.from_node_id,
            "to_node_type": s.to_node_type,
            "to_node_id": s.to_node_id,
            "flavor_id": s.flavor_id,
            "batch_id": s.batch_id,
            "quantity": s.quantity,
            "scanned_at": s.scanned_at.isoformat() + "Z",
        }
        for s in scans
    ]
