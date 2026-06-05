"use client";

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { Activity, GitBranch, RadioTower, Sparkles, Crosshair, Lock } from 'lucide-react';
import { SimulationWorld } from '@/store/simulationStore';

const factionColors: Record<string, string> = {
  kernel: '#38bdf8',
  ghost: '#c084fc',
  operators: '#22c55e',
  parasite: '#f43f5e',
  awakening: '#fb7185',
};

interface AgentNodesProps {
  world: SimulationWorld;
}

function AgentNodes({ world }: AgentNodesProps) {
  const agents = useMemo(() => world.agents || [], [world.agents]);
  const timeRef = useRef<number>(0);
  const [rotation, setRotation] = useState<number>(0);

  useEffect(() => {
    let frameId: number;
    const animate = () => {
      timeRef.current += 0.008;
      setRotation(timeRef.current);
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <group>
      {agents.map((agent, index) => {
        // Render agents floating in slow orbits around the center
        const radius = 2.2 + index * 0.5;
        const speed = 0.4 + index * 0.08;
        const angle = rotation * speed + (index * Math.PI * 2) / Math.max(1, agents.length);
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = Math.sin(rotation * 1.5 + index) * 0.25;

        return (
          <group key={agent.id} position={[x, y, z]}>
            {/* Holographic pyramid/crystal node */}
            <mesh>
              <coneGeometry args={[0.09, 0.22, 4]} />
              <meshStandardMaterial 
                color="#c084fc" 
                emissive="#c084fc" 
                emissiveIntensity={1.8} 
                transparent 
                opacity={0.85} 
              />
            </mesh>
            <mesh position={[0, -0.05, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.09, 0.1, 4]} />
              <meshStandardMaterial 
                color="#c084fc" 
                emissive="#c084fc" 
                emissiveIntensity={1.8} 
                transparent 
                opacity={0.85} 
              />
            </mesh>
            <Text 
              position={[0, 0.22, 0]} 
              fontSize={0.11} 
              color="#d8b4fe" 
              anchorX="center"
              font="monospace"
            >
              {agent.name.replace('The ', '')}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

interface HotspotsProps {
  world: SimulationWorld;
  selectedAnomalyId: string | null;
  onAnomalyClick: (id: string) => void;
}

function Hotspots({ world, selectedAnomalyId, onAnomalyClick }: HotspotsProps) {
  const anomalies = useMemo(() => world.anomalies, [world.anomalies]);

  return (
    <group>
      {anomalies.map((anomaly) => {
        const color = factionColors[anomaly.faction] ?? '#facc15';
        const isSelected = selectedAnomalyId === anomaly.id;
        const baseScale = 0.15 + anomaly.severity / 180;
        const scale = isSelected ? baseScale * 1.35 : baseScale;

        return (
          <group key={anomaly.id} position={[anomaly.x, anomaly.y, anomaly.z]}>
            {/* Clickable Sphere */}
            <mesh 
              scale={scale}
              onClick={(e) => {
                e.stopPropagation();
                onAnomalyClick(anomaly.id);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'auto';
              }}
            >
              <sphereGeometry args={[1, 32, 32]} />
              <meshStandardMaterial 
                color={color} 
                emissive={color} 
                emissiveIntensity={isSelected ? 2.5 : 1.2} 
                transparent 
                opacity={isSelected ? 0.95 : 0.82} 
              />
            </mesh>

            {/* Glowing wireframe ring when selected */}
            {isSelected && (
              <mesh scale={scale * 1.35}>
                <sphereGeometry args={[1, 16, 16]} />
                <meshBasicMaterial color={color} wireframe transparent opacity={0.35} />
              </mesh>
            )}

            <Text 
              position={[0, scale + 0.3, 0]} 
              fontSize={0.16} 
              color={isSelected ? "#22c55e" : "#e5e7eb"} 
              anchorX="center"
            >
              {anomaly.name}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

export function SimulationWorldMap({
  world,
  userRole,
  onParameterChange,
  onSpawnAgent,
}: {
  world: SimulationWorld | null;
  userRole: string | null;
  onParameterChange: (key: string, value: number) => void;
  onSpawnAgent: (archetypeId: string) => void;
}) {
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(null);

  if (!world) {
    return (
      <div className="h-full min-h-[360px] border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-500">
        Synchronizing persistent world state...
      </div>
    );
  }

  const latestLore = world.lore[world.lore.length - 1];
  
  // Find selected anomaly details
  const selectedAnomaly = world.anomalies.find(a => a.id === selectedAnomalyId);

  return (
    <section className="h-full min-h-0 grid grid-rows-[minmax(220px,1fr)_auto] gap-4">
      {/* 3D Map Visualizer */}
      <div className="border border-slate-800 bg-black overflow-hidden relative rounded-lg">
        <div className="absolute left-4 top-4 z-10 flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-slate-400 font-bold">
          <RadioTower size={14} className="text-cyan-400" />
          World Tick {world.tick}
        </div>

        {selectedAnomaly && (
          <div className="absolute right-4 top-4 z-10 flex items-center gap-1.5 bg-black/60 border border-slate-800 px-2 py-1 rounded text-[9px] uppercase tracking-wider text-slate-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
            Active Target: {selectedAnomaly.name}
            <button 
              onClick={() => setSelectedAnomalyId(null)}
              className="ml-2 hover:text-white cursor-pointer text-[10px]"
            >
              [X]
            </button>
          </div>
        )}

        <Canvas camera={{ position: [0, 0, 7], fov: 58 }} style={{ background: 'transparent' }}>
          <ambientLight intensity={0.5} />
          <pointLight position={[4, 5, 5]} intensity={1.5} />
          <gridHelper args={[12, 24, '#a855f7', '#1e1b4b']} rotation={[Math.PI / 2, 0, 0]} />
          
          <Hotspots 
            world={world} 
            selectedAnomalyId={selectedAnomalyId} 
            onAnomalyClick={(id) => setSelectedAnomalyId(id)} 
          />

          <AgentNodes world={world} />
          
          <OrbitControls enablePan={false} minDistance={4} maxDistance={10} autoRotate autoRotateSpeed={0.3} />
        </Canvas>
      </div>

      {/* Grid Dashboard controls */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 min-h-[280px]">
        {/* Left Column: Factions & Lore */}
        <div className="border border-slate-800 bg-slate-950/70 p-4 overflow-hidden rounded-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 text-xs uppercase tracking-[0.2em] text-slate-400 font-bold">
              <Activity size={14} className="text-emerald-400" />
              Factions
            </div>
            <div className="space-y-3">
              {world.factions.map((faction) => (
                <div key={faction.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-200">{faction.name}</span>
                    <span className="text-slate-500">{faction.territory}%</span>
                  </div>
                  <div className="h-2 bg-slate-900 border border-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-500"
                      style={{ width: `${faction.territory}%`, backgroundColor: factionColors[faction.id] ?? '#facc15' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {latestLore && (
            <div className="border-t border-slate-800/60 pt-3 mt-3">
              <div className="text-[9px] uppercase tracking-[0.18em] text-slate-500 mb-1">Latest Lore Entry</div>
              <p className="text-[11px] text-slate-400 leading-relaxed italic line-clamp-2">{latestLore.body}</p>
            </div>
          )}
        </div>

        {/* Middle Column: Agent Deployer Swarm */}
        <div className="border border-slate-800 bg-slate-950/70 p-4 overflow-hidden rounded-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 text-xs uppercase tracking-[0.2em] text-slate-400 font-bold">
              <GitBranch size={14} className="text-cyan-400" />
              Agent Swarm
            </div>
            <div className="space-y-2 max-h-36 overflow-y-auto custom-scrollbar pr-1">
              {world.agents.map((agent) => (
                <div key={agent.id} className="border border-slate-800 bg-black/40 p-2 rounded transition-all hover:border-slate-700">
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="text-white font-bold truncate">{agent.name}</span>
                    <span className="text-slate-500 uppercase text-[9px]">{agent.mood}</span>
                  </div>
                  <div className="text-[9px] text-slate-500 uppercase mt-0.5">{agent.loyalty}</div>
                  {agent.biography && (
                    <div className="text-[8px] text-slate-400 mt-1 italic border-t border-slate-900/50 pt-1 leading-normal">
                      {agent.biography}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Advanced Spawner Panel */}
          <div className="border-t border-slate-800/60 pt-3">
            <div className="text-[9px] uppercase tracking-[0.18em] text-slate-500 mb-2 font-bold font-orbitron">Deploy Agent Specialist</div>
            <div className="grid grid-cols-2 gap-2 max-h-28 overflow-y-auto custom-scrollbar pr-1">
              {world.agent_archetypes.map((archetype) => (
                <button
                  key={archetype.id}
                  onClick={() => onSpawnAgent(archetype.id)}
                  className={`py-1.5 px-1 text-[8px] uppercase tracking-wider font-bold rounded border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer hover:scale-[1.03] active:scale-[0.98] ${
                    archetype.unlocked 
                      ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/60'
                      : 'border-amber-500/30 text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/60'
                  }`}
                >
                  <span className="font-orbitron font-black truncate max-w-full">{archetype.name.replace('The ', '')}</span>
                  <span className="opacity-60 text-[6px]">
                    {archetype.unlocked ? 'SPAWN' : 'UNLOCK'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Telemetry & God Mode Sliders */}
        <div className="border border-slate-800 bg-slate-950/70 p-4 overflow-hidden rounded-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3 text-xs uppercase tracking-[0.2em] text-slate-400 font-bold">
              <Sparkles size={14} className="text-fuchsia-300" />
              {selectedAnomaly ? 'Hotspot Telemetry' : 'God Mode Parameters'}
            </div>

            {selectedAnomaly ? (
              /* Selected Anomaly Details */
              <div className="space-y-3 p-3 bg-black/40 border border-slate-800 rounded-lg transition-all duration-300">
                <div className="flex items-center gap-1.5 text-xs text-white font-bold">
                  <Crosshair size={12} className="text-red-400" />
                  <span>{selectedAnomaly.name}</span>
                </div>
                <div className="text-[10px] text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Faction Dominion:</span>
                    <span className="font-bold uppercase" style={{ color: factionColors[selectedAnomaly.faction] }}>
                      {selectedAnomaly.faction}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Instability Index:</span>
                    <span className="font-bold text-red-400">{selectedAnomaly.severity}%</span>
                  </div>
                  <div className="flex justify-between items-center gap-1">
                    <span>Coordinates (X,Y,Z):</span>
                    <span className="font-mono text-cyan-400 bg-slate-900/80 px-1 rounded text-[9px]">
                      {selectedAnomaly.x}, {selectedAnomaly.y}, {selectedAnomaly.z}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[8px] uppercase tracking-wider text-slate-500 font-bold">
                    <span>Grid Severity Level</span>
                    <span>{selectedAnomaly.severity}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-900 border border-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-500 animate-pulse transition-all duration-300" 
                      style={{ width: `${selectedAnomaly.severity}%` }}
                    />
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedAnomalyId(null)}
                  className="w-full py-1 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900 text-[8px] uppercase font-mono tracking-widest rounded transition-all cursor-pointer"
                >
                  Return to Parameters
                </button>
              </div>
            ) : (
              /* God Mode Sliders */
              <div className="space-y-3 relative">
                {userRole !== 'admin' && (
                  <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm z-20 flex flex-col items-center justify-center border border-red-500/20 rounded p-4 text-center">
                    <Lock className="text-red-500 animate-pulse mb-1" size={18} />
                    <span className="text-[9px] uppercase font-orbitron font-black text-white tracking-widest">HOLOGRAPHIC LOCK ACTIVE</span>
                    <span className="text-[7px] uppercase text-slate-500 mt-0.5 tracking-wider">ADMIN PRIVILEGES REQUIRED TO EDIT CORE REALITY</span>
                  </div>
                )}
                {Object.entries(world.parameters).map(([key, value]) => (
                  <label key={key} className={`block ${userRole !== 'admin' ? 'opacity-30' : ''}`}>
                    <div className="flex justify-between text-[10px] uppercase text-slate-400 mb-1">
                      <span>{key.replaceAll('_', ' ')}</span>
                      <span>{value.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={value}
                      disabled={userRole !== 'admin'}
                      onChange={(event) => onParameterChange(key, Number(event.target.value))}
                      className="w-full accent-cyan-400 cursor-ew-resize h-1.5 bg-slate-900 rounded-full appearance-none disabled:cursor-not-allowed"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="text-[8px] uppercase tracking-[0.25em] text-slate-600 font-bold text-center mt-4">
            * Persistent Realtime Neural Datafeed *
          </div>
        </div>
      </div>
    </section>
  );
}
