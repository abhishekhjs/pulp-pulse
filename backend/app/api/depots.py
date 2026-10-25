from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.models.db import get_db, Depot, Batch, Flavor
from backend.app.models.schemas import DepotSummary, FlavorCover, BatchItem

depots_router = APIRouter(prefix="/depots", tags=["depots"])

@depots_router.get("", response_model=List[DepotSummary])
def list_depots(db: Session = Depends(get_db)):
    depots = db.query(Depot).all()
    flavors = db.query(Flavor).all()

    summaries: List[DepotSummary] = []

    for d in depots:
        batches = db.query(Batch).filter(
            Batch.depot_id == d.id,
            Batch.status.in_(["fresh", "at_risk"]),
        ).all()

        total_bottles = sum(b.quantity for b in batches)
        at_risk_count = sum(1 for b in batches if b.age_days >= 18)

        # Flavor cover breakdown
        flavor_covers: List[FlavorCover] = []
        for f in flavors:
            flavor_batches = [b for b in batches if b.flavor_id == f.id]
            f_stock = sum(b.quantity for b in flavor_batches)
            daily_run_rate = max(0.5, round((80.0 * f.summer_share_pct) / 9.0, 2))
            cover_days = round(f_stock / daily_run_rate, 1)

            status = "healthy"
            if cover_days < 7.0:
                status = "critical"
            elif cover_days > 16.0:
                status = "excessive"

            flavor_covers.append(FlavorCover(
                flavor_id=f.id,
                flavor_name=f.name,
                total_stock=f_stock,
                daily_run_rate=daily_run_rate,
                cover_days=cover_days,
                status=status,
            ))

        summaries.append(DepotSummary(
            id=d.id,
            name=d.name,
            region=d.region,
            total_bottles=total_bottles,
            flavors=flavor_covers,
            batches_count=len(batches),
            at_risk_count=at_risk_count,
        ))

    return summaries

@depots_router.get("/{id}/batches", response_model=List[BatchItem])
def get_depot_batches(id: int, db: Session = Depends(get_db)):
    depot = db.query(Depot).filter(Depot.id == id).first()
    if not depot:
        raise HTTPException(status_code=404, detail=f"Depot {id} not found")

    batches = db.query(Batch).filter(
        Batch.depot_id == id,
        Batch.status.in_(["fresh", "at_risk", "rejected"]),
    ).order_by(Batch.age_days.desc()).all()

    results: List[BatchItem] = []
    for b in batches:
        results.append(BatchItem(
            id=b.id,
            flavor_id=b.flavor_id,
            flavor_name=b.flavor.name if b.flavor else "Unknown",
            depot_id=b.depot_id,
            depot_name=depot.name,
            bottled_date=b.bottled_date.isoformat(),
            quantity=b.quantity,
            age_days=b.age_days,
            days_to_transfer=max(0, 18 - b.age_days),
            days_to_cliff=max(0, 30 - b.age_days),
            status=b.status,
        ))

    return results
