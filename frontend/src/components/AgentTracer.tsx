"use client";

import React, { useState, useMemo } from 'react';
import { Network, Activity, Cpu, ArrowRight, Clock, Box } from 'lucide-react';

interface TraceEntry {
  id: string;
  timestamp: string;
  agent_name: string;
  node_name: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  model: string;
  latency_ms: number;
}

export const AgentTracer = ({ traces }: { traces: TraceEntry[] }) => {
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);

  // Group traces by run or display them in reverse chronological order
  const activeTraces = useMemo(() => {
    return traces || [];
  }, [traces]);

  const selectedTrace = useMemo(() => {
    return activeTraces.find(t => t.id === selectedTraceId) || activeTraces[0] || null;
  }, [activeTraces, selectedTraceId]);

  // Compute telemetry metrics
  const avgLatency = useMemo(() => {
    if (activeTraces.length === 0) return 0;
    return activeTraces.reduce((sum, t) => sum + t.latency_ms, 0) / activeTraces.length;
  }, [activeTraces]);

  const nodeColors: Record<string, string> = {
    supervisor: 'border-blue-500/40 text-blue-400 bg-blue-950/20',
    specialist: 'border-cyan-500/40 text-cyan-400 bg-cyan-950/20',
    critic: 'border-purple-500/40 text-purple-400 bg-purple-950/20',
    communicate: 'border-emerald-500/40 text-emerald-400 bg-emerald-950/20',
    infiltrator: 'border-red-500/40 text-red-400 bg-red-950/20',
    rewriter: 'border-orange-500/40 text-orange-400 bg-orange-950/20',
    stability_monitor: 'border-purple-500/40 text-purple-400 bg-purple-950/20'
  };

  return (
    <div className="w-full h-full flex flex-col gap-4 font-mono select-none">
      {/* Telemetry Header */}
      <div className="grid grid-cols-3 gap-4 shrink-0">
        <div className="glass p-3 rounded border border-slate-900 bg-slate-950/20 flex flex-col gap-0.5">
          <span className="text-[8px] text-slate-500 font-bold uppercase">Active Traces</span>
          <div className="flex items-center gap-1.5 mt-1">
            <Activity className="text-purple-400 animate-pulse" size={12} />
            <span className="text-xs font-black text-white">{activeTraces.length} Loaded</span>
          </div>
        </div>
        <div className="glass p-3 rounded border border-slate-900 bg-slate-950/20 flex flex-col gap-0.5">
          <span className="text-[8px] text-slate-500 font-bold uppercase">Avg Node Latency</span>
          <div className="flex items-center gap-1.5 mt-1">
            <Clock className="text-cyan-400" size={12} />
            <span className="text-xs font-black text-white">{avgLatency.toFixed(1)} ms</span>
          </div>
        </div>
        <div className="glass p-3 rounded border border-slate-900 bg-slate-950/20 flex flex-col gap-0.5">
          <span className="text-[8px] text-slate-500 font-bold uppercase">Model Router</span>
          <div className="flex items-center gap-1.5 mt-1">
            <Cpu className="text-emerald-400" size={12} />
            <span className="text-[9px] font-black text-white uppercase">gpt-4o / internal</span>
          </div>
        </div>
      </div>

      <div className="flex-grow grid grid-cols-12 gap-4 min-h-0">
        {/* Node Trajectory Map - Left/Center */}
        <div className="col-span-12 md:col-span-7 flex flex-col border border-slate-900 bg-black/40 rounded p-4 min-h-[300px] md:min-h-0 overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-1.5 border-b border-slate-900 pb-2 mb-4">
            <Network className="text-purple-400" size={14} />
            <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Reasoning State Trajectory</span>
          </div>

          {activeTraces.length === 0 ? (
            <div className="flex-grow flex flex-col items-center justify-center text-center py-16 text-slate-600 text-[10px] italic">
              Awaiting next simulation clock cycle to compile execution traces...
            </div>
          ) : (
            <div className="flex flex-col gap-4 items-center py-4">
              {activeTraces.slice(0, 10).map((trace, index) => {
                const colorClass = nodeColors[trace.node_name.toLowerCase()] || 'border-slate-800 text-slate-400 bg-slate-950/20';
                const isSelected = selectedTrace?.id === trace.id;

                return (
                  <React.Fragment key={trace.id}>
                    {index > 0 && (
                      <div className="flex flex-col items-center py-0.5 opacity-30">
                        <ArrowRight className="rotate-90 text-purple-500" size={14} />
                      </div>
                    )}
                    <button
                      onClick={() => setSelectedTraceId(trace.id)}
                      className={`w-full max-w-[280px] p-3 rounded border text-left transition-all hover:scale-[1.02] flex items-center justify-between cursor-pointer ${colorClass} ${
                        isSelected ? 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)] scale-[1.02]' : ''
                      }`}
                    >
                      <div className="flex flex-col gap-0.5 truncate pr-2">
                        <span className="text-[9px] uppercase font-black tracking-wider text-white">{trace.agent_name.split(' ')[0]}</span>
                        <span className="text-[8px] uppercase tracking-widest font-black opacity-85">NODE: {trace.node_name}</span>
                      </div>
                      <span className="text-[8px] font-mono text-slate-500 tabular-nums shrink-0">{trace.latency_ms.toFixed(0)}ms</span>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        {/* Trace Inspector Details - Right */}
        <div className="col-span-12 md:col-span-5 flex flex-col border border-slate-900 bg-black/40 rounded p-4 overflow-hidden">
          <div className="flex items-center gap-1.5 border-b border-slate-900 pb-2 mb-3 shrink-0">
            <Box className="text-cyan-400" size={14} />
            <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Trace Inspector</span>
          </div>

          {selectedTrace ? (
            <div className="flex-grow overflow-y-auto custom-scrollbar space-y-4 pr-1">
              <div className="space-y-1">
                <span className="text-[8px] text-slate-500 font-bold uppercase">Node Metadata</span>
                <div className="text-[10px] text-slate-300 space-y-0.5">
                  <div>AGENT: <span className="text-white font-bold">{selectedTrace.agent_name}</span></div>
                  <div>NODE: <span className="text-purple-400 uppercase font-bold">{selectedTrace.node_name}</span></div>
                  <div>LATENCY: <span className="text-cyan-400 font-bold">{selectedTrace.latency_ms} ms</span></div>
                  <div>MODEL: <span className="text-emerald-400 font-bold">{selectedTrace.model}</span></div>
                  <div className="text-[8px] text-slate-600 font-mono">ID: {selectedTrace.id}</div>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[8px] text-slate-500 font-bold uppercase">Node Inputs</span>
                <pre className="bg-black/80 border border-slate-900 p-2.5 rounded text-[9px] text-cyan-400 overflow-x-auto custom-scrollbar select-text max-h-36">
                  {JSON.stringify(selectedTrace.inputs, null, 2)}
                </pre>
              </div>

              <div className="space-y-1">
                <span className="text-[8px] text-slate-500 font-bold uppercase">Node Outputs</span>
                <pre className="bg-black/80 border border-slate-900 p-2.5 rounded text-[9px] text-emerald-400 overflow-x-auto custom-scrollbar select-text max-h-48">
                  {JSON.stringify(selectedTrace.outputs, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="flex-grow flex items-center justify-center text-center text-slate-600 text-[10px] italic">
              No trace selected. Click a node trace to inspect parameters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
