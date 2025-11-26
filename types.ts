export enum AppPhase {
  IDLE = 'IDLE',
  SHADOW_TEST = 'SHADOW_TEST',
  CANARY_SETUP = 'CANARY_SETUP',
  MONITORING = 'MONITORING',
  ANOMALY_DETECTED = 'ANOMALY_DETECTED',
  ROLLBACK_CONFIRM = 'ROLLBACK_CONFIRM',
  ROLLED_BACK = 'ROLLED_BACK',
}

export interface ModelData {
  version: string;
  accuracy: number;
  recall: number;
  latency_ms: number;
  fairness: number;
}

export interface MetricPoint {
  timestamp: number;
  timeLabel: string;
  latency: number;
  error_rate: number;
  drift_user_region: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  event: string;
  details: string;
  type: 'info' | 'warning' | 'error' | 'success';
}

export interface AgentMessage {
  id: string;
  text: string;
  timestamp: Date;
  sender: 'Terra' | 'System' | 'User';
  type?: 'normal' | 'alert' | 'recommendation' | 'success';
  metadata?: {
    confidence?: number;
    risk?: 'Low' | 'Medium' | 'High';
    primaryDrift?: string;
  };
}