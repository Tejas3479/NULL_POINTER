"use client";

import React, { useEffect, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSimulationStore } from '@/store/simulationStore';
import { GlitchText } from '@/components/GlitchText';
import { 
  Activity, 
  Map, 
  RadioTower, 
  Users, 
  Sliders, 
  Flame, 
  Shield, 
  Cpu, 
  LogOut, 
  Menu, 
  X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '1';
  const match = document.cookie.match(new RegExp('(^| )csrf_token=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : '1';
};

export default function SimulationLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const id = params.id as string;

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Bind store values
  const { 
    heat, 
    stability, 
    isConnected, 
    presenceList, 
    username, 
    userRole, 
    initSocket,
    setUsername,
    setUserRole
  } = useSimulationStore();

  // 1. Auth check globally for layout
  useEffect(() => {
    fetch('http://localhost:8000/auth/me', { 
      credentials: 'include' 
    })
      .then((res) => {
        if (!res.ok) throw new Error('Unauthorized');
        return res.json();
      })
      .then((data) => {
        setUsername(data.username);
        setUserRole(data.role);
        setLoadingAuth(false);
      })
      .catch(() => {
        sessionStorage.removeItem('is_authenticated');
        router.push('/login');
      });
  }, [router, setUsername, setUserRole]);

  // 2. Initialize WebSocket once when id is ready (persists across page transitions)
  useEffect(() => {
    if (!id || loadingAuth) return;
    const cleanup = initSocket(id);
    return () => cleanup();
  }, [id, initSocket, loadingAuth]);

  const handleLogout = async () => {
    await fetch('http://localhost:8000/auth/logout', { 
      method: 'POST', 
      credentials: 'include',
      headers: { 'X-CSRF-Token': getCsrfToken() }
    });
    sessionStorage.clear();
    router.push('/login');
  };

  const navLinks = [
    { label: 'Dashboard', path: `/sim/${id}`, icon: <Activity size={18} /> },
    { label: 'World Map', path: `/sim/${id}/map`, icon: <Map size={18} /> },
    { label: 'Chronicle', path: `/sim/${id}/chronicle`, icon: <RadioTower size={18} /> },
    { label: 'Agents', path: `/sim/${id}/agents`, icon: <Users size={18} /> },
    { label: 'Settings', path: `/sim/${id}/settings`, icon: <Sliders size={18} /> },
  ];

  if (loadingAuth) {
    return (
      <main className="min-h-screen bg-black text-[#00FF41] font-mono flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-40 mix-blend-overlay" />
        <div className="text-center space-y-4 relative z-10">
          <div className="w-8 h-8 border-2 border-t-transparent border-[#00FF41] rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-[#00FF41]/60 font-bold">Verifying quantum defense authorization keys...</p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen max-h-screen flex flex-col md:flex-row bg-black text-slate-100 font-mono overflow-hidden relative">
      {/* CRT Scanline Scanline Effects */}
      <div className="absolute inset-0 pointer-events-none z-40 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-20 mix-blend-overlay" />

      {/* MOBILE HEADER BAR */}
      <header className="flex md:hidden h-14 bg-slate-950/90 border-b border-slate-900 px-4 items-center justify-between z-30 select-none">
        <div className="flex items-center gap-2">
          <Cpu className="text-blue-400" size={20} />
          <span className="font-orbitron font-black text-sm tracking-tighter text-white">NULL_POINTER</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-slate-400 hover:text-white p-1 cursor-pointer transition-colors"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* MOBILE MENU DRAWER (Slide down/fade overlay) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 top-14 bg-black/95 z-30 flex flex-col p-6 border-b border-slate-900 md:hidden"
          >
            <div className="flex flex-col gap-4 mb-6">
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold border-b border-slate-900 pb-2">OPERATOR: {username}</span>
              <div className="flex justify-between items-center text-[10px] uppercase font-mono">
                <span className="text-slate-400 font-bold">INTEGRITY:</span>
                <span className={stability < 40 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}>{stability}%</span>
              </div>
              <div className="flex justify-between items-center text-[10px] uppercase font-mono">
                <span className="text-slate-400 font-bold">HEAT:</span>
                <span className={heat > 70 ? 'text-red-500 animate-ping' : 'text-orange-400'}>{heat.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center text-[10px] uppercase font-mono">
                <span className="text-slate-400 font-bold">PRESENCE:</span>
                <span className="text-cyan-400">{presenceList.length} Online</span>
              </div>
            </div>

            <nav className="flex flex-col gap-2.5 mb-auto">
              {navLinks.map((link) => {
                const isActive = pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    href={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded border font-bold text-xs uppercase transition-all duration-300 ${
                      isActive 
                        ? 'border-purple-500/50 bg-purple-950/20 text-white' 
                        : 'border-slate-900 bg-slate-950/40 text-slate-400 hover:border-slate-800'
                    }`}
                  >
                    {link.icon}
                    <GlitchText text={link.label} intensity="low" />
                  </Link>
                );
              })}
            </nav>

            <button 
              onClick={handleLogout}
              className="mt-6 w-full py-3 border border-red-500/30 hover:border-red-500 text-red-500 hover:bg-red-500/10 text-xs font-bold uppercase rounded cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={16} />
              LOGOUT TERMINAL
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex md:w-64 xl:w-72 bg-slate-950/50 border-r border-slate-900 flex-col p-6 select-none justify-between h-full min-h-0 z-10 shrink-0">
        <div className="flex flex-col gap-6 min-h-0 overflow-y-auto custom-scrollbar pr-1">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/20 p-1.5 rounded border border-blue-500/30">
              <Cpu className="text-blue-400" size={20} />
            </div>
            <div>
              <h1 className="font-orbitron text-md font-black tracking-tighter text-white">NULL_POINTER</h1>
              <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">
                {isConnected ? 'LIVE_SYSTEM_ACTIVE' : 'SYSTEM_OFFLINE'}
              </p>
            </div>
          </div>

          {/* Stats widget */}
          <div className="glass p-4 rounded border border-slate-900 bg-black/40 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-[9px] uppercase text-slate-500 font-bold">
                <span className="flex items-center gap-1"><Shield size={12} /> System Integrity</span>
                <span className={stability < 40 ? 'text-red-500' : 'text-emerald-400'}>{stability}%</span>
              </div>
              <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <motion.div 
                  className={`h-full ${stability < 40 ? 'bg-red-500' : 'bg-emerald-500'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${stability}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-[9px] uppercase text-slate-500 font-bold">
                <span className="flex items-center gap-1"><Flame size={12} /> Timeline Heat</span>
                <span className={heat > 70 ? 'text-red-400' : 'text-orange-400'}>{heat.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <motion.div 
                  className={`h-full ${heat > 80 ? 'bg-red-500' : heat > 50 ? 'bg-orange-500' : 'bg-blue-500'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${heat}%` }}
                />
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex flex-col gap-2">
            {navLinks.map((link) => {
              const isActive = pathname === link.path;
              return (
                <Link
                  key={link.path}
                  href={link.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded border text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                    isActive 
                      ? 'border-purple-500 bg-purple-950/20 text-white shadow-[0_0_15px_rgba(168,85,247,0.15)]' 
                      : 'border-transparent text-slate-400 hover:border-slate-800 hover:text-slate-200 hover:bg-slate-900/30'
                  }`}
                >
                  <span className={isActive ? 'text-purple-400' : 'text-slate-500'}>{link.icon}</span>
                  <GlitchText text={link.label} intensity="low" />
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer info & Logout */}
        <div className="flex flex-col gap-4 border-t border-slate-900 pt-4 mt-4">
          <div className="text-left text-[9px] font-mono leading-relaxed">
            <span className="text-slate-500 uppercase tracking-widest block font-bold">OPERATOR PROFILE</span>
            <span className="text-slate-300 font-bold block truncate">{username}</span>
            <span className={`uppercase font-black font-orbitron tracking-wider ${userRole === 'admin' ? 'text-red-500' : 'text-amber-500'}`}>
              ROLE: {userRole}
            </span>
          </div>

          <button 
            onClick={handleLogout}
            className="w-full py-2 border border-red-500/30 hover:border-red-500 text-red-500 hover:bg-red-500/10 text-[9px] uppercase tracking-wider font-orbitron font-bold rounded cursor-pointer transition-all duration-300 flex items-center justify-center gap-1.5"
          >
            <LogOut size={12} />
            DISCONNECT TERMINAL
          </button>
        </div>
      </aside>

      {/* MOBILE BOTTOM TAB BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-slate-950 border-t border-slate-900 flex justify-around items-center z-30 select-none pb-safe">
        {navLinks.map((link) => {
          const isActive = pathname === link.path;
          return (
            <Link
              key={link.path}
              href={link.path}
              className={`flex flex-col items-center gap-1 text-center py-1 transition-all ${
                isActive ? 'text-purple-400' : 'text-slate-500'
              }`}
            >
              {link.icon}
              <span className="text-[8px] font-bold uppercase tracking-widest leading-none font-orbitron">
                {link.label.split(' ')[0]}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* MAIN CONTENT PANELS (Scrollable, Animating transitions) */}
      <main className="flex-grow flex flex-col min-w-0 overflow-hidden pb-14 md:pb-0 h-full relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            className="flex-grow flex flex-col h-full min-h-0"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
