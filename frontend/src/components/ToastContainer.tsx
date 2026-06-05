"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSimulationStore } from "@/store/simulationStore";
import { CheckCircle, AlertCircle, XCircle, Info, X } from "lucide-react";

export const ToastContainer = () => {
  const { toasts, removeToast } = useSimulationStore();

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="text-emerald-400 shrink-0" size={16} />;
      case "error":
        return <XCircle className="text-red-400 shrink-0" size={16} />;
      case "warning":
        return <AlertCircle className="text-amber-400 shrink-0" size={16} />;
      default:
        return <Info className="text-cyan-400 shrink-0" size={16} />;
    }
  };

  const getBorderColor = (type: string) => {
    switch (type) {
      case "success":
        return "border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]";
      case "error":
        return "border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]";
      case "warning":
        return "border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]";
      default:
        return "border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)]";
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none select-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 50, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9, transition: { duration: 0.2 } }}
            className={`pointer-events-auto flex gap-3 p-3.5 bg-black/85 border backdrop-blur-md rounded border-slate-900 ${getBorderColor(
              toast.type
            )}`}
          >
            {getIcon(toast.type)}
            
            <div className="flex-grow flex flex-col gap-0.5 font-mono text-xs">
              <span className="font-bold text-slate-200 uppercase tracking-wide text-[10px]">
                {toast.title}
              </span>
              <span className="text-slate-400 text-[9px] leading-normal font-sans">
                {toast.message}
              </span>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-500 hover:text-slate-200 transition-all cursor-pointer shrink-0 h-fit"
            >
              <X size={12} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
