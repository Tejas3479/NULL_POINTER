"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    fetch('http://localhost:8000/auth/me', { 
      credentials: 'include' 
    })
      .then((res) => {
        if (!res.ok) throw new Error('Unauthorized');
        router.replace('/sim/local-null-pointer');
      })
      .catch(() => {
        sessionStorage.removeItem('is_authenticated');
        router.replace('/login');
      });
  }, [router]);

  return (
    <main className="min-h-screen bg-black text-[#00FF41] font-mono flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-40 mix-blend-overlay" />
      <div className="text-center space-y-4 relative z-10">
        <div className="w-8 h-8 border-2 border-t-transparent border-[#00FF41] rounded-full animate-spin mx-auto" />
        <p className="text-xs uppercase tracking-widest text-[#00FF41]/60 font-bold">Initializing operators console routing...</p>
      </div>
    </main>
  );
}
