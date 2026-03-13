'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchSessions, deleteSession } from '@/lib/api';

interface SessionTag {
  id: string;
  name: string;
  sessionId: string;
}

interface SessionAnomaly {
  id: string;
  type: string;
  severity: string;
  description: string;
}

interface Session {
  id: string;
  startUrl: string;
  durationMs: number;
  pageCount: number;
  eventCount: number;
  status: string;
  aiAnalysisStatus: string;
  sessionSummary?: string;
  anomalies: SessionAnomaly[];
  tags: SessionTag[];
  createdAt: string;
}

function formatDuration(ms?: number): string {
  if (!ms) return '-';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
}

const SEVERITY_BADGE: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-blue-100 text-blue-700',
};

const STATUS_BADGE: Record<string, string> = {
  recording: 'bg-green-100 text-green-700',
  processing: 'bg-yellow-100 text-yellow-700',
  ready: 'bg-blue-100 text-blue-700',
  failed: 'bg-red-100 text-red-700',
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterTag, setFilterTag] = useState('');
  const [filterAnomalies, setFilterAnomalies] = useState<'' | 'true' | 'false'>('');
  const [filterStatus, setFilterStatus] = useState('');

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (filterTag) params.tag = filterTag;
      if (filterAnomalies) params.has_anomalies = filterAnomalies;
      if (filterStatus) params.status = filterStatus;

      const data = await fetchSessions(params);
      const sessionList = Array.isArray(data) ? data : data?.data ?? [];
      setSessions(sessionList);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [filterTag, filterAnomalies, filterStatus]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Collect all unique tags
  const allTags = Array.from(new Set(sessions.flatMap((s) => s.tags?.map((t) => t.name) || [])));

  async function handleDelete(id: string) {
    if (!confirm('이 세션을 삭제하시겠습니까?')) return;
    try {
      await deleteSession(id);
      await loadSessions();
    } catch {
      // ignore
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">세션 리플레이</h2>
        <span className="text-sm text-gray-400">{sessions.length}개의 세션</span>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          API 연결 오류: {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="">모든 상태</option>
          <option value="recording">녹화 중</option>
          <option value="processing">분석 중</option>
          <option value="ready">완료</option>
        </select>

        <select
          value={filterAnomalies}
          onChange={(e) => setFilterAnomalies(e.target.value as '' | 'true' | 'false')}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="">이상 패턴 (전체)</option>
          <option value="true">이상 있음</option>
          <option value="false">이상 없음</option>
        </select>

        {allTags.length > 0 && (
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="">모든 태그</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        )}

        {(filterTag || filterAnomalies || filterStatus) && (
          <button
            onClick={() => { setFilterTag(''); setFilterAnomalies(''); setFilterStatus(''); }}
            className="text-sm text-gray-500 hover:text-gray-700 px-2"
          >
            필터 초기화
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">로딩 중...</div>
        ) : sessions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-4">🎬</div>
            <p className="text-gray-500 mb-2">아직 녹화된 세션이 없습니다</p>
            <p className="text-sm text-gray-400">
              Chrome 확장에서 세션 녹화를 시작해보세요
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  URL / 태그
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  시간
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  이벤트
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  이상 패턴
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  생성일
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  액션
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sessions.map((session) => {
                const highCount = session.anomalies?.filter((a) => a.severity === 'high').length || 0;
                const medCount = session.anomalies?.filter((a) => a.severity === 'medium').length || 0;
                const totalAnomalies = session.anomalies?.length || 0;

                return (
                  <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <a
                        href={`/sessions/${session.id}/replay`}
                        className="text-sm text-gray-900 hover:text-indigo-600 truncate block max-w-xs"
                      >
                        {session.startUrl || '-'}
                      </a>
                      {session.tags && session.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {session.tags.map((t) => (
                            <span
                              key={t.id}
                              className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded"
                            >
                              {t.name}
                            </span>
                          ))}
                        </div>
                      )}
                      {session.sessionSummary && (
                        <p className="text-xs text-gray-400 mt-1 truncate max-w-xs">
                          {session.sessionSummary.slice(0, 60)}...
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[session.status] || 'bg-gray-100 text-gray-600'}`}
                      >
                        {session.status === 'recording' ? '녹화 중' : session.status === 'processing' ? '분석 중' : session.status === 'ready' ? '완료' : session.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {formatDuration(session.durationMs)}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {session.eventCount ?? '-'}
                    </td>
                    <td className="px-4 py-4">
                      {totalAnomalies > 0 ? (
                        <div className="flex items-center gap-1">
                          {highCount > 0 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${SEVERITY_BADGE.high}`}>
                              {highCount} high
                            </span>
                          )}
                          {medCount > 0 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${SEVERITY_BADGE.medium}`}>
                              {medCount} med
                            </span>
                          )}
                          {totalAnomalies - highCount - medCount > 0 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${SEVERITY_BADGE.low}`}>
                              {totalAnomalies - highCount - medCount} low
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {new Date(session.createdAt).toLocaleDateString('ko-KR', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/sessions/${session.id}/replay`}
                          className="text-xs px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                          재생
                        </a>
                        <button
                          onClick={() => handleDelete(session.id)}
                          className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
