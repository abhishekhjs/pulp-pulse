import os
import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from backend.app.models.db import get_db
from backend.app.services.matplotlib_charts import (
    GRAPH_REGISTRY,
    generate_all_graphs,
    _fig_to_png_bytes,
    _fig_to_base64,
)
from backend.app.services.plotly_charts import PLOTLY_REGISTRY
from backend.app.services.plotly_data_service import (
    get_dashboard_radar_data,
    get_dashboard_waterfall_data,
    get_dashboard_kpi_trend_data,
    get_demand_viral_propagation_data,
    get_demand_flavor_share_data,
    get_demand_decomposition_data,
    get_distribution_fill_rate_data,
    get_distribution_gap_bubble_data,
    get_inventory_shelf_life_data,
    get_inventory_pareto_data,
    get_supply_copacker_utilization_data,
    get_supply_buffer_share_data,
    get_supply_lead_times_data,
    get_supply_risk_matrix_data,
    get_supply_dual_axis_data,
    get_transportation_temp_telemetry_data,
    get_transportation_freight_cost_data,
    get_transportation_transit_sla_data,
    get_scenario_replay_data,
)
from backend.app.api.ws import manager

DATA_REGISTRY = {
    "dashboard_resilience_radar": lambda db, **kw: get_dashboard_radar_data(db),
    "dashboard_waterfall": lambda db, **kw: get_dashboard_waterfall_data(db),
    "dashboard_kpi_trend": lambda db, kpi_code="B3", **kw: get_dashboard_kpi_trend_data(kpi_code, db),
    "demand_viral_propagation": lambda db, **kw: get_demand_viral_propagation_data(db),
    "demand_flavor_share": lambda db, **kw: get_demand_flavor_share_data(db),
    "demand_decomposition": lambda db, **kw: get_demand_decomposition_data(db),
    "distribution_fill_rate": lambda db, **kw: get_distribution_fill_rate_data(db),
    "distribution_gap_bubble": lambda db, **kw: get_distribution_gap_bubble_data(db),
    "inventory_shelf_life": lambda db, **kw: get_inventory_shelf_life_data(db),
    "inventory_pareto": lambda db, **kw: get_inventory_pareto_data(db),
    "supply_copacker_utilization": lambda db, **kw: get_supply_copacker_utilization_data(db),
    "supply_copacker_share": lambda db, **kw: get_supply_buffer_share_data(db),
    "supply_lead_times": lambda db, **kw: get_supply_lead_times_data(db),
    "supply_risk_matrix": lambda db, **kw: get_supply_risk_matrix_data(db),
    "supply_dual_axis": lambda db, **kw: get_supply_dual_axis_data(db),
    "transportation_temp_telemetry": lambda db, **kw: get_transportation_temp_telemetry_data(db),
    "transportation_freight_cost": lambda db, **kw: get_transportation_freight_cost_data(db),
    "transportation_transit_sla": lambda db, **kw: get_transportation_transit_sla_data(db),
    "scenario_replay_comparison": lambda db, **kw: get_scenario_replay_data(db),
}

graphs_router = APIRouter(prefix="/graphs", tags=["graphs"])

FRONTEND_PUBLIC_GRAPHS = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "public", "graphs")
)

@graphs_router.get("/catalog")
def get_graphs_catalog():
    """Returns catalog of all registered Matplotlib backend charts."""
    catalog = []
    for graph_id, meta in GRAPH_REGISTRY.items():
        file_path = f"/graphs/{graph_id}.png"
        disk_path = os.path.join(FRONTEND_PUBLIC_GRAPHS, f"{graph_id}.png")
        size_bytes = os.path.getsize(disk_path) if os.path.exists(disk_path) else 0

        catalog.append({
            "id": graph_id,
            "title": meta["title"],
            "category": meta["category"],
            "description": meta["description"],
            "file_path": file_path,
            "endpoint": f"/api/graphs/{graph_id}.png",
            "size_bytes": size_bytes,
        })
    return {
        "total": len(catalog),
        "graphs": catalog,
        "engine": "Matplotlib 3.11 (Python Backend)",
        "dpi": 160,
    }

@graphs_router.get("/data/all")
def get_all_graphs_data(db: Session = Depends(get_db)):
    """
    Returns database-driven datasets for all registered operational supply chain charts.
    """
    results = {}
    for gid, fn in DATA_REGISTRY.items():
        try:
            results[gid] = fn(db=db)
        except Exception as e:
            results[gid] = None

    return {
        "total": len(results),
        "source": "database",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "data": results,
    }

@graphs_router.get("/{graph_id}/data")
def get_graph_data(
    graph_id: str,
    kpi_code: Optional[str] = Query(None, description="Optional KPI code"),
    flavor_id: Optional[int] = Query(None, description="Optional flavor ID"),
    channel: Optional[str] = Query(None, description="Optional channel"),
    db: Session = Depends(get_db),
):
    """
    Returns live structured database records for Plotly interactive charts.
    """
    fn = DATA_REGISTRY.get(graph_id)
    if not fn:
        if graph_id not in GRAPH_REGISTRY:
            raise HTTPException(status_code=404, detail=f"Graph '{graph_id}' not found")
        return {
            "graph_id": graph_id,
            "data": {},
            "source": "database",
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }

    try:
        data = fn(db=db, kpi_code=kpi_code or "B3", flavor_id=flavor_id or 1, channel=channel or "QC")
        return {
            "graph_id": graph_id,
            "data": data,
            "source": "database",
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch data for graph '{graph_id}': {str(e)}")

@graphs_router.get("/{graph_id}/plotly")
def get_graph_plotly_figure(
    graph_id: str,
    kpi_code: Optional[str] = Query(None, description="Optional KPI code"),
    flavor_id: Optional[int] = Query(None, description="Optional flavor ID"),
    channel: Optional[str] = Query(None, description="Optional sales channel"),
    db: Session = Depends(get_db),
):
    """
    Renders and returns an interactive Plotly figure specification
    generated by plotly.py in Python from SQLite database telemetry.
    """
    if graph_id not in PLOTLY_REGISTRY:
        raise HTTPException(status_code=404, detail=f"Plotly graph '{graph_id}' not found in registry")

    meta = PLOTLY_REGISTRY[graph_id]
    fn = meta["fn"]

    try:
        kwargs = {}
        if kpi_code:
            kwargs["kpi_code"] = kpi_code
        if flavor_id:
            kwargs["flavor_id"] = flavor_id
        if channel:
            kwargs["channel"] = channel

        fig = fn(db=db, **kwargs)
        fig_dict = json.loads(fig.to_json())

        return {
            "graph_id": graph_id,
            "title": meta["title"],
            "category": meta["category"],
            "engine": "plotly.py",
            "source": "database",
            "data": fig_dict.get("data", []),
            "layout": fig_dict.get("layout", {}),
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to render Plotly figure '{graph_id}': {str(e)}")

@graphs_router.get("/{graph_id}.png")
def get_graph_image(
    graph_id: str,
    kpi_code: Optional[str] = Query(None, description="Optional KPI code for trend graphs"),
    flavor_id: Optional[int] = Query(None, description="Optional flavor ID"),
    channel: Optional[str] = Query(None, description="Optional sales channel"),
    db: Session = Depends(get_db),
):
    """
    Renders and streams high-resolution PNG bytes for the requested graph.
    Supports on-the-fly parametric rendering for specific KPIs and flavors.
    """
    if graph_id not in GRAPH_REGISTRY:
        raise HTTPException(status_code=404, detail=f"Graph '{graph_id}' not found in registry")

    meta = GRAPH_REGISTRY[graph_id]
    fn = meta["fn"]

    try:
        if graph_id == "dashboard_kpi_trend" and kpi_code:
            png_bytes = fn(kpi_code=kpi_code, db=db)
        elif graph_id in ("demand_forecast_fan", "monte_carlo_distribution") and flavor_id:
            if graph_id == "demand_forecast_fan" and channel:
                png_bytes = fn(flavor_id=flavor_id, channel=channel, db=db)
            else:
                png_bytes = fn(flavor_id=flavor_id, db=db)
        else:
            png_bytes = fn(db=db)

        return Response(
            content=png_bytes,
            media_type="image/png",
            headers={
                "Cache-Control": "public, max-age=30, must-revalidate",
                "X-Rendered-By": "Project-Resilient-Pulp-Matplotlib",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to render graph '{graph_id}': {str(e)}")

@graphs_router.get("/{graph_id}")
def get_graph_detail(graph_id: str, db: Session = Depends(get_db)):
    """Returns graph metadata and inline base64 image data URI."""
    if graph_id not in GRAPH_REGISTRY:
        raise HTTPException(status_code=404, detail=f"Graph '{graph_id}' not found in registry")

    meta = GRAPH_REGISTRY[graph_id]
    try:
        png_bytes = meta["fn"](db=db)
        import base64
        data_uri = f"data:image/png;base64,{base64.b64encode(png_bytes).decode('utf-8')}"
        return {
            "id": graph_id,
            "title": meta["title"],
            "category": meta["category"],
            "description": meta["description"],
            "data_url": data_uri,
            "size_bytes": len(png_bytes),
            "generated_at": datetime.utcnow().isoformat() + "Z",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rendering error: {str(e)}")

@graphs_router.post("/generate-all")
async def regenerate_all_graphs(db: Session = Depends(get_db)):
    """
    Regenerates all 25 Matplotlib charts, saves them to frontend/public/graphs,
    and broadcasts a WebSocket notification to push updates to the React client.
    """
    results = generate_all_graphs(export_dir=FRONTEND_PUBLIC_GRAPHS, db=db)
    success_count = sum(1 for r in results if r.get("status") == "success")

    # Broadcast event to all active WebSocket clients
    timestamp = datetime.utcnow().isoformat() + "Z"
    await manager.broadcast({
        "type": "GRAPHS_UPDATED",
        "timestamp": timestamp,
        "total_generated": len(results),
        "success_count": success_count,
        "graphs": results,
    })

    return {
        "status": "completed",
        "total": len(results),
        "success_count": success_count,
        "timestamp": timestamp,
        "graphs": results,
    }
