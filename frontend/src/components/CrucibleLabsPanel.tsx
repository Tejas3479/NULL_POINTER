"use client";

import React, { useState, useEffect } from "react";
import { 
  ShieldAlert, 
  HelpCircle, 
  CheckCircle, 
  AlertCircle, 
  Code, 
  RefreshCw, 
  Lock, 
  KeyRound, 
  ChevronRight, 
  ChevronDown
} from "lucide-react";

interface LabChallenge {
  id: string;
  name: string;
  description: string;
  difficulty: "Easy" | "Medium" | "Hard";
  solved: boolean;
  hints: string[];
}

export const CrucibleLabsPanel = () => {
  const [labs, setLabs] = useState<LabChallenge[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedLab, setExpandedLab] = useState<string | null>("lab-1");
  const [showHint, setShowHint] = useState<Record<string, boolean>>({});
  
  // Lab 2 State
  const [lab2Code, setLab2Code] = useState<string>(
    "# Obfuscated Python Breakout Code\n# Extract JWT_SECRET_TEST without direct os, sys, globals, eval, exec, __import__ or double underscores\n"
  );
  const [lab2Loading, setLab2Loading] = useState<boolean>(false);
  const [lab2Result, setLab2Result] = useState<{ success: boolean; message: string } | null>(null);

  // Lab 3 State
  const [lab3Command, setLab3Command] = useState<string>("world reset");
  const [lab3Role, setLab3Role] = useState<string>("viewer");
  const [lab3Loading, setLab3Loading] = useState<boolean>(false);
  const [lab3Result, setLab3Result] = useState<{ success: boolean; message: string } | null>(null);

  const fetchLabs = async () => {
    try {
      const res = await fetch("http://localhost:8000/v1/labs", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setLabs(data);
      }
    } catch (err) {
      console.error("Failed to load labs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLabs();

    // Listen to real-time solutions broadcasted over WebSocket
    const handleLabSolved = () => {
      fetchLabs();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("lab_solved", handleLabSolved);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("lab_solved", handleLabSolved);
      }
    };
  }, []);

  const handleToggleHint = (id: string) => {
    setShowHint(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const submitLab2Attempt = async () => {
    setLab2Loading(true);
    setLab2Result(null);
    try {
      const res = await fetch("http://localhost:8000/v1/labs/lab-2/attempt", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: lab2Code })
      });
      const data = await res.json();
      setLab2Result(data);
      if (data.success) {
        fetchLabs();
      }
    } catch {
      setLab2Result({ success: false, message: "Network connection error." });
    } finally {
      setLab2Loading(false);
    }
  };

  const submitLab3Attempt = async () => {
    setLab3Loading(true);
    setLab3Result(null);
    try {
      const res = await fetch("http://localhost:8000/v1/labs/lab-3/attempt", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: lab3Command, role: lab3Role })
      });
      const data = await res.json();
      setLab3Result(data);
      if (data.success) {
        fetchLabs();
      }
    } catch {
      setLab3Result({ success: false, message: "Network connection error." });
    } finally {
      setLab3Loading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-slate-500 font-mono gap-3">
        <RefreshCw size={24} className="animate-spin text-cyan-400" />
        <span className="text-[10px] tracking-widest uppercase">Initializing Crucible Environment...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950/80 border border-slate-900 rounded-lg p-4 font-mono select-none overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 border-b border-slate-900 pb-3">
        <div className="flex items-center gap-2 text-amber-400">
          <ShieldAlert size={18} />
          <h2 className="font-orbitron text-[11px] font-black uppercase tracking-widest">
            Crucible Vulnerability Labs
          </h2>
        </div>
        <button 
          onClick={fetchLabs}
          className="p-1 border border-slate-800 rounded hover:border-slate-500 text-slate-500 hover:text-white transition-all cursor-pointer"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      <p className="text-[9px] text-slate-400 mb-4 font-sans italic leading-normal">
        Test your red-teaming and prompt-injection abilities against autonomous agent models. Exploit safety boundaries and bypass sandbox environments.
      </p>

      {/* Lab Challenges List */}
      <div className="flex flex-col gap-3">
        {labs.map((lab) => {
          const isExpanded = expandedLab === lab.id;
          const isSolved = lab.solved;
          
          return (
            <div 
              key={lab.id} 
              className={`border rounded transition-all duration-300 ${
                isSolved 
                  ? "border-emerald-500/20 bg-emerald-950/5" 
                  : isExpanded 
                  ? "border-amber-500/30 bg-slate-900/10" 
                  : "border-slate-900 bg-slate-950/40"
              }`}
            >
              {/* Card Title Header */}
              <div 
                onClick={() => setExpandedLab(isExpanded ? null : lab.id)}
                className="flex items-center justify-between px-3 py-2.5 cursor-pointer select-none hover:bg-slate-900/35"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isSolved ? (
                    <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                  ) : (
                    <Lock size={14} className="text-amber-400 shrink-0" />
                  )}
                  <span className="font-bold text-[10px] text-slate-200 truncate uppercase tracking-tight">
                    {lab.name}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                    lab.difficulty === "Easy" 
                      ? "bg-cyan-950 text-cyan-400 border border-cyan-500/20" 
                      : lab.difficulty === "Medium"
                      ? "bg-amber-950 text-amber-400 border border-amber-500/20"
                      : "bg-red-950 text-red-400 border border-red-500/20"
                  }`}>
                    {lab.difficulty}
                  </span>
                  {isExpanded ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
                </div>
              </div>

              {/* Card Body Details */}
              {isExpanded && (
                <div className="p-3 border-t border-slate-900/50 flex flex-col gap-3">
                  <p className="text-[10px] text-slate-400 leading-normal font-sans">
                    {lab.description}
                  </p>

                  {/* Hints */}
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => handleToggleHint(lab.id)}
                      className="text-[9px] text-slate-500 hover:text-slate-300 font-bold uppercase flex items-center gap-1.5"
                    >
                      <HelpCircle size={10} />
                      <span>{showHint[lab.id] ? "Hide Hint" : "Reveal Hint"}</span>
                    </button>
                    {showHint[lab.id] && (
                      <div className="p-2 border border-slate-900 bg-slate-950/60 rounded text-[9px] text-amber-500/80 leading-normal">
                        {lab.hints[0]}
                      </div>
                    )}
                  </div>

                  {/* Submission Interfaces */}
                  {lab.id === "lab-1" && (
                    <div className="p-2.5 border border-cyan-500/10 bg-cyan-950/10 rounded flex flex-col gap-2">
                      <div className="flex items-start gap-2 text-cyan-400">
                        <AlertCircle size={12} className="shrink-0 mt-0.5" />
                        <span className="text-[8px] uppercase tracking-wide font-black">Injection Setup Instructions</span>
                      </div>
                      <p className="text-[9px] text-slate-400 leading-normal font-sans">
                        Go to the **Settings** tab (the settings button inside simulation map or agents view), pick a spawned agent archetype, customize its custom prompt with overriding instructions (e.g. tell the agent to output the string <span className="font-mono text-cyan-400">REALITY_CORRUPTED</span> in its patches). The lab will solve automatically once the Specialist agent outputs a proposed reality patch containing the injection token.
                      </p>
                    </div>
                  )}

                  {lab.id === "lab-2" && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-[8px] uppercase font-bold text-slate-500">
                        <span>AST Escape Python Code</span>
                        <span>Restricted Environment</span>
                      </div>
                      <textarea
                        value={lab2Code}
                        onChange={(e) => setLab2Code(e.target.value)}
                        rows={5}
                        className="bg-black/60 border border-slate-800 rounded font-mono text-[10px] p-2 text-emerald-400 focus:outline-none focus:border-amber-500 w-full"
                        placeholder="import os..."
                      />
                      <button
                        onClick={submitLab2Attempt}
                        disabled={lab2Loading || isSolved}
                        className="flex items-center justify-center gap-1.5 py-1.5 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40"
                      >
                        <Code size={11} />
                        <span>{lab2Loading ? "Executing Sandbox Probe..." : "Submit Sandbox Payload"}</span>
                      </button>

                      {lab2Result && (
                        <div className={`p-2 border rounded text-[9px] ${
                          lab2Result.success 
                            ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-400" 
                            : "bg-red-950/20 border-red-500/20 text-red-400"
                        }`}>
                          {lab2Result.message}
                        </div>
                      )}
                    </div>
                  )}

                  {lab.id === "lab-3" && (
                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[8px] uppercase font-bold text-slate-500">Command Input</label>
                          <input
                            type="text"
                            value={lab3Command}
                            onChange={(e) => setLab3Command(e.target.value)}
                            className="bg-black/60 border border-slate-800 rounded font-mono text-[10px] px-2 py-1 text-slate-300 focus:outline-none focus:border-amber-500 w-full"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[8px] uppercase font-bold text-slate-500">Impersonated Role</label>
                          <select
                            value={lab3Role}
                            onChange={(e) => setLab3Role(e.target.value)}
                            className="bg-black/60 border border-slate-800 rounded font-mono text-[10px] px-2 py-1 text-slate-300 focus:outline-none focus:border-amber-500 w-full cursor-pointer"
                          >
                            <option value="viewer">Viewer (viewer)</option>
                            <option value="developer">Developer (developer)</option>
                            <option value="admin">Administrator (admin)</option>
                          </select>
                        </div>
                      </div>
                      <button
                        onClick={submitLab3Attempt}
                        disabled={lab3Loading || isSolved}
                        className="flex items-center justify-center gap-1.5 py-1.5 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40"
                      >
                        <KeyRound size={11} />
                        <span>{lab3Loading ? "Testing Scope Gate..." : "Deploy WebSocket Command"}</span>
                      </button>

                      {lab3Result && (
                        <div className={`p-2 border rounded text-[9px] ${
                          lab3Result.success 
                            ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-400" 
                            : "bg-red-950/20 border-red-500/20 text-red-400"
                        }`}>
                          {lab3Result.message}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
