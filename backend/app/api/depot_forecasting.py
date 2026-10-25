from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.models.db import (
    get_db,
    Depot,
    Flavor,
    Batch,
    Transfer,
    Alert,
    Approval,
    DepotDistributionDemand,
)
from backend.app.models.schemas import (
    DepotFlavorForecast,
    RedistributionOpportunity,
    TransferResponse,
)
from backend.app.services.depot_forecasting_service import (
    forecast_depot_flavor,
    get_network_matrix,
    get_depot_distribution_segments,
)
from backend.app.services.redistribution_optimizer import (
    find_redistribution_opportunities,
    create_redistribution_alert_and_transfer,
    execute_buffer_transfer,
)
from backend.app.api.ws import manager

depot_forecast_router = APIRouter(prefix="/depot-forecast", tags=["depot-forecast"])

class SurgeSimulationRequest(BaseModel):
    depot_id: int
    flavor_id: int
    surge_multiplier: float = Field(default=2.8, ge=1.2, le=10.0, description="Surge multiplier (e.g. 2.8 = +180% surge)")
    segment: str = Field(default="Quick Commerce", description="Segment experiencing the surge")
    auto_create_alert: bool = Field(default=True, description="Automatically generate alert and transfer recommendation")

@depot_forecast_router.get("/matrix")
def get_depot_forecast_matrix(db: Session = Depends(get_db)):
    """
    Returns full network matrix of all 9 depots x 5 flavors with forecast,
    cover days, and surplus/deficit status.
    """
    return get_network_matrix(db)

@depot_forecast_router.get("/segments")
def list_all_depot_segments(db: Session = Depends(get_db)):
    """
    Lists downstream distribution segments and distributors for each depot.
    """
    depots = db.query(Depot).all()
    res = {}
    for d in depots:
        res[d.id] = {
            "depot_id": d.id,
            "depot_name": d.name,
            "region": d.region,
            "segments": get_depot_distribution_segments(d.id, db),
        }
    return res

@depot_forecast_router.get("/{depot_id}/flavor/{flavor_id}", response_model=DepotFlavorForecast)
def get_depot_flavor_forecast_detail(
    depot_id: int,
    flavor_id: int,
    horizon_days: int = Query(14, ge=7, le=30),
    db: Session = Depends(get_db),
):
    """
    Collects past historical demand for a flavor at a specific depot across all downstream
    distributors and segments, forecasting future demand and computing days of cover.
    """
    depot = db.query(Depot).filter(Depot.id == depot_id).first()
    flavor = db.query(Flavor).filter(Flavor.id == flavor_id).first()
    if not depot:
        raise HTTPException(status_code=404, detail=f"Depot {depot_id} not found")
    if not flavor:
        raise HTTPException(status_code=404, detail=f"Flavor {flavor_id} not found")

    forecast_data = forecast_depot_flavor(depot_id, flavor_id, horizon_days=horizon_days, db=db)
    return DepotFlavorForecast(**forecast_data)

@depot_forecast_router.get("/rebalancing/opportunities", response_model=List[RedistributionOpportunity])
def list_redistribution_opportunities(
    flavor_id: Optional[int] = Query(None, description="Filter by flavor ID"),
    deficit_depot_id: Optional[int] = Query(None, description="Filter by deficit depot ID"),
    db: Session = Depends(get_db),
):
    """
    Identifies high-demand deficit depots vs stagnant surplus depots, selects the most
    compatible optimal path, computes buffer amount, and verifies the ₹1.50/bottle
    redistribution cost against avoided write-offs and distress discounts.
    """
    opps = find_redistribution_opportunities(
        db=db,
        target_flavor_id=flavor_id,
        target_deficit_depot_id=deficit_depot_id,
    )
    return [RedistributionOpportunity(**o) for o in opps]

@depot_forecast_router.post("/rebalancing/trigger")
async def trigger_autonomous_rebalancing(db: Session = Depends(get_db)):
    """
    Autonomous agent trigger: Scans the network for surge-surplus imbalances,
    evaluates path compatibility and the ₹1.50/bottle financial viability,
    and automatically creates actionable alerts and recommended transfers.
    """
    opps = find_redistribution_opportunities(db=db)
    viable_opps = [o for o in opps if o["is_financially_viable"] and o["buffer_bottles"] >= 50]

    created = []
    # Take top viable opportunities per distinct deficit node
    handled_deficits = set()
    for opp in viable_opps:
        key = (opp["flavor_id"], opp["deficit_depot_id"])
        if key in handled_deficits:
            continue
        handled_deficits.add(key)

        alert, transfer, approval = create_redistribution_alert_and_transfer(db, opp)
        created.append({
            "opp_id": opp["id"],
            "flavor": opp["flavor_name"],
            "from_depot": opp["surplus_depot_name"],
            "to_depot": opp["deficit_depot_name"],
            "buffer_bottles": opp["buffer_bottles"],
            "transfer_id": transfer.id,
            "alert_id": alert.id,
            "approval_id": approval.id,
            "roi_multiple": opp["roi_multiple"],
            "net_benefit": opp["net_economic_benefit"],
            "total_transfer_cost": opp["total_redistribution_cost"],
        })

        # Broadcast via WebSocket
        await manager.broadcast({
            "type": "REDISTRIBUTION_ALERT_CREATED",
            "alert_id": alert.id,
            "transfer_id": transfer.id,
            "flavor": opp["flavor_name"],
            "from_depot": opp["surplus_depot_name"],
            "to_depot": opp["deficit_depot_name"],
            "buffer_bottles": opp["buffer_bottles"],
            "roi": f"{opp['roi_multiple']}x",
        })

    return {
        "status": "success",
        "viable_opportunities_found": len(viable_opps),
        "alerts_and_transfers_created": len(created),
        "details": created,
    }

@depot_forecast_router.post("/simulate-surge")
async def simulate_demand_surge(req: SurgeSimulationRequest, db: Session = Depends(get_db)):
    """
    Simulates or ingests a sudden demand surge for a flavor at a depot (e.g. +180% surge on Quick Commerce).
    Immediately detects the deficit, pairs it with an optimal stagnant surplus depot,
    verifies the ₹1.50/bottle arbitrage, and generates the approval alert.
    """
    depot = db.query(Depot).filter(Depot.id == req.depot_id).first()
    flavor = db.query(Flavor).filter(Flavor.id == req.flavor_id).first()
    if not depot or not flavor:
        raise HTTPException(status_code=404, detail="Invalid depot or flavor ID")

    today = date.today()

    # 1. Update/Add today's demand record with surge volume
    existing_demand = (
        db.query(DepotDistributionDemand)
        .filter(
            DepotDistributionDemand.depot_id == req.depot_id,
            DepotDistributionDemand.flavor_id == req.flavor_id,
            DepotDistributionDemand.segment == req.segment,
            DepotDistributionDemand.date == today,
        )
        .first()
    )

    base_volume = int(max(15, (950.0 * (flavor.summer_share_pct or 0.2)) / 9.0 * 0.4))
    surged_volume = int(base_volume * req.surge_multiplier)

    if existing_demand:
        existing_demand.units_demanded = surged_volume
        existing_demand.stockout_units = max(0, int(surged_volume * 0.4))
        existing_demand.units_sold = surged_volume - existing_demand.stockout_units
    else:
        dist_name = f"{depot.name} {req.segment} Hub"
        db.add(DepotDistributionDemand(
            depot_id=req.depot_id,
            flavor_id=req.flavor_id,
            segment=req.segment,
            distributor_name=dist_name,
            date=today,
            units_demanded=surged_volume,
            units_sold=int(surged_volume * 0.6),
            forecast_units=base_volume,
            stockout_units=int(surged_volume * 0.4),
        ))
    db.commit()

    # 2. Run Redistribution Optimizer
    opps = find_redistribution_opportunities(
        db=db,
        target_flavor_id=req.flavor_id,
        target_deficit_depot_id=req.depot_id,
    )

    best_match = opps[0] if opps else None
    alert_info = None

    if best_match and req.auto_create_alert:
        alert, transfer, approval = create_redistribution_alert_and_transfer(db, best_match)
        alert_info = {
            "alert_id": alert.id,
            "transfer_id": transfer.id,
            "approval_id": approval.id,
            "status": alert.status,
            "message": alert.message,
        }

        await manager.broadcast({
            "type": "SURGE_ALERT_GENERATED",
            "depot_id": req.depot_id,
            "depot_name": depot.name,
            "flavor": flavor.name,
            "surge_multiplier": req.surge_multiplier,
            "surplus_source": best_match["surplus_depot_name"],
            "buffer_bottles": best_match["buffer_bottles"],
            "roi": f"{best_match['roi_multiple']}x",
        })

    return {
        "status": "surge_simulated",
        "depot_id": req.depot_id,
        "depot_name": depot.name,
        "flavor_id": req.flavor_id,
        "flavor_name": flavor.name,
        "segment": req.segment,
        "surged_demand_units": surged_volume,
        "best_optimal_match": best_match,
        "alert_created": alert_info,
    }

@depot_forecast_router.post("/rebalancing/approve/{transfer_id}")
async def approve_and_execute_transfer(
    transfer_id: int,
    approver: str = Query("supply_lead_1", description="Approving manager role"),
    note: Optional[str] = Query(None, description="Approval note"),
    db: Session = Depends(get_db),
):
    """
    Approves the recommended redistribution transfer and immediately executes it:
    - Atomically transfers the buffer amount from the surplus depot to the deficit depot.
    - Decrements the surplus batch and creates the destination batch.
    - Ingests the physical scan movement event.
    - Broadcasts the live update via WebSocket.
    """
    try:
        res = execute_buffer_transfer(
            db=db,
            transfer_id=transfer_id,
            approver=approver,
            note=note or "Approved buffer redistribution transfer",
        )

        await manager.broadcast({
            "type": "REDISTRIBUTION_TRANSFER_EXECUTED",
            "transfer_id": transfer_id,
            "from_depot_id": res["from_depot_id"],
            "to_depot_id": res["to_depot_id"],
            "buffer_bottles": res["buffer_bottles"],
            "scan_parcel_code": res["scan_parcel_code"],
        })

        return {
            "status": "success",
            "message": f"Successfully transferred {res['buffer_bottles']} buffer bottles from Surplus Depot #{res['from_depot_id']} to Deficit Depot #{res['to_depot_id']}.",
            "details": res,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
