import uuid
import json
from copy import deepcopy
from pathlib import Path
from typing import Optional, List, Dict, Any
from backend.services.world_store import utc_now

class SnapshotStore:
    def __init__(self, supabase_client):
        self.supabase = supabase_client
        self.local_path = Path(__file__).resolve().parents[1] / "data" / "snapshots.json"
        self.local_path.parent.mkdir(parents=True, exist_ok=True)

    def _load_local(self) -> List[Dict[str, Any]]:
        if not self.local_path.exists():
            return []
        try:
            return json.loads(self.local_path.read_text(encoding="utf-8"))
        except Exception:
            return []

    def _save_local(self, data: List[Dict[str, Any]]):
        self.local_path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def create_snapshot(self, world_id: str, tick: int, state: Dict[str, Any]) -> Dict[str, Any]:
        row = {
            "id": str(uuid.uuid4()),
            "world_id": world_id,
            "tick": tick,
            "state_jsonb": deepcopy(state),
            "created_at": utc_now()
        }
        if self.supabase:
            self.supabase.table("world_snapshots").insert(row).execute()
        else:
            snapshots = self._load_local()
            snapshots.append(row)
            self._save_local(snapshots)
        return {
            "id": row["id"],
            "world_id": world_id,
            "tick": tick,
            "created_at": row["created_at"]
        }

    def get_snapshot(self, snapshot_id: str) -> Optional[Dict[str, Any]]:
        if self.supabase:
            result = self.supabase.table("world_snapshots").select("*").eq("id", snapshot_id).limit(1).execute()
            return result.data[0] if result.data else None
        else:
            snapshots = self._load_local()
            return next((s for s in snapshots if s["id"] == snapshot_id), None)

    def list_snapshots(self, world_id: str) -> List[Dict[str, Any]]:
        if self.supabase:
            result = (
                self.supabase.table("world_snapshots")
                .select("id,world_id,tick,created_at")
                .eq("world_id", world_id)
                .order("created_at", desc=True)
                .execute()
            )
            return result.data or []
        else:
            snapshots = self._load_local()
            matched = [
                {
                    "id": s["id"],
                    "world_id": s["world_id"],
                    "tick": s["tick"],
                    "created_at": s["created_at"]
                }
                for s in snapshots if s["world_id"] == world_id
            ]
            matched.sort(key=lambda x: x["created_at"], reverse=True)
            return matched

    def delete_snapshot(self, snapshot_id: str) -> None:
        if self.supabase:
            self.supabase.table("world_snapshots").delete().eq("id", snapshot_id).execute()
        else:
            snapshots = self._load_local()
            snapshots = [s for s in snapshots if s["id"] != snapshot_id]
            self._save_local(snapshots)
