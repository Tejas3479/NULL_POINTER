"use client";

import React, { useState, useMemo } from 'react';
import { Shield, Flame, RadioTower, Lock, LogIn, AlertCircle, GitBranch } from 'lucide-react';
import Link from 'next/link';
import { useSimulationSocket } from '@/hooks/useSimulationSocket';
import { SimulationWorldMap } from '@/components/SimulationWorldMap';
import { motion, AnimatePresence } from 'framer-motion';

export default function SpectatorPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const worldId = resolvedParams.id;

  const {
    heat,
    stability,
    logs,
    world
  } = useSimulationSocket(`ws://127.0.0.1:8000/ws/spectate/${worldId}`);

  const [toast, setToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const formattedLogs = useMemo(() => {
    return logs.slice(-50); // limit to last 50 logs for display
  }, [logs]);

  return (
    <main className="p-6 max-w-[1800px] mx-auto grid grid-cols-12 gap-6 h-screen max-h-screen overflow-hidden relative font-mono text-slate-100 bg-slate-950">
      {/* CRT Scanline Scanline Effects */}
      <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-25 mix-blend-overlay" />

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-red-950/90 border border-red-500 text-red-200 px-6 py-3 rounded shadow-[0_0_20px_rgba(239,68,68,0.3)] text-xs uppercase tracking-wider font-bold flex items-center gap-2"
          >
            <AlertCircle size={14} className="text-red-500 animate-pulse" />
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spectate Banner Header */}
      <header className="col-span-12 flex items-center justify-between mb-2 border-b border-slate-900 pb-4">
        <div className="flex items-center gap-4">
          <div className="bg-amber-500/10 p-2 rounded border border-amber-500/30">
            <Lock className="text-amber-500" size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-orbitron text-2xl font-black tracking-tighter text-white">NULL_POINTER (SPECTATOR)</h1>
              <span className="text-[8px] bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold px-1.5 py-0.5 rounded tracking-wide">
                READ_ONLY
              </span>
            </div>
            <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">
              OBSERVING TIMELINE: <span className="text-cyan-400 font-mono">{worldId}</span>
            </p>
          </div>
        </div>

        <div className="flex gap-6 items-center">
          <div className="flex flex-col items-end">
            <span className="text-sm font-orbitron font-bold text-white">{world?.view_count ?? 1} Spectators</span>
          </div>

          <div className="flex flex-col items-end border-l border-slate-800 pl-4 pr-2">
            <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
              <RadioTower size={12}/>
              <span className="text-[9px] uppercase font-bold tracking-widest">World Tick</span>
            </div>
            <span className="font-orbitron font-bold text-sm text-cyan-400">{world?.tick ?? 0}</span>
          </div>

          <div className="flex flex-col items-end border-l border-slate-800 pl-4 pr-2">
            <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
              <Shield size={12}/>
              <span className="text-[9px] uppercase font-bold tracking-widest">Integrity</span>
            </div>
            <span className={`font-orbitron font-bold text-sm ${stability < 40 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>{stability}%</span>
          </div>

          <Link
            href={`/create?remix=${worldId}`}
            className="px-4 py-2 border border-purple-500 hover:bg-purple-500/10 text-purple-400 font-orbitron text-xs font-black uppercase tracking-wider rounded cursor-pointer transition-all duration-300 flex items-center gap-1.5 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
          >
            <GitBranch size={14} />
            REMIX WORLD
          </Link>

          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
              `Simulation ${world?.name || worldId} stability is at ${stability}%. Watch live spectate session!`
            )}&url=${encodeURIComponent(
              typeof window !== 'undefined' ? `${window.location.origin}/spectate/${worldId}` : `http://localhost:3000/spectate/${worldId}`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 border border-cyan-500 hover:bg-cyan-500/10 text-cyan-400 font-orbitron text-xs font-black uppercase tracking-wider rounded cursor-pointer transition-all duration-300 flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            SHARE STATUS
          </a>

          <a
            href="/login"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-orbitron text-xs font-black uppercase tracking-wider rounded cursor-pointer transition-all duration-300 flex items-center gap-1.5 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
          >
            <LogIn size={14} />
            LOGIN TO INTERACT
          </a>
        </div>
      </header>

      {/* Main Layout Grid */}
      <div className="col-span-12 xl:col-span-7 flex flex-col gap-6 overflow-hidden h-full relative">
        {/* Terminal Logs (HUD/Chronicle view) */}
        <div className="flex-1 w-full h-full bg-slate-950/20 backdrop-blur-md text-slate-300 font-mono overflow-hidden flex flex-col border border-slate-900 rounded-lg relative">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900/40 border-b border-slate-900">
            <span className="text-[10px] font-black tracking-widest uppercase">Simulation Output Ledger</span>
            <span className="text-[10px] text-amber-500 font-bold uppercase select-none flex items-center gap-1">
              <Lock size={10} /> Spectator Session
            </span>
          </div>

          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-2 text-xs">
            {formattedLogs.map((log, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${
                  log.type === 'ghost' ? 'text-red-500 font-bold' :
                  log.type === 'player' ? 'text-white' :
                  log.type === 'system' ? 'text-cyan-400 italic' :
                  log.type === 'error' ? 'text-red-600 font-black' :
                  log.type === 'success' ? 'text-emerald-400 font-bold' :
                  'text-slate-300'
                }`}
              >
                <span className="opacity-30 shrink-0 select-none">[{log.timestamp}]</span>
                <span className="break-words">{log.text}</span>
              </div>
            ))}
          </div>

          {/* Locked Command Bar Overlay */}
          <div className="p-4 bg-slate-950/60 border-t border-slate-900 flex items-center justify-between relative group">
            <div className="absolute inset-0 z-20 bg-black/70 backdrop-blur-[1px] flex items-center justify-center border border-amber-500/20">
              <button
                onClick={() => triggerToast("Login required")}
                className="text-amber-500 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 hover:underline cursor-pointer"
              >
                <Lock size={12} /> Command Input Restricted. Login Required.
              </button>
            </div>
            <div className="text-slate-600 font-black select-none text-xs">
              SPECTATOR@NULL_POINTER:~$
            </div>
            <input
              type="text"
              disabled
              className="flex-1 bg-transparent border-none outline-none text-slate-600 font-mono text-sm pl-4"
              placeholder="COMMANDS_LOCKED"
            />
          </div>
        </div>
      </div>

      {/* Sidebar spectating */}
      <aside className="col-span-12 xl:col-span-5 flex flex-col gap-6 overflow-hidden h-full relative">
        {/* Active Anomalies Map Overlay (Read-Only) */}
        <div className="flex-1 min-h-0 relative border border-slate-800 rounded bg-slate-950/20">
          {/* Overlay to intercept any clicks on Map/Spawn Buttons */}
          <div className="absolute inset-0 z-20 bg-black/20 pointer-events-none" />
          
          <SimulationWorldMap
            world={world}
            userRole="viewer" // read-only layout
            onParameterChange={() => triggerToast("Login required")}
            onSpawnAgent={() => triggerToast("Login required")}
          />
        </div>

        {/* Heat Meter Card */}
        <div className="glass p-5 rounded-lg border border-slate-800/50 flex flex-col gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Flame size={80} className="text-orange-500" />
          </div>
          <div className="flex items-center gap-2">
            <Flame className="text-orange-500" size={20} />
            <h2 className="font-orbitron text-sm font-bold uppercase tracking-widest text-white">Simulation Heat</h2>
          </div>
          <div className="relative h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-blue-500"
              style={{ width: `${heat}%`, transition: 'width 0.5s ease-out' }}
            />
          </div>
          <div className="flex justify-between items-end">
            <span className="text-4xl font-black font-orbitron tracking-tighter text-white">
              {heat.toFixed(1)}<span className="text-sm text-slate-500 ml-1">%</span>
            </span>
          </div>
        </div>

        {/* Locked Controls overlay card */}
        <div className="glass p-5 rounded border border-slate-800 bg-slate-950/20 flex flex-col relative overflow-hidden">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center text-center p-6 gap-3">
            <Lock className="text-amber-500 animate-pulse" size={28} />
            <div>
              <h3 className="font-orbitron font-black text-xs text-white uppercase tracking-wider">CO-OP CONTROL BLOCK</h3>
              <p className="text-[9px] text-slate-500 uppercase mt-1">Authenticate session credentials to unlock simulation parameters</p>
            </div>
            <a
              href="/login"
              className="mt-2 px-4 py-1.5 border border-amber-500/40 text-amber-500 hover:bg-amber-500 hover:text-black text-[9px] uppercase tracking-wider font-bold rounded cursor-pointer transition-all duration-300"
            >
              LOGIN TO INTERACT
            </a>
          </div>
          <div className="opacity-10 pointer-events-none">
            <h2 className="text-sm font-bold uppercase font-orbitron mb-2">Controls</h2>
            <div className="space-y-2">
              <div className="h-10 bg-slate-800 rounded" />
              <div className="h-10 bg-slate-800 rounded" />
            </div>
          </div>
        </div>
      </aside>
    </main>
  );
}
