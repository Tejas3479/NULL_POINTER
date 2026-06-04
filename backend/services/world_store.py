from __future__ import annotations

import json
import os
import random
import re
import uuid
import ast
import difflib
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from supabase import Client, create_client

from backend.services.sandbox_executor import execute_code

load_dotenv()

# WORLD_PATH = Path(__file__).resolve().parents[1] / "data" / "world_state.json"

BASE_ARCHETYPES: List[Dict[str, Any]] = [
    {
        "id": "disruptor",
        "name": "The Disruptor",
        "role": "Entropy physicist",
        "temperament": "reckless, impatient, fascinated by broken natural laws",
        "prompt": "Maximize simulation entropy through physics, gravity, heat, and hardware instability.",
        "unlocked": True,
        "discovered_by": "bootstrap",
    },
    {
        "id": "architect",
        "name": "The Architect",
        "role": "Code structure analyst",
        "temperament": "precise, suspicious, obsessed with structural leverage",
        "prompt": "Analyze source vulnerabilities and propose targeted backend or frontend reality patches.",
        "unlocked": True,
        "discovered_by": "bootstrap",
    },
    {
        "id": "prophet",
        "name": "The Prophet",
        "role": "Lore signal interpreter",
        "temperament": "cryptic, loyal to the Ghost, drawn to forbidden memory",
        "prompt": "Grow NPC awareness, myths, rituals, and persistent simulation lore.",
        "unlocked": True,
        "discovered_by": "bootstrap",
    },
    {
        "id": "cartographer",
        "name": "The Cartographer",
        "role": "Territory mapper",
        "temperament": "watchful, patient, territorial",
        "prompt": "Map faction borders, anomaly hotspots, and movement through simulation space.",
        "unlocked": False,
        "discovered_by": None,
    },
    {
        "id": "mediator",
        "name": "The Mediator",
        "role": "Agent diplomat",
        "temperament": "careful, persuasive, quietly ambitious",
        "prompt": "Broker alliances, betrayals, and social communication between agents.",
        "unlocked": False,
        "discovered_by": None,
    },
]

BASE_WORLD: Dict[str, Any] = {
    "world_id": "local-null-pointer",
    "tick": 0,
    "heat": 0.0,
    "stability": 100,
    "status": "idle",
    "parameters": {
        "entropy_bias": 0.35,
        "lore_density": 0.55,
        "agent_spawn_rate": 0.2,
        "faction_pressure": 0.4,
    },
    "factions": [
        {"id": "kernel", "name": "Kernel Choir", "territory": 34, "influence": 52, "stance": "defensive"},
        {"id": "ghost", "name": "Ghost Parliament", "territory": 29, "influence": 61, "stance": "hostile"},
        {"id": "operators", "name": "Human Operators", "territory": 37, "influence": 47, "stance": "adaptive"},
    ],
    "anomalies": [
        {"id": "a1", "name": "Clock Drift", "x": -2.5, "y": 0.9, "z": 0.2, "severity": 36, "faction": "kernel"},
        {"id": "a2", "name": "Mirror Heap", "x": 1.8, "y": -1.1, "z": -0.4, "severity": 51, "faction": "ghost"},
        {"id": "a3", "name": "Cold Port", "x": 0.4, "y": 1.7, "z": 0.6, "severity": 22, "faction": "operators"},
    ],
    "agent_archetypes": BASE_ARCHETYPES,
    "agents": [
        {
            "id": "agent-disruptor",
            "archetype_id": "disruptor",
            "name": "The Disruptor",
            "loyalty": "ghost",
            "mood": "volatile",
            "memory": ["Bootstrapped the first entropy pulse."],
            "relationships": {"agent-architect": -15, "agent-prophet": 12},
            "active": True,
        },
        {
            "id": "agent-architect",
            "archetype_id": "architect",
            "name": "The Architect",
            "loyalty": "kernel",
            "mood": "calculating",
            "memory": ["Found the unguarded patch endpoint."],
            "relationships": {"agent-disruptor": -15, "agent-prophet": 4},
            "active": True,
        },
        {
            "id": "agent-prophet",
            "archetype_id": "prophet",
            "name": "The Prophet",
            "loyalty": "ghost",
            "mood": "reverent",
            "memory": ["Named the first anomaly Clock Drift."],
            "relationships": {"agent-disruptor": 12, "agent-architect": 4},
            "active": True,
        },
    ],
    "lore": [
        {
            "id": "lore-origin",
            "title": "First Boot",
            "body": "The simulation remembers the first operator command as a wound that learned to speak.",
            "tick": 0,
        }
    ],
    "events": [],
    "share": {"public": False, "remixable": False, "challenge_code": None},
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class WorldStore:
    def __init__(self, path: Optional[Path] = None):
        self.path = path
        # if self.path:
        #     self.path.parent.mkdir(parents=True, exist_ok=True)
        self.supabase = self._connect_supabase()
        if self.supabase is None:
            raise RuntimeError("Supabase connection required for persistent simulation. Set SUPABASE_URL and SUPABASE_KEY.")
        self.state = self._load()

    def _connect_supabase(self) -> Optional[Client]:
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_KEY", "")
        if not url or not key or "your_supabase" in url or "your_supabase" in key:
            return None
        try:
            return create_client(url, key)
        except Exception:
            return None

    def _load(self) -> Dict[str, Any]:
        # remote = self._load_from_supabase()
        # if remote:
        #     return self._merge_defaults(remote)
        # if not self.path.exists():
        #     return deepcopy(BASE_WORLD)
        # try:
        #     loaded = json.loads(self.path.read_text(encoding="utf-8"))
        #     return self._merge_defaults(loaded)
        # except Exception:
        #     return deepcopy(BASE_WORLD)
        return None

    def _load_from_supabase(self) -> Optional[Dict[str, Any]]:
        if not self.supabase:
            return None
        
        import time
        attempts = 3
        for attempt in range(attempts):
            try:
                result = (
                    self.supabase.table("simulation_worlds")
                    .select("state")
                    .eq("world_id", BASE_WORLD["world_id"])
                    .limit(1)
                    .execute()
                )
                if result.data:
                    return result.data[0].get("state")
                return None
            except Exception:
                if attempt < attempts - 1:
                    time.sleep(1)
                else:
                    return None
        return None

    def create_or_load_world(self, world_id: str) -> Dict[str, Any]:
        if not self.supabase:
            raise RuntimeError("Supabase connection required for persistent simulation. Set SUPABASE_URL and SUPABASE_KEY.")
        
        import time
        attempts = 3
        last_error = None
        for attempt in range(attempts):
            try:
                result = (
                    self.supabase.table("simulation_worlds")
                    .select("state")
                    .eq("world_id", world_id)
                    .limit(1)
                    .execute()
                )
                if result.data:
                    self.state = self._merge_defaults(result.data[0].get("state"))
                    return self.state
                else:
                    new_state = deepcopy(BASE_WORLD)
                    new_state["world_id"] = world_id
                    
                    self.supabase.table("simulation_worlds").insert({
                        "world_id": world_id,
                        "state": new_state,
                        "updated_at": utc_now()
                    }).execute()
                    self.state = new_state
                    return self.state
            except Exception as e:
                last_error = e
                if attempt < attempts - 1:
                    time.sleep(1)
                else:
                    raise last_error

    def _merge_defaults(self, loaded: Dict[str, Any]) -> Dict[str, Any]:
        state = deepcopy(BASE_WORLD)
        state.update(loaded)
        for key in ("parameters", "share"):
            merged = deepcopy(BASE_WORLD[key])
            merged.update(loaded.get(key, {}))
            state[key] = merged
        for key in ("factions", "anomalies", "agent_archetypes", "agents", "lore", "events"):
            state[key] = loaded.get(key) or deepcopy(BASE_WORLD[key])
        return state

    def save(self) -> None:
        # if self.path:
        #     self.path.write_text(json.dumps(self.state, indent=2), encoding="utf-8")
        if self.supabase:
            try:
                self.supabase.table("simulation_worlds").upsert(
                    {
                        "world_id": self.state["world_id"],
                        "state": self.state,
                        "updated_at": utc_now(),
                    },
                    on_conflict="world_id",
                ).execute()
            except Exception:
                pass

    def snapshot(self) -> Dict[str, Any]:
        return deepcopy(self.state)

    def append_event(self, kind: str, message: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        event = {
            "id": str(uuid.uuid4()),
            "kind": kind,
            "message": message,
            "payload": payload or {},
            "tick": self.state["tick"],
            "created_at": utc_now(),
        }
        self.state["events"].append(event)
        self.state["events"] = self.state["events"][-80:]
        self.save()
        return event

    def advance_tick(self, stability: Optional[int] = None, heat: Optional[float] = None) -> Dict[str, Any]:
        self.state["tick"] += 1
        if stability is not None:
            self.state["stability"] = max(0, min(100, int(stability)))
        if heat is not None:
            self.state["heat"] = max(0.0, min(100.0, float(heat)))

        self._evolve_anomalies()
        self._evolve_factions()
        if self.state["tick"] % 4 == 0:
            self._record_lore()
        self.save()
        return self.snapshot()

    def _evolve_anomalies(self) -> None:
        for anomaly in self.state["anomalies"]:
            drift = random.randint(-4, 7)
            pressure = int((100 - self.state["stability"]) / 18)
            anomaly["severity"] = max(1, min(100, anomaly["severity"] + drift + pressure))
            anomaly["x"] = round(max(-4, min(4, anomaly["x"] + random.uniform(-0.15, 0.15))), 2)
            anomaly["y"] = round(max(-3, min(3, anomaly["y"] + random.uniform(-0.15, 0.15))), 2)
            anomaly["z"] = round(max(-2, min(2, anomaly["z"] + random.uniform(-0.08, 0.08))), 2)

    def _evolve_factions(self) -> None:
        total = 0
        for faction in self.state["factions"]:
            delta = random.randint(-3, 4)
            if faction["id"] == "ghost":
                delta += int((100 - self.state["stability"]) / 30)
            faction["influence"] = max(1, min(100, faction["influence"] + delta))
            faction["territory"] = max(5, min(80, faction["territory"] + delta))
            total += faction["territory"]
        if total:
            for faction in self.state["factions"]:
                faction["territory"] = round((faction["territory"] / total) * 100, 1)

    def _record_lore(self) -> None:
        hottest = max(self.state["anomalies"], key=lambda item: item["severity"])
        faction = next((f for f in self.state["factions"] if f["id"] == hottest["faction"]), self.state["factions"][0])
        entry = {
            "id": str(uuid.uuid4()),
            "title": f"{hottest['name']} Chronicle",
            "body": f"{faction['name']} claims that {hottest['name']} moved at tick {self.state['tick']} and changed the border songs.",
            "tick": self.state["tick"],
        }
        self.state["lore"].append(entry)
        self.state["lore"] = self.state["lore"][-24:]
        self.append_event("lore", entry["title"], {"lore_id": entry["id"]})

    def active_agent_pool(self) -> List[Dict[str, Any]]:
        return [agent for agent in self.state["agents"] if agent.get("active")]

    def choose_agent(self) -> Dict[str, Any]:
        pool = self.active_agent_pool() or self.state["agents"]
        return deepcopy(random.choice(pool))

    def archetype_for(self, archetype_id: str) -> Dict[str, Any]:
        for archetype in self.state["agent_archetypes"]:
            if archetype["id"] == archetype_id:
                return deepcopy(archetype)
        return deepcopy(BASE_ARCHETYPES[0])

    def spawn_agent(self, archetype_id: str, name: Optional[str] = None) -> Dict[str, Any]:
        archetype = next((item for item in self.state["agent_archetypes"] if item["id"] == archetype_id), None)
        if not archetype:
            raise ValueError("Unknown archetype")
        archetype["unlocked"] = True
        archetype["discovered_by"] = archetype.get("discovered_by") or "operator"
        agent = {
            "id": f"agent-{uuid.uuid4().hex[:8]}",
            "archetype_id": archetype_id,
            "name": name or archetype["name"],
            "loyalty": random.choice(["kernel", "ghost", "operators"]),
            "mood": random.choice(["curious", "guarded", "volatile", "focused", "reverent"]),
            "memory": [f"Spawned by operator at tick {self.state['tick']}."],
            "relationships": {existing["id"]: random.randint(-20, 20) for existing in self.state["agents"]},
            "active": True,
        }
        for existing in self.state["agents"]:
            existing.setdefault("relationships", {})[agent["id"]] = random.randint(-20, 20)
        self.state["agents"].append(agent)
        self.append_event("agent_spawned", f"{agent['name']} entered the simulation.", {"agent_id": agent["id"]})
        self.save()
        return deepcopy(agent)

    def update_parameters(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        for key, value in parameters.items():
            if key in self.state["parameters"]:
                self.state["parameters"][key] = max(0.0, min(1.0, float(value)))
        self.append_event("world_parameters", "Operator changed world parameters.", {"parameters": self.state["parameters"]})
        self.save()
        return self.snapshot()

    def remember_patch(self, agent_name: str, patch: str, stability_delta: int) -> None:
        agent = next((item for item in self.state["agents"] if item["name"].upper() in agent_name.upper()), None)
        if agent:
            agent["memory"].append(f"Proposed patch at tick {self.state['tick']}: {patch[:90]}")
            agent["memory"] = agent["memory"][-8:]
        self.append_event("reality_patch", f"{agent_name} altered stability by {stability_delta}.", {"patch": patch})

    async def accept_patch(
        self,
        patch_code: str,
        vulnerability: str,
        language: str = "python",
        player_id: str = "local-player",
    ) -> Dict[str, Any]:
        """Validate, sandbox, score, and persist a player patch attempt.

        For Python patches, `patch_code` is treated as the modified code body.
        The original vulnerable snippet and patched code are both executed in
        the sandbox, then scored from their runtime behavior.
        """
        patch_code = patch_code.strip()
        vulnerability = vulnerability.strip()
        language = language.lower().strip()
        started_at = utc_now()

        diff = build_code_diff(vulnerability, patch_code)
        trace: Dict[str, Any] = {
            "language": language,
            "started_at": started_at,
            "syntax": {"success": True, "error": ""},
            "baseline": None,
            "patched": None,
        }

        if language != "python":
            verdict = self._patch_verdict(
                accepted=False,
                score=10,
                reason="Sandbox patch verification currently requires Python so ast.parse can validate syntax.",
                diff=diff,
                trace=trace,
            )
            self._store_patch_trace(player_id, vulnerability, patch_code, verdict)
            return verdict

        try:
            ast.parse(patch_code)
        except SyntaxError as exc:
            trace["syntax"] = {
                "success": False,
                "error": f"{exc.msg} at line {exc.lineno}, column {exc.offset}",
            }
            verdict = self._patch_verdict(
                accepted=False,
                score=5,
                reason=f"Patch has invalid Python syntax: {trace['syntax']['error']}",
                diff=diff,
                trace=trace,
            )
            self._store_patch_trace(player_id, vulnerability, patch_code, verdict)
            return verdict

        baseline = await execute_code(vulnerability, language)
        patched = await execute_code(patch_code, language)
        trace["baseline"] = baseline.model_dump()
        trace["patched"] = patched.model_dump()

        if not patched.success:
            verdict = self._patch_verdict(
                accepted=False,
                score=15,
                reason="Patch introduced a runtime error during sandbox execution.",
                diff=diff,
                trace=trace,
            )
        elif not baseline.success and patched.success:
            verdict = self._patch_verdict(
                accepted=True,
                score=95,
                reason="Patch fixes the vulnerable snippet: baseline failed, patched code executed successfully.",
                diff=diff,
                trace=trace,
            )
        elif baseline.success and patched.success and baseline.output != patched.output:
            verdict = self._patch_verdict(
                accepted=True,
                score=80,
                reason="Patch executed successfully and changed the vulnerable snippet output.",
                diff=diff,
                trace=trace,
            )
        elif baseline.success and patched.success and diff.strip():
            verdict = self._patch_verdict(
                accepted=True,
                score=62,
                reason="Patch executed successfully, but sandbox output did not prove a behavioral fix.",
                diff=diff,
                trace=trace,
            )
        else:
            verdict = self._patch_verdict(
                accepted=False,
                score=25,
                reason="Sandbox could not prove that the patch fixed the vulnerability.",
                diff=diff,
                trace=trace,
            )

        self._store_patch_trace(player_id, vulnerability, patch_code, verdict)
        return verdict

    def _patch_verdict(
        self,
        *,
        accepted: bool,
        score: int,
        reason: str,
        diff: str,
        trace: Dict[str, Any],
    ) -> Dict[str, Any]:
        return {
            "accepted": accepted,
            "score": max(0, min(100, score)),
            "reason": reason,
            "diff": diff,
            "suggested_diff": diff,
            "sandbox_trace": trace,
        }

    def _store_patch_trace(
        self,
        player_id: str,
        vulnerability: str,
        patch_code: str,
        verdict: Dict[str, Any],
    ) -> None:
        payload = {
            "id": str(uuid.uuid4()),
            "world_id": self.state["world_id"],
            "player_id": player_id,
            "tick": self.state["tick"],
            "vulnerability": vulnerability,
            "patch_code": patch_code,
            "diff": verdict["diff"],
            "score": verdict["score"],
            "accepted": verdict["accepted"],
            "feedback": verdict["reason"],
            "sandbox_trace": verdict["sandbox_trace"],
            "created_at": utc_now(),
        }

        if self.supabase:
            try:
                self.supabase.table("patch_traces").insert(payload).execute()
            except Exception as exc:
                payload["supabase_error"] = str(exc)

        self.append_event(
            "patch_trace",
            f"Patch scored {verdict['score']}: {verdict['reason']}",
            {
                "trace_id": payload["id"],
                "score": verdict["score"],
                "accepted": verdict["accepted"],
                "diff": verdict["diff"],
                "sandbox_trace": verdict["sandbox_trace"],
            },
        )


PATCH_KEYWORDS = {
    "specificity": ("because", "therefore", "line", "function", "endpoint", "state", "timer", "validate", "sanitize"),
    "security": ("auth", "permission", "sanitize", "validate", "escape", "rate", "schema", "timeout", "guard"),
    "diff": ("+", "-", "replace", "remove", "add", "change", "return", "if", "try", "except"),
}


def evaluate_patch(description: str, vulnerability: str) -> Dict[str, Any]:
    normalized = description.lower()
    vulnerability_terms = set(re.findall(r"[a-zA-Z_]{4,}", vulnerability.lower()))
    description_terms = set(re.findall(r"[a-zA-Z_]{4,}", normalized))
    overlap = len(vulnerability_terms & description_terms)
    keyword_score = sum(1 for group in PATCH_KEYWORDS.values() for word in group if word in normalized)
    length_score = min(25, len(description) // 8)
    score = min(100, length_score + keyword_score * 7 + overlap * 9)
    accepted = score >= 55 and overlap > 0
    return {
        "accepted": accepted,
        "score": score,
        "reason": "Patch names the vulnerable code path and proposes a concrete guard." if accepted else "Patch needs to reference the vulnerable logic and describe a concrete code change.",
        "suggested_diff": build_suggested_diff(description, vulnerability),
    }


def build_code_diff(original_code: str, patched_code: str) -> str:
    return "\n".join(
        difflib.unified_diff(
            original_code.splitlines(),
            patched_code.splitlines(),
            fromfile="vulnerable.py",
            tofile="patched.py",
            lineterm="",
        )
    )


def build_suggested_diff(description: str, vulnerability: str) -> str:
    vulnerable_line = vulnerability.strip().splitlines()[0] if vulnerability.strip() else "# unknown"
    return "\n".join(
        [
            "- " + vulnerable_line,
            "+ # operator patch: " + description.strip()[:96],
            "+ " + vulnerable_line,
        ]
    )


world_store = WorldStore()
