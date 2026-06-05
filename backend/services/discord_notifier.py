import urllib.request
import json
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, Optional

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()

async def send_webhook(url: str, data: dict):
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "User-Agent": "NULL_POINTER-Webhook-Bot"
            },
            method="POST"
        )
        def perform_request():
            with urllib.request.urlopen(req, timeout=5) as res:
                res.read()
        await asyncio.to_thread(perform_request)
    except Exception as e:
        print(f"!!! Discord Webhook Alert Failed: {e} !!!")

async def trigger_discord_notification(world_id: str, event_kind: str, message: str, payload: Optional[Dict[str, Any]] = None):
    # Import world_store inside function to avoid circular imports
    from backend.services.world_store import world_store
    
    webhook_url = None
    if world_store.state and world_store.state.get("world_id") == world_id:
        webhook_url = world_store.state.get("share", {}).get("discord_webhook")
    elif world_store.supabase:
        try:
            res = world_store.supabase.table("simulation_worlds").select("state").eq("world_id", world_id).limit(1).execute()
            if res.data:
                webhook_url = res.data[0]["state"].get("share", {}).get("discord_webhook")
        except Exception as e:
            print(f"!!! Error looking up webhook URL: {e} !!!")

    if not webhook_url or not webhook_url.startswith("http"):
        return

    # Map cyberpunk theme embed colors
    color = 0x8B949E  # grey default
    if event_kind == "stability_critical":
        color = 0xEF4444  # red
    elif event_kind == "agent_alliance_formed":
        color = 0x10B981  # emerald
    elif event_kind == "ghost_variant_promoted":
        color = 0xA855F7  # purple

    embed = {
        "title": f"👾 NULL_POINTER Alert: {event_kind.replace('_', ' ').upper()}",
        "description": message,
        "color": color,
        "fields": [
            {"name": "World ID", "value": world_id, "inline": True},
            {"name": "Timestamp", "value": utc_now(), "inline": True}
        ],
        "footer": {
            "text": "NULL_POINTER Timeline Monitor"
        }
    }
    
    discord_data = {
        "embeds": [embed]
    }
    
    await send_webhook(webhook_url, discord_data)
