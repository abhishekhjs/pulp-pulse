from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from backend.app.models.db import Alert, Approval, KpiThreshold

def get_roi_trade_off(kpi_code: str, alert: Optional[Alert] = None) -> Dict[str, str]:
    """
    Returns case-calibrated trade-off ROI details formatted for the Approval Card.
    """
    trade_offs = {
        "D2": {
            "action_cost_text": "₹1.50 / bottle transfer",
            "prevented_loss_text": "₹60.00 / bottle write-off",
            "roi_multiple": "40x ROI",
            "detail": "Moving aging batch to high-velocity depot clears stock before day 30 Modern Trade & Quick Commerce rejection cliff.",
        },
        "C1": {
            "action_cost_text": "+25% conversion cost (₹1.80/bottle)",
            "prevented_loss_text": "₹19.20/bottle Contribution Margin",
            "roi_multiple": "10.6x ROI",
            "detail": "Activating co-packer with 14-day advance notice protects summer volume and halts shelf-space loss to copycat rivals.",
        },
        "C3": {
            "action_cost_text": "₹0.40 Cr cold buffer holding",
            "prevented_loss_text": "₹3.20 Cr air freight + ₹14.75 Cr lost CM",
            "roi_multiple": "9.0x ROI",
            "detail": "Frozen pulp holds for 180 days in plant cold storage. Forward-building 5 weeks of buffer eliminates single-route highway closure risk.",
        },
        "F1": {
            "action_cost_text": "Forward road dispatch (1.0x cost)",
            "prevented_loss_text": "5.0x emergency air freight penalty",
            "roi_multiple": "5.0x ROI",
            "detail": "Inbound highway route closed 3 of past 5 summers (60% probability). Pre-monsoon build secures passionfruit flow before May landslides.",
        },
        "B3": {
            "action_cost_text": "Zero incremental cost (daily automated ingest)",
            "prevented_loss_text": "₹46.08 Cr top-line stock-out loss",
            "roi_multiple": "Infinite ROI",
            "detail": "Piping daily QC sell-through signals directly into supply planning eliminates the 2-week blind spot that caused last summer's collapse.",
        },
        "C4": {
            "action_cost_text": "Qualify secondary supplier (₹145/kg)",
            "prevented_loss_text": "₹161.28 Cr single-source revenue exposure",
            "roi_multiple": "High Strategic ROI",
            "detail": "Dual-sourcing removes catastrophic dependency on single hill cooperative for 28% of summer portfolio volume.",
        },
        "E1": {
            "action_cost_text": "₹1.50 / bottle rebalancing",
            "prevented_loss_text": "Censored demand & deadstock write-offs",
            "roi_multiple": "25x ROI",
            "detail": "Cross-depot dynamic rebalancing prevents simultaneous stock-outs in growth hubs and aging write-offs in slow hubs.",
        },
        "dmac_recalibration": {
            "action_cost_text": "Zero capital cost (governance threshold update)",
            "prevented_loss_text": "Eliminates false-positive expedited transfer overhead",
            "roi_multiple": "High Governance ROI",
            "detail": "Recalibrates trigger threshold based on historical override rates to eliminate false alarms while guaranteeing zero rejection cliff breaches.",
        },
    }

    return trade_offs.get(kpi_code, {
        "action_cost_text": "Standard operational reallocation",
        "prevented_loss_text": "Stockout & service level penalty",
        "roi_multiple": "Positive ROI",
        "detail": "Autonomous agent recommendation aligned to operational resilience benchmarks.",
    })

def route_and_enforce_approvals(db: Session) -> List[Dict[str, Any]]:
    """
    Routes unrouted alerts to approvals table with correct tier and SLA.
    Enforces SLA deadlines (KPI H2) and auto-escalates on breach.
    """
    routed_count = 0
    escalated_count = 0

    # 1. Fetch threshold tiers
    thresholds = {t.kpi_code: t for t in db.query(KpiThreshold).all()}

    # Tier SLA mappings
    sla_map = {
        "planner": 4,      # 4 hours
        "supply_lead": 12, # 12 hours
        "coo": 24,         # 24 hours
        "ops": 24,
    }

    # 2. Find alerts that do not have an approval record yet
    unrouted_alerts = db.query(Alert).filter(~Alert.approvals.any()).all()

    for alert in unrouted_alerts:
        thresh = thresholds.get(alert.kpi_code)
        tier = thresh.approval_tier if thresh else "supply_lead"
        if tier not in sla_map:
            tier = "supply_lead"

        sla_hours = sla_map[tier]
        deadline = alert.triggered_at + timedelta(hours=sla_hours)

        approval = Approval(
            alert_id=alert.id,
            tier=tier,
            status="pending",
            sla_hours=sla_hours,
            sla_deadline=deadline,
            created_at=alert.triggered_at,
        )
        db.add(approval)
        routed_count += 1
    db.commit()

    # 3. Enforce SLA deadline breaches (KPI H2: Auto-escalate one tier)
    now = datetime.utcnow()
    pending_approvals = db.query(Approval).filter(
        Approval.status == "pending",
        Approval.sla_deadline < now,
    ).all()

    for app in pending_approvals:
        old_tier = app.tier
        new_tier = old_tier
        if old_tier == "planner":
            new_tier = "supply_lead"
        elif old_tier == "supply_lead":
            new_tier = "coo"

        if new_tier != old_tier:
            app.tier = new_tier
            # Extend deadline for escalated tier
            app.sla_deadline = now + timedelta(hours=sla_map.get(new_tier, 12))
            app.note = f"Auto-escalated from {old_tier} to {new_tier} due to SLA breach (KPI H2)."
            escalated_count += 1

    db.commit()
    return [{"routed": routed_count, "escalated": escalated_count}]
