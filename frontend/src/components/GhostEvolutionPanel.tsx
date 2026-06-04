"use client";

import React, { useState, useEffect } from 'react';
import { Cpu, History, Check, Trash2, Zap, AlertTriangle, TrendingUp, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GhostVariant {
  id: string;
  world_id: string;
  variant_hash: string;
  source: string;
  diff: string;
  fitness: number;
  parent_hash: string;
  activated: boolean;
  promoted: boolean;
  created_at: string;
}

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '1';
  const match = document.cookie.match(new RegExp('(^| )csrf_token=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : '1';
};

export const GhostEvolutionPanel = ({ worldId }: { worldId: string }) => {
  const [variants, setVariants] = useState<GhostVariant[]>([]);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchVariants = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:8000/v1/ghost/variants`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setVariants(data);
        setSelectedHash(prev => prev || (data.length > 0 ? data[0].variant_hash : null));
      }
    } catch (e) {
      console.error("Failed to fetch ghost variants", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVariants();
    }, 0);
    // Poll every 10 seconds for new variants
    const interval = setInterval(() => {
      fetchVariants();
    }, 10000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [fetchVariants, worldId]);

  const selectedVariant = variants.find(v => v.variant_hash === selectedHash);

  const handlePromote = async (hash: string) => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`http://localhost:8000/v1/ghost/variants/${hash}/promote`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken()
        }
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ text: "Variant successfully promoted. Active module reloaded.", type: 'success' });
        fetchVariants();
      } else {
        setMessage({ text: data.detail || "Promotion failed.", type: 'error' });
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to promote variant due to a connection error.";
      setMessage({ text: errMsg, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (hash: string) => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`http://localhost:8000/v1/ghost/variants/${hash}/reject`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': getCsrfToken()
        }
      });
      if (res.ok) {
        setMessage({ text: "Variant rejected and removed from archive.", type: 'success' });
        const remaining = variants.filter(v => v.variant_hash !== hash);
        setVariants(remaining);
        setSelectedHash(remaining.length > 0 ? remaining[0].variant_hash : null);
      } else {
        setMessage({ text: "Failed to reject variant.", type: 'error' });
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to reject variant due to a connection error.";
      setMessage({ text: errMsg, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

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
    <div className="glass h-full rounded-lg border border-slate-800/80 bg-black/40 flex flex-col overflow-hidden relative shadow-[0_0_20px_rgba(168,85,247,0.05)]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800/60 bg-slate-950/60 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Cpu className="text-purple-400 animate-pulse" size={18} />
          <h2 className="font-orbitron text-sm font-bold uppercase tracking-widest text-white">Ghost Darwin-Gödel Evolution</h2>
        </div>
        <button 
          onClick={fetchVariants}
          disabled={loading}
          className="p-1.5 border border-slate-800 hover:border-slate-600 rounded bg-slate-900/40 text-slate-400 hover:text-white transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-12">
        {/* Left list panel */}
        <div className="col-span-12 md:col-span-4 border-r border-slate-800/40 bg-slate-950/25 flex flex-col min-h-0 overflow-y-auto">
          {loading && variants.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 text-xs uppercase tracking-widest font-bold">
              <RefreshCw className="animate-spin mb-3 text-purple-400" size={18} />
              Loading evolution ledger...
            </div>
          ) : variants.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-600 text-xs uppercase tracking-wider font-bold">
              <History className="mb-2 opacity-30" size={24} />
              No variants logged.
              <br />
              <span className="text-[9px] text-slate-700 mt-1">WAITING FOR NEXT GHOST CYCLE...</span>
            </div>
          ) : (
            <div className="flex-1 divide-y divide-slate-900">
              {variants.map(v => (
                <button
                  key={v.variant_hash}
                  onClick={() => setSelectedHash(v.variant_hash)}
                  className={`w-full text-left p-4 transition-all hover:bg-slate-900/30 flex flex-col gap-2 cursor-pointer ${
                    selectedHash === v.variant_hash ? 'bg-purple-950/10 border-l-2 border-purple-500' : ''
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="text-[10px] text-slate-500 font-bold font-mono">
                      #{v.variant_hash.substring(0, 8)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {v.promoted && (
                        <span className="text-[8px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold uppercase px-1 rounded">
                          Active
                        </span>
                      )}
                      <span className="text-[9px] font-bold text-slate-300 font-orbitron bg-slate-900 border border-slate-800 px-1 rounded flex items-center gap-0.5">
                        <TrendingUp size={9} className="text-purple-400" />
                        {v.fitness.toFixed(3)}
                      </span>
                    </div>
                  </div>
                  <div className="text-[9px] text-slate-600">
                    {new Date(v.created_at).toLocaleTimeString([], { hour12: false })}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right view panel */}
        <div className="col-span-12 md:col-span-8 flex flex-col min-h-0 bg-black/60">
          <AnimatePresence mode="wait">
            {selectedVariant ? (
              <motion.div
                key={selectedVariant.variant_hash}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col min-h-0 p-5 gap-4"
              >
                {/* Variant Header Info */}
                <div className="flex flex-wrap justify-between items-start gap-3 border-b border-slate-900 pb-4">
                  <div className="space-y-1">
                    <h3 className="text-xs font-black uppercase text-slate-200 tracking-wider flex items-center gap-1.5">
                      Genetic Mutation: <span className="text-purple-400">#{selectedVariant.variant_hash.substring(0, 16)}</span>
                    </h3>
                    <p className="text-[9px] text-slate-500 font-mono">
                      PARENT_NODE: {selectedVariant.parent_hash.substring(0, 16)}...
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Fitness Index</span>
                      <span className="text-lg font-orbitron font-black text-purple-400">
                        {selectedVariant.fitness.toFixed(4)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Notifications & Status messages */}
                {message && (
                  <div className={`p-3 rounded border text-xs leading-normal flex gap-2 items-center ${
                    message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}>
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>{message.text}</span>
                  </div>
                )}

                {/* Scrollable code diff */}
                <div className="flex-1 min-h-0 border border-slate-900 rounded bg-slate-950 p-4 overflow-auto custom-scrollbar">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2 select-none">
                    Source Code Delta Diff
                  </div>
                  <div className="space-y-0.5">
                    {selectedVariant.diff ? (
                      selectedVariant.diff.split("\n").map(renderDiffLine)
                    ) : (
                      <div className="text-slate-600 italic text-xs">No difference found.</div>
                    )}
                  </div>
                </div>

                {/* Accept/Reject Control Buttons */}
                <div className="flex gap-4 border-t border-slate-900 pt-4">
                  <button
                    onClick={() => handlePromote(selectedVariant.variant_hash)}
                    disabled={actionLoading || selectedVariant.promoted}
                    className={`flex-1 py-2.5 border text-[10px] font-black uppercase font-orbitron tracking-wider rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(34,197,94,0.05)] ${
                      selectedVariant.promoted
                        ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500/50 cursor-not-allowed'
                        : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500 hover:text-black hover:border-emerald-500'
                    }`}
                  >
                    <Check size={14} />
                    {selectedVariant.promoted ? "ACTIVATED" : "ACCEPT & PROMOTE"}
                  </button>

                  <button
                    onClick={() => handleReject(selectedVariant.variant_hash)}
                    disabled={actionLoading || selectedVariant.promoted}
                    className={`px-6 py-2.5 border text-[10px] font-black uppercase font-orbitron tracking-wider rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      selectedVariant.promoted
                        ? 'bg-slate-950 border-slate-900 text-slate-700 cursor-not-allowed'
                        : 'bg-red-500/5 border-red-500/20 text-red-500/50 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50'
                    }`}
                  >
                    <Trash2 size={14} />
                    REJECT
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500 text-xs uppercase tracking-wider font-bold">
                <Zap className="mb-2 opacity-30 text-purple-400 animate-bounce" size={24} />
                No variant selected.
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
