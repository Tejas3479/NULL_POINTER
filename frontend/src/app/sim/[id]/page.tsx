"use client";

import React, { useState } from 'react';
import { useSimulationStore } from '@/store/simulationStore';
import { DebuggerCore } from '@/components/DebuggerCore';
import { SourceEditor } from '@/components/SourceEditor';
import { PatchHistoryPanel } from '@/components/PatchHistoryPanel';
import { GhostEvolutionPanel } from '@/components/GhostEvolutionPanel';
import { AgentTracer } from '@/components/AgentTracer';
import { CrucibleLabsPanel } from '@/components/CrucibleLabsPanel';
import { MemoryGraphPanel } from '@/components/MemoryGraphPanel';

export default function DashboardPage() {
  const { 
    stability, 
    logs, 
    isConnected, 
    activeAttack, 
    sendCommand,
    presenceList,
    worldId,
    world
  } = useSimulationStore();

  const [rightTab, setRightTab] = useState<'editor' | 'patches' | 'evolution' | 'traces' | 'labs' | 'memory'>('editor');

  return (
    <div className="flex-grow grid grid-cols-12 gap-6 p-6 h-full min-h-0 overflow-y-auto md:overflow-hidden select-none">
      {/* Debugger terminal occupying left side */}
      <div className="col-span-12 lg:col-span-7 xl:col-span-8 flex flex-col min-h-[500px] md:min-h-0 h-full overflow-hidden">
        <DebuggerCore 
          stability={stability}
          logs={logs}
          isConnected={isConnected}
          activeAttack={activeAttack}
          sendCommand={sendCommand}
          world={world}
        />
      </div>

      {/* Code Editor and Patch History occupying right side */}
      <div className="col-span-12 lg:col-span-5 xl:col-span-4 flex flex-col gap-4 min-h-[500px] md:min-h-0 h-full overflow-hidden">
        {/* Active Presence */}
        <div className="glass p-3 rounded border border-slate-900 bg-slate-950/20 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="font-orbitron text-[9px] font-black uppercase tracking-widest text-slate-300">Active Operators</h2>
            </div>
            <span className="text-[8px] font-mono text-slate-500 bg-slate-900/60 border border-slate-800/80 px-1.5 py-0.5 rounded">
              {presenceList.length} Online
            </span>
          </div>
          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto custom-scrollbar">
            {presenceList.map((player, idx) => (
              <span 
                key={idx} 
                className="text-[8px] uppercase font-mono bg-slate-950 border border-slate-900/60 text-slate-300 px-1.5 py-0.5 rounded flex items-center gap-1"
              >
                <span className={`w-1 h-1 rounded-full ${player.role === 'admin' ? 'bg-red-400 animate-ping' : 'bg-emerald-400'}`} />
                {player.username}
              </span>
            ))}
          </div>
        </div>

        {/* Tab selector */}
        <div className="flex border-b border-slate-900 bg-slate-950/20 rounded p-1 shrink-0">
          <button 
            onClick={() => setRightTab('editor')}
            className={`flex-1 py-1 font-orbitron text-[9px] font-black uppercase tracking-wider text-center cursor-pointer transition-all rounded ${
              rightTab === 'editor' ? 'text-cyan-400 bg-purple-950/30 border border-cyan-500/30' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Sandbox Editor
          </button>
          <button 
            onClick={() => setRightTab('patches')}
            className={`flex-1 py-1 font-orbitron text-[9px] font-black uppercase tracking-wider text-center cursor-pointer transition-all rounded ${
              rightTab === 'patches' ? 'text-emerald-400 bg-purple-950/30 border border-emerald-500/30' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Patch History
          </button>
          <button 
            onClick={() => setRightTab('evolution')}
            className={`flex-1 py-1 font-orbitron text-[9px] font-black uppercase tracking-wider text-center cursor-pointer transition-all rounded ${
              rightTab === 'evolution' ? 'text-purple-400 bg-purple-950/30 border border-purple-500/30' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Ghost Evolution
          </button>
          <button 
            onClick={() => setRightTab('traces')}
            className={`flex-1 py-1 font-orbitron text-[9px] font-black uppercase tracking-wider text-center cursor-pointer transition-all rounded ${
              rightTab === 'traces' ? 'text-blue-400 bg-purple-950/30 border border-blue-500/30' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Agent Tracing
          </button>
          <button 
            onClick={() => setRightTab('labs')}
            className={`flex-1 py-1 font-orbitron text-[9px] font-black uppercase tracking-wider text-center cursor-pointer transition-all rounded ${
              rightTab === 'labs' ? 'text-amber-400 bg-purple-950/30 border border-amber-500/30' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Crucible Labs
          </button>
          <button 
            onClick={() => setRightTab('memory')}
            className={`flex-1 py-1 font-orbitron text-[9px] font-black uppercase tracking-wider text-center cursor-pointer transition-all rounded ${
              rightTab === 'memory' ? 'text-purple-400 bg-purple-950/30 border border-purple-500/30' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Memory Graph
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-grow min-h-0">
          {rightTab === 'editor' ? (
            <SourceEditor />
          ) : rightTab === 'patches' ? (
            <PatchHistoryPanel worldId={worldId || 'local-null-pointer'} />
          ) : rightTab === 'evolution' ? (
            <GhostEvolutionPanel worldId={worldId || 'local-null-pointer'} />
          ) : rightTab === 'traces' ? (
            <AgentTracer traces={world?.agent_traces || []} />
          ) : rightTab === 'labs' ? (
            <CrucibleLabsPanel />
          ) : (
            <MemoryGraphPanel />
          )}
        </div>
      </div>
    </div>
  );
}
