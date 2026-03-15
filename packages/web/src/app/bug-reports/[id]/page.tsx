'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchBugReport, updateBugReport, resolveScreenshotUrl } from '@/lib/api';

interface ConsoleLog {
  level: string;
  message: string;
  timestamp?: number;
  stack?: string;
}

interface NetworkLog {
  method: string;
  url: string;
  status: number;
  duration?: number;
  type?: string;
  transferSize?: number;
  name?: string;
  initiatorType?: string;
  responseStatus?: number;
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
  screenshotUrls: string[];
  reproSteps: any[] | null;
  aiSummary: string | null;
  aiAnalysisStatus: string;
  createdAt: string;
  updatedAt: string;
}

const severityStyle: Record<string, string> = {
  critical: 'text-accent font-medium',
  major: 'text-text-primary',
  minor: 'text-text-secondary',
  trivial: 'text-text-muted',
};

const statusStyle: Record<string, string> = {
  open: 'text-text-primary',
  in_progress: 'text-warning-600',
  resolved: 'text-success-600',
  closed: 'text-text-muted',
};

const consoleLevelColor: Record<string, string> = {
  error: 'text-red-400',
  warn: 'text-yellow-400',
  info: 'text-blue-400',
  log: 'text-gray-400',
  debug: 'text-gray-500',
};

const aiStatusLabel: Record<string, { text: string; color: string }> = {
  pending: { text: 'Pending', color: 'text-text-muted' },
  processing: { text: 'Analyzing...', color: 'text-warning-600' },
  completed: { text: 'Completed', color: 'text-success-600' },
  failed: { text: 'Failed', color: 'text-accent' },
};

export default function BugReportDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [report, setReport] = useState<BugReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConsoleLogs, setShowConsoleLogs] = useState(false);
  const [showNetworkLogs, setShowNetworkLogs] = useState(false);
  const [showAllNetworkLogs, setShowAllNetworkLogs] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    if (!report || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      await updateBugReport(id, { status: newStatus });
      setReport({ ...report, status: newStatus, updatedAt: new Date().toISOString() });
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  useEffect(() => {
    async function loadReport() {
      try {
        const response = await fetchBugReport(id);
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
        <div className="text-text-muted text-sm">Loading...</div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div>
        <a href="/bug-reports" className="text-sm text-text-secondary hover:text-text-primary mb-4 inline-block">
          &larr; Back to list
        </a>
        <div className="border-l-2 border-accent bg-accent-light px-4 py-3 text-sm">
          {error || 'Bug report not found'}
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
      <a href="/bug-reports" className="text-sm text-text-secondary hover:text-text-primary mb-6 inline-block">
        &larr; Back to list
      </a>

      {/* Header */}
      <header className="mb-8">
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-2xl font-bold tracking-tight">{report.title}</h2>
          <div className="flex gap-3 shrink-0 ml-4 text-xs">
            <span className={severityStyle[report.severity] || 'text-text-muted'}>{report.severity}</span>
            <span className={statusStyle[report.status] || 'text-text-muted'}>{report.status}</span>
          </div>
        </div>

        {report.description && (
          <p className="text-text-secondary text-sm mb-4 whitespace-pre-wrap leading-relaxed">{report.description}</p>
        )}

        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm border-t border-border pt-4">
          <Detail label="Page URL">
            {report.pageUrl ? (
              <a href={report.pageUrl} target="_blank" rel="noopener noreferrer" className="text-text-secondary hover:text-text-primary underline underline-offset-2 break-all">
                {report.pageUrl}
              </a>
            ) : '—'}
          </Detail>
          <Detail label="Created">{new Date(report.createdAt).toLocaleString()}</Detail>
          {report.updatedAt && <Detail label="Updated">{new Date(report.updatedAt).toLocaleString()}</Detail>}
          <Detail label="ID"><span className="font-mono text-xs text-text-muted">{report.id}</span></Detail>
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <span className="text-xs uppercase tracking-widest text-text-muted mr-3">Change Status</span>
          <div className="inline-flex gap-1.5 mt-1">
            {(['open', 'in_progress', 'resolved', 'closed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                disabled={report.status === s || updatingStatus}
                className={`text-xs px-3 py-1 rounded border transition-colors ${
                  report.status === s
                    ? 'bg-text-primary text-surface border-text-primary'
                    : 'bg-surface text-text-secondary border-border hover:border-text-primary'
                } ${updatingStatus ? 'opacity-50' : ''}`}
              >
                {s === 'open' ? 'Open' : s === 'in_progress' ? 'In Progress' : s === 'resolved' ? 'Resolved' : 'Closed'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Environment */}
      {env && Object.keys(env).length > 0 && (
        <Section title="Environment">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {env.browser && <Detail label="Browser">{env.browser}</Detail>}
            {env.platform && <Detail label="Platform">{env.platform}</Detail>}
            {viewportStr && <Detail label="Viewport">{viewportStr}</Detail>}
            {env.devicePixelRatio && <Detail label="DPR">{env.devicePixelRatio}x</Detail>}
            {env.language && <Detail label="Language">{env.language}</Detail>}
          </div>
        </Section>
      )}

      {/* Screenshots */}
      {report.screenshotUrls && report.screenshotUrls.length > 0 && (
        <Section title="Screenshots">
          <div className="grid grid-cols-1 gap-4">
            {report.screenshotUrls.map((url, index) => (
              <a key={index} href={resolveScreenshotUrl(url)} target="_blank" rel="noopener noreferrer">
                <img
                  src={resolveScreenshotUrl(url)}
                  alt={`Screenshot ${index + 1}`}
                  className="w-full rounded border border-border hover:opacity-90 transition-opacity"
                />
              </a>
            ))}
          </div>
        </Section>
      )}

      {/* AI Analysis */}
      <Section title="AI Analysis">
        <div className="mb-3 text-sm">
          <span className="text-text-muted">Status: </span>
          <span className={`font-medium ${aiStatusLabel[report.aiAnalysisStatus]?.color || 'text-text-muted'}`}>
            {aiStatusLabel[report.aiAnalysisStatus]?.text || report.aiAnalysisStatus}
          </span>
        </div>

        {report.aiSummary && (
          <div className="mb-4 px-4 py-3 border-l-2 border-border bg-bg text-sm text-text-secondary leading-relaxed">
            {report.aiSummary}
          </div>
        )}

        {report.reproSteps && report.reproSteps.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-widest text-text-muted mb-2">Reproduction Steps</div>
            <ol className="list-decimal list-inside space-y-1.5">
              {report.reproSteps.map((step: any, index: number) => (
                <li key={index} className="text-sm text-text-secondary">
                  {typeof step === 'string' ? step : step.description || `Step ${step.step_number}: ${step.action}`}
                </li>
              ))}
            </ol>
          </div>
        )}

        {report.aiAnalysisStatus === 'completed' && !report.reproSteps && !report.aiSummary && (
          <div className="text-sm text-text-muted">No analysis results</div>
        )}
      </Section>

      {/* Console Logs */}
      <div className="mb-8">
        <button
          className="w-full flex items-center justify-between text-left py-3 border-b border-border"
          onClick={() => setShowConsoleLogs(!showConsoleLogs)}
        >
          <span className="text-xs font-medium uppercase tracking-widest text-text-muted">
            Console Logs ({report.consoleLogs?.length || 0})
          </span>
          <span className="text-text-muted text-sm">{showConsoleLogs ? '−' : '+'}</span>
        </button>
        {showConsoleLogs && (
          <div>
            {report.consoleLogs && report.consoleLogs.length > 0 ? (
              <div className="bg-gray-900 p-4 max-h-80 overflow-y-auto rounded-b">
                <div className="space-y-1 font-mono text-xs">
                  {report.consoleLogs.map((log, index) => (
                    <div key={index} className="group">
                      <div className="flex gap-2">
                        {log.timestamp != null && (
                          <span className="shrink-0 text-gray-600 tabular-nums">
                            {(log.timestamp / 1000).toFixed(1)}s
                          </span>
                        )}
                        <span className={`shrink-0 uppercase font-bold ${consoleLevelColor[log.level] || 'text-gray-400'}`}>
                          [{log.level}]
                        </span>
                        <span className="text-gray-300 break-all">{log.message}</span>
                      </div>
                      {log.stack && (
                        <pre className="ml-12 mt-0.5 text-gray-500 text-[10px] whitespace-pre-wrap hidden group-hover:block">
                          {log.stack}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-text-muted">
                No console logs collected
              </div>
            )}
          </div>
        )}
      </div>

      {/* Network Logs */}
      <div className="mb-8">
        <button
          className="w-full flex items-center justify-between text-left py-3 border-b border-border"
          onClick={() => setShowNetworkLogs(!showNetworkLogs)}
        >
          <span className="text-xs font-medium uppercase tracking-widest text-text-muted">
            Network Logs ({report.networkLogs?.length || 0})
          </span>
          <span className="text-text-muted text-sm">{showNetworkLogs ? '−' : '+'}</span>
        </button>
        {showNetworkLogs && (
          <div>
            {report.networkLogs && report.networkLogs.length > 0 ? (() => {
              const allLogs = report.networkLogs.map((log) => ({
                ...log,
                _url: log.url || log.name || '',
                _status: log.status ?? log.responseStatus ?? 0,
                _method: log.method || 'GET',
                _type: log.type || log.initiatorType || '',
              }));

              const importantLogs = allLogs.filter((l) => {
                const isApiCall = l._type === 'fetch' || l._type === 'xhr';
                const isFailed = l._status === 0 || l._status >= 400;
                const isSlow = (l.duration || 0) > 1000;
                return isApiCall || isFailed || isSlow;
              });

              const displayLogs = showAllNetworkLogs ? allLogs : importantLogs;
              const hiddenCount = allLogs.length - importantLogs.length;

              return (
                <>
                  <div className="px-4 py-2 bg-bg border-b border-border flex items-center justify-between">
                    <span className="text-xs text-text-muted">
                      {showAllNetworkLogs
                        ? `All ${allLogs.length} requests`
                        : `${importantLogs.length} important (${hiddenCount} hidden)`}
                    </span>
                    {hiddenCount > 0 && (
                      <button
                        onClick={() => setShowAllNetworkLogs(!showAllNetworkLogs)}
                        className="text-xs text-text-secondary hover:text-text-primary underline underline-offset-2"
                      >
                        {showAllNetworkLogs ? 'Important only' : 'Show all'}
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                  <table className="w-full text-xs table-fixed">
                    <thead>
                      <tr className="bg-bg border-b border-border">
                        <th className="text-left px-3 py-2 font-medium text-text-muted w-14">Method</th>
                        <th className="text-left px-3 py-2 font-medium text-text-muted">URL</th>
                        <th className="text-left px-3 py-2 font-medium text-text-muted w-14">Status</th>
                        <th className="text-left px-3 py-2 font-medium text-text-muted w-12">Type</th>
                        <th className="text-left px-3 py-2 font-medium text-text-muted w-16">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-mono">
                      {displayLogs.map((log, index) => (
                        <tr key={index} className={`hover:bg-bg ${log._status === 0 || log._status >= 400 ? 'bg-accent-light' : ''}`}>
                          <td className="px-3 py-2 font-bold text-text-secondary">{log._method}</td>
                          <td className="px-3 py-2 text-text-muted truncate" title={log._url}>{log._url}</td>
                          <td className="px-3 py-2">
                            <span className={`font-bold ${
                              log._status === 0 || log._status >= 400 ? 'text-accent' : log._status >= 300 ? 'text-warning-600' : 'text-success-600'
                            }`}>
                              {log._status === 0 ? 'Fail' : log._status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-text-muted">{log._type}</td>
                          <td className="px-3 py-2 text-text-muted">
                            {log.duration ? `${log.duration}ms` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                  {displayLogs.length === 0 && (
                    <div className="py-6 text-center text-sm text-text-muted">No important network requests</div>
                  )}
                </>
              );
            })() : (
              <div className="py-6 text-center text-sm text-text-muted">
                No network logs collected
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h3 className="text-xs font-medium uppercase tracking-widest text-text-muted mb-4 pb-2 border-b border-border">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-sm">
      <span className="text-text-muted">{label}: </span>
      <span className="text-text-secondary">{children}</span>
    </div>
  );
}
