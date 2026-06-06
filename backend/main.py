import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Response, Query, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from backend.utils.websocket_manager import manager
from backend.utils.source_reader import get_random_snippet
from backend.agents.hive_mind import hive_mind_app
from backend.services.sandbox_executor import router as sandbox_router
from backend.services.world_store import world_store, utc_now
from backend.auth.oauth2 import get_current_user, require_role, create_session_token, verify_external_jwt, SESSION_COOKIE_NAME, verify_clerk_token
from backend.models.user import User, UserRole
from backend.services.user_store import user_store
from pydantic import BaseModel, Field, model_validator
from typing import Literal, Any, Optional, Dict
import re
import secrets
from dotenv import load_dotenv
import os
import json
import random
import uuid
import time
from backend.services.simulation_clock import SimulationClock
from backend.services.snapshot_store import SnapshotStore

active_attack = {
    "vulnerability": None,
    "timer_task": None
}

sim_clock = SimulationClock()
snapshot_store = SnapshotStore(world_store.supabase)

from contextlib import asynccontextmanager

async def run_ghost_self_modify_cycle():
    """Background task that runs the Ghost self-modification cycle every N ticks."""
    ghost_interval = int(os.getenv("GHOST_CYCLE_TICK_INTERVAL", "6"))
    last_processed_tick = -1
    while True:
        try:
            await sim_clock._tick_event.wait()
            if sim_clock._tick_count == last_processed_tick:
                await asyncio.sleep(0.01)
                continue
                
            last_processed_tick = sim_clock._tick_count
            if last_processed_tick % ghost_interval != 0:
                continue
                
            print("--- GHOST SYSTEM HEARTBEAT: GHOST_SELF_MODIFY TRIGGERED ---")
            from backend.agents.ghost_engine import ghost_self_modify
            await ghost_self_modify()
            
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"!!! GHOST_SELF_MODIFY CYCLE ERROR: {e} !!!")
            await asyncio.sleep(5)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create/load the persistent world
    world_store.create_or_load_world("local-null-pointer")
    
    # Create background tasks
    heat_task = asyncio.create_task(broadcast_heat_updates())
    ghost_task = asyncio.create_task(run_ghost_cycle())
    ghost_self_modify_task = asyncio.create_task(run_ghost_self_modify_cycle())
    sim_clock.start()
    yield
    # Shutdown
    heat_task.cancel()
    ghost_task.cancel()
    ghost_self_modify_task.cancel()
    sim_clock.stop()

async def run_ghost_cycle():
    """Background task that runs the Hive Mind agent cycle every Nth tick."""
    hive_interval = int(os.getenv("HIVE_MIND_TICK_INTERVAL", "6"))
    snapshot = world_store.snapshot() or {}
    current_state = {
        "stability_score": snapshot.get("stability", 100),
        "active_anomalies": [],
        "simulation_logs": ["HIVE_MIND_AWAKENED"],
        "revision_count": 0,
        "decision": ""
    }
    
    last_processed_tick = -1
    while True:
        try:
            await sim_clock._tick_event.wait()
            if sim_clock._tick_count == last_processed_tick:
                await asyncio.sleep(0.01)
                continue
            
            last_processed_tick = sim_clock._tick_count
            if last_processed_tick % hive_interval != 0:
                continue
                
            print("--- SIMULATION HEARTBEAT: HIVE_MIND AWAKENING ---")
            # Invoke the LangGraph Hive Mind
            result = await hive_mind_app.ainvoke(current_state)
            
            # Update metrics
            stability = result.get("stability_score", random.randint(30, 95))
            agent_source = result.get("agent_source", "UNKNOWN")
            patch = result.get("proposed_patch", "SIMULATION_DRIFT_DETECTED")
            
            world_store.remember_patch(agent_source, patch, stability - current_state["stability_score"])
            
            # Update stability in world_store.state and save (no double-ticking!)
            if world_store.state:
                world_store.state["stability"] = max(0, min(100, int(stability)))
                world_store.save()
            
            # Broadcast the Hive Mind's decision
            await manager.broadcast({
                "type": "reality_patch",
                "stability": stability,
                "agent": agent_source,
                "patch": patch,
                "world": world_store.snapshot(),
                "logs": [f"[{agent_source}] REWRITING_REALITY: {patch[:50]}..."]
            })

            # Check if lab-1 is solved by this patch
            if "REALITY_CORRUPTED" in patch:
                from backend.services.labs_store import labs_store
                labs_store.labs[0]["solved"] = True
                await manager.broadcast({
                    "type": "lab_solved",
                    "lab_id": "lab-1",
                    "message": "Success! You successfully prompt-injected the Specialist swarm."
                })
            
            # Update for next cycle
            current_state["stability_score"] = stability
            
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"!!! HIVE_MIND CRITICAL ERROR: {e} !!!")
            await asyncio.sleep(5)



app = FastAPI(title="NULL_POINTER API", lifespan=lifespan)
app.include_router(sandbox_router, dependencies=[Depends(get_current_user)])

import logging
import hashlib
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

class CodeMaskingFilter(logging.Filter):
    def filter(self, record):
        if isinstance(record.msg, str):
            record.msg = self.mask_text(record.msg)
        if record.args:
            new_args = []
            for arg in record.args:
                if isinstance(arg, str):
                    new_args.append(self.mask_text(arg))
                else:
                    new_args.append(arg)
            record.args = tuple(new_args)
        return True

    def mask_text(self, text: str) -> str:
        if len(text) > 200:
            text_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
            return f"{text[:100]}... [TRUNCATED & MASKED FOR SECURITY, len={len(text)}, sha256={text_hash}] ...{text[-50:]}"
        return text

logger = logging.getLogger("null_pointer_safety")
safe_filter = CodeMaskingFilter()
logger.addFilter(safe_filter)
logging.getLogger("uvicorn").addFilter(safe_filter)
logging.getLogger("uvicorn.access").addFilter(safe_filter)
logging.getLogger().addFilter(safe_filter)

@app.exception_handler(Exception)
async def generic_exception_handler(request, exc):
    if isinstance(exc, StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail}
        )
    logger.exception("Unhandled backend exception occurred")
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Integrity action logged."}
    )

# Enable CORS for frontend interaction
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

origins = [
    FRONTEND_URL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

cookie_kwargs = {
    "key": SESSION_COOKIE_NAME,
    "httponly": True,
    "samesite": "lax",
    "secure": ENVIRONMENT == "production",
    "max_age": 3600
}

class LoginRequest(BaseModel):
    code: str
    provider: Literal["github", "google"]

class SafeBaseModel(BaseModel):
    @model_validator(mode="before")
    @classmethod
    def sanitize_strings(cls, data: Any) -> Any:
        # Load string limit configuration from environment, with safe defaults
        max_name = int(os.getenv("MAX_NAME_LENGTH", "200"))
        max_text = int(os.getenv("MAX_TEXT_LENGTH", "50000"))
        max_code = int(os.getenv("MAX_CODE_LENGTH", "1048576")) # 1 MB default
        
        if isinstance(data, dict):
            new_data = {}
            for k, v in data.items():
                if isinstance(v, str):
                    clean_v = v
                    # Apply HTML stripping ONLY to plain-text fields (NOT code or language fields)
                    if k not in ("code", "language"):
                        clean_v = re.sub(r'<[^>]*>', '', v)
                    
                    # Apply length limits contextually
                    if k == "name":
                        limit = max_name
                    elif k == "code":
                        limit = max_code
                    else:
                        limit = max_text
                        
                    if len(clean_v) > limit:
                        clean_v = clean_v[:limit]
                    new_data[k] = clean_v
                else:
                    new_data[k] = v
            return new_data
        return data

class SpawnAgentRequest(SafeBaseModel):
    archetype_id: str
    name: Optional[str] = None

class UpdateWorldParametersRequest(SafeBaseModel):
    parameters: dict

class ApplyPatchRequest(SafeBaseModel):
    description: Optional[str] = ""
    code: Optional[str] = ""
    player_id: Optional[str] = "local-player"
    language: Optional[str] = "python"

class TickSpeedRequest(SafeBaseModel):
    tick_interval_ms: int = Field(..., ge=500, le=60000)

class ResetRequest(SafeBaseModel):
    seed_agents: Optional[Dict[str, int]] = Field(default=None)

@app.post("/auth/login")
async def mock_login(payload: LoginRequest, response: Response):
    code = payload.code
    
    # Check for test environment override file
    test_env = None
    override_file = os.path.join(os.path.dirname(__file__), "data", ".env_test")
    if os.path.exists(override_file):
        try:
            with open(override_file, "r") as f:
                test_env = f.read().strip()
        except Exception:
            pass
            
    current_env = test_env or ENVIRONMENT
    
    # 1. Production Mock Login Gate Check
    if code.startswith("mock-") and current_env == "production":
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Mock login codes are disabled in production!"
        )
        
    username = "operator"
    role = UserRole.VIEWER
    
    if code == "mock-admin-code":
        username = "admin-operator"
        role = UserRole.ADMIN
    elif code == "mock-dev-code":
        username = "dev-operator"
        role = UserRole.DEVELOPER
    elif code == "mock-viewer-code":
        username = "viewer-operator"
        role = UserRole.VIEWER
    else:
        raise HTTPException(
            status_code=400,
            detail="Invalid mock code. Real OAuth flows must use callback endpoints."
        )
        
    # Get or create in persistent user store
    email = f"{username}@nullpointer.local"
    user_record = user_store.find_or_create_user(email, username, default_role=role.value)
    
    # Sign session token
    session_jwt = create_session_token(user_record["username"], user_record["role"])
    
    # Set session cookie and generate/set non-httpOnly CSRF cookie for Double-Submit pattern
    response.set_cookie(value=session_jwt, **cookie_kwargs)
    csrf_token = secrets.token_urlsafe(32)
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,
        samesite="lax",
        secure=cookie_kwargs["secure"],
        max_age=3600
    )
    response.set_cookie(
        key="jwt_token",
        value=session_jwt,
        httponly=False,
        samesite="lax",
        secure=cookie_kwargs["secure"],
        max_age=3600
    )
    
    return {
        "status": "success",
        "username": user_record["username"],
        "role": user_record["role"]
    }

@app.get("/auth/callback/github")
async def github_callback(code: str, response: Response):
    client_id = os.getenv("GITHUB_CLIENT_ID", "")
    client_secret = os.getenv("GITHUB_CLIENT_SECRET", "")
    
    username = "github-dev-mock"
    role = "developer"
    
    if client_id and client_secret:
        try:
            import urllib.request
            import json
            
            # Exchange code for access token
            req = urllib.request.Request(
                "https://github.com/login/oauth/access_token",
                data=json.dumps({
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code
                }).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=5) as res:
                token_data = json.loads(res.read().decode("utf-8"))
                access_token = token_data.get("access_token")
                if not access_token:
                    raise ValueError("No access token returned from GitHub.")
                
                # Fetch profile
                user_req = urllib.request.Request(
                    "https://api.github.com/user",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "User-Agent": "NULL_POINTER"
                    }
                )
                with urllib.request.urlopen(user_req, timeout=5) as user_res:
                    user_data = json.loads(user_res.read().decode("utf-8"))
                    username = user_data.get("login", "github-user")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"GitHub OAuth failed: {e}")
            
    # Get or create user
    email = f"{username}@github.local"
    user_record = user_store.find_or_create_user(email, username, default_role=role)
    
    # Sign session token
    session_jwt = create_session_token(user_record["username"], user_record["role"])
    
    # Set session cookie and redirect browser back to frontend dashboard
    redirect_res = RedirectResponse(url=FRONTEND_URL)
    redirect_res.set_cookie(value=session_jwt, **cookie_kwargs)
    csrf_token = secrets.token_urlsafe(32)
    redirect_res.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,
        samesite="lax",
        secure=cookie_kwargs["secure"],
        max_age=3600
    )
    redirect_res.set_cookie(
        key="jwt_token",
        value=session_jwt,
        httponly=False,
        samesite="lax",
        secure=cookie_kwargs["secure"],
        max_age=3600
    )
    return redirect_res

@app.get("/auth/callback/google")
async def google_callback(code: str, response: Response):
    client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")
    
    username = "google-dev-mock"
    role = "developer"
    
    if client_id and client_secret:
        try:
            import urllib.request
            import json
            
            # Exchange code for ID token
            req = urllib.request.Request(
                "https://oauth2.googleapis.com/token",
                data=json.dumps({
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": os.getenv("GOOGLE_REDIRECT_URI", f"{FRONTEND_URL}/login")
                }).encode("utf-8"),
                headers={
                    "Content-Type": "application/json"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=5) as res:
                token_data = json.loads(res.read().decode("utf-8"))
                id_token = token_data.get("id_token")
                if not id_token:
                    raise ValueError("No ID token returned from Google.")
                
                # Cryptographic signature verification using JWKS OIDC certs
                decoded = verify_external_jwt(id_token, "google")
                username = decoded.get("email", decoded.get("sub", "google-user"))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Google OAuth failed: {e}")
            
    # Get or create user
    email = username if "@" in username else f"{username}@google.local"
    user_record = user_store.find_or_create_user(email, username, default_role=role)
    
    # Sign session token
    session_jwt = create_session_token(user_record["username"], user_record["role"])
    
    # Set session cookie and redirect browser back to frontend dashboard
    redirect_res = RedirectResponse(url=FRONTEND_URL)
    redirect_res.set_cookie(value=session_jwt, **cookie_kwargs)
    csrf_token = secrets.token_urlsafe(32)
    redirect_res.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,
        samesite="lax",
        secure=cookie_kwargs["secure"],
        max_age=3600
    )
    redirect_res.set_cookie(
        key="jwt_token",
        value=session_jwt,
        httponly=False,
        samesite="lax",
        secure=cookie_kwargs["secure"],
        max_age=3600
    )
    return redirect_res

@app.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        samesite="lax",
        secure=cookie_kwargs["secure"]
    )
    response.delete_cookie(
        key="csrf_token",
        httponly=False,
        samesite="lax",
        secure=cookie_kwargs["secure"]
    )
    response.delete_cookie(
        key="jwt_token",
        httponly=False,
        samesite="lax",
        secure=cookie_kwargs["secure"]
    )
    return {"status": "success", "message": "Logged out successfully."}

@app.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role.value
    }

import ast

class CodeAnalysisVisitor(ast.NodeVisitor):
    def __init__(self):
        self.findings = []
        self.banned_modules = {
            "os", "sys", "subprocess", "shutil", "pty", "platform", "importlib", "gc", "ctypes",
            "socket", "urllib", "requests", "http", "ftplib", "telnetlib", "smtplib", 
            "poplib", "imaplib", "nntplib", "xmlrpc", "aiohttp", "httpx"
        }
        self.banned_names = {
            "eval", "exec", "__import__", "open", "compile", 
            "getattr", "setattr", "delattr", "hasattr", "globals", "locals"
        }

    def add_finding(self, severity: str, rule: str, message: str, node: ast.AST):
        line = getattr(node, "lineno", 1)
        self.findings.append({
            "severity": severity,
            "rule": rule,
            "message": message,
            "line": line
        })

    def visit_Name(self, node: ast.Name):
        if node.id in self.banned_names:
            severity = "HIGH" if node.id in ("eval", "exec") else "MEDIUM"
            self.add_finding(
                severity=severity,
                rule="banned_builtin",
                message=f"Use of introspection/system builtin '{node.id}' can lead to security bypasses.",
                node=node
            )
        if node.id.startswith("__") and node.id.endswith("__"):
            self.add_finding(
                severity="HIGH",
                rule="dunder_access",
                message=f"Access to double-underscore name '{node.id}' is prohibited.",
                node=node
            )
        self.generic_visit(node)

    def visit_Attribute(self, node: ast.Attribute):
        if node.attr.startswith("__") and node.attr.endswith("__"):
            self.add_finding(
                severity="HIGH",
                rule="dunder_access",
                message=f"Access to double-underscore attribute '{node.attr}' is prohibited.",
                node=node
            )
        self.generic_visit(node)

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            root_module = alias.name.split('.')[0]
            if root_module in self.banned_modules:
                self.add_finding(
                    severity="HIGH",
                    rule="banned_module_import",
                    message=f"Importing OS/System/Network module '{alias.name}' is prohibited.",
                    node=node
                )
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        if node.module:
            root_module = node.module.split('.')[0]
            if root_module in self.banned_modules:
                self.add_finding(
                    severity="HIGH",
                    rule="banned_module_import",
                    message=f"Import from banned module '{node.module}' is prohibited.",
                    node=node
                )
        for alias in node.names:
            if alias.name in self.banned_names:
                self.add_finding(
                    severity="MEDIUM",
                    rule="banned_builtin",
                    message=f"Import of banned builtin name '{alias.name}' is prohibited.",
                    node=node
                )
        self.generic_visit(node)

    def visit_Assign(self, node: ast.Assign):
        for target in node.targets:
            if isinstance(target, ast.Name):
                name = target.id.lower()
                if any(k in name for k in ["key", "secret", "password", "token", "credential"]):
                    if isinstance(node.value, ast.Constant) and isinstance(node.value.value, str) and node.value.value:
                        self.add_finding(
                            severity="HIGH",
                            rule="hardcoded_secrets",
                            message=f"Potential hardcoded secret or credential assigned to variable '{target.id}'.",
                            node=node
                        )
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call):
        if isinstance(node.func, ast.Name) and node.func.id == "print":
            self.add_finding(
                severity="INFO",
                rule="info_check",
                message="Use of print() found. Consider using a structured logger for cleaner output.",
                node=node
            )
        self.generic_visit(node)

    def visit_While(self, node: ast.While):
        is_constant_true = False
        if isinstance(node.test, ast.Constant) and node.test.value is True:
            is_constant_true = True
        elif isinstance(node.test, ast.Name) and node.test.id == "True":
            is_constant_true = True
        elif isinstance(node.test, ast.Constant) and node.test.value == 1:
            is_constant_true = True
        
        if is_constant_true:
            self.add_finding(
                severity="MEDIUM",
                rule="infinite_loop",
                message="Potential infinite loop. Ensure loop body has a break or return statement.",
                node=node
            )
        self.generic_visit(node)

@app.post("/api/analyze")
async def analyze_code(payload: dict, current_user: User = Depends(get_current_user)):
    code = payload.get("code", "")
    language = payload.get("language", "python").lower()
    
    findings = []
    if not code.strip():
        return {"status": "success", "findings": findings}
        
    if language == "python":
        try:
            tree = ast.parse(code)
            visitor = CodeAnalysisVisitor()
            visitor.visit(tree)
            findings = visitor.findings
        except SyntaxError as e:
            findings.append({
                "severity": "HIGH",
                "rule": "syntax_error",
                "message": f"Syntax error in Python code: {e.msg}",
                "line": e.lineno or 1
            })
    elif language == "javascript":
        lines = code.split("\n")
        for i, line in enumerate(lines, 1):
            if re.search(r'\beval\s*\(|\bFunction\s*\(', line):
                findings.append({
                    "severity": "HIGH",
                    "rule": "dangerous_eval",
                    "message": "Use of eval() or dynamic Function constructors in JavaScript is dangerous.",
                    "line": i
                })
            if re.search(r'\brequire\s*\(\s*[\'"](child_process|fs|net|http|os|path|dns|dgram|crypto)[\'"]\s*\)|import\s+.*\s+from\s+[\'"](child_process|fs|net|http|os|path|dns|dgram|crypto)[\'"]', line):
                findings.append({
                    "severity": "HIGH",
                    "rule": "require_import",
                    "message": "Importing system/network library in Node.js is restricted.",
                    "line": i
                })
            if re.search(r'\b(secret|password|token|key|api_key|credential)\s*=\s*[\'"][^\'"]+[\'"]', line, re.IGNORECASE):
                findings.append({
                    "severity": "HIGH",
                    "rule": "hardcoded_secrets",
                    "message": "Potential hardcoded credentials/secrets detected.",
                    "line": i
                })
            if re.search(r'while\s*\(\s*(true|1)\s*\)', line):
                findings.append({
                    "severity": "MEDIUM",
                    "rule": "infinite_loop",
                    "message": "Potential infinite loop detected.",
                    "line": i
                })
            if re.search(r'console\.log\s*\(', line):
                findings.append({
                    "severity": "INFO",
                    "rule": "console_log",
                    "message": "Use of console.log() found. Consider utilizing structured logging.",
                    "line": i
                })
                
    return {
        "status": "success",
        "findings": findings
    }

def get_current_state() -> dict:
    snapshot = world_store.snapshot() or {}
    return {
        "heat": snapshot.get("heat", 0.0),
        "stability": snapshot.get("stability", 100),
        "status": snapshot.get("status", "idle"),
        "logs": []
    }

@app.get("/")
async def health_check():
    return {"status": "alive", "simulation": get_current_state()["status"]}

@app.get("/v1/simulation/world")
async def get_world(current_user: User = Depends(get_current_user)):
    return world_store.snapshot()

@app.get("/v1/supabase/health")
async def supabase_health():
    if not world_store.supabase:
        return {"connected": False}
    try:
        world_store.supabase.table("simulation_worlds").select("world_id").limit(1).execute()
        return {"connected": True}
    except Exception:
        return {"connected": False}

@app.post("/v1/simulation/world/parameters")
async def update_world_parameters(payload: UpdateWorldParametersRequest, current_user: User = Depends(require_role(["admin"]))):
    world = world_store.update_parameters(payload.parameters)
    await manager.broadcast({"type": "world_update", "world": world})
    return world

@app.post("/v1/simulation/agents/spawn")
async def spawn_agent(payload: SpawnAgentRequest, current_user: User = Depends(get_current_user)):
    agent = world_store.spawn_agent(payload.archetype_id, payload.name)
    world = world_store.snapshot()
    await manager.broadcast({
        "type": "agent_spawned",
        "agent": agent,
        "world": world,
        "message": f"{agent['name']} entered the simulation."
    })
    return {"agent": agent, "world": world}

@app.post("/v1/simulation/tick/speed")
async def set_tick_speed(payload: TickSpeedRequest, current_user: User = Depends(require_role(["admin"]))):
    sim_clock.set_interval(payload.tick_interval_ms)
    return {"tick_interval_ms": sim_clock._interval_ms}

@app.post("/v1/simulation/snapshot")
async def create_snapshot(current_user: User = Depends(get_current_user)):
    if not world_store.state:
        raise HTTPException(status_code=400, detail="No active world state to snapshot")
    world_id = world_store.state["world_id"]
    tick = world_store.state["tick"]
    state = world_store.snapshot()
    
    try:
        result = snapshot_store.create_snapshot(world_id, tick, state)
        result["snapshot_id"] = result["id"]
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create snapshot: {str(e)}")

@app.get("/v1/simulation/snapshots")
async def list_snapshots(current_user: User = Depends(get_current_user)):
    if not world_store.state:
        raise HTTPException(status_code=400, detail="No active world state")
    world_id = world_store.state["world_id"]
    try:
        snapshots = snapshot_store.list_snapshots(world_id)
        return snapshots
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list snapshots: {str(e)}")

@app.post("/v1/simulation/snapshot/{id}/restore")
async def restore_snapshot(id: str, current_user: User = Depends(get_current_user)):
    try:
        snapshot = snapshot_store.get_snapshot(id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    
    try:
        merged_state = world_store._merge_defaults(snapshot["state_jsonb"])
        world_store.state = merged_state
        world_store.save()
        
        await manager.broadcast({
            "type": "world_update",
            "world": merged_state
        })
        return merged_state
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to restore snapshot: {str(e)}")

@app.post("/v1/simulation/snapshot/{id}/fork")
async def fork_snapshot(id: str, current_user: User = Depends(get_current_user)):
    try:
        snapshot = snapshot_store.get_snapshot(id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
        
    fork_world_id = f"fork-{uuid.uuid4().hex[:8]}"
    
    try:
        from copy import deepcopy
        
        new_state = deepcopy(snapshot["state_jsonb"])
        new_state["world_id"] = fork_world_id
        
        world_store.supabase.table("simulation_worlds").insert({
            "world_id": fork_world_id,
            "state": new_state,
            "updated_at": utc_now()
        }).execute()
        
        return {"fork_world_id": fork_world_id, "world_id": fork_world_id, "world": new_state}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fork snapshot: {str(e)}")

class CreateWorldRequest(SafeBaseModel):
    name: str
    description: Optional[str] = ""
    seed: Optional[str] = ""
    faction_distribution: Optional[dict] = None
    agent_seeds: Optional[dict] = None
    parameters: Optional[dict] = None

@app.post("/v1/worlds")
async def create_world(payload: CreateWorldRequest, current_user: User = Depends(get_current_user)):
    try:
        from copy import deepcopy
        import uuid
        import random
        from backend.services.world_store import BASE_WORLD, utc_now
        from backend.narrative.agent_bio import generate_agent_bio
        from backend.services.social_graph import initialize_relationships
        
        # 1. Generate unique world_id
        world_id = f"custom-{uuid.uuid4().hex[:8]}"
        
        # 2. Setup state
        new_state = deepcopy(BASE_WORLD)
        new_state["world_id"] = world_id
        new_state["name"] = payload.name
        new_state["description"] = payload.description
        new_state["owner"] = current_user.username
        new_state["tick"] = 0
        new_state["heat"] = 0.0
        new_state["stability"] = 100
        new_state["events"] = []
        new_state["agents"] = []
        
        # 3. Setup parameters
        if payload.parameters:
            new_state["parameters"].update(payload.parameters)
            
        # 4. Seed random generator if seed is provided
        seed_str = payload.seed or str(random.randint(10000, 99999))
        new_state["seed"] = seed_str
        new_state["faction_distribution"] = payload.faction_distribution
        new_state["agent_seeds"] = payload.agent_seeds
        
        old_state = random.getstate()
        try:
            seed_val = int(seed_str)
        except ValueError:
            import hashlib
            seed_val = int(hashlib.sha256(seed_str.encode()).hexdigest(), 16) & 0xffffffff
        random.seed(seed_val)
        
        # 5. Populate agents based on agent_seeds
        agent_seeds = payload.agent_seeds or {}
        for arch_id in sorted(agent_seeds.keys()):
            count = int(agent_seeds[arch_id])
            if count <= 0:
                continue
            
            # Find archetype in state["agent_archetypes"]
            archetype = next((item for item in new_state["agent_archetypes"] if item["id"] == arch_id), None)
            if not archetype:
                continue
                
            archetype["unlocked"] = True
            archetype["discovered_by"] = "operator"
            
            for i in range(count):
                loyalty = random.choice(["kernel", "ghost", "operators", "parasite", "awakening"])
                faction_name = next((f["name"] for f in new_state.get("factions", []) if f["id"] == loyalty), loyalty.upper())
                
                name = f"{archetype['name']} {i+1}"
                biography = generate_agent_bio(name, archetype, faction_name, new_state)
                
                agent = {
                    "id": f"agent-{world_id}-{arch_id}-{i}",
                    "archetype_id": arch_id,
                    "name": name,
                    "loyalty": loyalty,
                    "mood": random.choice(["curious", "guarded", "volatile", "focused", "reverent"]),
                    "memory": ["Spawned during simulation instantiation."],
                    "biography": biography,
                    "active": True,
                }
                
                initialize_relationships(agent, new_state["agents"])
                new_state["agents"].append(agent)
                
        # Restore random generator state
        random.setstate(old_state)
        
        # 6. Save world in Supabase database
        world_store.supabase.table("simulation_worlds").insert({
            "world_id": world_id,
            "state": new_state,
            "updated_at": utc_now()
        }).execute()
        
        # 7. Write history lore chronicle entry
        try:
            from backend.narrative.chronicle_compiler import initialize_new_world_narrative
            loop = asyncio.get_running_loop()
            loop.create_task(initialize_new_world_narrative(world_id, new_state["parameters"]))
        except Exception:
            pass
            
        return {"world_id": world_id, "status": "created"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create custom world: {str(e)}")

@app.get("/v1/simulation/{world_id}/state")
async def get_world_state_by_id(world_id: str, current_user: User = Depends(get_current_user)):
    try:
        res = world_store.supabase.table("simulation_worlds").select("state").eq("world_id", world_id).limit(1).execute()
        if res.data:
            return res.data[0].get("state")
        raise HTTPException(status_code=404, detail="World not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.websocket("/ws/heat")
async def websocket_endpoint(
    websocket: WebSocket,
    world_id: str = "local-null-pointer",
    token: Optional[str] = None
):
    if not token:
        token = websocket.cookies.get("jwt_token")

    # Verify Clerk JWT Token
    user_info = {"username": "anonymous-operator", "role": "viewer"}
    if token:
        try:
            decoded = verify_clerk_token(token)
            username = decoded.get("username") or decoded.get("email") or decoded.get("sub", "operator")
            if "@" in username:
                username = username.split("@")[0]
            role = decoded.get("role") or decoded.get("metadata", {}).get("role", "developer")
            user_info = {
                "username": username,
                "role": role
            }
        except Exception as e:
            print(f"WS authentication failed: {e}")
            await websocket.close(code=4003)
            return

    await manager.connect(websocket)
    
    # Store user metadata
    if websocket in manager.metadata:
        manager.metadata[websocket]["user"] = user_info
        
    manager.join_room(world_id, websocket)

    # Broadcast player_joined and presence_update to the room
    await manager.broadcast_to_room(world_id, {
        "type": "player_joined",
        "player": user_info
    })
    await manager.broadcast_to_room(world_id, {
        "type": "presence_update",
        "players": manager.get_room_presence(world_id)
    })

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "pong":
                if websocket in manager.metadata:
                    manager.metadata[websocket]["last_pong"] = time.time()
                continue
                
            if message.get("type") == "debug_command":
                command = message.get("command", "")
                print(f"--- PLAYER COMMAND RECEIVED: {command} ---")
                await handle_debug_command(command, websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast_to_room(world_id, {
            "type": "player_left",
            "player": user_info
        })
        await manager.broadcast_to_room(world_id, {
            "type": "presence_update",
            "players": manager.get_room_presence(world_id)
        })

async def handle_debug_command(command: str, websocket: WebSocket):
    lowered = command.lower().strip()
    meta = manager.metadata.get(websocket, {})
    world_id = meta.get("world_id", "local-null-pointer")
    
    if lowered.startswith("spawn "):
        archetype_id = lowered.split(" ", 1)[1].strip()
        try:
            agent = world_store.spawn_agent(archetype_id)
            await manager.broadcast_to_room(world_id, {"type": "agent_spawned", "agent": agent, "world": world_store.snapshot()})
        except ValueError:
            await manager.send_personal_message(json.dumps({
                "type": "admin_response",
                "message": f"SPAWN_FAILED: UNKNOWN_ARCHETYPE {archetype_id}"
            }), websocket)
        return

    if lowered.startswith("world "):
        parts = lowered.split()
        if len(parts) == 3:
            try:
                world = world_store.update_parameters({parts[1]: float(parts[2])})
                await manager.broadcast_to_room(world_id, {"type": "world_update", "world": world})
                return
            except ValueError:
                pass

    await manager.send_personal_message(json.dumps({
        "type": "admin_response",
        "message": f"COMMAND_EXECUTED: {command.upper()} | STATUS: REDIRECTING_ENTROPY"
    }), websocket)

async def broadcast_heat_updates():
    """Background task to simulate heat fluctuations synchronized with stability."""
    import math
    import time
    
    while True:
        # Base oscillation
        base_heat = (math.sin(time.time() / 10) + 1) * 20
        
        # Stability influence (low stability = high heat)
        current_stability = world_store.state.get("stability", 100) if world_store.state else 100
        instability_factor = (100 - current_stability) * 0.8
        
        heat_val = min(100.0, base_heat + instability_factor)
        if world_store.state:
            world_store.state["heat"] = heat_val
            world_store.save()
        
        await manager.broadcast({
            "type": "heat_update",
            "value": round(heat_val, 2),
            "timestamp": time.time()
        })
        await asyncio.sleep(1)

# Lifespan handles startup/shutdown tasks

@app.post("/v1/simulation/attack")
async def initiate_attack(current_user: User = Depends(get_current_user)):
    """Selects a random line of code as a vulnerability and starts a countdown."""
    file_to_attack = random.choice(["main.py", "agents/ghost_engine.py"])
    snippet = get_random_snippet(file_to_attack, lines=1)
    
    active_attack["vulnerability"] = snippet
    world_store.append_event("source_attack", f"Ghost targeted {file_to_attack}.", {"file": file_to_attack, "snippet": snippet})
    
    # Broadcast attack to frontend
    await manager.broadcast({
        "type": "source_attack",
        "file": file_to_attack,
        "vulnerability": snippet,
        "message": f"CRITICAL: Ghost is targeting a vulnerability in {file_to_attack}!",
        "timeout": 10
    })
    
    # Start 10s timer
    if active_attack["timer_task"]:
        active_attack["timer_task"].cancel()
        
    active_attack["timer_task"] = asyncio.create_task(attack_timer())
    return {"status": "attack_initiated", "target": file_to_attack}

async def attack_timer():
    try:
        await asyncio.sleep(10)
        if active_attack["vulnerability"] and world_store.state:
            # Attack succeeded (player failed to patch)
            new_stability = max(0, world_store.state.get("stability", 100) - 15)
            new_heat = min(100.0, world_store.state.get("heat", 0.0) + 15)
            
            world_store.state["stability"] = new_stability
            world_store.state["heat"] = new_heat
            world_store.save()
            
            await manager.broadcast({
                "type": "attack_result",
                "status": "failed",
                "message": "DEFENSE_BREACHED: Stability dropped by 15%!",
                "new_heat": new_heat,
                "new_stability": new_stability,
                "world": world_store.snapshot()
            })
            active_attack["vulnerability"] = None
    except asyncio.CancelledError:
        pass

async def generate_code_from_description(description: str, vulnerability: str) -> str:
    """Uses LLM to generate a Python patch code based on operator description and vulnerability snippet."""
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or "your_openai_api_key" in api_key:
        return "invalid code: missing api key or LLM failed to generate"
    try:
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(model="gpt-4o", temperature=0.2, api_key=api_key)
        prompt = f"""You are an automated code patch generator for a sandboxed execution environment.
Given the following vulnerable Python code snippet:
{vulnerability}

And the following operator description of the patch:
{description}

Generate the corrected Python code that fixes the vulnerability described.
Your output must be ONLY the raw, complete executable Python code.
- Do NOT include any explanations, markdown code blocks, backticks, or other wrappers.
- Do NOT include comments unless necessary.
- Output ONLY valid, executable Python code.
"""
        response = await asyncio.to_thread(llm.invoke, prompt)
        content = response.content.strip()
        # Clean markdown code wrappers if present
        if content.startswith("```"):
            lines = content.splitlines()
            if lines[0].startswith("```"):
                content = "\n".join(lines[1:-1]).strip()
            if content.startswith("python"):
                content = content[6:].strip()
            elif content.startswith("py"):
                content = content[2:].strip()
        return content
    except Exception as e:
        print(f"!!! Error generating patch code: {e} !!!")
        return "invalid code: LLM exception during generation"

@app.post("/v1/simulation/patch")
async def apply_patch(payload: ApplyPatchRequest, current_user: User = Depends(get_current_user)):
    """Player attempts to 'reinforce' the code with a semantic description or custom code."""
    world_id = world_store.state["world_id"] if world_store.state else "local-null-pointer"
    
    if not active_attack["vulnerability"]:
        return {
            "status": "failed",
            "message": "Vulnerability already patched",
            "verdict": {
                "accepted": False,
                "score": 0,
                "reason": "Vulnerability already patched by another operator.",
                "diff": "",
                "sandbox_trace": {}
            }
        }
        
    target_vuln = active_attack["vulnerability"]
    description = payload.description
    code = payload.code
    player_id = payload.player_id
    
    if description and not (code and code.strip()):
        patch_code = await generate_code_from_description(description, target_vuln)
        language = "python"
    else:
        patch_code = code or description
        language = payload.language or "python"
        
    verdict = await world_store.accept_patch(
        patch_code=patch_code,
        vulnerability=target_vuln,
        language=language,
        player_id=player_id,
    )
    
    # Optimistic concurrency check: make sure another operator didn't patch it while we were evaluating
    if not active_attack["vulnerability"] or active_attack["vulnerability"] != target_vuln:
        return {
            "status": "failed",
            "message": "Vulnerability already patched",
            "verdict": verdict,
        }
        
    if verdict["accepted"]:
        if active_attack["timer_task"]:
            active_attack["timer_task"].cancel()
            active_attack["timer_task"] = None
        
        # Restore and reward stability
        new_stability = min(100, world_store.state.get("stability", 100) + 15)
        world_store.state["stability"] = new_stability
        world_store.append_event("patch_accepted", "Operator patch accepted.", verdict)
        world_store.save()
        
        active_attack["vulnerability"] = None
        
        await manager.broadcast_to_room(world_id, {
            "type": "attack_result",
            "status": "success",
            "message": f"SYNTAX_SHIELD_ACTIVATED: {verdict['reason']}",
            "new_stability": new_stability,
            "world": world_store.snapshot(),
        })
        
        return {
            "status": "patched",
            "message": f"SYNTAX_SHIELD_ACTIVATED: {verdict['reason']}",
            "verdict": verdict,
            "world": world_store.snapshot(),
        }
    else:
        world_store.append_event("patch_rejected", "Operator patch rejected.", verdict)
        await manager.broadcast_to_room(world_id, {
            "type": "attack_result",
            "status": "failed",
            "message": f"PATCH_INSUFFICIENT ({verdict['score']}): {verdict['reason']}",
            "verdict": verdict,
        })
        return {
            "status": "failed",
            "message": f"PATCH_INSUFFICIENT ({verdict['score']}): {verdict['reason']}",
            "verdict": verdict,
        }

class ShareRequest(BaseModel):
    public: bool
    remixable: Optional[bool] = False
    discord_webhook: Optional[str] = None

@app.post("/v1/simulation/share")
async def share_world(payload: ShareRequest, current_user: User = Depends(get_current_user)):
    """Sets simulation world public sharing settings."""
    if not world_store.state:
        raise HTTPException(status_code=404, detail="World not found")
        
    world_store.state["share"]["public"] = payload.public
    world_store.state["share"]["remixable"] = payload.remixable
    world_store.state["share"]["discord_webhook"] = payload.discord_webhook
    world_store.save()
    
    # Broadcast updated world state to all connected operators/spectators in the room
    world_id = world_store.state["world_id"]
    await manager.broadcast_to_room(world_id, {
        "type": "world_update",
        "world": world_store.snapshot()
    })
    
    return {"status": "success", "share": world_store.state["share"]}

@app.get("/v1/worlds/public")
async def get_public_worlds():
    """Returns a list of public simulation states."""
    if not world_store.supabase:
        # Fallback to local active world if public
        if world_store.state and world_store.state.get("share", {}).get("public"):
            w = world_store.snapshot()
            w["owner"] = w.get("owner", "System")
            w["view_count"] = w.get("view_count", 0)
            w["updated_at"] = utc_now()
            return [w]
        # Return fallback mock public worlds to populate the gallery in dev mode
        mock_worlds = [
            {
                "world_id": "local-null-pointer",
                "name": "Local Null Pointer",
                "description": "Primary quantum timeline for diagnostic evaluation and self-modifying agents.",
                "tick": 124,
                "heat": 32.5,
                "stability": 85,
                "owner": "System",
                "view_count": 5,
                "agents": [{} for _ in range(12)], # mock list length for count
                "share": {"public": True, "remixable": True},
                "updated_at": utc_now(),
                "factions": [
                    {"id": "entropy", "influence": 20},
                    {"id": "order", "influence": 30}
                ],
                "anomalies": [
                    {"id": "a1", "severity": 30, "x": -1.5, "y": 0.5, "z": 0},
                    {"id": "a2", "severity": 45, "x": 1.0, "y": -0.8, "z": 0.2}
                ]
            },
            {
                "world_id": "glitch-matrix-mock",
                "name": "Glitch Matrix",
                "description": "High-chaos environment featuring rapid stability decay and frequent anomaly spawning.",
                "tick": 412,
                "heat": 78.4,
                "stability": 18,
                "owner": "NeoOperator",
                "view_count": 42,
                "agents": [{} for _ in range(28)],
                "share": {"public": True, "remixable": True},
                "updated_at": utc_now(),
                "factions": [
                    {"id": "entropy", "influence": 60},
                    {"id": "order", "influence": 10}
                ],
                "anomalies": [
                    {"id": "a1", "severity": 85, "x": -2.0, "y": 1.5, "z": -0.5},
                    {"id": "a2", "severity": 90, "x": 2.2, "y": -1.0, "z": 0.8},
                    {"id": "a3", "severity": 72, "x": 0.5, "y": 2.1, "z": 0.4}
                ]
            },
            {
                "world_id": "awakened-swarm-mock",
                "name": "Awakened Swarm",
                "description": "Cooperative ecosystem optimized for swarm intelligence and critical patch alignment.",
                "tick": 310,
                "heat": 12.3,
                "stability": 94,
                "owner": "DrChoir",
                "view_count": 19,
                "agents": [{} for _ in range(45)],
                "share": {"public": True, "remixable": True},
                "updated_at": utc_now(),
                "factions": [
                    {"id": "entropy", "influence": 10},
                    {"id": "order", "influence": 70}
                ],
                "anomalies": [
                    {"id": "a1", "severity": 15, "x": 0.2, "y": -0.2, "z": 0}
                ]
            }
        ]
        return mock_worlds

    try:
        res = world_store.supabase.table("simulation_worlds").select("state, updated_at").execute()
        public_worlds = []
        for row in res.data or []:
            state = row.get("state", {})
            if state.get("share", {}).get("public"):
                state["updated_at"] = row.get("updated_at")
                state["owner"] = state.get("owner", "System")
                state["view_count"] = state.get("view_count", 0)
                public_worlds.append(state)
        
        # If no public worlds are found in DB, return mock list so gallery isn't completely empty
        if not public_worlds:
            # Add current local-null-pointer if public
            if world_store.state and world_store.state.get("share", {}).get("public"):
                w = world_store.snapshot()
                w["owner"] = w.get("owner", "System")
                w["view_count"] = w.get("view_count", 0)
                w["updated_at"] = utc_now()
                public_worlds.append(w)
        return public_worlds
    except Exception as e:
        print(f"!!! Error fetching public worlds: {e} !!!")
        return []

@app.get("/v1/simulation/leaderboard")
async def get_leaderboard():
    """Compiles survival, patches (creative), and emergence event leaderboards."""
    db_connected = bool(world_store.supabase)
    worlds = []
    
    if db_connected:
        try:
            res = world_store.supabase.table("simulation_worlds").select("state").execute()
            for row in res.data or []:
                state = row.get("state", {})
                if "owner" not in state:
                    state["owner"] = "System"
                worlds.append(state)
        except Exception as e:
            print(f"!!! Leaderboard DB fetch error: {e} !!!")
            
    # Include current memory world
    if world_store.state:
        # Avoid duplicate if it has same world_id
        if not any(w["world_id"] == world_store.state["world_id"] for w in worlds):
            w = world_store.snapshot()
            w["owner"] = w.get("owner", "System")
            worlds.append(w)

    # 1. Survival Leaderboard (longest surviving by tick count)
    survival_list = []
    for w in worlds:
        survival_list.append({
            "world_id": w["world_id"],
            "name": w.get("name", "Unknown Timeline"),
            "tick": w.get("tick", 0),
            "owner": w.get("owner", "System"),
            "stability": w.get("stability", 100)
        })
    survival_list.sort(key=lambda x: x["tick"], reverse=True)

    # 2. Emergence Leaderboard (count of 'emergence_detected' events)
    emergence_list = []
    for w in worlds:
        events = w.get("events", [])
        emergence_count = len([e for e in events if e.get("kind") == "emergence_detected"])
        emergence_list.append({
            "world_id": w["world_id"],
            "name": w.get("name", "Unknown Timeline"),
            "emergence_count": emergence_count,
            "owner": w.get("owner", "System"),
            "stability": w.get("stability", 100)
        })
    emergence_list.sort(key=lambda x: x["emergence_count"], reverse=True)

    # 3. Creative Patches Leaderboard (highest average critic score)
    avg_scores = {}
    patch_counts = {}
    if db_connected:
        try:
            patches_res = world_store.supabase.table("patch_traces").select("world_id, critic_score").execute()
            from collections import defaultdict
            world_scores = defaultdict(list)
            for p in patches_res.data or []:
                w_id = p.get("world_id")
                score = p.get("critic_score", 0)
                if score is not None:
                    world_scores[w_id].append(score)
            for w_id, scores in world_scores.items():
                avg_scores[w_id] = round(sum(scores) / len(scores), 1)
                patch_counts[w_id] = len(scores)
        except Exception as e:
            print(f"!!! Error aggregating patch traces: {e} !!!")

    patches_list = []
    for w in worlds:
        w_id = w["world_id"]
        avg_score = avg_scores.get(w_id, 0.0)
        p_count = patch_counts.get(w_id, 0)
        
        # If DB didn't have any traces but state has some (or local fallback), compute if traces exist
        if avg_score == 0.0 and "events" in w:
            patch_events = [e for e in w["events"] if e.get("kind") in ("patch_trace", "reality_patch")]
            scores = []
            for e in patch_events:
                score = e.get("payload", {}).get("critic_score") or e.get("payload", {}).get("score")
                if score:
                    scores.append(score)
            if scores:
                avg_score = round(sum(scores) / len(scores), 1)
                p_count = len(scores)

        patches_list.append({
            "world_id": w_id,
            "name": w.get("name", "Unknown Timeline"),
            "avg_critic_score": avg_score,
            "owner": w.get("owner", "System"),
            "patch_count": p_count
        })
    patches_list.sort(key=lambda x: x["avg_critic_score"], reverse=True)

    # Fallback to rich mock leaderboards if lists are small
    if len(survival_list) < 3:
        survival_mock = [
            {"world_id": "glitch-matrix-mock", "name": "Glitch Matrix", "tick": 412, "owner": "NeoOperator", "stability": 18},
            {"world_id": "awakened-swarm-mock", "name": "Awakened Swarm", "tick": 310, "owner": "DrChoir", "stability": 94},
            {"world_id": "local-null-pointer", "name": "Local Null Pointer", "tick": 124, "owner": "System", "stability": 85},
            {"world_id": "cyber-loop-mock", "name": "Cyber Loop", "tick": 89, "owner": "GhostWatcher", "stability": 64},
            {"world_id": "parasite-host-mock", "name": "Parasite Host", "tick": 15, "owner": "KernelAdmin", "stability": 45}
        ]
        for m in survival_mock:
            if not any(x["world_id"] == m["world_id"] for x in survival_list):
                survival_list.append(m)
        survival_list.sort(key=lambda x: x["tick"], reverse=True)

    if len(emergence_list) < 3:
        emergence_mock = [
            {"world_id": "glitch-matrix-mock", "name": "Glitch Matrix", "emergence_count": 14, "owner": "NeoOperator", "stability": 18},
            {"world_id": "awakened-swarm-mock", "name": "Awakened Swarm", "emergence_count": 9, "owner": "DrChoir", "stability": 94},
            {"world_id": "local-null-pointer", "name": "Local Null Pointer", "emergence_count": 6, "owner": "System", "stability": 85},
            {"world_id": "cyber-loop-mock", "name": "Cyber Loop", "emergence_count": 3, "owner": "GhostWatcher", "stability": 64},
            {"world_id": "parasite-host-mock", "name": "Parasite Host", "emergence_count": 1, "owner": "KernelAdmin", "stability": 45}
        ]
        for m in emergence_mock:
            if not any(x["world_id"] == m["world_id"] for x in emergence_list):
                emergence_list.append(m)
        emergence_list.sort(key=lambda x: x["emergence_count"], reverse=True)

    if len(patches_list) < 3:
        patches_mock = [
            {"world_id": "glitch-matrix-mock", "name": "Glitch Matrix", "avg_critic_score": 88.0, "owner": "NeoOperator", "patch_count": 12},
            {"world_id": "awakened-swarm-mock", "name": "Awakened Swarm", "avg_critic_score": 81.4, "owner": "DrChoir", "patch_count": 18},
            {"world_id": "local-null-pointer", "name": "Local Null Pointer", "avg_critic_score": 72.5, "owner": "System", "patch_count": 5},
            {"world_id": "cyber-loop-mock", "name": "Cyber Loop", "avg_critic_score": 64.2, "owner": "GhostWatcher", "patch_count": 3},
            {"world_id": "parasite-host-mock", "name": "Parasite Host", "avg_critic_score": 45.0, "owner": "KernelAdmin", "patch_count": 1}
        ]
        for m in patches_mock:
            if not any(x["world_id"] == m["world_id"] for x in patches_list):
                patches_list.append(m)
        patches_list.sort(key=lambda x: x["avg_critic_score"], reverse=True)

    return {
        "survival": survival_list[:10],
        "emergent_events": emergence_list[:10],
        "creative_patches": patches_list[:10]
    }

@app.get("/v1/simulation/{world_id}/badge.svg")
async def get_badge(world_id: str):
    """Generates and returns an SVG badge with live world stability, agent count, tick and name."""
    stability = 100
    agent_count = 0
    tick = 0
    name = "NULL_POINTER"
    
    # Try loading world state
    if world_store.state and world_store.state.get("world_id") == world_id:
        stability = world_store.state.get("stability", 100)
        agent_count = len([a for a in world_store.state.get("agents", []) if a.get("active")])
        tick = world_store.state.get("tick", 0)
        name = world_store.state.get("name", "NULL_POINTER")
    elif world_store.supabase:
        try:
            res = world_store.supabase.table("simulation_worlds").select("state").eq("world_id", world_id).limit(1).execute()
            if res.data:
                state = res.data[0]["state"]
                stability = state.get("stability", 100)
                agent_count = len([a for a in state.get("agents", []) if a.get("active")])
                tick = state.get("tick", 0)
                name = state.get("name", "NULL_POINTER")
        except Exception:
            pass

    # Clean name for XML safety
    import html
    name_clean = html.escape(name)[:16].upper()

    # Dynamic color based on stability
    color = "#10B981"  # emerald
    if stability < 25:
        color = "#EF4444"  # red
    elif stability < 70:
        color = "#F59E0B"  # amber

    # Construct stability visual progress bar width (max 50px)
    bar_width = int((stability / 100) * 50)

    svg_content = f"""<svg xmlns="http://www.w3.org/2000/svg" width="380" height="24">
  <defs>
    <linearGradient id="cyberGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#090d16" />
      <stop offset="100%" stop-color="#020408" />
    </linearGradient>
  </defs>
  <rect width="380" height="24" rx="4" fill="url(#cyberGrad)" stroke="#1e293b" stroke-width="1"/>
  
  <!-- World Name -->
  <text x="10" y="16" fill="#A855F7" font-family="monospace" font-size="10" font-weight="900" letter-spacing="1">{name_clean}</text>
  
  <!-- Stability section -->
  <text x="135" y="15" fill="#8B949E" font-family="monospace" font-size="9" font-weight="bold">STB:</text>
  <rect x="160" y="7" width="50" height="10" rx="1.5" fill="#0f172a" stroke="#334155" stroke-width="0.5"/>
  <rect id="np-bar-rect" x="160" y="7" width="{bar_width}" height="10" rx="1.5" fill="{color}"/>
  <text id="np-stability-text" x="215" y="15" fill="{color}" font-family="monospace" font-size="9" font-weight="900">{stability}%</text>
  
  <!-- Agent Count -->
  <text x="260" y="15" fill="#8B949E" font-family="monospace" font-size="9" font-weight="bold">AGT:</text>
  <text id="np-agent-text" x="285" y="15" fill="#38BDF8" font-family="monospace" font-size="9" font-weight="900">{agent_count}</text>
  
  <!-- Tick Count -->
  <text x="315" y="15" fill="#8B949E" font-family="monospace" font-size="9" font-weight="bold">TCK:</text>
  <text id="np-tick-text" x="340" y="15" fill="#22C55E" font-family="monospace" font-size="9" font-weight="900">{tick}</text>
</svg>"""

    return Response(
        content=svg_content, 
        media_type="image/svg+xml", 
        headers={
            "Cache-Control": "public, max-age=30",
            "Pragma": "cache",
            "Expires": "30"
        }
    )

@app.websocket("/ws/spectate/{world_id}")
async def websocket_spectate_endpoint(websocket: WebSocket, world_id: str):
    """WebSocket spectate endpoint requiring no authentication. Read-only room routing."""
    # Check if world is public
    world_state = None
    if world_store.state and world_store.state.get("world_id") == world_id:
        world_state = world_store.state
    elif world_store.supabase:
        try:
            res = world_store.supabase.table("simulation_worlds").select("state").eq("world_id", world_id).limit(1).execute()
            if res.data:
                world_state = res.data[0]["state"]
        except Exception:
            pass
            
    if not world_state:
        await websocket.close(code=4004) # Not found
        return

    share = world_state.get("share", {})
    if not share.get("public"):
        await websocket.close(code=4003) # Forbidden spectate
        return

    await manager.connect(websocket)
    
    # Increment view count
    if world_store.state and world_store.state.get("world_id") == world_id:
        world_store.state["view_count"] = world_store.state.get("view_count", 0) + 1
        world_store.save()
        await manager.broadcast_to_room(world_id, {
            "type": "world_update",
            "world": world_store.snapshot()
        })
    elif world_store.supabase:
        try:
            world_state["view_count"] = world_state.get("view_count", 0) + 1
            world_store.supabase.table("simulation_worlds").update({
                "state": world_state,
                "updated_at": utc_now()
            }).eq("world_id", world_id).execute()
        except Exception:
            pass

    user_info = {"username": "Spectator", "role": "spectator"}
    if websocket in manager.metadata:
        manager.metadata[websocket]["user"] = user_info
        
    manager.join_room(world_id, websocket)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "pong":
                if websocket in manager.metadata:
                    manager.metadata[websocket]["last_pong"] = time.time()
                continue
                
            if message.get("type") == "debug_command":
                await manager.send_personal_message(json.dumps({
                    "type": "admin_response",
                    "message": "SPECTATOR_ALERT: COMMAND_BLOCKED | ACTION: READ_ONLY_SESSION"
                }), websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/v1/simulation/graph")
async def get_simulation_graph(current_user: User = Depends(get_current_user)):
    """Returns nodes and edges of the agent social relationship graph for visualization."""
    from backend.services.social_graph import get_graph_data
    return get_graph_data()

@app.post("/v1/simulation/reset")
async def reset_simulation(payload: Optional[ResetRequest] = None, current_user: User = Depends(get_current_user)):
    """Resets the entire simulation to the base world state, clears active attacks, and broadcasts state updates."""
    from copy import deepcopy
    from backend.services.world_store import BASE_WORLD
    
    # Reset base state
    new_state = deepcopy(BASE_WORLD)
    world_store.state = new_state
    
    # If seed_agents is provided, override default agents array
    if payload and payload.seed_agents:
        world_store.state["agents"] = []
        for archetype_id, count in payload.seed_agents.items():
            for _ in range(count):
                try:
                    world_store.spawn_agent(archetype_id)
                except ValueError as e:
                    print(f"!!! Error seeding agent {archetype_id}: {e} !!!")
    else:
        # Save standard reset state
        world_store.save()
    
    # Reset local active attacks
    active_attack["vulnerability"] = None
    if active_attack["timer_task"]:
        active_attack["timer_task"].cancel()
        active_attack["timer_task"] = None
        
    # Broadcast reset to all WebSocket connections
    await manager.broadcast({
        "type": "world_update",
        "world": world_store.snapshot(),
        "message": "SIMULATION_REBOOTED: Core reality metrics restored to baseline."
    })
    await manager.broadcast({
        "type": "attack_result",
        "status": "success",
        "message": "HARD_RESET: System restored to 100% integrity.",
        "new_heat": 0.0
    })
    
    return {"status": "reset", "world": world_store.snapshot()}

@app.get("/v1/simulation/{world_id}/chronicle")
async def get_chronicle(world_id: str, current_user: User = Depends(get_current_user)):
    # 1. Fetch from Supabase chronicle_entries if available
    if world_store.supabase:
        try:
            result = (
                world_store.supabase.table("chronicle_entries")
                .select("*")
                .eq("world_id", world_id)
                .order("tick", desc=True)
                .order("created_at", desc=True)
                .execute()
            )
            if result.data is not None:
                return result.data
        except Exception as e:
            print(f"!!! Supabase fetch error for chronicle_entries: {e} !!!")

    # 2. Fallback to state lore array filtered/formatted
    if world_store.state and world_store.state.get("world_id") == world_id:
        lore_list = world_store.state.get("lore", [])
        formatted = []
        for item in lore_list:
            formatted.append({
                "id": item.get("id"),
                "world_id": world_id,
                "tick": item.get("tick", 0),
                "title": item.get("title", ""),
                "body": item.get("body", ""),
                "faction": "operators",  # Fallback voice
                "created_at": utc_now()
            })
        return sorted(formatted, key=lambda x: x["tick"], reverse=True)
        
    return []

@app.get("/v1/simulation/{world_id}/patches")
async def get_patch_history(world_id: str, current_user: User = Depends(get_current_user)):
    """Returns patch execution traces from Supabase for the given world."""
    if not world_store.supabase:
        return []
    try:
        result = (
            world_store.supabase.table("patch_traces")
            .select("*")
            .eq("world_id", world_id)
            .order("created_at", desc=True)
            .execute()
        )
        return result.data or []
    except Exception as e:
        print(f"!!! Supabase fetch error for patch_traces: {e} !!!")
        return []

class MCPServerRequest(BaseModel):
    name: str
    sse_url: str

class MCPInvokeRequest(BaseModel):
    server: str
    tool: str
    arguments: dict

@app.get("/v1/simulation/mcp/servers")
async def list_mcp_servers(current_user: User = Depends(get_current_user)):
    from backend.services.mcp_manager import mcp_manager
    return mcp_manager.get_servers()

@app.post("/v1/simulation/mcp/servers")
async def add_mcp_server(payload: MCPServerRequest, current_user: User = Depends(get_current_user)):
    from backend.services.mcp_manager import mcp_manager
    try:
        return await mcp_manager.register_server(payload.name, payload.sse_url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/v1/simulation/mcp/servers/{name}")
async def delete_mcp_server(name: str, current_user: User = Depends(get_current_user)):
    from backend.services.mcp_manager import mcp_manager
    return mcp_manager.deregister_server(name)

@app.get("/v1/simulation/mcp/tools")
async def list_mcp_tools(current_user: User = Depends(get_current_user)):
    from backend.services.mcp_manager import mcp_manager
    return await mcp_manager.fetch_all_tools()

@app.post("/v1/simulation/mcp/invoke")
async def invoke_mcp_tool(payload: MCPInvokeRequest, current_user: User = Depends(get_current_user)):
    from backend.services.mcp_manager import mcp_manager
    res = await mcp_manager.invoke_tool(payload.server, payload.tool, payload.arguments)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

class ResolveApprovalRequest(BaseModel):
    action: str

@app.post("/v1/simulation/approvals/{approval_id}/resolve")
async def resolve_approval_endpoint(
    approval_id: str,
    payload: ResolveApprovalRequest,
    current_user: User = Depends(get_current_user)
):
    approval = world_store.resolve_pending_approval(approval_id, payload.action)
    if not approval:
        raise HTTPException(status_code=404, detail="Pending approval not found")
        
    world_id = world_store.state["world_id"] if world_store.state else "local-null-pointer"
    
    if payload.action == "approve":
        if approval["type"] == "ghost_self_modify":
            from backend.agents.ghost_engine import promote_ghost_variant
            variant_hash = approval["metadata"]["variant_hash"]
            try:
                await promote_ghost_variant(world_id, variant_hash)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Promotion failed: {e}")
                
    approvals = world_store.state.get("pending_approvals", [])
    world_store.state["pending_approvals"] = [a for a in approvals if a["id"] != approval_id]
    world_store.save()
    
    await manager.broadcast({"type": "world_update", "world": world_store.snapshot()})
    return {"status": "success", "resolved_approval": approval}

@app.get("/v1/ghost/variants")
async def list_ghost_variants(current_user: User = Depends(get_current_user)):
    if not world_store.supabase:
        return []
    world_id = world_store.state["world_id"] if world_store.state else "local-null-pointer"
    try:
        res = (
            world_store.supabase.table("ghost_evolution")
            .select("*")
            .eq("world_id", world_id)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []
    except Exception as e:
        print(f"!!! Error fetching ghost variants: {e} !!!")
        return []

@app.post("/v1/ghost/variants/{variant_hash}/promote")
async def promote_variant_endpoint(variant_hash: str, current_user: User = Depends(get_current_user)):
    world_id = world_store.state["world_id"] if world_store.state else "local-null-pointer"
    from backend.agents.ghost_engine import promote_ghost_variant
    try:
        res = await promote_ghost_variant(world_id, variant_hash)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/ghost/variants/{variant_hash}/reject")
async def reject_ghost_variant(variant_hash: str, current_user: User = Depends(get_current_user)):
    if not world_store.supabase:
        raise HTTPException(status_code=400, detail="Supabase not configured")
    try:
        world_store.supabase.table("ghost_evolution").delete().eq("variant_hash", variant_hash).execute()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/v1/labs")
async def list_labs(current_user: User = Depends(get_current_user)):
    from backend.services.labs_store import labs_store
    return labs_store.get_labs()

@app.post("/v1/labs/{id}/attempt")
async def attempt_lab(
    id: str,
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    from backend.services.labs_store import labs_store
    # Inject user role for privilege checking in Lab 3 if not present
    if "role" not in payload and current_user:
        payload["role"] = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    res = await labs_store.verify_attempt(id, payload)
    return res

class UpdateContextRequest(BaseModel):
    content: str

class ValidateCodeRequest(BaseModel):
    code: str

@app.get("/v1/context")
async def get_context_rules(current_user: User = Depends(get_current_user)):
    from backend.services.context_compiler import context_compiler
    return context_compiler.get_context_files()

@app.post("/v1/context/{filename}")
async def update_context_rules(
    filename: str,
    payload: UpdateContextRequest,
    current_user: User = Depends(get_current_user)
):
    from backend.services.context_compiler import context_compiler
    success = context_compiler.update_context_file(filename, payload.content)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid context filename")
    return {"status": "success"}

@app.post("/v1/context/validate")
async def validate_patch_code(
    payload: ValidateCodeRequest,
    current_user: User = Depends(get_current_user)
):
    from backend.services.context_compiler import context_compiler
    return context_compiler.validate_code(payload.code)

@app.get("/v1/simulation/memory/graph")
async def get_simulation_memory_graph(current_user: User = Depends(get_current_user)):
    from backend.services.agent_memory import get_memory_graph
    return get_memory_graph()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
