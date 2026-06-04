import uuid
from copy import deepcopy
from typing import Optional, List, Dict, Any
from backend.services.world_store import utc_now

class SnapshotStore:
    def __init__(self, supabase_client):
        self.supabase = supabase_client

    def create_snapshot(self, world_id: str, tick: int, state: Dict[str, Any]) -> Dict[str, Any]:
        row = {
            "id": str(uuid.uuid4()),
            "world_id": world_id,
            "tick": tick,
            "state_jsonb": deepcopy(state),
            "created_at": utc_now()
        }
        self.supabase.table("world_snapshots").insert(row).execute()
        return {
            "id": row["id"],
            "world_id": world_id,
            "tick": tick,
            "created_at": row["created_at"]
        }

    def get_snapshot(self, snapshot_id: str) -> Optional[Dict[str, Any]]:
        result = self.supabase.table("world_snapshots").select("*").eq("id", snapshot_id).limit(1).execute()
        return result.data[0] if result.data else None

    def list_snapshots(self, world_id: str) -> List[Dict[str, Any]]:
        result = (
            self.supabase.table("world_snapshots")
            .select("id,world_id,tick,created_at")
            .eq("world_id", world_id)
            .order("created_at", desc=True)
            .execute()
        )
        return result.data or []

    def delete_snapshot(self, snapshot_id: str) -> None:
        self.supabase.table("world_snapshots").delete().eq("id", snapshot_id).execute()
