import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Activity, Play, AlertOctagon, RotateCcw, FileText, Settings, 
  Wifi, WifiOff, Check, X, ChevronRight, BarChart2, List, Shield, Info,
  Bot, ShieldAlert, Zap, Search, ArrowRight, GitBranch, Clock, BrainCircuit,
  LayoutDashboard, Terminal, LineChart, Cpu, Server, TrendingUp, Calendar, Layers,
  Globe, Radio, Mic, Send, User as UserIcon, HelpCircle, Share2
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, Cell,
  AreaChart, Area, CartesianGrid
} from 'recharts';

import { AppPhase, MetricPoint, LogEntry, AgentMessage, ModelData } from './types';
import { BASELINE_MODEL, CANDIDATE_MODEL, INITIAL_METRICS_STATE, ANOMALY_TICK_INDEX, ANOMALY_VALUES, COLORS } from './constants';
import { LiveChart } from './components/Charts';
import { TerraPanel } from './components/TerraPanel';

// --- Tour Types & Data ---
interface TourStep {
  targetId?: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: () => void;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to MRO",
    content: "This is the Model Release Orchestrator. I'll take you on a quick tour to show you how to safely deploy AI models using our agent-guided canary flow.",
    position: 'center'
  },
  {
    targetId: 'nav-overview',
    title: "System Overview",
    content: "We start here. The Overview dashboard monitors global system health, resource usage, and live traffic patterns across all clusters.",
    position: 'bottom'
  },
  {
    targetId: 'nav-release',
    title: "Release Console",
    content: "This is where the magic happens. Let's head over there to manage your deployment pipeline.",
    position: 'bottom',
    action: () => document.getElementById('nav-release')?.click()
  },
  {
    targetId: 'card-model-comparison',
    title: "Model Comparison",
    content: "Review key performance metrics. Here you can see how your candidate model (v3.0) compares against the running baseline (v2.1).",
    position: 'right'
  },
  {
    targetId: 'btn-start-release',
    title: "Initiate Deployment",
    content: "When you're ready, click here to start the agent-guided release flow. Terra will run a shadow test before letting you proceed.",
    position: 'top'
  }
];

export default function App() {
  // --- State ---
  // Start on Overview
  const [phase, setPhase] = useState<AppPhase>(AppPhase.IDLE);
  const [activeTab, setActiveTab] = useState<'overview' | 'release' | 'monitoring' | 'logs' | 'settings'>('overview');
  const [metrics, setMetrics] = useState<MetricPoint[]>([]);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeModel, setActiveModel] = useState<string>(BASELINE_MODEL.version);
  const [chatInput, setChatInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  
  // Flow State
  const [shadowTestStatus, setShadowTestStatus] = useState<'idle' | 'running' | 'complete'>('idle');
  
  // Tour State
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [isTourActive, setIsTourActive] = useState(true);
  const [tourRect, setTourRect] = useState<DOMRect | null>(null);
  
  // Persistent Settings
  const [networkEnabled, setNetworkEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('mro_settings_network');
      return saved !== null ? JSON.parse(saved) : true;
    } catch (e) {
      return true;
    }
  });

  const [defaultCanaryPercent, setDefaultCanaryPercent] = useState(() => {
    try {
      const saved = localStorage.getItem('mro_settings_default_canary');
      return saved !== null ? JSON.parse(saved) : 5;
    } catch (e) {
      return 5;
    }
  });
  
  // Simulation Controls
  const [canaryPercent, setCanaryPercent] = useState(defaultCanaryPercent);
  const [rolloutDuration, setRolloutDuration] = useState(20);
  const [tickIndex, setTickIndex] = useState(0);
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const [recommendationTimeout, setRecommendationTimeout] = useState(false);
  const [agentConfidence, setAgentConfidence] = useState(83);
  
  const simulationInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Overview Dashboard Live State ---
  const [sysStats, setSysStats] = useState({
    cpu: 42,
    memory: 58,
    requests: 1420,
    latency: 205
  });
  const [trafficData, setTrafficData] = useState<{name: number, value: number}[]>([]);

  // --- Helpers ---
  
  const addLog = useCallback((event: string, details: string, type: LogEntry['type'] = 'info') => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      event,
      details,
      type
    };
    setLogs(prev => [newLog, ...prev]);
  }, []);

  const addAgentMessage = useCallback((text: string, type: AgentMessage['type'] = 'normal', metadata?: AgentMessage['metadata']) => {
    const msg: AgentMessage = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      type,
      timestamp: new Date(),
      sender: 'Terra',
      metadata
    };
    setMessages(prev => [...prev, msg]);
  }, []);

  // --- Effects ---

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('mro_settings_network', JSON.stringify(networkEnabled));
  }, [networkEnabled]);

  useEffect(() => {
    localStorage.setItem('mro_settings_default_canary', JSON.stringify(defaultCanaryPercent));
  }, [defaultCanaryPercent]);

  // Sync default canary percent to flow state when IDLE
  useEffect(() => {
    if (phase === AppPhase.IDLE) {
      setCanaryPercent(defaultCanaryPercent);
    }
  }, [defaultCanaryPercent, phase]);

  // Tour Effect: Update rect when step changes or window resizes
  useEffect(() => {
    if (!isTourActive) return;

    const updateRect = () => {
      const step = TOUR_STEPS[tourStepIndex];
      if (step.targetId) {
        const el = document.getElementById(step.targetId);
        if (el) {
          setTourRect(el.getBoundingClientRect());
        }
      } else {
        setTourRect(null); // Center modal
      }
    };

    // Small delay to allow UI to update (e.g. tab switch)
    const timeout = setTimeout(updateRect, 100);
    window.addEventListener('resize', updateRect);
    
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', updateRect);
    };
  }, [tourStepIndex, isTourActive, activeTab]);

  // Live Dashboard Simulation Effect
  useEffect(() => {
    // Initialize traffic history
    const initialHistory = Array.from({ length: 20 }).map((_, i) => ({
      name: i,
      value: 1200 + Math.random() * 400
    }));
    setTrafficData(initialHistory);

    const interval = setInterval(() => {
      setSysStats(prev => ({
        cpu: Math.min(95, Math.max(15, prev.cpu + (Math.random() * 6 - 3))),
        memory: Math.min(90, Math.max(25, prev.memory + (Math.random() * 4 - 2))),
        requests: Math.max(500, Math.floor(1400 + (Math.random() * 300 - 150))),
        latency: Math.max(50, Math.floor(205 + (Math.random() * 10 - 5)))
      }));

      setTrafficData(prev => {
        const next = [...prev, { name: Date.now(), value: 1400 + (Math.random() * 300 - 150) }];
        if (next.length > 20) next.shift();
        return next;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  // Metric Generation Effect (Canary Flow)
  useEffect(() => {
    if ((phase !== AppPhase.MONITORING && phase !== AppPhase.ANOMALY_DETECTED) || !networkEnabled) return;

    const isAnomaly = tickIndex >= ANOMALY_TICK_INDEX;
    const now = new Date();
    const timeLabel = now.toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });

    const newPoint: MetricPoint = {
      timestamp: now.getTime(),
      timeLabel,
      latency: isAnomaly 
        ? ANOMALY_VALUES.latency + (Math.random() * 10) 
        : BASELINE_MODEL.latency_ms + (Math.random() * 10 - 5),
      error_rate: isAnomaly 
        ? ANOMALY_VALUES.error_rate + (Math.random() * 0.005) 
        : INITIAL_METRICS_STATE.error_rate + (Math.random() * 0.002 - 0.001),
      drift_user_region: isAnomaly 
        ? ANOMALY_VALUES.drift_user_region + (Math.random() * 0.02) 
        : INITIAL_METRICS_STATE.drifts.user_region + (Math.random() * 0.005)
    };

    setMetrics(prev => {
      const next = [...prev, newPoint];
      if (next.length > 30) next.shift(); // Keep last 30
      return next;
    });

    if (tickIndex === ANOMALY_TICK_INDEX && phase === AppPhase.MONITORING) {
      setPhase(AppPhase.ANOMALY_DETECTED);
      setAgentConfidence(83); // Reset confidence to simulation default on new anomaly
      
      setTimeout(() => {
        addAgentMessage("⚠️ Early anomaly detected during canary rollout.", "alert");
      }, 500);

      setTimeout(() => {
        addAgentMessage(
          "Latency rose 22% (210ms → 256ms). Feature user_region drift 18% vs baseline 2%. Error rate increased to 1.9%.", 
          "alert"
        );
      }, 1500);

      setTimeout(() => {
        addAgentMessage(
          "Recommendation: Rollback to v2.1. Confidence: 83%. Options: [Continue Rollout] [Rollback to v2.1]. I will not act without your confirmation.", 
          "recommendation",
          { confidence: 83, risk: 'High', primaryDrift: 'user_region' }
        );
      }, 3000);
      
      addLog('Anomaly Detected', 'Latency > threshold (+22%), Drift > threshold (0.18).', 'warning');
    }

  }, [tickIndex, phase, networkEnabled, addAgentMessage, addLog]);

  // Timeout Warning Logic
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (phase === AppPhase.ANOMALY_DETECTED) {
      timeoutId = setTimeout(() => {
        setRecommendationTimeout(true);
      }, 60000);
    } else {
      setRecommendationTimeout(false);
    }
    return () => clearTimeout(timeoutId);
  }, [phase]);

  // --- Handlers ---

  const handleShareComparison = () => {
    alert("Comparison link copied to clipboard!");
  };

  const handleTourNext = () => {
    const currentStep = TOUR_STEPS[tourStepIndex];
    
    // Execute action if exists (e.g. switch tab)
    if (currentStep.action) {
      currentStep.action();
      // Need a small delay for render before next step calculation
      setTimeout(() => {
        if (tourStepIndex < TOUR_STEPS.length - 1) {
          setTourStepIndex(prev => prev + 1);
        } else {
          setIsTourActive(false);
        }
      }, 150);
    } else {
      if (tourStepIndex < TOUR_STEPS.length - 1) {
        setTourStepIndex(prev => prev + 1);
      } else {
        setIsTourActive(false);
      }
    }
  };

  const handleSkipTour = () => {
    setIsTourActive(false);
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    // Add user message
    const userMsg: AgentMessage = {
      id: Date.now().toString(),
      text: chatInput,
      sender: 'User',
      timestamp: new Date(),
      type: 'normal'
    };
    setMessages(prev => [...prev, userMsg]);
    setChatInput("");

    // Simulate basic acknowledgement for now
    setTimeout(() => {
      addAgentMessage("I've received your query. I am currently focusing on monitoring the active release, but I can help you investigate logs or metrics if you need.", 'normal');
    }, 1000);
  };

  const toggleListening = () => {
    setIsListening(!isListening);
    // In a real app, this would trigger Speech Recognition
    if (!isListening) {
      setTimeout(() => {
        setIsListening(false);
        setChatInput("What is the current latency trend?");
      }, 2000);
    }
  };

  const handleStartGuided = () => {
    setPhase(AppPhase.SHADOW_TEST);
    setShadowTestStatus('running');
    addLog('Shadow Test Initiated', 'Checking candidate model stability against baseline.');
    
    // Simulate Shadow Test
    addAgentMessage("Hi — I’m Terra. I recommend a 5% canary for 20 minutes. I’ll monitor latency, error rate, and feature drift. I will not act without your confirmation.");
    
    // Auto-resolve after 2s
    setTimeout(() => {
      setShadowTestStatus('complete');
      addLog('Shadow Test Completed', 'Result: Stable. No anomalies detected.', 'success');
      addAgentMessage("Shadow test stable. No anomalies detected.", 'success');
    }, 2000);
  };

  const handleContinueToSetup = () => {
    setPhase(AppPhase.CANARY_SETUP);
  };

  const handleStartCanary = () => {
    setPhase(AppPhase.MONITORING);
    setActiveTab('monitoring'); // Auto switch to monitoring view
    setActiveModel(`${BASELINE_MODEL.version} (95%) / ${CANDIDATE_MODEL.version} (5%)`);
    addLog('Canary Rollout Started', `Traffic split: 95/5. Monitoring started.`);
    startSimulation();
  };

  const startSimulation = () => {
    if (simulationInterval.current) clearInterval(simulationInterval.current);
    
    // Initialize charts with some stable history
    const initialData: MetricPoint[] = Array.from({ length: 10 }).map((_, i) => ({
      timestamp: Date.now() - (10 - i) * 1000,
      timeLabel: `00:0${i}`,
      latency: BASELINE_MODEL.latency_ms + (Math.random() * 10 - 5),
      error_rate: INITIAL_METRICS_STATE.error_rate + (Math.random() * 0.002 - 0.001),
      drift_user_region: INITIAL_METRICS_STATE.drifts.user_region + (Math.random() * 0.005)
    }));
    setMetrics(initialData);
    setTickIndex(0);

    simulationInterval.current = setInterval(() => {
      setTickIndex(prev => prev + 1);
    }, 1000);
  };

  const handleRollbackClick = () => {
    setShowRollbackModal(true);
  };

  const handleContinueRollout = () => {
    setRecommendationTimeout(false);
    addLog('Rollout Continued', `User overrode rollback recommendation. Adjusted Confidence: ${agentConfidence}%.`, 'warning');
    addAgentMessage("Continuing rollout. Monitoring extended to next 15 minutes. I will notify you immediately if degradation accelerates.", 'normal');
  };

  const confirmRollback = () => {
    if (simulationInterval.current) clearInterval(simulationInterval.current);
    setPhase(AppPhase.ROLLED_BACK);
    setShowRollbackModal(false);
    setActiveModel(BASELINE_MODEL.version);
    setRecommendationTimeout(false);
    
    addLog('Rollback Executed', `Reverted to v2.1. Reason: Terra Anomaly Detection. Adjusted Confidence: ${agentConfidence}%.`, 'error');
    addAgentMessage("Rollback completed. Model v2.1 restored. I’ve logged the event and can generate release notes.", 'success');
  };

  const generateNotes = () => {
    addLog('Release Notes Generated', 'Incident report created successfully.', 'success');
    setShowReleaseNotes(true);
  };

  const toggleNetwork = () => {
    const newState = !networkEnabled;
    setNetworkEnabled(newState);
    if (!newState) {
      addLog('Network Failure', 'Telemetry stream interrupted manually.', 'warning');
    } else {
      addLog('Network Restored', 'Telemetry resumed.', 'success');
    }
  };

  const replayTimeline = () => {
     setTickIndex(0);
     startSimulation();
     addLog('Replay', 'Replaying last session data.');
  };

  // --- View Components ---

  const renderOverview = () => {
    const WEEKLY_DATA = [
        { name: 'Mon', success: 42, fail: 2 },
        { name: 'Tue', success: 38, fail: 1 },
        { name: 'Wed', success: 45, fail: 0 },
        { name: 'Thu', success: 52, fail: 3 },
        { name: 'Fri', success: 48, fail: 1 },
        { name: 'Sat', success: 25, fail: 0 },
        { name: 'Sun', success: 18, fail: 0 },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in pb-10">
            {/* Real-time Traffic Hero Card */}
            <div className="col-span-1 md:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm relative overflow-hidden group">
                <div className="p-6 h-full flex flex-col justify-between relative z-10">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                                <Activity size={20} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">Global Traffic</h3>
                        </div>
                        <div className="flex items-center space-x-2 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-xs font-bold text-green-700">LIVE</span>
                        </div>
                    </div>
                    
                    <div className="flex items-end space-x-3 mb-6">
                        <span className="text-4xl font-black text-slate-900 tracking-tight">
                            {sysStats.requests.toLocaleString()}
                        </span>
                        <span className="text-sm font-medium text-slate-500 mb-1.5">req/sec</span>
                        <span className="text-xs font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded mb-1.5 border border-green-100">
                            +4.2%
                        </span>
                    </div>

                    <div className="h-32 w-full -mx-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trafficData}>
                                <defs>
                                    <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <Area 
                                    type="monotone" 
                                    dataKey="value" 
                                    stroke="#2563eb" 
                                    strokeWidth={2}
                                    fillOpacity={1} 
                                    fill="url(#colorTraffic)" 
                                    isAnimationActive={false}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* System Health Stats */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                     <h3 className="font-bold text-slate-800 flex items-center gap-2"><Globe size={18} className="text-slate-400"/> Health</h3>
                     <Check size={16} className="text-green-500" />
                </div>
                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-sm text-slate-500">Avg Latency</span>
                            <span className="text-xl font-bold text-slate-800 font-mono transition-all duration-500">{sysStats.latency}ms</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                             <div className="bg-blue-500 h-full rounded-full transition-all duration-1000" style={{width: `${(sysStats.latency/300)*100}%`}}></div>
                        </div>
                    </div>
                    <div>
                         <div className="flex justify-between items-end mb-1">
                            <span className="text-sm text-slate-500">Error Rate</span>
                            <span className="text-xl font-bold text-slate-800 font-mono">0.02%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                             <div className="bg-green-500 h-full rounded-full" style={{width: '2%'}}></div>
                        </div>
                    </div>
                </div>
            </div>

             {/* Resources Card */}
             <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
                 <div className="flex justify-between items-start mb-4">
                    <h3 className="text-slate-800 font-bold flex items-center gap-2"><Server size={18} className="text-slate-400"/> Resources</h3>
                    <div className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded border border-green-200 uppercase tracking-wide">Optimal</div>
                 </div>
                 <div className="space-y-4">
                     <div>
                         <div className="flex justify-between text-xs mb-1">
                             <span className="text-slate-500 flex items-center gap-1"><Cpu size={12}/> CPU Load</span>
                             <span className="text-slate-800 font-mono">{Math.round(sysStats.cpu)}%</span>
                         </div>
                         <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                             <div className="bg-purple-500 h-full rounded-full transition-all duration-700 ease-out" style={{width: `${sysStats.cpu}%`}}></div>
                         </div>
                     </div>
                     <div>
                         <div className="flex justify-between text-xs mb-1">
                             <span className="text-slate-500 flex items-center gap-1"><Zap size={12}/> Memory</span>
                             <span className="text-slate-800 font-mono">{Math.round(sysStats.memory)}%</span>
                         </div>
                         <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                             <div className="bg-orange-500 h-full rounded-full transition-all duration-700 ease-out" style={{width: `${sysStats.memory}%`}}></div>
                         </div>
                     </div>
                 </div>
             </div>

             {/* Active Deployment Card */}
             <div className="col-span-1 bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between group hover:border-blue-200 transition-colors">
                <div>
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                            <Layers size={20} />
                        </div>
                        <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-full">v2.1</span>
                    </div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Production Model</p>
                    <h3 className="text-2xl font-bold text-slate-800 mt-1">Classification_v2</h3>
                </div>
                <div className="mt-4">
                    <div className="flex justify-between text-xs text-slate-500 mb-2">
                        <span>Traffic Share</span>
                        <span className="font-mono text-slate-700">{phase === AppPhase.MONITORING || phase === AppPhase.ANOMALY_DETECTED ? '95%' : '100%'}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div 
                            className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                            style={{ width: phase === AppPhase.MONITORING || phase === AppPhase.ANOMALY_DETECTED ? '95%' : '100%' }}
                        ></div>
                    </div>
                </div>
            </div>

             {/* Deployment Velocity Chart */}
             <div className="col-span-1 md:col-span-2 lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-slate-800 font-bold flex items-center gap-2"><TrendingUp size={18} className="text-blue-500"/> Release Velocity</h3>
                    </div>
                    <div className="flex items-center space-x-3">
                         <div className="flex items-center space-x-1.5">
                             <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                             <span className="text-[10px] uppercase font-bold text-slate-500">Success</span>
                         </div>
                         <div className="flex items-center space-x-1.5">
                             <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                             <span className="text-[10px] uppercase font-bold text-slate-500">Rollback</span>
                         </div>
                    </div>
                </div>
                <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={WEEKLY_DATA} barSize={24}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 600}} dy={10} />
                            <ReTooltip 
                                cursor={{fill: 'rgba(0,0,0,0.03)'}}
                                contentStyle={{backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}
                            />
                            <Bar dataKey="success" stackId="a" fill="#2563eb" radius={[0, 0, 4, 4]} />
                            <Bar dataKey="fail" stackId="a" fill="#f87171" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
             </div>

            {/* Quick Actions / Recent Activity */}
             <div className="col-span-1 md:col-span-1 lg:col-span-1 bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col">
                <h3 className="text-slate-800 font-bold mb-4 flex items-center gap-2"><Clock size={18} className="text-slate-400"/> Recent Activity</h3>
                <div className="flex-1 space-y-4">
                    <div className="flex gap-3">
                        <div className="mt-1 relative">
                            <div className="w-2 h-2 rounded-full bg-green-500 z-10 relative"></div>
                            <div className="absolute top-2 left-1 w-0.5 h-full bg-slate-100 -z-0"></div>
                        </div>
                        <div>
                            <p className="text-sm text-slate-800 font-medium">Release v2.1</p>
                            <p className="text-xs text-slate-500 mt-0.5">Deployed by @alex • 2d ago</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                         <div className="mt-1 relative">
                            <div className="w-2 h-2 rounded-full bg-slate-400 z-10 relative"></div>
                            <div className="absolute top-2 left-1 w-0.5 h-full bg-slate-100 -z-0"></div>
                        </div>
                        <div>
                            <p className="text-sm text-slate-800 font-medium">Config Update</p>
                            <p className="text-xs text-slate-500 mt-0.5">Drift thresholds • 3d ago</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                         <div className="mt-1">
                            <div className="w-2 h-2 rounded-full bg-red-400"></div>
                        </div>
                        <div>
                            <p className="text-sm text-slate-800 font-medium">Rollback v2.0</p>
                            <p className="text-xs text-slate-500 mt-0.5">Latency anomaly • 5d ago</p>
                        </div>
                    </div>
                </div>
                <button className="w-full mt-auto py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-dashed border-blue-200">
                    View Full Audit Log
                </button>
             </div>
        </div>
    );
  };

  const renderSettings = () => (
     <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm animate-fade-in max-w-2xl">
         <h3 className="text-slate-800 font-bold mb-6 flex items-center gap-2"><Settings size={20} /> Configuration</h3>
         
         <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div id="network-sim-label">
                    <p className="text-slate-900 font-medium">Network Simulation</p>
                    <p className="text-slate-500 text-sm">Toggle to simulate connection dropouts</p>
                </div>
                <button 
                  onClick={toggleNetwork}
                  role="switch"
                  aria-checked={networkEnabled}
                  aria-labelledby="network-sim-label"
                  className={`w-12 h-6 rounded-full transition-colors relative focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white ${networkEnabled ? 'bg-green-600' : 'bg-slate-200'}`}
                >
                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${networkEnabled ? 'translate-x-6' : ''}`}></div>
                </button>
            </div>

            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div id="default-canary-label">
                    <p className="text-slate-900 font-medium">Default Canary Size</p>
                    <p className="text-slate-500 text-sm">Initial traffic percentage</p>
                </div>
                <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200" role="group" aria-labelledby="default-canary-label">
                    {[1, 5, 10].map(val => (
                        <button 
                            key={val} 
                            onClick={() => setDefaultCanaryPercent(val)}
                            aria-pressed={defaultCanaryPercent === val}
                            aria-label={`Set default canary size to ${val}%`}
                            className={`px-3 py-1 text-xs rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-white ${defaultCanaryPercent === val ? 'bg-white text-slate-900 shadow-sm font-medium' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {val}%
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <p className="text-slate-900 font-medium">Agent Sensitivity</p>
                    <p className="text-slate-500 text-sm">Drift detection threshold</p>
                </div>
                <span className="text-blue-700 font-mono text-sm bg-blue-50 px-2 py-1 rounded border border-blue-100">High (0.1 KL)</span>
            </div>
         </div>
     </div>
  );

  const renderDecisionBox = () => {
    const renderConfidenceInput = (colorClass: string) => (
      <div className="mb-4 bg-white/50 rounded-lg p-3 border border-slate-200/50">
        <label htmlFor="confidence-slider" className={`block text-xs font-bold uppercase tracking-wider mb-2 ${colorClass}`}>
          Adjust Agent Confidence
        </label>
        <div className="flex items-center gap-3">
          <input
            id="confidence-slider"
            type="range"
            min="0"
            max="100"
            value={agentConfidence}
            onChange={(e) => setAgentConfidence(Number(e.target.value))}
            className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="font-mono font-bold text-slate-700 w-12 text-right">{agentConfidence}%</span>
        </div>
      </div>
    );

    // If timeout has occurred, show ONLY the Timeout alert
    if (recommendationTimeout) {
        return (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 shadow-lg animate-fade-in-up mb-6 ring-1 ring-orange-500/20" role="alert">
                <div className="flex items-start space-x-3 mb-4">
                    <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
                        <Clock size={24} aria-hidden="true" />
                    </div>
                    <div>
                        <h3 className="font-bold text-orange-800">Timeout: Action Required</h3>
                        <p className="text-sm text-orange-700 mt-1 leading-relaxed">
                            No action was taken. Terra strongly recommends rolling back to ensure system stability.
                        </p>
                    </div>
                </div>
                
                {renderConfidenceInput('text-orange-700')}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button 
                        onClick={handleRollbackClick}
                        className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg shadow-md transition-all flex items-center justify-center space-x-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    >
                        <RotateCcw size={18} aria-hidden="true" />
                        <span>Rollback to v2.1</span>
                    </button>
                    <button 
                        onClick={handleContinueRollout}
                        className="w-full py-3 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                    >
                        Continue Rollout
                    </button>
                </div>
            </div>
        );
    }

    // Otherwise, show the Standard Action alert
    return (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 shadow-lg animate-pulse-slow ring-1 ring-red-500/20 mb-6" role="alert">
            <div className="flex items-start space-x-3 mb-4">
                <div className="bg-red-100 p-2 rounded-lg text-red-600">
                    <AlertOctagon size={24} aria-hidden="true" />
                </div>
                <div>
                    <h3 className="font-bold text-red-700">Action Required</h3>
                    <p className="text-sm text-red-600/90 mt-1 leading-relaxed">Terra recommends immediate rollback due to high-risk anomaly.</p>
                </div>
            </div>

            {renderConfidenceInput('text-red-700')}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button 
                    onClick={handleRollbackClick}
                    className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg shadow-md shadow-red-600/20 transition-all flex items-center justify-center space-x-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-white"
                >
                    <RotateCcw size={18} aria-hidden="true" />
                    <span>Rollback to v2.1</span>
                </button>
                <button 
                    onClick={handleContinueRollout}
                    className="w-full py-3 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-white"
                >
                    Continue Rollout
                </button>
            </div>
        </div>
    );
  };

  // --- Tour Overlay Render ---
  const renderTour = () => {
    if (!isTourActive) return null;

    const step = TOUR_STEPS[tourStepIndex];
    const isModal = !step.targetId;

    return (
      <div className="fixed inset-0 z-[100] overflow-hidden pointer-events-none">
        {/* Dim Background */}
        <div className="absolute inset-0 bg-slate-900/60 transition-opacity duration-500 pointer-events-auto"></div>

        {/* Spotlight Effect (if target exists) */}
        {tourRect && (
          <div 
            className="absolute bg-transparent shadow-[0_0_0_9999px_rgba(15,23,42,0.6)] rounded-lg transition-all duration-300 ease-in-out pointer-events-none ring-2 ring-white/20"
            style={{
              top: tourRect.top - 8,
              left: tourRect.left - 8,
              width: tourRect.width + 16,
              height: tourRect.height + 16,
            }}
          />
        )}

        {/* Tooltip Card */}
        <div 
          className={`absolute pointer-events-auto flex flex-col items-center justify-center transition-all duration-300 ${isModal ? 'inset-0' : ''}`}
          style={!isModal && tourRect ? {
            top: step.position === 'top' ? tourRect.top - 200 : 
                 step.position === 'bottom' ? tourRect.bottom + 24 :
                 tourRect.top + 24, // Fallback vertically
            left: step.position === 'right' ? tourRect.right + 24 : 
                  step.position === 'left' ? tourRect.left - 340 : 
                  tourRect.left + (tourRect.width / 2) - 160,
          } : {}}
        >
          <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full animate-scale-in border border-slate-100 relative">
             {/* Progress Dots */}
             <div className="flex justify-center space-x-1.5 mb-4">
               {TOUR_STEPS.map((_, i) => (
                 <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === tourStepIndex ? 'w-6 bg-blue-600' : 'w-1.5 bg-slate-200'}`} />
               ))}
             </div>

             <div className="text-center mb-6">
               <h3 className="text-xl font-bold text-slate-900 mb-2">{step.title}</h3>
               <p className="text-slate-600 leading-relaxed text-sm">{step.content}</p>
             </div>

             <div className="flex space-x-3">
               <button 
                 onClick={handleSkipTour}
                 className="flex-1 py-2.5 text-slate-500 font-medium hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-colors text-sm"
               >
                 Skip Tour
               </button>
               <button 
                 onClick={handleTourNext}
                 className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all text-sm flex items-center justify-center gap-2"
               >
                 {tourStepIndex === TOUR_STEPS.length - 1 ? 'Get Started' : 'Next'} <ChevronRight size={16} />
               </button>
             </div>
             
             {/* Pointer arrow if not modal */}
             {!isModal && (
                <div 
                  className={`absolute w-4 h-4 bg-white transform rotate-45 border-l border-t border-slate-100 ${
                    step.position === 'top' ? 'bottom-[-8px] left-1/2 -translate-x-1/2 border-l-0 border-t-0 border-r border-b' :
                    step.position === 'bottom' ? 'top-[-8px] left-1/2 -translate-x-1/2' :
                    step.position === 'right' ? 'left-[-8px] top-8' :
                    'right-[-8px] top-8 border-l-0 border-t-0 border-r border-b' // left
                  }`} 
                />
             )}
          </div>
        </div>
      </div>
    );
  };

  // --- Render ---

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-900 bg-slate-50">
      
      {/* Tour Overlay */}
      {renderTour()}

      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
              <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-md shadow-blue-600/20">
                <Activity size={20} />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Model Release Orchestrator</h1>
            </div>
            <nav className="hidden md:flex space-x-1" role="tablist">
              {[
                {id: 'overview', label: 'Overview', icon: LayoutDashboard}, 
                {id: 'release', label: 'Release Console', icon: Terminal}, 
                {id: 'monitoring', label: 'Monitoring', icon: LineChart}, 
                {id: 'logs', label: 'Logs', icon: List}, 
                {id: 'settings', label: 'Settings', icon: Settings}
              ].map(tab => (
                <button 
                  key={tab.id}
                  id={`nav-${tab.id}`}
                  onClick={() => setActiveTab(tab.id as any)}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-white
                    ${activeTab === tab.id 
                      ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' 
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                >
                  <tab.icon size={16} aria-hidden="true" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center space-x-4">
             <button 
               onClick={() => { setTourStepIndex(0); setIsTourActive(true); }}
               className="p-2 text-slate-500 hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
               title="Restart Tour"
             >
               <HelpCircle size={20} />
             </button>
             <div className="flex items-center space-x-2 text-sm bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
                <span className="text-slate-500 font-medium">Active Model:</span>
                <span className="font-mono font-bold text-slate-800">
                  {activeModel}
                </span>
             </div>
             {/* Simple Status Indicator */}
             <div 
               className={`w-3 h-3 rounded-full ${networkEnabled ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500 animate-pulse'}`}
               role="status"
               aria-label={networkEnabled ? "System Online" : "System Offline"}
             ></div>
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Only show full grid layout if we are in Release Console, Monitoring, or Logs (when part of flow) */}
        {activeTab === 'overview' && <div className="col-span-12">{renderOverview()}</div>}
        {activeTab === 'settings' && <div className="col-span-12">{renderSettings()}</div>}
        
        {['release', 'monitoring', 'logs'].includes(activeTab) && (
        <>
            {/* Left Column: Context & Controls - Hidden on pure Monitoring tab to give more space */}
            {activeTab !== 'monitoring' && (
                <section className="lg:col-span-3 space-y-6">
                
                {/* Model Comparison Card */}
                <div id="card-model-comparison" className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                        <h2 className="font-semibold text-slate-800 flex items-center gap-2 relative z-10">
                            Model Comparison
                        </h2>
                        <div className="flex items-center space-x-2 relative z-10">
                            <button 
                                onClick={handleShareComparison}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                                aria-label="Share comparison view"
                                title="Share"
                            >
                                <Share2 size={16} />
                            </button>
                            <div className="h-4 w-[1px] bg-slate-200 mx-1"></div>
                            <span className="text-xs text-slate-500">vs v2.1</span>
                            <span className="text-xs font-bold px-2 py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-100">v3.0</span>
                        </div>
                    </div>
                    
                    <div className="divide-y divide-slate-100">
                        {[
                            { label: 'Accuracy', base: BASELINE_MODEL.accuracy, cand: CANDIDATE_MODEL.accuracy, format: (v: number) => v.toFixed(3), inverse: false },
                            { label: 'Recall', base: BASELINE_MODEL.recall, cand: CANDIDATE_MODEL.recall, format: (v: number) => v.toFixed(2), inverse: false },
                            { label: 'Latency (P95)', base: BASELINE_MODEL.latency_ms, cand: CANDIDATE_MODEL.latency_ms, format: (v: number) => `${v}ms`, inverse: true },
                            { label: 'Fairness', base: BASELINE_MODEL.fairness, cand: CANDIDATE_MODEL.fairness, format: (v: number) => v.toFixed(3), inverse: false },
                        ].map((item) => {
                            const diff = item.cand - item.base;
                            const pct = ((diff / item.base) * 100);
                            const isBetter = item.inverse ? diff < 0 : diff > 0;
                            const isNeutral = Math.abs(diff) < 0.0001; // Handle effectively zero diffs
                            
                            return (
                                <div key={item.label} className="p-4 hover:bg-slate-50 transition-colors grid grid-cols-12 gap-2 items-center group">
                                    {/* Label */}
                                    <div className="col-span-4">
                                        <p className="text-sm font-medium text-slate-500 group-hover:text-slate-800 transition-colors">{item.label}</p>
                                    </div>
                                    
                                    {/* Values */}
                                    <div className="col-span-5 flex items-center space-x-2">
                                        <div className="text-right">
                                            <p className="text-xs text-slate-500 line-through decoration-slate-300">{item.format(item.base)}</p>
                                        </div>
                                        <ArrowRight size={12} className="text-slate-400 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-bold font-mono text-slate-800">{item.format(item.cand)}</p>
                                        </div>
                                    </div>

                                    {/* Diff Badge */}
                                    <div className="col-span-3 flex justify-end">
                                        <div className={`flex items-center px-2 py-1 rounded text-[10px] font-bold border whitespace-nowrap
                                            ${isNeutral 
                                                ? 'bg-slate-100 text-slate-500 border-slate-200'
                                                : isBetter 
                                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                                    : 'bg-rose-50 text-rose-600 border-rose-100'
                                            }`}>
                                            {diff > 0 ? '+' : ''}{pct.toFixed(1)}%
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="p-4 bg-slate-50 border-t border-slate-100">
                    {phase === AppPhase.IDLE ? (
                        <button 
                        id="btn-start-release"
                        onClick={handleStartGuided}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-md shadow-blue-600/20 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white flex items-center justify-center gap-2 group relative overflow-hidden"
                        >
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-blue-400/20 to-blue-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                        <Play size={18} fill="currentColor" aria-hidden="true" />
                        Start Guided Release
                        </button>
                    ) : (
                        <div className="flex items-center justify-center space-x-2 text-blue-600 font-medium py-2 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
                        <span>Release in Progress</span>
                        </div>
                    )}
                    </div>
                </div>

                {/* Guided Flow Controls */}
                {(phase === AppPhase.SHADOW_TEST || phase === AppPhase.CANARY_SETUP) && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 animate-fade-in-up ring-1 ring-blue-100">
                        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <Settings size={18} className="text-slate-500" aria-hidden="true" />
                        Canary Configuration
                        </h3>
                        
                        {phase === AppPhase.SHADOW_TEST && (
                        <div className="flex flex-col items-center justify-center py-6 space-y-4" role="status" aria-busy="true">
                            {shadowTestStatus === 'running' ? (
                                <div className="w-full space-y-4 px-2">
                                <div className="flex items-center justify-between text-sm text-slate-500 animate-pulse">
                                    <span className="flex items-center gap-2">
                                        <Activity size={16} className="text-blue-500"/> P95 Latency
                                    </span>
                                    <span className="font-mono text-slate-700 text-xs tracking-wider">CHECKING...</span>
                                </div>
                                <div className="flex items-center justify-between text-sm text-slate-500 animate-pulse delay-75">
                                    <span className="flex items-center gap-2">
                                        <AlertOctagon size={16} className="text-purple-500"/> Error Rates
                                    </span>
                                    <span className="font-mono text-slate-700 text-xs tracking-wider">VERIFYING...</span>
                                </div>
                                <div className="flex items-center justify-between text-sm text-slate-500 animate-pulse delay-150">
                                    <span className="flex items-center gap-2">
                                        <BarChart2 size={16} className="text-orange-500"/> Feature Drift
                                    </span>
                                    <span className="font-mono text-slate-700 text-xs tracking-wider">CALCULATING...</span>
                                </div>
                                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-center">
                                    <div className="flex items-center space-x-2 text-xs text-blue-600 font-medium">
                                        <div className="w-3 h-3 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                                        <span>Terra Agent Orchestrating...</span>
                                    </div>
                                </div>
                                </div>
                            ) : (
                                <div className="w-full animate-fade-in text-center">
                                <div className="mx-auto w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-2 ring-1 ring-green-100">
                                    <Check size={20} aria-hidden="true" />
                                </div>
                                <p className="text-sm text-slate-700 font-medium mb-4">Shadow Test Passed</p>
                                <button 
                                    onClick={handleContinueToSetup}
                                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white"
                                >
                                    Continue to Setup <ArrowRight size={16} aria-hidden="true" />
                                </button>
                                </div>
                            )}
                        </div>
                        )}

                        {phase === AppPhase.CANARY_SETUP && (
                        <div className="space-y-4 animate-fade-in">
                            <div>
                            <label id="rollout-pct-label" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Rollout Percentage</label>
                            <div className="flex space-x-2" role="group" aria-labelledby="rollout-pct-label">
                                {[1, 5, 10].map(pct => (
                                <button
                                    key={pct}
                                    onClick={() => setCanaryPercent(pct)}
                                    aria-pressed={canaryPercent === pct}
                                    className={`flex-1 py-2 text-sm font-medium border rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white
                                    ${canaryPercent === pct 
                                        ? 'border-blue-500 bg-blue-50 text-blue-600 ring-1 ring-blue-200 shadow-sm' 
                                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
                                >
                                    {pct}%
                                    {pct === 5 && <span className="block text-[10px] text-blue-500 font-normal">Rec. by Terra</span>}
                                </button>
                                ))}
                            </div>
                            </div>

                            <div>
                            <label htmlFor="duration-input" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Duration (min)</label>
                            <input 
                                id="duration-input"
                                type="number" 
                                value={rolloutDuration}
                                onChange={(e) => setRolloutDuration(parseInt(e.target.value))}
                                className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white transition-shadow"
                            />
                            </div>

                            <button 
                            onClick={handleStartCanary}
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg shadow-blue-600/20 mt-2 flex items-center justify-center space-x-2 transform active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white"
                            >
                            <Zap size={16} fill="currentColor" aria-hidden="true" />
                            <span>Start 5% Canary Rollout</span>
                            </button>
                        </div>
                        )}
                    </div>
                )}

                {/* Decision Box (Visible during Anomaly) - Left Column Version */}
                {(phase === AppPhase.ANOMALY_DETECTED) && renderDecisionBox()}

                {phase === AppPhase.ROLLED_BACK && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 shadow-md animate-fade-in ring-1 ring-green-100">
                    <div className="flex items-center space-x-3 mb-4">
                        <div className="bg-green-100 p-2 rounded-full text-green-600">
                            <Check size={20} aria-hidden="true" />
                        </div>
                        <div>
                        <h3 className="font-bold text-green-700">Safe State Restored</h3>
                        <p className="text-xs text-green-600">v2.1 is live for 100% of traffic.</p>
                        </div>
                    </div>
                    <button 
                        id="gen-notes-btn"
                        onClick={generateNotes}
                        className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg shadow-md shadow-green-600/20 flex items-center justify-center space-x-2 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-white"
                    >
                        <FileText size={18} aria-hidden="true" />
                        <span>Generate Release Notes</span>
                    </button>
                    </div>
                )}

                </section>
            )}

            {/* Middle Column: Monitoring Dashboard - Expands on Monitoring tab */}
            <section className={`${activeTab === 'monitoring' ? 'lg:col-span-9' : 'lg:col-span-6'} space-y-6`}>
            
            {activeTab === 'logs' ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[500px] flex flex-col">
                    <div className="p-4 border-b border-slate-200 font-semibold text-slate-800 flex items-center space-x-2 bg-slate-50/50">
                    <List size={18} className="text-slate-500" /> <span>Audit Logs</span>
                    </div>
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium">
                            <tr>
                            <th className="px-4 py-3">Timestamp</th>
                            <th className="px-4 py-3">Event</th>
                            <th className="px-4 py-3">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {logs.map(log => (
                            <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono text-xs">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize border
                                    ${log.type === 'error' ? 'bg-red-50 text-red-600 border-red-100' :
                                        log.type === 'warning' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                                        log.type === 'success' ? 'bg-green-50 text-green-600 border-green-100' :
                                        'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                    {log.event}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-slate-600">{log.details}</td>
                            </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                </div>
            ) : (
                <>
                {/* Empty State for Monitoring Tab if IDLE */}
                {activeTab === 'monitoring' && phase === AppPhase.IDLE ? (
                    <div className="flex flex-col items-center justify-center h-[500px] bg-white border border-slate-200 rounded-xl p-8 text-center animate-fade-in shadow-sm">
                        <div className="bg-slate-50 p-6 rounded-full mb-6">
                            <LineChart size={48} className="text-slate-400" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">No Active Monitoring Session</h3>
                        <p className="text-slate-500 max-w-md mb-8">
                            Start a guided canary release to begin streaming real-time metrics and anomalies.
                        </p>
                        <button 
                             onClick={() => { setActiveTab('release'); handleStartGuided(); }}
                             className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg shadow-md flex items-center gap-2 transition-colors"
                        >
                            <Play size={18} /> Start New Release
                        </button>
                    </div>
                ) : (
                    <>
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                        <BarChart2 className="text-blue-600" size={20} aria-hidden="true" />
                        <span>Live Monitoring</span>
                        </h2>
                        <div className="flex items-center space-x-2">
                            {!networkEnabled && (
                            <span className="flex items-center space-x-1 text-red-600 text-xs font-bold px-3 py-1 bg-red-50 rounded-full border border-red-100 animate-pulse" role="status">
                                <WifiOff size={12} /> <span>OFFLINE</span>
                            </span>
                            )}
                            <button 
                            onClick={replayTimeline}
                            disabled={phase !== AppPhase.ROLLED_BACK && phase !== AppPhase.ANOMALY_DETECTED}
                            aria-label="Replay last 30 seconds"
                            className="text-xs font-medium text-slate-500 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-500 flex items-center space-x-1 px-2 py-1 hover:bg-slate-100 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-white"
                            >
                            <RotateCcw size={12} aria-hidden="true" /> <span>Replay</span>
                            </button>
                        </div>
                    </div>

                    {/* Show Decision Box in Middle Column if in Monitoring Tab and Anomaly Active */}
                    {activeTab === 'monitoring' && phase === AppPhase.ANOMALY_DETECTED && renderDecisionBox()}
                    
                    {/* Metrics Grid */}
                    <div className="space-y-4">
                        <LiveChart 
                            data={metrics} 
                            dataKey="latency" 
                            color={COLORS.primary} 
                            label="P95 Latency" 
                            unit="ms" 
                            baselineValue={BASELINE_MODEL.latency_ms}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <LiveChart 
                                data={metrics} 
                                dataKey="error_rate" 
                                color={COLORS.danger} 
                                label="Error Rate" 
                                unit="%" 
                                baselineValue={INITIAL_METRICS_STATE.error_rate}
                                maxValue={0.05}
                            />
                            <LiveChart 
                                data={metrics} 
                                dataKey="drift_user_region" 
                                color={COLORS.warning} 
                                label="Drift (Region)" 
                                unit="" 
                                baselineValue={INITIAL_METRICS_STATE.drifts.user_region}
                                maxValue={0.5}
                            />
                        </div>
                    </div>

                    {/* Root Cause Analysis Section - Only visible on Anomaly */}
                    {(phase === AppPhase.ANOMALY_DETECTED || phase === AppPhase.ROLLED_BACK) && (
                        <div className="bg-white rounded-xl shadow-lg border border-purple-100 p-6 mt-4 animate-fade-in-up relative overflow-hidden group">
                            {/* Background decoration */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-purple-100/50 transition-colors"></div>

                            <div className="flex items-center justify-between mb-4 relative z-10">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-purple-50 rounded-lg text-purple-600 shadow-sm border border-purple-100">
                                <BrainCircuit size={20} aria-hidden="true" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg">Analysis Result</h3>
                                    <p className="text-xs text-purple-600 font-semibold tracking-wide uppercase">Root Cause Identified</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-1.5 px-3 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full shadow-lg shadow-purple-600/20">
                                <Bot size={12} className="text-white" aria-hidden="true" />
                                <span className="text-[10px] font-bold tracking-wide">GEMINI 2.5</span>
                            </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm relative z-10">
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-2">Symptom</p>
                                <div className="flex items-center space-x-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                                    <p className="font-medium text-slate-700">High Latency (+22%) in <code className="bg-white px-1.5 py-0.5 border border-slate-200 rounded text-red-600 font-mono text-xs">getUserRegion</code></p>
                                </div>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-2">Correlation</p>
                                <div className="flex items-center space-x-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                                    <p className="font-medium text-slate-700">Region Drift: Europe-West (18%)</p>
                                </div>
                            </div>
                            <div className="col-span-1 md:col-span-2 space-y-2 mt-2 p-4 bg-purple-50 rounded-lg border border-purple-100">
                                <p className="text-purple-600 text-[10px] uppercase font-bold tracking-wider mb-1 flex items-center gap-1">
                                    <Search size={10} aria-hidden="true" /> AI Diagnosis
                                </p>
                                <p className="text-slate-600 leading-relaxed text-sm">
                                    Log traces indicate an unoptimized <span className="font-mono text-red-600 font-semibold">JOIN</span> operation in the v3.0 logic specifically for EU region payloads. 
                                    This explains the correlation between the region drift and the latency spike.
                                </p>
                            </div>
                            </div>
                        </div>
                    )}

                    {/* Timeline visualizer (simple bar) */}
                    <div className="h-1.5 bg-slate-200 rounded-full w-full overflow-hidden mt-6 relative" role="progressbar" aria-valuenow={Math.min(100, (metrics.length / 30) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Monitoring timeline progress">
                        <div 
                            className="h-full bg-blue-600 transition-all duration-1000 ease-linear shadow-[0_0_10px_rgba(37,99,235,0.3)]"
                            style={{ width: `${Math.min(100, (metrics.length / 30) * 100)}%` }}
                        ></div>
                    </div>
                    </>
                )}
                </>
            )}

            </section>

            {/* Right Column: Agent Panel (Sticky) */}
             <aside className="lg:col-span-3 lg:h-[calc(100vh-100px)] lg:sticky lg:top-24">
            <div className="h-[600px] lg:h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col ring-1 ring-slate-100">
                <TerraPanel messages={messages} />
                
                {/* Agent Input Area */}
                <div className="p-3 bg-white border-t border-slate-200">
                    <form onSubmit={handleChatSubmit} className="relative flex items-center gap-2">
                        <button 
                            type="button" 
                            onClick={toggleListening}
                            className={`p-2 rounded-full transition-colors ${isListening ? 'text-red-600 bg-red-50 hover:bg-red-100 animate-pulse' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100'}`}
                            aria-label="Toggle voice input"
                        >
                            <Mic size={20} />
                        </button>
                        <input 
                            type="text" 
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder={isListening ? "Listening..." : "Ask Terra..."}
                            className="flex-1 bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-500"
                        />
                        <button 
                            type="submit" 
                            disabled={!chatInput.trim()} 
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Send message"
                        >
                            <Send size={20} />
                        </button>
                    </form>
                </div>
            </div>
            </aside>
        </>
        )}

      </main>

      {/* Rollback Confirmation Modal */}
      {showRollbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="rollback-title" aria-describedby="rollback-desc">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
             <div className="flex items-center space-x-3 text-red-600 mb-4 border-b border-red-50 pb-4">
               <div className="bg-red-50 p-2 rounded-full">
                 <ShieldAlert size={24} aria-hidden="true" />
               </div>
               <h3 id="rollback-title" className="text-lg font-bold text-slate-800">Confirm Rollback</h3>
             </div>
             
             <p id="rollback-desc" className="text-slate-600 mb-6 leading-relaxed">
               Are you sure? This will <strong>immediately restore v2.1</strong> for all traffic. The current canary deployment (v3.0) will be drained.
             </p>

             {/* Anomaly Summary Section */}
             <div className="bg-red-50 border border-red-100 rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold text-red-600 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertOctagon size={12} />
                        Triggering Anomalies
                    </span>
                    <span className="text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-600">
                        Terra Confidence: <span className="text-slate-900 font-bold">83%</span>
                    </span>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between text-sm items-center">
                        <span className="text-slate-500">Latency (P95)</span>
                        <span className="text-red-700 font-mono font-bold bg-white px-1.5 rounded border border-red-100">
                            {Math.round(metrics[metrics.length-1]?.latency || 256)}ms
                        </span>
                    </div>
                    <div className="flex justify-between text-sm items-center">
                        <span className="text-slate-500">Error Rate</span>
                        <span className="text-red-700 font-mono font-bold bg-white px-1.5 rounded border border-red-100">
                            {((metrics[metrics.length-1]?.error_rate || 0.019) * 100).toFixed(1)}%
                        </span>
                    </div>
                     <div className="flex justify-between text-sm items-center">
                        <span className="text-slate-500">Feature Drift (Region)</span>
                        <span className="text-red-700 font-mono font-bold bg-white px-1.5 rounded border border-red-100">
                             {(metrics[metrics.length-1]?.drift_user_region || 0.18).toFixed(2)}
                        </span>
                    </div>
                </div>
             </div>

             <div className="flex space-x-3">
               <button 
                 onClick={() => setShowRollbackModal(false)}
                 className="flex-1 py-2.5 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-white"
               >
                 Cancel
               </button>
               <button 
                 onClick={confirmRollback}
                 autoFocus
                 className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-500 shadow-lg shadow-red-600/20 transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-white"
               >
                 Confirm Rollback
               </button>
             </div>
          </div>
        </div>
      )}
      
      {/* Simple Release Notes Preview Modal */}
       {showReleaseNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="notes-title">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-lg w-full p-6 animate-scale-in relative">
             <button 
                onClick={() => setShowReleaseNotes(false)} 
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white rounded-md"
                aria-label="Close"
             >
                <X size={20} aria-hidden="true" />
             </button>
             <h3 id="notes-title" className="text-lg font-bold text-slate-800 mb-4 flex items-center"><FileText size={20} className="mr-2 text-blue-600" aria-hidden="true"/> Release Notes Preview</h3>
             <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
               <pre className="text-xs font-mono text-slate-600 overflow-auto whitespace-pre-wrap font-medium">
{`RELEASE NOTES - INCIDENT REPORT
Date: ${new Date().toLocaleDateString()}
Target: v3.0 -> Rolled back to v2.1
Status: ROLLED BACK

INCIDENT DETAILS
----------------
Metric Anomaly Detected during 5% Canary.
- Latency Drift: +22% (Critical)
- Feature Drift (user_region): 18%
- Error Rate: 1.9%

ROOT CAUSE ANALYSIS (Gemini 2.5)
--------------------------------
Trace logs indicate inefficient JOIN in EU region logic.

ACTION TAKEN
------------
Manual Rollback Confirmed by User.
Agent Confidence: 83%`}
               </pre>
             </div>
             <div className="mt-6 flex justify-end space-x-3">
                <button 
                  className="px-4 py-2 text-blue-600 text-sm font-medium hover:bg-blue-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white"
                  onClick={() => {
                     const notes = `RELEASE NOTES...`; // In real app, write to clipboard
                     alert("Notes copied to clipboard!");
                  }}
                >
                  Copy to Clipboard
                </button>
                <button 
                  onClick={() => setShowReleaseNotes(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white"
                >
                  Close
                </button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}