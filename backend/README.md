# 🐍 NULL_POINTER Backend Architecture & API Specifications

The `NULL_POINTER` backend is built with FastAPI, providing asynchronous API routers, real-time WebSocket channels, sandboxed execution pools, and LangGraph-driven multi-agent simulations.

---

## 🔒 Authentication & Role-Based Access Control

The platform enforces JWT authentication via [auth/oauth2.py](file:///c:/Users/tejas/Downloads/NULL_POINTER/backend/auth/oauth2.py). It parses and validates claims to construct the `User` object, determining their role:

1. **ADMIN**: Full control over world states, parameter overrides, and agent resets.
2. **DEVELOPER**: Access to patch submissions, sandbox environments, and tracer stats.
3. **VIEWER**: Read-only observation of simulation loops, logs, and graphs.

### Clerk & SSO Fallbacks
In staging/production environments, signature verification occurs against public keys. In local development environments, it supports an unverified local bypass fallback (impersonating predefined mock keys) to ease environment configuration.

---

## 📡 WebSockets Real-Time Channels

The server hosts a WebSocket connection manager at `ws://127.0.0.1:8000/ws/heat` to synchronize operators and broadcast telemetry.

### Outgoing Messages (Broadcasts)
* `presence_update`: Informs all operators when a developer/admin joins or exits.
* `heat_update`: Periodic update of the system thermal metric.
* `reality_patch`: Broadcasts the specialist agent's proposed patches, stability changes, and log text.
* `source_attack`: Notifies developers of target code vulnerabilities injected by anomalies.
* `attack_result`: Broadcasts patch success, scoring delta, and updated stability.

### Incoming Messages (Operator Commands)
* `debug_command`: Allows admins to issue shell-like terminal utilities.

---

## 🛠️ FastAPI Endpoint Index

All endpoints require JWT authorization credentials passed via headers or cookies:

### 1. Simulation Controls
* **`GET /v1/simulation/world`**
  Returns the active snapshot of the simulation world state (tick, parameters, agents, events, anomalies).
* **`POST /v1/simulation/world/parameters`**
  Updates dynamic parameters (e.g. `entropy_bias`, `faction_pressure`).
* **`POST /v1/simulation/agents/spawn`**
  Spawns an agent archetype with an optional custom name.
* **`POST /v1/simulation/reset`**
  Resets the entire simulation to tick zero, recreating basic anomalies and agent arrays.

### 2. Sandbox Execution Router
* **`POST /v1/sandbox/execute`**
  Receives a code snippet and language target ("python" or "javascript") and executes it in isolation.
* **`GET /v1/sandbox/health`**
  Triggers a baseline script execute inside the sandbox to verify runner readiness.

---

## 🪵 Sandbox Execution Internals

The [sandbox_executor.py](file:///c:/Users/tejas/Downloads/NULL_POINTER/backend/services/sandbox_executor.py) selects execution providers dynamically:
1. **E2B Sandboxing**: Spawns isolated microVMs via the E2B SDK if API keys are set.
2. **Docker Sandboxing**: Invokes local container instances with capabilities dropped, memory bounded, and network connectivity blocked.
3. **Hardened Subprocess Sandbox (Local fallback)**: Spawns a dedicated child worker using `multiprocessing.Process`. It validates the code via `secure_ast_filter` and compiles the script using a sandboxed `__builtins__` map (`SAFE_BUILTINS`) to capture stdout/stderr over pipes.
