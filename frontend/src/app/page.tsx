"use client";

import React, { useState, useEffect } from 'react';
import { DebuggerCore } from '@/components/DebuggerCore';
import { SimulationWorldMap } from '@/components/SimulationWorldMap';
import { Activity, Flame, Shield, Cpu, RadioTower, GitBranch } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSimulationSocket } from '@/hooks/useSimulationSocket';

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '1';
  const match = document.cookie.match(new RegExp('(^| )csrf_token=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : '1';
};

export default function Dashboard() {
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [seedCounts, setSeedCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    // 1. Verify session persistence on mount using httpOnly cookie
    fetch('http://localhost:8000/auth/me', { 
      credentials: 'include' 
    })
      .then((res) => {
        if (!res.ok) throw new Error('Unauthorized');
        return res.json();
      })
      .then((data) => {
        setUserRole(data.role);
        setUsername(data.username);
        setLoadingAuth(false);
      })
      .catch(() => {
        // Not authenticated, clear session flags and redirect to /login
        sessionStorage.removeItem('is_authenticated');
        window.location.href = '/login';
      });
  }, []);

  const { 
    heat, 
    stability, 
    logs,
    isConnected, 
    activeAttack,
    world, 
    sendCommand,
    updateWorldParameter, 
    spawnAgent,
    resetSimulation,
    injectEntropy
  } = useSimulationSocket('ws://127.0.0.1:8000/ws/heat');

  if (loadingAuth) {
    return (
      <main className="min-h-screen bg-black text-[#00FF41] font-mono flex items-center justify-center p-6 relative overflow-hidden">
        {/* CRT Overlay */}
        <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-40 mix-blend-overlay" />
        <div className="text-center space-y-4 relative z-10">
          <div className="w-8 h-8 border-2 border-t-transparent border-[#00FF41] rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-[#00FF41]/60 font-bold">Verifying quantum defense authorization keys...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-[1800px] mx-auto grid grid-cols-12 gap-6 h-screen max-h-screen overflow-hidden">
      {/* Header Stat Bar */}
      <header className="col-span-12 flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <div className="bg-blue-500/20 p-2 rounded-lg border border-blue-500/30">
            <Cpu className="text-blue-400" size={24} />
          </div>
          <div>
            <h1 className="font-orbitron text-2xl font-black tracking-tighter text-white">NULL_POINTER</h1>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
              {isConnected ? 'LIVE_SYSTEM_ACTIVE' : 'SYSTEM_OFFLINE'}
            </p>
          </div>
        </div>

        <div className="flex gap-8 items-center">
          <div className="text-right border-r border-slate-800 pr-6 mr-2">
            <span className="text-[9px] uppercase tracking-widest text-slate-500 block font-bold">OPERATOR: {username}</span>
            <span className={`text-[9px] uppercase font-black font-orbitron tracking-wider ${userRole === 'admin' ? 'text-red-500 animate-pulse' : userRole === 'developer' ? 'text-emerald-400' : 'text-amber-500'}`}>
              ROLE: {userRole}
            </span>
          </div>
          
          <a 
            href={`/sim/${world?.world_id ?? 'local-null-pointer'}/chronicle`}
            className="px-3 py-1.5 border border-cyan-500/30 hover:border-cyan-500 text-cyan-400 hover:bg-cyan-500/10 text-[9px] uppercase tracking-wider font-orbitron font-bold rounded cursor-pointer transition-all duration-300 flex items-center gap-1.5"
          >
            <RadioTower size={12} />
            CHRONICLE FEED
          </a>

          <StatBox icon={<RadioTower size={16}/>} label="World Tick" value={`${world?.tick ?? 0}`} color="text-cyan-400" />
          <StatBox icon={<Shield size={16}/>} label="Integrity" value={`${stability}%`} color={stability < 40 ? 'text-red-500' : 'text-emerald-400'} />
          
          <button 
            onClick={async () => {
              // Standard logout with CSRF protection header
              await fetch('http://localhost:8000/auth/logout', { 
                method: 'POST', 
                credentials: 'include',
                headers: { 'X-CSRF-Token': getCsrfToken() }
              });
              sessionStorage.clear();
              window.location.href = '/login';
            }}
            className="px-3 py-1.5 border border-red-500/30 hover:border-red-500 text-red-500 hover:bg-red-500/10 text-[9px] uppercase tracking-wider font-orbitron font-bold rounded cursor-pointer transition-all duration-300"
          >
            LOGOUT
          </button>
        </div>
      </header>

      {/* Main Grid Content */}
      <div className="col-span-12 xl:col-span-7 flex flex-col gap-6 overflow-hidden h-full">
        <DebuggerCore 
          stability={stability}
          logs={logs}
          isConnected={isConnected}
          activeAttack={activeAttack}
          sendCommand={sendCommand}
        />
      </div>

      {/* Sidebar Controls */}
      <aside className="col-span-12 xl:col-span-5 flex flex-col gap-6 overflow-hidden">
        <div className="flex-1 min-h-0">
          <SimulationWorldMap
            world={world}
            userRole={userRole}
            onParameterChange={updateWorldParameter}
            onSpawnAgent={spawnAgent}
          />
        </div>

        {/* Heat Meter Card */}
        <div className="glass p-5 rounded-lg border border-slate-800/50 flex flex-col gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Flame size={80} className={heat > 70 ? 'text-red-500' : 'text-orange-500'} />
          </div>
          
          <div className="flex items-center gap-2">
            <Flame className={heat > 70 ? 'text-red-500 animate-pulse' : 'text-orange-500'} size={20} />
            <h2 className="font-orbitron text-sm font-bold uppercase tracking-widest">Simulation Heat</h2>
          </div>

          <div className="relative h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <motion.div 
              className={`h-full ${heat > 80 ? 'bg-red-500' : heat > 50 ? 'bg-orange-500' : 'bg-blue-500'}`}
              initial={{ width: 0 }}
              animate={{ width: `${heat}%` }}
              transition={{ type: "spring", stiffness: 50 }}
            />
          </div>
          
          <div className="flex justify-between items-end">
            <span className="text-4xl font-black font-orbitron tracking-tighter tabular-nums">
              {heat.toFixed(1)}<span className="text-sm text-slate-500 ml-1">%</span>
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500 pb-1">
              {heat > 80 ? 'CRITICAL' : heat > 50 ? 'UNSTABLE' : 'OPTIMAL'}
            </span>
          </div>
        </div>

        {/* System Control */}
        <div className="glass p-5 rounded-lg border border-slate-800/50 flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="text-blue-400" size={18} />
            <h2 className="font-orbitron text-sm font-bold uppercase tracking-widest">System Control</h2>
          </div>
          
          <div className="space-y-4 flex-1">
             <ControlButton label="Initialize Loop" active onClick={() => resetSimulation()} />
             <ControlButton label="Inject Entropy" onClick={injectEntropy} />
             <ControlButton label="Hard Reset" destructive onClick={() => resetSimulation()} />
          </div>
        </div>

        {/* World Builder (Phase 3-B) */}
        <div className="glass p-5 rounded-lg border border-slate-800/50 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <GitBranch className="text-emerald-400" size={18} />
            <h2 className="font-orbitron text-sm font-bold uppercase tracking-widest">World Builder (Phase 3-B)</h2>
          </div>
          <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-3 leading-normal">
            Configure agent swarm initialization counts prior to booting new timeline.
          </p>

          <div className="space-y-2 max-h-36 overflow-y-auto custom-scrollbar pr-1 mb-4 border border-slate-900 bg-black/30 p-2 rounded">
            {world?.agent_archetypes.map((arch) => (
              <div key={arch.id} className="flex justify-between items-center text-[10px] uppercase font-mono py-1 border-b border-slate-900 last:border-b-0">
                <span className="text-slate-300 font-bold truncate max-w-[150px]">{arch.name.replace('The ', '')}</span>
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => setSeedCounts(prev => ({ ...prev, [arch.id]: Math.max(0, (prev[arch.id] || 0) - 1) }))}
                    className="w-4 h-4 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded flex items-center justify-center cursor-pointer text-[9px] font-bold"
                  >
                    -
                  </button>
                  <span className="w-5 text-center text-white font-orbitron font-bold text-[9px]">
                    {seedCounts[arch.id] || 0}
                  </span>
                  <button 
                    onClick={() => setSeedCounts(prev => ({ ...prev, [arch.id]: (prev[arch.id] || 0) + 1 }))}
                    className="w-4 h-4 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded flex items-center justify-center cursor-pointer text-[9px] font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              const seedPayload: Record<string, number> = {};
              Object.entries(seedCounts).forEach(([k, v]) => {
                if (v > 0) seedPayload[k] = v;
              });
              resetSimulation(seedPayload);
            }}
            className="w-full py-2.5 border border-emerald-500/30 hover:border-emerald-500 text-emerald-400 hover:bg-emerald-500/10 text-[9px] uppercase tracking-[0.2em] font-orbitron font-bold rounded cursor-pointer transition-all duration-300"
          >
            BOOT SWARM WITH CONFIG
          </button>
        </div>
      </aside>
    </main>
  );
}

function StatBox({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string, color: string }) {
  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
        {icon}
        <span className="text-[10px] uppercase font-bold tracking-widest">{label}</span>
      </div>
      <span className={`font-orbitron font-bold text-sm ${color}`}>{value}</span>
    </div>
  );
}

function ControlButton({ 
  label, 
  active, 
  destructive, 
  onClick 
}: { 
  label: string; 
  active?: boolean; 
  destructive?: boolean; 
  onClick?: () => void; 
}) {
  return (
    <button 
      onClick={onClick}
      className={`
        w-full py-3 px-4 rounded border font-orbitron text-[10px] font-bold uppercase tracking-[0.2em] transition-all cursor-pointer
        ${active ? 'bg-blue-500/10 border-blue-500/50 text-blue-400 hover:bg-blue-500/20' : 
          destructive ? 'bg-red-500/5 border-red-500/20 text-red-500/50 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50' :
          'bg-slate-900/50 border-slate-800 text-slate-500 hover:bg-slate-800 hover:text-slate-300'}
      `}
    >
      {label}
    </button>
  );
}
