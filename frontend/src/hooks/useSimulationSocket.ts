import { useState, useEffect, useRef, useCallback } from 'react';

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

export const useSimulationSocket = (url: string) => {
  const [heat, setHeat] = useState(100);
  const [stability, setStability] = useState(100);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [activeAttack, setActiveAttack] = useState<ActiveAttack | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => setIsConnected(true);
    socket.onclose = () => setIsConnected(false);
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const timestamp = new Date().toLocaleTimeString([], { hour12: false });

      if (data.type === 'heat_update') {
        setHeat(data.value);
      } else if (data.type === 'reality_patch') {
        setStability(data.stability);
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
        if (data.new_heat) setHeat(data.new_heat);
      }
    };

    return () => socket.close();
  }, [url]);

  const sendCommand = useCallback(async (command: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      // Check if it's a patch command
      if (command.toLowerCase().startsWith('patch ') && activeAttack) {
        const description = command.substring(6);
        try {
          const res = await fetch('http://localhost:8000/v1/simulation/patch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description })
          });
          const result = await res.json();
          
          setLogs(prev => [...prev, {
            id: Date.now().toString(),
            type: result.status === 'patched' ? 'success' : 'error',
            text: result.message,
            timestamp: new Date().toLocaleTimeString([], { hour12: false })
          }]);
          
          if (result.status === 'patched') {
            setActiveAttack(null);
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
  }, [activeAttack]);

  return { heat, stability, logs, isConnected, activeAttack, sendCommand };
};
