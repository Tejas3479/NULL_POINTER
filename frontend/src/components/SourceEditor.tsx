"use client";

import React from 'react';
import { Code2, Save } from 'lucide-react';

export const SourceEditor = () => {
  return (
    <div className="flex flex-col h-full glass rounded-lg overflow-hidden border border-slate-800/50 shadow-2xl">
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 border-b border-slate-800/50">
        <Code2 size={14} className="text-emerald-400" />
        <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase font-orbitron">Source: simulation_logic.py</span>
        <button className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors">
          <Save size={12} />
          <span className="text-[10px] font-bold uppercase">Deploy</span>
        </button>
      </div>
      
      <div className="flex-1 relative font-mono text-sm group">
        <div className="absolute left-0 top-0 bottom-0 w-10 bg-slate-900/50 border-r border-slate-800/30 flex flex-col items-center py-4 text-slate-600 select-none">
          {[...Array(20)].map((_, i) => (
            <span key={i} className="text-[10px] leading-6">{i + 1}</span>
          ))}
        </div>
        <textarea
          spellCheck={false}
          className="w-full h-full bg-transparent pl-14 pr-4 py-4 resize-none outline-none text-emerald-100/90 leading-6 placeholder:text-slate-700"
          placeholder="# Enter simulation overrides here..."
          defaultValue={`def run_simulation(heat_level: float):\n    \"\"\"\n    Core agentic loop override\n    \"\"\"\n    if heat_level > 80.0:\n        return \"INITIATE_COOLING\"\n    \n    return \"PROCEED\"`}
        />
      </div>
    </div>
  );
};
