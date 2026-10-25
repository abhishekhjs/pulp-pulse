from typing import Dict, Any, List, Optional
from backend.app.services.weather_hazard_service import get_current_weather_and_hazard

# Standard corridors across the supply network
CORRIDORS_CATALOG = {
    "coop_to_plant": {
        "id": "coop_to_plant",
        "name": "Cooperative to Plant (Hill Inbound)",
        "origin": "Himalayan Orchards Co-op (Joshimath, UK)",
        "destination": "Nashik Central Processing Facility (MH)",
        "distance_km": 1450,
        "default_good": "Raw Passionfruit Pulp (-18°C frozen drums)",
        "default_volume_kg": 20000,
        "mountain_pass_km": 180,  # Highly vulnerable section
        "bottles_equivalent": 100000,
    },
    "import_port_to_plant": {
        "id": "import_port_to_plant",
        "name": "Ocean Port to Plant (Import Inbound)",
        "origin": "Nhava Sheva / JNPT Port (Navi Mumbai)",
        "destination": "Nashik Central Processing Facility (MH)",
        "distance_km": 185,
        "default_good": "Imported Dragonfruit Puree (-18°C frozen containers)",
        "default_volume_kg": 24000,
        "mountain_pass_km": 35,  # Kasara Ghat section
        "bottles_equivalent": 120000,
    },
    "plant_to_depot_n1": {
        "id": "plant_to_depot_n1",
        "name": "Nashik Plant to Depot N1 (Delhi NCR)",
        "origin": "Nashik Central Processing Facility (MH)",
        "destination": "Depot N1 (Delhi NCR Hub)",
        "distance_km": 1240,
        "default_good": "Finished Bottled Juice (Pulp Riot 24-Pack Carts)",
        "default_volume_kg": 15000,
        "mountain_pass_km": 0,
        "bottles_equivalent": 30000,
    },
    "plant_to_depot_s1": {
        "id": "plant_to_depot_s1",
        "name": "Nashik Plant to Depot S1 (Bengaluru)",
        "origin": "Nashik Central Processing Facility (MH)",
        "destination": "Depot S1 (Bengaluru Hub)",
        "distance_km": 840,
        "default_good": "Finished Bottled Juice (Pulp Riot 24-Pack Carts)",
        "default_volume_kg": 12000,
        "mountain_pass_km": 0,
        "bottles_equivalent": 24000,
    },
    "plant_to_depot_e1": {
        "id": "plant_to_depot_e1",
        "name": "Nashik Plant to Depot E1 (Kolkata)",
        "origin": "Nashik Central Processing Facility (MH)",
        "destination": "Depot E1 (Kolkata East Hub)",
        "distance_km": 1680,
        "default_good": "Finished Bottled Juice (Pulp Riot 24-Pack Carts)",
        "default_volume_kg": 16000,
        "mountain_pass_km": 0,
        "bottles_equivalent": 32000,
    },
    "interdepot_w2_to_n1": {
        "id": "interdepot_w2_to_n1",
        "name": "Inter-Depot Transfer (Pune to Delhi)",
        "origin": "Depot W2 (Pune Hub)",
        "destination": "Depot N1 (Delhi NCR Hub)",
        "distance_km": 1400,
        "default_good": "Fresh Batch Rebalancing (Day-18 Freshness Transfer)",
        "default_volume_kg": 10000,
        "mountain_pass_km": 0,
        "bottles_equivalent": 20000,
    },
}

def optimize_transport_routes(
    corridor_id: str = "coop_to_plant",
    cargo_type: Optional[str] = None,
    volume_kg: Optional[float] = None,
    urgency_level: str = "balanced",  # cost_priority, speed_priority, balanced
) -> Dict[str, Any]:
    """
    Evaluates and ranks all viable multi-modal transport modes for a given good and corridor,
    taking live weather, landslide hazard, transit time, freight cost, thermal stability,
    and carbon emissions into account.
    """
    corridor = CORRIDORS_CATALOG.get(corridor_id, CORRIDORS_CATALOG["coop_to_plant"])
    actual_volume_kg = volume_kg or corridor["default_volume_kg"]
    actual_cargo = cargo_type or corridor["default_good"]
    dist_km = corridor["distance_km"]
    has_mountain_vulnerability = corridor["mountain_pass_km"] > 0

    # Retrieve live weather and landslide conditions
    weather_info = get_current_weather_and_hazard()
    weather_state = weather_info["telemetry"]
    hazard_score = weather_state.get("landslide_hazard_score", 50.0)
    road_status = weather_state.get("road_status", "OPEN_CLEAR")

    # Mode 1: Standard Road Reefer Truck (FTL)
    road_speed_kmh = 38 if has_mountain_vulnerability and hazard_score > 60 else 46
    road_delay_hours = 0.0
    if has_mountain_vulnerability:
        if road_status == "BLOCKED_LANDSLIDE":
            road_delay_hours = 120.0  # 5-day halt / blockage
        elif road_status == "CAUTION_DEBRIS":
            road_delay_hours = 16.0
        elif road_status == "HIGH_LANDSLIDE_RISK":
            road_delay_hours = 24.0

    transit_hours_road = (dist_km / road_speed_kmh) + road_delay_hours + 8.0  # rest/inspection
    rate_per_kg_road = 2.40 if dist_km > 1000 else 1.80
    cost_road = actual_volume_kg * rate_per_kg_road
    carbon_road_kg = (dist_km * actual_volume_kg / 1000.0) * 0.105  # 105g CO2/t-km
    reliability_road = 35.0 if road_status == "BLOCKED_LANDSLIDE" else (65.0 if hazard_score > 60 else 92.0)

    # Mode 2: Express Road Reefer (Dual Driver / Green Corridor Pass)
    express_speed_kmh = 58
    express_delay_hours = road_delay_hours * 0.5 if road_status != "BLOCKED_LANDSLIDE" else 120.0
    transit_hours_express = (dist_km / express_speed_kmh) + express_delay_hours + 4.0
    rate_per_kg_express = rate_per_kg_road * 1.45
    cost_express = actual_volume_kg * rate_per_kg_express
    carbon_express_kg = (dist_km * actual_volume_kg / 1000.0) * 0.118
    reliability_express = 38.0 if road_status == "BLOCKED_LANDSLIDE" else (72.0 if hazard_score > 60 else 96.0)

    # Mode 3: Dedicated Electric Rail Cold Corridor (CONCOR RORO / Reefer Container)
    # Once at the foothills railhead, electric freight moves at 70-80 km/h unimpeded by road landslides
    first_mile_hours = 6.0 if has_mountain_vulnerability else 2.0
    rail_speed_kmh = 68
    transit_hours_rail = first_mile_hours + (dist_km * 0.9 / rail_speed_kmh) + 6.0  # terminal handling
    rate_per_kg_rail = rate_per_kg_road * 0.72  # 28% cheaper bulk container economy
    cost_rail = actual_volume_kg * rate_per_kg_rail
    carbon_rail_kg = (dist_km * actual_volume_kg / 1000.0) * 0.028  # 73% lower carbon!
    # Rail is immune to mountain road blocks once at railhead
    reliability_rail = 86.0 if road_status == "BLOCKED_LANDSLIDE" else 94.0

    # Mode 4: Staged Multi-Modal Hub-and-Spoke (Forward Postponement Pre-positioning)
    # Forward-buffered at foothills cold warehouse prior to risk window
    transit_hours_staged = 22.0 if has_mountain_vulnerability else (dist_km / 50.0) * 0.7
    rate_per_kg_staged = rate_per_kg_road * 0.85
    cost_staged = actual_volume_kg * rate_per_kg_staged
    carbon_staged_kg = (dist_km * actual_volume_kg / 1000.0) * 0.065
    reliability_staged = 98.0  # Already positioned ahead of weather front

    # Mode 5: Emergency Air Freight Cargo
    # Fast flight + airport reefer transfer
    transit_hours_air = 14.0  # booking + flight + customs/terminal
    rate_per_kg_air = rate_per_kg_road * 5.0  # 5x road rate!
    cost_air = actual_volume_kg * rate_per_kg_air
    carbon_air_kg = (dist_km * actual_volume_kg / 1000.0) * 0.680  # very high carbon
    reliability_air = 97.0  # Unaffected by ground slides, but economically punishing

    modes = [
        {
            "mode_id": "staged_multimodal",
            "name": "Staged Multi-Modal (Forward Buffer)",
            "category": "Postponement Strategy",
            "transit_hours": round(transit_hours_staged, 1),
            "transit_days": round(transit_hours_staged / 24.0, 2),
            "rate_per_kg_inr": round(rate_per_kg_staged, 2),
            "cost_inr": round(cost_staged, 2),
            "cost_per_bottle_inr": round(cost_staged / corridor["bottles_equivalent"], 2),
            "reliability_pct": reliability_staged,
            "cold_chain_compliance_pct": 99.8,
            "carbon_kg_co2": round(carbon_staged_kg, 1),
            "landslide_vulnerability": "Near Zero (Pre-positioned beyond slide zone)",
            "key_strength": "Lowest lead time during weather emergencies without cost penalty",
            "pareto_optimal": True,
        },
        {
            "mode_id": "rail_cold_corridor",
            "name": "Electric Rail Reefer Express (CONCOR RORO)",
            "category": "Intermodal Rail",
            "transit_hours": round(transit_hours_rail, 1),
            "transit_days": round(transit_hours_rail / 24.0, 2),
            "rate_per_kg_inr": round(rate_per_kg_rail, 2),
            "cost_inr": round(cost_rail, 2),
            "cost_per_bottle_inr": round(cost_rail / corridor["bottles_equivalent"], 2),
            "reliability_pct": reliability_rail,
            "cold_chain_compliance_pct": 99.2,
            "carbon_kg_co2": round(carbon_rail_kg, 1),
            "landslide_vulnerability": "Low (Bypasses hill highway via foothills railhead)",
            "key_strength": "Lowest direct cost (28% savings) & 73% lower carbon emissions",
            "pareto_optimal": True,
        },
        {
            "mode_id": "road_reefer_express",
            "name": "Express Reefer (Dual-Driver Green Pass)",
            "category": "Expedited Highway",
            "transit_hours": round(transit_hours_express, 1),
            "transit_days": round(transit_hours_express / 24.0, 2),
            "rate_per_kg_inr": round(rate_per_kg_express, 2),
            "cost_inr": round(cost_express, 2),
            "cost_per_bottle_inr": round(cost_express / corridor["bottles_equivalent"], 2),
            "reliability_pct": reliability_express,
            "cold_chain_compliance_pct": 98.4,
            "carbon_kg_co2": round(carbon_express_kg, 1),
            "landslide_vulnerability": "High during severe weather (Subject to highway blocks)",
            "key_strength": "35% faster than standard road when highways remain passable",
            "pareto_optimal": False,
        },
        {
            "mode_id": "road_reefer_standard",
            "name": "Standard Road Reefer (Baseline FTL)",
            "category": "Standard Highway",
            "transit_hours": round(transit_hours_road, 1),
            "transit_days": round(transit_hours_road / 24.0, 2),
            "rate_per_kg_inr": round(rate_per_kg_road, 2),
            "cost_inr": round(cost_road, 2),
            "cost_per_bottle_inr": round(cost_road / corridor["bottles_equivalent"], 2),
            "reliability_pct": reliability_road,
            "cold_chain_compliance_pct": 96.5,
            "carbon_kg_co2": round(carbon_road_kg, 1),
            "landslide_vulnerability": "Critical when rainfall exceeds 80mm/48h",
            "key_strength": "Standard contract baseline for clear-weather operations",
            "pareto_optimal": True if hazard_score < 40 else False,
        },
        {
            "mode_id": "air_freight_emergency",
            "name": "Emergency Air Freight (Charter Jet)",
            "category": "Air Cargo",
            "transit_hours": round(transit_hours_air, 1),
            "transit_days": round(transit_hours_air / 24.0, 2),
            "rate_per_kg_inr": round(rate_per_kg_air, 2),
            "cost_inr": round(cost_air, 2),
            "cost_per_bottle_inr": round(cost_air / corridor["bottles_equivalent"], 2),
            "reliability_pct": reliability_air,
            "cold_chain_compliance_pct": 97.0,
            "carbon_kg_co2": round(carbon_air_kg, 1),
            "landslide_vulnerability": "Zero (Air corridor)",
            "key_strength": "Fastest arrival (14h) but inflicts 5.0x cost penalty",
            "pareto_optimal": True if urgency_level == "speed_priority" else False,
        },
    ]

    # Select best recommendation based on weather hazard and urgency
    if road_status == "BLOCKED_LANDSLIDE" or hazard_score > 75:
        # Emergency situation on hill highway
        recommended_mode_id = "staged_multimodal" if corridor_id == "coop_to_plant" else "rail_cold_corridor"
        recommendation_reason = (
            f"HIGH WEATHER & LANDSLIDE ALERT ({road_status_label(road_status)}): Direct highway road transit is severely compromised. "
            f"Recommend {recommended_mode_id.replace('_', ' ').title()} to maintain continuity without resorting to 5x emergency air freight "
            f"(saving ₹{(cost_air - cost_staged):,.2f} in excess freight penalty)."
        )
    elif urgency_level == "speed_priority":
        recommended_mode_id = "road_reefer_express"
        recommendation_reason = "Expedited arrival prioritized. Express dual-driver road delivers 35% faster lead time."
    elif urgency_level == "cost_priority":
        recommended_mode_id = "rail_cold_corridor"
        recommendation_reason = "Cost minimization prioritized. Dedicated Electric Rail Cold Corridor delivers 28% direct freight savings and lowest carbon footprint."
    else:
        # Balanced
        recommended_mode_id = "rail_cold_corridor" if dist_km > 1000 else "road_reefer_standard"
        recommendation_reason = (
            "Optimal balance of cost, speed, and weather resilience. Electric rail bypasses highway bottlenecks and saves 28% cost."
            if dist_km > 1000 else "Standard road reefer provides best balance for short-haul corridors under current clear conditions."
        )

    # Attach recommendation flag
    for m in modes:
        m["is_recommended"] = (m["mode_id"] == recommended_mode_id)

    return {
        "corridor": corridor,
        "cargo_details": {
            "cargo_name": actual_cargo,
            "volume_kg": actual_volume_kg,
            "urgency": urgency_level,
        },
        "live_hazard_context": {
            "road_status": road_status,
            "hazard_score": hazard_score,
            "weather_condition": weather_state.get("weather_condition", "Normal"),
            "rainfall_48h_mm": weather_state.get("rainfall_48h_mm", 0.0),
        },
        "modes": modes,
        "recommendation": {
            "recommended_mode_id": recommended_mode_id,
            "reason": recommendation_reason,
            "savings_vs_air_freight_inr": round(cost_air - [m["cost_inr"] for m in modes if m["mode_id"] == recommended_mode_id][0], 2),
            "savings_vs_air_freight_pct": round((1.0 - ([m["cost_inr"] for m in modes if m["mode_id"] == recommended_mode_id][0] / cost_air)) * 100, 1),
        },
    }

def road_status_label(status: str) -> str:
    labels = {
        "OPEN_CLEAR": "Highway Open",
        "CAUTION_DEBRIS": "Debris & Single Lane Caution",
        "HIGH_LANDSLIDE_RISK": "High Landslide Threat",
        "BLOCKED_LANDSLIDE": "Active Highway Landslide Roadblock",
    }
    return labels.get(status, "Operational")
