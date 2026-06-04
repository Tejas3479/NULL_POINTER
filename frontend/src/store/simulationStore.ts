import { create } from 'zustand';

export interface LogEntry {
  id: string;
  type: 'ghost' | 'system' | 'player' | 'error' | 'success' | 'warning';
  text: string;
  timestamp: string;
}

export interface ActiveAttack {
  file: string;
  vulnerability: string;
  message: string;
  timeout: number;
  startTime: number;
}

export interface SimulationWorld {
  world_id: string;
  tick: number;
  heat: number;
  stability: number;
  parameters: Record<string, number>;
  factions: Array<{ id: string; name: string; territory: number; influence: number; stance: string }>;
  anomalies: Array<{ id: string; name: string; x: number; y: number; z: number; severity: number; faction: string }>;
  agent_archetypes: Array<{ id: string; name: string; role: string; temperament: string; unlocked: boolean }>;
  agents: Array<{ id: string; archetype_id: string; name: string; loyalty: string; mood: string; memory: string[]; active: boolean; biography?: string }>;
  lore: Array<{ id: string; title: string; body: string; tick: number }>;
  events: Array<{ id: string; kind: string; message: string; tick: number; created_at: string }>;
  share?: {
    public: boolean;
    remixable?: boolean;
  };
  view_count?: number;
}

export interface ChronicleEntry {
  id: string;
  world_id: string;
  tick: number;
  title: string;
  body: string;
  faction: string;
  created_at: string;
}

interface SimulationState {
  worldId: string | null;
  heat: number;
  stability: number;
  logs: LogEntry[];
  isConnected: boolean;
  activeAttack: ActiveAttack | null;
  world: SimulationWorld | null;
  presenceList: Array<{ username: string; role: string }>;
  chronicleEntries: ChronicleEntry[];
  userRole: string | null;
  username: string | null;
  
  socket: WebSocket | null;
  apiBase: string;

  setWorldId: (id: string | null) => void;
  setHeat: (heat: number) => void;
  setStability: (stability: number) => void;
  setLogs: (logs: LogEntry[] | ((prev: LogEntry[]) => LogEntry[])) => void;
  setIsConnected: (connected: boolean) => void;
  setActiveAttack: (attack: ActiveAttack | null) => void;
  setWorld: (world: SimulationWorld | null) => void;
  setPresenceList: (players: Array<{ username: string; role: string }>) => void;
  setChronicleEntries: (entries: ChronicleEntry[] | ((prev: ChronicleEntry[]) => ChronicleEntry[])) => void;
  setUserRole: (role: string | null) => void;
  setUsername: (name: string | null) => void;
  
  initSocket: (worldId: string) => () => void;
  sendCommand: (command: string) => Promise<void>;
  updateWorldParameter: (key: string, value: number) => Promise<void>;
  spawnAgent: (archetypeId: string, name?: string) => Promise<void>;
  resetSimulation: (seedAgents?: Record<string, number>) => Promise<void>;
  injectEntropy: () => Promise<void>;
}

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '1';
  const match = document.cookie.match(new RegExp('(^| )csrf_token=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : '1';
};

export const useSimulationStore = create<SimulationState>((set, get) => ({
  worldId: null,
  heat: 100,
  stability: 100,
  logs: [],
  isConnected: false,
  activeAttack: null,
  world: null,
  presenceList: [],
  chronicleEntries: [],
  socket: null,
  apiBase: 'http://localhost:8000',
  userRole: null,
  username: null,

  setWorldId: (id) => set({ worldId: id }),
  setHeat: (heat) => set({ heat }),
  setStability: (stability) => set({ stability }),
  setLogs: (logs) => set((state) => ({ logs: typeof logs === 'function' ? logs(state.logs) : logs })),
  setIsConnected: (isConnected) => set({ isConnected }),
  setActiveAttack: (activeAttack) => set({ activeAttack }),
  setWorld: (world) => set({ world }),
  setPresenceList: (presenceList) => set({ presenceList }),
  setChronicleEntries: (chronicleEntries) => set((state) => ({ 
    chronicleEntries: typeof chronicleEntries === 'function' ? chronicleEntries(state.chronicleEntries) : chronicleEntries 
  })),
  setUserRole: (userRole) => set({ userRole }),
  setUsername: (username) => set({ username }),

  initSocket: (worldId: string) => {
    const { socket: existingSocket } = get();
    if (existingSocket) {
      existingSocket.close();
    }

    const apiBase = 'http://localhost:8000';
    const wsBaseUrl = 'ws://127.0.0.1:8000/ws/heat';
    
    // Fetch initial world snapshot
    fetch(`${apiBase}/v1/simulation/world`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error("Unauthorized");
        return res.json();
      })
      .then((data) => {
        set({ world: data, heat: data.heat ?? 100, stability: data.stability ?? 100 });
      })
      .catch(() => undefined);

    // Fetch initial chronicle history
    fetch(`${apiBase}/v1/simulation/${worldId}/chronicle`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error("Chronicle fetch failed");
        return res.json();
      })
      .then((data) => {
        set({ chronicleEntries: data });
      })
      .catch(() => undefined);

    const getJwtToken = (): string => {
      if (typeof document === 'undefined') return '';
      const match = document.cookie.match(new RegExp('(^| )jwt_token=([^;]*)'));
      return match ? decodeURIComponent(match[2]) : '';
    };

    const tokenVal = getJwtToken();
    const wsUrl = new URL(wsBaseUrl);
    wsUrl.searchParams.set("world_id", worldId);
    if (tokenVal) {
      wsUrl.searchParams.set("token", tokenVal);
    }

    const socket = new WebSocket(wsUrl.toString());
    set({ socket, worldId, apiBase, isConnected: false });

    socket.onopen = () => set({ isConnected: true });
    socket.onclose = () => set({ isConnected: false });
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const timestamp = new Date().toLocaleTimeString([], { hour12: false });

      if (data.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      if (data.type === 'presence_update') {
        set({ presenceList: data.players || [] });
      } else if (data.type === 'player_joined') {
        set((state) => ({
          logs: [...state.logs, {
            id: Date.now().toString(),
            type: 'system',
            text: `Operator ${data.player.username} (${data.player.role}) connected to this terminal session.`,
            timestamp
          }]
        }));
      } else if (data.type === 'player_left') {
        set((state) => ({
          logs: [...state.logs, {
            id: Date.now().toString(),
            type: 'system',
            text: `Operator ${data.player.username} disconnected from this session.`,
            timestamp
          }]
        }));
      } else if (data.type === 'heat_update') {
        set({ heat: data.value });
      } else if (data.type === 'reality_patch') {
        set((state) => ({
          stability: data.stability,
          world: data.world || state.world,
          logs: [
            ...state.logs,
            ...data.logs.map((msg: string, i: number) => ({
              id: `${Date.now()}-${i}`,
              type: 'ghost' as const,
              text: msg,
              timestamp
            }))
          ]
        }));
      } else if (data.type === 'admin_response') {
        set((state) => ({
          logs: [...state.logs, {
            id: Date.now().toString(),
            type: 'system',
            text: data.message,
            timestamp
          }]
        }));
      } else if (data.type === 'source_attack') {
        set((state) => ({
          activeAttack: {
            ...data,
            startTime: Date.now()
          },
          logs: [...state.logs, {
            id: Date.now().toString(),
            type: 'error',
            text: `!!! VULNERABILITY DETECTED in ${data.file} !!!`,
            timestamp
          }]
        }));
      } else if (data.type === 'attack_result') {
        set((state) => ({
          activeAttack: null,
          logs: [...state.logs, {
            id: Date.now().toString(),
            type: data.status === 'failed' ? 'error' : 'success',
            text: data.message,
            timestamp
          }],
          heat: data.new_heat !== undefined ? data.new_heat : state.heat,
          stability: data.new_stability !== undefined ? data.new_stability : state.stability,
          world: data.world || state.world
        }));
      } else if (data.type === 'world_update' || data.type === 'agent_spawned') {
        set((state) => ({
          world: data.world || state.world,
          logs: data.message ? [...state.logs, {
            id: Date.now().toString(),
            type: 'system',
            text: data.message,
            timestamp
          }] : state.logs
        }));
      } else if (data.type === 'narrative_update' && data.entry) {
        const newEntry: ChronicleEntry = data.entry;
        if (newEntry.world_id === worldId) {
          set((state) => {
            if (state.chronicleEntries.some(e => e.id === newEntry.id)) return state;
            return {
              chronicleEntries: [newEntry, ...state.chronicleEntries]
            };
          });
        }
      }
    };

    return () => {
      socket.close();
      set({ socket: null, isConnected: false });
    };
  },

  sendCommand: async (command: string) => {
    const { socket, activeAttack, apiBase } = get();
    if (socket?.readyState === WebSocket.OPEN) {
      if (command.toLowerCase().startsWith('patch ') && activeAttack) {
        const description = command.substring(6);
        try {
          const res = await fetch(`${apiBase}/v1/simulation/patch`, {
            method: 'POST',
            credentials: 'include',
            headers: { 
              'Content-Type': 'application/json',
              'X-CSRF-Token': getCsrfToken()
            },
            body: JSON.stringify({ description })
          });
          const result = await res.json();
          
          if (result.status === 'patched') {
            // Success broadcast handled over WebSocket
          } else {
            set((state) => ({
              logs: [...state.logs, {
                id: Date.now().toString(),
                type: 'error',
                text: result.message,
                timestamp: new Date().toLocaleTimeString([], { hour12: false })
              }]
            }));
          }
        } catch (e) {
          console.error("Patch failed", e);
        }
        return;
      }

      socket.send(JSON.stringify({
        type: 'debug_command',
        command
      }));
      
      set((state) => ({
        logs: [...state.logs, {
          id: Date.now().toString(),
          type: 'player',
          text: `> ${command}`,
          timestamp: new Date().toLocaleTimeString([], { hour12: false })
        }]
      }));
    }
  },
  
  updateWorldParameter: async (key: string, value: number) => {
    const { apiBase } = get();
    const res = await fetch(`${apiBase}/v1/simulation/world/parameters`, {
      method: 'POST',
      credentials: 'include',
      headers: { 
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken()
      },
      body: JSON.stringify({ parameters: { [key]: value } })
    });
    const result = await res.json();
    set({ world: result });
  },

  spawnAgent: async (archetypeId: string, name?: string) => {
    const { apiBase } = get();
    const res = await fetch(`${apiBase}/v1/simulation/agents/spawn`, {
      method: 'POST',
      credentials: 'include',
      headers: { 
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken()
      },
      body: JSON.stringify({ archetype_id: archetypeId, name })
    });
    const result = await res.json();
    if (result.world) set({ world: result.world });
  },

  resetSimulation: async (seedAgents?: Record<string, number>) => {
    const { apiBase } = get();
    try {
      const res = await fetch(`${apiBase}/v1/simulation/reset`, {
        method: 'POST',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken()
        },
        body: JSON.stringify({ seed_agents: seedAgents })
      });
      const result = await res.json();
      if (result.world) set({ world: result.world });
      set({ activeAttack: null, heat: 0, stability: 100 });
    } catch (e) {
      console.error("Reset failed", e);
    }
  },

  injectEntropy: async () => {
    const { apiBase } = get();
    try {
      await fetch(`${apiBase}/v1/simulation/attack`, {
        method: 'POST',
        credentials: 'include',
        headers: { 
          'X-CSRF-Token': getCsrfToken()
        }
      });
    } catch (e) {
      console.error("Entropy injection failed", e);
    }
  }
}));
