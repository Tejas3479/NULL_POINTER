import uuid
from typing import List, Dict, Any
from backend.services.world_store import world_store, utc_now
from backend.utils.websocket_manager import manager
from backend.narrative.event_narrator import generate_narrative_paragraph, get_event_faction

async def process_tick_events(world_id: str, tick: int, events: List[Dict[str, Any]]):
    """Processes tick events, compiles narrative paragraphs, updates Supabase & state lore, and broadcasts WS updates.
    """
    entries = []
    for event in events:
        # Ignore lore events to avoid narrative loops (since narrative compiles lore)
        if event.get("kind") == "lore":
            continue
            
        # Generate narrative text
        paragraph = generate_narrative_paragraph(event)
        faction_id = get_event_faction(event)
        
        entry = {
            "id": str(uuid.uuid4()),
            "world_id": world_id,
            "tick": tick,
            "title": f"Tick {tick}: {event.get('kind', 'LOG').upper()}",
            "body": paragraph,
            "faction": faction_id,
            "created_at": utc_now()
        }
        entries.append(entry)

    if not entries:
        return

    # 1. Bulk store in Supabase chronicle_entries
    if world_store.supabase:
        try:
            world_store.supabase.table("chronicle_entries").insert(entries).execute()
        except Exception as e:
            print(f"!!! Error writing to chronicle_entries table: {e} !!!")
            
    # 2. Append to state lore
    if world_store.state:
        for entry in entries:
            world_store.state.setdefault("lore", []).append({
                "id": entry["id"],
                "title": entry["title"],
                "body": entry["body"],
                "tick": tick
            })
        # Limit lore state array size to keep state payload optimal
        world_store.state["lore"] = world_store.state["lore"][-80:]
        world_store.save()
        
    # 3. Broadcast WebSocket narrative update
    for entry in entries:
        await manager.broadcast({
            "type": "narrative_update",
            "entry": entry
        })


async def initialize_new_world_narrative(world_id: str, parameters: dict):
    """Generates the creation myth and faction backstories for a new world,
    saves them to state and Supabase, and broadcasts a WebSocket update.
    """
    from backend.narrative.world_gen import generate_myth
    from backend.narrative.faction_gen import generate_backstory

    # 1. Generate creation myth
    myth = generate_myth(world_id, parameters)

    # 2. Update state factions backstories
    if world_store.state and world_store.state.get("world_id") == world_id:
        factions = world_store.state.setdefault("factions", [])
        for faction in factions:
            faction_id = faction.get("id")
            faction_name = faction.get("name", faction_id)
            backstory = generate_backstory(faction_id, faction_name, myth)
            faction["backstory"] = backstory

        # Add myth to lore
        myth_entry = {
            "id": f"lore-myth-{uuid.uuid4().hex[:8]}",
            "title": myth.get("title", "Digital Genesis"),
            "body": myth.get("body", "The universe was initialized from the void."),
            "tick": 0
        }
        world_store.state.setdefault("lore", []).append(myth_entry)
        world_store.state["lore"] = world_store.state["lore"][-80:]
        world_store.save()

        # 3. Insert creation myth chronicle entry into Supabase
        entry = {
            "id": myth_entry["id"],
            "world_id": world_id,
            "tick": 0,
            "title": f"Genesis: {myth_entry['title']}",
            "body": myth_entry["body"],
            "faction": "operators",  # Genesis is done by operator/system
            "created_at": utc_now()
        }

        if world_store.supabase:
            try:
                world_store.supabase.table("chronicle_entries").insert(entry).execute()
            except Exception as e:
                print(f"!!! Error writing myth to chronicle_entries: {e} !!!")

        # 4. Broadcast WS narrative update
        await manager.broadcast({
            "type": "narrative_update",
            "entry": entry
        })
