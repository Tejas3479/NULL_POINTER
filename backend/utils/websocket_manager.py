import asyncio
import time
from typing import Dict, List, Set, Any
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Maps world_id to a set of WebSockets
        self.rooms: Dict[str, Set[WebSocket]] = {}
        # Maps websocket to its metadata (user, last_pong_time, etc.)
        self.metadata: Dict[WebSocket, Dict[str, Any]] = {}
        # Background task for checking heartbeats
        self.heartbeat_task = None

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.metadata[websocket] = {
            "last_pong": time.time(),
            "user": None
        }
        # Start heartbeat loop if not running or done
        if self.heartbeat_task is None or self.heartbeat_task.done():
            self.heartbeat_task = asyncio.create_task(self._heartbeat_loop())

    def disconnect(self, websocket: WebSocket):
        # Remove from metadata
        if websocket in self.metadata:
            del self.metadata[websocket]
        
        # Remove from any rooms
        for world_id in list(self.rooms.keys()):
            if websocket in self.rooms[world_id]:
                self.rooms[world_id].remove(websocket)
                if not self.rooms[world_id]:
                    del self.rooms[world_id]

    def join_room(self, world_id: str, websocket: WebSocket):
        if world_id not in self.rooms:
            self.rooms[world_id] = set()
        self.rooms[world_id].add(websocket)
        if websocket in self.metadata:
            self.metadata[websocket]["world_id"] = world_id

    def leave_room(self, world_id: str, websocket: WebSocket):
        if world_id in self.rooms and websocket in self.rooms[world_id]:
            self.rooms[world_id].remove(websocket)
            if not self.rooms[world_id]:
                del self.rooms[world_id]

    async def broadcast_to_room(self, world_id: str, message: dict):
        if world_id in self.rooms:
            for connection in list(self.rooms[world_id]):
                try:
                    await connection.send_json(message)
                except Exception:
                    self.disconnect(connection)

    async def broadcast(self, message: dict):
        # Extract world_id from the message if possible for room targeted broadcasts
        world_id = None
        if "world_id" in message:
            world_id = message["world_id"]
        elif "world" in message and isinstance(message["world"], dict):
            world_id = message["world"].get("world_id")
        elif "entry" in message and isinstance(message["entry"], dict):
            world_id = message["entry"].get("world_id")

        if world_id:
            await self.broadcast_to_room(world_id, message)
        else:
            # Global broadcast to all active connections
            for connection in list(self.metadata.keys()):
                try:
                    await connection.send_json(message)
                except Exception:
                    self.disconnect(connection)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    def get_room_presence(self, world_id: str) -> List[Dict[str, Any]]:
        presence = []
        if world_id in self.rooms:
            for ws in self.rooms[world_id]:
                meta = self.metadata.get(ws, {})
                user = meta.get("user")
                if user:
                    presence.append(user)
        return presence

    async def _heartbeat_loop(self):
        while True:
            try:
                await asyncio.sleep(30)
                active_sockets = list(self.metadata.keys())
                if not active_sockets:
                    continue

                # Send ping to all
                for ws in active_sockets:
                    try:
                        await ws.send_json({"type": "ping"})
                    except Exception:
                        self.disconnect(ws)

                # Wait 10s for pongs to be registered
                await asyncio.sleep(10)

                # Check if anyone didn't respond
                now = time.time()
                for ws in list(self.metadata.keys()):
                    last_pong = self.metadata[ws].get("last_pong", 0)
                    if now - last_pong > 40:  # 30s sleep + 10s wait
                        try:
                            await ws.close()
                        except Exception:
                            pass
                        self.disconnect(ws)
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Error in heartbeat loop: {e}")

manager = ConnectionManager()
