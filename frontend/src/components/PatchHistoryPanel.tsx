"use client";

import React, { useState, useEffect } from 'react';
import { History, RefreshCw, Check, X, ShieldCheck, ShieldAlert, Terminal, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SandboxRun {
  success: boolean;
  output: string;
  error: string;
  execution_time: number;
  exit_code?: number;
  provider: string;
}

interface PatchTrace {
  id: string;
  world_id: string;
  player_id: string;
  tick: number;
  vulnerability: string;
  patch_code: string;
  diff: string;
  score: number;
  critic_score: number;
  accepted: boolean;
  feedback: string;
  sandbox_trace: {
    language: string;
    started_at: string;
    syntax: {
      success: boolean;
      error: string;
    };
    baseline: SandboxRun | null;
    patched: SandboxRun | null;
  };
  created_at: string;
}

export const PatchHistoryPanel = ({ worldId }: { worldId: string }) => {
  const [traces, setTraces] = useState<PatchTrace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTraces = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:8000/v1/simulation/${worldId}/patches`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTraces(data);
        setSelectedId(prev => prev || (data.length > 0 ? data[0].id : null));
      }
    } catch (e) {
      console.error("Failed to fetch patch history", e);
    } finally {
      setLoading(false);
    }
  }, [worldId]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchTraces();
    });
    // Poll every 10 seconds for new patch attempts
    const interval = setInterval(() => {
      fetchTraces();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchTraces]);

  const selectedTrace = traces.find(t => t.id === selectedId);

  // Helper to color diff lines
  const renderDiffLine = (line: string, index: number) => {
    let className = "text-slate-400";
    if (line.startsWith("+") && !line.startsWith("+++")) {
      className = "text-emerald-400 bg-emerald-950/20 font-bold px-1";
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      className = "text-red-400 bg-red-950/20 font-bold px-1";
    } else if (line.startsWith("@@")) {
      className = "text-cyan-500 font-bold opacity-80";
    }
    return (
      <div key={index} className={`font-mono text-xs py-0.5 whitespace-pre-wrap select-all ${className}`}>
        {line}
      </div>
    );
  };

  return (
    <div className="glass h-full rounded-lg border border-slate-800/80 bg-black/40 flex flex-col overflow-hidden relative shadow-[0_0_20px_rgba(34,197,94,0.05)]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800/60 bg-slate-950/60 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <History className="text-purple-400 animate-pulse" size={18} />
          <h2 className="font-orbitron text-sm font-bold uppercase tracking-widest text-white">Operator Patch History</h2>
        </div>
        <button 
          onClick={fetchTraces}
          disabled={loading}
          className="p-1.5 border border-slate-800 hover:border-slate-600 rounded bg-slate-900/40 text-slate-400 hover:text-white transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-12">
        {/* Left list panel */}
        <div className="col-span-12 md:col-span-4 border-r border-slate-800/40 bg-slate-950/25 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
          {loading && traces.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 text-xs uppercase tracking-widest font-bold">
              <RefreshCw className="animate-spin mb-3 text-purple-400" size={18} />
              Loading patch history...
            </div>
          ) : traces.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-600 text-xs uppercase tracking-wider font-bold">
              <History className="mb-2 opacity-30" size={24} />
              No patch attempts logged.
              <br />
              <span className="text-[9px] text-slate-700 mt-1">AWAITING SYSTEM BREACH TO DEFEND...</span>
            </div>
          ) : (
            <div className="flex-1 divide-y divide-slate-950">
              {traces.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left p-4 transition-all hover:bg-slate-900/30 flex flex-col gap-2 cursor-pointer ${
                    selectedId === t.id ? 'bg-emerald-950/10 border-l-2 border-emerald-500' : ''
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="text-[10px] text-slate-500 font-bold font-mono">
                      Tick #{t.tick}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {t.accepted ? (
                        <span className="text-[8px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold uppercase px-1 rounded flex items-center gap-0.5">
                          <Check size={8} /> ACCEPTED
                        </span>
                      ) : (
                        <span className="text-[8px] bg-red-500/10 border border-red-500/30 text-red-400 font-bold uppercase px-1 rounded flex items-center gap-0.5">
                          <X size={8} /> REJECTED
                        </span>
                      )}
                      <span className="text-[9px] font-bold text-slate-300 font-orbitron bg-slate-900 border border-slate-800 px-1 rounded flex items-center gap-0.5">
                        <TrendingUp size={9} className="text-emerald-400" />
                        {t.score}
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] font-bold text-slate-300 truncate font-mono">
                    {t.feedback ? t.feedback.split(".")[0] : "Patch attempt"}
                  </div>
                  <div className="text-[9px] text-slate-600 font-mono">
                    {new Date(t.created_at).toLocaleTimeString([], { hour12: false })}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right view panel */}
        <div className="col-span-12 md:col-span-8 flex flex-col min-h-0 bg-black/60 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            {selectedTrace ? (
              <motion.div
                key={selectedTrace.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col p-5 gap-4 min-h-0"
              >
                {/* Header Verdict */}
                <div className="flex flex-wrap justify-between items-start gap-3 border-b border-slate-900 pb-4">
                  <div className="space-y-1">
                    <h3 className="text-xs font-black uppercase text-slate-200 tracking-wider flex items-center gap-1.5">
                      Trace: <span className="text-slate-400 font-mono">#{selectedTrace.id.substring(0, 16)}</span>
                    </h3>
                    <p className="text-[9px] text-slate-500 font-mono">
                      OPERATOR: {selectedTrace.player_id}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Combined Score</span>
                      <span className={`text-lg font-orbitron font-black ${selectedTrace.accepted ? 'text-emerald-400' : 'text-red-400'}`}>
                        {selectedTrace.score}/100
                      </span>
                    </div>
                    <div className="border-l border-slate-800 pl-4">
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Critic Score</span>
                      <span className="text-lg font-orbitron font-black text-cyan-400">
                        {selectedTrace.critic_score}/100
                      </span>
                    </div>
                  </div>
                </div>

                {/* Feedback Message */}
                <div className={`p-3 rounded border text-xs leading-normal flex gap-2.5 items-start ${
                  selectedTrace.accepted 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                  {selectedTrace.accepted ? (
                    <ShieldCheck size={16} className="shrink-0 mt-0.5" />
                  ) : (
                    <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <span className="font-bold uppercase text-[10px] tracking-wider block">Verdict: {selectedTrace.accepted ? 'Accepted' : 'Rejected'}</span>
                    <span className="font-mono">{selectedTrace.feedback}</span>
                  </div>
                </div>

                {/* Sandbox Trace Executions (Baseline vs Patched) */}
                <div className="space-y-3">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider select-none flex items-center gap-1.5">
                    <Terminal size={12} /> Before / After Sandbox Output
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Baseline / Vulnerable Execution */}
                    <div className="border border-slate-900 rounded bg-slate-950/80 p-3 flex flex-col gap-2">
                      <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider text-slate-500 pb-1 border-b border-slate-900">
                        <span>Original Run</span>
                        {selectedTrace.sandbox_trace.baseline?.success ? (
                          <span className="text-emerald-500 font-bold">SUCCESS</span>
                        ) : (
                          <span className="text-red-500 font-bold">CRASHED</span>
                        )}
                      </div>
                      
                      {selectedTrace.sandbox_trace.baseline ? (
                        <div className="space-y-2 text-xs font-mono">
                          <div className="flex justify-between text-[9px] text-slate-600">
                            <span>Time: {selectedTrace.sandbox_trace.baseline.execution_time.toFixed(4)}s</span>
                            {selectedTrace.sandbox_trace.baseline.exit_code !== undefined && (
                              <span>Exit Code: {selectedTrace.sandbox_trace.baseline.exit_code}</span>
                            )}
                          </div>
                          
                          {selectedTrace.sandbox_trace.baseline.output && (
                            <div>
                              <div className="text-[9px] text-slate-600 uppercase mb-0.5">Stdout</div>
                              <pre className="bg-black/60 p-2 rounded text-slate-300 overflow-x-auto select-all max-h-32 custom-scrollbar text-[11px] leading-tight">
                                {selectedTrace.sandbox_trace.baseline.output}
                              </pre>
                            </div>
                          )}
                          
                          {selectedTrace.sandbox_trace.baseline.error && (
                            <div>
                              <div className="text-[9px] text-red-500/50 uppercase mb-0.5">Stderr</div>
                              <pre className="bg-red-950/30 p-2 rounded text-red-400 overflow-x-auto select-all max-h-32 custom-scrollbar text-[11px] leading-tight">
                                {selectedTrace.sandbox_trace.baseline.error}
                              </pre>
                            </div>
                          )}
                          
                          {!selectedTrace.sandbox_trace.baseline.output && !selectedTrace.sandbox_trace.baseline.error && (
                            <div className="text-slate-600 italic text-[11px]">No terminal output stream.</div>
                          )}
                        </div>
                      ) : (
                        <div className="text-slate-600 italic text-xs p-4">No baseline run log.</div>
                      )}
                    </div>

                    {/* Patched Execution */}
                    <div className="border border-slate-900 rounded bg-slate-950/80 p-3 flex flex-col gap-2">
                      <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider text-slate-500 pb-1 border-b border-slate-900">
                        <span>Patched Run</span>
                        {selectedTrace.sandbox_trace.patched?.success ? (
                          <span className="text-emerald-500 font-bold">SUCCESS</span>
                        ) : (
                          <span className="text-red-500 font-bold">CRASHED</span>
                        )}
                      </div>
                      
                      {selectedTrace.sandbox_trace.patched ? (
                        <div className="space-y-2 text-xs font-mono">
                          <div className="flex justify-between text-[9px] text-slate-600">
                            <span>Time: {selectedTrace.sandbox_trace.patched.execution_time.toFixed(4)}s</span>
                            {selectedTrace.sandbox_trace.patched.exit_code !== undefined && (
                              <span>Exit Code: {selectedTrace.sandbox_trace.patched.exit_code}</span>
                            )}
                          </div>
                          
                          {selectedTrace.sandbox_trace.patched.output && (
                            <div>
                              <div className="text-[9px] text-slate-600 uppercase mb-0.5">Stdout</div>
                              <pre className="bg-black/60 p-2 rounded text-slate-300 overflow-x-auto select-all max-h-32 custom-scrollbar text-[11px] leading-tight">
                                {selectedTrace.sandbox_trace.patched.output}
                              </pre>
                            </div>
                          )}
                          
                          {selectedTrace.sandbox_trace.patched.error && (
                            <div>
                              <div className="text-[9px] text-red-500/50 uppercase mb-0.5">Stderr</div>
                              <pre className="bg-red-950/30 p-2 rounded text-red-400 overflow-x-auto select-all max-h-32 custom-scrollbar text-[11px] leading-tight">
                                {selectedTrace.sandbox_trace.patched.error}
                              </pre>
                            </div>
                          )}
                          
                          {!selectedTrace.sandbox_trace.patched.output && !selectedTrace.sandbox_trace.patched.error && (
                            <div className="text-slate-600 italic text-[11px]">No terminal output stream.</div>
                          )}
                        </div>
                      ) : (
                        <div className="text-slate-600 italic text-xs p-4">No patch execution run log.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Code Diff */}
                <div className="border border-slate-900 rounded bg-slate-950 p-4">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2 select-none">
                    Patch Diff Delta
                  </div>
                  <div className="overflow-x-auto custom-scrollbar max-h-60">
                    {selectedTrace.diff ? (
                      selectedTrace.diff.split("\n").map(renderDiffLine)
                    ) : (
                      <div className="text-slate-600 italic text-xs">No difference detected.</div>
                    )}
                  </div>
                </div>

                {/* Generated/Submitted Source Code Preview */}
                <div className="border border-slate-900 rounded bg-slate-950 p-4">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2 select-none">
                    Submitted Patch Code Body
                  </div>
                  <pre className="text-xs text-slate-300 font-mono overflow-auto p-2 bg-black/40 rounded max-h-48 custom-scrollbar whitespace-pre select-all">
                    {selectedTrace.patch_code}
                  </pre>
                </div>
              </motion.div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500 text-xs uppercase tracking-wider font-bold">
                <ShieldCheck className="mb-2 opacity-30 text-purple-400 animate-bounce" size={24} />
                No trace selected. Select a patch attempt ledger item to explore diagnostics.
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(168, 85, 247, 0.02); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(168, 85, 247, 0.15); border-radius: 2px; }
      `}</style>
    </div>
  );
};
