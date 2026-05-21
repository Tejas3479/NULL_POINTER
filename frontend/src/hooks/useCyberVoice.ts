"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

export const useCyberVoice = () => {
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const s = window.speechSynthesis;
      synthRef.current = s;
      
      const updateVoices = () => {
        setVoices(s.getVoices());
      };

      s.onvoiceschanged = updateVoices;
      const timer = window.setTimeout(updateVoices, 0);
      return () => {
        window.clearTimeout(timer);
        s.onvoiceschanged = null;
      };
    }
  }, []);

  const speak = useCallback((text: string, options: { pitch?: number, rate?: number } = {}) => {
    const synth = synthRef.current;
    if (!synth) return;

    // Cancel any ongoing speech
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Attempt to find a robotic/mechanical voice
    const roboticVoice = voices.find(v => 
      v.name.includes('Google') || 
      v.name.includes('Microsoft') || 
      v.name.toLowerCase().includes('robot')
    ) || voices[0];

    if (roboticVoice) {
      utterance.voice = roboticVoice;
    }

    // Apply Cyber-Synth parameters
    utterance.pitch = options.pitch ?? 0.5; // Deep, synthetic tone
    utterance.rate = options.rate ?? 0.85; // Deliberate, mechanical cadence
    utterance.volume = 0.8;

    synth.speak(utterance);
  }, [voices]);

  return { speak };
};
