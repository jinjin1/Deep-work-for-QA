import React, { useState, useEffect } from 'react';

type Tab = 'report' | 'session' | 'visual';

interface BaselineItem {
  id: string;
  name: string;
  pageUrl?: string;
  page_url?: string;
}

const c = {
  text: '#111111',
  secondary: '#555555',
  muted: '#999999',
  border: '#E5E5E5',
  bg: '#FAFAFA',
  surface: '#FFFFFF',
  accent: '#E63946',
  green: '#16A34A',
};

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export function Popup() {
  const [activeTab, setActiveTab] = useState<Tab>('report');
  const [isRecording, setIsRecording] = useState(false);
  const [screenshotStatus, setScreenshotStatus] = useState<'idle' | 'capturing' | 'done' | 'error'>('idle');
  const [screenshotError, setScreenshotError] = useState('');
  const [baselineStatus, setBaselineStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [baselineError, setBaselineError] = useState('');
  const [baselines, setBaselines] = useState<BaselineItem[]>([]);
  const [baselinesLoading, setBaselinesLoading] = useState(false);
  const [comparisonStatus, setComparisonStatus] = useState<Record<string, 'idle' | 'running' | 'done' | 'error'>>({});
  const [comparisonResult, setComparisonResult] = useState<Record<string, string>>({});

  // Session recording state
  const [sessionTag, setSessionTag] = useState('');
  const [isSessionRecording, setIsSessionRecording] = useState(false);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [sessionPageCount, setSessionPageCount] = useState(1);
  const [sessionCurrentUrl, setSessionCurrentUrl] = useState('');

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.isRecording) setIsRecording(true);
    });
  }, []);

  useEffect(() => {
    if (!isSessionRecording) return;
    const interval = setInterval(() => setSessionElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [isSessionRecording]);

  const openSidePanel = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      if (currentTab?.windowId) {
        chrome.sidePanel.open({ windowId: currentTab.windowId });
      }
    });
  };

  const handleStartRecording = () => {
    setIsRecording(true);
    chrome.runtime.sendMessage({ type: 'START_RECORDING' });
    openSidePanel();
    window.close();
  };

  const handleOpenSidePanel = () => {
    openSidePanel();
    window.close();
  };

  const handleScreenshot = () => {
    chrome.runtime.sendMessage({ type: 'START_REGION_CAPTURE' });
    window.close();
  };

  const handleStartSessionRecording = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      const url = currentTab?.url || '';
      setSessionCurrentUrl(url);
      setIsSessionRecording(true);
      setSessionElapsed(0);
      setSessionPageCount(1);
      chrome.runtime.sendMessage({
        type: 'START_SESSION_RECORDING',
        data: { tag: sessionTag, url },
      });
    });
  };

  const handleStopSessionRecording = () => {
    setIsSessionRecording(false);
    chrome.runtime.sendMessage({ type: 'STOP_SESSION_RECORDING' });
  };

  // Load baselines when visual tab is active
  useEffect(() => {
    if (activeTab !== 'visual') return;
    setBaselinesLoading(true);
    chrome.runtime.sendMessage({ type: 'GET_BASELINES' }, (response) => {
      if (chrome.runtime.lastError) {
        setBaselinesLoading(false);
        return;
      }
      if (response?.success) {
        setBaselines(response.data || []);
      }
      setBaselinesLoading(false);
    });
  }, [activeTab]);

  const handleRunComparison = (baselineId: string) => {
    setComparisonStatus((prev) => ({ ...prev, [baselineId]: 'running' }));
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      if (!currentTab?.id) {
        setComparisonStatus((prev) => ({ ...prev, [baselineId]: 'error' }));
        setComparisonResult((prev) => ({ ...prev, [baselineId]: '활성 탭을 찾을 수 없습니다' }));
        return;
      }
      chrome.runtime.sendMessage({
        type: 'RUN_COMPARISON',
        data: { baselineId, tabId: currentTab.id },
      }, (response) => {
        if (chrome.runtime.lastError || !response?.success) {
          setComparisonStatus((prev) => ({ ...prev, [baselineId]: 'error' }));
          setComparisonResult((prev) => ({ ...prev, [baselineId]: response?.error || '비교 실패' }));
          return;
        }
        setComparisonStatus((prev) => ({ ...prev, [baselineId]: 'done' }));
        const d = response.data;
        setComparisonResult((prev) => ({
          ...prev,
          [baselineId]: `${d.overallStatus === 'no_change' ? '변경 없음' : d.overallStatus === 'regression' ? '회귀 감지' : d.overallStatus} (${d.changesCount}건)`,
        }));
      });
    });
  };

  const handleSaveBaseline = () => {
    setBaselineStatus('saving');
    setBaselineError('');
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      if (!currentTab?.id) {
        setBaselineStatus('error');
        setBaselineError('활성 탭을 찾을 수 없습니다');
        return;
      }
      chrome.runtime.sendMessage({
        type: 'SAVE_BASELINE',
        data: {
          tabId: currentTab.id,
          url: currentTab.url || '',
          title: currentTab.title || '',
        },
      }, (response) => {
        if (chrome.runtime.lastError) {
          setBaselineStatus('error');
          setBaselineError(chrome.runtime.lastError.message || '저장 실패');
          return;
        }
        if (response?.success) {
          setBaselineStatus('done');
          setTimeout(() => setBaselineStatus('idle'), 3000);
        } else {
          setBaselineStatus('error');
          setBaselineError(response?.error || '저장 실패');
        }
      });
    });
  };

  const handleAddMark = () => {
    chrome.runtime.sendMessage({
      type: 'ADD_SESSION_MARK',
      data: { label: 'User mark', timestamp: sessionElapsed * 1000 },
    });
  };

  return (
    <div style={{ padding: 16, minWidth: 300, background: c.surface, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 15, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: c.text }}>Deep Work</h1>
        <span style={{ fontSize: 10, color: c.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>QA</span>
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: `1px solid ${c.border}` }}>
        {(['report', 'session', 'visual'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 0', marginRight: 16, border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase',
              color: activeTab === tab ? c.text : c.muted,
              borderBottom: activeTab === tab ? `2px solid ${c.text}` : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {tab === 'report' ? 'Report' : tab === 'session' ? 'Session' : 'Visual'}
          </button>
        ))}
      </div>

      {activeTab === 'report' && (
        <div>
          {isRecording ? (
            <div>
              <div style={{ textAlign: 'center', padding: 16, border: `1px solid ${c.border}`, borderRadius: 4, marginBottom: 8 }}>
                <div style={{
                  display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: c.accent,
                  animation: 'pulse 1s ease-in-out infinite', marginBottom: 6,
                }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: c.accent }}>녹화 중...</div>
                <div style={{ fontSize: 11, color: c.muted, marginTop: 4 }}>
                  SidePanel에서 녹화를 중지하고 리포트를 작성하세요
                </div>
              </div>
              <button onClick={handleOpenSidePanel} style={{
                width: '100%', padding: 10, border: 'none', borderRadius: 4,
                background: c.text, color: c.surface, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                SidePanel 열기
              </button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 12, color: c.secondary, marginBottom: 12, lineHeight: 1.5 }}>
                현재 페이지에서 버그를 녹화합니다.
                <br />
                <span style={{ fontSize: 11, color: c.muted }}>
                  녹화 시작 시 SidePanel이 열립니다.
                </span>
              </div>
              <button onClick={handleStartRecording} style={{
                width: '100%', padding: 10, border: 'none', borderRadius: 4,
                background: c.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 8,
              }}>
                녹화 시작
              </button>
              <button onClick={handleScreenshot} disabled={screenshotStatus === 'capturing'} style={{
                width: '100%', padding: 10, border: `1px solid ${c.border}`, borderRadius: 4,
                background: screenshotStatus === 'done' ? '#F0FDF4' : screenshotStatus === 'error' ? '#FEF2F2' : c.surface,
                fontSize: 13, cursor: screenshotStatus === 'capturing' ? 'wait' : 'pointer',
                color: screenshotStatus === 'done' ? '#16A34A' : screenshotStatus === 'error' ? c.accent : c.text,
                marginBottom: 8,
              }}>
                {screenshotStatus === 'idle' && '스크린샷 캡처'}
                {screenshotStatus === 'capturing' && '캡처 중...'}
                {screenshotStatus === 'done' && '캡처 완료'}
                {screenshotStatus === 'error' && '캡처 실패'}
              </button>
              {screenshotStatus === 'error' && screenshotError && (
                <div style={{ fontSize: 11, color: c.accent, marginTop: 4 }}>{screenshotError}</div>
              )}
              <button onClick={handleOpenSidePanel} style={{
                width: '100%', padding: 10, border: `1px solid ${c.border}`, borderRadius: 4,
                background: c.surface, fontSize: 12, cursor: 'pointer', color: c.muted, textAlign: 'center',
              }}>
                캡처 없이 직접 리포트 작성
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== SESSION TAB ===== */}
      {activeTab === 'session' && (
        <div>
          {!isSessionRecording ? (
            <div>
              <div style={{
                padding: 12, background: c.bg, borderRadius: 4, marginBottom: 12,
                border: `1px solid ${c.border}`,
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: c.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  세션 분석이란?
                </div>
                <div style={{ fontSize: 12, color: c.secondary, lineHeight: 1.5 }}>
                  장시간 사용자 행동을 기록하고 AI가 이상 패턴을 자동 분석합니다.
                  버그 리포트 녹화와 달리 긴 테스트 흐름 전체를 추적합니다.
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, fontWeight: 600, color: c.muted, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  태그 (선택)
                </label>
                <input
                  type="text"
                  value={sessionTag}
                  onChange={(e) => setSessionTag(e.target.value)}
                  placeholder="예: 로그인 테스트, 결제 플로우"
                  style={{
                    width: '100%', padding: '8px 10px', border: `1px solid ${c.border}`,
                    borderRadius: 4, fontSize: 13, boxSizing: 'border-box', outline: 'none', color: c.text,
                  }}
                />
              </div>
              <button
                onClick={handleStartSessionRecording}
                style={{
                  width: '100%', padding: 10, border: 'none', borderRadius: 4,
                  background: c.text, color: c.surface, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                세션 녹화 시작
              </button>
            </div>
          ) : (
            <div>
              <div style={{
                textAlign: 'center', padding: 16, border: `1px solid ${c.border}`,
                borderRadius: 4, marginBottom: 8,
              }}>
                <div style={{
                  display: 'inline-block', width: 10, height: 10,
                  borderRadius: '50%', background: c.accent,
                  animation: 'pulse 1s ease-in-out infinite',
                  marginBottom: 6,
                }} />
                <div style={{ fontSize: 15, fontWeight: 600, color: c.accent, fontFamily: 'monospace' }}>
                  {formatTime(sessionElapsed)}
                </div>
                <div style={{ fontSize: 11, color: c.muted, marginTop: 4 }}>
                  {sessionCurrentUrl ? (() => { try { return new URL(sessionCurrentUrl).hostname; } catch { return sessionCurrentUrl; } })() : ''}
                </div>
                <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>
                  {sessionPageCount} pages visited
                </div>
              </div>
              <button
                onClick={handleAddMark}
                style={{
                  width: '100%', padding: 10, border: `1px solid ${c.border}`, borderRadius: 4,
                  background: c.surface, fontSize: 13, cursor: 'pointer', marginBottom: 6,
                  color: c.text,
                }}
              >
                마크 추가
              </button>
              <button
                onClick={handleStopSessionRecording}
                style={{
                  width: '100%', padding: 10, border: 'none', borderRadius: 4,
                  background: c.text, color: c.surface, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                녹화 중지
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== VISUAL TAB ===== */}
      {activeTab === 'visual' && (
        <div>
          {/* Save Baseline */}
          <button
            onClick={handleSaveBaseline}
            disabled={baselineStatus === 'saving'}
            style={{
              width: '100%', padding: 10, border: 'none', borderRadius: 4,
              background: baselineStatus === 'done' ? c.green : baselineStatus === 'error' ? c.accent : c.text,
              color: c.surface, fontSize: 13, fontWeight: 600,
              cursor: baselineStatus === 'saving' ? 'wait' : 'pointer',
              opacity: baselineStatus === 'saving' ? 0.7 : 1,
              marginBottom: 8,
            }}
          >
            {baselineStatus === 'idle' && '현재 페이지를 베이스라인으로 저장'}
            {baselineStatus === 'saving' && '저장 중...'}
            {baselineStatus === 'done' && '저장 완료'}
            {baselineStatus === 'error' && '저장 실패'}
          </button>
          {baselineStatus === 'error' && baselineError && (
            <div style={{ fontSize: 11, color: c.accent, marginBottom: 8 }}>{baselineError}</div>
          )}

          {/* Baselines List - Run Comparisons */}
          <div style={{
            borderTop: `1px solid ${c.border}`, paddingTop: 10, marginTop: 4,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 600, color: c.muted, marginBottom: 8,
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              비교 실행
            </div>

            {baselinesLoading ? (
              <div style={{ fontSize: 12, color: c.muted, textAlign: 'center', padding: 12 }}>
                로딩 중...
              </div>
            ) : baselines.length === 0 ? (
              <div style={{ fontSize: 12, color: c.muted, textAlign: 'center', padding: 12 }}>
                저장된 베이스라인이 없습니다
              </div>
            ) : (
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {baselines.map((bl) => {
                  const status = comparisonStatus[bl.id] || 'idle';
                  const result = comparisonResult[bl.id];
                  return (
                    <div key={bl.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 0', borderBottom: `1px solid ${c.border}`,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12, color: c.text, fontWeight: 500,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {bl.name}
                        </div>
                        {result && (
                          <div style={{
                            fontSize: 10,
                            color: status === 'done' && result.includes('변경 없음') ? c.green
                              : status === 'done' && result.includes('회귀') ? c.accent
                              : status === 'error' ? c.accent
                              : c.muted,
                            marginTop: 2,
                          }}>
                            {result}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleRunComparison(bl.id)}
                        disabled={status === 'running'}
                        style={{
                          padding: '4px 10px', border: `1px solid ${c.border}`, borderRadius: 3,
                          background: status === 'done' ? (result?.includes('회귀') ? '#FEF2F2' : '#F0FDF4') : c.surface,
                          fontSize: 11, cursor: status === 'running' ? 'wait' : 'pointer',
                          color: status === 'running' ? c.muted : c.text,
                          marginLeft: 8, flexShrink: 0,
                        }}
                      >
                        {status === 'idle' && '비교'}
                        {status === 'running' && '분석 중...'}
                        {status === 'done' && '완료'}
                        {status === 'error' && '재시도'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
