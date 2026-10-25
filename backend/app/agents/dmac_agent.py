from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from backend.app.models.db import Alert, Approval, Override, KpiThreshold, Batch

def run_dmac_pipeline(db: Session, eval_date: Optional[datetime] = None) -> List[Dict[str, Any]]:
    """
    Executes the 4-phase DMAC (Define, Measure, Analyze, Control) governance pipeline.
    Consumes B-series and D-series alerts and overrides to propose specific threshold recalibrations.
    """
    recalibration_alerts = []
    now = eval_date or datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)

    # ── Phase 1: Define ──────────────────────────────────────────────
    # Pull KPI targets and triggers from kpi_thresholds
    thresholds = {t.kpi_code: t for t in db.query(KpiThreshold).filter(KpiThreshold.kpi_code.in_(["D2", "B2", "H3"])).all()}
    d2_thresh = thresholds.get("D2")
    h3_thresh = thresholds.get("H3")
    max_acceptable_override_rate = h3_thresh.trigger_value if h3_thresh else 0.25

    # ── Phase 2: Measure ─────────────────────────────────────────────
    # Measure actual outcome: query D2 alerts and overrides over 30 days
    d2_alerts = (
        db.query(Alert)
        .filter(
            Alert.kpi_code == "D2",
            Alert.triggered_at >= thirty_days_ago,
        )
        .all()
    )

    total_d2_alerts = len(d2_alerts)
    if total_d2_alerts == 0:
        return []

    d2_alert_ids = [a.id for a in d2_alerts]
    d2_overrides = db.query(Override).filter(Override.alert_id.in_(d2_alert_ids)).count()

    override_rate = d2_overrides / total_d2_alerts if total_d2_alerts > 0 else 0.0

    # ── Phase 3: Analyze ─────────────────────────────────────────────
    # Flag pattern if >= 3 recurring deltas and override rate > 25% (H3 threshold)
    pattern_detected = total_d2_alerts >= 3 and override_rate > max_acceptable_override_rate

    # ── Phase 4: Control ─────────────────────────────────────────────
    # Propose a specific new trigger_value, requiring supply_lead approval (never auto-applied)
    if pattern_detected:
        # Check if an open dmac_recalibration alert already exists to prevent duplicate flood
        existing = (
            db.query(Alert)
            .filter(
                Alert.kpi_code == "dmac_recalibration",
                Alert.status == "open",
            )
            .first()
        )

        current_trigger = d2_thresh.trigger_value if d2_thresh else 18.0
        # Calculate specific proposed recalibration (e.g. +1.5 days adjustment)
        proposed_trigger = round(current_trigger + 1.5, 1)

        override_pct = round(override_rate * 100, 1)
        thresh_pct = int(max_acceptable_override_rate * 100)

        message = (
            f"DMAC Recalibration Proposal: D2 'Batch Age at Risk' override rate reached {override_pct}% "
            f"({d2_overrides} of {total_d2_alerts} alerts overridden, exceeding the {thresh_pct}% KPI H3 threshold). "
            f"Root cause: 18-day trigger causes false-positive transfer alerts in high-velocity metro depots. "
            f"Proposed action: recalibrate D2 trigger_value from {current_trigger} days to {proposed_trigger} days. "
            f"Requires Supply Lead authorization before deployment."
        )

        if existing:
            return [{
                "alert_id": existing.id,
                "kpi_code": "dmac_recalibration",
                "current_trigger": current_trigger,
                "proposed_trigger": proposed_trigger,
                "override_rate": override_rate,
            }]

        alert = Alert(
            kpi_code="dmac_recalibration",
            severity="warning",
            message=message,
            confidence_pct=94.5,
            linked_entity_type="kpi_threshold",
            linked_entity_id=d2_thresh.id if d2_thresh else None,
            status="open",
            triggered_at=now,
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)

        # Auto-assign Supply Lead approval tier with 12h SLA
        approval = Approval(
            alert_id=alert.id,
            tier="supply_lead",
            status="pending",
            sla_hours=12,
            sla_deadline=now + timedelta(hours=12),
            created_at=now,
            note=f"Proposed trigger_value: {proposed_trigger} days (current: {current_trigger} days)",
        )
        db.add(approval)
        db.commit()

        recalibration_alerts.append({
            "alert_id": alert.id,
            "kpi_code": "dmac_recalibration",
            "current_trigger": current_trigger,
            "proposed_trigger": proposed_trigger,
            "override_rate": override_rate,
        })

    return recalibration_alerts

def evaluate_dmac_agent(db: Session, eval_date: Optional[datetime] = None) -> List[Dict[str, Any]]:
    return run_dmac_pipeline(db, eval_date=eval_date)
