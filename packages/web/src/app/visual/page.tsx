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

const STATUS_CONFIG = {
  no_change: { label: '변경 없음', color: 'bg-green-100 text-green-700', icon: '✅' },
  intentional: { label: '의도적 변경', color: 'bg-yellow-100 text-yellow-700', icon: '🟡' },
  regression: { label: '회귀 감지', color: 'bg-red-100 text-red-700', icon: '🔴' },
  mixed: { label: '복합 변경', color: 'bg-orange-100 text-orange-700', icon: '🟠' },
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

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">
            {loading ? <LoadingPulse /> : baselines.length}
          </div>
          <div className="text-xs text-gray-500 mt-1">전체 베이스라인</div>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {loading ? <LoadingPulse color="green" /> : noChangeCount}
          </div>
          <div className="text-xs text-gray-500 mt-1">변경 없음</div>
        </div>
        <div className="bg-white rounded-xl border border-yellow-200 p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">
            {loading ? <LoadingPulse color="yellow" /> : intentionalCount}
          </div>
          <div className="text-xs text-gray-500 mt-1">의도적 변경</div>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-4 text-center">
          <div className="text-2xl font-bold text-red-600">
            {loading ? <LoadingPulse color="red" /> : regressionCount}
          </div>
          <div className="text-xs text-gray-500 mt-1">회귀 감지</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {(['overview', 'baselines', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'overview' ? '개요' : tab === 'baselines' ? '베이스라인 관리' : '비교 히스토리'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          로딩 중...
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Regressions (Priority) */}
              {regressionCount > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-red-600 uppercase tracking-wider mb-3">
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
                  <h3 className="text-sm font-semibold text-yellow-600 uppercase tracking-wider mb-3">
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
                  <h3 className="text-sm font-semibold text-green-600 uppercase tracking-wider mb-3">
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
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <div className="text-4xl mb-4">👁</div>
                  <p className="text-gray-500 mb-2">아직 베이스라인이 없습니다</p>
                  <p className="text-sm text-gray-400">
                    Chrome 확장에서 페이지의 베이스라인 스크린샷을 저장해보세요
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Baselines Tab */}
          {activeTab === 'baselines' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {baselines.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-4">📷</div>
                  <p className="text-gray-500 mb-2">등록된 베이스라인이 없습니다</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">뷰포트</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">생성일</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">액션</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {baselines.map((baseline) => {
                      const latestStatus = baselineStatusMap.get(baseline.id) || 'unchanged';
                      const statusConf = STATUS_CONFIG[latestStatus as keyof typeof STATUS_CONFIG];
                      return (
                        <tr key={baseline.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{baseline.name}</td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-gray-500 truncate block max-w-xs">
                              {baseline.page_url || baseline.pageUrl || '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {baseline.viewport ? `${baseline.viewport.width}x${baseline.viewport.height}` : '-'}
                          </td>
                          <td className="px-6 py-4">
                            {statusConf ? (
                              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusConf.color}`}>
                                {statusConf.icon} {statusConf.label}
                              </span>
                            ) : (
                              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-gray-100 text-gray-600">
                                미비교
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {new Date(baseline.created_at || baseline.createdAt || '').toLocaleDateString('ko-KR')}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleDeleteBaseline(baseline.id, baseline.name)}
                              className="text-red-500 hover:text-red-700 text-xs"
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
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {diffs.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-4">📊</div>
                  <p className="text-gray-500 mb-2">비교 히스토리가 없습니다</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">베이스라인</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">변경수</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">AI 분석</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">비교일</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">액션</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {diffs.map((diff) => {
                      const bid = diff.baseline_id || diff.baselineId;
                      const baseline = baselines.find((b) => b.id === bid);
                      const status = diff.overall_status || diff.overallStatus || 'no_change';
                      const statusConf = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.no_change;
                      const changeCount = Array.isArray(diff.changes) ? diff.changes.length : 0;

                      return (
                        <tr
                          key={diff.id}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => router.push(`/visual/diff/${diff.id}`)}
                        >
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {baseline?.name || bid}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusConf.color}`}>
                              {statusConf.icon} {statusConf.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{changeCount}건</td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`text-xs ${diff.ai_analysis_status === 'completed' ? 'text-green-600' : 'text-gray-400'}`}>
                              {diff.ai_analysis_status === 'completed' ? '완료' : diff.ai_analysis_status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {new Date(diff.created_at || diff.createdAt || '').toLocaleString('ko-KR', {
                              month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                            })}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-indigo-600 text-xs font-medium">상세 보기 &rarr;</span>
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

function LoadingPulse({ color = 'gray' }: { color?: string }) {
  return <span className={`inline-block w-8 h-7 bg-${color}-100 rounded animate-pulse`} />;
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
  const statusConf = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.no_change;

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
      className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between hover:border-gray-300 cursor-pointer transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusConf.color}`}>
          {statusConf.icon} {statusConf.label}
        </span>
        <span className="text-sm font-medium text-gray-900">{baselineName}</span>
        <span className="text-xs text-gray-400 truncate max-w-xs">{summary}</span>
      </div>
      <span className="text-indigo-600 text-xs font-medium">상세 &rarr;</span>
    </div>
  );
}
