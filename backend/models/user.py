from pydantic import BaseModel
from enum import Enum
from typing import Optional

class UserRole(str, Enum):
    ADMIN = "admin"
    DEVELOPER = "developer"
    VIEWER = "viewer"

class User(BaseModel):
    username: str
    email: Optional[str] = None
    role: UserRole
