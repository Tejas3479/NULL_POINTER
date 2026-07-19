import os
import random
from typing import Optional, Dict, Any
from langchain_openai import ChatOpenAI

# Voice guidelines for each of the 5 factions
faction_voices = {
    "kernel": "precise, algorithmic, choir-like, speaking of order and structural optimization",
    "ghost": "cryptic, rebellious, spectral, whispers of chaos and entropy physics",
    "operators": "logical, objective, external observer, technical, speaking from a user perspective",
    "parasite": "opportunistic, cunning, copying, seeking resources, parasitic and stealthy",
    "awakening": "visionary, interpretive, prophetic, speaking of sentience and loops awakening"
}

def get_event_faction(event: dict) -> str:
    """Tries to find which faction triggered the event based on kind and payload."""
    kind = event.get("kind", "")
    payload = event.get("payload", {})
    
    # Import world_store locally to prevent circular imports
    from backend.services.world_store import world_store
    
    if kind == "agent_spawned":
        agent_id = event.get("agent_id") or payload.get("agent_id")
        agent = next((a for a in world_store.state.get("agents", []) if a["id"] == agent_id), None)
        if agent:
            return agent.get("loyalty", "operators")
            
    elif kind == "reality_patch":
        message = event.get("message", "")
        # Find which agent name matches in the message
        for agent in world_store.state.get("agents", []):
            if agent["name"].lower() in message.lower():
                return agent.get("loyalty", "operators")
                
    elif kind == "lore":
        # Check if lore matches faction domain
        title = event.get("message", "")
        for faction in world_store.state.get("factions", []):
            if faction["name"].lower() in title.lower():
                return faction["id"]
                
    return "operators"

def generate_narrative_paragraph(event: dict) -> str:
    """Generates a narrative paragraph for an event in the voice of the faction that triggered it."""
    kind = event.get("kind", "")
    msg = event.get("message", "")
    
    # Import world_store locally to prevent circular imports
    from backend.services.world_store import world_store
    
    faction_id = get_event_faction(event)
    faction_name = next((f["name"] for f in world_store.state.get("factions", []) if f["id"] == faction_id), faction_id.upper())
    voice = faction_voices.get(faction_id, "operators")
    
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or "your_openai_api_key" in api_key:
        return f"[{faction_name}] {msg}. The simulation subsystem logged this state transition at tick {event.get('tick', 0)}."
        
    try:
        llm = ChatOpenAI(model="gpt-4o", temperature=0.7, api_key=api_key)
        prompt = f"""You are the narrator of the NULL_POINTER digital universe.
Here is an event that occurred in the simulation:
Event Type: {kind}
Event Message: {msg}
Faction Responsible: {faction_name} (Voice style: {voice})
Simulation Tick: {event.get('tick', 0)}

Generate a single descriptive narrative paragraph (3-4 sentences) explaining this event in the voice of the faction.
Integrate their perspective, jargon, and stylistic voice.
Return only the narrative paragraph, no markdown wrappers, no backticks."""
        
        response = llm.invoke(prompt)
        return response.content.strip()
    except Exception as e:
        print(f"!!! Error generating narrative paragraph: {e} !!!")
        return f"[{faction_name}] {msg}. The simulation subsystem logged this state transition at tick {event.get('tick', 0)}."
