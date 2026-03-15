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

const severityLabel: Record<string, string> = {
  critical: 'Critical',
  major: 'Major',
  minor: 'Minor',
  trivial: 'Trivial',
};

const statusLabel: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

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

export default function Dashboard() {
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      try {
        const bugsData = await fetchBugReports();
        setBugReports(bugsData?.data ?? []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const openCount = bugReports.filter((b) => b.status === 'open').length;
  const criticalCount = bugReports.filter((b) => b.severity === 'critical' && b.status !== 'closed').length;
  const resolvedCount = bugReports.filter((b) => b.status === 'resolved' || b.status === 'closed').length;

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight mb-8">대시보드</h2>

      {error && (
        <div className="mb-6 px-4 py-3 border-l-2 border-accent bg-accent-light text-sm text-text-primary">
          API 연결 오류: {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6 mb-10">
        <StatCard title="전체" count={bugReports.length} loading={loading} />
        <StatCard title="미해결" count={openCount} loading={loading} highlight={criticalCount > 0} />
        <StatCard title="해결됨" count={resolvedCount} loading={loading} />
      </div>

      {criticalCount > 0 && (
        <div className="mb-6 px-4 py-3 border-l-2 border-accent bg-accent-light text-sm text-text-primary">
          Critical 버그 {criticalCount}건이 미해결 상태입니다
        </div>
      )}

      <section>
        <h3 className="text-xs font-medium uppercase tracking-widest text-text-muted mb-4">
          최근 버그 리포트
        </h3>
        <div className="border border-border rounded overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-text-muted text-sm">로딩 중...</div>
          ) : bugReports.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-text-secondary text-sm mb-1">아직 버그 리포트가 없습니다</p>
              <p className="text-text-muted text-xs">Chrome 확장에서 스크린샷을 캡처해보세요</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg">
                  <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-text-muted">Title</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-text-muted w-24">Severity</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-text-muted w-24">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-text-muted w-28">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bugReports.slice(0, 10).map((bug) => (
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
                        {severityLabel[bug.severity] || bug.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${statusStyle[bug.status] || 'text-text-muted'}`}>
                        {statusLabel[bug.status] || bug.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted tabular-nums">
                      {new Date(bug.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {bugReports.length > 10 && (
          <div className="mt-3 text-right">
            <a href="/bug-reports" className="text-xs text-text-secondary hover:text-text-primary underline underline-offset-2">
              전체 {bugReports.length}건 보기
            </a>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ title, count, loading, highlight }: { title: string; count: number; loading: boolean; highlight?: boolean }) {
  return (
    <div className={`border rounded px-5 py-5 ${highlight ? 'border-accent' : 'border-border'}`}>
      <div className="text-xs font-medium uppercase tracking-widest text-text-muted mb-2">{title}</div>
      <div className={`text-3xl font-bold tracking-tight ${highlight ? 'text-accent' : ''}`}>
        {loading ? (
          <span className="inline-block w-10 h-8 bg-bg rounded animate-pulse" />
        ) : (
          count
        )}
      </div>
    </div>
  );
}
