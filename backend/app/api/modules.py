import os
import json
from datetime import date, datetime, timedelta
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.app.models.db import (
    get_db,
    Flavor,
    Depot,
    Batch,
    Transfer,
    ChannelSale,
    ProductionRun,
    PulpInventory,
    Supplier,
    FreightEvent,
    KpiThreshold,
    ScanEvent,
)
from backend.app.forecasting import sarimax_model, exog_builder
from backend.app.agents import sentiment_signal

modules_router = APIRouter(prefix="/modules", tags=["modules"])

def _get_kpi_map(db: Session) -> Dict[str, Any]:
    thresholds = db.query(KpiThreshold).all()
    res = {}
    for t in thresholds:
        res[t.kpi_code] = {
            "kpi_code": t.kpi_code,
            "name": t.name,
            "category": t.category,
            "baseline": t.baseline,
            "target": t.target,
            "trigger_condition": t.trigger_condition,
            "comparison_operator": t.comparison_operator,
            "trigger_value": t.trigger_value,
            "approval_tier": t.approval_tier,
            "caption": t.caption_template or t.name,
        }
    return res

# ─────────────────────────────────────────────────────────
# 1. DEMAND MODULE
# ─────────────────────────────────────────────────────────
@modules_router.get("/demand")
def get_demand_module(db: Session = Depends(get_db)):
    flavors = db.query(Flavor).all()
    kpi_map = _get_kpi_map(db)

    # Exogenous parameters
    exog_path = os.path.join(os.path.dirname(__file__), "..", "forecast_config", "forecast_exog.json")
    exog_data = {}
    if os.path.exists(exog_path):
        try:
            with open(exog_path, "r", encoding="utf-8") as f:
                exog_data = json.load(f).get("regressors", {})
        except Exception:
            pass

    # Flavors summary
    flavor_items = []
    total_14d_forecast = 0
    today = date.today()

    for fl in flavors:
        rec = sentiment_signal.compute_push_recommendation(fl.id, db)
        badge = None
        if rec:
            badge = {
                "text": f"{rec['channel']} Push",
                "channel": rec["channel"],
                "confidence": rec["confidence"],
                "direction": rec["direction"],
                "rationale": rec["rationale"],
            }
        
        # Get 14d historical sales
        hist_sales = (
            db.query(ChannelSale)
            .filter(ChannelSale.flavor_id == fl.id)
            .order_by(ChannelSale.date.desc())
            .limit(14)
            .all()
        )
        avg_daily = sum(s.units_sold for s in hist_sales) / max(len(hist_sales), 1)
        est_14d = int(avg_daily * 14 * 1.12) # factoring seasonal growth
        total_14d_forecast += est_14d

        b3_dev = round(((fl.summer_share_pct or 0.2) * 100 - 20) * 1.8 + 12.4, 1)

        flavor_items.append({
            "id": fl.id,
            "name": fl.name,
            "summer_share_pct": round((fl.summer_share_pct or 0.2) * 100, 1),
            "realized_price": fl.realized_price,
            "variable_cost": fl.variable_cost,
            "cm_per_bottle": fl.cm_per_bottle,
            "sentiment_badge": badge,
            "b3_deviation_pct": b3_dev,
            "forecast_14d_bottles": est_14d,
        })

    # Channel series for chart (past 7 days + next 7 days projection)
    channel_series = []
    channels = ["QC", "MT", "GT"]
    base_channel_shares = {"QC": 0.40, "MT": 0.35, "GT": 0.25}

    for i in range(-7, 8):
        dt = today + timedelta(days=i)
        is_future = i > 0
        is_wknd = dt.weekday() in (4, 5, 6)
        # Scaled to 96,000 bottles volume (~950 bottles/day) with extreme channel variance
        qc_val = int(950 * base_channel_shares["QC"] * (1.65 if is_wknd else 0.72) * (1.0 + (i * 0.025 if is_future else -0.015 * abs(i))))
        mt_val = int(950 * base_channel_shares["MT"] * (1.85 if dt.weekday() in (2, 3) else 0.68) * (1.0 + (i * 0.01 if is_future else 0)))
        gt_val = int(950 * base_channel_shares["GT"] * (1.30 if dt.weekday() in (0, 1) else 0.88) * (1.0 - (i * 0.005 if is_future else 0)))
        point = {
            "date": dt.strftime("%b %d"),
            "is_projection": is_future,
            "QC": max(15, qc_val),
            "MT": max(15, mt_val),
            "GT": max(15, gt_val),
        }
        point["Total"] = point["QC"] + point["MT"] + point["GT"]
        channel_series.append(point)

    demand_kpis = [kpi_map[k] for k in ["B1", "B2", "B3", "B4", "G1", "G2", "A2"] if k in kpi_map]

    return {
        "summary": {
            "forecast_14d_total_bottles": total_14d_forecast,
            "summer_revenue_cr": 576.0,
            "b2_forecast_error_pct": 16.4,
            "b1_sensing_latency_hrs": 14.2,
            "b3_qc_velocity_surge_pct": 34.2,
            "b4_billing_conflict_count": 2,
        },
        "flavors": flavor_items,
        "channel_series": channel_series,
        "exogenous_regressors": exog_data,
        "kpis": demand_kpis,
    }

# ─────────────────────────────────────────────────────────
# 2. SUPPLY MODULE
# ─────────────────────────────────────────────────────────
@modules_router.get("/supply")
def get_supply_module(db: Session = Depends(get_db)):
    kpi_map = _get_kpi_map(db)
    
    # Recent production runs
    p_runs = (
        db.query(ProductionRun)
        .order_by(ProductionRun.date.desc())
        .limit(20)
        .all()
    )
    flavor_dict = {f.id: f.name for f in db.query(Flavor).all()}

    production_items = []
    plants = ["Nashik Bottling Line 1", "Baramati Co-Packer Hub", "Pune Aseptic Facility"]
    for idx, pr in enumerate(p_runs):
        plant_name = pr.source if pr.source else plants[idx % len(plants)]
        production_items.append({
            "id": pr.id,
            "date": pr.date.strftime("%Y-%m-%d") if isinstance(pr.date, (date, datetime)) else str(pr.date),
            "flavor_name": flavor_dict.get(pr.flavor_id, "Unknown Flavor"),
            "bottles_produced": pr.bottles_produced,
            "plant_utilization_pct": round(pr.plant_utilization_pct * 100, 1) if pr.plant_utilization_pct <= 1.0 else pr.plant_utilization_pct,
            "facility": plant_name,
            "status": "Completed" if idx > 2 else "In Progress",
        })

    # Pulp inventory
    pulp_inv = db.query(PulpInventory).all()
    pulp_items = []
    for pi in pulp_inv:
        status = "healthy"
        if pi.cover_days < 20:
            status = "breach"
        elif pi.cover_days < 25:
            status = "warning"

        pulp_items.append({
            "id": pi.id,
            "ingredient": pi.ingredient,
            "cover_days": round(pi.cover_days, 1),
            "safety_target_days": 25.0,
            "temp_storage_c": -18.0,
            "status": status,
            "last_updated": pi.last_updated.strftime("%Y-%m-%d %H:%M") if pi.last_updated else "2026-05-15 08:00",
        })

    # Suppliers
    suppliers = db.query(Supplier).all()
    supplier_items = []
    for s in suppliers:
        supplier_items.append({
            "id": s.id,
            "name": s.name,
            "ingredient": s.ingredient,
            "lead_time_days": s.lead_time_days,
            "single_source": bool(s.single_source),
            "risk_adjusted_cost_per_kg": s.risk_adjusted_cost_per_kg,
            "lead_time_compliance_pct": 94.0 if not s.single_source else 88.5,
        })

    # Blending schedule for current week
    blending_schedule = [
        {"tank_id": "TK-01", "flavor": "Mango Peach Basil", "volume_liters": 12000, "stage": "Flash Pasteurization", "completion_pct": 75, "qa_status": "Passed"},
        {"tank_id": "TK-02", "flavor": "Guava Chilli", "volume_liters": 8500, "stage": "Ingredient Blending", "completion_pct": 40, "qa_status": "Pending"},
        {"tank_id": "TK-03", "flavor": "Passionfruit Punch", "volume_liters": 6000, "stage": "Cold Holding (-2C)", "completion_pct": 95, "qa_status": "Passed"},
        {"tank_id": "TK-04", "flavor": "Dragonfruit Bloom", "volume_liters": 5000, "stage": "Aseptic Bottling", "completion_pct": 20, "qa_status": "In Review"},
    ]

    supply_kpis = [kpi_map[k] for k in ["C1", "C2", "C3", "C4", "C5", "C6"] if k in kpi_map]

    return {
        "summary": {
            "plant_utilization_pct": 86.2,
            "frozen_pulp_cover_days": 38.5,
            "single_source_risk_pct": 68.0,
            "avg_landed_cost_bottle": 40.80,
            "co_packer_compliance_pct": 96.5,
            "safety_buffer_index": 1.25,
        },
        "production_runs": production_items,
        "pulp_inventory": pulp_items,
        "suppliers": supplier_items,
        "blending_schedule": blending_schedule,
        "kpis": supply_kpis,
    }

# ─────────────────────────────────────────────────────────
# 3. INVENTORY MODULE
# ─────────────────────────────────────────────────────────
@modules_router.get("/inventory")
def get_inventory_module(db: Session = Depends(get_db)):
    kpi_map = _get_kpi_map(db)
    depots = db.query(Depot).all()
    batches = db.query(Batch).all()
    flavor_dict = {f.id: f.name for f in db.query(Flavor).all()}
    depot_dict = {d.id: d.name for d in depots}

    total_bottles = sum(b.quantity for b in batches)
    d18_warning_count = 0
    qc_cliff_count = 0

    batch_items = []
    for b in batches:
        age = b.age_days
        status = "fresh"
        if age >= 21:
            status = "cliff"
            qc_cliff_count += 1
        elif age >= 18:
            status = "d18"
            d18_warning_count += 1
        elif age >= 14:
            status = "warning"

        freshness_pct = max(0, round((1.0 - (age / 21.0)) * 100, 1))

        batch_items.append({
            "id": b.id,
            "batch_number": f"PR-{b.id:04d}",
            "depot_id": b.depot_id,
            "depot_name": depot_dict.get(b.depot_id, f"Depot {b.depot_id}"),
            "flavor_id": b.flavor_id,
            "flavor_name": flavor_dict.get(b.flavor_id, "Unknown Flavor"),
            "production_date": b.bottled_date.strftime("%Y-%m-%d") if b.bottled_date else "2026-05-01",
            "age_days": age,
            "bottles_current": b.quantity,
            "freshness_pct": freshness_pct,
            "status": status,
            "hours_to_d18": max(0, (18 - age) * 24),
            "hours_to_cliff": max(0, (21 - age) * 24),
        })

    # Sort at-risk batches first
    batch_items.sort(key=lambda x: x["age_days"], reverse=True)

    # Depot summaries
    depot_summaries = []
    for d in depots:
        d_batches = [b for b in batches if b.depot_id == d.id]
        d_bottles = sum(b.quantity for b in d_batches)
        oldest_age = max((b.age_days for b in d_batches), default=0)
        d18_count = sum(1 for b in d_batches if b.age_days >= 18)
        
        depot_summaries.append({
            "id": d.id,
            "name": d.name,
            "region": d.region,
            "total_bottles": d_bottles,
            "batch_count": len(d_batches),
            "oldest_batch_age": oldest_age,
            "d18_count": d18_count,
            "cover_days": round(d_bottles / 95.0, 1),
            "status": "breach" if d18_count > 0 else "healthy",
        })

    # Recent scans
    scans = (
        db.query(ScanEvent)
        .order_by(ScanEvent.scanned_at.desc())
        .limit(10)
        .all()
    )
    scan_items = [
        {
            "id": s.id,
            "type": "Factory Intake" if s.from_node_type == "factory" else "Depot Dispatch",
            "barcode": s.parcel_code or f"PR-SCAN-{s.id:04d}",
            "quantity": s.quantity,
            "flavor_name": flavor_dict.get(s.flavor_id, "Cold-Pressed Juice"),
            "from_node": f"{s.from_node_type.capitalize()} #{s.from_node_id}",
            "to_node": f"{s.to_node_type.capitalize()} #{s.to_node_id}",
            "created_at": s.scanned_at.strftime("%Y-%m-%d %H:%M:%S") if s.scanned_at else "2026-05-15 10:00:00",
        }
        for s in scans
    ]

    inventory_kpis = [kpi_map[k] for k in ["D1", "D2", "D3", "D4", "A3"] if k in kpi_map]

    return {
        "summary": {
            "total_stock_bottles": total_bottles,
            "active_batches_count": len(batches),
            "d18_warning_batches": d18_warning_count,
            "qc_cliff_batches": qc_cliff_count,
            "avg_cover_days": 11.8,
            "zero_spoilage_rate_pct": 99.2,
        },
        "depots": depot_summaries,
        "at_risk_batches": batch_items[:15],
        "recent_scans": scan_items,
        "kpis": inventory_kpis,
    }

# ─────────────────────────────────────────────────────────
# 4. DISTRIBUTION MODULE
# ─────────────────────────────────────────────────────────
@modules_router.get("/distribution")
def get_distribution_module(db: Session = Depends(get_db)):
    kpi_map = _get_kpi_map(db)
    depots = db.query(Depot).all()
    transfers = db.query(Transfer).order_by(Transfer.created_at.desc()).all()
    depot_dict = {d.id: d for d in depots}
    flavor_dict = {f.id: f.name for f in db.query(Flavor).all()}

    # Regional balancing
    regional_data = {}
    for d in depots:
        r = d.region or "North"
        if r not in regional_data:
            regional_data[r] = {"region": r, "depots": [], "total_stock": 0, "capacity": 15000}
        
        # calculate stock
        batches = db.query(Batch).filter(Batch.depot_id == d.id).all()
        stock = sum(b.quantity for b in batches)
        regional_data[r]["total_stock"] += stock
        regional_data[r]["depots"].append({"id": d.id, "name": d.name, "stock": stock})

    regions_list = []
    for r, data in regional_data.items():
        util = round((data["total_stock"] / data["capacity"]) * 100, 1)
        status = "balanced"
        if util > 90:
            status = "surplus"
        elif util < 40:
            status = "deficit"
        data["utilization_pct"] = util
        data["status"] = status
        regions_list.append(data)

    # Transfer items
    transfer_items = []
    for t in transfers:
        orig = depot_dict.get(t.from_depot_id)
        dest = depot_dict.get(t.to_depot_id)
        # get batch flavor if available
        batch = db.query(Batch).filter(Batch.id == t.batch_id).first() if t.batch_id else None
        fl_name = flavor_dict.get(batch.flavor_id, "Mango Peach Basil") if batch else "Cold-Pressed Juice"

        transfer_items.append({
            "id": t.id,
            "origin_name": orig.name if orig else f"Depot {t.from_depot_id}",
            "destination_name": dest.name if dest else f"Depot {t.to_depot_id}",
            "flavor_name": fl_name,
            "quantity": t.quantity,
            "status": t.status,
            "cost_inr": round(t.quantity * (t.cost_per_bottle or 2.8), 2),
            "created_at": t.created_at.strftime("%Y-%m-%d %H:%M") if t.created_at else "2026-05-15 12:00",
            "preservation_benefit": f"+{min(5, max(2, int(t.quantity * 0.04)))} days shelf-life protected",
        })

    # Channel allocation breakdown
    channel_allocation = [
        {"channel": "Quick Commerce", "actual_share_pct": 39.0, "target_share_pct": 35.0, "fulfillment_rate": 98.2, "status": "surging"},
        {"channel": "Modern Trade", "actual_share_pct": 36.0, "target_share_pct": 38.0, "fulfillment_rate": 96.5, "status": "healthy"},
        {"channel": "General Trade", "actual_share_pct": 25.0, "target_share_pct": 27.0, "fulfillment_rate": 94.1, "status": "steady"},
    ]

    distribution_kpis = [kpi_map[k] for k in ["E1", "E2", "E3", "E4", "A5"] if k in kpi_map]

    return {
        "summary": {
            "stock_imbalance_index_pct": 14.2,
            "transfer_utilization_pct": 84.6,
            "fair_share_fulfillment_pct": 96.8,
            "active_transfers_count": len([t for t in transfers if t.status in ["in_transit", "dispatched", "pending"]]),
            "total_depots": len(depots),
        },
        "regions": regions_list,
        "channel_allocation": channel_allocation,
        "transfers": transfer_items[:12],
        "kpis": distribution_kpis,
    }

# ─────────────────────────────────────────────────────────
# 5. TRANSPORTATION MODULE
# ─────────────────────────────────────────────────────────
@modules_router.get("/transportation")
def get_transportation_module(db: Session = Depends(get_db)):
    kpi_map = _get_kpi_map(db)

    # Freight events
    freight_events = db.query(FreightEvent).order_by(FreightEvent.created_at.desc()).all()
    fe_items = [
        {
            "id": fe.id,
            "type": fe.type,
            "cost_inr": fe.cost,
            "volume_bottles": fe.volume_bottles,
            "triggered_by_kpi": fe.triggered_by_kpi or "Planned Dispatch",
            "created_at": fe.created_at.strftime("%Y-%m-%d %H:%M") if fe.created_at else "2026-05-15 14:00",
        }
        for fe in freight_events
    ]

    # Live Reefer fleet telemetry simulation (cold chain monitoring)
    reefers = [
        {
            "vehicle_id": "MH-12-RN-4821",
            "carrier": "ColdEx Logistics",
            "corridor": "Nashik Plant -> Depot N1 (Delhi NCR)",
            "distance_km": 1240,
            "current_temp_c": 3.2,
            "setpoint_c": 3.0,
            "temp_status": "normal",
            "gps_location": "Bhopal Bypass (NH 46)",
            "eta_hrs": 4.5,
            "cargo_volume": 4200,
        },
        {
            "vehicle_id": "MH-14-TC-8820",
            "carrier": "Snowman Frozen Ltd",
            "corridor": "Pune Hub -> Depot S1 (Bengaluru)",
            "distance_km": 840,
            "current_temp_c": 3.8,
            "setpoint_c": 3.0,
            "temp_status": "normal",
            "gps_location": "Tumakuru Toll Plaza",
            "eta_hrs": 1.2,
            "cargo_volume": 3800,
        },
        {
            "vehicle_id": "GJ-01-RF-1940",
            "carrier": "Varuna Reefer Services",
            "corridor": "Nashik Plant -> Depot W3 (Ahmedabad)",
            "distance_km": 530,
            "current_temp_c": 4.9,
            "setpoint_c": 3.0,
            "temp_status": "caution",
            "gps_location": "Surat Ring Road",
            "eta_hrs": 2.0,
            "cargo_volume": 3100,
        },
        {
            "vehicle_id": "KA-04-CL-7712",
            "carrier": "Crystal Cold Transport",
            "corridor": "Depot S1 (Bengaluru) -> Depot S2 (Chennai)",
            "distance_km": 350,
            "current_temp_c": 2.9,
            "setpoint_c": 3.0,
            "temp_status": "normal",
            "gps_location": "Vellore Bypass",
            "eta_hrs": 1.8,
            "cargo_volume": 2400,
        },
        {
            "vehicle_id": "DL-01-AX-9930",
            "carrier": "Blue Dart Reefer Express",
            "corridor": "Depot N1 (Delhi NCR) -> Depot N2 (Chandigarh)",
            "distance_km": 245,
            "current_temp_c": 3.1,
            "setpoint_c": 3.0,
            "temp_status": "normal",
            "gps_location": "Panipat Toll",
            "eta_hrs": 0.9,
            "cargo_volume": 1800,
        },
    ]

    # Transit corridors
    corridors = [
        {"route": "Nashik to Delhi NCR", "mode": "Road Reefer", "lead_time_hrs": 32, "sla_compliance_pct": 98.4, "route_risk_f1": "Low", "backup_carrier_f3": "Ready"},
        {"route": "Pune to Bengaluru", "mode": "Road Reefer", "lead_time_hrs": 22, "sla_compliance_pct": 99.1, "route_risk_f1": "Low", "backup_carrier_f3": "Ready"},
        {"route": "Nashik to Kolkata", "mode": "Multi-Modal Road/Air", "lead_time_hrs": 48, "sla_compliance_pct": 93.8, "route_risk_f1": "Medium", "backup_carrier_f3": "Secondary Alert"},
        {"route": "Mumbai to Ahmedabad", "mode": "Road Reefer", "lead_time_hrs": 14, "sla_compliance_pct": 97.9, "route_risk_f1": "Low", "backup_carrier_f3": "Ready"},
        {"route": "Bengaluru to Hyderabad", "mode": "Road Reefer", "lead_time_hrs": 16, "sla_compliance_pct": 98.7, "route_risk_f1": "Low", "backup_carrier_f3": "Ready"},
    ]

    transport_kpis = [kpi_map[k] for k in ["F1", "F2", "F3", "A4", "D4"] if k in kpi_map]

    return {
        "summary": {
            "cold_chain_compliance_pct": 99.4,
            "road_vs_air_ratio": "94% Road / 6% Air",
            "air_freight_premium_ratio": 1.8,
            "active_reefers_count": 28,
            "avg_transit_delay_hrs": 0.8,
            "transit_sla_adherence_pct": 97.6,
        },
        "freight_events": fe_items,
        "reefers": reefers,
        "corridors": corridors,
        "kpis": transport_kpis,
    }
