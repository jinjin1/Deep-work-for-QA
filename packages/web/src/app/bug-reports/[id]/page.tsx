'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchBugReport } from '@/lib/api';

interface ConsoleLog {
  level: string;
  message: string;
  timestamp?: number;
}

interface NetworkLog {
  method: string;
  url: string;
  status: number;
  duration?: number;
  type?: string;
}

interface BugReportDetail {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  pageUrl: string;
  environment: Record<string, any>;
  consoleLogs: ConsoleLog[];
  networkLogs: NetworkLog[];
  reproSteps: any[] | null;
  aiSummary: string | null;
  aiAnalysisStatus: string;
  createdAt: string;
  updatedAt: string;
}

const severityColor: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  major: 'bg-orange-100 text-orange-700 border-orange-200',
  minor: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  trivial: 'bg-gray-100 text-gray-600 border-gray-200',
};

const statusColor: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700 border-blue-200',
  in_progress: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  resolved: 'bg-green-100 text-green-700 border-green-200',
  closed: 'bg-gray-100 text-gray-600 border-gray-200',
};

const consoleLevelColor: Record<string, string> = {
  error: 'text-red-400',
  warn: 'text-yellow-400',
  info: 'text-blue-400',
  log: 'text-gray-400',
  debug: 'text-gray-500',
};

const aiStatusLabel: Record<string, { text: string; color: string }> = {
  pending: { text: '대기 중', color: 'text-gray-500' },
  processing: { text: '분석 중...', color: 'text-yellow-600' },
  completed: { text: '완료', color: 'text-green-600' },
  failed: { text: '실패', color: 'text-red-600' },
};

export default function BugReportDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [report, setReport] = useState<BugReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConsoleLogs, setShowConsoleLogs] = useState(false);
  const [showNetworkLogs, setShowNetworkLogs] = useState(false);

  useEffect(() => {
    async function loadReport() {
      try {
        const response = await fetchBugReport(id);
        // API returns { data: {...}, meta: {...} }
        setReport(response.data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load bug report');
      } finally {
        setLoading(false);
      }
    }

    if (id) loadReport();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400">로딩 중...</div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div>
        <a
          href="/bug-reports"
          className="text-sm text-blue-600 hover:text-blue-800 mb-4 inline-block"
        >
          &larr; 버그 리포트 목록으로
        </a>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700">{error || '버그 리포트를 찾을 수 없습니다'}</p>
        </div>
      </div>
    );
  }

  const env = report.environment || {};
  const viewportStr = env.viewport
    ? typeof env.viewport === 'object'
      ? `${env.viewport.width}×${env.viewport.height}`
      : env.viewport
    : null;

  return (
    <div>
      <a
        href="/bug-reports"
        className="text-sm text-blue-600 hover:text-blue-800 mb-4 inline-block"
      >
        &larr; 버그 리포트 목록으로
      </a>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">{report.title}</h2>
          <div className="flex gap-2 shrink-0 ml-4">
            <span
              className={`text-sm px-3 py-1 rounded-full font-medium border ${severityColor[report.severity] || 'bg-gray-100 text-gray-600 border-gray-200'}`}
            >
              {report.severity}
            </span>
            <span
              className={`text-sm px-3 py-1 rounded-full font-medium border ${statusColor[report.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}
            >
              {report.status}
            </span>
          </div>
        </div>

        {report.description && (
          <p className="text-gray-700 mb-4 whitespace-pre-wrap">{report.description}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Page URL:</span>{' '}
            {report.pageUrl ? (
              <a
                href={report.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 break-all"
              >
                {report.pageUrl}
              </a>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </div>
          <div>
            <span className="text-gray-500">Created:</span>{' '}
            <span className="text-gray-900">
              {new Date(report.createdAt).toLocaleString('ko-KR')}
            </span>
          </div>
          {report.updatedAt && (
            <div>
              <span className="text-gray-500">Updated:</span>{' '}
              <span className="text-gray-900">
                {new Date(report.updatedAt).toLocaleString('ko-KR')}
              </span>
            </div>
          )}
          <div>
            <span className="text-gray-500">ID:</span>{' '}
            <span className="text-gray-400 font-mono text-xs">{report.id}</span>
          </div>
        </div>
      </div>

      {/* Environment */}
      {env && Object.keys(env).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">🖥️ 환경 정보</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {env.browser && (
              <div>
                <span className="text-gray-500">Browser:</span>{' '}
                <span className="text-gray-900">{env.browser}</span>
              </div>
            )}
            {env.platform && (
              <div>
                <span className="text-gray-500">Platform:</span>{' '}
                <span className="text-gray-900">{env.platform}</span>
              </div>
            )}
            {viewportStr && (
              <div>
                <span className="text-gray-500">Viewport:</span>{' '}
                <span className="text-gray-900">{viewportStr}</span>
              </div>
            )}
            {env.devicePixelRatio && (
              <div>
                <span className="text-gray-500">DPR:</span>{' '}
                <span className="text-gray-900">{env.devicePixelRatio}x</span>
              </div>
            )}
            {env.language && (
              <div>
                <span className="text-gray-500">Language:</span>{' '}
                <span className="text-gray-900">{env.language}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Analysis */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">🤖 AI 분석</h3>

        <div className="mb-4">
          <span className="text-sm text-gray-500">분석 상태: </span>
          <span className={`text-sm font-medium ${aiStatusLabel[report.aiAnalysisStatus]?.color || 'text-gray-600'}`}>
            {aiStatusLabel[report.aiAnalysisStatus]?.text || report.aiAnalysisStatus}
          </span>
        </div>

        {report.aiSummary && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <h4 className="text-sm font-medium text-gray-700 mb-1">요약</h4>
            <p className="text-gray-600 text-sm">{report.aiSummary}</p>
          </div>
        )}

        {report.reproSteps && report.reproSteps.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">재현 단계</h4>
            <ol className="list-decimal list-inside space-y-2">
              {report.reproSteps.map((step: any, index: number) => (
                <li key={index} className="text-sm text-gray-600">
                  {typeof step === 'string' ? step : step.description || `Step ${step.step_number}: ${step.action}`}
                </li>
              ))}
            </ol>
          </div>
        )}

        {report.aiAnalysisStatus === 'completed' && !report.reproSteps && !report.aiSummary && (
          <div className="text-sm text-gray-400">분석 결과 없음</div>
        )}
      </div>

      {/* Console Logs */}
      {report.consoleLogs && report.consoleLogs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
          <button
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
            onClick={() => setShowConsoleLogs(!showConsoleLogs)}
          >
            <h3 className="text-lg font-semibold">
              🚨 콘솔 로그 ({report.consoleLogs.length})
            </h3>
            <span className="text-gray-400 text-xl">{showConsoleLogs ? '−' : '+'}</span>
          </button>
          {showConsoleLogs && (
            <div className="border-t border-gray-200 bg-gray-900 p-4 max-h-96 overflow-y-auto">
              <div className="space-y-1 font-mono text-xs">
                {report.consoleLogs.map((log, index) => (
                  <div key={index} className="flex gap-2">
                    <span
                      className={`shrink-0 uppercase font-bold ${consoleLevelColor[log.level] || 'text-gray-400'}`}
                    >
                      [{log.level}]
                    </span>
                    <span className="text-gray-300 break-all">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Network Logs */}
      {report.networkLogs && report.networkLogs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
          <button
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
            onClick={() => setShowNetworkLogs(!showNetworkLogs)}
          >
            <h3 className="text-lg font-semibold">
              🌐 네트워크 로그 ({report.networkLogs.length})
            </h3>
            <span className="text-gray-400 text-xl">{showNetworkLogs ? '−' : '+'}</span>
          </button>
          {showNetworkLogs && (
            <div className="border-t border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Method</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">URL</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Status</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.networkLogs.map((log, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-xs font-bold text-gray-700">
                        {log.method}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-600 break-all max-w-md">
                        {log.url}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`text-xs font-mono font-bold ${
                            log.status === 0
                              ? 'text-red-600'
                              : log.status >= 400
                                ? 'text-red-600'
                                : log.status >= 300
                                  ? 'text-yellow-600'
                                  : 'text-green-600'
                          }`}
                        >
                          {log.status === 0 ? 'Failed' : log.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">
                        {log.duration ? `${log.duration}ms` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
