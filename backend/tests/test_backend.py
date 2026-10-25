import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.main import app
from backend.app.models.db import Base, get_db, KpiThreshold, Batch, Alert, Transfer, ProductionRun, ChannelSale
from backend.app.data.seed_synthetic import seed_data
from backend.app.agents.demand_agent import evaluate_demand_kpis
from backend.app.agents.supply_agent import evaluate_supply_kpis
from backend.app.agents.inventory_agent import evaluate_inventory_kpis
from backend.app.agents.approval_router import route_and_enforce_approvals
from backend.app.agents.graph import run_agent_pipeline

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_kpi_scorecard():
    response = client.get("/api/kpi/scorecard")
    assert response.status_code == 200
    data = response.json()
    assert "cards" in data
    assert len(data["cards"]) >= 10
    kpi_codes = [c["kpi_code"] for c in data["cards"]]
    assert "B3" in kpi_codes
    assert "C1" in kpi_codes
    assert "C3" in kpi_codes
    assert "D2" in kpi_codes
    assert "A1" in kpi_codes

def test_kpi_history():
    response = client.get("/api/kpi/B3/history")
    assert response.status_code == 200
    data = response.json()
    assert data["kpi_code"] == "B3"
    assert len(data["history"]) > 0

def test_alerts_list():
    response = client.get("/api/alerts")
    assert response.status_code == 200
    alerts = response.json()
    assert isinstance(alerts, list)
    assert len(alerts) > 0
    # Every alert must have confidence_pct and approval info
    first_alert = alerts[0]
    assert "confidence_pct" in first_alert
    assert "roi_trade_off" in first_alert

def test_alert_approve_and_override():
    # Fetch an open alert
    response = client.get("/api/alerts?status=open")
    alerts = response.json()
    if alerts:
        alert_id = alerts[0]["id"]

        # Test Approve
        app_res = client.post(f"/api/alerts/{alert_id}/approve", json={"approver": "lead_tester", "note": "Approved by automated test"})
        assert app_res.status_code == 200
        assert app_res.json()["status"] == "approved"

    # Fetch another open alert if exists for override
    response = client.get("/api/alerts?status=open")
    alerts = response.json()
    if len(alerts) > 0:
        alert_id = alerts[0]["id"]
        ov_res = client.post(f"/api/alerts/{alert_id}/override", json={"user": "tester", "reason_code": "already_handled", "note": "Testing override"})
        assert ov_res.status_code == 200
        assert ov_res.json()["status"] == "overridden"

def test_depots_and_batches():
    response = client.get("/api/depots")
    assert response.status_code == 200
    depots = response.json()
    assert len(depots) == 9

    depot_id = depots[0]["id"]
    batch_res = client.get(f"/api/depots/{depot_id}/batches")
    assert batch_res.status_code == 200
    batches = batch_res.json()
    assert len(batches) > 0
    first_batch = batches[0]
    assert "age_days" in first_batch
    assert "days_to_transfer" in first_batch
    assert "days_to_cliff" in first_batch

def test_transfers():
    response = client.get("/api/transfers")
    assert response.status_code == 200
    transfers = response.json()
    assert isinstance(transfers, list)

def test_scenario_replay():
    response = client.post("/api/scenario/replay")
    assert response.status_code == 200
    data = response.json()
    assert data["case_actual_damage_cr"] == 23.31
    assert data["agent_averted_damage_cr"] > 15.0
    assert len(data["timeline"]) == 9

    run_id = data["run_id"]
    get_res = client.get(f"/api/scenario/replay/{run_id}")
    assert get_res.status_code == 200
    assert get_res.json()["run_id"] == run_id

def test_logistics_and_weather_surveillance():
    # 1. Test route optimization & Pareto mode trade-offs
    res_opt = client.get("/api/logistics/routes/optimize?corridor_id=coop_to_plant&urgency_level=balanced")
    assert res_opt.status_code == 200
    opt_data = res_opt.json()
    assert "modes" in opt_data
    assert len(opt_data["modes"]) == 5
    assert "recommendation" in opt_data

    # 2. Test foreign import quarterly timing & Golden Window
    res_imp = client.get("/api/logistics/import-timing?quarter=Q2")
    assert res_imp.status_code == 200
    imp_data = res_imp.json()
    assert imp_data["selected_quarter"] == "Q2"
    assert len(imp_data["weekly_profile"]) == 13
    assert imp_data["executive_summary"]["lead_time_reduction_days"] > 10

    # 3. Test PO placement calculator
    res_po = client.post("/api/logistics/import-timing/recommend", json={
        "target_arrival_date": "2027-05-20",
        "volume_kg": 24000.0,
        "ingredient": "Dragonfruit Pulp"
    })
    assert res_po.status_code == 200
    po_data = res_po.json()
    assert po_data["lead_time_cushion_saved_days"] == 25
    assert po_data["estimated_savings_inr"] > 0

    # 4. Test cooperative weather watch & landslide simulation
    res_weather = client.get("/api/logistics/weather-watch")
    assert res_weather.status_code == 200
    w_data = res_weather.json()
    assert "telemetry" in w_data
    assert "forecast_7day" in w_data

    # Simulate active landslide roadblock
    res_sim = client.post("/api/logistics/weather-watch/simulate", json={"scenario": "landslide_block"})
    assert res_sim.status_code == 200
    sim_data = res_sim.json()
    assert sim_data["status"] == "success"
    assert sim_data["telemetry"]["telemetry"]["road_status"] == "BLOCKED_LANDSLIDE"
