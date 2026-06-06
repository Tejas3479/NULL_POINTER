"use client";

import React, { useState, useEffect, useRef } from 'react';

export const ResizableLayout = ({
  left,
  right,
  defaultLeftPercentage = 60,
  minLeftPercentage = 25,
  maxLeftPercentage = 75,
  leftClassName = '',
  rightClassName = '',
  className = '',
  breakpoint = 'lg'
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftPercentage?: number;
  minLeftPercentage?: number;
  maxLeftPercentage?: number;
  leftClassName?: string;
  rightClassName?: string;
  className?: string;
  breakpoint?: 'md' | 'lg' | 'xl';
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPercentage, setLeftPercentage] = useState(defaultLeftPercentage);
  const [isDragging, setIsDragging] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  // Check screen width for responsiveness
  useEffect(() => {
    const checkWidth = () => {
      const width = window.innerWidth;
      const bpValue = breakpoint === 'md' ? 768 : breakpoint === 'lg' ? 1024 : 1280;
      setIsDesktop(width >= bpValue);
    };

    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, [breakpoint]);

  useEffect(() => {
    if (!isDragging || !isDesktop) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newPercentage = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPercentage(Math.min(Math.max(newPercentage, minLeftPercentage), maxLeftPercentage));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isDesktop, minLeftPercentage, maxLeftPercentage]);

  if (!isDesktop) {
    return (
      <div className={`flex flex-col gap-6 ${className}`}>
        <div className={leftClassName}>{left}</div>
        <div className={rightClassName}>{right}</div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className={`flex h-full w-full min-h-0 overflow-hidden relative select-none ${className}`}
      style={{ cursor: isDragging ? 'col-resize' : 'default' }}
    >
      <div 
        className={`h-full overflow-hidden flex flex-col ${leftClassName}`}
        style={{ width: `${leftPercentage}%` }}
      >
        {left}
      </div>

      {/* Resize Handle Splitter Line */}
      <div 
        onMouseDown={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        className="group relative w-2 h-full cursor-col-resize flex-shrink-0 flex items-center justify-center transition-colors select-none z-20"
      >
        {/* Subtle glowing center line */}
        <div className={`w-[1px] h-full transition-colors duration-200 ${
          isDragging 
            ? 'bg-purple-500 shadow-[0_0_8px_#a855f7]' 
            : 'bg-slate-900 group-hover:bg-purple-500/80 group-hover:shadow-[0_0_6px_rgba(168,85,247,0.5)]'
        }`} />
        
        {/* Drag handle handle dots / icon */}
        <div className={`absolute top-1/2 -translate-y-1/2 w-1.5 h-6 rounded flex flex-col justify-between items-center py-1 border border-slate-800 bg-slate-950 transition-all duration-200 ${
          isDragging 
            ? 'border-purple-500 opacity-100 scale-110 shadow-[0_0_8px_rgba(168,85,247,0.6)]' 
            : 'opacity-0 group-hover:opacity-100'
        }`}>
          <div className="w-[2px] h-[2px] rounded-full bg-slate-500" />
          <div className="w-[2px] h-[2px] rounded-full bg-slate-500" />
          <div className="w-[2px] h-[2px] rounded-full bg-slate-500" />
        </div>
      </div>

      <div 
        className={`h-full overflow-hidden flex flex-col min-w-0 flex-grow ${rightClassName}`}
      >
        {right}
      </div>
    </div>
  );
};
