"""
backend/app/services/dmaic_historical_data.py

Extracts, structures, and provides historical baseline and post-intervention
datasets for all 5 Pulp Riot supply chain modules, calibrated to the case study
figures in docs/prd-business.md and seeded database records.

Each module returns:
- problem_statement
- acceptable_threshold (e.g. 3.0%)
- baseline_summary (dates, total_produced, defects, defect_rate, Pareto ranking)
- post_intervention_summary (dates, total_produced, defects, defect_rate, delta)
- baseline_csv (string formatted per ProcessDataPoint schema)
- post_csv (string formatted per ProcessDataPoint schema)
- default_sop_content (Markdown SOP grounded in the case study for RAG ingestion)
"""

from typing import Dict, Any

MODULE_CONFIGS: Dict[str, Dict[str, Any]] = {
    "supply": {
        "module_name": "Supply",
        "company_id": "pulp_riot_supply",
        "problem_statement": (
            "High bottling line throttle and batch rejection rate due to passionfruit "
            "and dragonfruit raw puree stockouts and rigid 95% in-house plant utilization "
            "ceiling during the summer surge."
        ),
        "target_metric": "Bottling Disruption Defect Rate",
        "acceptable_threshold": 3.0,
        "baseline_summary": {
            "period": "March 1 - March 31, 2027 (Pre-Intervention Crisis)",
            "total_produced": 25786,
            "defect_count": 2140,
            "baseline_defect_rate_pct": 8.30,
            "top_defect": "Pulp_Stockout_Throttle",
            "business_impact": (
                "₹14.75 Cr lost contribution margin; 58% line throttle on passionfruit SKUs; "
                "in-house plants locked at 95% capacity unable to fulfill summer demand."
            ),
        },
        "post_intervention_summary": {
            "period": "April 1 - April 15, 2027 (Post-Intervention Stabilization)",
            "total_produced": 13867,
            "defect_count": 260,
            "post_defect_rate_pct": 1.87,
            "improvement_delta_pct": -6.43,
            "intervention_deployed": (
                "Supply Agent triggered Co-Packer (+10% capacity, +55% burst) with 14-day notice "
                "and reallocated in-house lines away from high-cover Mango SKUs."
            ),
        },
        "baseline_csv": (
            "period,defect_type,count,total_produced\n"
            "2027-W10,Pulp_Stockout_Throttle,420,6200\n"
            "2027-W10,Capacity_Exhaustion_Bottleneck,160,6200\n"
            "2027-W10,Unplanned_SKU_Switchover,85,6200\n"
            "2027-W11,Pulp_Stockout_Throttle,510,6450\n"
            "2027-W11,Capacity_Exhaustion_Bottleneck,190,6450\n"
            "2027-W11,Unplanned_SKU_Switchover,95,6450\n"
            "2027-W12,Pulp_Stockout_Throttle,340,6500\n"
            "2027-W12,Capacity_Exhaustion_Bottleneck,145,6500\n"
            "2027-W12,Unplanned_SKU_Switchover,75,6500\n"
            "2027-W13,Pulp_Stockout_Throttle,70,6636\n"
            "2027-W13,Capacity_Exhaustion_Bottleneck,35,6636\n"
            "2027-W13,Unplanned_SKU_Switchover,10,6636\n"
        ),
        "post_csv": (
            "period,defect_type,count,total_produced\n"
            "2027-W14,Pulp_Stockout_Throttle,65,4600\n"
            "2027-W14,Capacity_Exhaustion_Bottleneck,32,4600\n"
            "2027-W14,Unplanned_SKU_Switchover,18,4600\n"
            "2027-W15,Pulp_Stockout_Throttle,52,4600\n"
            "2027-W15,Capacity_Exhaustion_Bottleneck,28,4600\n"
            "2027-W15,Unplanned_SKU_Switchover,15,4600\n"
            "2027-W16,Pulp_Stockout_Throttle,25,4667\n"
            "2027-W16,Capacity_Exhaustion_Bottleneck,15,4667\n"
            "2027-W16,Unplanned_SKU_Switchover,10,4667\n"
        ),
        "sop_markdown": (
            "# Pulp Riot Juice Co. — Standard Operating Procedure: Bottling Operations & Puree Sourcing\n"
            "**Document ID:** SOP-OPS-SUP-002 | **Revision:** 4.1 | **Effective:** Summer Season 2027\n\n"
            "## 1. Purpose & Scope\n"
            "This SOP governs production scheduling, co-packer activation, and raw puree buffer management "
            "across Nashik and Pune bottling facilities. The target is maintaining plant utilization between "
            "85% and 92%, with a maximum defect rate (unfulfilled or throttled production batches) below 3.0%.\n\n"
            "## 2. Process Specifications & Ceilings\n"
            "- In-house bottling capacity ceiling: 95.0% maximum sustained utilization.\n"
            "- Co-Packer notice requirement: Minimum 14 days advance booking for +10% production flex (+3,800 bottles/day).\n"
            "- Puree storage stability: -18°C frozen pulp holds for 180 days.\n"
            "- Reorder Point: Minimum 25 days cover required before peak season (April 15).\n\n"
            "## 3. Defect Classification\n"
            "1. **Pulp_Stockout_Throttle**: Line running at <60% capacity due to ingredient stockout.\n"
            "2. **Capacity_Exhaustion_Bottleneck**: Orders dropped due to >95% plant utilization.\n"
            "3. **Unplanned_SKU_Switchover**: Idle time exceeding 120 minutes during flavor changeover.\n\n"
            "## 4. Root Causes & Escalation Protocols\n"
            "Whenever passionfruit cover drops below 14 days or plant utilization crosses 93%, the Supply Lead "
            "must authorize co-packer booking and throttle low-velocity Mango production lines immediately.\n"
        ),
    },

    "demand": {
        "module_name": "Demand",
        "company_id": "pulp_riot_demand",
        "problem_statement": (
            "Severe stockouts in Quick Commerce dark stores and extreme forecast deviation "
            "following unpredicted social media viral demand surge for Dragon Passion."
        ),
        "target_metric": "Demand Fulfillment Defect Rate",
        "acceptable_threshold": 3.0,
        "baseline_summary": {
            "period": "March 15 - March 31, 2027 (Viral Demand Surge)",
            "total_produced": 18400,
            "defect_count": 1920,
            "baseline_defect_rate_pct": 10.43,
            "top_defect": "DarkStore_Stockout",
            "business_impact": (
                "Quick Commerce orders spiked 400%-850%; Marketing received daily CSVs but supply "
                "planners used static monthly forecasts; dark stores experienced 8% summer revenue stockouts."
            ),
        },
        "post_intervention_summary": {
            "period": "April 1 - April 15, 2027 (Real-time QC Sensing Active)",
            "total_produced": 12500,
            "defect_count": 245,
            "post_defect_rate_pct": 1.96,
            "improvement_delta_pct": -8.47,
            "intervention_deployed": (
                "Automated daily QC sell-through ingestion acting as leading indicator; dynamic "
                "allocation multiplier replaces static monthly allocations."
            ),
        },
        "baseline_csv": (
            "period,defect_type,count,total_produced\n"
            "2027-W11,DarkStore_Stockout,580,6100\n"
            "2027-W11,Forecast_Underestimation_Lag,180,6100\n"
            "2027-W11,Channel_Allocation_Mismatch,90,6100\n"
            "2027-W12,DarkStore_Stockout,490,6100\n"
            "2027-W12,Forecast_Underestimation_Lag,160,6100\n"
            "2027-W12,Channel_Allocation_Mismatch,80,6100\n"
            "2027-W13,DarkStore_Stockout,210,6200\n"
            "2027-W13,Forecast_Underestimation_Lag,90,6200\n"
            "2027-W13,Channel_Allocation_Mismatch,40,6200\n"
        ),
        "post_csv": (
            "period,defect_type,count,total_produced\n"
            "2027-W14,DarkStore_Stockout,55,4100\n"
            "2027-W14,Forecast_Underestimation_Lag,25,4100\n"
            "2027-W14,Channel_Allocation_Mismatch,15,4100\n"
            "2027-W15,DarkStore_Stockout,45,4150\n"
            "2027-W15,Forecast_Underestimation_Lag,20,4150\n"
            "2027-W15,Channel_Allocation_Mismatch,12,4150\n"
            "2027-W16,DarkStore_Stockout,38,4250\n"
            "2027-W16,Forecast_Underestimation_Lag,20,4250\n"
            "2027-W16,Channel_Allocation_Mismatch,15,4250\n"
        ),
        "sop_markdown": (
            "# Pulp Riot Juice Co. — Standard Operating Procedure: Demand Sensing & Channel Allocation\n"
            "**Document ID:** SOP-MKT-DEM-001 | **Revision:** 3.0 | **Effective:** Summer Season 2027\n\n"
            "## 1. Purpose & Scope\n"
            "Covers daily sales order ingestion, rolling 14-day SARIMAX demand forecasting, and channel allocation "
            "rules across Quick Commerce (QC), Modern Trade (MT), and General Trade (GT).\n\n"
            "## 2. Channel Allocation Rules\n"
            "- Baseline share targets: GT 55%, MT 25%, QC 20%.\n"
            "- Quick Commerce Velocity Trigger: If 3-day rolling QC sell-through exceeds forecast by >25% (KPI B3), "
            "the system automatically recalibrates weekly regional depot allocations.\n"
            "- Acceptable forecast defect rate: <= 3.0% unfulfilled customer demand.\n\n"
            "## 3. Defect Classification\n"
            "1. **DarkStore_Stockout**: Store inventory drops to 0 bottles during operating hours.\n"
            "2. **Forecast_Underestimation_Lag**: Forecast error variance > 25% over 3 rolling days.\n"
            "3. **Channel_Allocation_Mismatch**: Wholesale overstocked while retail accounts face backorders.\n"
        ),
    },

    "inventory": {
        "module_name": "Inventory",
        "company_id": "pulp_riot_inventory",
        "problem_statement": (
            "High batch aging past Day 18 commercial freshness window and expired inventory write-offs "
            "in slow-moving depots (Kolkata and Chandigarh) due to static 3-week depot buffer rules."
        ),
        "target_metric": "Inventory Freshness & Write-Off Defect Rate",
        "acceptable_threshold": 2.5,
        "baseline_summary": {
            "period": "March 1 - March 31, 2027 (Static Buffer Accumulation)",
            "total_produced": 24800,
            "defect_count": 2420,
            "baseline_defect_rate_pct": 9.76,
            "top_defect": "Batch_Age_Past_18d",
            "business_impact": (
                "₹6.00 Cr in write-offs & deep discounts; batches sitting 21 days in depots with only 9 days "
                "left before MT/QC buyers reject stock (<60 days remaining of 90-day shelf life)."
            ),
        },
        "post_intervention_summary": {
            "period": "April 1 - April 15, 2027 (Dynamic Day-18 Transfer Active)",
            "total_produced": 22100,
            "defect_count": 280,
            "post_defect_rate_pct": 1.27,
            "improvement_delta_pct": -8.49,
            "intervention_deployed": (
                "Inventory Agent Day-18 Arbitrage Rule: auto-triggers ₹1.50/bottle transfer to fast-moving "
                "metro depots (Bengaluru/Mumbai) or reroutes to General Trade, saving ₹60.00/bottle write-off."
            ),
        },
        "baseline_csv": (
            "period,defect_type,count,total_produced\n"
            "2027-W10,Batch_Age_Past_18d,520,6100\n"
            "2027-W10,Rejection_Past_30d,180,6100\n"
            "2027-W10,Depot_Handling_Spoilage,65,6100\n"
            "2027-W11,Batch_Age_Past_18d,590,6200\n"
            "2027-W11,Rejection_Past_30d,210,6200\n"
            "2027-W11,Depot_Handling_Spoilage,75,6200\n"
            "2027-W12,Batch_Age_Past_18d,410,6200\n"
            "2027-W12,Rejection_Past_30d,140,6200\n"
            "2027-W12,Depot_Handling_Spoilage,50,6200\n"
            "2027-W13,Batch_Age_Past_18d,120,6300\n"
            "2027-W13,Rejection_Past_30d,40,6300\n"
            "2027-W13,Depot_Handling_Spoilage,20,6300\n"
        ),
        "post_csv": (
            "period,defect_type,count,total_produced\n"
            "2027-W14,Batch_Age_Past_18d,65,7200\n"
            "2027-W14,Rejection_Past_30d,18,7200\n"
            "2027-W14,Depot_Handling_Spoilage,12,7200\n"
            "2027-W15,Batch_Age_Past_18d,55,7400\n"
            "2027-W15,Rejection_Past_30d,15,7400\n"
            "2027-W15,Depot_Handling_Spoilage,10,7400\n"
            "2027-W16,Batch_Age_Past_18d,60,7500\n"
            "2027-W16,Rejection_Past_30d,25,7500\n"
            "2027-W16,Depot_Handling_Spoilage,20,7500\n"
        ),
        "sop_markdown": (
            "# Pulp Riot Juice Co. — Standard Operating Procedure: Finished Goods Freshness & Depot Aging\n"
            "**Document ID:** SOP-LOG-INV-003 | **Revision:** 2.4 | **Effective:** Summer Season 2027\n\n"
            "## 1. Purpose & Freshness Windows\n"
            "Pulp Riot juices feature a 90-day physical shelf-life. However, Modern Trade (MT) and Quick Commerce (QC) "
            "buyers reject shipments with less than 60 days remaining (Day 30 Commercial Rejection Cliff).\n\n"
            "## 2. Guardrails & Automated Actions\n"
            "- Maximum acceptable defect rate: <= 2.5% of network stock in at-risk or rejected status.\n"
            "- Day 18 Warning (KPI D2): When any batch reaches Day 18 and regional run-rate cannot clear it within "
            "7 days, the system must trigger an inter-depot transfer (₹1.50/bottle) or reroute to General Trade.\n"
            "- Day 30 Critical Cliff (KPI D3): Mandatory write-off or liquidation discount.\n"
        ),
    },

    "transportation": {
        "module_name": "Transportation",
        "company_id": "pulp_riot_transportation",
        "problem_statement": (
            "Excessive emergency air freight expenditures and transit temperature excursion risks "
            "due to single-route road vulnerability during seasonal monsoon landslides."
        ),
        "target_metric": "Freight & Cold Chain Defect Rate",
        "acceptable_threshold": 2.5,
        "baseline_summary": {
            "period": "March 1 - March 31, 2027 (Pre-Monsoon Rush & Air Charters)",
            "total_produced": 55200,
            "defect_count": 6850,
            "baseline_defect_rate_pct": 12.41,
            "top_defect": "Emergency_Air_Freight_Penalty",
            "business_impact": (
                "₹3.20 Cr spent on emergency air freight charters (₹87.50/bottle vs ₹4.00 road rate); "
                "60% historical probability of sole highway closure during May ignored in planning."
            ),
        },
        "post_intervention_summary": {
            "period": "April 1 - April 15, 2027 (Pre-May Buffer Implemented)",
            "total_produced": 48000,
            "defect_count": 620,
            "post_defect_rate_pct": 1.29,
            "improvement_delta_pct": -11.12,
            "intervention_deployed": (
                "Transportation Agent mandates forward-building frozen pulp in plant cold storage "
                "to 35 days cover via regular road freight prior to April 15; emergency air charters reduced to zero."
            ),
        },
        "baseline_csv": (
            "period,defect_type,count,total_produced\n"
            "2027-W10,Emergency_Air_Freight_Penalty,1450,13800\n"
            "2027-W10,Cold_Chain_Temp_Excursion,180,13800\n"
            "2027-W10,Transit_SLA_Delay,90,13800\n"
            "2027-W11,Emergency_Air_Freight_Penalty,1750,13800\n"
            "2027-W11,Cold_Chain_Temp_Excursion,210,13800\n"
            "2027-W11,Transit_SLA_Delay,110,13800\n"
            "2027-W12,Emergency_Air_Freight_Penalty,1500,13800\n"
            "2027-W12,Cold_Chain_Temp_Excursion,190,13800\n"
            "2027-W12,Transit_SLA_Delay,95,13800\n"
            "2027-W13,Emergency_Air_Freight_Penalty,950,13800\n"
            "2027-W13,Cold_Chain_Temp_Excursion,210,13800\n"
            "2027-W13,Transit_SLA_Delay,115,13800\n"
        ),
        "post_csv": (
            "period,defect_type,count,total_produced\n"
            "2027-W14,Emergency_Air_Freight_Penalty,0,16000\n"
            "2027-W14,Cold_Chain_Temp_Excursion,120,16000\n"
            "2027-W14,Transit_SLA_Delay,95,16000\n"
            "2027-W15,Emergency_Air_Freight_Penalty,0,16000\n"
            "2027-W15,Cold_Chain_Temp_Excursion,110,16000\n"
            "2027-W15,Transit_SLA_Delay,90,16000\n"
            "2027-W16,Emergency_Air_Freight_Penalty,0,16000\n"
            "2027-W16,Cold_Chain_Temp_Excursion,115,16000\n"
            "2027-W16,Transit_SLA_Delay,90,16000\n"
        ),
        "sop_markdown": (
            "# Pulp Riot Juice Co. — Standard Operating Procedure: Cold Chain Logistics & Sourcing Transit\n"
            "**Document ID:** SOP-LOG-TRN-004 | **Revision:** 3.1 | **Effective:** Summer Season 2027\n\n"
            "## 1. Cold Chain Temperature Mandates\n"
            "- Reefer fleet setpoint: 3.0°C (operational tolerance: 2.0°C to 4.0°C).\n"
            "- Any temperature excursion exceeding 4.5°C triggers immediate alert and mandatory secondary QC audit.\n\n"
            "## 2. Inbound Landslide Risk Mitigation\n"
            "- Highway transit from Himalayan passionfruit cooperative takes 3 days with no alternative road route.\n"
            "- Prior to April 15, frozen pulp inventory in Nashik plant cold storage must be built to 35 days cover.\n"
            "- Emergency air freight charters are strictly prohibited unless authorized by the COO and verified by KPI A4.\n"
        ),
    },

    "distribution": {
        "module_name": "Distribution",
        "company_id": "pulp_riot_distribution",
        "problem_statement": (
            "Severe regional depot stock imbalances (E1 Index 12.4%) resulting in East region overstocking "
            "while South and West high-velocity hubs experienced simultaneous stockouts."
        ),
        "target_metric": "Depot Stock Imbalance & Allocation Defect Rate",
        "acceptable_threshold": 3.0,
        "baseline_summary": {
            "period": "March 1 - March 31, 2027 (Static Flavor Mix Allocations)",
            "total_produced": 44000,
            "defect_count": 4950,
            "baseline_defect_rate_pct": 11.25,
            "top_defect": "Regional_Stock_Imbalance",
            "business_impact": (
                "Allocations based on last year's flavor mix starved growth hubs (Bengaluru S1) while "
                "bloating slow-moving hubs (Kolkata E1 with 28 days cover); stock imbalance index reached 12.4%."
            ),
        },
        "post_intervention_summary": {
            "period": "April 1 - April 15, 2027 (Weekly Dynamic Balancing)",
            "total_produced": 41500,
            "defect_count": 610,
            "post_defect_rate_pct": 1.47,
            "improvement_delta_pct": -9.78,
            "intervention_deployed": (
                "Distribution Agent recalculates depot allocations weekly using local sales velocity; "
                "executes proactive inter-depot transfers (E1 -> S1), lowering imbalance index to 3.8%."
            ),
        },
        "baseline_csv": (
            "period,defect_type,count,total_produced\n"
            "2027-W10,Regional_Stock_Imbalance,980,11000\n"
            "2027-W10,Depot_Stockout_Starvation,220,11000\n"
            "2027-W10,Delayed_InterDepot_Transfer,85,11000\n"
            "2027-W11,Regional_Stock_Imbalance,1120,11000\n"
            "2027-W11,Depot_Stockout_Starvation,260,11000\n"
            "2027-W11,Delayed_InterDepot_Transfer,95,11000\n"
            "2027-W12,Regional_Stock_Imbalance,940,11000\n"
            "2027-W12,Depot_Stockout_Starvation,210,11000\n"
            "2027-W12,Delayed_InterDepot_Transfer,80,11000\n"
            "2027-W13,Regional_Stock_Imbalance,720,11000\n"
            "2027-W13,Depot_Stockout_Starvation,180,11000\n"
            "2027-W13,Delayed_InterDepot_Transfer,60,11000\n"
        ),
        "post_csv": (
            "period,defect_type,count,total_produced\n"
            "2027-W14,Regional_Stock_Imbalance,120,13500\n"
            "2027-W14,Depot_Stockout_Starvation,45,13500\n"
            "2027-W14,Delayed_InterDepot_Transfer,35,13500\n"
            "2027-W15,Regional_Stock_Imbalance,110,14000\n"
            "2027-W15,Depot_Stockout_Starvation,40,14000\n"
            "2027-W15,Delayed_InterDepot_Transfer,30,14000\n"
            "2027-W16,Regional_Stock_Imbalance,125,14000\n"
            "2027-W16,Depot_Stockout_Starvation,60,14000\n"
            "2027-W16,Delayed_InterDepot_Transfer,45,14000\n"
        ),
        "sop_markdown": (
            "# Pulp Riot Juice Co. — Standard Operating Procedure: Regional Depot Balancing & Allocation\n"
            "**Document ID:** SOP-LOG-DST-005 | **Revision:** 2.8 | **Effective:** Summer Season 2027\n\n"
            "## 1. Depot Allocation Architecture\n"
            "Pulp Riot operates 9 regional cold depots across 4 zones: North (N1 Delhi, N2 Chandigarh), "
            "West (W1 Mumbai, W2 Pune, W3 Ahmedabad), South (S1 Bengaluru, S2 Chennai, S3 Hyderabad), "
            "East (E1 Kolkata).\n\n"
            "## 2. Dynamic Balancing Thresholds\n"
            "- Target depot cover: 10 to 14 days of dynamic demand cover.\n"
            "- Stock Imbalance Index (KPI E1) trigger: If regional variance exceeds 8.0%, immediate transfer "
            "recommendation is generated.\n"
            "- Inter-depot transit cost standard: ₹1.50 per bottle with 2-4 days transit window.\n"
        ),
    },
}

def get_module_dmaic_dataset(module_name: str) -> Dict[str, Any]:
    """Retrieve calibrated historical baseline and post-intervention data for a module."""
    norm_key = module_name.strip().lower()
    if norm_key not in MODULE_CONFIGS:
        # Fallback to supply if not recognized
        norm_key = "supply"
    return MODULE_CONFIGS[norm_key]
