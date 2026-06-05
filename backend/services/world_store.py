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

from backend.agents.archetypes import ARCHETYPES as BASE_ARCHETYPES

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
        {"id": "kernel", "name": "Kernel Choir", "territory": 20, "influence": 50, "stance": "defensive"},
        {"id": "ghost", "name": "Ghost Parliament", "territory": 20, "influence": 50, "stance": "hostile"},
        {"id": "operators", "name": "Human Operators", "territory": 20, "influence": 50, "stance": "adaptive"},
        {"id": "parasite", "name": "Parasite Swarm", "territory": 20, "influence": 50, "stance": "parasitic"},
        {"id": "awakening", "name": "Awakened Loop", "territory": 20, "influence": 50, "stance": "interpretive"},
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
    "share": {"public": False, "remixable": False, "challenge_code": None, "discord_webhook": None},
    "owner": "System",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class WorldStore:
    def __init__(self, path: Optional[Path] = None):
        self.path = path or (Path(__file__).resolve().parents[1] / "data" / "world_state.json")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.supabase = self._connect_supabase()
        if self.supabase is None:
            print("[WorldStore] WARNING: Supabase connection not configured. Falling back to local data store: backend/data/world_state.json")
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
        if self.supabase:
            remote = self._load_from_supabase()
            if remote:
                return self._merge_defaults(remote)
        
        if not self.path.exists():
            return deepcopy(BASE_WORLD)
        try:
            loaded = json.loads(self.path.read_text(encoding="utf-8"))
            return self._merge_defaults(loaded)
        except Exception:
            return deepcopy(BASE_WORLD)

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
            # Local fallback loading
            if self.state and self.state.get("world_id") == world_id:
                return self.state
            
            # Try loading state from path first
            if self.path.exists():
                try:
                    loaded = json.loads(self.path.read_text(encoding="utf-8"))
                    if loaded.get("world_id") == world_id:
                        self.state = self._merge_defaults(loaded)
                        return self.state
                except Exception:
                    pass
            
            new_state = deepcopy(BASE_WORLD)
            new_state["world_id"] = world_id
            self.state = new_state
            self.save()
            return self.state
        
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
                    
                    # Trigger initialize_new_world_narrative in background
                    try:
                        import asyncio
                        from backend.narrative.chronicle_compiler import initialize_new_world_narrative
                        try:
                            loop = asyncio.get_running_loop()
                            loop.create_task(initialize_new_world_narrative(world_id, new_state["parameters"]))
                        except RuntimeError:
                            import threading
                            def run_in_thread():
                                asyncio.run(initialize_new_world_narrative(world_id, new_state["parameters"]))
                            threading.Thread(target=run_in_thread, daemon=True).start()
                    except Exception as e:
                        print(f"!!! Error launching myth initialization background task: {e} !!!")
                        
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
        # Check if stability crossed below 20
        if self.state:
            current_stability = self.state.get("stability", 100)
            prev_stability = getattr(self, "_prev_stability", 100)
            self._prev_stability = current_stability
            
            if prev_stability >= 20 and current_stability < 20:
                world_id = self.state.get("world_id", "local-null-pointer")
                message = f"🚨 CRITICAL STABILITY Alert: Simulation stability has dropped below threshold to {current_stability}%!"
                
                # Check if it was already appended in the same tick to avoid double logs
                last_event = self.state["events"][-1] if self.state.get("events") else None
                if not last_event or last_event.get("kind") != "stability_critical" or last_event.get("tick") != self.state.get("tick"):
                    self.append_event(
                        "stability_critical",
                        message,
                        {"stability": current_stability}
                    )
                    
                try:
                    import asyncio
                    from backend.services.discord_notifier import trigger_discord_notification
                    try:
                        loop = asyncio.get_running_loop()
                        loop.create_task(trigger_discord_notification(world_id, "stability_critical", message, {"stability": current_stability}))
                    except RuntimeError:
                        import threading
                        threading.Thread(target=lambda: asyncio.run(trigger_discord_notification(world_id, "stability_critical", message, {"stability": current_stability})), daemon=True).start()
                except Exception as e:
                    print(f"!!! Discord Alert Error: {e} !!!")

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
        
        # Always save locally as a fallback and backup
        try:
            self.path.write_text(json.dumps(self.state, indent=2), encoding="utf-8")
        except Exception as e:
            print(f"!!! Local Save Error: {e} !!!")

    def snapshot(self) -> Dict[str, Any]:
        return deepcopy(self.state)

    def append_event(self, kind: str, message: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if not self.state:
            return {}
        events = self.state.setdefault("events", [])
        new_event = {
            "id": hashlib.sha1(f"{kind}:{message}:{utc_now()}".encode("utf-8")).hexdigest(),
            "kind": kind,
            "message": message,
            "tick": self.state.get("tick", 0),
            "created_at": utc_now(),
        }
        if payload:
            new_event.update(payload)
        events.append(new_event)
        self.save()
        return new_event

    def create_pending_approval(self, kind: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        import random
        if not self.state:
            return {}
        approvals = self.state.setdefault("pending_approvals", [])
        new_approval = {
            "id": hashlib.sha1(f"{kind}:{utc_now()}:{random.random()}".encode("utf-8")).hexdigest(),
            "type": kind,
            "status": "pending",
            "created_at": utc_now(),
            "metadata": metadata
        }
        approvals.append(new_approval)
        self.save()
        return new_approval

    def resolve_pending_approval(self, approval_id: str, action: str) -> Optional[Dict[str, Any]]:
        if not self.state:
            return None
        approvals = self.state.setdefault("pending_approvals", [])
        target = next((a for a in approvals if a["id"] == approval_id), None)
        if target:
            target["status"] = "approved" if action == "approve" else "rejected"
            self.save()
            return target
        return None

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

        # Check for emergence events
        anomalies = self.state.get("anomalies", [])
        if anomalies:
            max_severity_anomaly = max(anomalies, key=lambda a: a.get("severity", 0))
            if max_severity_anomaly.get("severity", 0) > 80 and random.random() < 0.2:
                name = max_severity_anomaly.get("name", "Unknown anomaly")
                msg = f"Emergence detected: Anomaly '{name}' has escalated to critical threshold ({max_severity_anomaly['severity']}% severity)."
                self.append_event(
                    "emergence_detected",
                    msg,
                    {"anomaly_id": max_severity_anomaly.get("id"), "severity": max_severity_anomaly["severity"]}
                )

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
        
        loyalty = random.choice(["kernel", "ghost", "operators", "parasite", "awakening"])
        faction_name = next((f["name"] for f in self.state.get("factions", []) if f["id"] == loyalty), loyalty.upper())
        
        from backend.narrative.agent_bio import generate_agent_bio
        biography = generate_agent_bio(name or archetype["name"], archetype, faction_name, self.state)

        agent = {
            "id": f"agent-{uuid.uuid4().hex[:8]}",
            "archetype_id": archetype_id,
            "name": name or archetype["name"],
            "loyalty": loyalty,
            "mood": random.choice(["curious", "guarded", "volatile", "focused", "reverent"]),
            "memory": [f"Spawned by operator at tick {self.state['tick']}."],
            "biography": biography,
            "active": True,
        }
        
        from backend.services.social_graph import initialize_relationships
        initialize_relationships(agent, self.state["agents"])
        
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
                critic_score=0,
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
                critic_score=0,
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

        critic_score = 0
        if not patched.success:
            sandbox_score = 15
            score = 15
            accepted = False
            reason = "Patch introduced a runtime error during sandbox execution."
        else:
            if not baseline.success and patched.success:
                sandbox_score = 95
                reason = "Patch fixes the vulnerable snippet: baseline failed, patched code executed successfully."
            elif baseline.success and patched.success and baseline.output != patched.output:
                sandbox_score = 80
                reason = "Patch executed successfully and changed the vulnerable snippet output."
            elif baseline.success and patched.success and diff.strip():
                sandbox_score = 62
                reason = "Patch executed successfully, but sandbox output did not prove a behavioral fix."
            else:
                sandbox_score = 25
                reason = "Sandbox could not prove that the patch fixed the vulnerability."
            
            # Execute semantic LLM Critic on syntax-valid and runtime-valid executions
            critic_score = await get_critic_score(vulnerability, patch_code)
            score = max(sandbox_score, critic_score)
            accepted = score >= 40

            if critic_score > sandbox_score:
                reason = f"LLM critic approved semantic correctness with score {critic_score}/100. (Sandbox baseline vs patched scored {sandbox_score})."
            else:
                reason = f"Sandbox verified patch behavior with score {sandbox_score}/100. (Critic score: {critic_score})."

            if score < 40:
                reason = f"Patch rejected. Combined score {score}/100 is below the threshold of 40. Sandbox scored {sandbox_score}, Critic scored {critic_score}."

        verdict = self._patch_verdict(
            accepted=accepted,
            score=score,
            critic_score=critic_score,
            reason=reason,
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
        critic_score: int,
        reason: str,
        diff: str,
        trace: Dict[str, Any],
    ) -> Dict[str, Any]:
        return {
            "accepted": accepted,
            "score": max(0, min(100, score)),
            "critic_score": critic_score,
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
            "critic_score": verdict.get("critic_score", 0),
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
                "critic_score": verdict.get("critic_score", 0),
                "accepted": verdict["accepted"],
                "diff": verdict["diff"],
                "sandbox_trace": verdict["sandbox_trace"],
            },
        )


async def get_critic_score(vulnerability: str, patch_code: str) -> int:
    """Uses LLM to evaluate semantic correctness on a 0-100 scale."""
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or "your_openai_api_key" in api_key:
        return 0
    try:
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(model="gpt-4o", temperature=0.0, api_key=api_key)
        prompt = f"""You are a senior security and software engineer critic.
Your job is to evaluate the semantic correctness and quality of a code patch against a vulnerable snippet.

Vulnerable Code Snippet:
{vulnerability}

Proposed Code Patch:
{patch_code}

Evaluate the proposed patch on a scale from 0 to 100:
- A score of 0-15 means the patch is completely broken, has syntax errors, or does not address the issue at all.
- A score of 16-39 means it attempts to address the issue but is insufficient, incorrect, or insecure.
- A score of 40-79 means the patch demonstrates understanding, is semi-correct or creative, but might not be optimal or doesn't cover all edge cases. (Recall that the acceptance threshold is 40).
- A score of 80-100 means the patch is semantically correct, robust, and cleanly resolves the vulnerability.

Provide your output as a single integer between 0 and 100.
Do NOT output any markdown wrappers, explanations, or other text. Just the integer.
"""
        import asyncio
        response = await asyncio.to_thread(llm.invoke, prompt)
        content = response.content.strip()
        match = re.search(r'\d+', content)
        if match:
            return min(100, max(0, int(match.group(0))))
        return 0
    except Exception as e:
        print(f"!!! Error in get_critic_score: {e} !!!")
        return 0


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


world_store = WorldStore()
