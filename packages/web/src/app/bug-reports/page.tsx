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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">버그 리포트</h2>
        <div className="flex gap-2">
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
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
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
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
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          API 연결 오류: {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">로딩 중...</div>
        ) : filteredReports.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-4">🐛</div>
            <p className="text-gray-500 mb-2">
              {bugReports.length === 0
                ? '아직 버그 리포트가 없습니다'
                : '필터 조건에 맞는 버그 리포트가 없습니다'}
            </p>
            {bugReports.length === 0 && (
              <p className="text-sm text-gray-400">
                Chrome 확장을 설치하고 첫 번째 버그를 리포트해보세요
              </p>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Severity
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Page URL
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created At
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredReports.map((bug) => (
                <tr
                  key={bug.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/bug-reports/${bug.id}`)}
                >
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-900">{bug.title}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${severityColor[bug.severity] || 'bg-gray-100 text-gray-600'}`}
                    >
                      {bug.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor[bug.status] || 'bg-gray-100 text-gray-600'}`}
                    >
                      {bug.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-500 truncate block max-w-xs">
                      {bug.pageUrl || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(bug.createdAt).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
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
