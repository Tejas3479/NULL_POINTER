import json
import os
from pathlib import Path
from typing import Dict, Any, Optional

USER_DB_PATH = Path(__file__).resolve().parents[1] / "data" / "users.json"

class UserStore:
    def __init__(self, path: Path = USER_DB_PATH):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.users = self._load()

    def _load(self) -> Dict[str, Dict[str, Any]]:
        if not self.path.exists():
            # Initial default users for developer and administrator roles
            default_users = {
                "admin-operator@nullpointer.local": {
                    "username": "admin-operator",
                    "email": "admin-operator@nullpointer.local",
                    "role": "admin"
                },
                "dev-operator@nullpointer.local": {
                    "username": "dev-operator",
                    "email": "dev-operator@nullpointer.local",
                    "role": "developer"
                },
                "viewer-operator@nullpointer.local": {
                    "username": "viewer-operator",
                    "email": "viewer-operator@nullpointer.local",
                    "role": "viewer"
                }
            }
            self._save(default_users)
            return default_users
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def _save(self, data: Dict[str, Dict[str, Any]]):
        self.path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def find_or_create_user(self, email: str, username: str, default_role: str = "viewer") -> Dict[str, Any]:
        email_key = email.lower().strip()
        self.users = self._load()
        if email_key not in self.users:
            self.users[email_key] = {
                "username": username,
                "email": email,
                "role": default_role
            }
            self._save(self.users)
        return self.users[email_key]

user_store = UserStore()
