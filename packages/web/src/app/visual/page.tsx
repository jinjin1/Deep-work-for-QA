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
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold tracking-tight">시각적 테스트</h2>
        <button className="bg-text-primary text-surface px-4 py-1.5 rounded text-sm font-medium hover:bg-text-secondary transition-colors">
          전체 비교 실행
        </button>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 border-l-2 border-accent bg-accent-light text-sm text-text-primary">
          API 연결 오류: {error}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4 mb-10">
        <StatMini label="전체" value={baselines.length} loading={loading} />
        <StatMini label="변경 없음" value={unchangedCount} loading={loading} color="text-success-600" />
        <StatMini label="의도적 변경" value={changedCount} loading={loading} color="text-warning-600" />
        <StatMini label="회귀 감지" value={regressionCount} loading={loading} color="text-accent" />
      </div>

      <div className="border border-border rounded overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-text-muted text-sm">로딩 중...</div>
        ) : baselines.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-text-secondary text-sm mb-1">아직 베이스라인이 없습니다</p>
            <p className="text-text-muted text-xs">Chrome 확장에서 페이지의 베이스라인 스크린샷을 저장해보세요</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg">
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-text-muted">Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-text-muted">URL</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-text-muted w-24">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-text-muted w-28">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {baselines.map((baseline) => (
                <tr key={baseline.id} className="hover:bg-bg transition-colors">
                  <td className="px-4 py-3 text-text-primary">{baseline.name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-text-muted truncate block max-w-md text-xs">{baseline.url || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${
                      baseline.status === 'regression' ? 'text-accent'
                        : baseline.status === 'changed' ? 'text-warning-600'
                        : 'text-success-600'
                    }`}>
                      {baseline.status || 'unchanged'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted tabular-nums">
                    {new Date(baseline.createdAt).toLocaleDateString('ko-KR', {
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

function StatMini({ label, value, loading, color }: { label: string; value: number; loading: boolean; color?: string }) {
  return (
    <div className="border border-border rounded px-4 py-4">
      <div className={`text-2xl font-bold tracking-tight ${color || 'text-text-primary'}`}>
        {loading ? <span className="inline-block w-6 h-7 bg-bg rounded animate-pulse" /> : value}
      </div>
      <div className="text-xs text-text-muted mt-1">{label}</div>
    </div>
  );
}
