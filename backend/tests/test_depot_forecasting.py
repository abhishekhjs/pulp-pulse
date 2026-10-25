import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.models.db import SessionLocal, init_db, Depot, Flavor, Batch, Transfer, Alert, Approval
from backend.app.data.seed_synthetic import seed_data
from backend.app.services.depot_forecasting_service import forecast_depot_flavor, get_network_matrix
from backend.app.services.redistribution_optimizer import (
    find_redistribution_opportunities,
    create_redistribution_alert_and_transfer,
    execute_buffer_transfer,
)

@pytest.fixture(scope="module")
def client():
    init_db()
    with SessionLocal() as db:
        seed_data(db, reset=True)
    with TestClient(app) as c:
        yield c

def test_depot_flavor_forecast():
    with SessionLocal() as db:
        # Depot 1 (Delhi NCR), Flavor 5 (Dragon Passion)
        res = forecast_depot_flavor(1, 5, horizon_days=14, db=db)
        assert res["depot_id"] == 1
        assert res["flavor_id"] == 5
        assert len(res["forecast_dates"]) == 14
        assert len(res["forecast_p50"]) == 14
        assert len(res["forecast_p10"]) == 14
        assert len(res["forecast_p90"]) == 14
        assert res["daily_run_rate"] > 0
        assert res["days_of_cover"] > 0
        assert len(res["segments"]) >= 3
        # Check downstream segments
        seg_names = [s["segment"] for s in res["segments"]]
        assert "Quick Commerce" in seg_names
        assert "Modern Trade" in seg_names
        assert any("distributor_name" in s for s in res["segments"])

def test_network_matrix():
    with SessionLocal() as db:
        matrix = get_network_matrix(db)
        assert "depots" in matrix
        assert len(matrix["depots"]) == 9
        summary = matrix["summary"]
        assert summary["total_depots"] == 9
        assert summary["total_flavor_depot_nodes"] == 45
        assert summary["deficit_count"] + summary["surplus_count"] + summary["healthy_count"] == 45

def test_redistribution_opportunities_and_arbitrage():
    with SessionLocal() as db:
        opps = find_redistribution_opportunities(db)
        assert len(opps) > 0

        # Inspect top opportunity
        top_opp = opps[0]
        assert top_opp["cost_per_bottle"] == 1.50
        assert top_opp["total_redistribution_cost"] == round(top_opp["buffer_bottles"] * 1.50, 2)
        assert top_opp["prevented_writeoff_loss"] == round(top_opp["buffer_bottles"] * 60.00, 2)
        assert top_opp["prevented_distress_discount_loss"] == round(top_opp["buffer_bottles"] * 30.00, 2)
        assert top_opp["protected_contribution_margin"] == round(top_opp["buffer_bottles"] * 19.20, 2)
        assert top_opp["net_economic_benefit"] > 0
        assert top_opp["roi_multiple"] >= 10.0
        assert top_opp["is_financially_viable"] is True
        assert "recommendation_reason" in top_opp
        assert top_opp["buffer_bottles"] >= 50

def test_create_and_execute_buffer_transfer():
    with SessionLocal() as db:
        opps = find_redistribution_opportunities(db)
        assert len(opps) > 0
        opp = opps[0]

        # 1. Create Alert and Transfer
        alert, transfer, approval = create_redistribution_alert_and_transfer(db, opp)
        assert alert.id is not None
        assert alert.kpi_code == "E1"
        assert alert.status == "open"
        assert transfer.id is not None
        assert transfer.status == "recommended"
        assert transfer.quantity == opp["buffer_bottles"]
        assert approval.status == "pending"

        # Record surplus depot initial stock
        surplus_batches_before = (
            db.query(Batch)
            .filter(Batch.depot_id == opp["surplus_depot_id"], Batch.flavor_id == opp["flavor_id"])
            .all()
        )
        total_surplus_before = sum(b.quantity for b in surplus_batches_before)

        # 2. Execute buffer transfer
        exec_res = execute_buffer_transfer(db, transfer.id, approver="supply_lead_1")
        assert exec_res["status"] == "in_transit"
        assert exec_res["buffer_bottles"] == opp["buffer_bottles"]

        # Verify surplus depot stock decreased
        surplus_batches_after = (
            db.query(Batch)
            .filter(Batch.depot_id == opp["surplus_depot_id"], Batch.flavor_id == opp["flavor_id"])
            .all()
        )
        total_surplus_after = sum(b.quantity for b in surplus_batches_after)
        assert total_surplus_before - total_surplus_after == opp["buffer_bottles"]

        # Verify destination depot received batch
        dest_batch = db.query(Batch).filter(Batch.id == exec_res["dest_batch_id"]).first()
        assert dest_batch is not None
        assert dest_batch.depot_id == opp["deficit_depot_id"]
        assert dest_batch.quantity == opp["buffer_bottles"]

def test_api_matrix_and_forecast_endpoints(client):
    # GET /api/depot-forecast/matrix
    res = client.get("/api/depot-forecast/matrix")
    assert res.status_code == 200
    data = res.json()
    assert len(data["depots"]) == 9

    # GET /api/depot-forecast/1/flavor/5
    res = client.get("/api/depot-forecast/1/flavor/5")
    assert res.status_code == 200
    data = res.json()
    assert data["depot_id"] == 1
    assert data["flavor_name"] == "Dragon Passion"
    assert len(data["forecast_p50"]) == 14

def test_api_simulate_surge_and_approve(client):
    # POST /api/depot-forecast/simulate-surge
    surge_payload = {
        "depot_id": 1,
        "flavor_id": 5,
        "surge_multiplier": 3.0,
        "segment": "Quick Commerce",
        "auto_create_alert": True,
    }
    res = client.post("/api/depot-forecast/simulate-surge", json=surge_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "surge_simulated"
    assert data["best_optimal_match"] is not None
    assert data["alert_created"] is not None
    transfer_id = data["alert_created"]["transfer_id"]

    # POST /api/depot-forecast/rebalancing/approve/{transfer_id}
    appr_res = client.post(f"/api/depot-forecast/rebalancing/approve/{transfer_id}")
    assert appr_res.status_code == 200
    appr_data = appr_res.json()
    assert appr_data["status"] == "success"
    assert "buffer bottles" in appr_data["message"]
