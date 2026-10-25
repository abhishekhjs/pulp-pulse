import os
import json
from datetime import date, timedelta, datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.models.db import (
    Depot,
    Flavor,
    Batch,
    DepotDistributionDemand,
    SessionLocal,
)

def get_depot_distribution_segments(depot_id: int, db: Session) -> List[Dict[str, Any]]:
    """
    Returns unique downstream segments and distributors supplied by this depot.
    """
    records = (
        db.query(
            DepotDistributionDemand.segment,
            DepotDistributionDemand.distributor_name,
        )
        .filter(DepotDistributionDemand.depot_id == depot_id)
        .distinct()
        .all()
    )
    return [{"segment": r[0], "distributor_name": r[1]} for r in records]

def forecast_depot_flavor(
    depot_id: int,
    flavor_id: int,
    horizon_days: int = 14,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """
    Collects historical distribution demand data for a flavor at a depot across all downstream segments,
    and calculates statistical demand forecast with confidence intervals and inventory cover analysis.
    """
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        depot = db.query(Depot).filter(Depot.id == depot_id).first()
        flavor = db.query(Flavor).filter(Flavor.id == flavor_id).first()
        if not depot or not flavor:
            raise ValueError(f"Depot {depot_id} or Flavor {flavor_id} not found")

        # 1. Fetch historical demand
        demand_rows = (
            db.query(DepotDistributionDemand)
            .filter(
                DepotDistributionDemand.depot_id == depot_id,
                DepotDistributionDemand.flavor_id == flavor_id,
            )
            .order_by(DepotDistributionDemand.date.asc())
            .all()
        )

        # Aggregate daily total
        daily_totals: Dict[date, int] = {}
        segment_totals: Dict[str, Dict[str, Any]] = {}

        for row in demand_rows:
            d = row.date
            daily_totals[d] = daily_totals.get(d, 0) + row.units_demanded
            seg = row.segment
            if seg not in segment_totals:
                segment_totals[seg] = {
                    "segment": seg,
                    "distributor_name": row.distributor_name,
                    "total_units": 0,
                    "count": 0,
                }
            segment_totals[seg]["total_units"] += row.units_demanded
            segment_totals[seg]["count"] += 1

        sorted_dates = sorted(daily_totals.keys())
        hist_dates_str = [d.isoformat() for d in sorted_dates[-21:]]
        hist_units = [daily_totals[d] for d in sorted_dates[-21:]]

        # Calculate recent velocity and seasonality
        recent_days = sorted_dates[-14:] if len(sorted_dates) >= 14 else sorted_dates
        recent_demands = [daily_totals[d] for d in recent_days]
        base_daily_avg = sum(recent_demands) / max(len(recent_demands), 1)

        # 3-day recent velocity check for sudden surges
        last_3_days = sorted_dates[-3:] if len(sorted_dates) >= 3 else sorted_dates
        avg_3d = sum(daily_totals[d] for d in last_3_days) / max(len(last_3_days), 1)
        velocity_ratio = avg_3d / max(base_daily_avg, 1.0)

        # Calculate day of week seasonality multipliers
        dow_totals: Dict[int, List[int]] = {i: [] for i in range(7)}
        for d, u in daily_totals.items():
            dow_totals[d.weekday()].append(u)
        dow_mults = {}
        for dow, vals in dow_totals.items():
            avg_dow = sum(vals) / max(len(vals), 1)
            dow_mults[dow] = avg_dow / max(base_daily_avg, 1.0)

        # 2. Project future horizon
        last_date = sorted_dates[-1] if sorted_dates else date.today()
        forecast_dates = []
        p10 = []
        p50 = []
        p90 = []

        total_projected_units = 0
        for i in range(1, horizon_days + 1):
            f_date = last_date + timedelta(days=i)
            forecast_dates.append(f_date.isoformat())
            dow = f_date.weekday()
            dow_factor = dow_mults.get(dow, 1.0)

            # Trend momentum (if velocity is surging, dampen slightly over 14 days)
            surge_decay = max(1.0, 1.0 + (velocity_ratio - 1.0) * (0.85 ** i))
            f_point = max(5, int(base_daily_avg * dow_factor * surge_decay))
            total_projected_units += f_point

            p50.append(f_point)
            p10.append(max(2, int(f_point * 0.82)))
            p90.append(int(f_point * 1.25))

        daily_run_rate = round(total_projected_units / horizon_days, 1)

        # 3. Segments breakdown
        segments_output = []
        grand_total_seg = sum(s["total_units"] for s in segment_totals.values()) or 1
        for seg, info in segment_totals.items():
            share = round((info["total_units"] / grand_total_seg) * 100, 1)
            daily_seg_avg = round(info["total_units"] / max(info["count"], 1), 1)
            f_7d = int(daily_seg_avg * 7 * (share / 100.0) * 4.0)
            f_14d = int(daily_seg_avg * 14 * (share / 100.0) * 4.0)
            segments_output.append({
                "segment": seg,
                "distributor_name": info["distributor_name"],
                "historical_daily_avg": daily_seg_avg,
                "forecast_7d": max(10, f_7d),
                "forecast_14d": max(20, f_14d),
                "share_pct": share,
            })

        # 4. Inventory stock and Days of Cover
        batches = (
            db.query(Batch)
            .filter(
                Batch.depot_id == depot_id,
                Batch.flavor_id == flavor_id,
                Batch.status.in_(["fresh", "at_risk"]),
            )
            .all()
        )
        on_hand_stock = sum(b.quantity for b in batches)
        max_batch_age = max((b.age_days for b in batches), default=0)

        days_of_cover = round(on_hand_stock / max(daily_run_rate, 0.5), 1)

        # Classification
        if days_of_cover < 5.5 or (velocity_ratio >= 1.28 and days_of_cover < 8.0):
            status = "surge_deficit"
        elif days_of_cover > 18.0 or (max_batch_age >= 18 and days_of_cover >= 14.0):
            status = "surplus_stagnant"
        else:
            status = "healthy"

        return {
            "depot_id": depot.id,
            "depot_name": depot.name,
            "region": depot.region,
            "flavor_id": flavor.id,
            "flavor_name": flavor.name,
            "on_hand_stock": on_hand_stock,
            "daily_run_rate": daily_run_rate,
            "days_of_cover": days_of_cover,
            "status": status,
            "velocity_ratio": round(velocity_ratio, 2),
            "max_batch_age": max_batch_age,
            "historical_dates": hist_dates_str,
            "historical_units": hist_units,
            "forecast_dates": forecast_dates,
            "forecast_p10": p10,
            "forecast_p50": p50,
            "forecast_p90": p90,
            "segments": segments_output,
        }
    finally:
        if close_db:
            db.close()

def get_network_matrix(db: Session) -> Dict[str, Any]:
    """
    Returns full network matrix of all 9 depots and 5 flavors with forecast,
    cover days, and surplus/deficit statuses.
    """
    depots = db.query(Depot).all()
    flavors = db.query(Flavor).all()

    matrix = []
    deficit_count = 0
    surplus_count = 0
    healthy_count = 0

    for d in depots:
        depot_entry = {
            "depot_id": d.id,
            "depot_name": d.name,
            "region": d.region,
            "flavors": [],
            "total_stock": 0,
            "total_forecast_14d": 0,
        }

        for f in flavors:
            f_data = forecast_depot_flavor(d.id, f.id, horizon_days=14, db=db)
            depot_entry["flavors"].append({
                "flavor_id": f.id,
                "flavor_name": f.name,
                "stock": f_data["on_hand_stock"],
                "daily_run_rate": f_data["daily_run_rate"],
                "days_of_cover": f_data["days_of_cover"],
                "status": f_data["status"],
                "velocity_ratio": f_data["velocity_ratio"],
                "max_batch_age": f_data["max_batch_age"],
            })
            depot_entry["total_stock"] += f_data["on_hand_stock"]
            depot_entry["total_forecast_14d"] += sum(f_data["forecast_p50"])

            if f_data["status"] == "surge_deficit":
                deficit_count += 1
            elif f_data["status"] == "surplus_stagnant":
                surplus_count += 1
            else:
                healthy_count += 1

        matrix.append(depot_entry)

    return {
        "depots": matrix,
        "summary": {
            "total_depots": len(depots),
            "total_flavor_depot_nodes": len(depots) * len(flavors),
            "deficit_count": deficit_count,
            "surplus_count": surplus_count,
            "healthy_count": healthy_count,
        },
    }
