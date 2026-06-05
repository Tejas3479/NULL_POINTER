"use client";

import React, { useState, useMemo } from 'react';
import { useSimulationStore } from '@/store/simulationStore';
import { Search, Shield, Smile, EyeOff, UserCheck } from 'lucide-react';

const FACTION_COLORS: Record<string, { color: string; border: string; bg: string }> = {
  kernel: { color: "text-sky-400", border: "border-sky-500/30", bg: "bg-sky-500/10" },
  ghost: { color: "text-red-500", border: "border-red-500/30", bg: "bg-red-500/10" },
  operators: { color: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/10" },
  parasite: { color: "text-purple-400", border: "border-purple-500/30", bg: "bg-purple-500/10" },
  awakening: { color: "text-yellow-400", border: "border-yellow-500/30", bg: "bg-yellow-500/10" },
};

export default function AgentsPage() {
  const { world } = useSimulationStore();
  const [search, setSearch] = useState("");
  const [loyaltyFilter, setLoyaltyFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const agents = useMemo(() => {
    return world?.agents || [];
  }, [world]);

  // Filtered agents list
  const filteredAgents = useMemo(() => {
    return agents.filter(agent => {
      const matchesSearch = 
        agent.name.toLowerCase().includes(search.toLowerCase()) ||
        (agent.biography || '').toLowerCase().includes(search.toLowerCase());
      
      const matchesLoyalty = loyaltyFilter === "all" || agent.loyalty === loyaltyFilter;
      
      const matchesStatus = 
        statusFilter === "all" || 
        (statusFilter === "active" && agent.active) || 
        (statusFilter === "inactive" && !agent.active);
      
      return matchesSearch && matchesLoyalty && matchesStatus;
    });
  }, [agents, search, loyaltyFilter, statusFilter]);

  // Selected agent
  const selectedAgent = useMemo(() => {
    if (selectedAgentId) {
      return agents.find(a => a.id === selectedAgentId) || agents[0];
    }
    return agents[0] || null;
  }, [agents, selectedAgentId]);

  // Related agents logic (mocked relationship graph)
  const relationships = useMemo(() => {
    if (!selectedAgent || agents.length <= 1) return [];
    
    // Find up to 4 other agents to relate to
    const otherAgents = agents.filter(a => a.id !== selectedAgent.id);
    return otherAgents.slice(0, 4).map((other, idx) => {
      let type: 'ALLIED' | 'HOSTILE' | 'NEUTRAL' = 'NEUTRAL';
      let description = 'Indifferent observer';

      if (other.loyalty === selectedAgent.loyalty) {
        type = 'ALLIED';
        description = 'Faction Ally / Operations partner';
      } else if (
        (selectedAgent.loyalty === 'ghost' && other.loyalty === 'operators') ||
        (selectedAgent.loyalty === 'operators' && other.loyalty === 'ghost') ||
        (selectedAgent.loyalty === 'parasite' && other.loyalty === 'operators')
      ) {
        type = 'HOSTILE';
        description = 'Primary Target / Cyber Adversary';
      }

      return {
        agent: other,
        type,
        description,
        // Angles for layout arrangement around center agent
        angle: (idx * 90) * (Math.PI / 180) 
      };
    });
  }, [selectedAgent, agents]);

  if (!world) {
    return (
      <div className="flex flex-col items-center justify-center flex-grow py-24 gap-4">
        <div className="w-8 h-8 border-2 border-t-transparent border-cyan-400 rounded-full animate-spin" />
        <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Accessing Agent Swarm directory...</p>
      </div>
    );
  }

  return (
    <div className="flex-grow grid grid-cols-12 gap-6 p-6 h-full min-h-0 overflow-y-auto md:overflow-hidden select-none font-mono">
      {/* DIRECTORY LIST - Left Pane */}
      <section className="col-span-12 lg:col-span-6 xl:col-span-5 flex flex-col gap-4 h-full min-h-[400px] md:min-h-0 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
          <Shield className="text-purple-400" size={16} />
          <h1 className="font-orbitron text-md font-black uppercase tracking-widest text-white">Agent Subsystems</h1>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2 text-slate-500" size={14} />
            <input
              type="text"
              placeholder="SEARCH BY CODENAME / ARCHETYPE..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-3 py-1.5 text-[10px] text-slate-300 focus:outline-none focus:border-slate-500 uppercase placeholder:text-slate-700 font-mono tracking-wider"
            />
          </div>

          {/* Faction filters */}
          <div className="flex flex-wrap gap-1 items-center">
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mr-1.5">Factions:</span>
            <button
              onClick={() => setLoyaltyFilter("all")}
              className={`px-2 py-0.5 border rounded text-[8px] font-black uppercase transition-all ${
                loyaltyFilter === "all"
                  ? "bg-slate-200 text-black border-slate-200 font-bold"
                  : "bg-slate-950 border-slate-800 text-slate-500 hover:text-white"
              }`}
            >
              All
            </button>
            {Object.keys(FACTION_COLORS).map(fac => (
              <button
                key={fac}
                onClick={() => setLoyaltyFilter(fac)}
                className={`px-2 py-0.5 border rounded text-[8px] font-black uppercase transition-all ${
                  loyaltyFilter === fac
                    ? `${FACTION_COLORS[fac].bg} ${FACTION_COLORS[fac].color} ${FACTION_COLORS[fac].border} font-bold`
                    : `bg-slate-950 border-slate-800 text-slate-500 hover:text-white`
                }`}
              >
                {fac}
              </button>
            ))}
          </div>

          {/* Status filter toggles */}
          <div className="flex items-center gap-1">
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mr-1.5">Status:</span>
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-2 py-0.5 border rounded text-[8px] font-black uppercase transition-all ${
                statusFilter === "all"
                  ? "bg-slate-200 text-black border-slate-200"
                  : "bg-slate-950 border-slate-800 text-slate-500 hover:text-white"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter("active")}
              className={`px-2 py-0.5 border rounded text-[8px] font-black uppercase transition-all ${
                statusFilter === "active"
                  ? "bg-emerald-950/20 text-emerald-400 border-emerald-500/30"
                  : "bg-slate-950 border-slate-800 text-slate-500 hover:text-white"
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter("inactive")}
              className={`px-2 py-0.5 border rounded text-[8px] font-black uppercase transition-all ${
                statusFilter === "inactive"
                  ? "bg-red-950/20 text-red-400 border-red-500/30"
                  : "bg-slate-950 border-slate-800 text-slate-500 hover:text-white"
              }`}
            >
              Inactive
            </button>
          </div>
        </div>

        {/* Agents List */}
        <div className="flex-grow overflow-y-auto divide-y divide-slate-900/60 custom-scrollbar border border-slate-900 bg-black/40 rounded p-1">
          {filteredAgents.length === 0 ? (
            <div className="text-center py-12 text-slate-600 text-[10px] italic">
              No matching agent profiles recorded.
            </div>
          ) : (
            filteredAgents.map(agent => {
              const style = FACTION_COLORS[agent.loyalty] || { color: "text-slate-400", border: "border-slate-800", bg: "bg-slate-900" };
              const isSelected = selectedAgent?.id === agent.id;
              
              return (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgentId(agent.id)}
                  className={`w-full text-left px-3 py-3 hover:bg-slate-900/30 transition-all flex items-center justify-between border-l-2 ${
                    isSelected ? 'border-l-purple-500 bg-slate-900/20' : 'border-l-transparent'
                  }`}
                >
                  <div className="flex flex-col gap-1 pr-4">
                    <span className="text-[10px] font-black text-white uppercase tracking-wider">{agent.name}</span>
                    <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">
                      ARCHETYPE: {agent.archetype_id.replace('archetype_', '')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${style.bg} ${style.color} ${style.border}`}>
                      {agent.loyalty}
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full ${agent.active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-700'}`} />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* DETAIL VIEW / GRAPH - Right Pane */}
      <section className="col-span-12 lg:col-span-6 xl:col-span-7 flex flex-col gap-4 h-full min-h-[400px] md:min-h-0 overflow-y-auto md:overflow-hidden select-none pr-1">
        {selectedAgent ? (
          <div className="flex flex-col h-full min-h-0 gap-4">
            {/* Agent Info Profile */}
            <div className="glass p-5 rounded border border-slate-800 bg-slate-950/40 relative overflow-hidden flex flex-col gap-3 shrink-0">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <Shield size={100} className="text-white" />
              </div>
              
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-900 pb-3">
                <div>
                  <h2 className="text-md font-black text-white font-orbitron tracking-wide uppercase">{selectedAgent.name}</h2>
                  <span className="text-[9px] text-slate-500 uppercase font-black">
                    Loyalty: <span className={FACTION_COLORS[selectedAgent.loyalty]?.color || 'text-slate-300'}>{selectedAgent.loyalty}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedAgent.active ? (
                    <span className="bg-emerald-950/20 text-emerald-400 border border-emerald-500/20 text-[8px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1">
                      <UserCheck size={9} /> ONLINE_SWARM
                    </span>
                  ) : (
                    <span className="bg-red-950/20 text-red-400 border border-red-500/20 text-[8px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1">
                      <EyeOff size={9} /> STANDBY
                    </span>
                  )}
                  <span className="bg-slate-900 border border-slate-800 text-slate-400 text-[8px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1">
                    <Smile size={9} /> {selectedAgent.mood}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[8px] uppercase tracking-widest text-slate-500 font-bold block">BIOGRAPHICAL LEDGER</span>
                <p className="text-[10px] text-slate-400 font-sans font-medium leading-relaxed max-h-24 overflow-y-auto custom-scrollbar">
                  {selectedAgent.biography || "No biological metadata recorded. Swarm agent represents automated defense system."}
                </p>
              </div>

              {/* Memories */}
              <div className="space-y-1.5">
                <span className="text-[8px] uppercase tracking-widest text-slate-500 font-bold block">TEMPORAL MEMORIES</span>
                <div className="max-h-24 overflow-y-auto custom-scrollbar space-y-1 bg-black/40 border border-slate-900 p-2 rounded">
                  {selectedAgent.memory && selectedAgent.memory.length > 0 ? (
                    selectedAgent.memory.map((mem, idx) => (
                      <p key={idx} className="text-[9px] text-slate-400 leading-normal border-b border-slate-950 pb-1 last:border-0 last:pb-0 font-mono">
                        &gt; {mem}
                      </p>
                    ))
                  ) : (
                    <p className="text-[9px] text-slate-600 italic">No neural events recorded in memory banks.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Relationship Graph Panel */}
            <div className="glass p-5 rounded border border-slate-800 bg-slate-950/40 flex-grow min-h-[300px] flex flex-col gap-3 relative overflow-hidden">
              <span className="text-[8px] uppercase tracking-widest text-slate-500 font-bold block shrink-0">NEURAL RELATIONSHIP INDEX</span>
              
              {/* Graphical Canvas simulation */}
              <div className="flex-grow relative flex items-center justify-center bg-black/20 border border-slate-900/60 rounded overflow-hidden">
                
                {/* Center Node (Selected Agent) */}
                <div className="relative z-10 w-24 h-24 rounded-full border border-purple-500/40 bg-purple-950/20 shadow-[0_0_20px_rgba(168,85,247,0.15)] flex flex-col items-center justify-center text-center p-2">
                  <span className="text-[9px] font-black text-white uppercase truncate max-w-[80px]">
                    {selectedAgent.name.split(' ')[0]}
                  </span>
                  <span className="text-[7px] text-purple-400 uppercase font-black tracking-wider mt-0.5">
                    CENTER
                  </span>
                </div>

                {/* Surrounding Node connections */}
                {relationships.map((rel, idx) => {
                  // Polar coordinate mapping: R=110px
                  const radius = 110;
                  const x = Math.cos(rel.angle) * radius;
                  const y = Math.sin(rel.angle) * radius;
                  
                  const isAllied = rel.type === 'ALLIED';
                  const isHostile = rel.type === 'HOSTILE';
                  const nodeColor = isAllied ? 'border-emerald-500 bg-emerald-950/20 text-emerald-400' : isHostile ? 'border-red-500 bg-red-950/20 text-red-400' : 'border-slate-800 bg-slate-950/20 text-slate-400';

                  return (
                    <React.Fragment key={idx}>
                      {/* Connection Line */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                        <line 
                          x1="50%" 
                          y1="50%" 
                          x2={`calc(50% + ${x}px)`} 
                          y2={`calc(50% + ${y}px)`} 
                          className="stroke-1" 
                          stroke={isAllied ? '#10b981' : isHostile ? '#ef4444' : '#475569'}
                          strokeWidth="1.5"
                          strokeDasharray={isHostile ? '3,3' : 'none'}
                          opacity={isHostile ? 0.4 : 0.2}
                        />
                      </svg>

                      {/* Surrounding Agent Node */}
                      <div 
                        style={{
                          transform: `translate(${x}px, ${y}px)`
                        }}
                        className={`absolute w-20 h-20 rounded border flex flex-col items-center justify-center text-center p-1.5 z-10 transition-all hover:scale-105 select-none ${nodeColor}`}
                      >
                        <span className="text-[8px] font-black truncate w-full text-white">{rel.agent.name.split(' ')[0]}</span>
                        <span className="text-[6px] font-black uppercase tracking-wider scale-90 mt-0.5">{rel.type}</span>
                        
                        {/* Hover detailed description */}
                        <div className="absolute opacity-0 hover:opacity-100 transition-opacity bg-black border border-slate-800 p-1.5 rounded text-[7px] w-24 text-left pointer-events-none mt-20 font-sans shadow-2xl z-20 text-slate-300">
                          {rel.description}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-24 border border-slate-900 rounded bg-slate-950/20">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">No active agents in directory.</p>
          </div>
        )}
      </section>
    </div>
  );
}
