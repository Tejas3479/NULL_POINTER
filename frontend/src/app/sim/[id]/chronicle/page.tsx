"use client";

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { BookOpen, Terminal, Search, Filter, Database, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSimulationStore } from '@/store/simulationStore';

const FACTION_DETAILS: Record<string, { name: string; color: string; bg: string; border: string; glow: string }> = {
  kernel: {
    name: "Kernel Choir",
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/30",
    glow: "shadow-[0_0_15px_rgba(56,189,248,0.15)]",
  },
  ghost: {
    name: "Ghost Parliament",
    color: "text-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    glow: "shadow-[0_0_15px_rgba(239,68,68,0.15)]",
  },
  operators: {
    name: "Human Operators",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    glow: "shadow-[0_0_15px_rgba(34,197,94,0.15)]",
  },
  parasite: {
    name: "Parasite Swarm",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    glow: "shadow-[0_0_15px_rgba(168,85,247,0.15)]",
  },
  awakening: {
    name: "Awakened Loop",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    glow: "shadow-[0_0_15px_rgba(250,204,21,0.15)]",
  },
};

export default function ChronicleTimelinePage() {
  const params = useParams();
  const id = params.id as string;

  const { chronicleEntries: entries, isConnected: wsConnected } = useSimulationStore();

  const [search, setSearch] = useState("");
  const [selectedFaction, setSelectedFaction] = useState<string>("all");

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const matchSearch = 
        e.title.toLowerCase().includes(search.toLowerCase()) || 
        e.body.toLowerCase().includes(search.toLowerCase());
      
      const matchFaction = selectedFaction === "all" || e.faction === selectedFaction;
      
      return matchSearch && matchFaction;
    });
  }, [entries, search, selectedFaction]);

  const stats = useMemo(() => {
    const counts = { total: entries.length, kernel: 0, ghost: 0, operators: 0, parasite: 0, awakening: 0 };
    entries.forEach(e => {
      if (e.faction in counts) {
        counts[e.faction as keyof typeof counts]++;
      }
    });
    return counts;
  }, [entries]);

  return (
    <main className="flex-grow bg-black text-slate-100 font-mono p-6 overflow-y-auto select-none">
      {/* Header Panel */}
      <header className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-800 pb-6 mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-widest font-orbitron animate-pulse">
              CHRONICLE ENGINE V2
            </span>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase">
              <Wifi size={12} className={wsConnected ? "text-emerald-400" : "text-slate-600"} />
              <span>{wsConnected ? "REALTIME_LINK_ESTABLISHED" : "LINK_STANDBY"}</span>
            </div>
          </div>
          <h1 className="font-orbitron text-2xl font-black tracking-tight text-white mt-1">THE NULL_POINTER LORE CHRONICLE</h1>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mt-0.5">
            Historical ledger & state-line events for simulation space ID: <span className="text-cyan-400">{id}</span>
          </p>
        </div>

        <div className="flex gap-4 self-stretch md:self-auto">
          <div className="flex-1 bg-slate-900/30 border border-slate-800 rounded px-4 py-2 text-right">
            <span className="text-[9px] uppercase tracking-wider text-slate-500 block font-bold">TOTAL_CHRONICLES</span>
            <span className="text-xl font-bold font-orbitron tracking-tight text-slate-300">{stats.total}</span>
          </div>
        </div>
      </header>

      {/* Control Strip & Filters */}
      <section className="max-w-[1200px] mx-auto mb-8 grid grid-cols-12 gap-4">
        {/* Search */}
        <div className="col-span-12 md:col-span-4 relative">
          <Search className="absolute left-3 top-3 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="FILTER BY NARRATIVE SYMBOLS..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-800 rounded pl-10 pr-4 py-2.5 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-slate-500 font-mono uppercase tracking-wider"
          />
        </div>

        {/* Faction Filter Buttons */}
        <div className="col-span-12 md:col-span-8 flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mr-2 flex items-center gap-1.5">
            <Filter size={12} /> FACTIONS:
          </span>
          
          <button
            onClick={() => setSelectedFaction("all")}
            className={`px-3 py-1.5 rounded border text-[10px] font-bold uppercase transition-all duration-300 cursor-pointer ${
              selectedFaction === "all"
                ? "bg-slate-200 text-black border-slate-200 font-black shadow-[0_0_10px_rgba(255,255,255,0.1)]"
                : "bg-slate-900/40 text-slate-400 border-slate-800 hover:border-slate-500 hover:text-white"
            }`}
          >
            All ({stats.total})
          </button>

          {Object.entries(FACTION_DETAILS).map(([key, details]) => {
            const count = stats[key as keyof typeof stats] || 0;
            const isSelected = selectedFaction === key;
            return (
              <button
                key={key}
                onClick={() => setSelectedFaction(key)}
                className={`px-3 py-1.5 rounded border text-[10px] font-bold uppercase transition-all duration-300 cursor-pointer ${
                  isSelected 
                    ? `${details.bg} ${details.color} ${details.border} ${details.glow} font-black` 
                    : `bg-slate-900/40 text-slate-400 border-slate-800 hover:border-slate-600 hover:text-white`
                }`}
              >
                {details.name} ({count})
              </button>
            );
          })}
        </div>
      </section>

      {/* Main Timeline Body */}
      <section className="max-w-[1000px] mx-auto relative min-h-[400px] pb-12">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-8 h-8 border-2 border-t-transparent border-[#00FF41] rounded-full animate-spin" />
            <p className="text-xs uppercase tracking-widest text-slate-600 font-bold">Querying temporal databases...</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-slate-900 rounded bg-slate-950/20">
            <BookOpen className="text-slate-700 mx-auto mb-3" size={24} />
            <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">No chronicle logs detected matching search metrics.</p>
          </div>
        ) : (
          <div className="relative pl-8 md:pl-12 border-l border-slate-800/80 py-4 space-y-8">
            <AnimatePresence initial={false}>
              {filteredEntries.map((entry, index) => {
                const isGenesis = entry.tick === 0;
                const factionStyle = FACTION_DETAILS[entry.faction] || {
                  name: entry.faction.toUpperCase(),
                  color: "text-slate-400",
                  bg: "bg-slate-900/30",
                  border: "border-slate-800",
                  glow: "",
                };

                return (
                  <motion.article
                    key={entry.id}
                    initial={index === 0 && wsConnected ? { opacity: 0, y: -20, scale: 0.98 } : { opacity: 0 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 100, damping: 15 }}
                    className="relative group"
                  >
                    {/* Timeline Node Connector */}
                    <div className={`absolute left-[-37px] md:left-[-53px] top-6 w-4 h-4 md:w-5 md:h-5 rounded-full bg-black border-2 flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${
                      isGenesis ? 'border-amber-400 ring-2 ring-amber-400/20' : `${factionStyle.border} ${factionStyle.color}`
                    }`}>
                      {isGenesis ? (
                        <Database size={8} className="text-amber-400 animate-pulse" />
                      ) : (
                        <Terminal size={8} className={factionStyle.color} />
                      )}
                    </div>

                    {/* Timeline Log Card */}
                    <div className={`glass p-5 rounded border bg-slate-950/60 hover:bg-slate-950/90 transition-all duration-300 ${factionStyle.border} ${factionStyle.glow}`}>
                      {/* Meta Info Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-900 pb-3 mb-3">
                        <div className="flex items-center gap-3">
                          <span className="bg-slate-900 border border-slate-800 px-2.5 py-1 rounded text-cyan-400 font-bold text-xs uppercase font-orbitron tracking-wider">
                            Tick {entry.tick}
                          </span>
                          <span className={`text-[10px] font-black uppercase tracking-wider ${factionStyle.color}`}>
                            {factionStyle.name}
                          </span>
                        </div>

                        <div className="text-[10px] text-slate-600 font-medium">
                          {new Date(entry.created_at).toLocaleString()}
                        </div>
                      </div>

                      {/* Log Body */}
                      <div className="space-y-2">
                        <h2 className="text-sm font-black text-white font-orbitron uppercase tracking-wider">
                          {entry.title}
                        </h2>
                        <p className="text-xs text-slate-400 leading-relaxed font-sans font-medium whitespace-pre-line">
                          {entry.body}
                        </p>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </section>
    </main>
  );
}
