# 💻 NULL_POINTER Console Frontend Specifications

The `NULL_POINTER` frontend console is built using Next.js, Framer Motion, and Zustand, rendering a cyberpunk styled glassmorphic operator dashboard.

---

## 🧠 Zustand State Management

All WebSocket synchronization and state caching are orchestrated in [src/store/simulationStore.ts](file:///c:/Users/tejas/Downloads/NULL_POINTER/frontend/src/store/simulationStore.ts). 

### Cached Parameters
* `worldId`: The active simulation identifier.
* `heat` & `stability`: Simulated state metrics.
* `logs`: Array of system events, operator outputs, and agent patches.
* `presenceList`: Active online operators in the current workspace.
* `activeAttack`: Current vulnerability details and timer parameters.
* `world`: Full copy of the latest database world snapshot.

### Socket Actions
* `initSocket(worldId)`: Spawns the WebSocket wrapper, handles auto-reconnections, and binds event handlers for broadcast types.
* `sendCommand(cmd)`: Dispatches text diagnostics or applies code patches via HTTP POST to the backend endpoint.

---

## 🎨 Layout & Key Interface Panels

The operator console dashboard splits the view into interactive control panels:

### 1. Terminal Console & Swarm Debugger
* Renders terminal-like log grids with scrolling buffers.
* visualizes dynamic agent trajectory states using responsive vector paths.

### 2. Sandbox Code Workspace
* Leverages `@monaco-editor/react` to render syntax-highlighted editors.
* Integrates a WASM script loader that resolves local executions using **Pyodide** when backend cloud sandboxing (E2B) is offline.
* Displays a state badge in the toolbar indicating `WASM Sandbox Active (Pyodide)` vs `Cloud Sandbox (E2B)`.

### 3. Trace Observability
* Clicking execution steps allows developers to inspect detailed agent outputs, parameters, latency metrics, and API tokens.

---

## 💄 Aesthetics & styling Guidelines

The console enforces neon-themed visual rules:

1. **Colors**: Tailored dark palettes using HSL:
   * Background: Deep slate values (`slate-950`).
   * Accent glow: Cyan (`#00f5ff`), purple (`#9d4edd`), and neon green (`#00FF41`).
2. **Typography**: Utilizes modern sci-fi typefaces:
   * Titles & Headings: `Orbitron` via Google Fonts.
   * Logs & Code: Code-friendly monospace (`Geist Mono`, `Fira Code`).
3. **Glassmorphism**: Backdrop blur overlays (`backdrop-blur-md`), dark border accents (`border-slate-900/60`), and subtle transparency.
