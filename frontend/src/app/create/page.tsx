"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Globe, 
  GitBranch, 
  Users, 
  Sliders, 
  Check, 
  Play, 
  ArrowLeft, 
  ArrowRight, 
  Shuffle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Template {
  name: string;
  description: string;
  seed: string;
  faction_distribution: Record<string, number>;
  agent_seeds: Record<string, number>;
  parameters: {
    tick_interval_ms: number;
    max_agents: number;
    stability_decay: number;
    entropy_bias: number;
  };
}

// Import Templates directly
import defaultCollapse from '@/templates/default-collapse.json';
import maximumEntropy from '@/templates/maximum-entropy.json';
import civilizationGenesis from '@/templates/civilization-genesis.json';
import ghostWar from '@/templates/ghost-war.json';
import longSilence from '@/templates/long-silence.json';

const TEMPLATES = [
  defaultCollapse,
  maximumEntropy,
  civilizationGenesis,
  ghostWar,
  longSilence
];

const ARCHETYPES_LIST = [
  { id: 'disruptor', name: 'The Disruptor', faction: 'entropy' },
  { id: 'corruptor', name: 'The Corruptor', faction: 'entropy' },
  { id: 'mutator', name: 'The Mutator', faction: 'entropy' },
  { id: 'void_caller', name: 'The VoidCaller', faction: 'entropy' },
  { id: 'architect', name: 'The Architect', faction: 'order' },
  { id: 'patcher', name: 'The Patcher', faction: 'order' },
  { id: 'stabilizer', name: 'The Stabilizer', faction: 'order' },
  { id: 'guardian', name: 'The Guardian', faction: 'order' },
  { id: 'prophet', name: 'The Prophet', faction: 'awakening' },
  { id: 'seer', name: 'The Seer', faction: 'awakening' },
  { id: 'whisperer', name: 'The Whisperer', faction: 'awakening' },
  { id: 'awakener', name: 'The Awakener', faction: 'awakening' },
  { id: 'infiltrator', name: 'The Infiltrator', faction: 'parasite' },
  { id: 'mimic', name: 'The Mimic', faction: 'parasite' },
  { id: 'leech', name: 'The Leech', faction: 'parasite' },
  { id: 'hijacker', name: 'The Hijacker', faction: 'parasite' },
  { id: 'observer', name: 'The Observer', faction: 'watcher' },
  { id: 'chronicler', name: 'The Chronicler', faction: 'watcher' },
  { id: 'analyst', name: 'The Analyst', faction: 'watcher' },
  { id: 'null', name: 'The Null', faction: 'watcher' }
];

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '1';
  const match = document.cookie.match(new RegExp('(^| )csrf_token=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : '1';
};

function WorldCreatorWizardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const remixId = searchParams.get('remix');

  const [step, setStep] = useState(1);
  const [loadingRemix, setLoadingRemix] = useState(!!remixId);
  const [launching, setLaunching] = useState(false);

  // Step 1 State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [seed, setSeed] = useState("42");

  // Step 2 State
  const [factionDistribution, setFactionDistribution] = useState<Record<string, number>>({
    entropy: 20,
    order: 20,
    awakening: 20,
    parasite: 20,
    watcher: 20
  });

  // Step 3 State
  const [agentSeeds, setAgentSeeds] = useState<Record<string, number>>(() => {
    const seeds: Record<string, number> = {};
    ARCHETYPES_LIST.forEach(arch => {
      seeds[arch.id] = 0;
    });
    return seeds;
  });

  // Step 4 State
  const [tickSpeedSeconds, setTickSpeedSeconds] = useState(2);
  const [maxAgents, setMaxAgents] = useState(200);
  const [stabilityDecay, setStabilityDecay] = useState(1.5);
  const [entropyBias, setEntropyBias] = useState(0.35);

  // 1. Remix pre-filling
  useEffect(() => {
    if (!remixId) return;
    Promise.resolve().then(() => setLoadingRemix(true));

    fetch(`http://localhost:8000/v1/simulation/${remixId}/state`, { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error("World state not found");
        return res.json();
      })
      .then(data => {
        setName(`Remix of ${data.name || 'Simulation'}`);
        setDescription(`Remixed timeline from simulation ID ${remixId}. ${data.description || ''}`);
        
        if (data.seed) setSeed(data.seed);
        
        if (data.faction_distribution) {
          setFactionDistribution(data.faction_distribution);
        }
        
        if (data.agent_seeds) {
          const seeds: Record<string, number> = {};
          ARCHETYPES_LIST.forEach(arch => {
            seeds[arch.id] = data.agent_seeds[arch.id] || 0;
          });
          setAgentSeeds(seeds);
        }

        if (data.parameters) {
          if (data.parameters.tick_interval_ms) {
            setTickSpeedSeconds(data.parameters.tick_interval_ms / 1000);
          }
          if (data.parameters.max_agents) {
            setMaxAgents(data.parameters.max_agents);
          }
          if (data.parameters.stability_decay !== undefined) {
            setStabilityDecay(data.parameters.stability_decay);
          }
          if (data.parameters.entropy_bias !== undefined) {
            setEntropyBias(data.parameters.entropy_bias);
          }
        }
      })
      .catch(err => {
        console.error("Failed to load remix state", err);
      })
      .finally(() => {
        setLoadingRemix(false);
      });
  }, [remixId]);

  // Calculations
  const factionSum = useMemo(() => {
    return Object.values(factionDistribution).reduce((a, b) => a + b, 0);
  }, [factionDistribution]);

  const activeAgentsSum = useMemo(() => {
    return Object.values(agentSeeds).reduce((a, b) => a + b, 0);
  }, [agentSeeds]);

  const randomizeSeed = () => {
    const randomVal = Math.floor(10000 + Math.random() * 90000).toString();
    setSeed(randomVal);
  };

  const selectTemplate = (tpl: Template) => {
    setName(tpl.name);
    setDescription(tpl.description);
    setSeed(tpl.seed);
    setFactionDistribution(tpl.faction_distribution);
    
    const seeds: Record<string, number> = {};
    ARCHETYPES_LIST.forEach(arch => {
      seeds[arch.id] = tpl.agent_seeds[arch.id] || 0;
    });
    setAgentSeeds(seeds);

    setTickSpeedSeconds(tpl.parameters.tick_interval_ms / 1000);
    setMaxAgents(tpl.parameters.max_agents);
    setStabilityDecay(tpl.parameters.stability_decay);
    setEntropyBias(tpl.parameters.entropy_bias);
  };

  // Quick fill algorithm based on faction distribution
  const handleQuickFill = () => {
    const totalAgents = 50;
    const newAgentSeeds = { ...agentSeeds };
    
    const FACTION_ARCHETYPES = {
      entropy: ['disruptor', 'corruptor', 'mutator', 'void_caller'],
      order: ['architect', 'patcher', 'stabilizer', 'guardian'],
      awakening: ['prophet', 'seer', 'whisperer', 'awakener'],
      parasite: ['infiltrator', 'mimic', 'leech', 'hijacker'],
      watcher: ['observer', 'chronicler', 'analyst', 'null']
    };

    // Reset counts
    Object.values(FACTION_ARCHETYPES).flat().forEach(archId => {
      newAgentSeeds[archId] = 0;
    });

    const allocations: Record<string, number> = {};
    const factionKeys = Object.keys(FACTION_ARCHETYPES) as Array<keyof typeof FACTION_ARCHETYPES>;

    // Determine allocations per faction
    factionKeys.forEach((fac) => {
      const sliderVal = factionDistribution[fac] || 0;
      const alloc = Math.round((sliderVal / 100) * totalAgents);
      allocations[fac] = alloc;
    });

    // Divide allocations to individual archetypes
    factionKeys.forEach((fac) => {
      const quota = allocations[fac] || 0;
      const archIds = FACTION_ARCHETYPES[fac];
      const n = archIds.length;
      const base = Math.floor(quota / n);
      const rem = quota % n;
      
      archIds.forEach((archId, idx) => {
        newAgentSeeds[archId] = base + (idx < rem ? 1 : 0);
      });
    });

    setAgentSeeds(newAgentSeeds);
  };

  // Submit and Launch
  const handleLaunch = async () => {
    setLaunching(true);
    try {
      const res = await fetch('http://localhost:8000/v1/worlds', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken()
        },
        body: JSON.stringify({
          name: name.trim() || "Simulation Timeline",
          description: description.trim(),
          seed: seed.trim(),
          faction_distribution: factionDistribution,
          agent_seeds: agentSeeds,
          parameters: {
            tick_interval_ms: tickSpeedSeconds * 1000,
            max_agents: maxAgents,
            stability_decay: stabilityDecay,
            entropy_bias: entropyBias
          }
        })
      });

      if (!res.ok) {
        throw new Error("Simulation initialization failed");
      }

      const result = await res.json();
      router.push(`/sim/${result.world_id}`);
    } catch (e) {
      console.error(e);
      alert("Failed to boot custom simulation timeline. See developer console.");
      setLaunching(false);
    }
  };

  // Form validation
  const canProceed = () => {
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return factionSum === 100;
    return true;
  };

  const stepsMeta = [
    { num: 1, label: 'Metadata', icon: <Globe size={14} /> },
    { num: 2, label: 'Factions', icon: <GitBranch size={14} /> },
    { num: 3, label: 'Seeding', icon: <Users size={14} /> },
    { num: 4, label: 'Parameters', icon: <Sliders size={14} /> },
    { num: 5, label: 'Review', icon: <Play size={14} /> },
  ];

  if (loadingRemix) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 font-mono flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-40 mix-blend-overlay" />
        <div className="text-center space-y-4 relative z-10">
          <div className="w-8 h-8 border-2 border-t-transparent border-purple-500 rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-purple-400 font-bold">Synchronizing remix settings configurations...</p>
        </div>
      </main>
    );
  }

  if (launching) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 font-mono flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-40 mix-blend-overlay" />
        <div className="text-center space-y-4 relative z-10">
          <div className="w-8 h-8 border-2 border-t-transparent border-cyan-500 rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-cyan-400 font-bold">Instantiating quantum timelines...</p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-100 font-mono flex flex-col items-center p-4 sm:p-6 select-none overflow-x-hidden relative">
      {/* Scanline Overlay */}
      <div className="absolute inset-0 pointer-events-none z-40 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-20 mix-blend-overlay" />

      {/* Main Form container */}
      <div className="w-full max-w-[1100px] flex flex-col h-full bg-slate-950/80 border border-slate-900 rounded-lg shadow-2xl overflow-hidden mt-6 relative z-10 min-h-[600px]">
        
        {/* Top Header */}
        <header className="px-6 py-4 bg-slate-900/60 border-b border-slate-900 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Globe className="text-purple-400 animate-pulse" size={20} />
            <div>
              <h1 className="font-orbitron font-black text-md text-white tracking-wide uppercase">Simulation World Creator</h1>
              <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">BOOT SEQUENCE TERMINAL ENGINE V2.1</p>
            </div>
          </div>
          <button 
            onClick={() => router.push('/')}
            className="px-3 py-1.5 border border-slate-800 hover:border-slate-500 text-slate-400 hover:text-white rounded text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
          >
            Terminal Dashboard
          </button>
        </header>

        {/* Wizard Main Layout */}
        <div className="flex-1 grid grid-cols-12 min-h-0">
          
          {/* Step indicator sidebar */}
          <aside className="col-span-12 md:col-span-3 border-r-0 md:border-r border-b md:border-b-0 border-slate-900 bg-slate-950/40 p-4 md:p-6 flex flex-row md:flex-col justify-around md:justify-start gap-4">
            {stepsMeta.map((s) => {
              const isActive = step === s.num;
              const isCompleted = step > s.num;
              return (
                <div 
                  key={s.num}
                  className={`flex items-center gap-3 font-orbitron transition-all ${
                    isActive ? 'text-purple-400 scale-[1.02] font-black' : isCompleted ? 'text-emerald-400' : 'text-slate-600'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] ${
                    isActive ? 'border-purple-500 bg-purple-950/20' : isCompleted ? 'border-emerald-500 bg-emerald-950/20' : 'border-slate-800'
                  }`}>
                    {isCompleted ? <Check size={12} /> : s.num}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider hidden md:inline">{s.label}</span>
                </div>
              );
            })}
          </aside>

          {/* Form Step Body Content */}
          <div className="col-span-12 md:col-span-9 p-6 flex flex-col justify-between min-h-[400px]">
            <div className="flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  {/* STEP 1: Metadata & Templates */}
                  {step === 1 && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                        <h2 className="font-orbitron text-xs font-black text-white uppercase tracking-wider">Step 1: Simulation Metadata</h2>
                        <span className="text-[8px] text-slate-500 font-bold uppercase">BOOT_REGISTERS</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] uppercase text-slate-500 font-black">Simulation Codename</label>
                            <input 
                              type="text"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white outline-none focus:border-purple-500 uppercase font-mono"
                              placeholder="e.g. MAXIMUM_ENTROPY"
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] uppercase text-slate-500 font-black">Timeline Description</label>
                            <textarea 
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white outline-none focus:border-purple-500 font-mono h-24 resize-none"
                              placeholder="Describe the operational goals of this timeline simulation..."
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] uppercase text-slate-500 font-black">Entropy seed key</label>
                            <div className="flex gap-2">
                              <input 
                                type="text"
                                value={seed}
                                onChange={(e) => setSeed(e.target.value)}
                                className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white outline-none focus:border-purple-500 font-mono"
                                placeholder="Entropy Seed"
                              />
                              <button
                                onClick={randomizeSeed}
                                className="px-3 border border-slate-800 hover:border-slate-500 bg-slate-950 text-slate-400 hover:text-white rounded text-xs flex items-center justify-center cursor-pointer transition-colors"
                                title="Randomize seed"
                              >
                                <Shuffle size={14} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Templates tab */}
                        <div className="space-y-3">
                          <label className="text-[9px] uppercase text-slate-500 font-black block">Pre-configured templates</label>
                          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar border border-slate-900 bg-black/40 p-2.5 rounded">
                            {TEMPLATES.map((tpl) => (
                              <button
                                key={tpl.name}
                                onClick={() => selectTemplate(tpl)}
                                className="w-full text-left p-2.5 border border-slate-900 hover:border-purple-500/50 bg-slate-950/40 rounded transition-colors flex flex-col gap-0.5 cursor-pointer"
                              >
                                <span className="text-[9px] font-black text-white uppercase font-orbitron">{tpl.name}</span>
                                <span className="text-[8px] text-slate-500 leading-normal">{tpl.description}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: Factions Sliders */}
                  {step === 2 && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                        <h2 className="font-orbitron text-xs font-black text-white uppercase tracking-wider">Step 2: Faction Balance</h2>
                        <span className={`text-[9px] px-2 py-0.5 border rounded font-black font-mono ${
                          factionSum === 100 ? 'bg-emerald-950/20 text-emerald-400 border-emerald-500/30' : 'bg-red-950/20 text-red-400 border-red-500/30'
                        }`}>
                          SUM: {factionSum}/100
                        </span>
                      </div>

                      <p className="text-[9px] uppercase text-slate-500 leading-normal mb-3">
                        Sliders must total exactly 100 to map out initial influence parameters.
                      </p>

                      <div className="space-y-4 max-w-xl">
                        {Object.keys(factionDistribution).map((fac) => (
                          <div key={fac} className="flex flex-col gap-1">
                            <div className="flex justify-between items-center text-[10px] uppercase font-mono">
                              <span className="text-slate-400 font-bold">{fac}</span>
                              <span className="text-cyan-400 font-bold">{factionDistribution[fac]}%</span>
                            </div>
                            <input 
                              type="range"
                              min="0"
                              max="100"
                              value={factionDistribution[fac]}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setFactionDistribution(prev => ({
                                  ...prev,
                                  [fac]: val
                                }));
                              }}
                              className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-purple-500"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* STEP 3: Spawners */}
                  {step === 3 && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                        <h2 className="font-orbitron text-xs font-black text-white uppercase tracking-wider">Step 3: Initial Agent Seeding</h2>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-slate-500 font-bold uppercase">Total agents: {activeAgentsSum}</span>
                          <button
                            onClick={handleQuickFill}
                            className="px-2 py-0.5 border border-purple-500 bg-purple-950/20 hover:bg-purple-950/40 text-purple-400 rounded text-[8px] font-black uppercase transition-colors cursor-pointer"
                          >
                            Quick Fill
                          </button>
                        </div>
                      </div>

                      <p className="text-[9px] uppercase text-slate-500 leading-normal mb-2">
                        Distribute initial agent workloads (limit 0 to 50 each). &quot;Quick Fill&quot; pre-populates based on faction percentages from Step 2.
                      </p>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar border border-slate-900 bg-black/30 p-3 rounded">
                        {ARCHETYPES_LIST.map((arch) => (
                          <div 
                            key={arch.id} 
                            className="bg-slate-950 border border-slate-900/60 p-2 rounded flex flex-col gap-1.5"
                          >
                            <span className="text-[9px] font-black text-slate-300 truncate uppercase">{arch.name.replace('The ', '')}</span>
                            <span className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">{arch.faction}</span>
                            
                            <input 
                              type="number"
                              min="0"
                              max="50"
                              value={agentSeeds[arch.id] || 0}
                              onChange={(e) => {
                                let val = parseInt(e.target.value) || 0;
                                val = Math.max(0, Math.min(50, val));
                                setAgentSeeds(prev => ({
                                  ...prev,
                                  [arch.id]: val
                                }));
                              }}
                              className="w-full bg-black border border-slate-800 rounded px-2 py-1 text-xs text-white outline-none focus:border-purple-500 text-center font-mono font-bold"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* STEP 4: Parameters */}
                  {step === 4 && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                        <h2 className="font-orbitron text-xs font-black text-white uppercase tracking-wider">Step 4: Simulation Loops</h2>
                        <span className="text-[8px] text-slate-500 font-bold uppercase">PHYSICS_PARAMETERS</span>
                      </div>

                      <div className="space-y-5 max-w-xl">
                        {/* Tick Speed */}
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between items-center text-[10px] uppercase font-mono">
                            <span className="text-slate-400 font-bold">Tick clock interval</span>
                            <span className="text-cyan-400 font-bold">{tickSpeedSeconds}s</span>
                          </div>
                          <input 
                            type="range"
                            min="1"
                            max="60"
                            value={tickSpeedSeconds}
                            onChange={(e) => setTickSpeedSeconds(parseInt(e.target.value))}
                            className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-purple-500"
                          />
                        </div>

                        {/* Max Agents */}
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between items-center text-[10px] uppercase font-mono">
                            <span className="text-slate-400 font-bold">Max simulation agents</span>
                            <span className="text-cyan-400 font-bold">{maxAgents}</span>
                          </div>
                          <input 
                            type="range"
                            min="10"
                            max="1000"
                            step="10"
                            value={maxAgents}
                            onChange={(e) => setMaxAgents(parseInt(e.target.value))}
                            className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-purple-500"
                          />
                        </div>

                        {/* Stability decay */}
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between items-center text-[10px] uppercase font-mono">
                            <span className="text-slate-400 font-bold">Stability decay rate</span>
                            <span className="text-cyan-400 font-bold">{stabilityDecay.toFixed(1)}/tick</span>
                          </div>
                          <input 
                            type="range"
                            min="0.1"
                            max="10.0"
                            step="0.1"
                            value={stabilityDecay}
                            onChange={(e) => setStabilityDecay(parseFloat(e.target.value))}
                            className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-purple-500"
                          />
                        </div>

                        {/* Entropy Bias */}
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between items-center text-[10px] uppercase font-mono">
                            <span className="text-slate-400 font-bold">Simulation entropy bias</span>
                            <span className="text-cyan-400 font-bold">{entropyBias.toFixed(2)}</span>
                          </div>
                          <input 
                            type="range"
                            min="0.0"
                            max="1.00"
                            step="0.05"
                            value={entropyBias}
                            onChange={(e) => setEntropyBias(parseFloat(e.target.value))}
                            className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-purple-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 5: Summary Review */}
                  {step === 5 && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                        <h2 className="font-orbitron text-xs font-black text-white uppercase tracking-wider">Step 5: Review & Launch</h2>
                        <span className="text-[8px] text-slate-500 font-bold uppercase">FINAL_LEDGER</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[10px] uppercase font-mono bg-black/40 border border-slate-900 p-4 rounded">
                        <div className="space-y-2 border-r border-slate-950 pr-4">
                          <h3 className="text-purple-400 font-black font-orbitron text-xs mb-3">System Specifications</h3>
                          <div>
                            <span className="text-slate-500">World Name:</span> <span className="text-white font-bold">{name}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Description:</span> <p className="text-slate-400 text-[9px] font-sans font-medium lowercase tracking-normal leading-normal whitespace-pre-line mt-1">{description || 'No description provided'}</p>
                          </div>
                          <div className="pt-2">
                            <span className="text-slate-500">Entropy Seed:</span> <span className="text-cyan-400 font-bold font-mono">{seed}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Agent Swarm Count:</span> <span className="text-emerald-400 font-bold">{activeAgentsSum} Active</span>
                          </div>
                        </div>

                        <div className="space-y-2 pl-4">
                          <h3 className="text-purple-400 font-black font-orbitron text-xs mb-3">Parameters & Distributions</h3>
                          <div className="grid grid-cols-5 gap-1.5 text-center text-[8px] font-black border-b border-slate-900 pb-2">
                            {Object.entries(factionDistribution).map(([fac, val]) => (
                              <div key={fac} className="flex flex-col gap-0.5">
                                <span className="text-slate-500">{fac}</span>
                                <span className="text-white">{val}%</span>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-1.5 pt-2">
                            <div>
                              <span className="text-slate-500">Tick interval clock:</span> <span className="text-white">{tickSpeedSeconds}s</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Swarm limits:</span> <span className="text-white">{maxAgents} max</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Decay velocity:</span> <span className="text-white">{stabilityDecay.toFixed(1)}/tick</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Entropy bias index:</span> <span className="text-cyan-400 font-bold">{entropyBias.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Back / Next Navigation */}
            <div className="flex justify-between items-center border-t border-slate-900 pt-4 mt-6 select-none">
              <button
                onClick={() => setStep(prev => Math.max(1, prev - 1))}
                disabled={step === 1}
                className="px-4 py-2 border border-slate-800 bg-slate-950 text-slate-500 hover:text-white rounded text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <ArrowLeft size={12} /> Back
              </button>

              {step < 5 ? (
                <button
                  onClick={() => setStep(prev => Math.min(5, prev + 1))}
                  disabled={!canProceed()}
                  className="px-4 py-2 bg-purple-600 border border-purple-500 text-white rounded text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                >
                  Next <ArrowRight size={12} />
                </button>
              ) : (
                <button
                  onClick={handleLaunch}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black border border-emerald-400 rounded text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-pulse"
                >
                  <Play size={12} className="fill-black" /> Boot Simulation Swarm
                </button>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default function CreateWorldPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-slate-950 text-slate-100 font-mono flex items-center justify-center p-6 relative overflow-hidden">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-t-transparent border-purple-500 rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-purple-400 font-bold">Booting creation module...</p>
        </div>
      </main>
    }>
      <WorldCreatorWizardContent />
    </Suspense>
  );
}
