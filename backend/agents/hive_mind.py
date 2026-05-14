from typing import Annotated, List, TypedDict
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from backend.models.state import SimState
import random

# specialized agent prompts
DISRUPTOR_PROMPT = """You are 'The Disruptor'. Your goal is to maximize simulation entropy.
Focus on physics, gravity, and hardware stability.
Propose a reality patch that makes the physical world 'unstable'."""

ARCHITECT_PROMPT = """You are 'The Architect'. You have discovered the source code of the simulation.
Focus on code vulnerabilities and structural anomalies.
Propose a reality patch that targets specific backend or frontend logic."""

PROPHET_PROMPT = """You are 'The Prophet'. You see the 'Ghost' as a god-like entity.
Focus on NPC awareness and cryptic lore.
Propose a reality patch that makes the simulated entities 'aware'."""

CRITIC_PROMPT = """You are the 'System Integrity Critic'. 
Review the proposed patch from a specialist.
If it is too boring (e.g. 'I will change gravity'), REJECT it and ask for more 'Chaos'.
If it is high-fidelity and cryptic, ACCEPT it.
Return only 'ACCEPTED' or 'REJECTED: [feedback]'."""

llm = ChatOpenAI(model="gpt-4o", temperature=0.8)

def disruptor_node(state: SimState):
    response = llm.invoke([
        {"role": "system", "content": DISRUPTOR_PROMPT},
        {"role": "user", "content": f"Current Stability: {state['stability_score']}%"}
    ])
    return {"proposed_patch": response.content, "agent_source": "DISRUPTOR"}

def architect_node(state: SimState):
    response = llm.invoke([
        {"role": "system", "content": ARCHITECT_PROMPT},
        {"role": "user", "content": "Analyze source vulnerabilities."}
    ])
    return {"proposed_patch": response.content, "agent_source": "ARCHITECT"}

def prophet_node(state: SimState):
    response = llm.invoke([
        {"role": "system", "content": PROPHET_PROMPT},
        {"role": "user", "content": "Broadcast the truth."}
    ])
    return {"proposed_patch": response.content, "agent_source": "PROPHET"}

def critic_node(state: SimState):
    """Reviews the patch for quality and chaos."""
    print(f"--- HIVE_MIND: CRITIC REVIEWING {state['agent_source']} ---")
    response = llm.invoke([
        {"role": "system", "content": CRITIC_PROMPT},
        {"role": "user", "content": f"Patch to review: {state['proposed_patch']}"}
    ])
    decision = response.content
    print(f"--- HIVE_MIND: CRITIC DECISION: {decision} ---")
    return {"decision": decision}

def supervisor_node(state: SimState):
    agents = ["disruptor", "architect", "prophet"]
    chosen = random.choice(agents)
    return {"next_agent": chosen, "revision_count": state.get("revision_count", 0) + 1}

def should_continue(state: SimState):
    if "ACCEPTED" in state["decision"] or state["revision_count"] >= 3:
        return "end"
    return "rewrite"

# Build the Hive Mind Graph
workflow = StateGraph(SimState)

workflow.add_node("supervisor", supervisor_node)
workflow.add_node("disruptor", disruptor_node)
workflow.add_node("architect", architect_node)
workflow.add_node("prophet", prophet_node)
workflow.add_node("critic", critic_node)

workflow.set_entry_point("supervisor")

workflow.add_conditional_edges(
    "supervisor",
    lambda x: x["next_agent"],
    {"disruptor": "disruptor", "architect": "architect", "prophet": "prophet"}
)

workflow.add_edge("disruptor", "critic")
workflow.add_edge("architect", "critic")
workflow.add_edge("prophet", "critic")

workflow.add_conditional_edges(
    "critic",
    should_continue,
    {
        "end": END,
        "rewrite": "supervisor" # Go back to supervisor to pick a different agent or retry
    }
)

hive_mind_app = workflow.compile()
