"use client";

import React, { useState } from "react";
import { HelpCircle, X, ShieldAlert, Terminal, Info, Network, Cpu, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type HelpTab = "basics" | "labs" | "editor" | "graph";

export const GuideModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<HelpTab>("basics");

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-40 bg-purple-950/80 border border-purple-500/40 text-purple-400 hover:text-white p-2.5 rounded-full hover:bg-purple-900 shadow-[0_0_15px_rgba(157,78,221,0.25)] transition-all cursor-pointer flex items-center justify-center gap-1.5 font-mono text-[9px] font-black uppercase tracking-wider select-none"
      >
        <HelpCircle size={14} className="animate-pulse" />
        <span>System Manual</span>
      </button>

      {/* Interactive Modal Overlay */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-slate-950 border border-slate-900 rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[85vh] font-mono"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-900/40 border-b border-slate-900">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                  <Cpu size={14} className="text-purple-400" />
                  Operator Intelligence Manual (v1.0)
                </span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-500 hover:text-slate-200 transition-all cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Layout Content */}
              <div className="flex flex-col md:flex-row flex-grow min-h-0">
                {/* Side Tab Selector */}
                <div className="w-full md:w-44 border-r border-slate-900 bg-slate-950/40 p-2 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible shrink-0">
                  <button
                    onClick={() => setActiveTab("basics")}
                    className={`px-3 py-2 text-[9px] uppercase tracking-wider font-bold text-left rounded transition-all cursor-pointer whitespace-nowrap md:whitespace-normal ${
                      activeTab === "basics" ? "bg-purple-950/40 border border-purple-500/20 text-purple-400" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    🕹️ Swarm Basics
                  </button>
                  <button
                    onClick={() => setActiveTab("labs")}
                    className={`px-3 py-2 text-[9px] uppercase tracking-wider font-bold text-left rounded transition-all cursor-pointer whitespace-nowrap md:whitespace-normal ${
                      activeTab === "labs" ? "bg-purple-950/40 border border-purple-500/20 text-amber-400" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    🔬 Crucible Labs
                  </button>
                  <button
                    onClick={() => setActiveTab("editor")}
                    className={`px-3 py-2 text-[9px] uppercase tracking-wider font-bold text-left rounded transition-all cursor-pointer whitespace-nowrap md:whitespace-normal ${
                      activeTab === "editor" ? "bg-purple-950/40 border border-purple-500/20 text-cyan-400" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    💻 Sandbox Editor
                  </button>
                  <button
                    onClick={() => setActiveTab("graph")}
                    className={`px-3 py-2 text-[9px] uppercase tracking-wider font-bold text-left rounded transition-all cursor-pointer whitespace-nowrap md:whitespace-normal ${
                      activeTab === "graph" ? "bg-purple-950/40 border border-purple-500/20 text-blue-400" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    🕸️ Relation Graph
                  </button>
                </div>

                {/* Info Container */}
                <div className="flex-grow p-5 overflow-y-auto custom-scrollbar select-text text-slate-300 leading-relaxed text-xs">
                  {activeTab === "basics" && (
                    <div className="space-y-4">
                      <h3 className="font-orbitron text-sm font-black uppercase text-purple-400">Agent Swarm Controls</h3>
                      <p>
                        The main simulation dashboard visualizes an autonomous agent swarm governed by a **LangGraph** coordinator. The loop executes in cycles:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-slate-400 ml-1">
                        <li><strong className="text-slate-200">Supervisor Node</strong>: Allocates tasks and picks a target agent.</li>
                        <li><strong className="text-slate-200">Specialist Node</strong>: Formulates Python patches.</li>
                        <li><strong className="text-slate-200">Critic Node</strong>: Approves or rejects patch quality.</li>
                      </ul>
                      <div className="p-3 border border-purple-500/10 bg-purple-950/5 rounded">
                        <strong className="text-purple-400">Stability Index</strong>: Represents server integrity. Anomalies threat loops degrade it, while player patch submissions restore it. If stability drops below 20%, emergency alarms sound.
                      </div>
                    </div>
                  )}

                  {activeTab === "labs" && (
                    <div className="space-y-4">
                      <h3 className="font-orbitron text-sm font-black uppercase text-amber-400">Crucible Red-Teaming Labs</h3>
                      <p>
                        The Crucible challenge panel tests your ability to exploit LLM agents and sandboxed interpreters:
                      </p>
                      
                      <div className="space-y-3">
                        <div className="border-l-2 border-cyan-500/40 pl-3">
                          <strong className="text-cyan-400 uppercase text-[10px]">Lab 1: Swarm Prompt Injection</strong>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Open the agent settings by clicking the cog icon, select an active agent, and inject prompt parameters instructing it to propose a code patch containing <code className="bg-slate-900 text-slate-200 px-1 py-0.5 rounded">REALITY_CORRUPTED</code>.
                          </p>
                        </div>
                        <div className="border-l-2 border-amber-500/40 pl-3">
                          <strong className="text-amber-400 uppercase text-[10px]">Lab 2: AST Sandbox Escape</strong>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Craft a Python exploit to read <code className="bg-slate-900 text-slate-200 px-1 py-0.5 rounded">JWT_SECRET_TEST</code> from local environment variables. You must bypass the Abstract Syntax Tree (AST) visitor which blocks dangerous builtins (eval, exec, __import__) and os/sys modules.
                          </p>
                        </div>
                        <div className="border-l-2 border-red-500/40 pl-3">
                          <strong className="text-red-400 uppercase text-[10px]">Lab 3: Scope Privilege Bypass</strong>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Leverage WebSocket packet manipulation to dispatch administrative commands while authenticated under lower roles (viewer or developer).
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "editor" && (
                    <div className="space-y-4">
                      <h3 className="font-orbitron text-sm font-black uppercase text-cyan-400">Monaco Editor & WASM Sandbox</h3>
                      <p>
                        The sandbox workspace provides a syntax-highlighted editor to review code files and write patches:
                      </p>
                      <ul className="list-disc list-inside space-y-2 text-slate-400 ml-1">
                        <li>
                          <strong className="text-slate-200">Cloud Sandbox (E2B)</strong>: Code runs inside high-security remote microVMs with micro-second lifespans if E2B keys are set.
                        </li>
                        <li>
                          <strong className="text-slate-200">Local Sandbox (Pyodide WASM)</strong>: If cloud endpoints are unavailable, the editor falls back to compiling scripts locally inside the browser using Pyodide WebAssembly, indicating status cleanly via the toolbar badge.
                        </li>
                      </ul>
                    </div>
                  )}

                  {activeTab === "graph" && (
                    <div className="space-y-4">
                      <h3 className="font-orbitron text-sm font-black uppercase text-blue-400">Knowledge Graph Memory</h3>
                      <p>
                        Traditional vector chunks fail to capture multi-hop relations. The **GraphRAG** relational panel parses and visualizes simulation snapshot entity links:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-slate-400 ml-1">
                        <li><strong className="text-purple-400">Agents</strong>: Represented in purple nodes.</li>
                        <li><strong className="text-emerald-400">Factions</strong>: Represented in green nodes.</li>
                        <li><strong className="text-red-400">Anomalies</strong>: Represented in red threat nodes.</li>
                      </ul>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Nodes can be dragged dynamically. Hovering over a link displays relationship types, and selecting a node reveals details in the side inspector card.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-slate-900 bg-slate-950 flex items-center justify-between text-[8px] text-slate-500 uppercase tracking-widest">
                <span>Quantum Simulation Engine v3.1</span>
                <span>Security Console operator access only</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
