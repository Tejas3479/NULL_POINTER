import { useState, useEffect, useRef, useCallback } from 'react';

export interface LogEntry {
  id: string;
  type: 'ghost' | 'system' | 'player' | 'error' | 'success';
  text: string;
  timestamp: string;
}

export const useSimulationSocket = (url: string) => {
  const [heat, setHeat] = useState(100);
  const [stability, setStability] = useState(100);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
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
            type: 'ghost',
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
      }
    };

    return () => socket.close();
  }, [url]);

  const sendCommand = useCallback((command: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
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
  }, []);

  return { heat, stability, logs, isConnected, sendCommand };
};
