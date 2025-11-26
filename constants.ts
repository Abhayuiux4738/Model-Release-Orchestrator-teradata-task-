import { ModelData } from './types';

export const BASELINE_MODEL: ModelData = { 
  version: "v2.1", 
  accuracy: 0.842, 
  recall: 0.72, 
  latency_ms: 210, 
  fairness: 0.91 
};

export const CANDIDATE_MODEL: ModelData = { 
  version: "v3.0", 
  accuracy: 0.895, 
  recall: 0.79, 
  latency_ms: 232, 
  fairness: 0.898 
};

export const INITIAL_METRICS_STATE = {
  latency_ms: 210,
  error_rate: 0.008,
  drifts: { user_region: 0.02, device_type: 0.01 },
};

// Simulation Constants
export const ANOMALY_TICK_INDEX = 3; 
export const TICK_INTERVAL_MS = 1000;

// Anomaly Values
export const ANOMALY_VALUES = {
  latency: Math.round(BASELINE_MODEL.latency_ms * 1.22), // 256
  drift_user_region: 0.18,
  error_rate: 0.019
};

// Colors (Light Theme Adjusted)
export const COLORS = {
  primary: '#2563eb', // blue-600
  success: '#16a34a', // green-600
  warning: '#d97706', // amber-600
  danger: '#dc2626', // red-600
  muted: '#94a3b8',   // slate-400
  bg: '#f8fafc',      // slate-50
  grid: '#e2e8f0',    // slate-200
  text: '#334155'     // slate-700
};