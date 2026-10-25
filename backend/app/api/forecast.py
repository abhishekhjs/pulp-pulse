from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from backend.app.models.db import get_db, Flavor
from backend.app.forecasting import monte_carlo, sarimax_model

forecast_router = APIRouter(prefix="/forecast", tags=["forecast"])

class MonteCarloRequest(BaseModel):
    channel: str = Field(default="QC", description="Distribution channel (GT, MT, QC)")
    n_runs: int = Field(default=1000, ge=100, le=5000, description="Number of simulation iterations")
    horizon_days: int = Field(default=14, ge=7, le=30, description="Simulation horizon in days")
    target_service_level: float = Field(default=0.95, ge=0.80, le=0.999, description="Target service level probability (0.95 = 95%)")
    seed: Optional[int] = Field(default=42, description="Random seed for deterministic replay")

class MonteCarloResponse(BaseModel):
    flavor_id: int
    flavor_name: str
    channel: str
    horizon_days: int
    dates: List[str]
    p10: List[int]
    p50: List[int]
    p90: List[int]
    current_buffer_days: float
    recommended_buffer_days: float
    recommended_buffer_bottles: int
    target_service_level: float
    stockout_risk_current_pct: float

@forecast_router.post("/{flavor_id}/monte-carlo", response_model=MonteCarloResponse)
def run_monte_carlo_stress_test(
    flavor_id: int,
    req: MonteCarloRequest = MonteCarloRequest(),
    db: Session = Depends(get_db),
):
    flavor = db.query(Flavor).filter(Flavor.id == flavor_id).first()
    if not flavor:
        raise HTTPException(status_code=404, detail=f"Flavor {flavor_id} not found")

    sim_res = monte_carlo.simulate(
        flavor_id=flavor_id,
        channel=req.channel,
        n_runs=req.n_runs,
        horizon_days=req.horizon_days,
        seed=req.seed,
        db=db,
    )

    buffer_res = monte_carlo.reverse_engineer_buffer(
        flavor_id=flavor_id,
        target_service_level=req.target_service_level,
        sim_paths=sim_res["sim_paths"],
        channel=req.channel,
        horizon_days=req.horizon_days,
        seed=req.seed,
        db=db,
    )

    return MonteCarloResponse(
        flavor_id=flavor_id,
        flavor_name=flavor.name,
        channel=req.channel,
        horizon_days=req.horizon_days,
        dates=sim_res["dates"],
        p10=sim_res["p10"],
        p50=sim_res["p50"],
        p90=sim_res["p90"],
        current_buffer_days=buffer_res["current_buffer_days"],
        recommended_buffer_days=buffer_res["recommended_buffer_days"],
        recommended_buffer_bottles=buffer_res["recommended_buffer_bottles"],
        target_service_level=buffer_res["target_service_level"],
        stockout_risk_current_pct=buffer_res["stockout_risk_current_pct"],
    )

@forecast_router.get("/{flavor_id}")
def get_flavor_forecast(
    flavor_id: int,
    channel: str = Query("QC", description="Distribution channel (QC, MT, GT)"),
    horizon_days: int = Query(14, ge=7, le=30),
    cutoff: Optional[str] = Query(None, description="Optional cutoff date (YYYY-MM-DD) for historical baseline"),
    db: Session = Depends(get_db),
):
    flavor = db.query(Flavor).filter(Flavor.id == flavor_id).first()
    if not flavor:
        raise HTTPException(status_code=404, detail=f"Flavor {flavor_id} not found")
    res = sarimax_model.forecast(flavor_id=flavor_id, channel=channel, horizon_days=horizon_days, db=db, cutoff=cutoff)
    return res
