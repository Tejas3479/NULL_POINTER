"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal as TerminalIcon, Send, AlertTriangle, Cpu, HardDrive } from 'lucide-react';
import { useSimulationSocket, LogEntry } from '@/hooks/useSimulationSocket';

export const DebuggerCore = ({ onStabilityChange }: { onStabilityChange?: (s: number) => void }) => {
  const { stability, logs, isConnected, sendCommand } = useSimulationSocket('ws://localhost:8000/ws/heat');
  const [input, setInput] = useState('');
  const [isGlitching, setIsGlitching] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (onStabilityChange) onStabilityChange(stability);
    
    if (stability < 40) {
      const interval = setInterval(() => {
        setIsGlitching(true);
        setTimeout(() => setIsGlitching(false), 150);
      }, Math.random() * 2000 + 500);
      return () => clearInterval(interval);
    }
  }, [stability, onStabilityChange]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendCommand(input);
    setInput('');
  };

  const glitchVariants = {
    normal: { x: 0, skewX: 0, filter: 'hue-rotate(0deg) contrast(1)', opacity: 1 },
    glitch: {
      x: [0, -8, 12, -4, 4, 0],
      skewX: [0, 15, -15, 7, -7, 0],
      filter: [
        'hue-rotate(0deg) contrast(1.2)',
        'hue-rotate(180deg) contrast(2)',
        'hue-rotate(360deg) contrast(1.5)',
        'hue-rotate(0deg) contrast(1)'
      ],
      opacity: [1, 0.8, 0.9, 0.7, 1],
      transition: { duration: 0.15, times: [0, 0.2, 0.4, 0.6, 0.8, 1] }
    }
  };

  return (
    <div className="relative w-full h-full bg-black text-[#00FF41] font-mono overflow-hidden flex flex-col border border-[#00FF41]/40 shadow-[0_0_30px_rgba(0,255,65,0.15)] rounded-sm">
      {/* Matrix Background Effect (Simplified) */}
      <div className="absolute inset-0 opacity-5 pointer-events-none overflow-hidden text-[8px] leading-[8px] select-none">
        {[...Array(50)].map((_, i) => (
          <div key={i} className="whitespace-nowrap animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
            {Math.random().toString(36).substring(2, 100)}
          </div>
        ))}
      </div>

      {/* CRT Scanline & Noise Overlay */}
      <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.3)_50%),linear-gradient(90deg,rgba(255,0,0,0.05),rgba(0,255,0,0.02),rgba(0,0,255,0.05))] bg-[length:100%_3px,3px_100%] opacity-40 mix-blend-overlay" />
      <div className="absolute inset-0 pointer-events-none z-40 bg-white/5 opacity-5 animate-pulse" />
      
      <motion.div 
        variants={glitchVariants}
        animate={isGlitching ? "glitch" : "normal"}
        className="flex-1 flex flex-col min-h-0 relative z-10"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#00FF41]/10 border-b border-[#00FF41]/30 backdrop-blur-sm">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00FF41] animate-ping" />
              <span className="text-[11px] font-black tracking-[0.3em] uppercase">DEBUG_INTERFACE_V.0.9</span>
            </div>
            <div className="hidden md:flex gap-4 text-[9px] font-bold text-[#00FF41]/60 uppercase tracking-widest tabular-nums">
              <span>MEM_ADDR: 0x{stability.toString(16).toUpperCase()}FF</span>
              <span>STATUS: {isConnected ? 'CONNECTED' : 'DISCONNECTED'}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 text-[10px] font-black ${stability < 40 ? 'text-red-500 animate-bounce' : 'text-[#00FF41]'}`}>
              <AlertTriangle size={12} />
              <span className="tracking-tighter">STABILITY_THRESHOLD: {stability}%</span>
            </div>
          </div>
        </div>

        {/* Streaming Terminal */}
        <div 
          ref={scrollRef}
          className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-2 font-mono text-sm selection:bg-[#00FF41] selection:text-black"
        >
          <AnimatePresence initial={false}>
            {logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex gap-3 leading-relaxed ${
                  log.type === 'ghost' ? 'text-red-500 font-bold' : 
                  log.type === 'player' ? 'text-white' : 
                  log.type === 'system' ? 'text-cyan-400 italic' :
                  'text-[#00FF41]'
                }`}
              >
                <span className="opacity-30 shrink-0 select-none">[{log.timestamp}]</span>
                <span className="break-words">
                  {log.type === 'ghost' && <span className="mr-2">⚠ GHOST:</span>}
                  {log.text}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
          <div className="flex items-center gap-1">
             <div className="w-2 h-4 bg-[#00FF41] animate-pulse" />
          </div>
        </div>

        {/* Command Line */}
        <form 
          onSubmit={handleSubmit}
          className="p-4 bg-black/80 border-t border-[#00FF41]/30 flex items-center gap-4 group focus-within:border-[#00FF41] transition-colors"
        >
          <div className="text-[#00FF41] font-black select-none shrink-0 text-xs tracking-widest">
            {isConnected ? 'LIVE' : 'OFFLINE'}@ROOT:~$
          </div>
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[#00FF41] placeholder:text-[#00FF41]/20 font-mono text-sm caret-[#00FF41]"
            placeholder="AWAITING DEBUG COMMAND..."
            autoFocus
          />
          <button type="submit" className="text-[#00FF41] hover:scale-110 active:scale-95 transition-all opacity-50 group-focus-within:opacity-100">
            <Send size={18} />
          </button>
        </form>
      </motion.div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0, 255, 65, 0.02); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 255, 65, 0.15); border-radius: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0, 255, 65, 0.3); }
      `}</style>
    </div>
  );
};
