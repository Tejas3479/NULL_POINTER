import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from utils.websocket_manager import manager
from agents.ghost_engine import ghost_app
from dotenv import load_dotenv
import os
import json

load_dotenv()

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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

simulation_state = {
    "heat": 0.0,
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
            # Receive data if needed, but primarily used for broadcasting updates
            data = await websocket.receive_text()
            # Handle incoming client messages if any
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
