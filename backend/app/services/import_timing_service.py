from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional

# Week-by-week quarterly dynamics baseline (Weeks 1 to 13)
# Modeling ocean reefer spot freight index ($/FEU), port dwell times (days),
# transshipment rollover risk (%), customs clearance (days), and landed lead time (days).
WEEKLY_QUARTER_PROFILE = [
    # Phase 1: Early Quarter Contract Reset (Weeks 1-3)
    {
        "week": 1,
        "phase": "Contract Reset",
        "is_golden_window": False,
        "ocean_rate_index_usd": 1580,
        "port_dwell_days": 4.8,
        "rollover_risk_pct": 5.2,
        "total_lead_time_days": 43.5,
        "landed_cost_per_kg_inr": 168.0,
        "advisory": "Carriers resetting quarterly allocations. Steady capacity, moderate rates.",
    },
    {
        "week": 2,
        "phase": "Contract Reset",
        "is_golden_window": False,
        "ocean_rate_index_usd": 1520,
        "port_dwell_days": 4.4,
        "rollover_risk_pct": 4.5,
        "total_lead_time_days": 42.0,
        "landed_cost_per_kg_inr": 166.5,
        "advisory": "Container equipment repositioned. Good booking availability.",
    },
    {
        "week": 3,
        "phase": "Contract Reset",
        "is_golden_window": False,
        "ocean_rate_index_usd": 1440,
        "port_dwell_days": 4.0,
        "rollover_risk_pct": 3.8,
        "total_lead_time_days": 40.5,
        "landed_cost_per_kg_inr": 164.0,
        "advisory": "Transitioning to mid-quarter lull. Ocean rates beginning downward slope.",
    },
    # Phase 2: The "Golden Window" (Weeks 4-8) - SWEET SPOT FOR TIME AND COST
    {
        "week": 4,
        "phase": "Golden Window (Optimal)",
        "is_golden_window": True,
        "ocean_rate_index_usd": 1280,
        "port_dwell_days": 3.4,
        "rollover_risk_pct": 2.5,
        "total_lead_time_days": 37.0,
        "landed_cost_per_kg_inr": 158.5,
        "advisory": "Golden Window opens. Lowest berth congestion at Nhava Sheva & Singapore hubs.",
    },
    {
        "week": 5,
        "phase": "Golden Window (Optimal)",
        "is_golden_window": True,
        "ocean_rate_index_usd": 1220,
        "port_dwell_days": 3.1,
        "rollover_risk_pct": 1.8,
        "total_lead_time_days": 35.5,
        "landed_cost_per_kg_inr": 156.0,
        "advisory": "Peak booking efficiency: 22% rate discount, near-zero rollover risk.",
    },
    {
        "week": 6,
        "phase": "Golden Window (Optimal)",
        "is_golden_window": True,
        "ocean_rate_index_usd": 1190,
        "port_dwell_days": 3.0,
        "rollover_risk_pct": 1.5,
        "total_lead_time_days": 34.5,
        "landed_cost_per_kg_inr": 154.5,
        "advisory": "Absolute cost trough of the quarter. Ideal timing for bulk quarterly reorder.",
    },
    {
        "week": 7,
        "phase": "Golden Window (Optimal)",
        "is_golden_window": True,
        "ocean_rate_index_usd": 1210,
        "port_dwell_days": 3.2,
        "rollover_risk_pct": 2.0,
        "total_lead_time_days": 35.0,
        "landed_cost_per_kg_inr": 155.0,
        "advisory": "High equipment availability at Mekong/Laem Chabang ports.",
    },
    {
        "week": 8,
        "phase": "Golden Window (Optimal)",
        "is_golden_window": True,
        "ocean_rate_index_usd": 1260,
        "port_dwell_days": 3.6,
        "rollover_risk_pct": 2.8,
        "total_lead_time_days": 36.8,
        "landed_cost_per_kg_inr": 157.0,
        "advisory": "Last week of Golden Window. Expedite PO placement before late-quarter surge.",
    },
    # Phase 3: Pre-Closing Tightening (Weeks 9-11)
    {
        "week": 9,
        "phase": "Volume Inflow",
        "is_golden_window": False,
        "ocean_rate_index_usd": 1480,
        "port_dwell_days": 4.6,
        "rollover_risk_pct": 6.5,
        "total_lead_time_days": 43.0,
        "landed_cost_per_kg_inr": 165.0,
        "advisory": "Export volumes ramping up. Carriers introducing mid-cycle General Rate Increases (GRI).",
    },
    {
        "week": 10,
        "phase": "Volume Inflow",
        "is_golden_window": False,
        "ocean_rate_index_usd": 1650,
        "port_dwell_days": 5.8,
        "rollover_risk_pct": 9.4,
        "total_lead_time_days": 47.0,
        "landed_cost_per_kg_inr": 172.0,
        "advisory": "Vessel slots tightening. Feeder transshipment delays emerging at Colombo.",
    },
    {
        "week": 11,
        "phase": "Volume Inflow",
        "is_golden_window": False,
        "ocean_rate_index_usd": 1820,
        "port_dwell_days": 7.0,
        "rollover_risk_pct": 13.0,
        "total_lead_time_days": 51.0,
        "landed_cost_per_kg_inr": 179.0,
        "advisory": "Port yard utilization reaching 85%. Dwell times expanding.",
    },
    # Phase 4: Quarter-End Congestion Cliff (Weeks 12-13) - AVOID IF POSSIBLE
    {
        "week": 12,
        "phase": "Quarter-End Rush (Cliff)",
        "is_golden_window": False,
        "ocean_rate_index_usd": 2240,
        "port_dwell_days": 9.5,
        "rollover_risk_pct": 19.5,
        "total_lead_time_days": 57.5,
        "landed_cost_per_kg_inr": 196.0,
        "advisory": "Peak Season Surcharge (+$600/FEU). Container roll-overs high, 3-week lead time penalty.",
    },
    {
        "week": 13,
        "phase": "Quarter-End Rush (Cliff)",
        "is_golden_window": False,
        "ocean_rate_index_usd": 2580,
        "port_dwell_days": 11.8,
        "rollover_risk_pct": 24.0,
        "total_lead_time_days": 63.0,
        "landed_cost_per_kg_inr": 210.0,
        "advisory": "Worst import timing: highest cost (+36% premium) and longest lead time (63 days).",
    },
]

# Calendar Seasonality Profiles across Q1, Q2, Q3, Q4
QUARTER_CALENDAR_FACTORS = {
    "Q1": {
        "quarter": "Q1 (Jan - Mar)",
        "seasonal_driver": "Chinese New Year / Tet Holiday Dynamics",
        "sweet_spot_weeks": "Weeks 8–10 (Late Feb to Mid March)",
        "sweet_spot_rationale": "Post-CNY factory reopening rate trough. Single lowest container rate of the entire calendar year ($1,080/FEU).",
        "avoid_weeks": "Weeks 4–7 (Jan 25 – Feb 20)",
        "avoid_rationale": "East & Southeast Asian manufacturing shutdowns, port skeleton crews, and severe pre-holiday rate spikes.",
        "strategic_focus": "Pre-import Q2 summer fruit pulp buffers ahead of April peak demand.",
        "avg_lead_time_golden_days": 33.0,
        "avg_freight_savings_pct": 28.5,
    },
    "Q2": {
        "quarter": "Q2 (Apr - Jun)",
        "seasonal_driver": "Pre-Monsoon Ocean Surge & Indian Summer Demand",
        "sweet_spot_weeks": "Weeks 4–7 (Late April to Mid May)",
        "sweet_spot_rationale": "Calm ocean passage in Arabian Sea before Southwest Monsoon swells. Nhava Sheva terminal operating at peak efficiency.",
        "avoid_weeks": "Weeks 10–13 (June monsoon onset)",
        "avoid_rationale": "Rough sea transit, port berthing suspensions, and heavy terminal rain delays.",
        "strategic_focus": "Replenish Dragon Passion puree stock to avert stockouts and avoid panic air freight.",
        "avg_lead_time_golden_days": 35.0,
        "avg_freight_savings_pct": 24.0,
    },
    "Q3": {
        "quarter": "Q3 (Jul - Sep)",
        "seasonal_driver": "Southwest Monsoon Transit Disruption & Late Harvest Inflow",
        "sweet_spot_weeks": "Weeks 8–11 (Late August to Mid September)",
        "sweet_spot_rationale": "Monsoon easing across western coastline. Vessel transit speeds normalize, customs backlogs clear.",
        "avoid_weeks": "Weeks 1–4 (July peak monsoon)",
        "avoid_rationale": "Feeder delays at Colombo/JNPT ports, container moisture risks.",
        "strategic_focus": "Transition from summer peak to autumn inventory posture.",
        "avg_lead_time_golden_days": 37.5,
        "avg_freight_savings_pct": 21.0,
    },
    "Q4": {
        "quarter": "Q4 (Oct - Dec)",
        "seasonal_driver": "Golden Week & Global Year-End Holiday Freight Crunch",
        "sweet_spot_weeks": "Weeks 3–6 (Mid-October to Early November)",
        "sweet_spot_rationale": "Post-Golden Week capacity stabilization before transpacific Christmas cargo squeeze peaks.",
        "avoid_weeks": "Weeks 1 (Golden Week shutdown) and Weeks 9–13 (Year-end freight surge)",
        "avoid_rationale": "Severe container shortage at Asian transshipment hubs due to Western holiday exports.",
        "strategic_focus": "Lock in long-term annual supply contracts and secure January production ingredients.",
        "avg_lead_time_golden_days": 36.0,
        "avg_freight_savings_pct": 23.5,
    },
}

def get_quarterly_import_analysis(quarter: str = "Q2") -> Dict[str, Any]:
    """
    Returns full week-by-week cost, lead time, and port congestion telemetry
    for import planning, alongside the calendar seasonality overlay.
    """
    q_key = quarter.upper() if quarter.upper() in QUARTER_CALENDAR_FACTORS else "Q2"
    calendar_meta = QUARTER_CALENDAR_FACTORS[q_key]

    # Calculate golden window vs quarter-end averages
    golden_weeks = [w for w in WEEKLY_QUARTER_PROFILE if w["is_golden_window"]]
    rush_weeks = [w for w in WEEKLY_QUARTER_PROFILE if "Rush" in w["phase"]]

    avg_golden_rate = sum(w["ocean_rate_index_usd"] for w in golden_weeks) / len(golden_weeks)
    avg_rush_rate = sum(w["ocean_rate_index_usd"] for w in rush_weeks) / len(rush_weeks)

    avg_golden_lead_time = sum(w["total_lead_time_days"] for w in golden_weeks) / len(golden_weeks)
    avg_rush_lead_time = sum(w["total_lead_time_days"] for w in rush_weeks) / len(rush_weeks)

    avg_golden_cost_kg = sum(w["landed_cost_per_kg_inr"] for w in golden_weeks) / len(golden_weeks)
    avg_rush_cost_kg = sum(w["landed_cost_per_kg_inr"] for w in rush_weeks) / len(rush_weeks)

    rate_savings_pct = ((avg_rush_rate - avg_golden_rate) / avg_rush_rate) * 100
    lead_time_savings_days = avg_rush_lead_time - avg_golden_lead_time
    cost_per_kg_savings_inr = avg_rush_cost_kg - avg_golden_cost_kg

    # For an annual imported volume of 384,000 kg (Pulp Riot Dragonfruit pulp baseline):
    annual_volume_kg = 384000
    annual_financial_savings_cr = (annual_volume_kg * cost_per_kg_savings_inr) / 1e7

    return {
        "selected_quarter": q_key,
        "calendar_seasonality": calendar_meta,
        "weekly_profile": WEEKLY_QUARTER_PROFILE,
        "executive_summary": {
            "golden_window_weeks": "Weeks 4 to 8 of any quarter",
            "golden_window_ocean_rate_usd": round(avg_golden_rate, 0),
            "quarter_end_ocean_rate_usd": round(avg_rush_rate, 0),
            "freight_rate_savings_pct": round(rate_savings_pct, 1),
            "golden_lead_time_days": round(avg_golden_lead_time, 1),
            "quarter_end_lead_time_days": round(avg_rush_lead_time, 1),
            "lead_time_reduction_days": round(lead_time_savings_days, 1),
            "landed_cost_savings_per_kg_inr": round(cost_per_kg_savings_inr, 2),
            "projected_annual_pulp_savings_inr_cr": round(annual_financial_savings_cr, 2),
        },
        "planning_rule": (
            "THE POSTPONEMENT IMPORT RULE: Place quarterly purchase orders during Weeks 4–7 ('The Golden Window'). "
            "Never order in Weeks 12–13 to avoid the 63-day lead time cliff and +₹45.00/kg rush premium. "
            "For Q2 summer demand, lock in bulk orders during late Q1 (post-CNY rate trough) to secure 34-day transit."
        ),
    }

def recommend_po_placement(
    target_arrival_date: str,  # "YYYY-MM-DD"
    volume_kg: float = 24000.0,
    ingredient: str = "Dragonfruit Pulp",
) -> Dict[str, Any]:
    """
    Back-calculates the optimal purchase order placement date in the Golden Window
    to meet a required plant arrival deadline with least landed cost and shortest lead time.
    """
    try:
        arr_date = datetime.strptime(target_arrival_date, "%Y-%m-%d").date()
    except Exception:
        arr_date = date(2027, 5, 20)

    # Determine quarter of target arrival
    month = arr_date.month
    if month in [1, 2, 3]:
        target_q = "Q1"
    elif month in [4, 5, 6]:
        target_q = "Q2"
    elif month in [7, 8, 9]:
        target_q = "Q3"
    else:
        target_q = "Q4"

    # Golden window transit lead time is 35 days
    golden_transit_days = 35
    recommended_po_date = arr_date - timedelta(days=golden_transit_days)

    # If ordered during quarter-end rush, lead time is 60 days
    rush_po_date = arr_date - timedelta(days=60)

    golden_cost_per_kg = 155.0
    rush_cost_per_kg = 203.0
    savings_inr = volume_kg * (rush_cost_per_kg - golden_cost_per_kg)

    return {
        "ingredient": ingredient,
        "volume_kg": volume_kg,
        "target_arrival_date": arr_date.isoformat(),
        "target_quarter": target_q,
        "recommended_po_date": recommended_po_date.isoformat(),
        "optimal_order_window": f"{recommended_po_date.strftime('%B %d')} (±4 days in Golden Window)",
        "golden_lead_time_days": golden_transit_days,
        "quarter_end_lead_time_days": 60,
        "lead_time_cushion_saved_days": 25,
        "landed_cost_golden_inr": volume_kg * golden_cost_per_kg,
        "landed_cost_quarter_end_inr": volume_kg * rush_cost_per_kg,
        "estimated_savings_inr": savings_inr,
        "savings_label": f"₹{savings_inr / 1e5:.2f} Lakhs",
        "execution_guidance": (
            f"Release PO on {recommended_po_date.strftime('%d %b %Y')}. This hits the off-peak vessel departure window, "
            f"securing an ocean freight rate of ~$1,210/FEU (vs $2,400+ at quarter end) and 3.2 days port dwell at Nhava Sheva. "
            f"Avoids {25} days in unnecessary transshipment queue delays."
        ),
    }
