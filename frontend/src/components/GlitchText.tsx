"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface GlitchTextProps {
  text: string;
  className?: string;
  intensity?: 'low' | 'medium' | 'high';
}

export const GlitchText = ({ text, className = "", intensity = 'medium' }: GlitchTextProps) => {
  const intensities = {
    low: { duration: 0.5, spread: 2 },
    medium: { duration: 0.2, spread: 5 },
    high: { duration: 0.1, spread: 10 },
  };

  const { duration, spread } = intensities[intensity];

  const glitchVariants = {
    initial: { x: 0, opacity: 1 },
    animate: {
      x: [0, -spread, spread, -spread / 2, spread / 2, 0],
      opacity: [1, 0.8, 0.9, 0.7, 1],
      transition: {
        duration,
        repeat: Infinity,
        repeatType: "mirror" as const,
      }
    }
  };

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Main Text */}
      <span className="relative z-10">{text}</span>
      
      {/* RGB Split Layers */}
      <motion.span
        className="absolute top-0 left-0 text-red-500 opacity-70 z-0"
        animate={{
          x: [-spread, spread, -spread],
          y: [1, -1, 1],
          opacity: [0, 0.7, 0]
        }}
        transition={{ duration: duration * 1.5, repeat: Infinity }}
      >
        {text}
      </motion.span>
      
      <motion.span
        className="absolute top-0 left-0 text-cyan-400 opacity-70 z-0"
        animate={{
          x: [spread, -spread, spread],
          y: [-1, 1, -1],
          opacity: [0, 0.7, 0]
        }}
        transition={{ duration: duration * 1.2, repeat: Infinity }}
      >
        {text}
      </motion.span>

      {/* Slice Effect Overlay */}
      <motion.div
        className="absolute inset-0 bg-[#00FF41]/10 z-20 pointer-events-none"
        animate={{
          clipPath: [
            "inset(0% 0 100% 0)",
            "inset(50% 0 30% 0)",
            "inset(10% 0 85% 0)",
            "inset(0% 0 0% 0)"
          ],
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
};
