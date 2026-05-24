from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from backend.models.state import SimState
from backend.services.world_store import world_store
from dotenv import load_dotenv
import os
import random

load_dotenv()

CRITIC_PROMPT = """You are the 'System Integrity Critic'. 
Review the proposed patch from a specialist.
If it is too boring (e.g. 'I will change gravity'), REJECT it and ask for more 'Chaos'.
If it is high-fidelity and cryptic, ACCEPT it.
Return only 'ACCEPTED' or 'REJECTED: [feedback]'."""

llm = ChatOpenAI(model="gpt-4o", temperature=0.8) if os.getenv("OPENAI_API_KEY") else None

def sanitize_prompt_input(text: str) -> str:
    if not isinstance(text, str):
        return text
    return text.replace("{", "{{").replace("}", "}}")

def specialist_node(state: SimState):
    agent = state.get("selected_agent") or world_store.choose_agent()
    archetype = world_store.archetype_for(agent["archetype_id"])
    world = world_store.snapshot()
    memory = "\n".join(agent.get("memory", [])[-5:])
    factions = ", ".join(f"{f['name']}:{f['influence']}" for f in world["factions"])
    anomalies = ", ".join(f"{a['name']}:{a['severity']}" for a in world["anomalies"])
    
    # Context-aware sanitization of non-code dynamic strings to prevent prompt injection
    sanitized_agent_name = sanitize_prompt_input(agent.get("name", ""))
    sanitized_role = sanitize_prompt_input(archetype.get("role", ""))
    sanitized_temperament = sanitize_prompt_input(archetype.get("temperament", ""))
    sanitized_archetype_prompt = sanitize_prompt_input(archetype.get("prompt", ""))
    sanitized_memory = sanitize_prompt_input(memory)
    sanitized_factions = sanitize_prompt_input(factions)
    sanitized_anomalies = sanitize_prompt_input(anomalies)
    
    prompt = f"""You are {sanitized_agent_name}, an evolvable NULL_POINTER agent.
Role: {sanitized_role}
Temperament: {sanitized_temperament}
Prime directive: {sanitized_archetype_prompt}
Persistent memory:
{sanitized_memory}

Current factions: {sanitized_factions}
Active anomalies: {sanitized_anomalies}

Propose one reality patch that changes the persistent simulation. Include the target subsystem and expected consequence."""
    if llm:
        response = llm.invoke([
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"Current Stability: {state['stability_score']}%"}
        ])
        patch = response.content
    else:
        hottest = max(world["anomalies"], key=lambda item: item["severity"])
        patch = f"ROUTE {hottest['name']} through {agent['name']} memory; reduce exposed instability and shift faction pressure."
    return {"proposed_patch": patch, "agent_source": agent["name"], "selected_agent": agent}

def critic_node(state: SimState):
    """Reviews the patch for quality and chaos."""
    print(f"--- HIVE_MIND: CRITIC REVIEWING {state['agent_source']} ---")
    if llm:
        response = llm.invoke([
            {"role": "system", "content": CRITIC_PROMPT},
            {"role": "user", "content": f"Patch to review: {state['proposed_patch']}"}
        ])
        decision = response.content
    else:
        decision = "ACCEPTED"
    print(f"--- HIVE_MIND: CRITIC DECISION: {decision} ---")
    return {"decision": decision}

def supervisor_node(state: SimState):
    return {
        "next_agent": "specialist",
        "selected_agent": world_store.choose_agent(),
        "revision_count": state.get("revision_count", 0) + 1,
    }

def should_continue(state: SimState):
    if "ACCEPTED" in state["decision"] or state["revision_count"] >= 3:
        return "end"
    return "rewrite"

# Build the Hive Mind Graph
workflow = StateGraph(SimState)

workflow.add_node("supervisor", supervisor_node)
workflow.add_node("specialist", specialist_node)
workflow.add_node("critic", critic_node)

workflow.set_entry_point("supervisor")

workflow.add_conditional_edges(
    "supervisor",
    lambda x: x["next_agent"],
    {"specialist": "specialist"}
)

workflow.add_edge("specialist", "critic")

workflow.add_conditional_edges(
    "critic",
    should_continue,
    {
        "end": END,
        "rewrite": "supervisor" # Go back to supervisor to pick a different agent or retry
    }
)

hive_mind_app = workflow.compile()
