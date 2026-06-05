"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, AlertTriangle, ShieldAlert, Zap, ShieldCheck } from 'lucide-react';
import { LogEntry, ActiveAttack } from '@/hooks/useSimulationSocket';
import { GlitchText } from '@/components/GlitchText';
import { useCyberVoice } from '@/hooks/useCyberVoice';
import { NeuralNet } from '@/components/NeuralNet';
import { VisualDAGDebugger } from '@/components/VisualDAGDebugger';
import { SimulationWorld } from '@/store/simulationStore';

export const DebuggerCore = ({ 
  stability, 
  logs, 
  isConnected, 
  activeAttack, 
  sendCommand,
  world,
  onStabilityChange 
}: { 
  stability: number;
  logs: LogEntry[];
  isConnected: boolean;
  activeAttack: ActiveAttack | null;
  sendCommand: (command: string) => Promise<void>;
  world: SimulationWorld | null;
  onStabilityChange?: (s: number) => void;
}) => {
  const { speak } = useCyberVoice();
  const [viewMode, setViewMode] = useState<'terminal' | 'dag'>('terminal');
  const [input, setInput] = useState('');
  const [patchInput, setPatchInput] = useState('');
  const [isPatching, setIsPatching] = useState(false);
  const [isGlitching, setIsGlitching] = useState(false);
  const [now, setNow] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const matrixRows = useMemo(
    () => Array.from({ length: 50 }, (_, i) => ((i + 1) * 2654435761).toString(36).repeat(4).slice(0, 98)),
    []
  );

  // Voice synthesis on ghost patches
  useEffect(() => {
    const lastLog = logs[logs.length - 1];
    if (lastLog?.type === 'ghost') {
      speak(lastLog.text);
    }
  }, [logs, speak]);

  useEffect(() => {
    if (onStabilityChange) onStabilityChange(stability);
    
    // Low stability glitching
    if (stability < 40 || activeAttack) {
      const interval = setInterval(() => {
        setIsGlitching(true);
        setTimeout(() => setIsGlitching(false), 150);
      }, Math.random() * (activeAttack ? 1000 : 2000) + 500);
      return () => clearInterval(interval);
    }
  }, [stability, onStabilityChange, activeAttack]);

  useEffect(() => {
    if (activeAttack) {
      const initialTimer = setTimeout(() => {
        setNow(Date.now());
      }, 0);
      const timer = setInterval(() => {
        setNow(Date.now());
      }, 1000);
      return () => {
        clearTimeout(initialTimer);
        clearInterval(timer);
      };
    } else {
      const initialTimer = setTimeout(() => {
        setNow(0);
      }, 0);
      return () => clearTimeout(initialTimer);
    }
  }, [activeAttack]);

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

  const timeLeft = activeAttack
    ? now === 0
      ? activeAttack.timeout
      : Math.max(0, activeAttack.timeout - Math.floor((now - activeAttack.startTime) / 1000))
    : 0;

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
    <div className="relative w-full h-full bg-slate-950/20 backdrop-blur-md text-slate-100 font-mono overflow-hidden flex flex-col border border-slate-900 shadow-[0_0_30px_rgba(168,85,247,0.1)] rounded-lg">
      {/* Matrix Background Effect */}
      <div className="absolute inset-0 opacity-[0.015] text-purple-400 pointer-events-none overflow-hidden text-[8px] leading-[8px] select-none">
        {matrixRows.map((row, i) => (
          <div key={i} className="whitespace-nowrap animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
            {row}
          </div>
        ))}
      </div>

      {/* CRT Scanline & Noise Overlay */}
      <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.3)_50%),linear-gradient(90deg,rgba(255,0,0,0.05),rgba(0,255,0,0.02),rgba(0,0,255,0.05))] bg-[length:100%_3px,3px_100%] opacity-40 mix-blend-overlay" />
      
      <motion.div 
        variants={glitchVariants}
        animate={isGlitching ? "glitch" : "normal"}
        className="flex-1 flex flex-col min-h-0 relative z-10"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-950/45 border-b border-slate-900 backdrop-blur-sm">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-cyan-400' : 'bg-red-500'} animate-ping`} />
              <span className="text-[11px] font-black tracking-[0.3em] uppercase text-slate-200">DEBUG_INTERFACE_V.0.9</span>
            </div>
            {/* View Mode Toggle */}
            <div className="flex bg-purple-950/20 border border-purple-500/20 rounded p-0.5 select-none">
              <button
                type="button"
                onClick={() => setViewMode('terminal')}
                className={`px-2.5 py-0.5 text-[8px] font-black uppercase tracking-widest rounded transition-all cursor-pointer ${
                  viewMode === 'terminal' 
                    ? 'bg-purple-600 text-white font-extrabold' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Terminal
              </button>
              <button
                type="button"
                onClick={() => setViewMode('dag')}
                className={`px-2.5 py-0.5 text-[8px] font-black uppercase tracking-widest rounded transition-all cursor-pointer ${
                  viewMode === 'dag' 
                    ? 'bg-purple-600 text-white font-extrabold' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                DAG Map
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 text-[10px] font-black ${stability < 40 ? 'text-red-500 animate-bounce' : 'text-cyan-400'}`}>
              <AlertTriangle size={12} />
              <span className="tracking-tighter">STABILITY: {stability}%</span>
            </div>
          </div>
        </div>

        {/* Attack Overlay */}
        <AnimatePresence>
          {activeAttack && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="absolute inset-x-4 top-14 bottom-20 z-30 bg-red-950/90 border-2 border-red-500 p-6 flex flex-col gap-4 backdrop-blur-md shadow-[0_0_50px_rgba(239,68,68,0.3)] rounded"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-red-500">
                  <ShieldAlert size={24} className="animate-pulse" />
                  <GlitchText text="Vulnerability Detected" className="font-black text-xl tracking-tighter uppercase italic" intensity="high" />
                </div>
                <div className="text-3xl font-black text-red-500 tabular-nums">
                  {timeLeft}s
                </div>
              </div>
              
              <div className="bg-black/50 p-4 border border-red-500/30 rounded font-mono text-xs text-red-200">
                <div className="text-red-500/50 mb-2 uppercase font-bold text-[10px]">Target File: {activeAttack.file}</div>
                <div className="overflow-x-auto whitespace-pre italic">
                  {activeAttack.vulnerability}
                </div>
              </div>

              {/* Quick Patch Form inside Overlay */}
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!patchInput.trim() || isPatching) return;
                  setIsPatching(true);
                  await sendCommand(`patch ${patchInput}`);
                  setPatchInput('');
                  setIsPatching(false);
                }}
                className="flex flex-col gap-3 border border-red-500/30 p-4 bg-black/60 rounded"
              >
                <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider">
                  System Vulnerability Mitigation Form
                </div>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={patchInput}
                    onChange={(e) => setPatchInput(e.target.value)}
                    className="flex-1 bg-black/50 border border-red-500/40 text-red-100 placeholder:text-red-900/60 font-mono text-xs p-2.5 rounded focus:outline-none focus:border-red-500"
                    placeholder="DESCRIBE WHY THIS LOGIC IS INTEGRAL TO PREVENT AN ANOMALY BREACH..."
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={isPatching}
                    className="bg-red-950 border border-red-500 text-red-400 hover:bg-red-500 hover:text-black font-orbitron text-[10px] font-black uppercase px-4 rounded tracking-wider transition-all duration-300 flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                  >
                    <ShieldCheck size={14} className={isPatching ? "animate-spin" : ""} />
                    DEPLOY SHIELD
                  </button>
                </div>
              </form>

              <div className="mt-auto flex flex-col gap-2">
                <div className="flex items-center gap-2 text-[10px] text-red-400 font-bold uppercase tracking-widest">
                  <Zap size={10} />
                  <span>Ghost is attempting to purge this logic</span>
                </div>
                <div className="text-[10px] text-white/50 leading-tight">
                  Type <span className="text-red-400 font-bold underline">patch [description]</span> in the command line or use the form above to reinforce the code.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Terminal View / DAG Map View */}
        <div className="flex-1 flex min-h-0 relative">
          {viewMode === 'terminal' ? (
            <>
              <div 
                ref={scrollRef}
                className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-2 font-mono text-sm relative z-10"
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
                        log.type === 'error' ? 'text-red-600 font-black uppercase tracking-tighter' :
                        log.type === 'success' ? 'text-emerald-400 font-bold' :
                        'text-slate-300'
                      }`}
                    >
                      <span className="opacity-30 shrink-0 select-none">[{log.timestamp}]</span>
                      <span className="break-words">
                        {log.type === 'ghost' && <span className="mr-2">GHOST:</span>}
                        {log.text}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Neural Feed Sidebar (Internal) */}
              <div className="hidden xl:block w-64 border-l border-purple-500/20 p-2 bg-slate-950/20 backdrop-blur-sm overflow-hidden animate-fade-in">
                 <NeuralNet isAttacked={!!activeAttack} />
                 <div className="mt-4 p-2 border border-purple-500/10 text-[9px] text-slate-500 uppercase leading-tight font-bold">
                    Neural_Web Visualization: Active
                    <br/>
                    Vector_Space_Recalculation...
                    <br/>
                    Status: <span className={activeAttack ? 'text-red-400' : 'text-cyan-400'}>{activeAttack ? 'BREACHED' : 'INFILTRATED'}</span>
                 </div>
              </div>
            </>
          ) : (
            <div className="flex-1 p-3 flex min-h-0 z-10 overflow-hidden">
              <VisualDAGDebugger logs={logs} world={world} />
            </div>
          )}
        </div>

        {/* Command Line */}
        <form 
          onSubmit={handleSubmit}
          className="p-4 bg-slate-950/60 border-t border-slate-900 flex items-center gap-4 group focus-within:border-purple-500/60"
        >
          <div className="text-cyan-400 font-black select-none shrink-0 text-xs tracking-widest">
            {isConnected ? 'ROOT' : 'OFFLINE'}@NULL_POINTER:~$
          </div>
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-slate-600 font-mono text-sm caret-cyan-400"
            placeholder={activeAttack ? "ENTER PATCH DESCRIPTION..." : "AWAITING DEBUG COMMAND..."}
            autoFocus
          />
          <button type="submit" className="text-cyan-400 hover:scale-110 transition-all opacity-50 group-focus-within:opacity-100 cursor-pointer">
            <Send size={18} />
          </button>
        </form>
      </motion.div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(168, 85, 247, 0.02); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(168, 85, 247, 0.15); border-radius: 2px; }
      `}</style>
    </div>
  );
};
