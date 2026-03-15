import { v4 as uuid } from 'uuid';

interface AnomalyEvent {
  type: string;
  timestamp: number;
  target?: string;
  url?: string;
  data?: Record<string, unknown>;
}

interface ConsoleLog {
  timestamp: number;
  level: string;
  message: string;
  stack?: string;
}

interface NetworkLog {
  timestamp: number;
  name: string;
  method: string;
  duration: number;
  responseStatus: number;
  initiatorType?: string;
}

interface Anomaly {
  id: string;
  type: string;
  timestamp_start: number;
  timestamp_end: number;
  severity: 'critical' | 'major' | 'minor';
  description: string;
  related_events: number[];
}

interface CausalChain {
  id: string;
  anomaly_ids: string[];
  description: string;
}

interface AnalysisResult {
  anomalies: Anomaly[];
  session_summary: string;
  causal_chain: CausalChain[];
}

export function detectAnomalies(
  events: AnomalyEvent[],
  consoleLogs: ConsoleLog[],
  networkLogs: NetworkLog[],
  durationMs: number,
): AnalysisResult {
  const anomalies: Anomaly[] = [];

  // Detect rapid clicks (rage clicks)
  const clickEvents = events.filter(e => e.type === 'click');
  for (let i = 0; i < clickEvents.length - 2; i++) {
    const window3 = clickEvents.slice(i, i + 3);
    if (window3.length === 3 && window3[2].timestamp - window3[0].timestamp < 2000) {
      const sameTarget = window3[0].target && window3.every(e => e.target === window3[0].target);
      if (sameTarget) {
        anomalies.push({
          id: uuid(),
          type: 'rage_click',
          timestamp_start: window3[0].timestamp,
          timestamp_end: window3[2].timestamp,
          severity: 'major',
          description: `Rapid repeated clicks on "${window3[0].target}" (${window3.length} clicks in ${window3[2].timestamp - window3[0].timestamp}ms)`,
          related_events: window3.map((_, idx) => i + idx),
        });
        i += 2; // skip ahead
      }
    }
  }

  // Detect console errors
  const errorLogs = consoleLogs.filter(l => l.level === 'error');
  for (const log of errorLogs) {
    anomalies.push({
      id: uuid(),
      type: 'console_error',
      timestamp_start: log.timestamp,
      timestamp_end: log.timestamp,
      severity: log.message.includes('TypeError') || log.message.includes('ReferenceError') ? 'critical' : 'major',
      description: log.message,
      related_events: [],
    });
  }

  // Detect failed network requests
  const failedRequests = networkLogs.filter(n => n.responseStatus >= 400);
  for (const req of failedRequests) {
    anomalies.push({
      id: uuid(),
      type: 'network_error',
      timestamp_start: req.timestamp,
      timestamp_end: req.timestamp + req.duration,
      severity: req.responseStatus >= 500 ? 'critical' : 'major',
      description: `${req.method} ${req.name} returned ${req.responseStatus} (${req.duration}ms)`,
      related_events: [],
    });
  }

  // Detect slow network requests (>3s)
  const slowRequests = networkLogs.filter(n => n.duration > 3000 && n.responseStatus < 400);
  for (const req of slowRequests) {
    anomalies.push({
      id: uuid(),
      type: 'slow_request',
      timestamp_start: req.timestamp,
      timestamp_end: req.timestamp + req.duration,
      severity: 'minor',
      description: `Slow request: ${req.method} ${req.name} took ${req.duration}ms`,
      related_events: [],
    });
  }

  // Build causal chains (group temporally close anomalies)
  const causalChains: CausalChain[] = [];
  const sorted = [...anomalies].sort((a, b) => a.timestamp_start - b.timestamp_start);
  let chain: Anomaly[] = [];
  for (const a of sorted) {
    if (chain.length === 0 || a.timestamp_start - chain[chain.length - 1].timestamp_end < 2000) {
      chain.push(a);
    } else {
      if (chain.length > 1) {
        causalChains.push({
          id: uuid(),
          anomaly_ids: chain.map(c => c.id),
          description: `Chain of ${chain.length} related issues: ${chain.map(c => c.type).join(' -> ')}`,
        });
      }
      chain = [a];
    }
  }
  if (chain.length > 1) {
    causalChains.push({
      id: uuid(),
      anomaly_ids: chain.map(c => c.id),
      description: `Chain of ${chain.length} related issues: ${chain.map(c => c.type).join(' -> ')}`,
    });
  }

  // Summary
  const critCount = anomalies.filter(a => a.severity === 'critical').length;
  const majCount = anomalies.filter(a => a.severity === 'major').length;
  const summary = anomalies.length === 0
    ? 'Clean session with no anomalies detected.'
    : `Found ${anomalies.length} anomalies (${critCount} critical, ${majCount} major) across ${(durationMs / 1000).toFixed(0)}s session.`;

  return {
    anomalies,
    session_summary: summary,
    causal_chain: causalChains,
  };
}
