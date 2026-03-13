'use client';

import { useEffect, useState } from 'react';
import { fetchBugReports, fetchSessions } from '@/lib/api';

interface BugReport {
  id: string;
  title: string;
  severity: string;
  status: string;
  createdAt: string;
}

export default function Dashboard() {
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [sessionCount, setSessionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [bugsData, sessionsData] = await Promise.allSettled([
          fetchBugReports(),
          fetchSessions(),
        ]);

        if (bugsData.status === 'fulfilled') {
          setBugReports(bugsData.value?.data ?? []);
        }

        if (sessionsData.status === 'fulfilled') {
          setSessionCount(sessionsData.value?.data?.length ?? 0);
        }

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

  const severityColor: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    major: 'bg-orange-100 text-orange-700',
    minor: 'bg-yellow-100 text-yellow-700',
    trivial: 'bg-gray-100 text-gray-600',
  };

  const statusColor: Record<string, string> = {
    open: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-600',
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">대시보드</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          API 연결 오류: {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="버그 리포트"
          count={bugReports.length}
          icon="🐛"
          color="red"
          loading={loading}
        />
        <StatCard
          title="세션 녹화"
          count={sessionCount}
          icon="🎬"
          color="green"
          loading={loading}
        />
        <StatCard
          title="시각적 테스트"
          count={0}
          icon="👁"
          color="indigo"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">최근 버그 리포트</h3>
          {loading ? (
            <div className="text-center py-8 text-gray-400">로딩 중...</div>
          ) : recentBugs.length === 0 ? (
            <EmptyState
              message="아직 버그 리포트가 없습니다"
              action="Chrome 확장에서 첫 버그를 리포트해보세요"
            />
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentBugs.map((bug) => (
                <li key={bug.id} className="py-3 first:pt-0 last:pb-0">
                  <a
                    href={`/bug-reports/${bug.id}`}
                    className="block hover:bg-gray-50 -mx-2 px-2 py-1 rounded-lg transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-gray-900 truncate">
                        {bug.title}
                      </span>
                      <span className="text-xs text-gray-400 ml-2 shrink-0">
                        {new Date(bug.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityColor[bug.severity] || 'bg-gray-100 text-gray-600'}`}
                      >
                        {bug.severity}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[bug.status] || 'bg-gray-100 text-gray-600'}`}
                      >
                        {bug.status}
                      </span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">최근 세션</h3>
          {loading ? (
            <div className="text-center py-8 text-gray-400">로딩 중...</div>
          ) : sessionCount === 0 ? (
            <EmptyState
              message="아직 녹화된 세션이 없습니다"
              action="Chrome 확장에서 세션 녹화를 시작해보세요"
            />
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-700 font-medium">{sessionCount}개의 세션이 녹화되었습니다</p>
              <a
                href="/sessions"
                className="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-block"
              >
                세션 목록 보기 →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  count,
  icon,
  color,
  loading,
}: {
  title: string;
  count: number;
  icon: string;
  color: string;
  loading: boolean;
}) {
  const colorMap: Record<string, string> = {
    red: 'bg-red-50 text-red-700',
    green: 'bg-green-50 text-green-700',
    indigo: 'bg-indigo-50 text-indigo-700',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500">{title}</span>
        <span
          className={`text-2xl w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color]}`}
        >
          {icon}
        </span>
      </div>
      <div className="text-3xl font-bold">
        {loading ? (
          <span className="inline-block w-12 h-8 bg-gray-100 rounded animate-pulse" />
        ) : (
          count
        )}
      </div>
    </div>
  );
}

function EmptyState({ message, action }: { message: string; action: string }) {
  return (
    <div className="text-center py-8">
      <p className="text-gray-500 mb-2">{message}</p>
      <p className="text-sm text-gray-400">{action}</p>
    </div>
  );
}
