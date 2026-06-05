"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { 
  Terminal, 
  Code2, 
  Cpu, 
  Copy, 
  Check, 
  ArrowLeft,
  Info
} from 'lucide-react';

export default function SdkDocsPage() {
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedInit, setCopiedInit] = useState(false);
  const [copiedConnect, setCopiedConnect] = useState(false);

  // Initialize demo badge using loaded SDK
  useEffect(() => {
    // Dynamically load the SDK script to test it in the documentation!
    const script = document.createElement("script");
    script.src = "/nullpointer-sdk.js";
    script.async = true;
    script.onload = () => {
      const customWindow = window as unknown as { NP?: { init: (w: string, e: string) => void } };
      if (customWindow.NP) {
        customWindow.NP.init("local-null-pointer", "demo-sdk-badge");
      }
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleCopy = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scriptSnippet = `<script src="http://localhost:3000/nullpointer-sdk.js"></script>`;
  
  const initSnippet = `<div id="my-badge"></div>

<script>
  window.onload = function() {
    NP.init('local-null-pointer', 'my-badge');
  };
</script>`;

  const connectSnippet = `NP.connect('local-null-pointer', function(worldState) {
  console.log("Timeline stability:", worldState.stability);
  console.log("Active agents:", worldState.agents.length);
  console.log("Current tick:", worldState.tick);
});`;

  return (
    <main className="min-h-screen bg-black text-slate-100 font-mono relative overflow-hidden flex flex-col">
      <Script src="https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js" strategy="lazyOnload" />
      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-20 mix-blend-overlay" />
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#1e293b_1px,transparent_1px)] bg-[size:16px_16px]" />

      {/* Navigation Header */}
      <header className="px-6 py-4 bg-slate-950 border-b border-slate-900 flex justify-between items-center relative z-10 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <Link href="/sim/local-null-pointer" className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-500 rounded text-slate-400 hover:text-white transition-all">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="font-orbitron font-black text-md text-white tracking-widest uppercase">JavaScript SDK Reference</h1>
            <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">Timeline Integration Manual</p>
          </div>
        </div>

        <Link 
          href="/sim/local-null-pointer"
          className="px-3 py-1.5 bg-[#00FF41] hover:bg-[#00FF41]/85 border border-[#00FF41]/30 text-black rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer font-orbitron"
        >
          Active Swarm Console
        </Link>
      </header>

      {/* Content Area */}
      <div className="flex-grow p-6 overflow-y-auto relative z-10 custom-scrollbar select-none pb-16">
        <div className="max-w-[850px] mx-auto space-y-8">
          
          {/* Welcome Intro Card */}
          <div className="glass p-6 rounded border border-slate-800 bg-slate-950/40 space-y-4">
            <div className="flex items-center gap-2 text-purple-400">
              <Cpu size={18} />
              <h2 className="font-orbitron text-xs font-black uppercase tracking-wider">Overview</h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed font-sans font-medium">
              The NULL_POINTER SDK allows operators to integrate live simulation telemetry directly into external dashboards, wikis, or monitoring interfaces. The SDK fetches visually compiled vector badges and opens read-only WebSocket connections to stream metrics in real time.
            </p>
          </div>

          {/* Interactive Live Demonstration */}
          <div className="glass p-6 rounded border border-slate-800 bg-slate-950/40 space-y-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <Terminal size={18} />
              <h2 className="font-orbitron text-xs font-black uppercase tracking-wider">Live SDK Embed Demonstration</h2>
            </div>
            <p className="text-[10px] text-slate-500 uppercase font-bold leading-normal">
              Below is a live badge container initialized dynamically using the JavaScript SDK (`local-null-pointer`):
            </p>
            <div className="p-4 bg-[#03060c] border border-slate-900 rounded flex items-center justify-center min-h-[60px]">
              <div id="demo-sdk-badge" className="w-full max-w-[380px]" />
            </div>
          </div>

          {/* Installation Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-cyan-400">
              <Code2 size={18} />
              <h3 className="font-orbitron text-xs font-black uppercase tracking-wider">1. Load the script</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed font-sans font-medium">
              Add the global SDK script reference before closing your `&lt;/body&gt;` tag:
            </p>
            
            <div className="border border-slate-900 bg-black/60 rounded overflow-hidden relative group">
              <pre className="p-4 text-[10px] text-cyan-400 font-mono overflow-x-auto whitespace-pre">{scriptSnippet}</pre>
              <button
                onClick={() => handleCopy(scriptSnippet, setCopiedScript)}
                className="absolute right-3 top-3 p-1.5 bg-slate-950 border border-slate-900 hover:border-slate-700 text-slate-500 hover:text-white rounded cursor-pointer transition-all"
                title="Copy snippet"
              >
                {copiedScript ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </button>
            </div>
          </div>

          {/* Embed Badge API */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-cyan-400">
              <Code2 size={18} />
              <h3 className="font-orbitron text-xs font-black uppercase tracking-wider">2. Initialize Live Badge Widget</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed font-sans font-medium">
              Declare an empty container element and initialize it via the SDK using `NP.init(worldId, elementId)`. The SDK will fetch the SVG and subscribe to live WebSocket state sweeps:
            </p>
            
            <div className="border border-slate-900 bg-black/60 rounded overflow-hidden relative group">
              <pre className="p-4 text-[10px] text-purple-400 font-mono overflow-x-auto whitespace-pre">{initSnippet}</pre>
              <button
                onClick={() => handleCopy(initSnippet, setCopiedInit)}
                className="absolute right-3 top-3 p-1.5 bg-slate-950 border border-slate-900 hover:border-slate-700 text-slate-500 hover:text-white rounded cursor-pointer transition-all"
                title="Copy snippet"
              >
                {copiedInit ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </button>
            </div>
          </div>

          {/* Connect Telemetry API */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-cyan-400">
              <Code2 size={18} />
              <h3 className="font-orbitron text-xs font-black uppercase tracking-wider">3. Custom WebSockets Telemetry</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed font-sans font-medium">
              To build custom dashboards or trigger local page overrides on simulation ticks, hook into the read-only WebSocket stream directly using `NP.connect(worldId, callback)`:
            </p>
            
            <div className="border border-slate-900 bg-black/60 rounded overflow-hidden relative group">
              <pre className="p-4 text-[10px] text-amber-500 font-mono overflow-x-auto whitespace-pre">{connectSnippet}</pre>
              <button
                onClick={() => handleCopy(connectSnippet, setCopiedConnect)}
                className="absolute right-3 top-3 p-1.5 bg-slate-950 border border-slate-900 hover:border-slate-700 text-slate-500 hover:text-white rounded cursor-pointer transition-all"
                title="Copy snippet"
              >
                {copiedConnect ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </button>
            </div>
          </div>

          {/* Warning notice */}
          <div className="p-4 border border-amber-950 bg-amber-950/10 rounded flex gap-3 text-amber-500 font-sans select-text">
            <Info className="shrink-0 mt-0.5" size={16} />
            <div className="text-[10px] uppercase font-bold leading-normal">
              <p className="font-black">Network Permissions & CORS Notice</p>
              <p className="opacity-70 mt-1 font-medium lowercase font-mono tracking-tight">
                The WebSocket listener opens read-only sessions (`ws://127.0.0.1:8000/ws/spectate/*`). No authentication token is required, and requests are protected from remote configuration updates or command injections.
              </p>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
