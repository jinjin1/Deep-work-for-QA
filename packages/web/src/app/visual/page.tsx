'use client';

import { useEffect, useState } from 'react';
import { fetchBaselines } from '@/lib/api';

interface Baseline {
  id: string;
  name?: string;
  url?: string;
  status?: string;
  createdAt: string;
}

export default function VisualTestPage() {
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadBaselines() {
      try {
        const data = await fetchBaselines();
        const baselineList = Array.isArray(data) ? data : data?.data ?? [];
        setBaselines(baselineList);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load baselines');
      } finally {
        setLoading(false);
      }
    }

    loadBaselines();
  }, []);

  const unchangedCount = baselines.filter((b) => b.status === 'unchanged' || !b.status).length;
  const changedCount = baselines.filter((b) => b.status === 'changed').length;
  const regressionCount = baselines.filter((b) => b.status === 'regression').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">시각적 테스트</h2>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          전체 비교 실행
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          API 연결 오류: {error}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">
            {loading ? (
              <span className="inline-block w-8 h-7 bg-gray-100 rounded animate-pulse" />
            ) : (
              baselines.length
            )}
          </div>
          <div className="text-xs text-gray-500 mt-1">전체 베이스라인</div>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {loading ? (
              <span className="inline-block w-8 h-7 bg-green-50 rounded animate-pulse" />
            ) : (
              unchangedCount
            )}
          </div>
          <div className="text-xs text-gray-500 mt-1">변경 없음</div>
        </div>
        <div className="bg-white rounded-xl border border-yellow-200 p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">
            {loading ? (
              <span className="inline-block w-8 h-7 bg-yellow-50 rounded animate-pulse" />
            ) : (
              changedCount
            )}
          </div>
          <div className="text-xs text-gray-500 mt-1">의도적 변경</div>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-4 text-center">
          <div className="text-2xl font-bold text-red-600">
            {loading ? (
              <span className="inline-block w-8 h-7 bg-red-50 rounded animate-pulse" />
            ) : (
              regressionCount
            )}
          </div>
          <div className="text-xs text-gray-500 mt-1">회귀 감지</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">로딩 중...</div>
        ) : baselines.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-4">👁</div>
            <p className="text-gray-500 mb-2">아직 베이스라인이 없습니다</p>
            <p className="text-sm text-gray-400">
              Chrome 확장에서 페이지의 베이스라인 스크린샷을 저장해보세요
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  URL
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created At
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {baselines.map((baseline) => (
                <tr key={baseline.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {baseline.name || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-500 truncate block max-w-md">
                      {baseline.url || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        baseline.status === 'regression'
                          ? 'bg-red-100 text-red-700'
                          : baseline.status === 'changed'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {baseline.status || 'unchanged'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(baseline.createdAt).toLocaleDateString('ko-KR', {
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
