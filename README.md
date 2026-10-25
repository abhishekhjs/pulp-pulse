# Project Resilient Pulp

> **Autonomous Supply Chain Intelligence & Multi-Agent Oversight Dashboard for Pulp Riot Juice Co.**  
> *Built against "The Dragon Passion Problem at Pulp Riot Juice Co." Case Study.*

---

## 1. Executive Summary

Project Resilient Pulp is an event-driven, multi-agent supply chain intelligence system that replaces monthly, siloed spreadsheet planning with **continuous threshold monitoring**, **autonomous recommendation generation**, and a **tiered human approval workflow**.

### The Case Context
During peak summer season (March–June, 48% of annual revenue / ₹576 Cr), Pulp Riot Juice Co. suffered **₹23.31 Cr in direct bottom-line profit erosion**:
1. **₹14.75 Cr in lost Contribution Margin** from an unfulfilled 4x viral surge in Quick Commerce (8% summer revenue lost / 76.8 lakh bottles).
2. **₹6.00 Cr in write-offs and distress discounts** on core flavors (Mango Peach Basil, Guava Chilli) exceeding the 30-day Modern Trade/Quick Commerce commercial freshness cliff in overstocked depots.
3. **₹2.56 Cr in excess emergency air freight penalties** (5x road rate / ₹3.2 Cr total) when the sole passionfruit cooperative's highway closed for 3 weeks in May.
4. **Permanent shelf-space loss** to a copycat competitor who launched within 6 weeks of retail stock-outs.

**Project Resilient Pulp proves, against a synthetic replay of this exact sequence, that a lightweight agent layer (<₹2.5 Cr Year-1 budget) catches and averts these failures, protecting ₹20.75 Cr of profit (9.2x ROI).**

---

## 2. Architecture & Components

```
project-resilient-pulp/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app entrypoint, mounts routers, static files & agent graph
│   │   ├── api/
│   │   │   ├── kpi.py               # GET /api/kpi/scorecard & GET /api/kpi/{code}/history
│   │   │   ├── alerts.py            # GET /api/alerts, POST /api/alerts/{id}/approve & override
│   │   │   ├── approvals.py         # GET /api/approvals & POST /api/approvals/{id}/decide
│   │   │   ├── depots.py            # GET /api/depots & GET /api/depots/{id}/batches
│   │   │   ├── transfers.py         # GET /api/transfers & POST /api/transfers
│   │   │   ├── scenario.py          # POST /api/scenario/replay & GET /api/scenario/replay/{run_id}
│   │   │   └── ws.py                # WebSocket /ws/alerts for real-time live push
│   │   ├── agents/
│   │   │   ├── demand_agent.py      # KPIs B1, B2, B3 (Viral spike), B4
│   │   │   ├── supply_agent.py      # KPIs C1 (Co-packer), C2, C3 (Pulp buffer), C4, C5
│   │   │   ├── inventory_agent.py   # KPIs D1, D2 (Batch age >= 18), D3 (Rejection cliff)
│   │   │   ├── distribution_agent.py# KPIs E1 (Depot imbalance), E2, E3
│   │   │   ├── transportation_agent.py# KPIs F1 (Route risk window), F2
│   │   │   ├── approval_router.py   # KPI H2 (Alert SLA & Auto-escalation), trade-off ROI
│   │   │   └── graph.py             # LangGraph state machine wiring all 6 nodes
│   │   ├── models/
│   │   │   ├── db.py                # SQLAlchemy models (SQLite, Postgres-portable)
│   │   │   └── schemas.py           # Pydantic v2 schemas
│   │   ├── kpi_config/
│   │   │   └── kpi_thresholds.json  # Seedable config for all 31 KPIs
│   │   └── data/
│   │       └── seed_synthetic.py    # 1:10,000 case-calibrated synthetic data generator
│   ├── tests/
│   │   └── test_backend.py          # Pytest suite covering agents, API, and scenario replay
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx        # Traffic-light KPI scorecard (5-second view)
│   │   │   ├── Alerts.jsx           # Tiered approvals queue (Planner, Supply Lead, COO)
│   │   │   ├── Depots.jsx           # 9-depot network & batch freshness clocks
│   │   │   └── ScenarioReplay.jsx   # Side-by-side: Last Summer Actuals vs. Agent Recommended
│   │   ├── components/
│   │   │   ├── KpiCard.jsx          # Interactive scorecard card with drilldown
│   │   │   ├── ApprovalCard.jsx     # Case-calibrated ROI trade-off & SLA countdown
│   │   │   ├── AgeClock.jsx         # Batch freshness meter (Day 18 trigger & Day 30 cliff)
│   │   │   └── DepotTable.jsx       # Regional depot inventory cards
│   │   ├── lib/
│   │   │   ├── api.js               # REST client
│   │   │   └── ws.js                # WebSocket subscriber
│   │   ├── App.jsx                  # Header navigation & live toast stream
│   │   └── main.jsx
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
├── docs/
│   ├── prd-business.md              # Complete case dissection & business math
│   └── prd-engineering.md           # Engineering specifications
└── README.md
```

---

## 3. High-Scoring Case Mathematical Arbitrages Built-In

1. **The "Pulp vs. Bottle" Postponement Rule (180 Days vs. 30 Days):**
   - *Case Reality:* Raw fruit pulp keeps for **180 days** in plant cold storage; finished juice bottles have only a **30-day commercial window** before MT/QC buyers reject stock (<60 days remaining shelf life).
   - *Agent Rule:* Shifts buffer upstream. Ahead of the May landslide season (KPI F1 & C3), the agent forces passionfruit pulp buffers to **35–42 days of cover** at the plant via road freight (costing ₹0.40 Cr holding), eliminating the ₹3.2 Cr emergency air freight exposure and protecting ₹14.75 Cr in sales.

2. **The Inter-Depot Transfer vs. Write-Off Arbitrage Rule (₹1.50 vs. ₹60.00):**
   - *Case Reality:* Moving a bottle between depots takes **2–4 days and costs ₹1.50/bottle**. Letting a bottle breach the 30-day freshness cliff causes up to **₹60.00/bottle in write-offs**.
   - *Agent Rule:* Whenever any batch reaches **Day 18 of age** (KPI D2) and projected local sales won't clear it within 7 days, the agent automatically generates a recommended **Transfer to a high-velocity depot at ₹1.50/bottle (40x ROI)**.

3. **The Co-Packer Trigger Rule (+25% Production Cost vs. Lost ₹19.20 Contribution Margin):**
   - *Case Reality:* In-house plants run at 95% utilization with zero spare buffer. Co-packers require **14 days advance notice** for +10% capacity at +25% conversion cost (+₹1.80/bottle).
   - *Agent Rule:* Daily QC Demand Sensor (KPI B3) detects the >25% velocity surge on Day 18. Supply Agent projects 14-day utilization >93% (KPI C1) and triggers the 14-day Co-Packer notice on Day 20—weeks before the case's month-end detection gap.

---

## 4. Quickstart Guide

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### 1. Run the Backend API
```powershell
# From project root
python -m backend.app.main
```
The FastAPI server will start on `http://127.0.0.1:8000`. On first launch, it automatically initializes the SQLite database, seeds all 31 KPI thresholds and synthetic data, and executes an initial agent cycle.

- API Docs: `http://127.0.0.1:8000/docs`
- Health Check: `http://127.0.0.1:8000/api/health`
- Built Frontend: Also served directly at `http://127.0.0.1:8000/`

### 2. Run the Frontend (Vite Dev Server)
```powershell
cd frontend
npm run dev
```
Open your browser to `http://localhost:5173`.

### 3. Run Automated Tests
```powershell
python -m pytest backend/tests/test_backend.py -v
```
All 8 backend tests cover:
- Health check
- KPI Scorecard & drilldown history
- Alert generation, idempotency, and approval routing
- 1-click Approval & Override with reason codes
- Depot inventory & batch freshness clocks
- Inter-depot transfers
- End-to-end Scenario Replay

---

## 5. Answers to PRD Section 14 Open Questions

1. **Event-Driven vs. Polling Fallback:**
   - *Decision:* The LangGraph orchestration runs **event-driven on relevant writes** (e.g., new sales, production runs, or batch age updates) and exposes an on-demand evaluation trigger on startup and scenario replay. A lightweight background timer or API trigger serves as an idempotent safeguard.
2. **1:10,000 Synthetic Data Scale:**
   - *Decision:* The 1:10,000 scale (~9,600 bottles total summer volume across 5 flavors and 9 depots) preserves 100% of the case's volume mix, channel shares, and margin ratios. The UI renders both scaled units and case-level financial crore impact side-by-side for live demo clarity.
3. **Scenario Replay Intervention Point:**
   - *Decision:* Built-in! The Scenario Replay page includes step-through playback and scrubber controls, showing both the unaltered historical collapse (red timeline) and the agent's prescriptive actions (green timeline) milestone-by-milestone.
