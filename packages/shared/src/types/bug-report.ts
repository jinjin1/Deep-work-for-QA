import type { Environment } from './common';

export interface ConsoleEntry {
  timestamp: number;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  stack_trace?: string;
  source_url?: string;
  line_number?: number;
}

export interface NetworkEntry {
  timestamp: number;
  method: string;
  url: string;
  status_code?: number;
  request_headers?: Record<string, string>;
  response_headers?: Record<string, string>;
  request_body?: string;
  response_body?: string;
  duration_ms?: number;
  error?: string;
}

export interface ReproStep {
  order: number;
  action: string;
  target: string;
  detail?: string;
  screenshot_url?: string;
}

export interface BugReport {
  id: string;
  project_id: string;
  reporter_id: string;
  title: string;
  description?: string;
  severity: 'critical' | 'major' | 'minor' | 'trivial';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  page_url: string;
  environment: Environment;
  console_logs: ConsoleEntry[];
  network_logs: NetworkEntry[];
  repro_steps?: ReproStep[];
  ai_summary?: string;
  recording_url?: string;
  screenshot_urls: string[];
  session_id?: string;
  visual_diff_id?: string;
  linear_issue_id?: string;
  linear_issue_url?: string;
  created_at: string;
  updated_at: string;
}
