from pydantic import BaseModel, Field
from typing import Any, Dict, List, Annotated, TypedDict
import operator

class SimState(TypedDict, total=False):
    stability_score: int
    active_anomalies: Annotated[List[str], operator.add]
    simulation_logs: Annotated[List[str], operator.add]
    current_flaw: str
    proposed_patch: str
    revision_count: int
    decision: str
    agent_source: str
    next_agent: str
    selected_agent: Dict[str, Any]

class GhostResponse(BaseModel):
    flaw: str
    patch: str
    stability_impact: int
    reasoning: str
