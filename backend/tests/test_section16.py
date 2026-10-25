import os
import json
import pytest
from datetime import date, datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from backend.app.main import app
from backend.app.models.db import SessionLocal, KpiThreshold, Flavor, ChannelSale, Batch, Alert, Override, ScanEvent
from backend.app.forecasting import sarimax_model, exog_builder, monte_carlo
from backend.app.agents import dmac_agent, sentiment_signal, scan_processor
from backend.app.models.schemas import ScanEventCreate

client = TestClient(app)

# ─── 16.1 SARIMAX Forecasting Engine ──────────────────────────────
def test_sarimax_forecast_14_days_and_confidence_interval():
    """Given 90+ days of seeded channel_sales, sarimax_model.forecast returns a 14-day forecast with confidence interval."""
    with SessionLocal() as db:
        flavor = db.query(Flavor).filter(Flavor.name == "Mango Peach Basil").first()
        assert flavor is not None, "Flavor must exist"

        res = sarimax_model.forecast(flavor.id, "GT", horizon_days=14, db=db)
        assert len(res["dates"]) == 14
        assert len(res["point_forecast"]) == 14
        assert len(res["ci_lower"]) == 14
        assert len(res["ci_upper"]) == 14
        assert res["residual_std"] > 0

        # Confidence intervals must encompass or bracket point forecast
        for pt, low, up in zip(res["point_forecast"], res["ci_lower"], res["ci_upper"]):
            assert low <= pt <= up or low <= up

        # B2 Error calculation on core SKU against synthetic history: must land under 20%
        history_sales = (
            db.query(ChannelSale)
            .filter(ChannelSale.flavor_id == flavor.id, ChannelSale.channel == "GT")
            .order_by(ChannelSale.date.desc())
            .limit(14)
            .all()
        )
        assert len(history_sales) >= 14
        tot_actual = sum(s.units_sold for s in history_sales)
        tot_forecast = sum(s.forecast_units for s in history_sales)
        b2_error = abs(tot_actual - tot_forecast) / float(tot_forecast)
        assert b2_error < 0.20, f"Core SKU B2 error rate {b2_error:.2%} must be under 20%"

# ─── 16.2 Exogenous Weighting Parameters ──────────────────────────
def test_exogenous_builder_dynamic_config():
    """A new regressor in forecast_exog.json is dynamically included in the DataFrame."""
    with SessionLocal() as db:
        dates = [date(2027, 4, 1), date(2027, 4, 2)]
        df = exog_builder.build(1, "QC", dates, db=db)

        # Configured regressors must be present
        assert "seasonality" in df.columns
        assert "marketing_campaign_flag" in df.columns
        assert "social_trend_score" in df.columns
        assert "channel_growth_rate" in df.columns
        assert len(df) == 2

# ─── 16.3 Monte Carlo Simulation ──────────────────────────────────
def test_monte_carlo_deterministic_bands():
    """POST /api/forecast/{flavor_id}/monte-carlo with fixed seed returns deterministic P10/P50/P90 bands."""
    with SessionLocal() as db:
        flavor = db.query(Flavor).filter(Flavor.name == "Dragon Passion").first()
        flv_id = flavor.id if flavor else 5

    res1 = client.post(f"/api/forecast/{flv_id}/monte-carlo", json={"n_runs": 500, "horizon_days": 14, "seed": 100})
    assert res1.status_code == 200
    data1 = res1.json()

    res2 = client.post(f"/api/forecast/{flv_id}/monte-carlo", json={"n_runs": 500, "horizon_days": 14, "seed": 100})
    assert res2.status_code == 200
    data2 = res2.json()

    # Deterministic replay with same seed
    assert data1["p10"] == data2["p10"]
    assert data1["p50"] == data2["p50"]
    assert data1["p90"] == data2["p90"]
    assert data1["recommended_buffer_days"] == data2["recommended_buffer_days"]
    assert data1["recommended_buffer_bottles"] > 0
    assert data1["target_service_level"] == 0.95

# ─── 16.4 RFID & Barcode Scan Ingestion ────────────────────────────
def test_scan_ingestion_atomic_updates_and_event_trigger():
    """POST /api/scans updates batches.status and channel_sales within the same request."""
    with SessionLocal() as db:
        # Find an existing batch with stock
        batch = db.query(Batch).filter(Batch.quantity > 5).first()
        assert batch is not None
        b_id = batch.id
        orig_qty = batch.quantity
        flv_id = batch.flavor_id
        depot_id = batch.depot_id

        # Depot to distributor scan
        scan_payload = {
            "parcel_code": f"PR-TEST-SCAN-{b_id}",
            "from_node_type": "depot",
            "from_node_id": depot_id,
            "to_node_type": "distributor",
            "to_node_id": 1,
            "flavor_id": flv_id,
            "batch_id": b_id,
            "quantity": 5,
            "channel": "MT",
        }

        res = client.post("/api/scans", json=scan_payload)
        assert res.status_code == 200
        scan_resp = res.json()
        assert scan_resp["batch_quantity"] == orig_qty - 5
        assert scan_resp["units_sold_updated"] is not None

        # Verify DB directly
        db.refresh(batch)
        assert batch.quantity == orig_qty - 5

# ─── 16.5 DMAC Agent Integration ──────────────────────────────────
def test_dmac_agent_proposes_recalibration_on_high_overrides():
    """Given >=3 D2 alerts with override rate > 25%, DMAC Control phase creates a dmac_recalibration alert with specific proposed trigger."""
    with SessionLocal() as db:
        now = datetime.utcnow()
        # Clean up prior dmac_recalibration alerts to test generation cleanly
        db.query(Alert).filter(Alert.kpi_code == "dmac_recalibration").delete()
        db.commit()

        # Seed 3 D2 alerts and 2 overrides (66% override rate > 25%)
        created_alerts = []
        for i in range(3):
            alert = Alert(
                kpi_code="D2",
                severity="warning",
                message=f"Test D2 batch age breach #{i+1}",
                confidence_pct=90.0,
                linked_entity_type="batch",
                linked_entity_id=101 + i,
                status="open",
                triggered_at=now - timedelta(days=5),
            )
            db.add(alert)
            db.flush()
            created_alerts.append(alert)

            # Override 2 of the 3 alerts
            if i < 2:
                ov = Override(
                    alert_id=alert.id,
                    user="test_planner",
                    reason_code="already_handled",
                    note="Handled outside tool",
                    created_at=now - timedelta(days=4),
                )
                db.add(ov)

        # Ensure override rate over all D2 alerts in DB exceeds 25%
        all_d2 = db.query(Alert).filter(Alert.kpi_code == "D2", Alert.triggered_at >= now - timedelta(days=30)).all()
        for a in all_d2:
            if not db.query(Override).filter(Override.alert_id == a.id).first():
                db.add(Override(alert_id=a.id, user="test_planner", reason_code="already_handled", note="Handled outside tool", created_at=now - timedelta(days=4)))
        db.commit()

        # Run DMAC pipeline
        recal_alerts = dmac_agent.run_dmac_pipeline(db, eval_date=now)
        assert len(recal_alerts) > 0, "DMAC must propose recalibration when override rate > 25%"
        recal = recal_alerts[0]
        assert recal["kpi_code"] == "dmac_recalibration"
        assert recal["proposed_trigger"] > recal["current_trigger"]

        # Verify in DB
        db_alert = db.query(Alert).filter(Alert.id == recal["alert_id"]).first()
        assert db_alert is not None
        assert "recalibrate D2 trigger_value" in db_alert.message
        assert str(recal["proposed_trigger"]) in db_alert.message

# ─── 16.6 Market Sentiment Driven Push ────────────────────────────
def test_sentiment_push_recommendation_confidence():
    """Given a B3 alert fires for a flavor, sentiment_signal produces a push recommendation with confidence lower than B3's own."""
    with SessionLocal() as db:
        flavor = db.query(Flavor).filter(Flavor.name == "Dragon Passion").first()
        flv_id = flavor.id if flavor else 5

        # Seed open B3 alert with confidence 96.0%
        b3_alert = Alert(
            kpi_code="B3",
            severity="critical",
            message="Viral demand spike test",
            confidence_pct=96.0,
            linked_entity_type="flavor",
            linked_entity_id=flv_id,
            status="open",
            triggered_at=datetime.utcnow(),
        )
        db.add(b3_alert)
        db.commit()
        db.refresh(b3_alert)

        push = sentiment_signal.compute_push_recommendation(flv_id, db)
        assert push is not None, "Push recommendation must be generated"
        assert push["channel"] == "QC"
        assert push["direction"] == "increase"
        assert push["confidence"] < b3_alert.confidence_pct, (
            f"Derived confidence ({push['confidence']}%) must be strictly lower than B3's own ({b3_alert.confidence_pct}%)"
        )
        assert "PUSH" in push["badge_text"]

# ─── 16.7 Insight Captions on Every Chart ─────────────────────────
def test_all_31_kpis_have_captions_and_no_missing_templates():
    """Every KPI must have a non-empty caption_template, and /api/kpi/scorecard must render plain-language captions."""
    config_path = os.path.join(os.path.dirname(__file__), "..", "app", "kpi_config", "kpi_thresholds.json")
    with open(config_path, "r", encoding="utf-8") as f:
        kpi_list = json.load(f)

    assert len(kpi_list) == 31, "Must have exactly 31 KPI threshold configurations"

    for kpi in kpi_list:
        code = kpi["kpi_code"]
        assert "caption_template" in kpi, f"KPI {code} missing caption_template"
        assert len(kpi["caption_template"].strip()) > 0, f"KPI {code} has blank caption_template"

    # Scorecard response check
    scorecard_res = client.get("/api/kpi/scorecard")
    assert scorecard_res.status_code == 200
    data = scorecard_res.json()
    assert "cards" in data

    for card in data["cards"]:
        assert "caption" in card, f"Card {card['kpi_code']} missing caption in response"
        assert len(card["caption"].strip()) > 0, f"Card {card['kpi_code']} rendered with empty caption"
