from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional

# Cooperative Area Geolocation & Corridor Profile
COOPERATIVE_METADATA = {
    "name": "Himalayan Orchards Cooperative",
    "location": "Joshimath-Chamoli Belt, Uttarakhand",
    "primary_highway": "NH-58 / NH-7 Hill Mountain Corridor",
    "elevation_m": 1890,
    "primary_railhead_bypass": "Rishikesh / Haridwar Transshipment Hub (Foothills Terminal)",
    "historical_may_closure_prob": 0.60,  # 60% probability (closed 3 of last 5 summers)
    "average_closure_duration_days": 21.0,  # 3 weeks
}

# In-memory live state for weather and landslide telemetry (seeded with realistic baseline)
_current_weather_state = {
    "scenario": "rain_warning",
    "timestamp": datetime.utcnow().isoformat() + "Z",
    "temperature_c": 19.4,
    "humidity_pct": 88,
    "weather_condition": "Heavy Pre-Monsoon Showers",
    "rainfall_24h_mm": 54.2,
    "rainfall_48h_mm": 96.8,
    "rainfall_72h_mm": 138.4,
    "soil_saturation_api_pct": 78.5,  # Antecedent Precipitation Index
    "landslide_hazard_score": 76.0,   # 0 to 100
    "landslide_hazard_level": "High",  # Low, Moderate, High, Severe
    "road_status": "CAUTION_DEBRIS",  # OPEN_CLEAR, CAUTION_DEBRIS, HIGH_LANDSLIDE_RISK, BLOCKED_LANDSLIDE
    "road_status_label": "Debris Risk & Single-Lane Movement",
    "road_passability_pct": 45,
    "active_roadblocks_count": 1,
    "roadblock_location": "NH-58 Km 42 (Between Srinagar & Devprayag)",
    "clearance_eta_hrs": 18.0,
    "railhead_bypass_active": True,
    "backup_supplier_activated": False,
}

# 7-day predictive weather and landslide forecast for cooperative area
FORECAST_7DAY = [
    {
        "day": "Day 1 (Today)",
        "date_offset": 0,
        "condition": "Heavy Showers",
        "rainfall_mm": 42.0,
        "temp_high_c": 21,
        "temp_low_c": 14,
        "landslide_risk_pct": 74,
        "risk_tier": "High",
        "highway_passability": "Restricted (Debris)",
        "imd_alert": "Orange",
    },
    {
        "day": "Day 2 (Tomorrow)",
        "date_offset": 1,
        "condition": "Intense Cloudburst Risk",
        "rainfall_mm": 68.0,
        "temp_high_c": 19,
        "temp_low_c": 13,
        "landslide_risk_pct": 88,
        "risk_tier": "Severe",
        "highway_passability": "High Landslide Threat",
        "imd_alert": "Red",
    },
    {
        "day": "Day 3",
        "date_offset": 2,
        "condition": "Continuous Rain",
        "rainfall_mm": 55.0,
        "temp_high_c": 18,
        "temp_low_c": 12,
        "landslide_risk_pct": 82,
        "risk_tier": "Severe",
        "highway_passability": "Closure Probable",
        "imd_alert": "Red",
    },
    {
        "day": "Day 4",
        "date_offset": 3,
        "condition": "Scattered Thunderstorms",
        "rainfall_mm": 28.0,
        "temp_high_c": 22,
        "temp_low_c": 15,
        "landslide_risk_pct": 58,
        "risk_tier": "Moderate",
        "highway_passability": "Clearing Operations",
        "imd_alert": "Yellow",
    },
    {
        "day": "Day 5",
        "date_offset": 4,
        "condition": "Light Drizzle",
        "rainfall_mm": 12.0,
        "temp_high_c": 24,
        "temp_low_c": 16,
        "landslide_risk_pct": 36,
        "risk_tier": "Moderate",
        "highway_passability": "Controlled Single Lane",
        "imd_alert": "Green",
    },
    {
        "day": "Day 6",
        "date_offset": 5,
        "condition": "Partly Cloudy",
        "rainfall_mm": 4.0,
        "temp_high_c": 25,
        "temp_low_c": 16,
        "landslide_risk_pct": 18,
        "risk_tier": "Low",
        "highway_passability": "Normal Two-Way",
        "imd_alert": "Green",
    },
    {
        "day": "Day 7",
        "date_offset": 6,
        "condition": "Clear Sunshine",
        "rainfall_mm": 0.0,
        "temp_high_c": 26,
        "temp_low_c": 17,
        "landslide_risk_pct": 10,
        "risk_tier": "Low",
        "highway_passability": "Full Normal Traffic",
        "imd_alert": "Green",
    },
]

def get_current_weather_and_hazard() -> Dict[str, Any]:
    """
    Returns the real-time weather and landslide hazard telemetry for the cooperative sourcing area.
    """
    return {
        "cooperative": COOPERATIVE_METADATA,
        "telemetry": _current_weather_state,
        "forecast_7day": FORECAST_7DAY,
        "mitigation_playbook": {
            "pulp_buffer_target_days": 35.0,
            "air_freight_cost_penalty_inr_cr": 2.56,
            "foothills_railhead_lead_time_days": 2.2,
            "backup_supplier": "Sahyadri Bio-Organics (Secondary qualified, 6-day lead time)",
            "action_recommendation": (
                "REROUTE & DISPATCH BUFFER: 48h rainfall (96.8mm) and Soil Saturation (78.5%) exceed critical safety thresholds. "
                "Do NOT wait for full highway blockage. Expedite scheduled dispatches to Rishikesh Foothills Railhead today, "
                "and place advance PO with secondary supplier Sahyadri Bio-Organics to protect 35-day plant pulp buffer."
                if _current_weather_state["landslide_hazard_score"] > 60
                else "MONITOR: Conditions currently stable. Maintain standard scheduled road dispatches."
            ),
        },
    }

def set_weather_scenario(scenario: str) -> Dict[str, Any]:
    """
    Simulates different weather scenarios in the cooperative area for testing and live demonstration.
    Scenarios:
      - 'clear': Dry spring weather, roads completely open, low hazard.
      - 'rain_warning': Approaching heavy rains, 48h rain > 90mm, debris risk, high hazard.
      - 'landslide_block': Active severe landslide, NH-58 blocked, 0 passability, 3-week closure threat.
      - 'post_monsoon_clear': Post-slide recovery, bypass operational.
    """
    global _current_weather_state
    now_iso = datetime.utcnow().isoformat() + "Z"

    if scenario == "clear":
        _current_weather_state = {
            "scenario": "clear",
            "timestamp": now_iso,
            "temperature_c": 24.5,
            "humidity_pct": 45,
            "weather_condition": "Clear & Sunny",
            "rainfall_24h_mm": 0.0,
            "rainfall_48h_mm": 2.1,
            "rainfall_72h_mm": 5.0,
            "soil_saturation_api_pct": 22.0,
            "landslide_hazard_score": 12.0,
            "landslide_hazard_level": "Low",
            "road_status": "OPEN_CLEAR",
            "road_status_label": "NH-58 Clear & Normal Flow",
            "road_passability_pct": 100,
            "active_roadblocks_count": 0,
            "roadblock_location": "None (All corridors operational)",
            "clearance_eta_hrs": 0.0,
            "railhead_bypass_active": False,
            "backup_supplier_activated": False,
        }
    elif scenario == "landslide_block":
        _current_weather_state = {
            "scenario": "landslide_block",
            "timestamp": now_iso,
            "temperature_c": 17.2,
            "humidity_pct": 95,
            "weather_condition": "Severe Cloudburst & Debris Flow",
            "rainfall_24h_mm": 118.0,
            "rainfall_48h_mm": 194.5,
            "rainfall_72h_mm": 260.0,
            "soil_saturation_api_pct": 96.0,
            "landslide_hazard_score": 94.0,
            "landslide_hazard_level": "Severe",
            "road_status": "BLOCKED_LANDSLIDE",
            "road_status_label": "CRITICAL: Major Highway Landslide at Km 42",
            "road_passability_pct": 0,
            "active_roadblocks_count": 3,
            "roadblock_location": "NH-58 Km 42 (Massive Mudslide & Rockfall)",
            "clearance_eta_hrs": 120.0,  # ~5 days initial clearance, 3-week full repair
            "railhead_bypass_active": True,
            "backup_supplier_activated": True,
        }
    elif scenario == "rain_warning":
        _current_weather_state = {
            "scenario": "rain_warning",
            "timestamp": now_iso,
            "temperature_c": 19.4,
            "humidity_pct": 88,
            "weather_condition": "Heavy Pre-Monsoon Showers",
            "rainfall_24h_mm": 54.2,
            "rainfall_48h_mm": 96.8,
            "rainfall_72h_mm": 138.4,
            "soil_saturation_api_pct": 78.5,
            "landslide_hazard_score": 76.0,
            "landslide_hazard_level": "High",
            "road_status": "CAUTION_DEBRIS",
            "road_status_label": "Debris Risk & Single-Lane Movement",
            "road_passability_pct": 45,
            "active_roadblocks_count": 1,
            "roadblock_location": "NH-58 Km 42 (Between Srinagar & Devprayag)",
            "clearance_eta_hrs": 18.0,
            "railhead_bypass_active": True,
            "backup_supplier_activated": False,
        }
    else:
        # Default fallback
        _current_weather_state["timestamp"] = now_iso

    return get_current_weather_and_hazard()
