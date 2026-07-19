"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSimulationStore } from '@/store/simulationStore';
import { getBackendUrl } from '@/config';
import { 
  Sliders, 
  Share2, 
  Database, 
  Activity, 
  Copy, 
  Check, 
  GitBranch, 
  AlertTriangle,
  RefreshCw,
  Trash2,
  GitFork
} from 'lucide-react';

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '1';
  const match = document.cookie.match(new RegExp('(^| )csrf_token=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : '1';
};

export default function SettingsPage() {
  const router = useRouter();
  const { 
    world, 
    userRole, 
    updateWorldParameter, 
    resetSimulation, 
    injectEntropy 
  } = useSimulationStore();

  const [sharing, setSharing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedBadge, setCopiedBadge] = useState(false);
  const [copiedSdk, setCopiedSdk] = useState(false);
  const [seedCounts, setSeedCounts] = useState<Record<string, number>>({});
  const [saveParameterSuccess, setSaveParameterSuccess] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [savingWebhook, setSavingWebhook] = useState(false);

  // Snapshots State
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);

  const fetchSnapshots = async () => {
    try {
      const res = await fetch(`${getBackendUrl()}/v1/simulation/snapshots`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSnapshots(data);
      }
    } catch (err) {
      console.error("Failed to load snapshots", err);
    }
  };

  const handleCreateSnapshot = async () => {
    setLoadingSnapshots(true);
    try {
      const res = await fetch(`${getBackendUrl()}/v1/simulation/snapshot`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken()
        }
      });
      if (res.ok) {
        await fetchSnapshots();
      }
    } catch (err) {
      console.error("Failed to create snapshot", err);
    } finally {
      setLoadingSnapshots(false);
    }
  };

  const handleRestoreSnapshot = async (id: string) => {
    setLoadingSnapshots(true);
    try {
      const res = await fetch(`${getBackendUrl()}/v1/simulation/snapshot/${id}/restore`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken()
        }
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (err) {
      console.error("Failed to restore snapshot", err);
    } finally {
      setLoadingSnapshots(false);
    }
  };

  const handleForkSnapshot = async (id: string) => {
    setLoadingSnapshots(true);
    try {
      const res = await fetch(`${getBackendUrl()}/v1/simulation/snapshot/${id}/fork`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken()
        }
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/sim/${data.world_id}`);
      }
    } catch (err) {
      console.error("Failed to fork snapshot", err);
    } finally {
      setLoadingSnapshots(false);
    }
  };

  useEffect(() => {
    fetchSnapshots();
  }, [world?.world_id]);

  // Initialize seed counts from world archetypes if available
  useEffect(() => {
    if (world?.agent_archetypes) {
      const counts: Record<string, number> = {};
      world.agent_archetypes.forEach(arch => {
        counts[arch.id] = 0;
      });
      Promise.resolve().then(() => setSeedCounts(counts));
    }
    if (world?.share) {
      const discordWebhook = world.share.discord_webhook || "";
      Promise.resolve().then(() => setWebhookUrl(discordWebhook));
    }
  }, [world]);

  const toggleShare = async () => {
    if (!world) return;
    setSharing(true);
    try {
      const isCurrentlyPublic = !!world.share?.public;
      const res = await fetch(`${getBackendUrl()}/v1/simulation/share`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken()
        },
        body: JSON.stringify({
          public: !isCurrentlyPublic,
          remixable: false,
          discord_webhook: webhookUrl
        })
      });
      if (res.ok) {
        // Layout WS sync updates the Zustand store automatically!
      }
    } catch (err) {
      console.error("Failed to update share settings", err);
    } finally {
      setSharing(false);
    }
  };

  const saveWebhook = async () => {
    if (!world) return;
    setSavingWebhook(true);
    try {
      const res = await fetch(`${getBackendUrl()}/v1/simulation/share`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken()
        },
        body: JSON.stringify({
          public: !!world.share?.public,
          remixable: !!world.share?.remixable,
          discord_webhook: webhookUrl
        })
      });
      if (res.ok) {
        // Success
      }
    } catch (err) {
      console.error("Failed to update share settings with webhook", err);
    } finally {
      setSavingWebhook(false);
    }
  };

  const handleCopyLink = () => {
    if (!world) return;
    const shareUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/spectate/${world.world_id}` 
      : `http://localhost:3000/spectate/${world.world_id}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyBadge = () => {
    if (!world) return;
    const badgeMarkdown = `![Simulation Badge](${getBackendUrl()}/v1/simulation/${world.world_id}/badge.svg)`;
    navigator.clipboard.writeText(badgeMarkdown);
    setCopiedBadge(true);
    setTimeout(() => setCopiedBadge(false), 2000);
  };

  const handleCopySdkCode = () => {
    if (!world) return;
    const sdkCode = `<script src="http://localhost:3000/nullpointer-sdk.js"></script>\n<div id="np-badge"></div>\n<script>\n  window.onload = function() {\n    NP.init('${world.world_id}', 'np-badge');\n  };\n</script>`;
    navigator.clipboard.writeText(sdkCode);
    setCopiedSdk(true);
    setTimeout(() => setCopiedSdk(false), 2000);
  };

  const handleSliderChange = async (key: string, value: number) => {
    try {
      await updateWorldParameter(key, value);
      setSaveParameterSuccess(key);
      setTimeout(() => setSaveParameterSuccess(null), 1500);
    } catch (e) {
      console.error("Parameter update failed", e);
    }
  };

  if (!world) {
    return (
      <div className="flex flex-col items-center justify-center flex-grow py-24 gap-4">
        <div className="w-8 h-8 border-2 border-t-transparent border-purple-500 rounded-full animate-spin" />
        <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Connecting settings console...</p>
      </div>
    );
  }

  return (
    <div className="flex-grow p-6 overflow-y-auto select-none font-mono pb-12">
      <div className="max-w-[1200px] mx-auto flex flex-col gap-6">
        
        {/* Header Title */}
        <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
          <Sliders className="text-purple-400" size={18} />
          <h1 className="font-orbitron text-md font-black uppercase tracking-widest text-white">System Config & Settings</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Timeline Control & World Builder */}
          <div className="flex flex-col gap-6">
            
            {/* World Parameters */}
            <div className="glass p-5 rounded border border-slate-800 bg-slate-950/40 flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
                <Sliders className="text-blue-400" size={16} />
                <h2 className="font-orbitron text-xs font-bold uppercase tracking-widest text-white">World Parameter Overrides</h2>
              </div>

              <div className="space-y-4">
                {Object.entries(world.parameters || {}).map(([key, val]) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-[10px] uppercase font-mono">
                      <span className="text-slate-400 font-bold">{key.replace(/_/g, ' ')}</span>
                      <div className="flex items-center gap-1.5">
                        {saveParameterSuccess === key && (
                          <span className="text-emerald-400 text-[8px] animate-pulse">SAVED</span>
                        )}
                        <span className="text-cyan-400 font-bold">{val}</span>
                      </div>
                    </div>
                    
                    <input 
                      type="range"
                      min="0"
                      max={val <= 1.0 ? "1" : "100"}
                      step={val <= 1.0 ? "0.01" : "1"}
                      value={val}
                      onChange={(e) => handleSliderChange(key, parseFloat(e.target.value))}
                      disabled={userRole !== 'admin'}
                      className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-purple-500 disabled:opacity-50"
                    />
                  </div>
                ))}

                {userRole !== 'admin' && (
                  <p className="text-[8px] text-amber-500 uppercase flex items-center gap-1 mt-2">
                    <AlertTriangle size={10} /> Read-only mode. Administrator privileges required to push overrides.
                  </p>
                )}
              </div>
            </div>

            {/* Timeline Operations */}
            <div className="glass p-5 rounded border border-slate-800 bg-slate-950/40 flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
                <Activity className="text-cyan-400" size={16} />
                <h2 className="font-orbitron text-xs font-bold uppercase tracking-widest text-white">Timeline Defenses</h2>
              </div>
              
              <p className="text-[9px] uppercase tracking-wider text-slate-500 leading-normal">
                Trigger manual actions on the active timeline loop.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button 
                  onClick={() => resetSimulation()}
                  className="py-2.5 bg-cyan-950/10 hover:bg-cyan-950/25 border border-cyan-500/30 text-cyan-400 text-[9px] font-black uppercase tracking-wider rounded transition-all cursor-pointer"
                >
                  Init Loop
                </button>
                <button 
                  onClick={injectEntropy}
                  className="py-2.5 bg-amber-950/10 hover:bg-amber-950/25 border border-amber-500/30 text-amber-400 text-[9px] font-black uppercase tracking-wider rounded transition-all cursor-pointer"
                >
                  Inject Entropy
                </button>
                <button 
                  onClick={() => resetSimulation()}
                  className="py-2.5 bg-red-950/10 hover:bg-red-950/25 border border-red-500/30 text-red-500 text-[9px] font-black uppercase tracking-wider rounded transition-all cursor-pointer"
                >
                  Hard Reset
                </button>
              </div>
            </div>

            {/* Snapshot Management */}
            <div className="glass p-5 rounded border border-slate-800 bg-slate-950/40 flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
                <Database className="text-yellow-500" size={16} />
                <h2 className="font-orbitron text-xs font-bold uppercase tracking-widest text-white">Snapshots Database</h2>
              </div>
              
              <div className="flex flex-col gap-2">
                <p className="text-[9px] uppercase tracking-wider text-slate-500 leading-normal">
                  Create checkpoint backups of the current timeline simulation space.
                </p>

                <div className="max-h-60 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1">
                  {snapshots.length === 0 ? (
                    <div className="text-[9px] text-slate-600 italic py-4 text-center border border-slate-900/60 bg-black/25 rounded">
                      No snapshots created yet.
                    </div>
                  ) : (
                    snapshots.map((snap) => (
                      <div key={snap.id} className="border border-slate-900 bg-black/35 p-2.5 rounded flex justify-between items-center hover:border-slate-800 transition-all">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-[8px] text-white font-mono truncate font-bold uppercase tracking-wider select-all" title={snap.id}>
                            ID: {snap.id.slice(0, 8)}...
                          </span>
                          <span className="text-[8px] text-cyan-400 font-bold uppercase font-orbitron">
                            Tick {snap.tick} • {new Date(snap.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button 
                            onClick={() => handleRestoreSnapshot(snap.id)}
                            disabled={loadingSnapshots || userRole !== 'admin'}
                            className="px-2 py-1 bg-cyan-950/40 border border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-400 text-[8px] font-black uppercase rounded transition-all cursor-pointer disabled:opacity-40"
                            title="Restore active simulation to this checkpoint"
                          >
                            Restore
                          </button>
                          <button 
                            onClick={() => handleForkSnapshot(snap.id)}
                            disabled={loadingSnapshots}
                            className="px-2 py-1 bg-purple-950/40 border border-purple-500/30 hover:bg-purple-500/10 text-purple-400 text-[8px] font-black uppercase rounded transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1"
                            title="Fork a new world from this checkpoint"
                          >
                            <GitFork size={8} />
                            Fork
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <button 
                  onClick={handleCreateSnapshot}
                  disabled={loadingSnapshots || userRole !== 'admin'}
                  className="w-full py-2.5 bg-yellow-500/10 border border-yellow-500/30 hover:bg-yellow-500/20 text-yellow-500 text-[9px] font-black uppercase tracking-wider rounded transition-all cursor-pointer mt-2 disabled:opacity-40"
                >
                  {loadingSnapshots ? "Processing..." : "Create Backup Snapshot"}
                </button>
              </div>
            </div>

          </div>

          {/* Right Column: World Swarm Builder & Share Settings */}
          <div className="flex flex-col gap-6">

            {/* World Builder */}
            <div className="glass p-5 rounded border border-slate-800 bg-slate-950/40 flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
                <GitBranch className="text-emerald-400" size={16} />
                <h2 className="font-orbitron text-xs font-bold uppercase tracking-widest text-white">Swarm Swarm Initialization</h2>
              </div>
              
              <p className="text-[9px] uppercase tracking-wider text-slate-500 leading-normal">
                Set custom agent counts to seed prior to timeline boot sequence.
              </p>

              <div className="space-y-2 border border-slate-900 bg-black/30 p-3 rounded max-h-48 overflow-y-auto custom-scrollbar">
                {world.agent_archetypes.map((arch) => (
                  <div key={arch.id} className="flex justify-between items-center text-[10px] uppercase font-mono py-1 border-b border-slate-900 last:border-b-0">
                    <span className="text-slate-300 font-bold truncate max-w-[200px]">{arch.name.replace('The ', '')}</span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setSeedCounts(prev => ({ ...prev, [arch.id]: Math.max(0, (prev[arch.id] || 0) - 1) }))}
                        className="w-5 h-5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded flex items-center justify-center cursor-pointer text-[10px] font-bold"
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-white font-orbitron font-bold text-[10px]">
                        {seedCounts[arch.id] || 0}
                      </span>
                      <button 
                        onClick={() => setSeedCounts(prev => ({ ...prev, [arch.id]: (prev[arch.id] || 0) + 1 }))}
                        className="w-5 h-5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded flex items-center justify-center cursor-pointer text-[10px] font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  const seedPayload: Record<string, number> = {};
                  Object.entries(seedCounts).forEach(([k, v]) => {
                    if (v > 0) seedPayload[k] = v;
                  });
                  resetSimulation(seedPayload);
                }}
                className="w-full py-2.5 border border-emerald-500/30 hover:border-emerald-500 text-emerald-400 hover:bg-emerald-500/10 text-[9px] uppercase tracking-[0.2em] font-orbitron font-bold rounded cursor-pointer transition-all duration-300"
              >
                Boot config sequence
              </button>
            </div>
            
            {/* Share settings */}
            <div className="glass p-5 rounded border border-slate-800 bg-slate-950/40 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                <div className="flex items-center gap-2">
                  <Share2 className="text-purple-400" size={16} />
                  <h2 className="font-orbitron text-xs font-bold uppercase tracking-widest text-white">Share configuration</h2>
                </div>
                {world.share?.public && (
                  <span className="text-[8px] font-mono text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 px-1.5 py-0.5 rounded flex items-center gap-1 font-bold">
                    <span className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse" />
                    {world.view_count ?? 0} Spectators
                  </span>
                )}
              </div>

              <p className="text-[9px] uppercase tracking-wider text-slate-500 leading-normal">
                Expose this timeline as a read-only stream to unauthenticated observers.
              </p>

              <div className="flex items-center justify-between border-t border-b border-slate-900/60 py-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 font-orbitron">Public Access</span>
                <button
                  onClick={toggleShare}
                  disabled={sharing}
                  className={`px-3 py-1.5 border font-orbitron text-[9px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer ${
                    world.share?.public
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                  }`}
                >
                  {sharing ? 'UPDATING...' : world.share?.public ? 'ENABLED (PUBLIC)' : 'DISABLED (PRIVATE)'}
                </button>
              </div>

              {/* Discord Webhook Configuration */}
              <div className="flex flex-col gap-1.5 border-b border-slate-900/60 pb-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 font-orbitron">Discord Webhook URL</span>
                <p className="text-[8px] text-slate-500 uppercase tracking-normal mb-1">
                  Receive webhook notifications when stability drops below 20%, alliances form, or codebase changes.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://discord.com/api/webhooks/..."
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    disabled={userRole !== 'admin' || savingWebhook}
                    className="flex-1 bg-black border border-slate-900 rounded px-2.5 py-1.5 text-[9px] text-purple-400 outline-none font-mono focus:border-purple-500"
                  />
                  <button
                    onClick={saveWebhook}
                    disabled={userRole !== 'admin' || savingWebhook}
                    className="px-3 py-1.5 border border-purple-500/50 bg-purple-950/20 text-purple-400 hover:bg-purple-950/40 text-[9px] font-orbitron font-bold uppercase rounded cursor-pointer disabled:opacity-50"
                  >
                    {savingWebhook ? 'SAVING...' : 'SAVE'}
                  </button>
                </div>
              </div>

              {world.share?.public && (
                <div className="space-y-3">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] uppercase text-slate-500 font-bold">Spectator Link</span>
                    <div className="flex items-center gap-2 bg-black border border-slate-900 rounded p-1.5">
                      <input
                        type="text"
                        readOnly
                        value={typeof window !== 'undefined' ? `${window.location.origin}/spectate/${world.world_id}` : `http://localhost:3000/spectate/${world.world_id}`}
                        className="flex-1 bg-transparent text-[9px] text-cyan-400 outline-none select-all font-mono"
                      />
                      <button
                        onClick={handleCopyLink}
                        className="p-1 hover:bg-slate-900 rounded text-slate-400 hover:text-white transition-all cursor-pointer"
                        title="Copy Link"
                      >
                        {copiedLink ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] uppercase text-slate-500 font-bold">Live Badge Markdown</span>
                    <div className="flex items-center gap-2 bg-black border border-slate-900 rounded p-1.5">
                      <input
                        type="text"
                        readOnly
                        value={`![Simulation Badge](${getBackendUrl()}/v1/simulation/${world.world_id}/badge.svg)`}
                        className="flex-1 bg-transparent text-[9px] text-purple-400 outline-none select-all font-mono"
                      />
                      <button
                        onClick={handleCopyBadge}
                        className="p-1 hover:bg-slate-900 rounded text-slate-400 hover:text-white transition-all cursor-pointer"
                        title="Copy Badge Markdown"
                      >
                        {copiedBadge ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] uppercase text-slate-500 font-bold">Embed Badge SDK Code</span>
                    <div className="flex items-center gap-2 bg-black border border-slate-900 rounded p-1.5">
                      <input
                        type="text"
                        readOnly
                        value={`<script src="http://localhost:3000/nullpointer-sdk.js"></script><div id="np-badge"></div><script>window.onload=function(){NP.init('${world.world_id}','np-badge');};</script>`}
                        className="flex-1 bg-transparent text-[9px] text-amber-400 outline-none select-all font-mono"
                      />
                      <button
                        onClick={handleCopySdkCode}
                        className="p-1 hover:bg-slate-900 rounded text-slate-400 hover:text-white transition-all cursor-pointer"
                        title="Copy Embed Code"
                      >
                        {copiedSdk ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
