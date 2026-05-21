"use client";

import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { Activity, GitBranch, RadioTower, Sparkles, UserPlus } from 'lucide-react';
import { SimulationWorld } from '@/hooks/useSimulationSocket';

const factionColors: Record<string, string> = {
  kernel: '#38bdf8',
  ghost: '#ef4444',
  operators: '#22c55e',
};

function Hotspots({ world }: { world: SimulationWorld }) {
  const anomalies = useMemo(() => world.anomalies, [world.anomalies]);

  return (
    <group>
      {anomalies.map((anomaly) => {
        const color = factionColors[anomaly.faction] ?? '#facc15';
        const scale = 0.15 + anomaly.severity / 180;
        return (
          <group key={anomaly.id} position={[anomaly.x, anomaly.y, anomaly.z]}>
            <mesh scale={scale}>
              <sphereGeometry args={[1, 32, 32]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} transparent opacity={0.82} />
            </mesh>
            <Text position={[0, scale + 0.28, 0]} fontSize={0.16} color="#e5e7eb" anchorX="center">
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
  onParameterChange,
  onSpawnAgent,
}: {
  world: SimulationWorld | null;
  onParameterChange: (key: string, value: number) => void;
  onSpawnAgent: (archetypeId: string) => void;
}) {
  if (!world) {
    return (
      <div className="h-full min-h-[360px] border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-500">
        Synchronizing persistent world state...
      </div>
    );
  }

  const latestLore = world.lore[world.lore.length - 1];
  const lockedArchetype = world.agent_archetypes.find((archetype) => !archetype.unlocked);

  return (
    <section className="h-full min-h-0 grid grid-rows-[minmax(220px,1fr)_auto] gap-4">
      <div className="border border-slate-800 bg-black overflow-hidden relative">
        <div className="absolute left-4 top-4 z-10 flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-slate-400 font-bold">
          <RadioTower size={14} className="text-cyan-400" />
          World Tick {world.tick}
        </div>
        <Canvas camera={{ position: [0, 0, 7], fov: 58 }}>
          <color attach="background" args={['#020617']} />
          <ambientLight intensity={0.45} />
          <pointLight position={[4, 5, 5]} intensity={1.4} />
          <gridHelper args={[8, 16, '#1e293b', '#0f172a']} rotation={[Math.PI / 2, 0, 0]} />
          <Hotspots world={world} />
          <OrbitControls enablePan={false} minDistance={4} maxDistance={10} />
        </Canvas>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 min-h-[280px]">
        <div className="border border-slate-800 bg-slate-950/70 p-4 overflow-hidden">
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
                <div className="h-2 bg-slate-900 border border-slate-800">
                  <div
                    className="h-full"
                    style={{ width: `${faction.territory}%`, backgroundColor: factionColors[faction.id] ?? '#facc15' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-slate-800 bg-slate-950/70 p-4 overflow-hidden">
          <div className="flex items-center gap-2 mb-4 text-xs uppercase tracking-[0.2em] text-slate-400 font-bold">
            <GitBranch size={14} className="text-cyan-400" />
            Agents
          </div>
          <div className="space-y-2 max-h-44 overflow-y-auto custom-scrollbar pr-1">
            {world.agents.map((agent) => (
              <div key={agent.id} className="border border-slate-800 bg-black/40 p-2">
                <div className="flex justify-between gap-2 text-xs">
                  <span className="text-white font-bold truncate">{agent.name}</span>
                  <span className="text-slate-500 uppercase">{agent.mood}</span>
                </div>
                <div className="text-[10px] text-slate-500 uppercase mt-1">{agent.loyalty}</div>
              </div>
            ))}
          </div>
          {lockedArchetype && (
            <button
              onClick={() => onSpawnAgent(lockedArchetype.id)}
              className="mt-3 w-full h-9 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.18em] font-bold"
            >
              <UserPlus size={14} />
              Spawn {lockedArchetype.name}
            </button>
          )}
        </div>

        <div className="border border-slate-800 bg-slate-950/70 p-4 overflow-hidden">
          <div className="flex items-center gap-2 mb-4 text-xs uppercase tracking-[0.2em] text-slate-400 font-bold">
            <Sparkles size={14} className="text-fuchsia-300" />
            God Mode
          </div>
          <div className="space-y-3">
            {Object.entries(world.parameters).map(([key, value]) => (
              <label key={key} className="block">
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
                  onChange={(event) => onParameterChange(key, Number(event.target.value))}
                  className="w-full accent-cyan-400"
                />
              </label>
            ))}
          </div>
          {latestLore && (
            <div className="mt-4 border-t border-slate-800 pt-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">Latest Lore</div>
              <p className="text-xs text-slate-300 leading-relaxed">{latestLore.body}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
