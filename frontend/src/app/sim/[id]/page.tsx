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
import { ResizableLayout } from '@/components/ResizableLayout';
import { motion } from 'framer-motion';

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
    <div className="flex-grow p-6 h-full min-h-0 overflow-hidden select-none">
      <ResizableLayout
        left={
          <DebuggerCore 
            stability={stability}
            logs={logs}
            isConnected={isConnected}
            activeAttack={activeAttack}
            sendCommand={sendCommand}
            world={world}
          />
        }
        right={
          <div className="flex flex-col gap-4 h-full min-h-0 overflow-hidden">
            {/* Active Presence */}
            <div className="glass p-3 rounded border border-slate-900 bg-slate-950/20 flex flex-col gap-2 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
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
            <div className="flex border-b border-slate-900 bg-slate-950/40 rounded p-1 shrink-0 relative gap-1 overflow-x-auto custom-scrollbar">
              {[
                { id: 'editor', label: 'Sandbox Editor', color: 'text-cyan-400', activeBg: 'bg-cyan-500/10 border-cyan-500/30' },
                { id: 'patches', label: 'Patch History', color: 'text-emerald-400', activeBg: 'bg-emerald-500/10 border-emerald-500/30' },
                { id: 'evolution', label: 'Ghost Evolution', color: 'text-purple-400', activeBg: 'bg-purple-500/10 border-purple-500/30' },
                { id: 'traces', label: 'Agent Tracing', color: 'text-blue-400', activeBg: 'bg-blue-500/10 border-blue-500/30' },
                { id: 'labs', label: 'Crucible Labs', color: 'text-amber-400', activeBg: 'bg-amber-500/10 border-amber-500/30' },
                { id: 'memory', label: 'Memory Graph', color: 'text-purple-400', activeBg: 'bg-purple-500/10 border-purple-500/30' }
              ].map(tab => {
                const isActive = rightTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setRightTab(tab.id as 'editor' | 'patches' | 'evolution' | 'traces' | 'labs' | 'memory')}
                    className={`flex-1 min-w-[90px] py-1.5 px-2 font-orbitron text-[9px] font-black uppercase tracking-wider text-center cursor-pointer relative transition-all duration-300 rounded ${
                      isActive ? tab.color : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeRightTabBlock"
                        className={`absolute inset-0 border rounded ${tab.activeBg} bg-purple-950/20`}
                        transition={{ type: "spring", stiffness: 350, damping: 28 }}
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
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
        }
        defaultLeftPercentage={65}
        minLeftPercentage={30}
        maxLeftPercentage={80}
        leftClassName="h-full overflow-hidden"
        rightClassName="h-full overflow-hidden"
      />
    </div>
  );
}
