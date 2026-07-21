# Changelog

All notable changes to the **NULL_POINTER** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-07-21

### Added
* **Lab 4 Challenge (Resource Exhaustion)**: Registered and integrated "Resource Exhaustion: Infinite Loop Jail" challenge verifying loop-detection timeouts.
* **Crucible Labs Frontend UI Panel**: Added the interactive code editor, submission actions, and status updates for Lab 4 inside `CrucibleLabsPanel`.

### Changed
* **Windows-Safe Subprocess Sandbox**: Refactored the local sandbox execution fallback in `sandbox_executor.py` from `multiprocessing.Process` to a clean `subprocess.Popen` running `sys.executable -I` (Python isolation flags enabled) to resolve Windows spawn re-import loop recursion bugs.
* **Double-Stream JSON Transport**: Replaced direct memory-sharing pipe connections with serialized JSON communication over standard inputs and outputs.
* **Timeout Boundary Control**: Enforced strict timeout policies on subprocess communications to ensure infinite loop codes are aborted within 2 seconds.

---

## [1.1.0] - 2026-06-05

### Added
* **DevOps Orchestration**: Standardized `Dockerfile` configurations for both `/backend` and `/frontend`, complete with a root `docker-compose.yml` to spin up the entire application in a single command.
* **CI/CD Pipelines**: Automated GitHub Actions workflow (`ci-cd.yml`) to run lint validations, type-safety checks (`tsc --noEmit`), and python unit tests.
* **Onboarding Containers**: VS Code Remote Container configuration (`.devcontainer/devcontainer.json`) enabling automated workbench setups.
* **Community Governance**: Added root standard documentation files: `LICENSE` (MIT), `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, and issue/pull-request communication templates.

### Changed
* **UI/UX Aesthetics**: Refactored the entire frontend design to establish a cohesive, modern dark-mode console. Replaced all occurrences of clashing retro hacker green (`#00FF41`) with soft slates, cyans, and glowing purples.
* **Visual Grid & Map**: Shifted the Three.js Canvas to a transparent background layout, enabling parent noise gradients to bleed through. Upgraded orbit wireframes to vibrant purple grids (`#a855f7`) and added floating Purple crystal pyramids representing active swarm agents.

---

## [1.0.0] - 2026-06-04

### Added
* **LangGraph Resilience**: Timeout policies and retry jitter mechanisms in the Specialists nodes execution loop.
* **AST Context Compilation**: Static governance validator (`context_compiler.py`) checking logic inputs against structural boundaries and intent specifications.
* **Crucible Labs (DVLA)**: Sandbox Escape and Prompt Injection security red-teaming CTF challenges.
* **Interactive DAG Debugger**: SVG flowchart visualizing real-time routing trajectories.
* **Relational Memory (GraphRAG)**: Relational entity-link memory extraction panel.
* **Turbovec Accelerator**: Embedding quantization compression mock service.
* **WASM interpreter sandbox**: Pyodide loader falling back to client-side Python execution.
