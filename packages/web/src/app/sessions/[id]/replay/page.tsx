'use client';

import { useEffect, useState, useCallback, useRef, use } from 'react';
import { fetchSession, fetchSessionEvents, fetchSessionAnomalies, addSessionBookmark, createBugReportFromSession, fetchSessionShareLink } from '@/lib/api';

interface Anomaly {
  id: string;
  type: string;
  timestamp_start: number;
  timestamp_end: number;
  severity: string;
  description: string;
  related_events: any[];
}

interface CausalChain {
  cause: string;
  effect: string;
  explanation: string;
}

interface SessionData {
  id: string;
  startUrl: string;
  durationMs: number;
  pageCount: number;
  eventCount: number;
  status: string;
  aiAnalysisStatus: string;
  sessionSummary?: string;
  environment: any;
  tags: { id: string; name: string }[];
  bookmarks: { id: string; timestamp: number; label?: string }[];
  anomalies: Anomaly[];
  causal_chain: CausalChain[];
  createdAt: string;
}

interface EventData {
  type: string;
  timestamp: number;
  target?: string;
  url?: string;
  data?: Record<string, unknown>;
}

type EventFilter = 'all' | 'click' | 'input' | 'scroll' | 'page_visit' | 'error' | 'network';

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const SEVERITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
};

const ANOMALY_TYPE_LABELS: Record<string, string> = {
  error: 'JS 에러',
  rage_click: '반복 클릭',
  dead_click: '무반응 클릭',
  long_wait: '긴 대기',
  unexpected_nav: '비정상 이동',
  network_error: '네트워크 에러',
};

const EVENT_TYPE_ICONS: Record<string, string> = {
  click: '👆',
  input: '⌨️',
  scroll: '📜',
  page_visit: '🌐',
  resize: '📐',
  error: '❌',
  network: '🌍',
  user_mark: '🔖',
};

export default function SessionReplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionData | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [consoleLogs, setConsoleLogs] = useState<any[]>([]);
  const [networkLogs, setNetworkLogs] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [causalChains, setCausalChains] = useState<CausalChain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playbackRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<'events' | 'console' | 'network' | 'anomalies'>('events');
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [showBugModal, setShowBugModal] = useState(false);
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const duration = session?.durationMs || 0;

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);
      const [sessionRes, eventsRes, anomaliesRes] = await Promise.all([
        fetchSession(id),
        fetchSessionEvents(id),
        fetchSessionAnomalies(id),
      ]);

      setSession(sessionRes.data);
      setEvents(eventsRes.data.events || []);
      setConsoleLogs(eventsRes.data.console_logs || []);
      setNetworkLogs(eventsRes.data.network_logs || []);
      setAnomalies(anomaliesRes.data.anomalies || []);
      setCausalChains(anomaliesRes.data.causal_chain || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }

  // Playback controls
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      if (playbackRef.current) clearInterval(playbackRef.current);
      playbackRef.current = null;
      setIsPlaying(false);
    } else {
      if (currentTime >= duration) setCurrentTime(0);
      setIsPlaying(true);
    }
  }, [isPlaying, currentTime, duration]);

  useEffect(() => {
    if (isPlaying) {
      playbackRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 50 * playbackSpeed;
          if (next >= duration) {
            if (playbackRef.current) clearInterval(playbackRef.current);
            setIsPlaying(false);
            return duration;
          }
          return next;
        });
      }, 50);
    }
    return () => {
      if (playbackRef.current) clearInterval(playbackRef.current);
    };
  }, [isPlaying, playbackSpeed, duration]);

  const seekTo = useCallback((time: number) => {
    setCurrentTime(Math.max(0, Math.min(time, duration)));
  }, [duration]);

  // Filter events
  const filteredEvents = events.filter((e) => {
    if (eventFilter === 'all') return true;
    if (eventFilter === 'error') return e.type === 'error' || e.type === 'console_error';
    if (eventFilter === 'network') return e.type === 'network';
    return e.type === eventFilter;
  });

  // Get events up to current time
  const activeEvents = filteredEvents.filter((e) => e.timestamp <= currentTime);

  // Get active anomaly at current time
  const activeAnomaly = anomalies.find(
    (a) => currentTime >= a.timestamp_start && currentTime <= a.timestamp_end,
  );

  // Console/network logs up to current time
  const activeConsoleLogs = consoleLogs.filter((l) => l.timestamp <= currentTime);
  const activeNetworkLogs = networkLogs.filter((l) => l.timestamp <= currentTime);

  async function handleAddBookmark() {
    try {
      await addSessionBookmark(id, { timestamp: currentTime, label: `Mark at ${formatMs(currentTime)}` });
      await loadData();
    } catch {
      // ignore
    }
  }

  async function handleCreateBugReport(anomalyId?: string) {
    try {
      const res = await createBugReportFromSession(id, {
        anomaly_id: anomalyId,
        title: anomalyId ? `Bug from anomaly: ${selectedAnomaly?.description?.slice(0, 50)}` : 'Bug from session',
      });
      alert(`Bug report created: ${res.data.bug_report_id}`);
      setShowBugModal(false);
    } catch {
      alert('Failed to create bug report');
    }
  }

  async function handleShare() {
    try {
      const res = await fetchSessionShareLink(id, currentTime > 0 ? currentTime : undefined);
      setShareUrl(res.data.url);
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(res.data.url);
      }
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-400">세션 데이터 로딩 중...</div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-red-500">{error || 'Session not found'}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-4">
          <a href="/sessions" className="text-gray-400 hover:text-gray-600">&larr;</a>
          <div>
            <h2 className="text-lg font-semibold">세션 리플레이</h2>
            <p className="text-xs text-gray-500 truncate max-w-md">{session.startUrl}</p>
          </div>
          <div className="flex gap-1">
            {session.tags?.map((t) => (
              <span key={t.id} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                {t.name}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddBookmark}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            🔖 북마크
          </button>
          <button
            onClick={handleShare}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            🔗 공유
          </button>
          <button
            onClick={() => setShowBugModal(true)}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700"
          >
            🐛 버그 리포트
          </button>
        </div>
      </div>

      {shareUrl && (
        <div className="px-4 py-2 bg-green-50 text-green-700 text-xs flex items-center justify-between border-b">
          <span>공유 링크가 클립보드에 복사되었습니다: {shareUrl}</span>
          <button onClick={() => setShareUrl(null)} className="text-green-500 hover:text-green-700">✕</button>
        </div>
      )}

      {/* AI Summary */}
      {session.sessionSummary && (
        <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100">
          <div className="flex items-start gap-2">
            <span className="text-sm">🤖</span>
            <div>
              <span className="text-xs font-medium text-indigo-700">AI 분석 요약</span>
              <p className="text-sm text-indigo-900 mt-0.5">{session.sessionSummary}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Timeline + Replay */}
        <div className="flex-1 flex flex-col">
          {/* Timeline */}
          <div className="px-4 py-3 border-b border-gray-200 bg-white">
            {/* Playback controls */}
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={togglePlay}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 text-sm"
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
              <span className="text-sm font-mono text-gray-600 w-24">
                {formatMs(currentTime)} / {formatMs(duration)}
              </span>
              <div className="flex items-center gap-1">
                {[0.5, 1, 2, 4].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`text-xs px-2 py-1 rounded ${
                      playbackSpeed === speed
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {/* Timeline bar */}
            <div className="relative h-10">
              {/* Progress bar */}
              <div
                className="absolute top-0 left-0 h-2 bg-gray-100 rounded-full w-full cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = (e.clientX - rect.left) / rect.width;
                  seekTo(ratio * duration);
                }}
              >
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>

              {/* Anomaly markers on timeline */}
              {anomalies.map((a) => {
                const left = duration > 0 ? (a.timestamp_start / duration) * 100 : 0;
                const width = duration > 0 ? Math.max(((a.timestamp_end - a.timestamp_start) / duration) * 100, 0.5) : 0;
                return (
                  <div
                    key={a.id}
                    className={`absolute top-0 h-2 rounded-full opacity-60 cursor-pointer ${
                      a.severity === 'high' ? 'bg-red-500' : a.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-400'
                    }`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={a.description}
                    onClick={() => seekTo(a.timestamp_start)}
                  />
                );
              })}

              {/* Bookmark markers */}
              {session.bookmarks?.map((b) => {
                const left = duration > 0 ? (b.timestamp / duration) * 100 : 0;
                return (
                  <div
                    key={b.id}
                    className="absolute top-3 w-3 h-3 -ml-1.5 cursor-pointer text-xs"
                    style={{ left: `${left}%` }}
                    title={b.label || `Bookmark at ${formatMs(b.timestamp)}`}
                    onClick={() => seekTo(b.timestamp)}
                  >
                    🔖
                  </div>
                );
              })}

              {/* Event dots */}
              <div className="absolute top-6 left-0 w-full h-3">
                {events.slice(0, 200).map((e, i) => {
                  const left = duration > 0 ? (e.timestamp / duration) * 100 : 0;
                  return (
                    <div
                      key={i}
                      className={`absolute w-1 h-1 rounded-full ${
                        e.type === 'click' ? 'bg-blue-400' : e.type === 'page_visit' ? 'bg-green-400' : 'bg-gray-300'
                      }`}
                      style={{ left: `${left}%` }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Active anomaly banner */}
          {activeAnomaly && (
            <div className={`px-4 py-2 border-b text-sm flex items-center justify-between ${SEVERITY_COLORS[activeAnomaly.severity]}`}>
              <div className="flex items-center gap-2">
                <span className="font-medium">{ANOMALY_TYPE_LABELS[activeAnomaly.type] || activeAnomaly.type}</span>
                <span>{activeAnomaly.description}</span>
              </div>
              <button
                onClick={() => { setSelectedAnomaly(activeAnomaly); setShowBugModal(true); }}
                className="text-xs px-2 py-1 bg-white/50 rounded hover:bg-white/80"
              >
                버그 리포트 생성
              </button>
            </div>
          )}

          {/* Event stream */}
          <div className="flex-1 overflow-y-auto px-4 py-2 bg-gray-50">
            <div className="flex gap-2 mb-3 sticky top-0 bg-gray-50 py-1 z-10">
              {(['all', 'click', 'input', 'page_visit', 'scroll', 'error', 'network'] as EventFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setEventFilter(f)}
                  className={`text-xs px-2 py-1 rounded ${
                    eventFilter === f ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {f === 'all' ? '전체' : f === 'click' ? '클릭' : f === 'input' ? '입력' : f === 'page_visit' ? '페이지' : f === 'scroll' ? '스크롤' : f === 'error' ? '에러' : '네트워크'}
                </button>
              ))}
            </div>
            <div className="space-y-1">
              {activeEvents.slice(-50).map((e, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-white border border-gray-100 cursor-pointer hover:bg-gray-50"
                  onClick={() => seekTo(e.timestamp)}
                >
                  <span className="text-gray-400 font-mono w-12">{formatMs(e.timestamp)}</span>
                  <span>{EVENT_TYPE_ICONS[e.type] || '📌'}</span>
                  <span className="font-medium text-gray-700">{e.type}</span>
                  {e.target && <span className="text-gray-500 truncate max-w-xs">{e.target}</span>}
                  {e.url && <span className="text-gray-500 truncate max-w-xs">{e.url}</span>}
                </div>
              ))}
              {activeEvents.length === 0 && (
                <div className="text-center text-gray-400 py-8 text-sm">
                  {currentTime === 0 ? '재생을 시작하면 이벤트가 표시됩니다' : '필터에 해당하는 이벤트가 없습니다'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-80 border-l border-gray-200 bg-white flex flex-col">
          {/* Tab bar */}
          <div className="flex border-b border-gray-200">
            {(['anomalies', 'console', 'network', 'events'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 text-xs py-2.5 border-b-2 ${
                  activeTab === tab
                    ? 'border-indigo-600 text-indigo-600 font-medium'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'anomalies'
                  ? `이상 (${anomalies.length})`
                  : tab === 'console'
                    ? `콘솔 (${consoleLogs.length})`
                    : tab === 'network'
                      ? `네트워크 (${networkLogs.length})`
                      : `이벤트 (${events.length})`}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'anomalies' && (
              <div className="p-3 space-y-2">
                {anomalies.length === 0 ? (
                  <div className="text-center text-gray-400 text-sm py-8">이상 패턴이 감지되지 않았습니다</div>
                ) : (
                  anomalies.map((a) => (
                    <div
                      key={a.id}
                      className={`p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow ${SEVERITY_COLORS[a.severity]}`}
                      onClick={() => seekTo(a.timestamp_start)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold">{ANOMALY_TYPE_LABELS[a.type] || a.type}</span>
                        <span className="text-xs opacity-70">{formatMs(a.timestamp_start)}</span>
                      </div>
                      <p className="text-xs">{a.description}</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedAnomaly(a); setShowBugModal(true); }}
                        className="mt-2 text-xs px-2 py-0.5 bg-white/50 rounded hover:bg-white/80"
                      >
                        🐛 버그 리포트
                      </button>
                    </div>
                  ))
                )}

                {/* Causal chains */}
                {causalChains.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-xs font-semibold text-gray-700 mb-2">인과관계 분석</h4>
                    {causalChains.map((chain, i) => (
                      <div key={i} className="p-2 mb-2 bg-gray-50 rounded border border-gray-200 text-xs">
                        <div className="font-medium text-gray-700">{chain.cause}</div>
                        <div className="text-gray-400 my-0.5">↓</div>
                        <div className="font-medium text-gray-700">{chain.effect}</div>
                        <div className="text-gray-500 mt-1">{chain.explanation}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'console' && (
              <div className="p-2 space-y-0.5">
                {activeConsoleLogs.length === 0 ? (
                  <div className="text-center text-gray-400 text-sm py-8">콘솔 로그가 없습니다</div>
                ) : (
                  activeConsoleLogs.slice(-100).map((log, i) => (
                    <div
                      key={i}
                      className={`text-xs px-2 py-1 rounded font-mono ${
                        log.level === 'error'
                          ? 'bg-red-50 text-red-700'
                          : log.level === 'warn'
                            ? 'bg-yellow-50 text-yellow-700'
                            : 'bg-gray-50 text-gray-700'
                      }`}
                    >
                      <span className="text-gray-400 mr-2">{formatMs(log.timestamp)}</span>
                      <span>{log.message?.slice(0, 200)}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'network' && (
              <div className="p-2 space-y-0.5">
                {activeNetworkLogs.length === 0 ? (
                  <div className="text-center text-gray-400 text-sm py-8">네트워크 요청이 없습니다</div>
                ) : (
                  activeNetworkLogs.slice(-100).map((log, i) => {
                    const status = log.responseStatus || log.status || 0;
                    const isError = status >= 400;
                    return (
                      <div
                        key={i}
                        className={`text-xs px-2 py-1 rounded ${isError ? 'bg-red-50' : 'bg-gray-50'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 font-mono">{formatMs(log.timestamp)}</span>
                          {status > 0 && (
                            <span className={`font-medium ${isError ? 'text-red-600' : 'text-green-600'}`}>
                              {status}
                            </span>
                          )}
                          <span className="text-gray-700 truncate">{(log.name || log.url || '').split('/').pop()}</span>
                        </div>
                        <div className="text-gray-400 mt-0.5">
                          {log.duration ? `${log.duration}ms` : ''} {log.transferSize ? `${(log.transferSize / 1024).toFixed(1)}KB` : ''}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'events' && (
              <div className="p-2">
                <div className="text-xs text-gray-500 mb-2">
                  세션 정보
                </div>
                <div className="space-y-2 text-xs">
                  <InfoRow label="시작 URL" value={session.startUrl} />
                  <InfoRow label="총 시간" value={formatMs(duration)} />
                  <InfoRow label="페이지 수" value={String(session.pageCount)} />
                  <InfoRow label="이벤트 수" value={String(session.eventCount)} />
                  <InfoRow label="상태" value={session.status} />
                  <InfoRow label="AI 분석" value={session.aiAnalysisStatus} />
                  <InfoRow label="생성일" value={new Date(session.createdAt).toLocaleString('ko-KR')} />
                  {session.environment?.browser && (
                    <InfoRow label="브라우저" value={session.environment.browser.slice(0, 60)} />
                  )}
                  {session.environment?.viewport && (
                    <InfoRow
                      label="뷰포트"
                      value={`${session.environment.viewport.width}x${session.environment.viewport.height}`}
                    />
                  )}
                </div>

                {/* Bookmarks */}
                {session.bookmarks && session.bookmarks.length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs text-gray-500 mb-2">북마크</div>
                    <div className="space-y-1">
                      {session.bookmarks.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center gap-2 text-xs p-1.5 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                          onClick={() => seekTo(b.timestamp)}
                        >
                          <span>🔖</span>
                          <span className="font-mono text-gray-400">{formatMs(b.timestamp)}</span>
                          <span className="text-gray-700">{b.label || 'Bookmark'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bug report modal */}
      {showBugModal && (
        <BugReportModal
          anomaly={selectedAnomaly}
          onClose={() => { setShowBugModal(false); setSelectedAnomaly(null); }}
          onCreate={handleCreateBugReport}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 truncate max-w-48 text-right">{value}</span>
    </div>
  );
}

function BugReportModal({
  anomaly,
  onClose,
  onCreate,
}: {
  anomaly: Anomaly | null;
  onClose: () => void;
  onCreate: (anomalyId?: string) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-semibold mb-4">버그 리포트 생성</h3>
        {anomaly && (
          <div className={`p-3 rounded-lg border mb-4 ${SEVERITY_COLORS[anomaly.severity]}`}>
            <div className="text-xs font-medium">{ANOMALY_TYPE_LABELS[anomaly.type] || anomaly.type}</div>
            <p className="text-sm mt-1">{anomaly.description}</p>
          </div>
        )}
        <p className="text-sm text-gray-600 mb-4">
          {anomaly
            ? '이 이상 패턴을 기반으로 버그 리포트를 생성합니다. 세션 데이터가 자동으로 포함됩니다.'
            : '현재 세션에서 버그 리포트를 생성합니다.'}
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
            취소
          </button>
          <button
            onClick={() => onCreate(anomaly?.id)}
            className="px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700 rounded-lg"
          >
            생성
          </button>
        </div>
      </div>
    </div>
  );
}
