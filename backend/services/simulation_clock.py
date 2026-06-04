import asyncio
import os
from typing import Optional
from backend.services.world_store import world_store
from backend.utils.websocket_manager import manager

class SimulationClock:
    def __init__(self, tick_interval_ms: int = int(os.getenv("SIM_TICK_MS", "5000"))):
        self._interval_ms = tick_interval_ms
        self._tick_count = 0
        self._task: Optional[asyncio.Task] = None
        self._tick_event = asyncio.Event()

    def start(self):
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._loop())

    def stop(self):
        if self._task:
            self._task.cancel()
            self._task = None

    def set_interval(self, ms: int):
        self._interval_ms = max(500, min(60000, ms))

    async def _loop(self):
        while True:
            try:
                await asyncio.sleep(self._interval_ms / 1000)
                current_heat = world_store.state.get("heat", 0.0) if world_store.state else 0.0
                world = world_store.advance_tick(heat=current_heat)
                self._tick_count += 1
                
                await manager.broadcast({
                    "type": "tick",
                    "tick": world["tick"],
                    "world": world
                })
                
                # Retrieve current tick's events and narrate them asynchronously
                tick_events = [e for e in world.get("events", []) if e.get("tick") == world["tick"]]
                if tick_events:
                    from backend.narrative.chronicle_compiler import process_tick_events
                    asyncio.create_task(process_tick_events(world["world_id"], world["tick"], tick_events))

                # Signal the tick event
                self._tick_event.set()
                # Yield control to allow subscribers to run
                await asyncio.sleep(0)
                self._tick_event.clear()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"!!! CLOCK ERROR: {e} !!!")
                await asyncio.sleep(5)
