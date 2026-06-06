"use client";

import React, { useState } from 'react';
import { ShieldAlert, Code, Globe, Cpu, Lock, Terminal } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mockRole, setMockRole] = useState<'admin' | 'developer' | 'viewer'>('developer');

  const handleOAuthLogin = (provider: 'github' | 'google') => {
    setLoading(true);
    setError(null);
    
    // Standard OAuth2 Redirect flows to Identity Providers
    const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || "github_client_id_placeholder";
    const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "google_client_id_placeholder";
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    
    if (provider === 'github') {
      window.location.href = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=user:email`;
    } else {
      const redirectUri = `${BACKEND_URL}/auth/callback/google`;
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile`;
    }
  };

  const handleMockLogin = async () => {
    setLoading(true);
    setError(null);
    
    const mockCodes = {
      admin: 'mock-admin-code',
      developer: 'mock-dev-code',
      viewer: 'mock-viewer-code',
    };

    try {
      const res = await fetch('http://localhost:8000/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: mockCodes[mockRole],
          provider: 'github', // provider is not used for mock codes
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Mock login failed');
      }

      // Store only session flag in sessionStorage per privacy regulations (never localStorage!)
      sessionStorage.setItem('is_authenticated', 'true');
      sessionStorage.setItem('user_role', data.role);
      sessionStorage.setItem('user_name', data.username);
      
      // Redirect cleanly to dashboard
      window.location.href = '/';
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage || 'Mock login failed. Verify backend is running.');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-mono flex items-center justify-center p-6 relative overflow-y-auto">
      {/* CRT Scanline & Noise Overlay */}
      <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_4px,4px_100%] opacity-40 mix-blend-overlay" />
      
      {/* Dynamic Glowing Background Grid */}
      <div className="absolute inset-0 opacity-5 pointer-events-none bg-[linear-gradient(to_right,#a855f7_1px,transparent_1px),linear-gradient(to_bottom,#06b6d4_1px,transparent_1px)] bg-[size:30px_30px]" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[480px] bg-slate-950/40 backdrop-blur-md border border-slate-900 rounded-lg p-8 relative z-10 shadow-[0_0_50px_rgba(168,85,247,0.15)]"
      >
        {/* Terminal Header Bar */}
        <div className="absolute top-0 inset-x-0 h-6 bg-purple-950/20 border-b border-purple-500/20 flex items-center px-4 justify-between">
          <span className="text-[9px] uppercase tracking-widest font-black text-slate-400">SSO_LOGIN_GATEWAY_V.1.0</span>
          <div className="flex gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          </div>
        </div>

        {/* Branding */}
        <div className="flex flex-col items-center gap-4 mt-4 mb-8">
          <div className="bg-purple-950/20 p-4 border border-purple-500/30 rounded-full shadow-[0_0_20px_rgba(168,85,247,0.2)]">
            <Cpu className="text-purple-400 animate-pulse" size={36} />
          </div>
          <div className="text-center">
            <h1 className="font-orbitron text-2xl font-black tracking-[0.15em] text-white">NULL_POINTER</h1>
            <p className="text-[10px] uppercase tracking-widest text-cyan-400/60 font-bold mt-1">SENTIENT_SIMULATION_AUTH</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-950/80 border border-red-500 text-red-200 p-3 rounded text-xs mb-6 flex items-start gap-2 italic">
            <ShieldAlert className="shrink-0 text-red-500 mt-0.5" size={14} />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-6">
          {/* Real SSO Auth Providers */}
          <div className="space-y-3">
            <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1">SSO Providers</div>
            <button
              onClick={() => handleOAuthLogin('github')}
              disabled={loading}
              className="w-full py-3 px-4 rounded border border-purple-500/20 bg-purple-950/20 hover:bg-purple-950/40 text-slate-200 hover:text-white font-orbitron text-xs font-bold uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Code size={14} className="text-purple-400" />
              Sign In With GitHub
            </button>
            <button
              onClick={() => handleOAuthLogin('google')}
              disabled={loading}
              className="w-full py-3 px-4 rounded border border-cyan-500/20 bg-cyan-950/20 hover:bg-cyan-950/40 text-slate-200 hover:text-white font-orbitron text-xs font-bold uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Globe size={14} className="text-cyan-400" />
              Sign In With Google
            </button>
          </div>

          {/* Dev/Local Mock Authentication Panel */}
          <div className="border-t border-slate-900 pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-1">
                <Terminal size={10} className="text-purple-400" />
                Local Sandbox Emulator Auth
              </span>
              <span className="text-[8px] bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold px-1.5 py-0.5 rounded tracking-wide font-mono">
                DEV_MODE
              </span>
            </div>
            
            <div className="space-y-2">
              <label className="block text-[10px] text-slate-400 mb-1">SELECT SECURITY ACCESS ROLE:</label>
              <select
                value={mockRole}
                onChange={(e) => setMockRole(e.target.value as 'admin' | 'developer' | 'viewer')}
                className="w-full bg-slate-950 border border-slate-900 text-slate-200 font-mono text-xs p-3 rounded outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="admin">ADMINISTRATOR (Full Integrity & God Mode Access)</option>
                <option value="developer">DEVELOPER (Simulation Run & Debug Access)</option>
                <option value="viewer">VIEWER (Read-Only Observation Access)</option>
              </select>
            </div>

            <button
              onClick={handleMockLogin}
              disabled={loading}
              className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-orbitron text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(168,85,247,0.3)] disabled:opacity-50"
            >
              <Lock size={12} />
              ACQUIRE LOCAL AUTH LICENSE
            </button>
          </div>
        </div>

        {/* Security Warning Footer */}
        <div className="text-[8px] text-slate-600 uppercase text-center mt-8 tracking-wider">
          * Strictly Monitored Quantum Defense Gateway *
        </div>
      </motion.div>
    </main>
  );
}
