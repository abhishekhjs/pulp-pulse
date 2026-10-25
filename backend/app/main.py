import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.models.db import init_db, SessionLocal, KpiThreshold
from backend.app.data.seed_synthetic import seed_data
from backend.app.agents.graph import run_agent_pipeline
from backend.app.api.kpi import kpi_router
from backend.app.api.alerts import alerts_router
from backend.app.api.approvals import approvals_router
from backend.app.api.depots import depots_router
from backend.app.api.transfers import transfers_router
from backend.app.api.scenario import scenario_router
from backend.app.api.forecast import forecast_router
from backend.app.api.scans import scans_router
from backend.app.api.modules import modules_router
from backend.app.api.dmaic_proxy import router as dmaic_proxy_router
from backend.app.api.graphs import graphs_router, FRONTEND_PUBLIC_GRAPHS
from backend.app.api.ws import ws_router
from backend.app.api.depot_forecasting import depot_forecast_router
from backend.app.api.logistics import logistics_router
from backend.app.services.matplotlib_charts import generate_all_graphs

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables exist and seed baseline data
    init_db()
    with SessionLocal() as db:
        if db.query(KpiThreshold).count() == 0:
            seed_data(db, reset=False)
    # Run initial agent graph cycle
    try:
        run_agent_pipeline()
    except Exception as e:
        print(f"Warning: Initial agent evaluation encountered: {e}")

    # Generate initial matplotlib graphs into frontend/public/graphs
    try:
        generate_all_graphs(export_dir=FRONTEND_PUBLIC_GRAPHS)
    except Exception as e:
        print(f"Warning: Initial matplotlib chart generation encountered: {e}")

    yield
    # Shutdown

app = FastAPI(
    title="Project Resilient Pulp - Supply Chain Intelligence API",
    description="Multi-agent supply chain intelligence dashboard for Pulp Riot Juice Co.",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for Vite dev server and external clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers under /api
app.include_router(kpi_router, prefix="/api")
app.include_router(alerts_router, prefix="/api")
app.include_router(approvals_router, prefix="/api")
app.include_router(depots_router, prefix="/api")
app.include_router(transfers_router, prefix="/api")
app.include_router(scenario_router, prefix="/api")
app.include_router(forecast_router, prefix="/api")
app.include_router(scans_router, prefix="/api")
app.include_router(modules_router, prefix="/api")
app.include_router(graphs_router, prefix="/api")
app.include_router(depot_forecast_router, prefix="/api")
app.include_router(logistics_router, prefix="/api")
app.include_router(ws_router)  # Mounted directly for /ws/alerts
app.include_router(dmaic_proxy_router, prefix="/api")  # DMAIC Agent proxy

from fastapi.staticfiles import StaticFiles

# Mount static graphs directory if present
if os.path.exists(FRONTEND_PUBLIC_GRAPHS):
    app.mount("/graphs", StaticFiles(directory=FRONTEND_PUBLIC_GRAPHS), name="graphs")

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Project Resilient Pulp Supply Chain Intelligence API",
        "version": "1.0.0",
    }

from fastapi.staticfiles import StaticFiles

# Mount static frontend build if present
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
