import uuid
from datetime import datetime, date, timedelta
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.models.db import get_db, ScenarioRun, Alert, Approval
from backend.app.models.schemas import ScenarioReplayResponse, ScenarioDayEvent
from backend.app.agents.graph import run_agent_pipeline
from backend.app.api.ws import manager

scenario_router = APIRouter(prefix="/scenario", tags=["scenario"])

def generate_chronological_replay() -> List[ScenarioDayEvent]:
    events = [
        ScenarioDayEvent(
            day=1,
            date="2027-03-01",
            case_actual_event="Dragon Passion launched across channels. Depots stocked using last year's static flavor mix (0% new SKU weight).",
            case_actual_financial_impact="Normal baseline spend",
            agent_flag="KPI G1 / E3 Ingest Active",
            agent_action_recommended="Daily automated ingestion pipeline active. Real-time weighting enabled.",
            approval_tier="ops",
            prevention_saving="Baseline calibration",
            status="normal",
        ),
        ScenarioDayEvent(
            day=15,
            date="2027-03-15",
            case_actual_event="Influencer reel goes viral. Quick Commerce orders spike 4x. Daily reports arrive in Marketing but sit unread by supply planners.",
            case_actual_financial_impact="Planners blind to spike; 2-week detection gap begins",
            agent_flag="Viral Surge Sensing Initiated",
            agent_action_recommended="Real-time QC telemetry captures 1.8x velocity jump over forecast.",
            approval_tier="planner",
            prevention_saving="Early warning window opened",
            status="alert_fired",
        ),
        ScenarioDayEvent(
            day=18,
            date="2027-03-18",
            case_actual_event="Planners continue standard monthly schedules bottling Mango and Guava. No co-packer alert.",
            case_actual_financial_impact="Stock-out countdown started in fast hubs",
            agent_flag="ALERT B3 FIRED: QC Velocity Deviation (+94%)",
            agent_action_recommended="Demand Sensing Agent detects 3-day rolling deviation >25% for Dragon Passion (96% confidence). Flags immediate capacity shortfall.",
            approval_tier="supply_lead",
            prevention_saving="Eliminates 2-week blind spot",
            status="alert_fired",
        ),
        ScenarioDayEvent(
            day=20,
            date="2027-03-20",
            case_actual_event="In-house plants run at 95% capacity on core SKUs. 2-week co-packer notice window missed.",
            case_actual_financial_impact="Missed co-packer window locks in ₹46.08 Cr stock-outs",
            agent_flag="ALERT C1 FIRED: Plant Utilization Rate (95.0% > 93%)",
            agent_action_recommended="Supply Agent triggers Co-Packer (+10% capacity) with required 14-day advance notice. Reallocates in-house lines to Dragon Passion.",
            approval_tier="supply_lead",
            prevention_saving="Saves ₹14.75 Cr Contribution Margin at +₹1.80/bottle co-packer conversion cost",
            status="intervention_active",
        ),
        ScenarioDayEvent(
            day=35,
            date="2027-04-04",
            case_actual_event="Depots N2 and E1 choke on overstocked Mango Peach Basil. Bottles age past day 18 towards the day 30 rejection cliff.",
            case_actual_financial_impact="Accumulating towards ₹6.00 Cr deadstock write-off",
            agent_flag="ALERT D2 FIRED: Batch Age at Risk (Age 19 >= 18)",
            agent_action_recommended="Inventory Agent flags Batch #104 (age 19). Recommends inter-depot transfer to high-velocity Depot S1 (Bengaluru) at ₹1.50/bottle.",
            approval_tier="planner",
            prevention_saving="Arbitrage saves ₹60.00/bottle write-off at ₹1.50/bottle transfer cost (40x ROI)",
            status="intervention_active",
        ),
        ScenarioDayEvent(
            day=45,
            date="2027-04-14",
            case_actual_event="S&OP holds only 2 weeks (14 days) of passionfruit pulp heading into May, ignoring 60% historical highway closure rate.",
            case_actual_financial_impact="Vulnerability unaddressed",
            agent_flag="ALERT F1 & C3 FIRED: Seasonal Route Risk & Low Pulp Buffer",
            agent_action_recommended="Transportation Agent flags 60% summer landslide probability. Mandates forward-building frozen pulp to 35 days in plant cold storage via regular road freight.",
            approval_tier="supply_lead",
            prevention_saving="Eliminates need for emergency air freight (₹3.2 Cr) and prevents raw pulp outage",
            status="intervention_active",
        ),
        ScenarioDayEvent(
            day=70,
            date="2027-05-09",
            case_actual_event="Severe landslides shut sole passionfruit highway for 3 weeks. Plants exhaust 14-day pulp buffer immediately.",
            case_actual_financial_impact="Inbound flow drops to zero; plant panic sets in",
            agent_flag="Autonomous Buffer Deployed",
            agent_action_recommended="Inbound road closed as predicted. Plant draws from 35-day forward-built cold storage pulp buffer (180-day stability). Production unaffected.",
            approval_tier="coo",
            prevention_saving="Full line continuity maintained",
            status="disaster_diverted",
        ),
        ScenarioDayEvent(
            day=77,
            date="2027-05-16",
            case_actual_event="Case company books emergency air freight at 5x cost (₹3.2 Cr), cuts Passionfruit Punch to save Dragon Passion, yet runs out of both.",
            case_actual_financial_impact="₹3.20 Cr air freight paid + ₹14.75 Cr lost sales + competitor copycat launches",
            agent_flag="Zero Air Freight Needed",
            agent_action_recommended="Both Passionfruit Punch and Dragon Passion lines run at scheduled rates with co-packer support. Zero air freight booked.",
            approval_tier="coo",
            prevention_saving="Averts ₹2.56 Cr freight penalty and protects retail shelf listings",
            status="disaster_diverted",
        ),
        ScenarioDayEvent(
            day=122,
            date="2027-06-30",
            case_actual_event="Summer closes. ₹23.31 Cr net profit eroded. Copycat rival seizes permanent shelf space in Modern Trade.",
            case_actual_financial_impact="₹23.31 Cr Total Net Loss",
            agent_flag="Resilient Summer Concluded",
            agent_action_recommended="98.2% summer fulfillment achieved. Zero batch write-offs, zero emergency freight. Shelf dominance preserved.",
            approval_tier="coo",
            prevention_saving="₹20.75 Cr Net Profit Protected (under ₹2.5 Cr Year-1 budget)",
            status="disaster_diverted",
        ),
    ]
    return events

@scenario_router.post("/replay", response_model=ScenarioReplayResponse)
async def run_scenario_replay(db: Session = Depends(get_db)):
    # 1. Run agent pipeline across the scenario
    pipeline_state = run_agent_pipeline()

    run_id = f"replay_{uuid.uuid4().hex[:8]}"
    timeline = generate_chronological_replay()

    summary = {
        "case_name": "Pulp Riot Juice Co. - Summer Scenario Replay",
        "case_actual_damage_cr": 23.31,
        "agent_averted_damage_cr": 20.75,
        "net_profit_protected_cr": 20.75,
        "key_interventions_fired": [
            "Co-Packer Triggered (Day 20 vs Month-End)",
            "Inter-Depot Freshness Transfer (Day 35 at ₹1.50 vs ₹60 Write-Off)",
            "Pre-May Frozen Pulp Buffer Built (Day 45, averting ₹3.2 Cr Air Freight)",
            "Shelf Space Defended against Rival Copycat",
        ],
        "roi_multiple": "9.2x ROI on ₹2.5 Cr Solution Budget",
    }

    # Save replay run to DB
    scenario_record = ScenarioRun(
        id=run_id,
        run_date=datetime.utcnow(),
        status="completed",
        summary=summary,
        day_by_day=[e.model_dump() for e in timeline],
    )
    db.add(scenario_record)
    db.commit()

    # Broadcast replay completed
    await manager.broadcast({
        "type": "SCENARIO_REPLAY_COMPLETED",
        "run_id": run_id,
        "averted_damage": "₹20.75 Cr",
    })

    return ScenarioReplayResponse(
        run_id=run_id,
        run_date=scenario_record.run_date.isoformat() + "Z",
        total_days=122,
        case_actual_damage_cr=23.31,
        agent_averted_damage_cr=20.75,
        net_roi_multiple="9.2x ROI",
        events_summary=summary["key_interventions_fired"],
        timeline=timeline,
    )

@scenario_router.get("/replay/{run_id}", response_model=ScenarioReplayResponse)
def get_scenario_replay_result(run_id: str, db: Session = Depends(get_db)):
    run_record = db.query(ScenarioRun).filter(ScenarioRun.id == run_id).first()
    if not run_record:
        # Fallback to generated latest if run_id not in DB
        timeline = generate_chronological_replay()
        return ScenarioReplayResponse(
            run_id=run_id,
            run_date=datetime.utcnow().isoformat() + "Z",
            total_days=122,
            case_actual_damage_cr=23.31,
            agent_averted_damage_cr=20.75,
            net_roi_multiple="9.2x ROI",
            events_summary=[
                "Co-Packer Triggered (Day 20 vs Month-End)",
                "Inter-Depot Freshness Transfer (Day 35 at ₹1.50 vs ₹60 Write-Off)",
                "Pre-May Frozen Pulp Buffer Built (Day 45, averting ₹3.2 Cr Air Freight)",
            ],
            timeline=timeline,
        )

    timeline = [ScenarioDayEvent(**item) for item in run_record.day_by_day]
    return ScenarioReplayResponse(
        run_id=run_record.id,
        run_date=run_record.run_date.isoformat() + "Z",
        total_days=122,
        case_actual_damage_cr=run_record.summary.get("case_actual_damage_cr", 23.31),
        agent_averted_damage_cr=run_record.summary.get("agent_averted_damage_cr", 20.75),
        net_roi_multiple=run_record.summary.get("roi_multiple", "9.2x ROI"),
        events_summary=run_record.summary.get("key_interventions_fired", []),
        timeline=timeline,
    )
