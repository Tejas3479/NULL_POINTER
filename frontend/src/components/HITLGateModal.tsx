"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Check, X, Code, AlertTriangle } from 'lucide-react';
import { GlitchText } from './GlitchText';

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '1';
  const match = document.cookie.match(new RegExp('(^| )csrf_token=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : '1';
};

interface PendingApproval {
  id: string;
  type: string;
  status: string;
  created_at: string;
  metadata: {
    variant_hash: string;
    diff: string;
    creativity: number;
    stability_impact: number;
    fitness: number;
    governor_ok: boolean;
  };
}

export const HITLGateModal = ({
  approvals,
  onResolved
}: {
  approvals: PendingApproval[];
  onResolved: () => void;
}) => {
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!approvals || approvals.length === 0) return null;

  const current = approvals[0];
  const { variant_hash, diff, creativity, stability_impact, governor_ok } = current.metadata;

  const handleResolve = async (action: 'approve' | 'reject') => {
    setResolving(true);
    setError(null);
    try {
      const res = await fetch(`http://localhost:8000/v1/simulation/approvals/${current.id}/resolve`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken()
        },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Resolution request failed');
      }
      onResolved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setResolving(false);
    }
  };

  // Render a simple styled diff split by lines
  const renderDiff = () => {
    if (!diff) return <div className="text-slate-600 italic">No code diff recorded.</div>;
    const lines = diff.split('\n');
    return (
      <div className="bg-black/90 p-4 border border-slate-900 rounded font-mono text-[9px] overflow-auto max-h-[300px] custom-scrollbar space-y-0.5 select-text leading-tight">
        {lines.map((line, idx) => {
          let lineClass = 'text-slate-400';
          if (line.startsWith('+') && !line.startsWith('+++')) {
            lineClass = 'bg-emerald-950/20 text-emerald-400 border-l border-emerald-500/30 pl-1';
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            lineClass = 'bg-red-950/20 text-red-400 border-l border-red-500/30 pl-1';
          } else if (line.startsWith('@@')) {
            lineClass = 'text-purple-400 font-bold opacity-75';
          }
          return (
            <div key={idx} className={lineClass}>
              {line}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        {/* CRT Scanline Scanline Effects */}
        <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.3)_50%)] bg-[length:100%_4px] opacity-25 mix-blend-overlay" />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-[700px] bg-slate-950 border-2 border-purple-500/60 p-6 rounded relative z-10 shadow-[0_0_50px_rgba(168,85,247,0.3)] flex flex-col gap-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
            <div className="flex items-center gap-3 text-purple-400">
              <ShieldAlert className="animate-pulse" size={24} />
              <div>
                <GlitchText text="Operator Authorization Required" className="font-orbitron font-black text-sm tracking-widest uppercase text-white" intensity="medium" />
                <span className="text-[8px] text-slate-500 uppercase tracking-widest font-black">Zero-Trust Realtime Governor</span>
              </div>
            </div>
            <span className="text-[9px] bg-purple-950/30 border border-purple-500/30 text-purple-400 px-2 py-0.5 rounded uppercase font-black tracking-wider">
              {current.type.replace(/_/g, ' ')}
            </span>
          </div>

          {error && (
            <div className="bg-red-950/80 border border-red-500 text-red-200 p-3 rounded text-[10px] flex items-start gap-2 italic">
              <AlertTriangle className="shrink-0 text-red-500 mt-0.5" size={12} />
              <span>{error}</span>
            </div>
          )}

          {/* Telemetry Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-black/40 border border-slate-900 p-3 rounded">
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] text-slate-500 font-bold uppercase">Variant Hash</span>
              <span className="text-[10px] text-white font-mono uppercase truncate">{variant_hash.substring(0, 12)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] text-slate-500 font-bold uppercase">Creativity</span>
              <span className="text-[10px] text-cyan-400 font-bold">{(creativity * 100).toFixed(0)}%</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] text-slate-500 font-bold uppercase">Stability Impact</span>
              <span className="text-[10px] text-amber-500 font-bold">{(stability_impact * 100).toFixed(0)}%</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] text-slate-500 font-bold uppercase">Governor Status</span>
              <span className={`text-[10px] font-bold ${governor_ok ? 'text-emerald-400' : 'text-red-500 animate-pulse'}`}>
                {governor_ok ? 'PASSED' : 'FAILED'}
              </span>
            </div>
          </div>

          {/* Diff View */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
              <Code size={12} />
              <span>Proposed Self-Modification Diff</span>
            </div>
            {renderDiff()}
          </div>

          {/* Warning Message */}
          <div className="p-3 bg-purple-950/10 border border-purple-500/20 rounded text-[9px] text-purple-300 leading-normal">
            **Notice**: Confirming this reality patch will overwrite the active segment execution parameters on the live clock cycle. Ensure AST filters are preserved and compilation metrics fall within stable performance limits.
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => handleResolve('reject')}
              disabled={resolving}
              className="flex-1 py-2.5 bg-red-950/20 border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-black text-[10px] font-orbitron font-black uppercase tracking-wider rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <X size={14} />
              Purge Code Variant
            </button>
            <button
              onClick={() => handleResolve('approve')}
              disabled={resolving || !governor_ok}
              className="flex-1 py-2.5 bg-emerald-950/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500 hover:text-black text-[10px] font-orbitron font-black uppercase tracking-wider rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={14} />
              Authorize Reality Override
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
