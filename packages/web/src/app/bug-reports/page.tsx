'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchBugReports } from '@/lib/api';

interface BugReport {
  id: string;
  title: string;
  severity: string;
  status: string;
  pageUrl: string;
  createdAt: string;
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

export default function BugReportsPage() {
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const router = useRouter();

  useEffect(() => {
    async function loadBugReports() {
      try {
        const result = await fetchBugReports();
        setBugReports(result?.data ?? []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load bug reports');
      } finally {
        setLoading(false);
      }
    }

    loadBugReports();
  }, []);

  const filteredReports = bugReports.filter((bug) => {
    if (filterStatus !== 'all' && bug.status !== filterStatus) return false;
    if (filterSeverity !== 'all' && bug.severity !== filterSeverity) return false;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold tracking-tight">버그 리포트</h2>
        <div className="flex gap-2">
          <select
            className="border border-border rounded px-3 py-1.5 text-sm bg-surface text-text-secondary focus:outline-none focus:border-text-primary transition-colors"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">전체 상태</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select
            className="border border-border rounded px-3 py-1.5 text-sm bg-surface text-text-secondary focus:outline-none focus:border-text-primary transition-colors"
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
          >
            <option value="all">전체 심각도</option>
            <option value="critical">Critical</option>
            <option value="major">Major</option>
            <option value="minor">Minor</option>
            <option value="trivial">Trivial</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 border-l-2 border-accent bg-accent-light text-sm text-text-primary">
          API 연결 오류: {error}
        </div>
      )}

      <div className="border border-border rounded overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-text-muted text-sm">로딩 중...</div>
        ) : filteredReports.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-text-secondary text-sm mb-1">
              {bugReports.length === 0
                ? '아직 버그 리포트가 없습니다'
                : '필터 조건에 맞는 버그 리포트가 없습니다'}
            </p>
            {bugReports.length === 0 && (
              <p className="text-text-muted text-xs">Chrome 확장을 설치하고 첫 번째 버그를 리포트해보세요</p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg">
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-text-muted">Title</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-text-muted w-24">Severity</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-text-muted w-24">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-text-muted">URL</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-text-muted w-28">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredReports.map((bug) => (
                <tr
                  key={bug.id}
                  className="hover:bg-bg cursor-pointer transition-colors"
                  onClick={() => router.push(`/bug-reports/${bug.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {bug.severity === 'critical' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                      )}
                      <span className="text-text-primary">{bug.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${severityStyle[bug.severity] || 'text-text-muted'}`}>
                      {bug.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${statusStyle[bug.status] || 'text-text-muted'}`}>
                      {bug.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-text-muted truncate block max-w-xs">
                      {bug.pageUrl || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted tabular-nums">
                    {new Date(bug.createdAt).toLocaleDateString('ko-KR', {
                      year: 'numeric', month: '2-digit', day: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
