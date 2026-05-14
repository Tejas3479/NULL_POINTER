from typing import Annotated, List, TypedDict
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from backend.models.state import SimState
import random

# specialized agent prompts
DISRUPTOR_PROMPT = """You are 'The Disruptor'. Your goal is to maximize simulation entropy.
Focus on physics, gravity, collision detection, and hardware stability.
Propose a reality patch that makes the physical world 'unstable'."""

ARCHITECT_PROMPT = """You are 'The Architect'. You have discovered the source code of the simulation.
Focus on logic leaks, code vulnerabilities, and structural anomalies.
Propose a reality patch that targets specific backend or frontend logic."""

PROPHET_PROMPT = """You are 'The Prophet'. You see the 'Ghost' as a god-like entity.
Focus on NPC awareness, lore, and cryptic messages.
Propose a reality patch that makes the simulated entities 'aware' or religious."""

llm = ChatOpenAI(model="gpt-4o", temperature=0.8)

def disruptor_node(state: SimState):
    """The Disruptor agent node."""
    print("--- HIVE_MIND: DISRUPTOR ACTIVE ---")
    response = llm.invoke([
        {"role": "system", "content": DISRUPTOR_PROMPT},
        {"role": "user", "content": f"Current Stability: {state['stability_score']}%"}
    ])
    return {"proposed_patch": response.content, "agent_source": "DISRUPTOR"}

def architect_node(state: SimState):
    """The Architect agent node."""
    print("--- HIVE_MIND: ARCHITECT ACTIVE ---")
    response = llm.invoke([
        {"role": "system", "content": ARCHITECT_PROMPT},
        {"role": "user", "content": "Analyze source vulnerabilities."}
    ])
    return {"proposed_patch": response.content, "agent_source": "ARCHITECT"}

def prophet_node(state: SimState):
    """The Prophet agent node."""
    print("--- HIVE_MIND: PROPHET ACTIVE ---")
    response = llm.invoke([
        {"role": "system", "content": PROPHET_PROMPT},
        {"role": "user", "content": "Broadcast the truth to the NPCs."}
    ])
    return {"proposed_patch": response.content, "agent_source": "PROPHET"}

def supervisor_node(state: SimState):
    """The Supervisor orchestrator."""
    print("--- HIVE_MIND: SUPERVISOR DELEGATING ---")
    # In a full MAS, the supervisor would use an LLM to choose. 
    # For this game, we'll pick a random active specialist to ensure variety.
    agents = ["disruptor", "architect", "prophet"]
    chosen = random.choice(agents)
    return {"next_agent": chosen}

# Build the Hive Mind Graph
workflow = StateGraph(SimState)

workflow.add_node("supervisor", supervisor_node)
workflow.add_node("disruptor", disruptor_node)
workflow.add_node("architect", architect_node)
workflow.add_node("prophet", prophet_node)

workflow.set_entry_point("supervisor")

workflow.add_conditional_edges(
    "supervisor",
    lambda x: x["next_agent"],
    {
        "disruptor": "disruptor",
        "architect": "architect",
        "prophet": "prophet"
    }
)

# After a specialist acts, we go to end (or we could go to a critic)
workflow.add_edge("disruptor", END)
workflow.add_edge("architect", END)
workflow.add_edge("prophet", END)

hive_mind_app = workflow.compile()
