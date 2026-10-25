from datetime import date, timedelta
from typing import Dict, Any, Optional, List
import numpy as np
from sqlalchemy.orm import Session
from backend.app.models.db import Flavor, PulpInventory, Batch, SessionLocal
from backend.app.forecasting import sarimax_model

def simulate(
    flavor_id: int,
    channel: str = "QC",
    n_runs: int = 1000,
    horizon_days: int = 14,
    seed: Optional[int] = 42,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """
    Simulates n_runs demand paths over horizon_days by sampling from the SARIMAX
    residual distribution. Computes deterministic P10, P50, P90 percentile bands.
    """
    forecast_output = sarimax_model.forecast(flavor_id, channel, horizon_days=horizon_days, db=db)
    base_points = np.array(forecast_output["point_forecast"], dtype=float)
    residual_std = float(forecast_output.get("residual_std", 3.0))

    rng = np.random.RandomState(seed) if seed is not None else np.random.RandomState()

    # Shape: (n_runs, horizon_days)
    noise = rng.normal(loc=0.0, scale=residual_std, size=(n_runs, horizon_days))
    # Demand cannot be negative
    sim_paths = np.maximum(0.0, base_points + noise)

    p10 = np.percentile(sim_paths, 10, axis=0)
    p50 = np.percentile(sim_paths, 50, axis=0)
    p90 = np.percentile(sim_paths, 90, axis=0)

    return {
        "flavor_id": flavor_id,
        "flavor_name": forecast_output.get("flavor_name", ""),
        "channel": channel,
        "n_runs": n_runs,
        "horizon_days": horizon_days,
        "seed": seed,
        "dates": forecast_output["dates"],
        "p10": [int(round(x)) for x in p10],
        "p50": [int(round(x)) for x in p50],
        "p90": [int(round(x)) for x in p90],
        "sim_paths": sim_paths,
    }

def reverse_engineer_buffer(
    flavor_id: int,
    target_service_level: float = 0.95,
    sim_paths: Optional[np.ndarray] = None,
    channel: str = "QC",
    horizon_days: int = 14,
    seed: Optional[int] = 42,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """
    Simulates demand against current C3 (pulp) and D1 (finished goods) buffer assumptions
    and computes the minimum buffer clearing the target service level.
    """
    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True

    try:
        flavor = db.query(Flavor).filter(Flavor.id == flavor_id).first()
        flavor_name = flavor.name if flavor else f"Flavor_{flavor_id}"

        if sim_paths is None:
            sim_res = simulate(flavor_id, channel=channel, n_runs=1000, horizon_days=horizon_days, seed=seed, db=db)
            sim_paths = sim_res["sim_paths"]

        # Cumulative demand over the 14-day horizon per run
        cumulative_demand = np.sum(sim_paths, axis=1)

        # Baseline buffer values from case:
        # C3 Passionfruit pulp buffer was 14 days; D1 depot cover was 19.5 days
        pulp_inv = db.query(PulpInventory).filter(PulpInventory.ingredient.like("%Passionfruit%")).first()
        current_c3_cover = float(pulp_inv.cover_days) if pulp_inv else 14.0

        daily_burn_rate = float(np.mean(sim_paths)) if np.mean(sim_paths) > 0 else 10.0
        current_buffer_bottles = current_c3_cover * daily_burn_rate

        # Percentile required to clear target service level (e.g. 95th percentile)
        required_bottles = float(np.percentile(cumulative_demand, target_service_level * 100))
        recommended_buffer_days = round(required_bottles / daily_burn_rate, 1)

        # Stockout probability with current buffer
        stockouts = np.sum(cumulative_demand > current_buffer_bottles)
        stockout_risk_pct = round((stockouts / len(cumulative_demand)) * 100, 1)

        return {
            "flavor_id": flavor_id,
            "flavor_name": flavor_name,
            "target_service_level": target_service_level,
            "current_buffer_days": current_c3_cover,
            "current_buffer_bottles": int(round(current_buffer_bottles)),
            "recommended_buffer_days": recommended_buffer_days,
            "recommended_buffer_bottles": int(round(required_bottles)),
            "stockout_risk_current_pct": stockout_risk_pct,
            "horizon_days": horizon_days,
        }

    finally:
        if own_session:
            db.close()
