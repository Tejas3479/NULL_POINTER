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
