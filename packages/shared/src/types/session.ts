import type { Environment } from './common';

export type AnomalyType =
  | 'error'
  | 'rage_click'
  | 'dead_click'
  | 'long_wait'
  | 'unexpected_nav'
  | 'network_error';

export type AnomalySeverity = 'high' | 'medium' | 'low';

export interface Anomaly {
  id: string;
  session_id: string;
  type: AnomalyType;
  timestamp_start: number;
  timestamp_end: number;
  severity: AnomalySeverity;
  description: string;
  related_events: SessionEventData[];
  screenshot_url?: string;
}

export type SessionEventType = 'page_visit' | 'user_mark' | 'anomaly_detected';

export interface SessionEventData {
  type: string;
  timestamp: number;
  target?: string;
  url?: string;
  status?: number;
  data?: Record<string, unknown>;
}

export interface SessionEvent {
  session_id: string;
  timestamp: number;
  type: SessionEventType;
  data: Record<string, unknown>;
}

export interface SessionBookmark {
  id: string;
  session_id: string;
  timestamp: number;
  label?: string;
  created_by: string;
  created_at: string;
}

export interface SessionTag {
  id: string;
  session_id: string;
  name: string;
}

export interface SessionMetadata {
  total_duration_ms: number;
  page_count: number;
  error_count: number;
  anomaly_count: number;
}

export interface CausalChain {
  cause: string;
  effect: string;
  explanation: string;
}

export interface AiAnalysisResult {
  session_id: string;
  ai_analysis_status: 'pending' | 'processing' | 'completed' | 'failed';
  anomalies: Anomaly[];
  session_summary?: string;
  causal_chain?: CausalChain[];
}

export interface Session {
  id: string;
  project_id: string;
  user_id: string;
  start_url: string;
  duration_ms: number;
  page_count: number;
  event_count: number;
  environment: Environment;
  events_url: string;
  anomalies: Anomaly[];
  ai_analysis_status: 'pending' | 'processing' | 'completed' | 'failed';
  session_summary?: string;
  tags?: SessionTag[];
  bookmarks?: SessionBookmark[];
  bug_report_ids: string[];
  created_at: string;
}
