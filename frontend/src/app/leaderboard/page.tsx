"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { 
  Trophy, 
  Hourglass, 
  Sparkles, 
  Activity, 
  User, 
  RefreshCw, 
  ChevronRight,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LeaderboardItem {
  world_id: string;
  name: string;
  tick?: number;
  avg_critic_score?: number;
  emergence_count?: number;
  owner: string;
  stability?: number;
  patch_count?: number;
}

interface LeaderboardData {
  survival: LeaderboardItem[];
  creative_patches: LeaderboardItem[];
  emergent_events: LeaderboardItem[];
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardData>({
    survival: [],
    creative_patches: [],
    emergent_events: []
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"survival" | "patches" | "emergence">("survival");
  const [secondsToRefresh, setSecondsToRefresh] = useState(30);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLeaderboard = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const res = await fetch("http://localhost:8000/v1/simulation/leaderboard", { credentials: "include" });
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (err) {
      console.error("Failed to load leaderboards", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      setSecondsToRefresh(30);
    }
  };

  useEffect(() => {
    // Execute asynchronously to avoid calling setState synchronously within effect
    Promise.resolve().then(() => {
      fetchLeaderboard();
    });

    // Polling every 30 seconds
    const interval = setInterval(() => {
      fetchLeaderboard();
    }, 30000);

    // Refresh countdown tick every 1 second
    timerRef.current = setInterval(() => {
      setSecondsToRefresh((prev) => (prev > 1 ? prev - 1 : 30));
    }, 1000);

    return () => {
      clearInterval(interval);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleManualRefresh = () => {
    fetchLeaderboard(true);
  };

  const currentList = useMemo(() => {
    if (activeTab === "survival") return data.survival;
    if (activeTab === "patches") return data.creative_patches;
    return data.emergent_events;
  }, [data, activeTab]);

  return (
    <main className="min-h-screen bg-black text-slate-100 font-mono relative overflow-hidden flex flex-col">
      {/* Scanline grid effects */}
      <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-20 mix-blend-overlay" />
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#1e293b_1px,transparent_1px)] bg-[size:16px_16px]" />

      {/* Persistent Navigation Header */}
      <header className="px-6 py-4 bg-slate-950 border-b border-slate-900 flex justify-between items-center relative z-10 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-500/10 rounded border border-yellow-500/30">
            <Trophy className="text-yellow-500" size={20} />
          </div>
          <div>
            <h1 className="font-orbitron font-black text-md text-white tracking-widest uppercase">System Leaderboards</h1>
            <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">Timeline Performance metrics</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/gallery"
            className="px-3 py-1.5 border border-slate-800 hover:border-purple-500 text-slate-400 hover:text-purple-400 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1"
          >
            <Globe size={11} /> Public Gallery
          </Link>
          <Link 
            href="/sim/local-null-pointer"
            className="px-3 py-1.5 bg-[#00FF41] hover:bg-[#00FF41]/85 border border-[#00FF41]/30 text-black rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer font-orbitron"
          >
            Active Swarm Console
          </Link>
        </div>
      </header>

      {/* Refresh indicator banner */}
      <div className="px-6 py-2.5 bg-slate-950/40 border-b border-slate-900 flex justify-between items-center text-[9px] uppercase font-bold text-slate-500 relative z-10 select-none shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span>REAL-TIME AGGREGATIONS SYNCHRONIZED</span>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span>Next sweep in:</span>
            <span className="text-cyan-400 font-orbitron w-4 text-right">{secondsToRefresh}s</span>
          </div>
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="p-1 hover:bg-slate-900 border border-slate-900 hover:border-slate-700 rounded text-slate-400 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            title="Manual sync update"
          >
            <RefreshCw size={10} className={isRefreshing ? "animate-spin" : ""} />
            <span>SYNC</span>
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="px-6 py-4 bg-slate-900/10 flex gap-2 border-b border-slate-900 relative z-10 select-none shrink-0 overflow-x-auto">
        {[
          { id: 'survival' as const, label: 'Longest Surviving', icon: <Hourglass size={12} />, desc: 'Timeline Tick Lifespan' },
          { id: 'patches' as const, label: 'Most Creative Patches', icon: <Sparkles size={12} />, desc: 'Average LLM Critic Score' },
          { id: 'emergence' as const, label: 'Emergent Complexity', icon: <Activity size={12} />, desc: 'Count of Emergence Events' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 border rounded text-left transition-all cursor-pointer flex flex-col gap-0.5 min-w-[200px] ${
              activeTab === tab.id
                ? 'border-yellow-500/50 bg-yellow-500/5 text-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.05)]'
                : 'border-slate-900 bg-slate-950/40 text-slate-500 hover:border-slate-800 hover:text-slate-400'
            }`}
          >
            <div className="flex items-center gap-2 text-[10px] font-black uppercase font-orbitron tracking-wider">
              {tab.icon}
              <span>{tab.label}</span>
            </div>
            <span className="text-[8px] opacity-65 font-mono uppercase">{tab.desc}</span>
          </button>
        ))}
      </div>

      {/* Main Content List */}
      <div className="flex-grow p-6 overflow-y-auto relative z-10 custom-scrollbar">
        <div className="max-w-[1000px] mx-auto flex flex-col gap-3">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3">
              <div className="w-8 h-8 border-2 border-t-transparent border-yellow-500 rounded-full animate-spin" />
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Aggregating quantum logs...</p>
            </div>
          ) : currentList.length === 0 ? (
            <div className="text-center py-24 text-slate-600 text-xs uppercase font-bold">
              No timelines recorded in this registry tab
            </div>
          ) : (
            <div className="space-y-2 select-none">
              
              {/* Table Header */}
              <div className="grid grid-cols-12 px-4 py-2 text-[9px] uppercase font-black text-slate-600 font-mono tracking-widest select-none">
                <div className="col-span-1 text-center">Rank</div>
                <div className="col-span-5">Simulation Timeline</div>
                <div className="col-span-3">Operator</div>
                <div className="col-span-3 text-right">Metric Value</div>
              </div>

              {/* List Cards */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-2"
                >
                  {currentList.map((item, idx) => {
                    const isTopThree = idx < 3;
                    const rankColors = [
                      'text-yellow-500 border-yellow-500/20 bg-yellow-950/5',
                      'text-slate-300 border-slate-500/20 bg-slate-900/5',
                      'text-amber-600 border-amber-600/20 bg-amber-950/5'
                    ];
                    const rankColor = isTopThree ? rankColors[idx] : 'text-slate-500 border-slate-900 bg-slate-950/20';

                    return (
                      <div
                        key={item.world_id + idx}
                        className={`grid grid-cols-12 items-center px-4 py-3.5 border rounded-sm font-mono transition-all hover:bg-slate-900/10 ${rankColor}`}
                      >
                        {/* Rank Column */}
                        <div className="col-span-1 text-center font-orbitron font-black text-sm">
                          {idx + 1}
                        </div>

                        {/* Title details */}
                        <div className="col-span-5 flex flex-col gap-0.5">
                          <span className="text-xs font-orbitron font-bold text-white uppercase truncate">
                            {item.name}
                          </span>
                          <span className="text-[8px] text-slate-500 font-mono uppercase">
                            ID: {item.world_id.slice(-8).toUpperCase()}
                          </span>
                        </div>

                        {/* Owner operator */}
                        <div className="col-span-3 text-[10px] text-cyan-400 font-bold uppercase flex items-center gap-1.5">
                          <User size={10} className="text-slate-600" />
                          <span>{item.owner}</span>
                        </div>

                        {/* Leaderboard Metric score values */}
                        <div className="col-span-3 text-right font-orbitron font-bold text-sm tracking-tight text-white flex justify-end items-center gap-3">
                          {activeTab === 'survival' && (
                            <div className="flex flex-col items-end">
                              <span className="text-cyan-400">{item.tick} Ticks</span>
                              {item.stability !== undefined && (
                                <span className={`text-[8px] uppercase font-mono ${item.stability < 40 ? 'text-red-500' : 'text-emerald-400'}`}>
                                  Stability: {item.stability}%
                                </span>
                              )}
                            </div>
                          )}

                          {activeTab === 'patches' && (
                            <div className="flex flex-col items-end">
                              <span className="text-purple-400">{item.avg_critic_score?.toFixed(1)}/100</span>
                              <span className="text-[8px] text-slate-500 uppercase font-mono">
                                {item.patch_count} Patches Evaluated
                              </span>
                            </div>
                          )}

                          {activeTab === 'emergence' && (
                            <div className="flex flex-col items-end">
                              <span className="text-yellow-500">{item.emergence_count} Events</span>
                              {item.stability !== undefined && (
                                <span className={`text-[8px] uppercase font-mono ${item.stability < 40 ? 'text-red-500' : 'text-emerald-400'}`}>
                                  Stability: {item.stability}%
                                </span>
                              )}
                            </div>
                          )}

                          <Link
                            href={`/spectate/${item.world_id}`}
                            className="p-1 border border-slate-800 hover:border-slate-500 rounded text-slate-400 hover:text-white transition-all cursor-pointer shrink-0"
                            title="Inspect/Spectate world timeline"
                          >
                            <ChevronRight size={12} />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>

            </div>
          )}
        </div>
      </div>
    </main>
  );
}


