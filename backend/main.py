import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Response, Query, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from backend.utils.websocket_manager import manager
from backend.utils.source_reader import get_random_snippet
from backend.agents.hive_mind import hive_mind_app
from backend.services.sandbox_executor import router as sandbox_router
from backend.services.world_store import world_store, utc_now
from backend.auth.oauth2 import get_current_user, require_role, create_session_token, verify_external_jwt, SESSION_COOKIE_NAME
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
from backend.services.simulation_clock import SimulationClock
from backend.services.snapshot_store import SnapshotStore

active_attack = {
    "vulnerability": None,
    "timer_task": None
}

sim_clock = SimulationClock()
snapshot_store = SnapshotStore(world_store.supabase)

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create/load the persistent world
    world_store.create_or_load_world("local-null-pointer")
    
    # Create background tasks
    heat_task = asyncio.create_task(broadcast_heat_updates())
    ghost_task = asyncio.create_task(run_ghost_cycle())
    sim_clock.start()
    yield
    # Shutdown
    heat_task.cancel()
    ghost_task.cancel()
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

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
    return {"status": "success", "message": "Logged out successfully."}

@app.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role.value
    }

@app.post("/api/analyze")
async def analyze_code(payload: dict, current_user: User = Depends(get_current_user)):
    return {
        "status": "success",
        "message": "Code integrity verified successfully.",
        "user": current_user.username,
        "role": current_user.role.value
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

@app.websocket("/ws/heat")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "debug_command":
                command = message.get("command", "")
                print(f"--- PLAYER COMMAND RECEIVED: {command} ---")
                await handle_debug_command(command, websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)

async def handle_debug_command(command: str, websocket: WebSocket):
    lowered = command.lower().strip()
    if lowered.startswith("spawn "):
        archetype_id = lowered.split(" ", 1)[1].strip()
        try:
            agent = world_store.spawn_agent(archetype_id)
            await manager.broadcast({"type": "agent_spawned", "agent": agent, "world": world_store.snapshot()})
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
                await manager.broadcast({"type": "world_update", "world": world})
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

@app.post("/v1/simulation/patch")
async def apply_patch(payload: ApplyPatchRequest, current_user: User = Depends(get_current_user)):
    """Player attempts to 'reinforce' the code with a semantic description."""
    if not active_attack["vulnerability"]:
        return {"error": "No active attack to patch."}
    
    description = payload.description
    code = payload.code
    player_id = payload.player_id
    
    if description and not code:
        from backend.services.world_store import evaluate_patch, utc_now
        raw_verdict = evaluate_patch(description, active_attack["vulnerability"])
        verdict = {
            "accepted": raw_verdict["accepted"],
            "score": raw_verdict["score"],
            "reason": raw_verdict["reason"],
            "diff": raw_verdict["suggested_diff"],
            "suggested_diff": raw_verdict["suggested_diff"],
            "sandbox_trace": {
                "language": "semantic",
                "started_at": utc_now(),
                "syntax": {"success": True, "error": ""},
                "baseline": None,
                "patched": None,
            }
        }
    else:
        patch_code = code or description
        language = payload.language or "python"
        verdict = await world_store.accept_patch(
            patch_code=patch_code,
            vulnerability=active_attack["vulnerability"],
            language=language,
            player_id=player_id,
        )
        
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
        
        await manager.broadcast({
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
        return {
            "status": "failed",
            "message": f"PATCH_INSUFFICIENT ({verdict['score']}): {verdict['reason']}",
            "verdict": verdict,
        }

@app.post("/v1/simulation/reset")
async def reset_simulation(current_user: User = Depends(get_current_user)):
    """Resets the entire simulation to the base world state, clears active attacks, and broadcasts state updates."""
    from copy import deepcopy
    from backend.services.world_store import BASE_WORLD
    
    # Reset store state
    world_store.state = deepcopy(BASE_WORLD)
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
