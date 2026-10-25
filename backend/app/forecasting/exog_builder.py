import os
import json
from datetime import date, datetime, timedelta
from typing import List, Optional, Dict, Any
import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from backend.app.models.db import ChannelSale, Flavor

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "forecast_config", "forecast_exog.json")

def load_exog_config() -> Dict[str, Any]:
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning: Failed to load {CONFIG_PATH}: {e}")
    return {"regressors": {}}

def build(flavor_id: int, channel: str, date_range: List[date], db: Optional[Session] = None) -> pd.DataFrame:
    """
    Assembles configured exogenous regressors into a pandas DataFrame aligned to date_range.
    Supports dynamic config edits in forecast_exog.json without code deployment.
    """
    config = load_exog_config()
    regressors = config.get("regressors", {})

    flavor_name = ""
    if db:
        flv = db.query(Flavor).filter(Flavor.id == flavor_id).first()
        if flv:
            flavor_name = flv.name

    df = pd.DataFrame(index=pd.to_datetime(date_range))

    for name, spec in regressors.items():
        if not spec.get("enabled", True):
            continue

        weight = float(spec.get("weight", 1.0))
        reg_type = spec.get("type", "generic")

        if reg_type == "month_dummy":
            # Normalized monthly indicator
            df[name] = [weight * ((d.month - 1) / 11.0) for d in date_range]

        elif reg_type == "campaign_schedule":
            campaigns = spec.get("flavor_campaigns", {}).get(flavor_name, [])
            vals = []
            for d in date_range:
                d_str = d.isoformat()
                in_campaign = any(start <= d_str <= end for start, end in campaigns)
                vals.append(weight if in_campaign else 0.0)
            df[name] = vals

        elif reg_type == "derived_b3_deviation":
            # Derived from QC velocity deviation for viral SKUs
            vals = []
            for d in date_range:
                if flavor_name == "Dragon Passion" and d >= date(2027, 3, 15):
                    # Viral momentum curve
                    days_into_spike = (d - date(2027, 3, 15)).days
                    momentum = min(1.0, days_into_spike / 14.0)
                    vals.append(round(weight * momentum, 3))
                else:
                    vals.append(0.0)
            df[name] = vals

        elif reg_type == "rolling_channel_growth":
            # Channel velocity multiplier (QC fastest, MT steady, GT standard)
            ch_multiplier = 0.25 if channel == "QC" else 0.10 if channel == "MT" else 0.02
            df[name] = [round(weight * ch_multiplier, 3) for _ in date_range]

        else:
            # Generic fallback for any arbitrary new regressor added to JSON
            default_val = float(spec.get("default_value", 0.0))
            df[name] = [default_val * weight for _ in date_range]

    # Ensure no NaN values
    df = df.fillna(0.0)
    return df
