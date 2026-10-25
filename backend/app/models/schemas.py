from datetime import datetime, date
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field

# KPI Schemas
class KpiCardItem(BaseModel):
    kpi_code: str
    name: str
    category: str
    value: float
    unit: str = ""
    status: str  # ok, warning, breach
    trigger_value: float
    target: str
    baseline: str
    approval_tier: str
    linkage: List[str] = []
    caption: Optional[str] = ""
    sentiment_badge: Optional[Dict[str, Any]] = None
    trend_points: Optional[List[float]] = None

class KpiScorecardResponse(BaseModel):
    generated_at: str
    cards: List[KpiCardItem]
    rollups: Optional[Dict[str, Any]] = None

class KpiHistoryPoint(BaseModel):
    date: str
    value: float
    target: Optional[float] = None
    threshold: Optional[float] = None

class KpiHistoryResponse(BaseModel):
    kpi_code: str
    name: str
    category: str
    current_value: float
    history: List[KpiHistoryPoint]
    dynamic_insight: Optional[Dict[str, str]] = None

# Alert & Approval Schemas
class ApprovalInfo(BaseModel):
    id: int
    tier: str
    status: str
    sla_hours: int
    sla_deadline: str
    created_at: str
    decided_at: Optional[str] = None
    decided_by: Optional[str] = None
    note: Optional[str] = None

class RoiTradeOff(BaseModel):
    action_cost_text: str
    prevented_loss_text: str
    roi_multiple: str
    detail: str

class AlertItem(BaseModel):
    id: int
    kpi_code: str
    severity: str
    message: str
    confidence_pct: float
    linked_entity_type: str
    linked_entity_id: Optional[int] = None
    status: str
    triggered_at: str
    approval: Optional[ApprovalInfo] = None
    roi_trade_off: Optional[RoiTradeOff] = None

class ApproveAlertRequest(BaseModel):
    approver: str = "planner_1"
    note: Optional[str] = None

class OverrideAlertRequest(BaseModel):
    user: str = "planner_1"
    reason_code: str  # data_wrong, already_handled, context_missing, other
    note: Optional[str] = None

class ApprovalActionResponse(BaseModel):
    id: int
    alert_id: int
    status: str
    decided_at: str
    decided_by: str
    note: Optional[str] = None

# Depot & Batch Schemas
class FlavorCover(BaseModel):
    flavor_id: int
    flavor_name: str
    total_stock: int
    daily_run_rate: float
    cover_days: float
    status: str  # healthy, low, excessive, critical

class DepotSummary(BaseModel):
    id: int
    name: str
    region: str
    total_bottles: int
    flavors: List[FlavorCover]
    batches_count: int
    at_risk_count: int

class BatchItem(BaseModel):
    id: int
    flavor_id: int
    flavor_name: str
    depot_id: int
    depot_name: str
    bottled_date: str
    quantity: int
    age_days: int
    days_to_transfer: int  # max(0, 18 - age_days)
    days_to_cliff: int     # max(0, 30 - age_days)
    status: str            # fresh, at_risk, rejected, written_off

class CreateTransferRequest(BaseModel):
    batch_id: Optional[int] = None
    flavor_id: Optional[int] = None
    from_depot_id: int
    to_depot_id: int
    quantity: int
    cost_per_bottle: float = 1.50
    alert_id: Optional[int] = None
    reason: Optional[str] = None

class TransferResponse(BaseModel):
    id: int
    batch_id: Optional[int] = None
    flavor_name: Optional[str] = None
    from_depot: str
    to_depot: str
    quantity: int
    cost_per_bottle: float
    total_cost: float
    net_benefit: Optional[float] = None
    reason: Optional[str] = None
    status: str
    created_at: str

# Depot Demand & Redistribution Schemas
class SegmentDemandPoint(BaseModel):
    segment: str
    distributor_name: str
    historical_daily_avg: float
    forecast_7d: int
    forecast_14d: int
    share_pct: float

class DepotFlavorForecast(BaseModel):
    depot_id: int
    depot_name: str
    region: str
    flavor_id: int
    flavor_name: str
    on_hand_stock: int
    daily_run_rate: float
    days_of_cover: float
    status: str  # surge_deficit, surplus_stagnant, healthy
    historical_dates: List[str]
    historical_units: List[int]
    forecast_dates: List[str]
    forecast_p10: List[int]
    forecast_p50: List[int]
    forecast_p90: List[int]
    segments: List[SegmentDemandPoint]

class RedistributionOpportunity(BaseModel):
    id: str
    flavor_id: int
    flavor_name: str
    deficit_depot_id: int
    deficit_depot_name: str
    deficit_cover_days: float
    deficit_daily_rate: float
    surplus_depot_id: int
    surplus_depot_name: str
    surplus_cover_days: float
    surplus_batch_id: Optional[int] = None
    surplus_batch_age: int
    buffer_bottles: int
    corridor_name: str
    distance_km: int
    transit_hours: float
    compatibility_score: float
    cost_per_bottle: float = 1.50
    total_redistribution_cost: float
    prevented_writeoff_loss: float
    prevented_distress_discount_loss: float
    protected_contribution_margin: float
    net_economic_benefit: float
    roi_multiple: float
    is_financially_viable: bool
    recommendation_reason: str
    transfer_id: Optional[int] = None
    alert_id: Optional[int] = None
    approval_id: Optional[int] = None
    status: str = "recommended"

# Scenario Replay Schemas
class ScenarioDayEvent(BaseModel):
    day: int
    date: str
    case_actual_event: str
    case_actual_financial_impact: str
    agent_flag: Optional[str] = None
    agent_action_recommended: Optional[str] = None
    approval_tier: Optional[str] = None
    prevention_saving: Optional[str] = None
    status: str  # normal, alert_fired, intervention_active, disaster_diverted

class ScenarioReplayResponse(BaseModel):
    run_id: str
    run_date: str
    total_days: int
    case_actual_damage_cr: float  # 23.31 Cr
    agent_averted_damage_cr: float
    net_roi_multiple: str
    events_summary: List[str]
    timeline: List[ScenarioDayEvent]

# Scan Ingestion Schemas
class ScanEventCreate(BaseModel):
    parcel_code: str
    from_node_type: str  # factory, depot, distributor
    from_node_id: int
    to_node_type: str    # depot, distributor, retailer
    to_node_id: int
    flavor_id: int
    quantity: int
    batch_id: Optional[int] = None
    channel: Optional[str] = "MT"

class ScanEventResponse(BaseModel):
    scan_id: int
    parcel_code: str
    from_node: str
    to_node: str
    flavor_id: int
    quantity: int
    batch_id: Optional[int] = None
    batch_status: Optional[str] = None
    batch_quantity: Optional[int] = None
    units_sold_updated: Optional[int] = None
    scanned_at: str
    message: str
