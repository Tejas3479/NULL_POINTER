import datetime
from typing import Dict, Any, List
from backend.services.world_store import world_store

def record_execution_trace(
    agent_name: str,
    node_name: str,
    inputs: Dict[str, Any],
    outputs: Dict[str, Any],
    model: str = "gpt-4o",
    latency_ms: float = 120.0
):
    if not world_store.state:
        return
    traces = world_store.state.setdefault("agent_traces", [])
    new_trace = {
        "id": f"trace-{datetime.datetime.now(datetime.timezone.utc).isoformat()}-{node_name}",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "agent_name": agent_name,
        "node_name": node_name,
        "inputs": inputs,
        "outputs": outputs,
        "model": model,
        "latency_ms": latency_ms
    }
    traces.append(new_trace)
    # Maintain last 50 traces in world state
    world_store.state["agent_traces"] = traces[-50:]
    world_store.save()
