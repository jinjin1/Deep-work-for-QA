'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchBaselines, fetchVisualDiffs, deleteBaseline } from '@/lib/api';

interface Baseline {
  id: string;
  name: string;
  page_url: string;
  pageUrl?: string;
  viewport: { width: number; height: number };
  screenshot_url: string;
  created_at: string;
  createdAt?: string;
}

interface VisualDiff {
  id: string;
  baseline_id: string;
  baselineId?: string;
  overall_status: 'no_change' | 'intentional' | 'regression' | 'mixed';
  overallStatus?: string;
  ai_analysis_status: string;
  changes: any[];
  created_at: string;
  createdAt?: string;
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  no_change: { text: '변경 없음', color: 'text-success-600' },
  intentional: { text: '의도적 변경', color: 'text-warning-600' },
  regression: { text: '회귀 감지', color: 'text-accent' },
  mixed: { text: '복합 변경', color: 'text-warning-600' },
};

export default function VisualTestPage() {
  const router = useRouter();
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [diffs, setDiffs] = useState<VisualDiff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'baselines' | 'history'>('overview');

  useEffect(() => {
    async function loadData() {
      try {
        const [baselinesRes, diffsRes] = await Promise.all([
          fetchBaselines(),
          fetchVisualDiffs(),
        ]);
        const baselineList = Array.isArray(baselinesRes) ? baselinesRes : baselinesRes?.data ?? [];
        const diffList = Array.isArray(diffsRes) ? diffsRes : diffsRes?.data ?? [];
        setBaselines(baselineList);
        setDiffs(diffList);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const noChangeCount = diffs.filter((d) => (d.overall_status || d.overallStatus) === 'no_change').length;
  const intentionalCount = diffs.filter((d) => (d.overall_status || d.overallStatus) === 'intentional').length;
  const regressionCount = diffs.filter((d) => {
    const status = d.overall_status || d.overallStatus;
    return status === 'regression' || status === 'mixed';
  }).length;

  // Build a map of baseline_id -> latest diff status
  const baselineStatusMap = new Map<string, string>();
  for (const diff of diffs) {
    const bid = diff.baseline_id || diff.baselineId;
    if (bid && !baselineStatusMap.has(bid)) {
      baselineStatusMap.set(bid, diff.overall_status || diff.overallStatus || 'no_change');
    }
  }

  async function handleDeleteBaseline(id: string, name: string) {
    if (!confirm(`"${name}" 베이스라인을 삭제하시겠습니까? 관련 비교 결과도 모두 삭제됩니다.`)) return;
    try {
      await deleteBaseline(id);
      setBaselines((prev) => prev.filter((b) => b.id !== id));
      setDiffs((prev) => prev.filter((d) => (d.baseline_id || d.baselineId) !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete baseline');
    }
  }

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

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-10">
        <StatMini label="전체" value={baselines.length} loading={loading} />
        <StatMini label="변경 없음" value={noChangeCount} loading={loading} color="text-success-600" />
        <StatMini label="의도적 변경" value={intentionalCount} loading={loading} color="text-warning-600" />
        <StatMini label="회귀 감지" value={regressionCount} loading={loading} color="text-accent" />
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-0 mb-6 border-b border-border">
        {(['overview', 'baselines', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-0 py-2 mr-6 text-xs font-medium uppercase tracking-widest transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'text-text-primary border-text-primary'
                : 'text-text-muted border-transparent hover:text-text-secondary'
            }`}
          >
            {tab === 'overview' ? '개요' : tab === 'baselines' ? '베이스라인 관리' : '비교 히스토리'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-text-muted text-sm">로딩 중...</div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Regressions (Priority) */}
              {regressionCount > 0 && (
                <section>
                  <h3 className="text-xs font-medium uppercase tracking-widest text-accent mb-3 pb-2 border-b border-border">
                    회귀 감지 (우선 확인)
                  </h3>
                  <div className="space-y-2">
                    {diffs
                      .filter((d) => {
                        const s = d.overall_status || d.overallStatus;
                        return s === 'regression' || s === 'mixed';
                      })
                      .map((diff) => {
                        const bid = diff.baseline_id || diff.baselineId;
                        const baseline = baselines.find((b) => b.id === bid);
                        const changeCount = Array.isArray(diff.changes) ? diff.changes.length : 0;
                        return (
                          <DiffRow
                            key={diff.id}
                            diff={diff}
                            baselineName={baseline?.name || 'Unknown'}
                            changeCount={changeCount}
                            onClick={() => router.push(`/visual/diff/${diff.id}`)}
                          />
                        );
                      })}
                  </div>
                </section>
              )}

              {/* Intentional Changes */}
              {intentionalCount > 0 && (
                <section>
                  <h3 className="text-xs font-medium uppercase tracking-widest text-warning-600 mb-3 pb-2 border-b border-border">
                    의도적 변경
                  </h3>
                  <div className="space-y-2">
                    {diffs
                      .filter((d) => (d.overall_status || d.overallStatus) === 'intentional')
                      .map((diff) => {
                        const bid = diff.baseline_id || diff.baselineId;
                        const baseline = baselines.find((b) => b.id === bid);
                        const changeCount = Array.isArray(diff.changes) ? diff.changes.length : 0;
                        return (
                          <DiffRow
                            key={diff.id}
                            diff={diff}
                            baselineName={baseline?.name || 'Unknown'}
                            changeCount={changeCount}
                            onClick={() => router.push(`/visual/diff/${diff.id}`)}
                          />
                        );
                      })}
                  </div>
                </section>
              )}

              {/* No Changes */}
              {noChangeCount > 0 && (
                <section>
                  <h3 className="text-xs font-medium uppercase tracking-widest text-success-600 mb-3 pb-2 border-b border-border">
                    변경 없음
                  </h3>
                  <div className="space-y-2">
                    {diffs
                      .filter((d) => (d.overall_status || d.overallStatus) === 'no_change')
                      .map((diff) => {
                        const bid = diff.baseline_id || diff.baselineId;
                        const baseline = baselines.find((b) => b.id === bid);
                        return (
                          <DiffRow
                            key={diff.id}
                            diff={diff}
                            baselineName={baseline?.name || 'Unknown'}
                            changeCount={0}
                            onClick={() => router.push(`/visual/diff/${diff.id}`)}
                          />
                        );
                      })}
                  </div>
                </section>
              )}

              {diffs.length === 0 && baselines.length === 0 && (
                <div className="py-12 text-center">
                  <p className="text-text-secondary text-sm mb-1">아직 베이스라인이 없습니다</p>
                  <p className="text-text-muted text-xs">Chrome 확장에서 페이지의 베이스라인 스크린샷을 저장해보세요</p>
                </div>
              )}
            </div>
          )}

          {/* Baselines Tab */}
          {activeTab === 'baselines' && (
            <div className="border border-border rounded overflow-hidden">
              {baselines.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-text-secondary text-sm mb-1">등록된 베이스라인이 없습니다</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-bg">
                      <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-text-muted">이름</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-text-muted">URL</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-text-muted w-24">뷰포트</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-text-muted w-24">상태</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-text-muted w-28">생성일</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-text-muted w-16">액션</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {baselines.map((baseline) => {
                      const latestStatus = baselineStatusMap.get(baseline.id) || 'unchanged';
                      const statusConf = STATUS_LABEL[latestStatus];
                      return (
                        <tr key={baseline.id} className="hover:bg-bg transition-colors">
                          <td className="px-4 py-3 text-text-primary">{baseline.name}</td>
                          <td className="px-4 py-3">
                            <span className="text-text-muted truncate block max-w-xs text-xs">
                              {baseline.page_url || baseline.pageUrl || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-text-muted">
                            {baseline.viewport ? `${baseline.viewport.width}x${baseline.viewport.height}` : '-'}
                          </td>
                          <td className="px-4 py-3">
                            {statusConf ? (
                              <span className={`text-xs font-medium ${statusConf.color}`}>
                                {statusConf.text}
                              </span>
                            ) : (
                              <span className="text-xs text-text-muted">미비교</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-text-muted tabular-nums">
                            {new Date(baseline.created_at || baseline.createdAt || '').toLocaleDateString('ko-KR')}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleDeleteBaseline(baseline.id, baseline.name)}
                              className="text-accent hover:underline text-xs"
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="border border-border rounded overflow-hidden">
              {diffs.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-text-secondary text-sm mb-1">비교 히스토리가 없습니다</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-bg">
                      <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-text-muted">베이스라인</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-text-muted w-28">상태</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-text-muted w-20">변경수</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-text-muted w-20">AI 분석</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-text-muted w-28">비교일</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-text-muted w-20">액션</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {diffs.map((diff) => {
                      const bid = diff.baseline_id || diff.baselineId;
                      const baseline = baselines.find((b) => b.id === bid);
                      const status = diff.overall_status || diff.overallStatus || 'no_change';
                      const statusConf = STATUS_LABEL[status] || STATUS_LABEL.no_change;
                      const changeCount = Array.isArray(diff.changes) ? diff.changes.length : 0;

                      return (
                        <tr
                          key={diff.id}
                          className="hover:bg-bg transition-colors cursor-pointer"
                          onClick={() => router.push(`/visual/diff/${diff.id}`)}
                        >
                          <td className="px-4 py-3 text-text-primary font-medium">
                            {baseline?.name || bid}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium ${statusConf.color}`}>
                              {statusConf.text}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-text-secondary">{changeCount}건</td>
                          <td className="px-4 py-3 text-xs">
                            <span className={diff.ai_analysis_status === 'completed' ? 'text-success-600' : 'text-text-muted'}>
                              {diff.ai_analysis_status === 'completed' ? '완료' : diff.ai_analysis_status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-text-muted tabular-nums">
                            {new Date(diff.created_at || diff.createdAt || '').toLocaleString('ko-KR', {
                              month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                            })}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-text-secondary text-xs font-medium hover:text-text-primary">상세 &rarr;</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DiffRow({
  diff,
  baselineName,
  changeCount,
  onClick,
}: {
  diff: VisualDiff;
  baselineName: string;
  changeCount: number;
  onClick: () => void;
}) {
  const status = diff.overall_status || diff.overallStatus || 'no_change';
  const statusConf = STATUS_LABEL[status] || STATUS_LABEL.no_change;

  const regressions = Array.isArray(diff.changes)
    ? diff.changes.filter((c: any) => c.classification === 'regression')
    : [];
  const summary = regressions.length > 0
    ? regressions.map((c: any) => c.description).join(', ').substring(0, 80)
    : changeCount > 0
      ? `${changeCount}건의 변경 감지`
      : '변경 없음';

  return (
    <div
      onClick={onClick}
      className="border border-border rounded px-4 py-3 flex items-center justify-between hover:bg-bg cursor-pointer transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className={`text-xs font-medium ${statusConf.color}`}>
          {statusConf.text}
        </span>
        <span className="text-sm font-medium text-text-primary">{baselineName}</span>
        <span className="text-xs text-text-muted truncate max-w-xs">{summary}</span>
      </div>
      <span className="text-text-secondary text-xs font-medium">상세 &rarr;</span>
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
