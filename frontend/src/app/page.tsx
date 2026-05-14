"use client";

import React, { useState, useEffect } from 'react';
import { Terminal } from '@/components/Terminal';
import { SourceEditor } from '@/components/SourceEditor';
import { Activity, Flame, Shield, Cpu } from 'lucide-react';
import { motion } from 'framer-motion';

interface LogEntry {
  id: string;
  type: 'info' | 'error' | 'success' | 'warning';
  message: string;
  timestamp: string;
}

export default function Dashboard() {
  const [heat, setHeat] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: '1', type: 'info', message: 'Initializing NULL_POINTER kernel...', timestamp: '17:27:01' },
    { id: '2', type: 'success', message: 'WebSocket established at /ws/heat', timestamp: '17:27:02' },
    { id: '3', type: 'info', message: 'Agentic logic loaded via LangGraph', timestamp: '17:27:03' },
  ]);

  useEffect(() => {
    // WebSocket connection for real-time heat updates
    const socket = new WebSocket('ws://localhost:8000/ws/heat');

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'heat_update') {
        // Only update if not overridden by a reality patch stability score
        setHeat(prev => data.value);
      } else if (data.type === 'reality_patch') {
        setHeat(data.stability);
        // Add patches to the logs
        setLogs(prev => [...prev, ...data.logs.map((msg: string, i: number) => ({
          id: `${Date.now()}-${i}`,
          type: 'warning',
          message: msg,
          timestamp: new Date().toLocaleTimeString([], { hour12: false })
        }))]);
      }
    };

    socket.onerror = (error) => {
      setLogs(prev => [...prev, {
        id: Date.now().toString(),
        type: 'error',
        message: 'WebSocket connection failed. Ensure backend is running.',
        timestamp: new Date().toLocaleTimeString([], { hour12: false })
      }]);
    };

    return () => socket.close();
  }, []);

  return (
    <main className="p-6 max-w-[1600px] mx-auto grid grid-cols-12 gap-6 h-screen max-h-screen overflow-hidden">
      {/* Header Stat Bar */}
      <header className="col-span-12 flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <div className="bg-blue-500/20 p-2 rounded-lg border border-blue-500/30">
            <Cpu className="text-blue-400" size={24} />
          </div>
          <div>
            <h1 className="font-orbitron text-2xl font-black tracking-tighter text-white">NULL_POINTER</h1>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Autonomous Simulation System</p>
          </div>
        </div>

        <div className="flex gap-8">
          <StatBox icon={<Activity size={16}/>} label="Uptime" value="00:04:21" color="text-blue-400" />
          <StatBox icon={<Shield size={16}/>} label="Integrity" value="99.9%" color="text-emerald-400" />
        </div>
      </header>

      {/* Main Grid Content */}
      <div className="col-span-12 lg:col-span-8 flex flex-col gap-6 overflow-hidden">
        <div className="flex-1">
          <Terminal logs={logs} />
        </div>
        <div className="h-1/3">
          <SourceEditor />
        </div>
      </div>

      {/* Sidebar Controls */}
      <aside className="col-span-12 lg:col-span-4 flex flex-col gap-6 overflow-hidden">
        {/* Heat Meter Card */}
        <div className="glass p-6 rounded-lg border border-slate-800/50 flex flex-col gap-4 relative overflow-hidden">
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

        {/* Control Panel Placeholder */}
        <div className="flex-1 glass p-6 rounded-lg border border-slate-800/50">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="text-blue-400" size={18} />
            <h2 className="font-orbitron text-sm font-bold uppercase tracking-widest">System Control</h2>
          </div>
          
          <div className="space-y-4">
             <ControlButton label="Initialize Loop" active />
             <ControlButton label="Inject Entropy" />
             <ControlButton label="Hard Reset" destructive />
          </div>
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

function ControlButton({ label, active, destructive }: { label: string, active?: boolean, destructive?: boolean }) {
  return (
    <button className={`
      w-full py-3 px-4 rounded border font-orbitron text-[10px] font-bold uppercase tracking-[0.2em] transition-all
      ${active ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 
        destructive ? 'bg-red-500/5 border-red-500/20 text-red-500/50 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50' :
        'bg-slate-900/50 border-slate-800 text-slate-500 hover:bg-slate-800 hover:text-slate-300'}
    `}>
      {label}
    </button>
  );
}
