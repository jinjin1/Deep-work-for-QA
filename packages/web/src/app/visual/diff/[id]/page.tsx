'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchVisualDiff, approveVisualDiff, createBugReportFromVisualDiff, updateChangeClassification } from '@/lib/api';

interface VisualChange {
  id: string;
  region: { x: number; y: number; width: number; height: number };
  type: string;
  classification: 'intentional' | 'regression' | 'uncertain';
  confidence: number;
  description: string;
  bug_report_id?: string;
}

interface VisualDiffData {
  id: string;
  baseline_id: string;
  current_screenshot_url: string;
  diff_image_url: string | null;
  changes: VisualChange[];
  overall_status: 'no_change' | 'intentional' | 'regression' | 'mixed';
  ai_analysis_status: string;
  created_at: string;
  baseline: {
    id: string;
    name: string;
    page_url: string;
    viewport: { width: number; height: number };
    screenshot_url: string;
  } | null;
}

type ViewMode = 'side-by-side' | 'overlay' | 'diff-only';

const STATUS_CONFIG = {
  no_change: { label: '변경 없음', color: 'text-green-600', bg: 'bg-green-50 border-green-200', icon: '' },
  intentional: { label: '의도적 변경', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', icon: '' },
  regression: { label: '회귀 감지', color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: '' },
  mixed: { label: '복합 변경', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', icon: '' },
};

const CHANGE_TYPE_LABELS: Record<string, string> = {
  layout_shift: '레이아웃 이동',
  text_change: '텍스트 변경',
  color_change: '색상 변경',
  element_missing: '요소 사라짐',
  element_added: '요소 추가',
  size_change: '크기 변경',
  other: '기타',
};

const CLASSIFICATION_CONFIG = {
  intentional: { label: '의도적', color: 'bg-green-100 text-green-700' },
  regression: { label: '회귀', color: 'bg-red-100 text-red-700' },
  uncertain: { label: '확인 필요', color: 'bg-yellow-100 text-yellow-700' },
};

export default function VisualDiffDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [diff, setDiff] = useState<VisualDiffData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side');
  const [selectedChange, setSelectedChange] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchVisualDiff(id);
        setDiff(res.data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load visual diff');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleApprove() {
    setActionLoading('approve');
    try {
      await approveVisualDiff(id);
      // Reload data
      const res = await fetchVisualDiff(id);
      setDiff(res.data);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleClassifyChange(change: VisualChange, classification: 'intentional' | 'uncertain') {
    setActionLoading(change.id);
    try {
      await updateChangeClassification(id, change.id, classification);
      const res = await fetchVisualDiff(id);
      setDiff(res.data);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update classification');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCreateBugReport(change: VisualChange) {
    setActionLoading(change.id);
    try {
      const res = await createBugReportFromVisualDiff(id, {
        title: `시각적 회귀: ${change.description.substring(0, 50)}...`,
        severity: change.confidence > 0.8 ? 'major' : 'minor',
      });
      alert(`버그 리포트가 생성되었습니다. ID: ${res.data.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create bug report');
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">로딩 중...</div>
      </div>
    );
  }

  if (error || !diff) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error || 'Visual diff not found'}
        </div>
        <button
          onClick={() => router.push('/visual')}
          className="mt-4 text-indigo-600 hover:text-indigo-700 text-sm"
        >
          &larr; 시각적 테스트로 돌아가기
        </button>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[diff.overall_status];
  const regressionCount = diff.changes.filter((c) => c.classification === 'regression').length;
  const intentionalCount = diff.changes.filter((c) => c.classification === 'intentional').length;
  const uncertainCount = diff.changes.filter((c) => c.classification === 'uncertain').length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => router.push('/visual')}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2 block"
          >
            &larr; 시각적 테스트
          </button>
          <h2 className="text-2xl font-bold">
            시각적 비교: {diff.baseline?.name || 'Unknown'}
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-gray-500">
              {new Date(diff.created_at).toLocaleString('ko-KR')}
            </span>
            <span className={`text-sm font-medium px-2 py-0.5 rounded-full border ${statusConfig.bg} ${statusConfig.color}`}>
              {statusConfig.icon} {statusConfig.label}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {diff.overall_status !== 'no_change' && (
            <button
              onClick={handleApprove}
              disabled={actionLoading === 'approve'}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {actionLoading === 'approve' ? '처리 중...' : '모든 변경 승인 & 베이스라인 업데이트'}
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{diff.changes.length}</div>
          <div className="text-xs text-gray-500 mt-1">전체 변경</div>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{regressionCount}</div>
          <div className="text-xs text-gray-500 mt-1">회귀</div>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{intentionalCount}</div>
          <div className="text-xs text-gray-500 mt-1">의도적</div>
        </div>
        <div className="bg-white rounded-xl border border-yellow-200 p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{uncertainCount}</div>
          <div className="text-xs text-gray-500 mt-1">확인 필요</div>
        </div>
      </div>

      {/* View Mode Selector */}
      <div className="flex gap-2 mb-4">
        {(['side-by-side', 'overlay', 'diff-only'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              viewMode === mode
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {mode === 'side-by-side' ? '나란히' : mode === 'overlay' ? '오버레이' : 'Diff만'}
          </button>
        ))}
      </div>

      {/* Comparison View */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        {viewMode === 'side-by-side' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                베이스라인 {diff.baseline ? `(${new Date(diff.created_at).toLocaleDateString('ko-KR')})` : ''}
              </h3>
              <ScreenshotBox url={diff.baseline?.screenshot_url} label="베이스라인 스크린샷" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">현재 상태</h3>
              <ScreenshotBox url={diff.current_screenshot_url} label="현재 스크린샷" />
            </div>
          </div>
        )}
        {viewMode === 'overlay' && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">오버레이 비교</h3>
            {diff.baseline?.screenshot_url && diff.current_screenshot_url ? (
              <div className="relative bg-gray-100 rounded-lg overflow-hidden min-h-[200px]">
                <img src={diff.baseline.screenshot_url} alt="베이스라인" className="w-full" />
                <img
                  src={diff.current_screenshot_url}
                  alt="현재"
                  className="absolute inset-0 w-full opacity-50"
                  style={{ mixBlendMode: 'difference' }}
                />
              </div>
            ) : (
              <ScreenshotBox url={undefined} label="오버레이 뷰 (스크린샷 필요)" />
            )}
          </div>
        )}
        {viewMode === 'diff-only' && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Diff 이미지</h3>
            {diff.baseline?.screenshot_url && diff.current_screenshot_url ? (
              <div className="relative bg-black rounded-lg overflow-hidden min-h-[200px]">
                <img src={diff.baseline.screenshot_url} alt="베이스라인" className="w-full opacity-50" />
                <img
                  src={diff.current_screenshot_url}
                  alt="현재"
                  className="absolute inset-0 w-full opacity-50"
                  style={{ mixBlendMode: 'difference' }}
                />
                <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  차이점이 밝게 표시됩니다
                </div>
              </div>
            ) : (
              <ScreenshotBox url={diff.diff_image_url} label="Diff 이미지" />
            )}
          </div>
        )}
      </div>

      {/* Page info */}
      {diff.baseline && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">URL:</span>
            <span className="text-gray-900 font-mono">{diff.baseline.page_url}</span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-500">뷰포트:</span>
            <span className="text-gray-900">{diff.baseline.viewport.width} x {diff.baseline.viewport.height}</span>
          </div>
        </div>
      )}

      {/* Changes List */}
      <div className="mb-6">
        <h3 className="text-lg font-bold mb-4">변경 사항 ({diff.changes.length}건)</h3>

        {diff.changes.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-green-700 font-medium">시각적 변경이 감지되지 않았습니다.</p>
            <p className="text-green-600 text-sm mt-1">베이스라인과 동일한 상태입니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {diff.changes.map((change, index) => {
              const classConfig = CLASSIFICATION_CONFIG[change.classification];
              const isSelected = selectedChange === change.id;

              return (
                <div
                  key={change.id}
                  className={`bg-white rounded-xl border p-4 transition-all cursor-pointer ${
                    isSelected ? 'border-indigo-300 shadow-md' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedChange(isSelected ? null : change.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${classConfig.color}`}>
                        {classConfig.label}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        #{index + 1} {CHANGE_TYPE_LABELS[change.type] || change.type}
                      </span>
                      <span className="text-xs text-gray-400">
                        ({Math.round(change.confidence * 100)}%)
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      영역: ({change.region.x}, {change.region.y}) {change.region.width}x{change.region.height}
                    </div>
                  </div>

                  <p className="mt-2 text-sm text-gray-600">{change.description}</p>

                  {isSelected && (
                    <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                      {change.classification === 'regression' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreateBugReport(change);
                          }}
                          disabled={actionLoading === change.id}
                          className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          {actionLoading === change.id ? '처리 중...' : '버그 리포트 생성'}
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClassifyChange(change, 'intentional');
                        }}
                        disabled={actionLoading === change.id}
                        className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-200 disabled:opacity-50 transition-colors"
                      >
                        {actionLoading === change.id ? '처리 중...' : '의도적 변경으로 표시'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClassifyChange(change, 'uncertain');
                        }}
                        disabled={actionLoading === change.id}
                        className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
                      >
                        {actionLoading === change.id ? '처리 중...' : '보류'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ScreenshotBox({ url, label }: { url?: string | null; label: string }) {
  if (url && (url.startsWith('data:') || url.startsWith('http') || url.startsWith('/'))) {
    return (
      <div className="bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
        <img src={url} alt={label} className="w-full" />
      </div>
    );
  }
  return (
    <div className="bg-gray-100 rounded-lg p-4 min-h-[200px] flex items-center justify-center border-2 border-dashed border-gray-300">
      <div className="text-center text-gray-400">
        <div className="text-3xl mb-2">📷</div>
        <p className="text-sm">{label}</p>
        <p className="text-xs mt-1">스크린샷 없음</p>
      </div>
    </div>
  );
}
