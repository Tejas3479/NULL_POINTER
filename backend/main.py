import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from utils.websocket_manager import manager
from utils.source_reader import read_source_file, get_random_snippet
from agents.ghost_engine import ghost_app
from dotenv import load_dotenv
import os
import json
import random

load_dotenv()

active_attack = {
    "vulnerability": None,
    "timer_task": None
}

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create background tasks
    heat_task = asyncio.create_task(broadcast_heat_updates())
    ghost_task = asyncio.create_task(run_ghost_cycle())
    yield
    # Shutdown
    heat_task.cancel()
    ghost_task.cancel()

async def run_ghost_cycle():
    """Trigger the Ghost Engine every 30 seconds."""
    current_state = {
        "stability_score": 100,
        "active_anomalies": [],
        "simulation_logs": ["Ghost Engine Initialized."],
        "current_flaw": "",
        "proposed_patch": "",
        "revision_count": 0,
        "decision": ""
    }
    
    while True:
        try:
            print("--- TRIGGERING GHOST ENGINE ---")
            # Run the LangGraph
            result = await ghost_app.ainvoke(current_state)
            
            # Update local state tracking
            current_state.update(result)
            simulation_state["stability"] = result["stability_score"]
            
            # Broadcast the patch and logs to frontend
            if result.get("proposed_patch"):
                await manager.broadcast({
                    "type": "reality_patch",
                    "patch": result["proposed_patch"],
                    "stability": result["stability_score"],
                    "logs": result["simulation_logs"][-2:] # Send latest logs
                })
            
            await asyncio.sleep(30)
        except Exception as e:
            print(f"Ghost Engine Error: {e}")
            await asyncio.sleep(10) # Wait before retry

app = FastAPI(title="NULL_POINTER API", lifespan=lifespan)

# Enable CORS for frontend interaction
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

simulation_state = {
    "heat": 0.0,
    "stability": 100, # Linked to Ghost Engine
    "status": "idle",
    "logs": []
}

@app.get("/")
async def health_check():
    return {"status": "alive", "simulation": simulation_state["status"]}

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
                
                # Mock System_Admin response
                # In a real scenario, this could trigger another LangGraph agent
                await manager.send_personal_message(json.dumps({
                    "type": "admin_response",
                    "message": f"COMMAND_EXECUTED: {command.upper()} | STATUS: REDIRECTING_ENTROPY"
                }), websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)

async def broadcast_heat_updates():
    """Background task to simulate heat fluctuations"""
    while True:
        # Simple oscillation for demonstration
        import math
        import time
        simulation_state["heat"] = (math.sin(time.time() / 5) + 1) * 50
        
        await manager.broadcast({
            "type": "heat_update",
            "value": round(simulation_state["heat"], 2),
            "timestamp": time.time()
        })
        await asyncio.sleep(1)

# Lifespan handles startup/shutdown tasks

@app.post("/v1/simulation/attack")
async def initiate_attack():
    """Selects a random line of code as a vulnerability and starts a countdown."""
    file_to_attack = random.choice(["main.py", "agents/ghost_engine.py"])
    snippet = get_random_snippet(file_to_attack, lines=1)
    
    active_attack["vulnerability"] = snippet
    
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
        if active_attack["vulnerability"]:
            # Attack succeeded (player failed to patch)
            simulation_state["heat"] = min(100, simulation_state["heat"] + 15)
            await manager.broadcast({
                "type": "attack_result",
                "status": "failed",
                "message": "DEFENSE_BREACHED: Stability dropped by 15%!",
                "new_heat": simulation_state["heat"]
            })
            active_attack["vulnerability"] = None
    except asyncio.CancelledError:
        pass

@app.post("/v1/simulation/patch")
async def apply_patch(payload: dict):
    """Player attempts to 'reinforce' the code with a semantic description."""
    if not active_attack["vulnerability"]:
        return {"error": "No active attack to patch."}
    
    patch_description = payload.get("description", "")
    
    # In a real scenario, use LLM to verify if the description is a valid semantic patch
    # For now, we accept any non-empty string as a 'Syntax Shield'
    if len(patch_description) > 10:
        if active_attack["timer_task"]:
            active_attack["timer_task"].cancel()
        
        active_attack["vulnerability"] = None
        return {"status": "patched", "message": "SYNTAX_SHIELD_ACTIVATED: Vulnerability reinforced."}
    else:
        return {"status": "failed", "message": "PATCH_INSUFFICIENT: Defense too weak."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
