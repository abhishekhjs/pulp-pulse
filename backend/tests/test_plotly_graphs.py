import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.plotly_charts import PLOTLY_REGISTRY

client = TestClient(app)

def test_plotly_catalog():
    response = client.get("/api/graphs/catalog")
    assert response.status_code == 200
    data = response.json()
    assert "graphs" in data
    assert len(data["graphs"]) == 25

@pytest.mark.parametrize("graph_id", list(PLOTLY_REGISTRY.keys()))
def test_plotly_graph_endpoints(graph_id):
    response = client.get(f"/api/graphs/{graph_id}/plotly")
    assert response.status_code == 200, f"Graph {graph_id} failed with status {response.status_code}: {response.text}"
    body = response.json()
    assert body["graph_id"] == graph_id
    assert body["engine"] == "plotly.py"
    assert body["source"] == "database"
    assert "data" in body
    assert isinstance(body["data"], list)
    assert "layout" in body
    assert isinstance(body["layout"], dict)
