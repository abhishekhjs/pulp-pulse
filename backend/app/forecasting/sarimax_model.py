import os
import json
from datetime import date, timedelta
from typing import Dict, Any, Optional, Tuple, List
import pandas as pd
import numpy as np
from statsmodels.tsa.statespace.sarimax import SARIMAX, SARIMAXResultsWrapper
from sqlalchemy.orm import Session
from backend.app.models.db import ChannelSale, Flavor, SessionLocal
from backend.app.forecasting import exog_builder

PARAMS_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "forecast_config", "flavor_sarimax_params.json")

def get_flavor_params(flavor_name: str) -> Tuple[Tuple[int, int, int], Tuple[int, int, int, int]]:
    """Loads flavor-specific (p, d, q) and (P, D, Q, s) SARIMAX parameters."""
    if os.path.exists(PARAMS_CONFIG_PATH):
        try:
            with open(PARAMS_CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                flavor_map = data.get("flavor_params", {})
                if flavor_name in flavor_map:
                    order = tuple(flavor_map[flavor_name]["order"])
                    s_order = tuple(flavor_map[flavor_name]["seasonal_order"])
                    return order, s_order
                default_cfg = data.get("default", {})
                return tuple(default_cfg.get("order", [1, 1, 1])), tuple(default_cfg.get("seasonal_order", [1, 0, 1, 7]))
        except Exception as e:
            print(f"Warning loading SARIMAX flavor params: {e}")
    return (1, 1, 1), (1, 0, 1, 7)

def fit_sarimax(
    flavor_id: int,
    channel: str,
    history_df: pd.DataFrame,
    exog_df: Optional[pd.DataFrame] = None,
    order: Optional[Tuple[int, int, int]] = None,
    seasonal_order: Optional[Tuple[int, int, int, int]] = None,
    flavor_name: str = "",
) -> SARIMAXResultsWrapper:
    """
    Fits SARIMAX on historical sales with configurable per-flavor orders and exogenous regressors.
    """
    if order is None or seasonal_order is None:
        cfg_order, cfg_s_order = get_flavor_params(flavor_name)
        order = order or cfg_order
        seasonal_order = seasonal_order or cfg_s_order

    y = history_df["units_sold"].astype(float)

    # Ensure exog matches length and has variance
    exog_fit = None
    if exog_df is not None and not exog_df.empty:
        exog_fit = exog_df.loc[history_df.index]

    model = SARIMAX(
        endog=y,
        exog=exog_fit,
        order=order,
        seasonal_order=seasonal_order,
        enforce_stationarity=False,
        enforce_invertibility=False,
    )
    results = model.fit(disp=False, maxiter=80)
    return results

def forecast(
    flavor_id: int,
    channel: str,
    horizon_days: int = 14,
    db: Optional[Session] = None,
    cutoff: Optional[str] = None,
    history_window_days: int = 21,
) -> Dict[str, Any]:
    """
    Calls statistical SARIMAX engine to produce numeric 14-day forecast with confidence intervals.
    - Historical actuals: drawn directly from the database up to the last available record (or cutoff).
    - Future predictions: calculated with SARIMAX strictly for future dates following the last database date.
    """
    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True

    try:
        flavor = db.query(Flavor).filter(Flavor.id == flavor_id).first()
        flavor_name = flavor.name if flavor else f"Flavor_{flavor_id}"

        # Fetch sales history ordered by date
        query = db.query(ChannelSale).filter(ChannelSale.flavor_id == flavor_id, ChannelSale.channel == channel)
        if cutoff:
            cutoff_date = date.fromisoformat(cutoff) if isinstance(cutoff, str) else cutoff
            query = query.filter(ChannelSale.date <= cutoff_date)

        sales_records = query.order_by(ChannelSale.date.asc()).all()

        if not sales_records or len(sales_records) < 14:
            # Fallback if insufficient history
            today = date.today()
            dates = [(today + timedelta(days=i + 1)).isoformat() for i in range(horizon_days)]
            base_val = int(80 * (flavor.summer_share_pct if flavor else 0.2) * 0.3)
            return {
                "flavor_id": flavor_id,
                "flavor_name": flavor_name,
                "channel": channel,
                "dates": dates,
                "point_forecast": [base_val] * horizon_days,
                "ci_lower": [int(base_val * 0.85)] * horizon_days,
                "ci_upper": [int(base_val * 1.15)] * horizon_days,
                "residual_std": float(base_val * 0.1),
                "model_summary": "Heuristic fallback (insufficient history)",
                "last_historical_date": today.isoformat(),
                "history_points": [],
                "forecast_points": [],
                "combined_timeline": [],
                "summary_stats": {
                    "historical_14d_total": base_val * 14,
                    "historical_14d_avg": base_val,
                    "forecast_14d_total": base_val * horizon_days,
                    "forecast_14d_avg": base_val,
                    "growth_rate_pct": 0.0,
                },
            }

        # Build history DataFrame
        hist_dates = [s.date for s in sales_records]
        hist_df = pd.DataFrame(
            {"units_sold": [s.units_sold for s in sales_records]},
            index=pd.to_datetime(hist_dates),
        )
        hist_df.index.freq = pd.infer_freq(hist_df.index) or "D"

        last_date = hist_dates[-1]
        future_dates = [last_date + timedelta(days=i + 1) for i in range(horizon_days)]

        # Build exogenous regressors
        all_dates = hist_dates + future_dates
        full_exog = exog_builder.build(flavor_id, channel, all_dates, db=db)
        hist_exog = full_exog.loc[pd.to_datetime(hist_dates)]
        future_exog = full_exog.loc[pd.to_datetime(future_dates)]

        # Fit model
        results = fit_sarimax(
            flavor_id=flavor_id,
            channel=channel,
            history_df=hist_df,
            exog_df=hist_exog,
            flavor_name=flavor_name,
        )

        # Generate 14-day forecast with confidence intervals
        forecast_res = results.get_forecast(steps=horizon_days, exog=future_exog)
        predicted_mean = forecast_res.predicted_mean.values
        conf_int = forecast_res.conf_int(alpha=0.05).values  # 95% CI

        # Residual std for downstream Monte Carlo simulation
        residuals = results.resid.dropna()
        residual_std = float(residuals.std()) if len(residuals) > 0 else 5.0
        if np.isnan(residual_std) or residual_std <= 0:
            residual_std = max(1.0, float(np.mean(predicted_mean) * 0.08))

        point_forecast = [max(0, int(round(val))) for val in predicted_mean]
        ci_lower = [max(0, int(round(ci[0]))) for ci in conf_int]
        ci_upper = [max(point_forecast[i], int(round(ci[1]))) for i, ci in enumerate(conf_int)]

        # Slice recent historical points for dashboard display (e.g., last 21 days up to last_date)
        recent_history = sales_records[-history_window_days:] if len(sales_records) >= history_window_days else sales_records
        history_points = [
            {
                "date": s.date.isoformat(),
                "actual": int(s.units_sold),
                "point_forecast": None,
                "ci_lower": None,
                "ci_upper": None,
                "is_future": False,
            }
            for s in recent_history
        ]

        forecast_points = [
            {
                "date": future_dates[i].isoformat(),
                "actual": None,
                "point_forecast": point_forecast[i],
                "ci_lower": ci_lower[i],
                "ci_upper": ci_upper[i],
                "is_future": True,
            }
            for i in range(horizon_days)
        ]

        # In combined timeline, connect the historical actual to the forecast line at last_date
        combined_timeline = []
        for i, hp in enumerate(history_points):
            entry = dict(hp)
            if i == len(history_points) - 1:
                # Bridge point: anchor the forecast and CI start to the actual value at last_historical_date
                entry["point_forecast"] = hp["actual"]
                entry["ci_lower"] = hp["actual"]
                entry["ci_upper"] = hp["actual"]
            combined_timeline.append(entry)

        combined_timeline.extend(forecast_points)

        # Summary statistics comparing historical 14d against forecasted 14d
        hist_14_sales = sales_records[-14:] if len(sales_records) >= 14 else sales_records
        hist_14_total = sum(s.units_sold for s in hist_14_sales)
        hist_14_avg = round(hist_14_total / max(len(hist_14_sales), 1), 1)

        fcst_14_total = sum(point_forecast)
        fcst_14_avg = round(fcst_14_total / max(horizon_days, 1), 1)

        growth_rate_pct = round(((fcst_14_total - hist_14_total) / hist_14_total) * 100, 1) if hist_14_total > 0 else 0.0

        summary_stats = {
            "historical_14d_total": hist_14_total,
            "historical_14d_avg": hist_14_avg,
            "forecast_14d_total": fcst_14_total,
            "forecast_14d_avg": fcst_14_avg,
            "growth_rate_pct": growth_rate_pct,
        }

        return {
            "flavor_id": flavor_id,
            "flavor_name": flavor_name,
            "channel": channel,
            "dates": [d.isoformat() for d in future_dates],
            "point_forecast": point_forecast,
            "ci_lower": ci_lower,
            "ci_upper": ci_upper,
            "residual_std": residual_std,
            "model_summary": str(results.summary()),
            "last_historical_date": last_date.isoformat(),
            "history_points": history_points,
            "forecast_points": forecast_points,
            "combined_timeline": combined_timeline,
            "summary_stats": summary_stats,
        }

    finally:
        if own_session:
            db.close()
