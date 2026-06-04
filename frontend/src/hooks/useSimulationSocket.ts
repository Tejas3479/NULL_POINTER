import { useState, useEffect, useMemo, useRef, useCallback } from 'react';

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

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '1';
  const match = document.cookie.match(new RegExp('(^| )csrf_token=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : '1';
};

export const useSimulationSocket = (url: string) => {
  const apiBase = useMemo(() => url.replace(/^ws/, 'http').replace(/\/ws\/heat$/, ''), [url]);
  const [heat, setHeat] = useState(100);
  const [stability, setStability] = useState(100);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [activeAttack, setActiveAttack] = useState<ActiveAttack | null>(null);
  const [world, setWorld] = useState<SimulationWorld | null>(null);
  const [presenceList, setPresenceList] = useState<Array<{ username: string; role: string }>>([]);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetch(`${apiBase}/v1/simulation/world`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error("Unauthorized");
        return res.json();
      })
      .then((data) => {
        setWorld(data);
        setHeat(data.heat ?? 100);
        setStability(data.stability ?? 100);
      })
      .catch(() => undefined);

    const getJwtToken = (): string => {
      if (typeof document === 'undefined') return '';
      const match = document.cookie.match(new RegExp('(^| )jwt_token=([^;]*)'));
      return match ? decodeURIComponent(match[2]) : '';
    };

    const tokenVal = getJwtToken();
    let worldId = 'local-null-pointer';
    if (typeof window !== 'undefined') {
      const matchPath = window.location.pathname.match(/\/sim\/([^/]+)/);
      if (matchPath) {
        worldId = matchPath[1];
      }
    }

    const wsUrl = new URL(url);
    wsUrl.searchParams.set("world_id", worldId);
    if (tokenVal) {
      wsUrl.searchParams.set("token", tokenVal);
    }

    const socket = new WebSocket(wsUrl.toString());
    socketRef.current = socket;

    socket.onopen = () => setIsConnected(true);
    socket.onclose = () => setIsConnected(false);
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const timestamp = new Date().toLocaleTimeString([], { hour12: false });

      if (data.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      if (data.type === 'presence_update') {
        setPresenceList(data.players || []);
      } else if (data.type === 'player_joined') {
        setLogs(prev => [...prev, {
          id: Date.now().toString(),
          type: 'system',
          text: `Operator ${data.player.username} (${data.player.role}) connected to this terminal session.`,
          timestamp
        }]);
      } else if (data.type === 'player_left') {
        setLogs(prev => [...prev, {
          id: Date.now().toString(),
          type: 'system',
          text: `Operator ${data.player.username} disconnected from this session.`,
          timestamp
        }]);
      } else if (data.type === 'heat_update') {
        setHeat(data.value);
      } else if (data.type === 'reality_patch') {
        setStability(data.stability);
        if (data.world) setWorld(data.world);
        setLogs(prev => [
          ...prev, 
          ...data.logs.map((msg: string, i: number) => ({
            id: `${Date.now()}-${i}`,
            type: 'ghost' as const,
            text: msg,
            timestamp
          }))
        ]);
      } else if (data.type === 'admin_response') {
        setLogs(prev => [...prev, {
          id: Date.now().toString(),
          type: 'system',
          text: data.message,
          timestamp
        }]);
      } else if (data.type === 'source_attack') {
        setActiveAttack({
          ...data,
          startTime: Date.now()
        });
        setLogs(prev => [...prev, {
          id: Date.now().toString(),
          type: 'error',
          text: `!!! VULNERABILITY DETECTED in ${data.file} !!!`,
          timestamp
        }]);
      } else if (data.type === 'attack_result') {
        setActiveAttack(null);
        setLogs(prev => [...prev, {
          id: Date.now().toString(),
          type: data.status === 'failed' ? 'error' : 'success',
          text: data.message,
          timestamp
        }]);
        if (data.new_heat !== undefined) setHeat(data.new_heat);
        if (data.new_stability !== undefined) setStability(data.new_stability);
        if (data.world) setWorld(data.world);
      } else if (data.type === 'world_update' || data.type === 'agent_spawned') {
        if (data.world) setWorld(data.world);
        if (data.message) {
          setLogs(prev => [...prev, {
            id: Date.now().toString(),
            type: 'system',
            text: data.message,
            timestamp
          }]);
        }
      }
    };

    return () => socket.close();
  }, [url, apiBase]);

  const sendCommand = useCallback(async (command: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      // Check if it's a patch command
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
            // Success is broadcasted over the WebSocket to prevent duplicate logs.
          } else {
            setLogs(prev => [...prev, {
              id: Date.now().toString(),
              type: 'error',
              text: result.message,
              timestamp: new Date().toLocaleTimeString([], { hour12: false })
            }]);
          }
        } catch (e) {
          console.error("Patch failed", e);
        }
        return;
      }

      socketRef.current.send(JSON.stringify({
        type: 'debug_command',
        command
      }));
      
      setLogs(prev => [...prev, {
        id: Date.now().toString(),
        type: 'player',
        text: `> ${command}`,
        timestamp: new Date().toLocaleTimeString([], { hour12: false })
      }]);
    }
  }, [activeAttack, apiBase]);

  const updateWorldParameter = useCallback(async (key: string, value: number) => {
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
    setWorld(result);
  }, [apiBase]);

  const spawnAgent = useCallback(async (archetypeId: string) => {
    const res = await fetch(`${apiBase}/v1/simulation/agents/spawn`, {
      method: 'POST',
      credentials: 'include',
      headers: { 
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken()
      },
      body: JSON.stringify({ archetype_id: archetypeId })
    });
    const result = await res.json();
    if (result.world) setWorld(result.world);
  }, [apiBase]);

  const resetSimulation = useCallback(async (seedAgents?: Record<string, number>) => {
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
      if (result.world) setWorld(result.world);
      setActiveAttack(null);
      setHeat(0);
      setStability(100);
    } catch (e) {
      console.error("Reset failed", e);
    }
  }, [apiBase]);

  const injectEntropy = useCallback(async () => {
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
  }, [apiBase]);

  return { 
    heat, 
    stability, 
    logs, 
    isConnected, 
    activeAttack, 
    world, 
    presenceList,
    sendCommand, 
    updateWorldParameter, 
    spawnAgent,
    resetSimulation,
    injectEntropy
  };
};
