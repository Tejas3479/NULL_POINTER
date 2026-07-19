"use client";

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial, Line, Float } from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import * as THREE from 'three';

const seededUnit = (seed: number) => {
  const value = Math.sin(seed * 9301 + 49297) * 233280;
  return value - Math.floor(value);
};

const NeuralNodes = ({ count = 200, isAttacked = false, variant = 'sidebar' }: { count?: number; isAttacked?: boolean; variant?: 'sidebar' | 'background' }) => {
  const points = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (seededUnit(i + 1) - 0.5) * 10;
      p[i * 3 + 1] = (seededUnit(i + 2) - 0.5) * 10;
      p[i * 3 + 2] = (seededUnit(i + 3) - 0.5) * 10;
    }
    return p;
  }, [count]);

  const lines = useMemo(
    () => Array.from({ length: 20 }, (_, i) => ({
      id: i,
      points: [
        [seededUnit(i * 6 + 1) * 5 - 2.5, seededUnit(i * 6 + 2) * 5 - 2.5, seededUnit(i * 6 + 3) * 5 - 2.5],
        [seededUnit(i * 6 + 4) * 5 - 2.5, seededUnit(i * 6 + 5) * 5 - 2.5, seededUnit(i * 6 + 6) * 5 - 2.5],
      ] as [number, number, number][],
    })),
    []
  );

  const ref = useRef<THREE.Points>(null!);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const speed = isAttacked ? 0.5 : 0.05;
    ref.current.rotation.y = time * speed;
    ref.current.rotation.x = time * (speed * 0.4);
    
    if (isAttacked) {
       ref.current.scale.setScalar(1 + Math.sin(time * 10) * 0.1);
     } else {
       ref.current.scale.setScalar(1);
     }
  });

  // Theme-compliant colors (Cyan/Purple theme)
  const nodeColor = isAttacked ? "#ef4444" : variant === 'background' ? "#06b6d4" : "#a855f7";
  const lineColor = isAttacked ? "#ef4444" : variant === 'background' ? "#a855f7" : "#06b6d4";

  return (
    <group>
      <Points ref={ref} positions={points} stride={3} frustumCulled={false}>
        <PointMaterial
          transparent
          color={nodeColor}
          size={0.05}
          sizeAttenuation={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Points>
      
      {/* Interconnecting lines */}
      {lines.map((line) => (
        <Line
          key={line.id}
          points={line.points}
          color={lineColor}
          lineWidth={0.5}
          transparent
          opacity={0.2}
        />
      ))}
    </group>
  );
};

export const NeuralNet = ({ 
  isAttacked = false, 
  variant = 'sidebar', 
  className = '' 
}: { 
  isAttacked?: boolean; 
  variant?: 'sidebar' | 'background'; 
  className?: string;
}) => {
  if (variant === 'background') {
    return (
      <div className={`absolute inset-0 pointer-events-none select-none z-0 ${className}`}>
        <Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />
          
          <Float speed={1} rotationIntensity={0.3} floatIntensity={0.3}>
            <NeuralNodes isAttacked={isAttacked} variant={variant} />
          </Float>

          <EffectComposer>
            <Bloom luminanceThreshold={0.1} luminanceSmoothing={0.9} height={300} intensity={0.8} />
          </EffectComposer>
        </Canvas>
      </div>
    );
  }

  return (
    <div className={`w-full h-full min-h-[200px] bg-black/40 rounded-lg border border-purple-500/20 overflow-hidden relative ${className}`}>
      <div className="absolute top-2 left-3 z-10">
        <span className="text-[10px] font-black text-purple-400/60 uppercase tracking-[0.3em]">Neural_Web::Active</span>
      </div>
      
      <Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
        <color attach="background" args={['#000']} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        
        <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
          <NeuralNodes isAttacked={isAttacked} variant={variant} />
        </Float>

        <EffectComposer>
          <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} height={300} />
        </EffectComposer>
      </Canvas>
    </div>
  );
};
