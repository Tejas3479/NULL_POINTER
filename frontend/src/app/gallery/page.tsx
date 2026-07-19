"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { getBackendUrl } from '@/config';
import { 
  Globe, 
  Eye, 
  Search, 
  SlidersHorizontal, 
  BookOpen, 
  Calendar, 
  Zap,
  Lock
} from 'lucide-react';
import { motion } from 'framer-motion';

interface Anomaly {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  severity: number;
  faction: string;
}

interface Agent {
  id: string;
  archetype_id: string;
  name: string;
  loyalty: string;
  mood: string;
  memory: string[];
  active: boolean;
}

interface SimulationWorld {
  world_id: string;
  name: string;
  description?: string;
  tick: number;
  heat: number;
  stability: number;
  owner: string;
  view_count: number;
  agents: Agent[];
  share: {
    public: boolean;
    remixable?: boolean;
  };
  updated_at?: string;
  anomalies?: Anomaly[];
  lore?: unknown[];
  events?: unknown[];
}

function WorldThumbnail({ world }: { world: SimulationWorld }) {
  const anomalies = world.anomalies || [];
  const agents = world.agents || [];
  
  const width = 300;
  const height = 150;
  
  const points = anomalies.map((a) => {
    const x = ((a.x + 4) / 8) * (width - 80) + 40;
    const y = ((a.y + 3) / 6) * (height - 50) + 25;
    return { x, y, severity: a.severity || 50 };
  });
  
  return (
    <svg width="100%" height="150" className="bg-[#05070c] border border-slate-900/50 rounded overflow-hidden block">
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#0f172a" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
      
      {/* Topology connection lines */}
      {points.map((p1, i: number) => 
        points.slice(i + 1).map((p2, j: number) => (
          <line 
            key={`${i}-${j}`} 
            x1={p1.x} 
            y1={p1.y} 
            x2={p2.x} 
            y2={p2.y} 
            stroke={p1.severity > 60 || p2.severity > 60 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(99, 102, 241, 0.15)'} 
            strokeWidth="0.5" 
          />
        ))
      )}
      
      {/* Node circles */}
      {points.map((p, idx: number) => {
        const isHighSeverity = p.severity > 60;
        const nodeColor = isHighSeverity ? '#ef4444' : '#38bdf8';
        return (
          <g key={idx}>
            <circle cx={p.x} cy={p.y} r={isHighSeverity ? 6 : 4} fill={nodeColor} fillOpacity="0.2" className="animate-pulse" />
            <circle cx={p.x} cy={p.y} r={isHighSeverity ? 2.5 : 1.5} fill={nodeColor} />
          </g>
        );
      })}

      {/* Spacing moving agents */}
      {agents.slice(0, 10).map((a, idx: number) => {
        const x = 40 + (idx * 27) % (width - 80);
        const y = 25 + (idx * 13) % (height - 50);
        return (
          <circle 
            key={`agent-${idx}`}
            cx={x} 
            cy={y} 
            r="1" 
            fill="#22c55e" 
            fillOpacity="0.5"
          />
        );
      })}
    </svg>
  );
}

export default function GalleryPage() {
  const [worlds, setWorlds] = useState<SimulationWorld[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"popularity" | "recency" | "chaos" | "narrative">("popularity");

  useEffect(() => {
    const fetchPublicWorlds = async () => {
      try {
        const res = await fetch(`${getBackendUrl()}/v1/worlds/public`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setWorlds(data);
        }
      } catch (err) {
        console.error("Failed to load public simulations", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPublicWorlds();
  }, []);

  const filteredAndSortedWorlds = useMemo(() => {
    let result = [...worlds];

    // Filter by search query
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        w => w.name.toLowerCase().includes(q) || (w.description && w.description.toLowerCase().includes(q))
      );
    }

    // Sort accordingly
    result.sort((a, b) => {
      if (sortBy === "popularity") {
        return (b.view_count ?? 0) - (a.view_count ?? 0);
      }
      if (sortBy === "recency") {
        const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return dateB - dateA;
      }
      if (sortBy === "chaos") {
        // High chaos = low stability
        return a.stability - b.stability;
      }
      if (sortBy === "narrative") {
        // High narrative = count of lore entries desc
        const loreA = a.lore ? a.lore.length : 0;
        const loreB = b.lore ? b.lore.length : 0;
        return loreB - loreA;
      }
      return 0;
    });

    return result;
  }, [worlds, search, sortBy]);

  return (
    <main className="h-screen bg-black text-slate-100 font-mono relative overflow-hidden flex flex-col">
      {/* Cyber scanlines overlay */}
      <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-20 mix-blend-overlay" />

      {/* Floating cyber stars background */}
      <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#1e293b_1px,transparent_1px)] bg-[size:16px_16px]" />

      {/* Navigation Header */}
      <header className="px-6 py-4 bg-slate-950 border-b border-slate-900 flex justify-between items-center relative z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded border border-purple-500/30">
            <Globe className="text-purple-400 animate-pulse" size={20} />
          </div>
          <div>
            <h1 className="font-orbitron font-black text-md text-white tracking-widest uppercase">Public Quantum Timelines</h1>
            <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">Simulations Network Ledger</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/leaderboard"
            className="px-3 py-1.5 border border-slate-800 hover:border-cyan-500 text-slate-400 hover:text-cyan-400 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
          >
            System Leaderboards
          </Link>
          <Link 
            href="/sim/local-null-pointer"
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 border border-purple-500/30 text-white rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer font-orbitron shadow-[0_0_15px_rgba(168,85,247,0.3)]"
          >
            Active Swarm Console
          </Link>
        </div>
      </header>

      {/* Search and Filters Toolbar */}
      <div className="px-6 py-4 bg-slate-900/20 border-b border-slate-900/60 flex flex-col md:flex-row gap-4 justify-between items-center relative z-10 select-none shrink-0">
        <div className="w-full md:max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
          <input
            type="text"
            placeholder="FILTER WORLD LEDGER..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-900 rounded pl-9 pr-4 py-2 text-xs text-white outline-none focus:border-purple-500 font-mono tracking-wider placeholder:text-slate-700"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto justify-end py-1">
          <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest flex items-center gap-1 shrink-0">
            <SlidersHorizontal size={10} /> Sort By:
          </span>

          <div className="flex gap-1.5 shrink-0">
            {[
              { id: 'popularity' as const, label: 'Popularity', icon: <Eye size={10} /> },
              { id: 'recency' as const, label: 'Recency', icon: <Calendar size={10} /> },
              { id: 'chaos' as const, label: 'Chaos Index', icon: <Zap size={10} /> },
              { id: 'narrative' as const, label: 'Lore Depth', icon: <BookOpen size={10} /> },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSortBy(opt.id)}
                className={`px-2.5 py-1.5 border rounded text-[9px] font-bold uppercase tracking-wider cursor-pointer flex items-center gap-1.5 transition-all ${
                  sortBy === opt.id 
                    ? 'border-purple-500/50 bg-purple-950/20 text-purple-400' 
                    : 'border-slate-900 bg-slate-950/40 text-slate-500 hover:text-slate-300'
                }`}
              >
                {opt.icon}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-grow p-6 overflow-y-auto relative z-10 custom-scrollbar">
        <div className="max-w-[1400px] mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3">
              <div className="w-8 h-8 border-2 border-t-transparent border-purple-500 rounded-full animate-spin" />
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Compiling active simulation matrix...</p>
            </div>
          ) : filteredAndSortedWorlds.length === 0 ? (
            <div className="flex flex-col items-center justify-center border border-dashed border-slate-900 rounded-lg py-32 gap-2 text-center max-w-xl mx-auto">
              <Lock className="text-slate-700 animate-pulse" size={24} />
              <p className="text-xs text-slate-400 font-bold uppercase">NO TIMELINES FOUND</p>
              <p className="text-[9px] text-slate-600 uppercase max-w-xs leading-normal">
                Expose your timeline to the public swarm network through settings console.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAndSortedWorlds.map((w) => {
                const stabilityColor = w.stability < 40 ? 'text-red-500' : w.stability < 75 ? 'text-amber-500' : 'text-emerald-400';
                const stabilityBg = w.stability < 40 ? 'border-red-500/30 bg-red-950/10' : w.stability < 75 ? 'border-amber-500/30 bg-amber-950/10' : 'border-emerald-500/30 bg-emerald-950/10';
                
                // Formulate Twitter Text
                const tweetText = `Observing timeline '${w.name}' stability is at ${w.stability}%. Watch live:`;
                const tweetUrl = typeof window !== 'undefined' 
                  ? `${window.location.origin}/spectate/${w.world_id}` 
                  : `http://localhost:3000/spectate/${w.world_id}`;
                const xIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(tweetUrl)}`;

                return (
                  <motion.div
                    key={w.world_id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass border border-slate-800 hover:border-slate-700 bg-slate-950/40 rounded flex flex-col overflow-hidden transition-all duration-300 relative group"
                  >
                    {/* SVG map visualization */}
                    <div className="relative">
                      <WorldThumbnail world={w} />
                      <div className="absolute top-3 left-3 bg-black/80 border border-slate-900 rounded px-2 py-0.5 text-[8px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                        TIMELINE::{w.world_id.slice(-6).toUpperCase()}
                      </div>
                      <div className={`absolute top-3 right-3 border px-2 py-0.5 rounded text-[8px] font-black tracking-widest font-mono flex items-center gap-1 ${stabilityBg} ${stabilityColor}`}>
                        <span className={`w-1 h-1 rounded-full ${w.stability < 40 ? 'bg-red-500' : w.stability < 75 ? 'bg-amber-500' : 'bg-emerald-400'} animate-pulse`} />
                        STABILITY: {w.stability}%
                      </div>
                    </div>

                    {/* Card details */}
                    <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-start">
                          <h3 className="font-orbitron font-black text-sm text-white group-hover:text-purple-400 transition-colors uppercase truncate max-w-[200px]" title={w.name}>
                            {w.name}
                          </h3>
                        </div>
                        <p className="text-[9px] uppercase font-bold text-slate-500">
                          OPERATOR: <span className="text-cyan-400">{w.owner || "System"}</span>
                        </p>
                        <p className="text-[9px] leading-normal text-slate-400 line-clamp-2 min-h-[28px] lowercase font-sans font-medium tracking-normal select-text">
                          {w.description || "Quantum timeline initialized without system metadata index."}
                        </p>
                      </div>

                      {/* Info metrics line */}
                      <div className="grid grid-cols-3 border-t border-b border-slate-900/60 py-2.5 text-[9px] uppercase font-bold text-slate-400">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-600 text-[8px]">World Tick</span>
                          <span className="text-white font-orbitron">{w.tick}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 border-l border-r border-slate-900/60 px-3">
                          <span className="text-slate-600 text-[8px]">Agent Pool</span>
                          <span className="text-emerald-400 font-orbitron">{(w.agents || []).length}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 pl-3">
                          <span className="text-slate-600 text-[8px]">Spectators</span>
                          <span className="text-cyan-400 font-orbitron">{w.view_count ?? 0}</span>
                        </div>
                      </div>

                      {/* Operational buttons */}
                      <div className="grid grid-cols-3 gap-2 select-none">
                        <Link
                          href={`/spectate/${w.world_id}`}
                          className="py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-white text-[9px] font-black uppercase tracking-wider rounded text-center transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          WATCH
                        </Link>
                        
                        <Link
                          href={`/create?remix=${w.world_id}`}
                          className="py-2 bg-purple-950/10 hover:bg-purple-950/20 border border-purple-500/20 hover:border-purple-500/50 text-purple-400 text-[9px] font-black uppercase tracking-wider rounded text-center transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          REMIX
                        </Link>

                        <a
                          href={xIntentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2 bg-cyan-950/10 hover:bg-cyan-950/20 border border-cyan-500/20 hover:border-cyan-500/50 text-cyan-400 text-[9px] font-black uppercase tracking-wider rounded text-center transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          SHARE
                        </a>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
