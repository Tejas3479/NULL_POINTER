from pydantic import BaseModel, Field
from typing import List, Annotated, TypedDict
import operator

class SimState(TypedDict):
    stability_score: int
    active_anomalies: Annotated[List[str], operator.add]
    simulation_logs: Annotated[List[str], operator.add]
    current_flaw: str
    proposed_patch: str
    revision_count: int
    decision: str

class GhostResponse(BaseModel):
    flaw: str
    patch: str
    stability_impact: int
    reasoning: str
