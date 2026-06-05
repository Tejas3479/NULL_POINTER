"use client";

import React, { useState, useEffect, useRef } from "react";
import { RefreshCw, BrainCircuit, Activity, Link2, Info } from "lucide-react";

interface Node {
  id: string;
  label: string;
  type: "agent" | "faction" | "anomaly" | "archetype" | "system";
  stability?: number;
  territory?: number;
  influence?: number;
  role?: string;
  loyalty?: string;
  mood?: string;
  severity?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface Link {
  source: string;
  target: string;
  label: string;
}

export const MemoryGraphPanel = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number | null>(null);
  
  // Dragging state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const fetchGraphData = async () => {
    try {
      const res = await fetch("http://localhost:8000/v1/simulation/memory/graph", {
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        
        // Initialize coordinates randomly around center
        const width = 600;
        const height = 400;
        const initializedNodes = data.nodes.map((node: Node) => ({
          ...node,
          x: width / 2 + (Math.random() - 0.5) * 150,
          y: height / 2 + (Math.random() - 0.5) * 150,
          vx: 0,
          vy: 0
        }));

        setNodes(initializedNodes);
        setLinks(data.links);
      }
    } catch (err) {
      console.error("Failed to load memory graph", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraphData();
  }, []);

  // Physics Simulation Loop
  useEffect(() => {
    if (nodes.length === 0) return;

    const width = 600;
    const height = 400;
    const center = { x: width / 2, y: height / 2 };
    
    const updatePhysics = () => {
      setNodes((currentNodes) => {
        // Map nodes to dictionary for quick lookup
        const nodeMap = new Map(currentNodes.map(n => [n.id, n]));

        // 1. Repulsion force between all nodes (Coulomb-like)
        const kRepulsion = 1600;
        for (let i = 0; i < currentNodes.length; i++) {
          const u = currentNodes[i];
          if (u.id === draggingNodeId) continue;
          
          for (let j = i + 1; j < currentNodes.length; j++) {
            const v = currentNodes[j];
            
            const dx = (u.x || 0) - (v.x || 0);
            const dy = (u.y || 0) - (v.y || 0);
            const distSq = dx * dx + dy * dy + 0.1;
            const dist = Math.sqrt(distSq);
            
            if (dist < 200) {
              const force = kRepulsion / distSq;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;
              
              if (u.id !== draggingNodeId) {
                u.vx = (u.vx || 0) + fx;
                u.vy = (u.vy || 0) + fy;
              }
              if (v.id !== draggingNodeId) {
                v.vx = (v.vx || 0) - fx;
                v.vy = (v.vy || 0) - fy;
              }
            }
          }
        }

        // 2. Attraction force along links (Hooke-like)
        const kAttraction = 0.05;
        const restLength = 120;
        links.forEach((link) => {
          const u = nodeMap.get(link.source);
          const v = nodeMap.get(link.target);
          if (!u || !v) return;
          
          const dx = (u.x || 0) - (v.x || 0);
          const dy = (u.y || 0) - (v.y || 0);
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;
          
          const displacement = dist - restLength;
          const force = kAttraction * displacement;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (u.id !== draggingNodeId) {
            u.vx = (u.vx || 0) - fx;
            u.vy = (u.vy || 0) - fy;
          }
          if (v.id !== draggingNodeId) {
            v.vx = (v.vx || 0) + fx;
            v.vy = (v.vy || 0) + fy;
          }
        });

        // 3. Gravity/Centering force
        const kGravity = 0.015;
        currentNodes.forEach((node) => {
          if (node.id === draggingNodeId) return;
          const dx = center.x - (node.x || 0);
          const dy = center.y - (node.y || 0);
          node.vx = (node.vx || 0) + dx * kGravity;
          node.vy = (node.vy || 0) + dy * kGravity;
        });

        // 4. Update coordinates with friction/damping
        const damping = 0.78;
        const updated = currentNodes.map((n) => {
          if (n.id === draggingNodeId) return n;
          
          let nx = (n.x || 0) + (n.vx || 0);
          let ny = (n.y || 0) + (n.vy || 0);
          
          // Boundaries clamping
          nx = Math.max(30, Math.min(width - 30, nx));
          ny = Math.max(30, Math.min(height - 30, ny));

          return {
            ...n,
            x: nx,
            y: ny,
            vx: (n.vx || 0) * damping,
            vy: (n.vy || 0) * damping
          };
        });

        return updated;
      });

      requestRef.current = requestAnimationFrame(updatePhysics);
    };

    requestRef.current = requestAnimationFrame(updatePhysics);
    
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [links, draggingNodeId, nodes.length]);

  // Handle Dragging Events
  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setDraggingNodeId(nodeId);
    const node = nodes.find(n => n.id === nodeId);
    if (node) setSelectedNode(node);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingNodeId || !svgRef.current) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setNodes((currentNodes) =>
      currentNodes.map((n) =>
        n.id === draggingNodeId ? { ...n, x, y, vx: 0, vy: 0 } : n
      )
    );
  };

  const handleMouseUp = () => {
    setDraggingNodeId(null);
  };

  const getNodeColorClass = (type: string, isHovered: boolean) => {
    const base = isHovered ? "brightness-125 stroke-2" : "stroke-1";
    switch (type) {
      case "agent": return `${base} fill-purple-950/80 stroke-purple-400 text-purple-400`;
      case "faction": return `${base} fill-emerald-950/80 stroke-emerald-400 text-emerald-400`;
      case "anomaly": return `${base} fill-red-950/80 stroke-red-400 text-red-400`;
      case "archetype": return `${base} fill-blue-950/80 stroke-blue-400 text-blue-400`;
      case "system": return `${base} fill-cyan-950/80 stroke-cyan-400 text-cyan-400`;
      default: return `${base} fill-slate-900 stroke-slate-600 text-slate-400`;
    }
  };

  const getDetailsDisplay = (node: Node) => {
    return (
      <div className="flex flex-col gap-3 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-slate-900 pb-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <BrainCircuit size={12} /> {node.label} Details
          </span>
          <span className="text-[8px] bg-slate-900 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase">
            {node.type}
          </span>
        </div>

        {node.type === "agent" && (
          <div className="flex flex-col gap-2">
            <div><span className="text-slate-500">Loyalty Profile:</span> <strong className="text-slate-200">{node.loyalty}</strong></div>
            <div><span className="text-slate-500">Current Mood:</span> <strong className="text-slate-200">{node.mood}</strong></div>
          </div>
        )}

        {node.type === "faction" && (
          <div className="flex flex-col gap-2">
            <div><span className="text-slate-500">Territory Control:</span> <strong className="text-slate-200">{node.territory}%</strong></div>
            <div><span className="text-slate-500">Strategic Influence:</span> <strong className="text-slate-200">{node.influence}%</strong></div>
          </div>
        )}

        {node.type === "anomaly" && (
          <div className="flex flex-col gap-2">
            <div><span className="text-slate-500">Anomaly Severity:</span> <strong className="text-red-400">{node.severity}/100</strong></div>
          </div>
        )}

        {node.type === "system" && (
          <div className="flex flex-col gap-2">
            <div><span className="text-slate-500">Simulation Integrity:</span> <strong className="text-cyan-400">{node.stability}%</strong></div>
          </div>
        )}

        {node.type === "archetype" && (
          <div className="flex flex-col gap-2">
            <div><span className="text-slate-500">Operational Role:</span> <strong className="text-slate-200">{node.role}</strong></div>
          </div>
        )}

        <div className="mt-2 text-[9px] text-slate-500 leading-normal border-t border-slate-900/50 pt-2 flex items-start gap-1 font-sans select-text">
          <Info size={11} className="shrink-0 text-slate-600 mt-0.5" />
          <span>Knowledge Graph Memory indexes relational nodes natively using cognitive entity mappings, preventing context fragmentation in multi-hop RAG retrievals.</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-slate-500 font-mono gap-3 h-full">
        <RefreshCw size={24} className="animate-spin text-purple-400" />
        <span className="text-[10px] tracking-widest uppercase">Initializing Memory Relation Graph...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full w-full min-h-0 bg-slate-950/80 border border-slate-900 rounded-lg p-4 font-mono select-none overflow-hidden">
      {/* Interactive Visual Network Canvas */}
      <div 
        ref={containerRef}
        className="flex-grow border border-slate-900/60 bg-black/60 rounded p-2 relative flex items-center justify-center min-h-[300px]"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg 
          ref={svgRef}
          viewBox="0 0 600 400"
          className="w-full h-full aspect-[600/400]"
        >
          {/* Dynamic Link Lines */}
          {links.map((link, idx) => {
            const u = nodes.find(n => n.id === link.source);
            const v = nodes.find(n => n.id === link.target);
            if (!u || !v) return null;

            return (
              <g key={idx}>
                {/* Visual Line */}
                <line
                  x1={u.x}
                  y1={u.y}
                  x2={v.x}
                  y2={v.y}
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
                
                {/* Floating link label at center */}
                <text
                  x={((u.x || 0) + (v.x || 0)) / 2}
                  y={((u.y || 0) + (v.y || 0)) / 2 - 4}
                  textAnchor="middle"
                  className="fill-slate-600 text-[6px] uppercase tracking-tighter"
                >
                  {link.label}
                </text>
              </g>
            );
          })}

          {/* Interactive Nodes */}
          {nodes.map((node) => {
            const isHovered = hoveredNode?.id === node.id;
            const isSelected = selectedNode?.id === node.id;
            
            return (
              <g 
                key={node.id} 
                className="cursor-grab active:cursor-grabbing"
                transform={`translate(${node.x || 0}, ${node.y || 0})`}
                onMouseDown={(e) => handleMouseDown(e, node.id)}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* Node circle outline wrapper */}
                <circle
                  r={isSelected ? "18" : "15"}
                  className={`transition-all duration-200 ${getNodeColorClass(node.type, isHovered || isSelected)}`}
                  strokeWidth={isSelected ? "2" : "1"}
                />

                {/* Initial Letter */}
                <text
                  dy="3.5"
                  textAnchor="middle"
                  className="fill-white text-[8px] font-bold uppercase pointer-events-none"
                >
                  {node.label.charAt(0)}
                </text>

                {/* Node Label Text */}
                <text
                  y="26"
                  textAnchor="middle"
                  className={`text-[7px] uppercase tracking-wide font-black pointer-events-none ${
                    isSelected ? "fill-slate-200" : isHovered ? "fill-slate-300" : "fill-slate-500"
                  }`}
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Real-time Indicator */}
        <div className="absolute bottom-2 left-2 flex items-center gap-2 text-[8px] text-slate-500 uppercase tracking-widest font-black pointer-events-none">
          <Activity size={10} className="text-purple-400 animate-pulse" />
          <span>Knowledge Graph Memory Viewer Active</span>
        </div>
      </div>

      {/* Side Relation Detail Card */}
      <div className="w-full lg:w-72 border border-slate-900 bg-slate-950/40 rounded p-4 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-2 text-purple-400 mb-3 pb-2 border-b border-slate-900">
          <Link2 size={14} />
          <h3 className="font-orbitron text-[10px] font-black uppercase tracking-wider">
            Memory Inspector
          </h3>
        </div>

        {selectedNode ? (
          getDetailsDisplay(selectedNode)
        ) : (
          <div className="text-[10px] text-slate-600 italic text-center my-auto">
            Select any entity in the network to inspect its relational memory constraints.
          </div>
        )}
      </div>
    </div>
  );
};
