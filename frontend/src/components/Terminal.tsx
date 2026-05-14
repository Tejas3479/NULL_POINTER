"use client";

import React, { useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, ChevronRight } from 'lucide-react';

interface LogEntry {
  id: string;
  type: 'info' | 'error' | 'success' | 'warning';
  message: string;
  timestamp: string;
}

export const Terminal = ({ logs }: { logs: LogEntry[] }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-full glass rounded-lg overflow-hidden border border-slate-800/50 shadow-2xl relative">
      <div className="scanline" />
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 border-b border-slate-800/50">
        <TerminalIcon size={14} className="text-blue-400" />
        <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase font-orbitron">Memory Logs</span>
        <div className="ml-auto flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
          <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
          <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 p-4 overflow-y-auto terminal-scroll font-mono text-sm space-y-2 selection:bg-blue-500/30"
      >
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
            <span className="text-slate-600 shrink-0">[{log.timestamp}]</span>
            <span className={`
              ${log.type === 'error' ? 'text-red-400' : ''}
              ${log.type === 'success' ? 'text-emerald-400' : ''}
              ${log.type === 'warning' ? 'text-amber-400' : ''}
              ${log.type === 'info' ? 'text-blue-300' : ''}
            `}>
              {log.message}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1 text-slate-400">
          <ChevronRight size={14} className="animate-pulse" />
          <span className="w-2 h-4 bg-blue-500/50 animate-pulse ml-1" />
        </div>
      </div>
    </div>
  );
};
