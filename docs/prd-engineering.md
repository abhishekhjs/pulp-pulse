# Project Resilient Pulp: Engineering PRD v1

### Build-ready specification for an autonomous coding agent (Antigravity)

- Product Name: Project Resilient Pulp, Supply Chain Intelligence Dashboard
- Version: 1.0 (Engineering)
- Status: Ready for build
- Companion Doc: Project Resilient Pulp, Refined PRD v2 (KPI Driven Multi Agent Dashboard), the business case, case math, and full 31 KPI definitions live there
- Audience: an AI coding agent scaffolding and building this system with minimal human clarification

## 1. Executive Summary

**Product overview:** A KPI driven, multi agent supply chain dashboard for a juice company (case name: Pulp Riot Juice Co.) that replaces monthly, siloed planning with continuous threshold monitoring, agent generated recommendations, and a tiered human approval workflow. Five domain agents (Demand, Supply, Inventory, Distribution, Transportation) plus an Approval Router evaluate 31 KPIs against thresholds derived from a real case, raise alerts with confidence scores, and route recommendations to the correctly sized human approver.

**Problem statement:** The underlying case company lost roughly 23.3 crore rupees in one summer to a missed demand spike and a predictable supply disruption, because no system watched the right numbers continuously or routed decisions to the right person fast enough. This build exists to prove, against a synthetic replay of that exact scenario, that a lightweight agent layer would have caught it in time.

**Success criteria for this build:** The prototype is considered done when, running the seeded scenario replay (section 11), it demonstrably fires the co-packer activation alert, the pre-May pulp build alert, and at least one inter depot transfer recommendation at or before the simulated dates on which the original case's losses began, with every alert routed through the correct approval tier.

## 2. Scope

**In scope for v1 (MVP):**

- Five domain agents plus Approval Router, implemented in LangGraph
- FastAPI REST and WebSocket service layer
- SQLite database (SQLAlchemy models, Postgres-portable)
- React and Tailwind frontend: KPI scorecard homepage, Alerts and Approvals view, Depot inventory view, Scenario Replay view
- Config driven KPI threshold table (31 rows), editable without a code change
- Synthetic data generator calibrated to the case's own ratios
- Scenario replay runner for the March spike and May closure sequence

**Out of scope for v1 (explicitly, do not build):**

- Real General Trade outlet POS integration (the case itself rules this out; GT is handled via proxy signals only, KPI B4)
- Production grade auth, SSO, or multi tenant support
- Cloud deployment infrastructure beyond a local or single container dev setup
- Live weather or traffic data feeds for route risk (F1 uses the case's own 5 year historical base rate, not a live feed)
- The weekly WhatsApp or email digest (flagged as Phase 2 stretch in the companion PRD's feature list; build the in app digest view only)

## 3. Tech Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Frontend | React 18 (Vite) + Tailwind CSS | Thin client only, no business logic. Charts via Recharts. |
| Backend API | FastAPI (Python 3.11+), Pydantic v2, Uvicorn | REST plus one WebSocket endpoint for live alert push |
| Agent orchestration | LangGraph (Python) | One stateful graph per domain agent category, event driven on relevant DB writes |
| Database | SQLite, accessed via SQLAlchemy ORM | No SQLite only features used, so a later move to Postgres is a connection string change only |
| Testing | pytest (backend), Vitest or Jest (frontend, optional for v1) | Prioritize backend agent logic tests over frontend tests for v1 |
