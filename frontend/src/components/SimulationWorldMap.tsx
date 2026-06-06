"use client";

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { Activity, GitBranch, RadioTower, Sparkles, Crosshair, Lock } from 'lucide-react';
import { SimulationWorld } from '@/store/simulationStore';
import * as THREE from 'three';
import { useSpatialAudio } from '@/hooks/useSpatialAudio';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

const factionColors: Record<string, string> = {
  kernel: '#38bdf8',
  ghost: '#c084fc',
  operators: '#22c55e',
  parasite: '#f43f5e',
  awakening: '#fb7185',
};

// --- Spatial Audio Components ---

interface CustomWindow extends Window {
  __GLOBAL_AUDIO_CTX__?: AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

interface AudioListenerRigProps {
  active: boolean;
}

function AudioListenerRig({ active }: AudioListenerRigProps) {
  const { camera } = useThree();

  useFrame(() => {
    if (!active) return;
    if (typeof window === 'undefined') return;
    const audioCtx = (window as unknown as CustomWindow).__GLOBAL_AUDIO_CTX__;
    if (!audioCtx || audioCtx.state !== 'running') return;
    
    const listener = audioCtx.listener;
    const time = audioCtx.currentTime;

    try {
      if (listener.positionX) {
        listener.positionX.setValueAtTime(camera.position.x, time);
        listener.positionY.setValueAtTime(camera.position.y, time);
        listener.positionZ.setValueAtTime(camera.position.z, time);

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

        listener.forwardX.setValueAtTime(forward.x, time);
        listener.forwardY.setValueAtTime(forward.y, time);
        listener.forwardZ.setValueAtTime(forward.z, time);

        listener.upX.setValueAtTime(up.x, time);
        listener.upY.setValueAtTime(up.y, time);
        listener.upZ.setValueAtTime(up.z, time);
      } else {
        listener.setPosition(camera.position.x, camera.position.y, camera.position.z);
      }
    } catch (e) {
      console.warn("Failed to update spatial audio listener position", e);
    }
  });

  return null;
}

interface PositionalSynthProps {
  position: [number, number, number];
  frequency?: number;
  active?: boolean;
}

function PositionalSynth({ position, frequency = 220, active = true }: PositionalSynthProps) {
  const pannerRef = useRef<PannerNode | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    if (!active) return;
    if (typeof window === 'undefined') return;
    const audioCtx = (window as unknown as CustomWindow).__GLOBAL_AUDIO_CTX__;
    if (!audioCtx || audioCtx.state !== 'running') return;

    try {
      const panner = audioCtx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'exponential';
      panner.refDistance = 1.0;
      panner.maxDistance = 100.0;
      panner.rolloffFactor = 1.0;

      const time = audioCtx.currentTime;
      panner.positionX.setValueAtTime(position[0], time);
      panner.positionY.setValueAtTime(position[1], time);
      panner.positionZ.setValueAtTime(position[2], time);

      const gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(0.015, time); // Subtle background hum volume

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, time);

      const osc = audioCtx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(frequency, time);

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(panner);
      panner.connect(audioCtx.destination);
      osc.start();

      oscRef.current = osc;
      gainRef.current = gainNode;
      pannerRef.current = panner;

      return () => {
        try { osc.stop(); } catch {}
        try { osc.disconnect(); } catch {}
        try { filter.disconnect(); } catch {}
        try { gainNode.disconnect(); } catch {}
        try { panner.disconnect(); } catch {}
      };
    } catch (e) {
      console.warn("Positional Audio node creation failed", e);
    }
  }, [active, position, frequency]);

  useFrame(() => {
    if (!active) return;
    if (typeof window === 'undefined') return;
    const audioCtx = (window as unknown as CustomWindow).__GLOBAL_AUDIO_CTX__;
    if (audioCtx && audioCtx.state === 'running' && pannerRef.current) {
      const time = audioCtx.currentTime;
      pannerRef.current.positionX.setValueAtTime(position[0], time);
      pannerRef.current.positionY.setValueAtTime(position[1], time);
      pannerRef.current.positionZ.setValueAtTime(position[2], time);
    }
  });

  return null;
}

// --- WebGL Shader & Particles Components ---

interface CentralCoreProps {
  stability: number;
  heat: number;
}

function CentralCore({ stability, heat }: CentralCoreProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const vertexShader = `
    uniform float uTime;
    uniform float uStability;
    uniform float uHeat;
    varying vec3 vNormal;
    varying vec3 vPosition;

    float hash(vec3 p) {
      p = fract(p * 0.3183099 + vec3(0.1, 0.1, 0.1));
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    float noise(vec3 x) {
      vec3 i = floor(x);
      vec3 f = fract(x);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                     mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                     mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
    }

    void main() {
      vNormal = normal;
      vPosition = position;

      float frequency = 2.5 + uHeat * 4.0;
      float amplitude = 0.08 * (1.0 - uStability) + 0.02 * uHeat;
      float distortion = noise(position * frequency + uTime * 1.5) * amplitude;
      vec3 newPosition = position + normal * distortion;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
  `;

  const fragmentShader = `
    uniform float uTime;
    uniform float uStability;
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      float intensity = pow(0.7 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
      vec3 stableColor = vec3(0.08, 0.58, 0.88); // Cyber Cyan-Blue
      vec3 unstableColor = vec3(0.92, 0.16, 0.38); // Warning Pink-Red
      vec3 baseColor = mix(unstableColor, stableColor, uStability);

      float ring = sin(vPosition.y * 24.0 - uTime * 3.0) * 0.5 + 0.5;
      vec3 finalColor = baseColor * (intensity * 1.8 + ring * 0.25);

      gl_FragColor = vec4(finalColor, 0.55);
    }
  `;

  const uniforms = useMemo(() => ({
    uTime: { value: 0.0 },
    uStability: { value: 1.0 },
    uHeat: { value: 0.0 }
  }), []);

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      const time = state.clock.getElapsedTime();
      material.uniforms.uTime.value = time;
      material.uniforms.uStability.value = stability;
      material.uniforms.uHeat.value = heat;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1.15, 64, 64]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

interface ProceduralGalaxyProps {
  active: boolean;
}

// Pre-calculate galaxy particle positions outside of render flow to satisfy React purity rules
const galaxyPositions = (() => {
  const count = 1800;
  const pos = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const r = Math.random() * 4.8 + 1.3;
    const branches = 3;
    const branchAngle = ((i % branches) * 2 * Math.PI) / branches;
    const twist = r * 0.75;
    const spread = (Math.random() - 0.5) * 0.45;
    const angle = branchAngle + twist + spread;

    pos[i * 3] = Math.cos(angle) * r;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 0.22 * (5.5 - r);
    pos[i * 3 + 2] = Math.sin(angle) * r;
  }

  return pos;
})();

function ProceduralGalaxy({ active }: ProceduralGalaxyProps) {
  const pointsRef = useRef<THREE.Points>(null);

  useFrame((state) => {
    if (pointsRef.current && active) {
      pointsRef.current.rotation.y = state.clock.getElapsedTime() * 0.035;
    }
  });

  if (!active) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[galaxyPositions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#a855f7" // Purple cosmic particles
        size={0.03}
        transparent
        opacity={0.55}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// --- Agent Nodes & Anomaly Hotspots ---

interface AgentNodesProps {
  world: SimulationWorld;
  isAudioActive: boolean;
}

function AgentNodes({ world, isAudioActive }: AgentNodesProps) {
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
        const radius = 2.2 + index * 0.5;
        const speed = 0.4 + index * 0.08;
        const angle = rotation * speed + (index * Math.PI * 2) / Math.max(1, agents.length);
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = Math.sin(rotation * 1.5 + index) * 0.25;

        // Pitch maps to index position
        const agentFreq = 180 + (index * 30);

        return (
          <group key={agent.id} position={[x, y, z]}>
            {/* Positional Synthesizer Hum */}
            <PositionalSynth 
              position={[x, y, z]} 
              frequency={agentFreq} 
              active={isAudioActive} 
            />

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
  isAudioActive: boolean;
}

function Hotspots({ world, selectedAnomalyId, onAnomalyClick, isAudioActive }: HotspotsProps) {
  const anomalies = useMemo(() => world.anomalies, [world.anomalies]);

  return (
    <group>
      {anomalies.map((anomaly) => {
        const color = factionColors[anomaly.faction] ?? '#facc15';
        const isSelected = selectedAnomalyId === anomaly.id;
        const baseScale = 0.15 + anomaly.severity / 180;
        const scale = isSelected ? baseScale * 1.35 : baseScale;

        // Warning sound frequency maps to severity
        const anomalyFreq = 220 + (anomaly.severity * 2.5);

        return (
          <group key={anomaly.id} position={[anomaly.x, anomaly.y, anomaly.z]}>
            {/* Positional Anomaly Hum */}
            <PositionalSynth 
              position={[anomaly.x, anomaly.y, anomaly.z]} 
              frequency={anomalyFreq} 
              active={isAudioActive} 
            />

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

// --- Main World Map Dashboard Component ---

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
  
  // Audio & Graphics Toggles
  const { initAudio, playBeep } = useSpatialAudio();
  const [isAudioActive, setIsAudioActive] = useState(false);
  const [ecoMode, setEcoMode] = useState(false);

  const handleToggleAudio = async () => {
    const ctx = await initAudio();
    if (ctx) {
      setIsAudioActive(ctx.state === 'running');
    }
  };

  useEffect(() => {
    if (world?.tick && isAudioActive) {
      // Play a soft network activity tick hum
      playBeep(240, 0.05);
    }
  }, [world?.tick, isAudioActive, playBeep]);

  if (!world) {
    return (
      <div className="h-full min-h-[360px] border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-500">
        Synchronizing persistent world state...
      </div>
    );
  }

  const latestLore = world.lore[world.lore.length - 1];
  const selectedAnomaly = world.anomalies.find(a => a.id === selectedAnomalyId);

  return (
    <section className="h-full min-h-0 grid grid-rows-[minmax(220px,1fr)_auto] gap-4">
      {/* 3D Map Visualizer */}
      <div className="border border-slate-900 bg-black overflow-hidden relative rounded-lg">
        {/* HUD control bar */}
        <div className="absolute left-4 top-4 z-10 flex flex-wrap items-center gap-3 text-[9px] uppercase tracking-wider font-mono font-bold select-none">
          <div className="flex items-center gap-2 text-slate-400 bg-slate-950/80 border border-slate-900 px-2.5 py-1 rounded">
            <RadioTower size={12} className="text-cyan-400" />
            <span>Tick {world.tick}</span>
          </div>

          <button 
            onClick={handleToggleAudio}
            className={`px-2.5 py-1 rounded border transition-all cursor-pointer flex items-center gap-1.5 ${
              isAudioActive 
                ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20' 
                : 'border-slate-800 text-slate-500 bg-slate-950/80 hover:text-slate-300 hover:border-slate-700'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isAudioActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            <span>{isAudioActive ? 'Audio Active' : 'Enable 3D Sound'}</span>
          </button>

          <button 
            onClick={() => setEcoMode(!ecoMode)}
            className={`px-2.5 py-1 rounded border transition-all cursor-pointer flex items-center gap-1.5 ${
              ecoMode 
                ? 'border-amber-500/30 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20' 
                : 'border-slate-800 text-slate-500 bg-slate-950/80 hover:text-slate-300 hover:border-slate-700'
            }`}
          >
            <span>GPU Eco Mode: {ecoMode ? 'ON' : 'OFF'}</span>
          </button>
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
          <ambientLight intensity={0.55} />
          <pointLight position={[4, 5, 5]} intensity={1.6} />
          
          <gridHelper args={[12, 24, '#a855f7', '#1c1917']} rotation={[Math.PI / 2, 0, 0]} />
          
          {/* Spatial Audio camera listener */}
          <AudioListenerRig active={isAudioActive} />

          {/* Core Reacting Mesh */}
          <CentralCore 
            stability={world.stability} 
            heat={world.heat} 
          />

          {/* Procedural Galaxy Particles */}
          <ProceduralGalaxy active={!ecoMode} />
          
          <Hotspots 
            world={world} 
            selectedAnomalyId={selectedAnomalyId} 
            onAnomalyClick={(id) => {
              setSelectedAnomalyId(id);
              playBeep(750, 0.15);
            }} 
            isAudioActive={isAudioActive}
          />

          <AgentNodes world={world} isAudioActive={isAudioActive} />
          
          <OrbitControls enablePan={false} minDistance={4} maxDistance={10} autoRotate={!ecoMode} autoRotateSpeed={0.3} />

          {/* Post-Processing selective Glow (Bloom) */}
          {!ecoMode && (
            <EffectComposer>
              <Bloom 
                luminanceThreshold={0.12} 
                luminanceSmoothing={0.9} 
                height={300} 
                intensity={1.1} 
              />
            </EffectComposer>
          )}
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
