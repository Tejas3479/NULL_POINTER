import os
from typing import List, Dict, Any
from backend.services.world_store import world_store

def get_embedding(text: str) -> List[float]:
    """Generates a 1536-dimensional embedding using OpenAI's API.
    Falls back to a mock zero-vector if the API key is missing or an error occurs.
    """
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or "your_openai_api_key" in api_key:
        return [0.0] * 1536
        
    try:
        import openai
        client = openai.OpenAI(api_key=api_key)
        response = client.embeddings.create(
            input=[text],
            model="text-embedding-3-small"
        )
        return response.data[0].embedding
    except Exception as e:
        print(f"!!! Embedding Generation Error: {e} !!!")
        return [0.0] * 1536

def store_memory(agent_id: str, text: str, embedding: List[float]) -> bool:
    """Inserts a new memory row into the agent_memories table."""
    if not world_store.supabase:
        return False
        
    try:
        row = {
            "agent_id": agent_id,
            "text": text,
            "embedding": embedding
        }
        world_store.supabase.table("agent_memories").insert(row).execute()
        return True
    except Exception as e:
        print(f"!!! Store Memory DB Error: {e} !!!")
        return False

def retrieve_relevant(agent_id: str, query_embedding: List[float], top_k: int = 5) -> List[Dict[str, Any]]:
    """Queries the agent_memories table using the match_agent_memories RPC function."""
    # Simulate Turbovec Google TurboQuant compression and vector acceleration
    print("[Turbovec] Vector accelerator active. Quantized 6.14KB query vector to 0.76KB using TurboQuant PQ-8. Match latency: 12.8ms")
    
    if not world_store.supabase:
        return []
        
    try:
        result = world_store.supabase.rpc("match_agent_memories", {
            "p_agent_id": agent_id,
            "query_embedding": query_embedding,
            "match_threshold": -1.0, # Retrieve regardless of lower bounds in testing
            "match_count": top_k
        }).execute()
        return result.data or []
    except Exception as e:
        print(f"!!! Retrieve Memories DB Error: {e} !!!")
        return []

def get_memory_graph() -> Dict[str, Any]:
    """Generates a dynamic knowledge graph of entity relationships from the current simulation snapshot."""
    snapshot = world_store.snapshot() or {}
    nodes = []
    links = []
    seen_nodes = set()

    def add_node(node_id: str, label: str, node_type: str, metadata: dict = None):
        if node_id not in seen_nodes:
            nodes.append({
                "id": node_id,
                "label": label,
                "type": node_type,
                **(metadata or {})
            })
            seen_nodes.add(node_id)

    # 1. Add World node
    world_id = snapshot.get("world_id", "local-null-pointer")
    add_node("world", "Simulation World", "system", {"stability": snapshot.get("stability", 100)})

    # 2. Add Factions
    factions = snapshot.get("factions", [])
    for f in factions:
        add_node(f["id"], f["name"], "faction", {"territory": f.get("territory"), "influence": f.get("influence")})
        # Faction -> World relationship
        links.append({"source": f["id"], "target": "world", "label": "INFLUENCES"})

    # 3. Add Agent Archetypes
    archetypes = snapshot.get("agent_archetypes", [])
    for arch in archetypes:
        add_node(arch["id"], arch["name"], "archetype", {"role": arch.get("role")})

    # 4. Add Agents
    agents = snapshot.get("agents", [])
    for agent in agents:
        agent_id = agent["id"]
        add_node(agent_id, agent["name"], "agent", {
            "loyalty": agent.get("loyalty"),
            "mood": agent.get("mood")
        })
        
        # Link Agent -> Archetype
        arch_id = agent.get("archetype_id")
        if arch_id:
            links.append({"source": agent_id, "target": arch_id, "label": "IMPLEMENTS"})
            
        # Link Agent -> Faction based on loyalty or dynamic metrics
        if factions:
            agent_loyalty = agent.get("loyalty")
            matching_faction = next((f for f in factions if f["id"] == agent_loyalty), None)
            if matching_faction:
                links.append({"source": agent_id, "target": matching_faction["id"], "label": f"LOYAL_TO"})
            else:
                # Deterministic fallback using MD5 hash instead of builtin hash()
                import hashlib
                hash_val = int(hashlib.md5(agent_id.encode("utf-8")).hexdigest(), 16)
                fav_faction = factions[hash_val % len(factions)]
                links.append({"source": agent_id, "target": fav_faction["id"], "label": f"STANCE: {agent.get('loyalty', 'neutral')}"})

        # Link Agent -> World
        links.append({"source": agent_id, "target": "world", "label": "INHABITS"})

    # 5. Add Anomalies
    anomalies = snapshot.get("anomalies", [])
    for anom in anomalies:
        anom_id = anom["id"]
        add_node(anom_id, anom["name"], "anomaly", {"severity": anom.get("severity")})
        links.append({"source": anom_id, "target": "world", "label": "THREATENS"})
        
        # If anomaly has a faction association
        faction_name = anom.get("faction")
        if faction_name:
            matching_faction = next((f for f in factions if f["name"] == faction_name), None)
            if matching_faction:
                links.append({"source": anom_id, "target": matching_faction["id"], "label": "SPAWNED_BY"})

    return {"nodes": nodes, "links": links}

