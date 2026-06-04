"use client";

import React from 'react';
import { useSimulationStore } from '@/store/simulationStore';
import { SimulationWorldMap } from '@/components/SimulationWorldMap';

export default function WorldMapPage() {
  const { 
    world, 
    userRole, 
    updateWorldParameter, 
    spawnAgent 
  } = useSimulationStore();

  return (
    <div className="flex-grow w-full h-full min-h-0 relative select-none">
      <SimulationWorldMap
        world={world}
        userRole={userRole}
        onParameterChange={updateWorldParameter}
        onSpawnAgent={spawnAgent}
      />
    </div>
  );
}
