'use client';

import { useEffect, useState } from 'react';
import { fetchBugReports } from '@/lib/api';

interface BugReport {
  id: string;
  title: string;
  severity: string;
  status: string;
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

export default function Dashboard() {
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const recentBugs = bugReports.slice(0, 5);

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight mb-8">대시보드</h2>

      {error && (
        <div className="mb-6 px-4 py-3 border-l-2 border-accent bg-accent-light text-sm text-text-primary">
          API 연결 오류: {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 mb-10">
        <StatCard title="버그 리포트" count={bugReports.length} loading={loading} />
        <StatCard title="시각적 테스트" count={0} loading={loading} />
      </div>

      <section>
        <h3 className="text-xs font-medium uppercase tracking-widest text-text-muted mb-4">
          최근 버그 리포트
        </h3>
        <div className="border border-border rounded">
          {loading ? (
            <div className="py-12 text-center text-text-muted text-sm">로딩 중...</div>
          ) : recentBugs.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-text-secondary text-sm mb-1">아직 버그 리포트가 없습니다</p>
              <p className="text-text-muted text-xs">Chrome 확장에서 첫 버그를 리포트해보세요</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recentBugs.map((bug) => (
                <li key={bug.id}>
                  <a
                    href={`/bug-reports/${bug.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-bg transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {bug.severity === 'critical' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                      )}
                      <span className="text-sm text-text-primary truncate">{bug.title}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span className="text-xs text-text-muted">{severityLabel[bug.severity] || bug.severity}</span>
                      <span className="text-xs text-text-muted">{statusLabel[bug.status] || bug.status}</span>
                      <span className="text-xs text-text-muted tabular-nums">
                        {new Date(bug.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ title, count, loading }: { title: string; count: number; loading: boolean }) {
  return (
    <div className="border border-border rounded px-5 py-5">
      <div className="text-xs font-medium uppercase tracking-widest text-text-muted mb-2">{title}</div>
      <div className="text-3xl font-bold tracking-tight">
        {loading ? (
          <span className="inline-block w-10 h-8 bg-bg rounded animate-pulse" />
        ) : (
          count
        )}
      </div>
    </div>
  );
}
