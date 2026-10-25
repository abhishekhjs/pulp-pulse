import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.matplotlib_charts import GRAPH_REGISTRY, generate_all_graphs

client = TestClient(app)

def test_graphs_catalog():
    """Verify graphs catalog returns all 25 registered graphs."""
    response = client.get("/api/graphs/catalog")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 25
    assert len(data["graphs"]) == 25
    ids = [g["id"] for g in data["graphs"]]
    assert "dashboard_waterfall" in ids
    assert "demand_forecast_fan" in ids
    assert "monte_carlo_distribution" in ids
    assert "scenario_replay_comparison" in ids

def test_graph_image_endpoint():
    """Verify image endpoint streams valid PNG bytes."""
    response = client.get("/api/graphs/dashboard_resilience_radar.png")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert len(response.content) > 1000

def test_graph_parametric_trend():
    """Verify KPI trend supports query parameters."""
    response = client.get("/api/graphs/dashboard_kpi_trend.png?kpi_code=D2")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert len(response.content) > 1000

def test_graph_detail_base64():
    """Verify graph detail returns data URL."""
    response = client.get("/api/graphs/demand_viral_propagation")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "demand_viral_propagation"
    assert data["data_url"].startswith("data:image/png;base64,")

def test_generate_all_graphs_bulk():
    """Verify generate-all endpoint executes cleanly."""
    response = client.post("/api/graphs/generate-all")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert data["total"] == 25
    assert data["success_count"] == 25


def test_graphs_plotly_data_all():
    """Verify bulk Plotly data endpoint returns active database datasets for all graphs."""
    response = client.get("/api/graphs/data/all")
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "total" in data
    assert data["total"] >= 18
    # Check core datasets are present
    assert "dashboard_resilience_radar" in data["data"]
    assert "dashboard_waterfall" in data["data"]
    assert "demand_viral_propagation" in data["data"]
    assert "distribution_gap_bubble" in data["data"]
    assert "inventory_shelf_life" in data["data"]
    assert "inventory_pareto" in data["data"]
    assert "supply_copacker_utilization" in data["data"]
    assert "transportation_temp_telemetry" in data["data"]


def test_graphs_plotly_data_individual():
    """Verify individual graph DB endpoints return structured data."""
    # Test radar data
    res_radar = client.get("/api/graphs/dashboard_resilience_radar/data")
    assert res_radar.status_code == 200
    radar_data = res_radar.json()["data"]
    assert "dimensions" in radar_data
    assert len(radar_data["dimensions"]) == 6

    # Test waterfall data
    res_waterfall = client.get("/api/graphs/dashboard_waterfall/data")
    assert res_waterfall.status_code == 200
    wf_data = res_waterfall.json()["data"]
    assert "waterfall" in wf_data
    assert len(wf_data["waterfall"]) == 6

    # Test parametric KPI trend
    res_kpi = client.get("/api/graphs/dashboard_kpi_trend/data?kpi_code=B3")
    assert res_kpi.status_code == 200
    kpi_payload = res_kpi.json()
    kpi_data = kpi_payload["data"]
    assert kpi_data["kpi_code"] == "B3"
    assert "history" in kpi_data
    assert len(kpi_data["history"]) > 0

    # Test inventory Pareto
    res_pareto = client.get("/api/graphs/inventory_pareto/data")
    assert res_pareto.status_code == 200
    pareto_data = res_pareto.json()["data"]
    assert "pareto" in pareto_data
    assert len(pareto_data["pareto"]) > 0
    assert "cumPct" in pareto_data["pareto"][0]

    # Test scenario replay
    res_replay = client.get("/api/graphs/scenario_replay_comparison/data")
    assert res_replay.status_code == 200
    replay_data = res_replay.json()["data"]
    assert "trajectory" in replay_data
    assert len(replay_data["trajectory"]) == 16


def test_graphs_plotly_data_not_found():
    """Verify 404 response for unknown graph dataset request."""
    response = client.get("/api/graphs/non_existent_graph/data")
    assert response.status_code == 404

