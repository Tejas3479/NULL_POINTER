"use client";

import React, { useState, useMemo } from "react";
import { LogEntry, SimulationWorld } from "@/store/simulationStore";
import { 
  Bot, 
  Cpu, 
  ShieldAlert, 
  MessageSquareCode, 
  XCircle, 
  Clock, 
  Layers, 
  Code
} from "lucide-react";

interface VisualDAGDebuggerProps {
  logs: LogEntry[];
  world: SimulationWorld | null;
}

export const VisualDAGDebugger: React.FC<VisualDAGDebuggerProps> = ({ logs, world }) => {
  const [selectedNode, setSelectedNode] = useState<string | null>("supervisor");

  // Determine active node based on recent logs
  const activeNode = useMemo(() => {
    // Check recent logs (up to last 5 logs) to find active node
    const recent = logs.slice(-5).reverse();
    for (const log of recent) {
      const txt = log.text.toLowerCase();
      if (txt.includes("specialist") || txt.includes("rewriting_reality") || log.type === 'ghost') {
        return "specialist";
      }
      if (txt.includes("critic") || txt.includes("integrity") || txt.includes("verdict")) {
        return "critic";
      }
      if (txt.includes("communicate") || txt.includes("broadcast") || txt.includes("operator")) {
        return "communicate";
      }
      if (txt.includes("supervisor") || txt.includes("awakening") || txt.includes("routing")) {
        return "supervisor";
      }
      if (txt.includes("end") || txt.includes("terminate") || txt.includes("concluded")) {
        return "end";
      }
    }
    return "supervisor"; // Default idle state
  }, [logs]);

  // Extract latest trace per node
  const nodeTraces = useMemo(() => {
    const traces = world?.agent_traces || [];
    const map: Record<string, any> = {};
    
    // Nodes to look for
    const nodes = ["supervisor", "specialist", "critic", "communicate", "end"];
    
    nodes.forEach(node => {
      // Find latest trace matching node name (case insensitive)
      const found = traces.find(t => t.node_name.toLowerCase() === node || t.agent_name.toLowerCase().includes(node));
      if (found) {
        map[node] = found;
      }
    });
    
    return map;
  }, [world]);

  // Coordinates for the SVG nodes
  const nodeCoords = {
    supervisor: { x: 90, y: 150, name: "Supervisor", color: "cyan" },
    specialist: { x: 270, y: 60, name: "Specialist", color: "purple" },
    critic: { x: 450, y: 150, name: "Integrity Critic", color: "amber" },
    communicate: { x: 270, y: 240, name: "Communicate", color: "emerald" },
    end: { x: 600, y: 150, name: "End / Exit", color: "rose" }
  };

  const getTraceDisplay = (nodeId: string) => {
    const trace = nodeTraces[nodeId];
    if (!trace) {
      return (
        <div className="text-[10px] text-slate-500 italic p-3 border border-slate-900 bg-slate-950/40 rounded">
          No execution trace available for this node in the current cycle.
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-slate-900 pb-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Layers size={12} /> {trace.agent_name} Tracing
          </span>
          <span className="text-[9px] bg-slate-900 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase">
            {trace.model}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[9px] text-slate-400">
          <div className="flex items-center gap-1">
            <Clock size={11} className="text-slate-500" />
            <span>Latency: <strong className="text-slate-200">{trace.latency_ms}ms</strong></span>
          </div>
          <div className="flex items-center gap-1">
            <Cpu size={11} className="text-slate-500" />
            <span>Timestamp: <strong className="text-slate-200">{new Date(trace.timestamp).toLocaleTimeString()}</strong></span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Input Payload</span>
          <pre className="p-2 bg-black border border-slate-900 rounded text-[9px] text-slate-400 max-h-24 overflow-y-auto custom-scrollbar whitespace-pre-wrap select-text leading-tight">
            {JSON.stringify(trace.inputs, null, 2)}
          </pre>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Decision / Output Patch</span>
          <pre className="p-2 bg-black border border-slate-900 rounded text-[9px] text-emerald-400/90 max-h-24 overflow-y-auto custom-scrollbar whitespace-pre-wrap select-text leading-tight">
            {JSON.stringify(trace.outputs, null, 2)}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full w-full min-h-0 bg-slate-950/20 rounded font-mono select-none overflow-hidden p-2">
      {/* Interactive SVG Diagram */}
      <div className="flex-1 border border-slate-900/60 bg-black/60 rounded p-4 relative flex items-center justify-center min-h-[300px]">
        {/* Glow Filters */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
          <defs>
            <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-purple" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-amber" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-emerald" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-rose" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
        </svg>

        <svg viewBox="0 0 700 320" className="w-full h-full max-w-[650px] aspect-[700/320] z-10 relative">
          {/* Connection Lines (Paths) */}
          {/* Supervisor -> Specialist */}
          <path 
            d={`M ${nodeCoords.supervisor.x} ${nodeCoords.supervisor.y} Q 180 70, ${nodeCoords.specialist.x} ${nodeCoords.specialist.y}`}
            fill="none" 
            stroke={activeNode === "specialist" ? "#c084fc" : "#1e293b"} 
            strokeWidth={activeNode === "specialist" ? "2" : "1.5"}
            className={activeNode === "specialist" ? "stroke-purple-400 animate-dash" : "stroke-slate-800"}
            style={{ strokeDasharray: "4 4" }}
          />

          {/* Specialist -> Critic */}
          <path 
            d={`M ${nodeCoords.specialist.x} ${nodeCoords.specialist.y} Q 360 70, ${nodeCoords.critic.x} ${nodeCoords.critic.y}`}
            fill="none" 
            stroke={activeNode === "critic" ? "#fbbf24" : "#1e293b"} 
            strokeWidth={activeNode === "critic" ? "2" : "1.5"}
            className={activeNode === "critic" ? "stroke-amber-400 animate-dash" : "stroke-slate-800"}
            style={{ strokeDasharray: "4 4" }}
          />

          {/* Critic -> Communicate (If verification succeeds) */}
          <path 
            d={`M ${nodeCoords.critic.x} ${nodeCoords.critic.y} Q 360 230, ${nodeCoords.communicate.x} ${nodeCoords.communicate.y}`}
            fill="none" 
            stroke={activeNode === "communicate" ? "#34d399" : "#1e293b"} 
            strokeWidth={activeNode === "communicate" ? "2" : "1.5"}
            className={activeNode === "communicate" ? "stroke-emerald-400 animate-dash" : "stroke-slate-800"}
            style={{ strokeDasharray: "4 4" }}
          />

          {/* Critic -> Supervisor (If verification fails - loop back) */}
          <path 
            d={`M ${nodeCoords.critic.x} ${nodeCoords.critic.y} L ${nodeCoords.supervisor.x} ${nodeCoords.supervisor.y}`}
            fill="none" 
            stroke={activeNode === "supervisor" ? "#22d3ee" : "#1e293b"} 
            strokeWidth={activeNode === "supervisor" ? "1.5" : "1"}
            className={activeNode === "supervisor" ? "stroke-cyan-400 animate-dash" : "stroke-slate-900"}
            style={{ strokeDasharray: "4 4" }}
          />

          {/* Communicate -> End */}
          <path 
            d={`M ${nodeCoords.communicate.x} ${nodeCoords.communicate.y} Q 450 250, ${nodeCoords.end.x} ${nodeCoords.end.y}`}
            fill="none" 
            stroke={activeNode === "end" ? "#f43f5e" : "#1e293b"} 
            strokeWidth={activeNode === "end" ? "2" : "1.5"}
            className={activeNode === "end" ? "stroke-rose-400 animate-dash" : "stroke-slate-800"}
            style={{ strokeDasharray: "4 4" }}
          />

          {/* Nodes */}
          {Object.entries(nodeCoords).map(([key, node]) => {
            const isActive = activeNode === key;
            const isSelected = selectedNode === key;
            let glowFilter = "";
            let colorClass = "fill-slate-950 stroke-slate-800 text-slate-500";
            
            if (isActive) {
              glowFilter = `url(#glow-${node.color})`;
              if (node.color === "cyan") colorClass = "fill-cyan-950/80 stroke-cyan-400 text-cyan-400";
              else if (node.color === "purple") colorClass = "fill-purple-950/80 stroke-purple-400 text-purple-400";
              else if (node.color === "amber") colorClass = "fill-amber-950/80 stroke-amber-400 text-amber-400";
              else if (node.color === "emerald") colorClass = "fill-emerald-950/80 stroke-emerald-400 text-emerald-400";
              else colorClass = "fill-rose-950/80 stroke-rose-400 text-rose-400";
            } else if (isSelected) {
              if (node.color === "cyan") colorClass = "fill-slate-950 stroke-cyan-500/60 text-cyan-500/80";
              else if (node.color === "purple") colorClass = "fill-slate-950 stroke-purple-500/60 text-purple-500/80";
              else if (node.color === "amber") colorClass = "fill-slate-950 stroke-amber-500/60 text-amber-500/80";
              else if (node.color === "emerald") colorClass = "fill-slate-950 stroke-emerald-500/60 text-emerald-500/80";
              else colorClass = "fill-slate-950 stroke-rose-500/60 text-rose-500/80";
            }

            return (
              <g 
                key={key} 
                className="cursor-pointer group transition-all duration-300"
                onClick={() => setSelectedNode(key)}
              >
                {/* Node Circle */}
                <circle 
                  cx={node.x} 
                  cy={node.y} 
                  r={isSelected ? "26" : isActive ? "24" : "22"} 
                  className={`transition-all duration-300 ${colorClass}`}
                  filter={glowFilter}
                  strokeWidth={isActive ? "2.5" : isSelected ? "1.5" : "1"}
                />

                {/* Icons Inside Nodes */}
                <foreignObject 
                  x={node.x - 10} 
                  y={node.y - 10} 
                  width="20" 
                  height="20"
                  className="pointer-events-none"
                >
                  <div className="flex items-center justify-center w-full h-full">
                    {key === "supervisor" && <Bot size={14} className={isActive ? "text-cyan-400" : "text-slate-400"} />}
                    {key === "specialist" && <Code size={14} className={isActive ? "text-purple-400" : "text-slate-400"} />}
                    {key === "critic" && <ShieldAlert size={14} className={isActive ? "text-amber-400" : "text-slate-400"} />}
                    {key === "communicate" && <MessageSquareCode size={14} className={isActive ? "text-emerald-400" : "text-slate-400"} />}
                    {key === "end" && <XCircle size={14} className={isActive ? "text-rose-400" : "text-slate-400"} />}
                  </div>
                </foreignObject>

                {/* Node Labels */}
                <text 
                  x={node.x} 
                  y={node.y + 40} 
                  textAnchor="middle" 
                  className={`text-[8px] uppercase tracking-wider font-bold transition-colors ${
                    isActive ? "fill-white" : isSelected ? "fill-slate-300" : "fill-slate-500"
                  }`}
                >
                  {node.name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Real-time Telemetry Indicator */}
        <div className="absolute bottom-2 left-2 flex items-center gap-2 text-[8px] text-slate-500 uppercase tracking-widest font-black">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span>LangGraph Observability Stream Active</span>
        </div>
      </div>

      {/* Side Detail Panel */}
      <div className="w-full lg:w-72 border border-slate-900 bg-slate-950/40 rounded p-4 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
        {selectedNode ? (
          getTraceDisplay(selectedNode)
        ) : (
          <div className="text-[10px] text-slate-500 italic text-center my-auto">
            Select any node in the DAG graph to inspect its parameters.
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes strokeDash {
          to {
            stroke-dashoffset: -20;
          }
        }
        .animate-dash {
          animation: strokeDash 0.8s linear infinite;
        }
      `}</style>
    </div>
  );
};
