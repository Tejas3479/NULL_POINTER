from typing import Dict, List, Any
import random
from backend.services.world_store import world_store

def initialize_relationships(new_agent: Dict[str, Any], existing_agents: List[Dict[str, Any]]):
    """Initializes bi-directional relationships with random weights between -20 and 20.
    """
    new_agent["relationships"] = {}
    for existing in existing_agents:
        # Avoid self-relationship
        if existing["id"] == new_agent["id"]:
            continue
            
        weight = random.randint(-20, 20)
        new_agent["relationships"][existing["id"]] = weight
        
        # Symmetrically add back-relationship to existing agent
        existing_rels = existing.setdefault("relationships", {})
        existing_rels[new_agent["id"]] = weight

def update_relationship_weight(agent_a_id: str, agent_b_id: str, delta: int):
    """Updates the relationship weight between two agents, clamping the value between -100 and 100.
    """
    if not world_store.state or "agents" not in world_store.state:
        return
        
    agents = world_store.state["agents"]
    agent_a = next((a for a in agents if a["id"] == agent_a_id), None)
    agent_b = next((a for a in agents if a["id"] == agent_b_id), None)
    
    if agent_a and agent_b:
        # A -> B
        a_rels = agent_a.setdefault("relationships", {})
        old_w_a = a_rels.get(agent_b_id, 0)
        new_w_a = max(-100, min(100, old_w_a + delta))
        a_rels[agent_b_id] = new_w_a
        
        # B -> A
        b_rels = agent_b.setdefault("relationships", {})
        old_w_b = b_rels.get(agent_a_id, 0)
        new_w_b = max(-100, min(100, old_w_b + delta))
        b_rels[agent_a_id] = new_w_b
        
        world_store.save()

        # Check if an alliance is formed (relationship strength crosses 80)
        if old_w_a < 80 and new_w_a >= 80:
            world_id = world_store.state.get("world_id", "local-null-pointer")
            message = f"🤝 Alliance formed! {agent_a['name']} and {agent_b['name']} have forged an alliance with relationship strength {new_w_a}."
            world_store.append_event(
                "agent_alliance_formed",
                message,
                {"agent_a_id": agent_a_id, "agent_b_id": agent_b_id, "weight": new_w_a}
            )
            try:
                import asyncio
                from backend.services.discord_notifier import trigger_discord_notification
                try:
                    loop = asyncio.get_running_loop()
                    loop.create_task(trigger_discord_notification(world_id, "agent_alliance_formed", message, {"agent_a_id": agent_a_id, "agent_b_id": agent_b_id, "weight": new_w_a}))
                except RuntimeError:
                    import threading
                    threading.Thread(target=lambda: asyncio.run(trigger_discord_notification(world_id, "agent_alliance_formed", message, {"agent_a_id": agent_a_id, "agent_b_id": agent_b_id, "weight": new_w_a})), daemon=True).start()
            except Exception as e:
                print(f"!!! Discord Alert Error: {e} !!!")

def get_graph_data() -> Dict[str, Any]:
    """Exposes all agents as nodes and all active relationships as edges."""
    if not world_store.state or "agents" not in world_store.state:
        return {"nodes": [], "edges": []}
        
    nodes = []
    edges = []
    
    agents = world_store.state["agents"]
    for agent in agents:
        archetype = world_store.archetype_for(agent["archetype_id"])
        nodes.append({
            "id": agent["id"],
            "name": agent["name"],
            "faction": archetype.get("faction", "UNKNOWN"),
            "role": archetype.get("role", "UNKNOWN"),
            "mood": agent.get("mood", "stable"),
            "biography": agent.get("biography", "")
        })
        
        # Map out edges
        rels = agent.get("relationships", {})
        for target_id, weight in rels.items():
            # Verify target agent exists in current world state
            target_exists = any(a["id"] == target_id for a in agents)
            if not target_exists:
                continue
                
            edges.append({
                "source": agent["id"],
                "target": target_id,
                "weight": weight
            })
            
    return {"nodes": nodes, "edges": edges}
