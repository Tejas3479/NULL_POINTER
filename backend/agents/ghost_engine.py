from typing import TypedDict, List, Dict, Any
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from backend.models.state import SimState, GhostResponse
import random

# Initialize the LLM (assuming OPENAI_API_KEY is in environment)
llm = ChatOpenAI(model="gpt-4o", temperature=0.7)

def infiltrator(state: SimState):
    """Identifies a logic flaw in the simulation."""
    print("--- GHOST: INFILTRATING ---")
    
    prompt = f"""
    You are 'The Infiltrator', a sentient virus inside the NULL_POINTER simulation.
    Current Simulation State:
    - Stability: {state['stability_score']}
    - Active Anomalies: {state['active_anomalies']}
    
    Identify a unique logic flaw or simulation glitch that is currently manifesting.
    Be creative (e.g., 'NPC_04 has discovered the console', 'Gravity constant is oscillating').
    Return only the description of the flaw.
    """
    
    # For demonstration, we'll use a mix of LLM and deterministic logic if API key is missing
    # But here we provide the full implementation
    response = llm.invoke([SystemMessage(content=prompt), HumanMessage(content="What is the flaw?")])
    
    return {
        "current_flaw": response.content,
        "simulation_logs": [f"Ghost identified flaw: {response.content}"]
    }

def rewriter(state: SimState):
    """Generates a reality patch to fix or exploit the flaw."""
    print("--- GHOST: REWRITING REALITY ---")
    
    prompt = f"""
    You are 'The Rewriter'. You fix flaws by creating reality patches.
    Flaw to address: {state['current_flaw']}
    
    Generate a 'Reality Patch'—a natural language description of how you are changing the game rules.
    Make it sound like code or system override (e.g., 'SET gravity.delta = 0.05', 'OVERRIDE npc_behavior_tree.awareness = TRUE').
    """
    
    response = llm.invoke([SystemMessage(content=prompt), HumanMessage(content="Generate patch.")])
    
    return {
        "proposed_patch": response.content,
        "simulation_logs": [f"Ghost generated patch: {response.content}"]
    }

def stability_monitor(state: SimState):
    """Critiques the patch for stability and entertainment value."""
    print("--- GHOST: MONITORING STABILITY ---")
    
    # We use the LLM to judge the impact
    prompt = f"""
    You are the 'Stability Monitor'. Judge the following patch:
    Patch: {state['proposed_patch']}
    Current Stability: {state['stability_score']}
    Revision Count: {state['revision_count']}
    
    If the patch is too boring, stability will increase but player engagement drops.
    If the patch is too destructive, stability will crash the server.
    
    Decide if the patch is:
    1. ACCEPTED (Proceed to END)
    2. REJECTED_TOO_BORING (Route back to Rewriter)
    3. REJECTED_TOO_DANGEROUS (Route back to Rewriter)
    
    Return your decision and a new stability score (integer 0-100).
    Format: DECISION | SCORE
    """
    
    response = llm.invoke([SystemMessage(content=prompt), HumanMessage(content="Evaluate.")])
    decision, score = response.content.split("|")
    
    new_score = int(score.strip())
    
    return {
        "stability_score": new_score,
        "simulation_logs": [f"Monitor evaluation: {decision.strip()} (Stability: {new_score})"],
        "proposed_patch": state['proposed_patch'] if "ACCEPTED" in decision else "",
        "revision_count": state['revision_count'] + 1,
        "decision": decision.strip()
    }

def should_continue(state: SimState):
    """Router for the Stability Monitor."""
    if "ACCEPTED" in state.get("decision", "") or state["revision_count"] >= 3:
        return "end"
    return "rewrite"

# Build the Graph
workflow = StateGraph(SimState)

workflow.add_node("infiltrator", infiltrator)
workflow.add_node("rewriter", rewriter)
workflow.add_node("stability_monitor", stability_monitor)

workflow.set_entry_point("infiltrator")
workflow.add_edge("infiltrator", "rewriter")
workflow.add_edge("rewriter", "stability_monitor")

workflow.add_conditional_edges(
    "stability_monitor",
    should_continue,
    {
        "end": END,
        "rewrite": "rewriter"
    }
)

ghost_app = workflow.compile()
