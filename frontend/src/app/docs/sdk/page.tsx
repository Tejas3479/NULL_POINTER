"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

// --- Scroll Driven 3D Rig Component ---

function DocsVisual({ scrollPercent }: { scrollPercent: number }) {
  const { camera } = useThree();
  const centralRef = useRef<THREE.Mesh>(null);
  const clientRef = useRef<THREE.Mesh>(null);
  const streamRef = useRef<THREE.Points>(null);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    if (centralRef.current) {
      centralRef.current.rotation.y = time * 0.4;
      centralRef.current.rotation.x = time * 0.25;
    }

    if (clientRef.current) {
      clientRef.current.position.x = Math.cos(time * 0.6) * 1.8;
      clientRef.current.position.z = Math.sin(time * 0.6) * 1.8;
      clientRef.current.rotation.y = -time * 0.8;
    }

    // Default keyframe camera coordinates
    const targetPos = new THREE.Vector3(3.2, 2.5, 6.0);
    const targetLookAt = new THREE.Vector3(0, 0.4, 0);

    if (scrollPercent < 0.35) {
      const t = scrollPercent / 0.35;
      targetPos.lerpVectors(new THREE.Vector3(3.2, 2.5, 6.0), new THREE.Vector3(-2.2, 3.0, 5.0), t);
      targetLookAt.lerpVectors(new THREE.Vector3(0, 0.4, 0), new THREE.Vector3(0, 0.6, 0), t);
    } else if (scrollPercent < 0.7) {
      const t = (scrollPercent - 0.35) / 0.35;
      const clientPos = clientRef.current 
        ? new THREE.Vector3(clientRef.current.position.x, 0.4, clientRef.current.position.z)
        : new THREE.Vector3(1.5, 0.4, 0);
      
      const zoomPos = clientPos.clone().add(new THREE.Vector3(0.8, 0.7, 1.2));
      targetPos.lerpVectors(new THREE.Vector3(-2.2, 3.0, 5.0), zoomPos, t);
      targetLookAt.lerpVectors(new THREE.Vector3(0, 0.6, 0), clientPos, t);
    } else {
      const t = (scrollPercent - 0.7) / 0.3;
      targetPos.lerpVectors(targetPos.clone(), new THREE.Vector3(0.0, 1.6, 4.2), t);
      targetLookAt.lerpVectors(targetLookAt.clone(), new THREE.Vector3(0, 0.3, 0), t);
    }

    camera.position.lerp(targetPos, 0.08);
    camera.lookAt(targetLookAt);
  });

  const [particlePositions] = useMemo(() => {
    const count = 300;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = 0;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = 0;
    }
    return [pos];
  }, []);

  useFrame((state) => {
    if (streamRef.current && clientRef.current) {
      const geo = streamRef.current.geometry;
      const posAttr = geo.attributes.position as THREE.BufferAttribute;
      const time = state.clock.getElapsedTime();

      for (let i = 0; i < posAttr.count; i++) {
        const progress = ((time * 0.35 + i / posAttr.count) % 1.0);
        const clientPos = clientRef.current.position;
        const startPos = new THREE.Vector3(0, 0.5, 0);
        const endPos = new THREE.Vector3(clientPos.x, 0.4, clientPos.z);
        const currentPos = new THREE.Vector3().lerpVectors(startPos, endPos, progress);
        currentPos.y += Math.sin(time * 5.0 + i) * 0.04;
        
        posAttr.setXYZ(i, currentPos.x, currentPos.y, currentPos.z);
      }
      posAttr.needsUpdate = true;
    }
  });

  return (
    <group>
      <mesh ref={centralRef} position={[0, 0.5, 0]}>
        <dodecahedronGeometry args={[0.55]} />
        <meshStandardMaterial color="#c084fc" emissive="#c084fc" emissiveIntensity={1.4} wireframe />
      </mesh>

      <mesh ref={clientRef} position={[1.8, 0.4, 0]}>
        <octahedronGeometry args={[0.22]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.5} />
      </mesh>

      <gridHelper args={[6, 16, '#c084fc', '#090d16']} position={[0, -0.4, 0]} />

      <points ref={streamRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[particlePositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#38bdf8"
          size={0.035}
          transparent
          opacity={0.8}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

// --- SDK Reference Documentation Page ---

export default function SdkDocsPage() {
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedInit, setCopiedInit] = useState(false);
  const [copiedConnect, setCopiedConnect] = useState(false);

  // Scroll Tracking state
  const [scrollPercent, setScrollPercent] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const totalScroll = scrollHeight - clientHeight;
      setScrollPercent(totalScroll > 0 ? scrollTop / totalScroll : 0);
    }
  };

  useEffect(() => {
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
    <main className="h-screen bg-black text-slate-100 font-mono relative overflow-hidden flex flex-col">
      <Script src="https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js" strategy="lazyOnload" />
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
          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 border border-purple-500/30 text-white rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer font-orbitron"
        >
          Active Swarm Console
        </Link>
      </header>

      {/* Content Area with Split Layout */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-grow overflow-y-auto relative z-10 custom-scrollbar select-none pb-16"
      >
        <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start py-8">
          
          {/* Left Column: Documentation Text */}
          <div className="space-y-8">
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

          {/* Right Column: Sticky 3D WebGL Canvas */}
          <div className="hidden lg:block h-[calc(100vh-140px)] sticky top-4 self-start border border-slate-900 bg-slate-950/20 rounded-lg overflow-hidden">
            <Canvas camera={{ position: [3.2, 2.5, 6.0], fov: 45 }} style={{ background: 'transparent' }}>
              <ambientLight intensity={0.65} />
              <pointLight position={[3, 10, 3]} intensity={1.6} />
              
              <DocsVisual scrollPercent={scrollPercent} />
              
              <EffectComposer>
                <Bloom luminanceThreshold={0.12} intensity={1.3} />
              </EffectComposer>
            </Canvas>
          </div>

        </div>
      </div>
    </main>
  );
}
