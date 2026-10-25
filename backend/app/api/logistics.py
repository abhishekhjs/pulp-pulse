from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from backend.app.models.db import get_db
from backend.app.services.weather_hazard_service import (
    get_current_weather_and_hazard,
    set_weather_scenario,
    COOPERATIVE_METADATA,
)
from backend.app.services.transport_optimizer import (
    optimize_transport_routes,
    CORRIDORS_CATALOG,
)
from backend.app.services.import_timing_service import (
    get_quarterly_import_analysis,
    recommend_po_placement,
)
from backend.app.agents.transportation_agent import evaluate_transportation_kpis
from backend.app.agents.approval_router import route_and_enforce_approvals
from backend.app.api.ws import manager

logistics_router = APIRouter(prefix="/logistics", tags=["logistics"])

class WeatherSimulateRequest(BaseModel):
    scenario: str = Field(
        default="rain_warning",
        description="Scenario type: 'clear', 'rain_warning', or 'landslide_block'",
    )

class ImportPoRequest(BaseModel):
    target_arrival_date: str = Field(
        default="2027-05-20",
        description="Desired arrival date at processing plant (YYYY-MM-DD)",
    )
    volume_kg: float = Field(default=24000.0, ge=1000.0, description="Volume in kg")
    ingredient: str = Field(default="Dragonfruit Pulp", description="Ingredient name")

@logistics_router.get("/corridors")
def list_corridors():
    """List all supported origin-to-destination transport corridors."""
    return list(CORRIDORS_CATALOG.values())

@logistics_router.get("/routes/optimize")
def get_optimized_routes(
    corridor_id: str = Query("coop_to_plant", description="Corridor ID"),
    cargo_type: Optional[str] = Query(None, description="Cargo description"),
    volume_kg: Optional[float] = Query(None, description="Weight in kg"),
    urgency_level: str = Query("balanced", description="cost_priority, speed_priority, balanced"),
):
    """
    Computes time and money trade-offs across 5 transport modes (Road, Express, Rail, Staged, Air)
    and identifies the Pareto-optimal choice under live weather and landslide conditions.
    """
    return optimize_transport_routes(
        corridor_id=corridor_id,
        cargo_type=cargo_type,
        volume_kg=volume_kg,
        urgency_level=urgency_level,
    )

@logistics_router.get("/import-timing")
def get_import_quarterly_timing(
    quarter: str = Query("Q2", description="Target quarter: Q1, Q2, Q3, Q4"),
):
    """
    Returns weekly cost and lead time indices for importing goods from overseas,
    identifying the Golden Window (Weeks 4-8) and seasonal calendar factors.
    """
    return get_quarterly_import_analysis(quarter=quarter)

@logistics_router.post("/import-timing/recommend")
def calculate_po_date(req: ImportPoRequest):
    """
    Calculates the ideal purchase order placement week in the Golden Window
    for lowest landed cost and shortest lead time.
    """
    return recommend_po_placement(
        target_arrival_date=req.target_arrival_date,
        volume_kg=req.volume_kg,
        ingredient=req.ingredient,
    )

@logistics_router.get("/weather-watch")
def get_cooperative_weather_watch():
    """
    Returns live weather telemetry, rainfall accumulation, landslide hazard index,
    highway passability status, and 7-day predictive forecast for the cooperative area.
    """
    return get_current_weather_and_hazard()

@logistics_router.post("/weather-watch/simulate")
async def simulate_cooperative_weather(
    req: WeatherSimulateRequest,
    db: Session = Depends(get_db),
):
    """
    Simulates weather/geological conditions (clear, rain_warning, landslide_block),
    triggers the transportation agent to raise/update alerts, and pushes a live WebSocket notification.
    """
    valid_scenarios = ["clear", "rain_warning", "landslide_block"]
    if req.scenario not in valid_scenarios:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid scenario '{req.scenario}'. Must be one of: {valid_scenarios}",
        )

    # 1. Update weather telemetry
    updated_state = set_weather_scenario(req.scenario)

    # 2. Run transportation agent evaluation
    new_alerts = evaluate_transportation_kpis(db)
    if new_alerts:
        route_and_enforce_approvals(db)

    # 3. Broadcast live WebSocket event to connected frontend clients
    telemetry = updated_state["telemetry"]
    await manager.broadcast({
        "type": "WEATHER_HAZARD_ALERT",
        "scenario": req.scenario,
        "hazard_score": telemetry["landslide_hazard_score"],
        "road_status": telemetry["road_status"],
        "message": f"Cooperative Weather Updated: {telemetry['road_status_label']} ({telemetry['weather_condition']})",
        "alerts_raised": len(new_alerts),
    })

    return {
        "scenario": req.scenario,
        "status": "success",
        "alerts_raised_count": len(new_alerts),
        "telemetry": updated_state,
    }
