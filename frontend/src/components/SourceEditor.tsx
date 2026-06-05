"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { 
  Code2, 
  Play, 
  ShieldAlert, 
  History, 
  Terminal, 
  Cpu, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  Save, 
  Check
} from 'lucide-react';

const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface HistoryItem {
  id: string;
  title: string;
  code: string;
  language: 'python' | 'javascript';
  timestamp: string;
}

interface Finding {
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  rule: string;
  message: string;
  line: number;
}

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '1';
  const match = document.cookie.match(new RegExp('(^| )csrf_token=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : '1';
};

const DEFAULT_PYTHON = `def run_simulation(heat_level: float):
    """
    Core agentic loop override
    """
    if heat_level > 80.0:
        return "INITIATE_COOLING"
    
    return "PROCEED"`;

const DEFAULT_JS = `function runSimulation(heatLevel) {
    // Core agentic loop override
    if (heatLevel > 80.0) {
        return "INITIATE_COOLING";
    }
    return "PROCEED";
}`;

export const SourceEditor = () => {
  const [language, setLanguage] = useState<'python' | 'javascript'>('python');
  const [code, setCode] = useState<string>(DEFAULT_PYTHON);
  const [title, setTitle] = useState<string>('simulation_logic.py');
  const [loading, setLoading] = useState<boolean>(false);
  const [outputTab, setOutputTab] = useState<'console' | 'findings'>('console');
  const [isPanelExpanded, setIsPanelExpanded] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  
  // Sandbox execution result
  const [executionResult, setExecutionResult] = useState<{
    success: boolean;
    output: string;
    error: string;
    execution_time: number;
    provider: string;
    exit_code?: number | null;
  } | null>(null);

  // Analysis result
  const [findings, setFindings] = useState<Finding[] | null>(null);

  useEffect(() => {
    // Load history list from localStorage
    try {
      const raw = localStorage.getItem('null_pointer_code_history');
      if (raw) {
        Promise.resolve().then(() => setHistoryList(JSON.parse(raw)));
      }
    } catch (e) {
      console.error("Failed to parse code history", e);
    }
  }, []);

  const handleLanguageChange = (lang: 'python' | 'javascript') => {
    setLanguage(lang);
    if (lang === 'python') {
      setCode(DEFAULT_PYTHON);
      setTitle('simulation_logic.py');
    } else {
      setCode(DEFAULT_JS);
      setTitle('simulation_logic.js');
    }
  };

  const handleSaveToHistory = () => {
    if (!code.trim()) return;
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      title: title.trim() || (language === 'python' ? 'patch.py' : 'patch.js'),
      code: code,
      language: language,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    let updatedHistory = [newItem, ...historyList.filter(item => item.code !== code)];
    updatedHistory = updatedHistory.slice(0, 10);
    
    localStorage.setItem('null_pointer_code_history', JSON.stringify(updatedHistory));
    setHistoryList(updatedHistory);
    
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleLoadFromHistory = (item: HistoryItem) => {
    setCode(item.code);
    setLanguage(item.language);
    setTitle(item.title);
    setShowHistory(false);
  };

  const handleClearHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.removeItem('null_pointer_code_history');
    setHistoryList([]);
  };

  const handleRunInSandbox = async () => {
    setLoading(true);
    setIsPanelExpanded(true);
    setOutputTab('console');
    setExecutionResult(null);

    try {
      const res = await fetch('http://localhost:8000/v1/sandbox/execute', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken()
        },
        body: JSON.stringify({
          code: code,
          language: language
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Sandbox execution failed');
      }

      const data = await res.json();
      setExecutionResult(data);
      handleSaveToHistory();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Network error occurred while calling sandbox.';
      setExecutionResult({
        success: false,
        output: '',
        error: errMsg,
        execution_time: 0,
        provider: 'local-error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setIsPanelExpanded(true);
    setOutputTab('findings');
    setFindings(null);

    try {
      const res = await fetch('http://localhost:8000/api/analyze', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken()
        },
        body: JSON.stringify({
          code: code,
          language: language
        })
      });

      if (!res.ok) {
        throw new Error('Analysis failed');
      }

      const data = await res.json();
      setFindings(data.findings || []);
      handleSaveToHistory();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to parse code or contact analysis backend.';
      setFindings([
        {
          severity: 'HIGH',
          rule: 'analysis_failure',
          message: errMsg,
          line: 1
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-950/80 border border-slate-800 rounded-lg overflow-hidden shadow-2xl relative font-mono">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-900/60 border-b border-slate-800/80 select-none z-10">
        <div className="flex items-center gap-2">
          <Code2 size={16} className="text-emerald-400" />
          <input 
            type="text" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)}
            className="bg-transparent text-xs font-semibold text-slate-300 border-b border-transparent hover:border-slate-700 focus:border-cyan-500 outline-none w-44 font-orbitron tracking-wider uppercase py-0.5"
            placeholder="snippet_name"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <select 
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value as 'python' | 'javascript')}
            className="bg-slate-950 border border-slate-800 text-[10px] text-slate-300 px-2 py-1 rounded outline-none font-bold uppercase tracking-wider cursor-pointer hover:border-slate-700 transition-all"
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
          </select>

          {/* History Dropdown Trigger */}
          <div className="relative">
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] rounded font-bold uppercase tracking-wider transition-all border ${
                showHistory 
                  ? 'bg-blue-500/20 border-blue-500 text-blue-400' 
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
              }`}
            >
              <History size={12} />
              <span>History</span>
              <ChevronDown size={10} className={`transform transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            </button>

            {showHistory && (
              <div className="absolute right-0 mt-1.5 w-64 bg-slate-950 border border-slate-800 rounded-lg shadow-2xl overflow-hidden z-20">
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border-b border-slate-800/60 text-[9px] text-slate-500 uppercase font-black">
                  <span>Recent Snippets</span>
                  {historyList.length > 0 && (
                    <button 
                      onClick={handleClearHistory}
                      className="hover:text-red-400 transition-colors flex items-center gap-1"
                    >
                      <Trash2 size={10} /> Clear
                    </button>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-900/60 custom-scrollbar">
                  {historyList.length === 0 ? (
                    <div className="px-3 py-4 text-center text-[10px] text-slate-600">
                      No code snippets saved
                    </div>
                  ) : (
                    historyList.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleLoadFromHistory(item)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-900/80 transition-colors flex flex-col gap-0.5"
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className="text-[10px] font-bold text-slate-300 truncate max-w-[130px]">
                            {item.title}
                          </span>
                          <span className="text-[8px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-black">
                            {item.language}
                          </span>
                        </div>
                        <span className="text-[8px] text-slate-600">{item.timestamp}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Manual Save */}
          <button 
            onClick={handleSaveToHistory}
            className={`p-1.5 rounded transition-all border ${
              saveSuccess 
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
            }`}
            title="Save draft"
          >
            {saveSuccess ? <Check size={12} /> : <Save size={12} />}
          </button>
        </div>
      </div>

      {/* Monaco Editor Container */}
      <div className="flex-1 min-h-0 bg-[#1e1e1e] relative">
        <Editor
          height="100%"
          language={language}
          value={code}
          onChange={(val) => setCode(val || '')}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "JetBrains Mono, monospace",
            lineNumbers: "on",
            scrollbar: {
              vertical: 'visible',
              horizontal: 'visible',
              useShadows: false,
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8
            },
            hideCursorInOverviewRuler: true,
            renderLineHighlight: 'all',
            padding: { top: 12, bottom: 12 },
            automaticLayout: true
          }}
        />

        {/* Floating actions right aligned */}
        <div className="absolute right-4 bottom-4 flex gap-2 z-10">
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-[10px] font-black uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(245,158,11,0.05)] hover:shadow-[0_0_15px_rgba(245,158,11,0.15)] disabled:opacity-50"
          >
            <ShieldAlert size={12} />
            <span>Analyze</span>
          </button>
          <button
            onClick={handleRunInSandbox}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/40 rounded text-[10px] font-black uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:shadow-[0_0_15px_rgba(16,185,129,0.25)] disabled:opacity-50"
          >
            <Play size={12} className="fill-emerald-400/20" />
            <span>Run Sandbox</span>
          </button>
        </div>
      </div>

      {/* Output Panel */}
      <div className={`border-t border-slate-800 bg-slate-950 flex flex-col transition-all duration-300 ${
        isPanelExpanded ? 'h-64' : 'h-8'
      }`}>
        {/* Panel Header */}
        <div 
          onClick={() => setIsPanelExpanded(!isPanelExpanded)}
          className="flex items-center justify-between px-3 py-1.5 bg-slate-900/40 cursor-pointer hover:bg-slate-900/60 transition-colors select-none"
        >
          <div className="flex items-center gap-4">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Terminal size={10} /> Output Panel
            </span>

            {isPanelExpanded && (
              <div className="flex gap-1.5 bg-slate-950 rounded p-0.5 border border-slate-900/80">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOutputTab('console');
                  }}
                  className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded transition-all ${
                    outputTab === 'console' 
                      ? 'bg-slate-800 text-white' 
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Console Output
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOutputTab('findings');
                  }}
                  className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded transition-all flex items-center gap-1 ${
                    outputTab === 'findings' 
                      ? 'bg-slate-800 text-amber-400' 
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Security Findings
                  {findings && findings.length > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isPanelExpanded && executionResult && (
              <div className="flex items-center gap-3 text-[8px] text-slate-500 font-bold">
                <span className="flex items-center gap-0.5 uppercase">
                  <Cpu size={9} /> {executionResult.provider}
                </span>
                <span className="flex items-center gap-0.5 uppercase">
                  <Clock size={9} /> {executionResult.execution_time.toFixed(3)}s
                </span>
              </div>
            )}
            <button className="text-slate-500 hover:text-white transition-colors">
              {isPanelExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>
        </div>

        {/* Panel Content */}
        {isPanelExpanded && (
          <div className="flex-1 overflow-y-auto p-3 custom-scrollbar text-xs">
            {outputTab === 'console' ? (
              <div className="font-mono h-full flex flex-col">
                {loading ? (
                  <div className="text-slate-500 flex items-center gap-2 py-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                    <span>Executing code inside Replit Sandbox virtualization sandbox...</span>
                  </div>
                ) : executionResult ? (
                  <div className="space-y-2 flex-1">
                    {/* stdout */}
                    {executionResult.output && (
                      <div className="text-emerald-400 whitespace-pre-wrap leading-relaxed">
                        {executionResult.output}
                      </div>
                    )}
                    
                    {/* stderr / errors */}
                    {executionResult.error && (
                      <div className="text-red-400 whitespace-pre-wrap leading-relaxed bg-red-950/10 border border-red-950/30 p-2.5 rounded">
                        {executionResult.error}
                      </div>
                    )}

                    {!executionResult.output && !executionResult.error && (
                      <div className="text-slate-600 italic py-2">
                        Sandbox executed successfully, but returned no stdout or stderr.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-slate-600 italic py-4 text-center">
                    No run logs. Click &apos;Run Sandbox&apos; to initiate execution.
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full">
                {loading ? (
                  <div className="text-slate-500 flex items-center gap-2 py-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    <span>Running AST code analysis and security engine check...</span>
                  </div>
                ) : findings ? (
                  findings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-emerald-400 gap-2 font-orbitron uppercase text-[10px]">
                      <Check size={20} className="text-emerald-400 border border-emerald-500/30 rounded-full p-0.5 bg-emerald-500/5" />
                      <span>Security integrity validated. No vulnerabilities identified.</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5">
                      {findings.map((f, idx) => (
                        <div 
                          key={idx} 
                          className={`flex flex-col gap-1.5 p-2.5 rounded border ${
                            f.severity === 'HIGH' 
                              ? 'bg-red-950/15 border-red-900/40' 
                              : f.severity === 'MEDIUM' 
                              ? 'bg-amber-950/15 border-amber-900/40' 
                              : f.severity === 'LOW' 
                              ? 'bg-yellow-950/15 border-yellow-900/40' 
                              : 'bg-blue-950/15 border-blue-900/40'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${
                                f.severity === 'HIGH' 
                                  ? 'bg-red-500 text-white' 
                                  : f.severity === 'MEDIUM' 
                                  ? 'bg-amber-500 text-black' 
                                  : f.severity === 'LOW' 
                                  ? 'bg-yellow-500 text-black' 
                                  : 'bg-blue-500 text-white'
                              }`}>
                                {f.severity}
                              </span>
                              <span className="text-[10px] font-bold text-slate-300">
                                {f.rule}
                              </span>
                            </div>
                            <span className="text-[9px] text-slate-500 font-bold">
                              Line {f.line}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono leading-normal">
                            {f.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="text-slate-600 italic py-4 text-center">
                    No scanning results. Click &apos;Analyze&apos; to inspect potential security flaws.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
