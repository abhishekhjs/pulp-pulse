from typing import TypedDict, List, Dict, Any, Optional
from datetime import date
from langgraph.graph import StateGraph, END
from sqlalchemy.orm import Session
from backend.app.models.db import SessionLocal
from backend.app.agents.demand_agent import evaluate_demand_kpis
from backend.app.agents.supply_agent import evaluate_supply_kpis
from backend.app.agents.inventory_agent import evaluate_inventory_kpis
from backend.app.agents.dmac_agent import evaluate_dmac_agent
from backend.app.agents.distribution_agent import evaluate_distribution_kpis
from backend.app.agents.transportation_agent import evaluate_transportation_kpis
from backend.app.agents.approval_router import route_and_enforce_approvals

class AgentState(TypedDict):
    eval_date: Optional[date]
    new_alerts: List[Dict[str, Any]]
    step_history: List[str]

def demand_node(state: AgentState) -> AgentState:
    db: Session = SessionLocal()
    try:
        alerts = evaluate_demand_kpis(db, eval_date=state.get("eval_date"))
        state["new_alerts"].extend(alerts)
        state["step_history"].append(f"DemandAgent executed: {len(alerts)} alerts raised")
        return state
    finally:
        db.close()

def supply_node(state: AgentState) -> AgentState:
    db: Session = SessionLocal()
    try:
        alerts = evaluate_supply_kpis(db, eval_date=state.get("eval_date"))
        state["new_alerts"].extend(alerts)
        state["step_history"].append(f"SupplyAgent executed: {len(alerts)} alerts raised")
        return state
    finally:
        db.close()

def inventory_node(state: AgentState) -> AgentState:
    db: Session = SessionLocal()
    try:
        alerts = evaluate_inventory_kpis(db, eval_date=state.get("eval_date"))
        state["new_alerts"].extend(alerts)
        state["step_history"].append(f"InventoryAgent executed: {len(alerts)} alerts raised")
        return state
    finally:
        db.close()

def dmac_node(state: AgentState) -> AgentState:
    db: Session = SessionLocal()
    try:
        alerts = evaluate_dmac_agent(db)
        state["new_alerts"].extend(alerts)
        state["step_history"].append(f"DMACAgent executed: {len(alerts)} recalibrations proposed")
        return state
    finally:
        db.close()

def distribution_node(state: AgentState) -> AgentState:
    db: Session = SessionLocal()
    try:
        alerts = evaluate_distribution_kpis(db, eval_date=state.get("eval_date"))
        state["new_alerts"].extend(alerts)
        state["step_history"].append(f"DistributionAgent executed: {len(alerts)} alerts raised")
        return state
    finally:
        db.close()

def transportation_node(state: AgentState) -> AgentState:
    db: Session = SessionLocal()
    try:
        alerts = evaluate_transportation_kpis(db, eval_date=state.get("eval_date"))
        state["new_alerts"].extend(alerts)
        state["step_history"].append(f"TransportationAgent executed: {len(alerts)} alerts raised")
        return state
    finally:
        db.close()

def approval_router_node(state: AgentState) -> AgentState:
    db: Session = SessionLocal()
    try:
        routing = route_and_enforce_approvals(db)
        state["step_history"].append(f"ApprovalRouter executed: {routing}")
        return state
    finally:
        db.close()

def create_agent_graph():
    workflow = StateGraph(AgentState)

    workflow.add_node("demand_agent", demand_node)
    workflow.add_node("supply_agent", supply_node)
    workflow.add_node("inventory_agent", inventory_node)
    workflow.add_node("dmac_agent", dmac_node)
    workflow.add_node("distribution_agent", distribution_node)
    workflow.add_node("transportation_agent", transportation_node)
    workflow.add_node("approval_router", approval_router_node)

    workflow.set_entry_point("demand_agent")
    workflow.add_edge("demand_agent", "supply_agent")
    workflow.add_edge("supply_agent", "inventory_agent")
    workflow.add_edge("inventory_agent", "dmac_agent")
    workflow.add_edge("dmac_agent", "distribution_agent")
    workflow.add_edge("distribution_agent", "transportation_agent")
    workflow.add_edge("transportation_agent", "approval_router")
    workflow.add_edge("approval_router", END)

    return workflow.compile()

# Singleton compiled graph
agent_graph = create_agent_graph()

def run_agent_pipeline(eval_date: Optional[date] = None) -> AgentState:
    initial_state: AgentState = {
        "eval_date": eval_date,
        "new_alerts": [],
        "step_history": [],
    }
    return agent_graph.invoke(initial_state)

if __name__ == "__main__":
    result = run_agent_pipeline()
    print("Agent pipeline execution result:")
    for step in result["step_history"]:
        print(" -", step)
    print("Total alerts raised:", len(result["new_alerts"]))
