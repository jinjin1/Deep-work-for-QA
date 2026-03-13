import { v4 as uuid } from 'uuid';

export interface DetectedAnomaly {
  id: string;
  type: 'error' | 'rage_click' | 'dead_click' | 'long_wait' | 'unexpected_nav' | 'network_error';
  timestamp_start: number;
  timestamp_end: number;
  severity: 'high' | 'medium' | 'low';
  description: string;
  related_events: EventData[];
}

export interface EventData {
  type: string;
  timestamp: number;
  target?: string;
  url?: string;
  status?: number;
  data?: Record<string, unknown>;
}

export interface ConsoleLog {
  timestamp: number;
  level: string;
  message: string;
  stack?: string;
}

export interface NetworkLog {
  timestamp: number;
  name: string;
  initiatorType?: string;
  duration: number;
  transferSize?: number;
  responseStatus?: number;
  method?: string;
  url?: string;
  status?: number;
}

interface CausalChain {
  cause: string;
  effect: string;
  explanation: string;
}

export interface AnalysisResult {
  anomalies: DetectedAnomaly[];
  session_summary: string;
  causal_chain: CausalChain[];
}

/**
 * Phase 1: Rule-based anomaly detection engine
 * Analyzes session events, console logs, and network logs to detect anomaly patterns.
 */
export function detectAnomalies(
  events: EventData[],
  consoleLogs: ConsoleLog[],
  networkLogs: NetworkLog[],
  durationMs: number,
): AnalysisResult {
  const anomalies: DetectedAnomaly[] = [];

  // 1. Detect console errors
  detectErrors(consoleLogs, anomalies);

  // 2. Detect rage clicks (3+ clicks on same area within 1 second)
  detectRageClicks(events, anomalies);

  // 3. Detect dead clicks (click with no DOM change within 500ms)
  detectDeadClicks(events, anomalies);

  // 4. Detect long waits (page load or API response > 5 seconds)
  detectLongWaits(networkLogs, anomalies);

  // 5. Detect unexpected navigation (404/500 pages)
  detectUnexpectedNav(events, networkLogs, anomalies);

  // 6. Detect network errors (4xx/5xx responses)
  detectNetworkErrors(networkLogs, anomalies);

  // Sort anomalies by timestamp
  anomalies.sort((a, b) => a.timestamp_start - b.timestamp_start);

  // Build causal chains
  const causalChain = buildCausalChains(anomalies);

  // Generate session summary
  const sessionSummary = generateSummary(anomalies, causalChain, durationMs, events.length);

  return {
    anomalies,
    session_summary: sessionSummary,
    causal_chain: causalChain,
  };
}

function detectErrors(consoleLogs: ConsoleLog[], anomalies: DetectedAnomaly[]): void {
  for (const log of consoleLogs) {
    if (log.level === 'error') {
      anomalies.push({
        id: uuid(),
        type: 'error',
        timestamp_start: log.timestamp,
        timestamp_end: log.timestamp + 100,
        severity: 'high',
        description: `JS 런타임 에러 발생: ${log.message.slice(0, 200)}`,
        related_events: [{
          type: 'console_error',
          timestamp: log.timestamp,
          data: { message: log.message, stack: log.stack },
        }],
      });
    }
  }
}

function detectRageClicks(events: EventData[], anomalies: DetectedAnomaly[]): void {
  const clicks = events.filter(e => e.type === 'click');

  for (let i = 0; i < clicks.length - 2; i++) {
    const window: EventData[] = [clicks[i]];

    for (let j = i + 1; j < clicks.length; j++) {
      if (clicks[j].timestamp - clicks[i].timestamp <= 1000) {
        window.push(clicks[j]);
      } else {
        break;
      }
    }

    if (window.length >= 3) {
      // Check if clicks are on the same target area
      const sameTarget = window.every(c => c.target === window[0].target);
      if (sameTarget || window.length >= 4) {
        const start = window[0].timestamp;
        const end = window[window.length - 1].timestamp;

        // Avoid duplicate detection for overlapping windows
        const alreadyDetected = anomalies.some(
          a => a.type === 'rage_click' && Math.abs(a.timestamp_start - start) < 500
        );
        if (!alreadyDetected) {
          anomalies.push({
            id: uuid(),
            type: 'rage_click',
            timestamp_start: start,
            timestamp_end: end,
            severity: 'medium',
            description: `유저가 '${window[0].target || 'element'}'을(를) ${(end - start) / 1000}초 동안 ${window.length}회 반복 클릭했습니다. 버튼이 비활성화 상태이거나 클릭 핸들러가 동작하지 않는 것으로 보입니다.`,
            related_events: window,
          });
        }
      }
    }
  }
}

function detectDeadClicks(events: EventData[], anomalies: DetectedAnomaly[]): void {
  const clicks = events.filter(e => e.type === 'click');

  for (const click of clicks) {
    // Check if any DOM mutation or navigation happened within 500ms after click
    const followUp = events.find(
      e => e.timestamp > click.timestamp &&
           e.timestamp <= click.timestamp + 500 &&
           (e.type === 'mutation' || e.type === 'navigation' || e.type === 'page_visit' || e.type === 'input')
    );

    if (!followUp) {
      // Also check if it's part of a rage click (skip if so)
      const isRageClick = anomalies.some(
        a => a.type === 'rage_click' &&
             click.timestamp >= a.timestamp_start &&
             click.timestamp <= a.timestamp_end
      );

      if (!isRageClick) {
        anomalies.push({
          id: uuid(),
          type: 'dead_click',
          timestamp_start: click.timestamp,
          timestamp_end: click.timestamp + 500,
          severity: 'medium',
          description: `'${click.target || 'element'}' 클릭 후 DOM 변경이나 네비게이션이 발생하지 않았습니다.`,
          related_events: [click],
        });
      }
    }
  }
}

function detectLongWaits(networkLogs: NetworkLog[], anomalies: DetectedAnomaly[]): void {
  for (const log of networkLogs) {
    if (log.duration > 5000) {
      anomalies.push({
        id: uuid(),
        type: 'long_wait',
        timestamp_start: log.timestamp,
        timestamp_end: log.timestamp + log.duration,
        severity: 'low',
        description: `${log.name || log.url || 'request'} 요청에 ${(log.duration / 1000).toFixed(1)}초가 소요되었습니다. 서버 응답이 느리거나 네트워크 문제가 있을 수 있습니다.`,
        related_events: [{
          type: 'network',
          timestamp: log.timestamp,
          url: log.name || log.url,
          data: { duration: log.duration, transferSize: log.transferSize },
        }],
      });
    }
  }
}

function detectUnexpectedNav(events: EventData[], networkLogs: NetworkLog[], anomalies: DetectedAnomaly[]): void {
  // Check for navigation to error pages (URL patterns)
  const errorPagePatterns = ['/404', '/500', '/error', '/not-found', '/server-error'];
  const navEvents = events.filter(e => e.type === 'page_visit' || e.type === 'navigation');

  for (const nav of navEvents) {
    const url = nav.url || '';
    const isErrorPage = errorPagePatterns.some(p => url.includes(p));

    if (isErrorPage) {
      anomalies.push({
        id: uuid(),
        type: 'unexpected_nav',
        timestamp_start: nav.timestamp,
        timestamp_end: nav.timestamp + 100,
        severity: 'high',
        description: `에러 페이지(${url})로 이동했습니다.`,
        related_events: [nav],
      });
    }
  }

  // Check network logs for document requests with error status codes
  for (const log of networkLogs) {
    const status = log.responseStatus || log.status || 0;
    if ((log.initiatorType === 'navigation' || log.initiatorType === 'document') && (status === 404 || status === 500)) {
      const alreadyDetected = anomalies.some(
        a => a.type === 'unexpected_nav' && Math.abs(a.timestamp_start - log.timestamp) < 1000
      );
      if (!alreadyDetected) {
        anomalies.push({
          id: uuid(),
          type: 'unexpected_nav',
          timestamp_start: log.timestamp,
          timestamp_end: log.timestamp + 100,
          severity: 'high',
          description: `페이지 요청이 ${status} 상태 코드로 실패했습니다: ${log.name || log.url}`,
          related_events: [{
            type: 'network',
            timestamp: log.timestamp,
            url: log.name || log.url,
            status,
          }],
        });
      }
    }
  }
}

function detectNetworkErrors(networkLogs: NetworkLog[], anomalies: DetectedAnomaly[]): void {
  for (const log of networkLogs) {
    const status = log.responseStatus || log.status || 0;
    if (status >= 400) {
      // Skip if already detected as unexpected_nav
      const alreadyDetected = anomalies.some(
        a => a.type === 'unexpected_nav' &&
             a.related_events.some(e => e.url === (log.name || log.url) && Math.abs(e.timestamp - log.timestamp) < 1000)
      );

      if (!alreadyDetected) {
        const severity = status >= 500 ? 'high' as const : 'medium' as const;
        anomalies.push({
          id: uuid(),
          type: 'network_error',
          timestamp_start: log.timestamp,
          timestamp_end: log.timestamp + (log.duration || 100),
          severity,
          description: `${log.method || 'GET'} ${log.name || log.url} 요청이 ${status} 에러로 실패했습니다.`,
          related_events: [{
            type: 'network',
            timestamp: log.timestamp,
            url: log.name || log.url,
            status,
            data: { method: log.method, duration: log.duration },
          }],
        });
      }
    }
  }
}

function buildCausalChains(anomalies: DetectedAnomaly[]): CausalChain[] {
  const chains: CausalChain[] = [];

  for (let i = 0; i < anomalies.length; i++) {
    for (let j = i + 1; j < anomalies.length; j++) {
      const cause = anomalies[i];
      const effect = anomalies[j];

      // If effect happened within 3 seconds of cause
      if (effect.timestamp_start - cause.timestamp_end <= 3000) {
        // network_error → rage_click
        if (cause.type === 'network_error' && effect.type === 'rage_click') {
          chains.push({
            cause: `${cause.type} (${cause.related_events[0]?.url || 'request'} → ${cause.related_events[0]?.status || 'error'})`,
            effect: `${effect.type} (${effect.description.slice(0, 50)}...)`,
            explanation: `서버 에러로 요청이 실패했지만 UI에 에러 피드백이 없어 유저가 반복 시도`,
          });
        }
        // error → rage_click
        else if (cause.type === 'error' && effect.type === 'rage_click') {
          chains.push({
            cause: `${cause.type} (${cause.description.slice(0, 50)})`,
            effect: `${effect.type} (${effect.description.slice(0, 50)}...)`,
            explanation: `JS 에러 발생 후 UI가 응답하지 않아 유저가 반복 클릭`,
          });
        }
        // network_error → error
        else if (cause.type === 'network_error' && effect.type === 'error') {
          chains.push({
            cause: `${cause.type} (${cause.related_events[0]?.url || 'request'})`,
            effect: `${effect.type} (${effect.description.slice(0, 50)})`,
            explanation: `네트워크 에러가 처리되지 않아 JS 런타임 에러로 이어짐`,
          });
        }
      }
    }
  }

  return chains;
}

function generateSummary(
  anomalies: DetectedAnomaly[],
  causalChain: CausalChain[],
  durationMs: number,
  eventCount: number,
): string {
  if (anomalies.length === 0) {
    return `총 ${(durationMs / 1000).toFixed(0)}초간의 세션에서 이상 패턴이 감지되지 않았습니다. ${eventCount}개의 이벤트가 정상적으로 기록되었습니다.`;
  }

  const typeCount: Record<string, number> = {};
  for (const a of anomalies) {
    typeCount[a.type] = (typeCount[a.type] || 0) + 1;
  }

  const highSeverity = anomalies.filter(a => a.severity === 'high').length;
  const typeSummary = Object.entries(typeCount)
    .map(([type, count]) => `${type}(${count}건)`)
    .join(', ');

  let summary = `총 ${(durationMs / 1000).toFixed(0)}초간의 세션에서 ${anomalies.length}건의 이상 패턴이 감지되었습니다: ${typeSummary}.`;

  if (highSeverity > 0) {
    summary += ` 이 중 ${highSeverity}건은 심각도 높음으로 분류됩니다.`;
  }

  if (causalChain.length > 0) {
    summary += ` ${causalChain.length}개의 인과관계 패턴이 발견되었습니다.`;
  }

  return summary;
}
