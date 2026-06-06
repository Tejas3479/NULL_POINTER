"use client";

import { useState, useEffect, useCallback } from 'react';

interface CustomWindow extends Window {
  __GLOBAL_AUDIO_CTX__?: AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

export const useSpatialAudio = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ctx = (window as unknown as CustomWindow).__GLOBAL_AUDIO_CTX__;
      if (ctx && ctx.state === 'running') {
        // Defer to prevent calling state updates synchronously in effect mount phase
        Promise.resolve().then(() => setIsReady(true));
      }
    }
  }, []);

  const initAudio = useCallback(async () => {
    if (typeof window === 'undefined') return null;
    
    let ctx = (window as unknown as CustomWindow).__GLOBAL_AUDIO_CTX__;
    if (!ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as CustomWindow).webkitAudioContext;
      if (AudioCtxClass) {
        ctx = new AudioCtxClass();
        (window as unknown as CustomWindow).__GLOBAL_AUDIO_CTX__ = ctx;
      }
    }
    
    if (ctx) {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      setIsReady(true);
    }
    
    return ctx;
  }, []);

  const playBeep = useCallback((freq = 600, duration = 0.12, spatialPosition?: [number, number, number]) => {
    if (typeof window === 'undefined') return;
    const ctx = (window as unknown as CustomWindow).__GLOBAL_AUDIO_CTX__;
    if (!ctx || ctx.state !== 'running') return;

    try {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      
      gainNode.gain.setValueAtTime(0.04, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      if (spatialPosition) {
        const panner = ctx.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'exponential';
        panner.refDistance = 1;
        panner.maxDistance = 100;
        panner.rolloffFactor = 1.0;
        
        panner.positionX.setValueAtTime(spatialPosition[0], ctx.currentTime);
        panner.positionY.setValueAtTime(spatialPosition[1], ctx.currentTime);
        panner.positionZ.setValueAtTime(spatialPosition[2], ctx.currentTime);
        
        osc.connect(gainNode);
        gainNode.connect(panner);
        panner.connect(ctx.destination);
      } else {
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
      }
      
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn("Spatial Audio playback error", e);
    }
  }, []);

  return {
    isReady,
    initAudio,
    playBeep
  };
};
