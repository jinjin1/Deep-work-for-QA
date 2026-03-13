import React, { useState, useEffect } from 'react';

type Tab = 'report' | 'session' | 'visual';

export function Popup() {
  const [activeTab, setActiveTab] = useState<Tab>('report');
  const [isRecording, setIsRecording] = useState(false);
  const [screenshotStatus, setScreenshotStatus] = useState<'idle' | 'capturing' | 'done' | 'error'>('idle');
  const [screenshotError, setScreenshotError] = useState('');

  // Session recording state
  const [isSessionRecording, setIsSessionRecording] = useState(false);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [sessionPageCount, setSessionPageCount] = useState(0);
  const [sessionTag, setSessionTag] = useState('');
  const [sessionCurrentUrl, setSessionCurrentUrl] = useState('');

  // Check recording status on mount
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.isRecording) setIsRecording(true);
      if (response?.isSessionRecording) {
        setIsSessionRecording(true);
        setSessionElapsed(response.elapsed || 0);
        setSessionPageCount(response.pageCount || 0);
        setSessionCurrentUrl(response.currentUrl || '');
      }
    });

    chrome.runtime.sendMessage({ type: 'GET_SESSION_STATUS' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.isSessionRecording) {
        setIsSessionRecording(true);
        setSessionElapsed(response.elapsed || 0);
        setSessionPageCount(response.pageCount || 0);
        setSessionCurrentUrl(response.currentUrl || '');
      }
    });
  }, []);

  // Timer for session recording
  useEffect(() => {
    if (!isSessionRecording) return;
    const interval = setInterval(() => {
      setSessionElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isSessionRecording]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

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
    setScreenshotStatus('capturing');
    setScreenshotError('');

    chrome.runtime.sendMessage({ type: 'TAKE_SCREENSHOT' }, (response) => {
      if (chrome.runtime.lastError) {
        setScreenshotStatus('error');
        setScreenshotError(chrome.runtime.lastError.message || '스크린샷 실패');
        return;
      }

      if (response?.success) {
        setScreenshotStatus('done');
        openSidePanel();
        window.close();
      } else {
        setScreenshotStatus('error');
        setScreenshotError(response?.error || '스크린샷 캡처 실패');
      }
    });
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

  const handleAddMark = () => {
    chrome.runtime.sendMessage({
      type: 'ADD_SESSION_MARK',
      data: { label: 'User mark', timestamp: sessionElapsed * 1000 },
    });
  };

  const tabLabels: Record<Tab, { label: string; icon: string }> = {
    report: { label: '버그 리포트', icon: '\uD83D\uDC1B' },
    session: { label: '세션 분석', icon: '\uD83C\uDFAC' },
    visual: { label: '시각 비교', icon: '\uD83D\uDC41' },
  };

  return (
    <div style={{ padding: 16, minWidth: 320, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Deep Work</h1>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>&#x2699;</button>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e5e7eb', paddingBottom: 8 }}>
        {(['report', 'session', 'visual'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '6px 12px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13,
              fontWeight: activeTab === tab ? 600 : 400,
              background: activeTab === tab ? '#f3f4f6' : 'transparent',
              color: activeTab === tab ? '#111827' : '#6b7280',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <span style={{ fontSize: 12 }}>{tabLabels[tab].icon}</span>
            {tabLabels[tab].label}
          </button>
        ))}
      </div>

      {/* ===== REPORT TAB ===== */}
      {activeTab === 'report' && (
        <div>
          {isRecording ? (
            /* Recording in progress */
            <div>
              <div style={{
                textAlign: 'center', padding: 16, background: '#fef2f2',
                borderRadius: 8, marginBottom: 8,
              }}>
                <div style={{
                  display: 'inline-block', width: 14, height: 14,
                  borderRadius: '50%', background: '#dc2626',
                  animation: 'pulse 1s ease-in-out infinite',
                  marginBottom: 4,
                }} />
                <div style={{ fontSize: 15, fontWeight: 600, color: '#dc2626' }}>녹화 중...</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                  SidePanel에서 녹화를 중지하고 리포트를 작성하세요
                </div>
              </div>
              <button
                onClick={handleOpenSidePanel}
                style={{
                  width: '100%', padding: '12px', border: 'none', borderRadius: 8,
                  background: '#4f46e5', color: 'white', fontSize: 15, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                SidePanel 열기
              </button>
            </div>
          ) : (
            /* Not recording — show capture options as distinct cards */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Option 1: Interaction Recording */}
              <div style={{
                border: '1px solid #fecaca', borderRadius: 10, padding: 14,
                background: '#fffbfb', cursor: 'pointer',
                transition: 'box-shadow 0.15s',
              }}
                onClick={handleStartRecording}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(239,68,68,0.12)')}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, background: '#fef2f2',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, flexShrink: 0,
                  }}>
                    &#x23FA;
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#dc2626' }}>
                      조작 녹화
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.3, marginTop: 2 }}>
                      클릭, 입력 등 사용자 조작을 기록합니다
                    </div>
                  </div>
                </div>
                <div style={{
                  display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4,
                }}>
                  {['클릭/입력', '콘솔 로그', '네트워크'].map((tag) => (
                    <span key={tag} style={{
                      fontSize: 10, color: '#9ca3af', background: '#f9fafb',
                      padding: '2px 6px', borderRadius: 4, border: '1px solid #f3f4f6',
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Option 2: Screenshot Capture */}
              <div style={{
                border: '1px solid #e5e7eb', borderRadius: 10, padding: 14,
                background: screenshotStatus === 'done' ? '#f0fdf4'
                  : screenshotStatus === 'error' ? '#fef2f2' : 'white',
                cursor: screenshotStatus === 'capturing' ? 'wait' : 'pointer',
                transition: 'box-shadow 0.15s',
                opacity: screenshotStatus === 'capturing' ? 0.7 : 1,
              }}
                onClick={screenshotStatus === 'capturing' ? undefined : handleScreenshot}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)')}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, background: '#f3f4f6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, flexShrink: 0,
                  }}>
                    &#x1F4F7;
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
                      {screenshotStatus === 'idle' && '스크린샷 캡처'}
                      {screenshotStatus === 'capturing' && '캡처 중...'}
                      {screenshotStatus === 'done' && '캡처 완료!'}
                      {screenshotStatus === 'error' && '캡처 실패'}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.3, marginTop: 2 }}>
                      현재 화면을 이미지로 저장합니다
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  <span style={{
                    fontSize: 10, color: '#9ca3af', background: '#f9fafb',
                    padding: '2px 6px', borderRadius: 4, border: '1px solid #f3f4f6',
                  }}>
                    현재 화면
                  </span>
                </div>
              </div>
              {screenshotStatus === 'error' && screenshotError && (
                <div style={{ fontSize: 11, color: '#dc2626', padding: '0 4px' }}>
                  {screenshotError}
                </div>
              )}

              {/* Option 3: Manual report (no capture) */}
              <button
                onClick={handleOpenSidePanel}
                style={{
                  width: '100%', padding: '10px', border: '1px solid #e5e7eb', borderRadius: 8,
                  background: 'white', fontSize: 12, cursor: 'pointer', color: '#9ca3af',
                  textAlign: 'center',
                }}
              >
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
                padding: 12, background: '#f0fdf4', borderRadius: 8, marginBottom: 12,
                border: '1px solid #d1fae5',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#065f46', marginBottom: 4 }}>
                  세션 분석이란?
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                  장시간 사용자 행동을 기록하고 AI가 이상 패턴을 자동 분석합니다.
                  버그 리포트 녹화와 달리 긴 테스트 흐름 전체를 추적합니다.
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>
                  태그 (선택)
                </label>
                <input
                  type="text"
                  value={sessionTag}
                  onChange={(e) => setSessionTag(e.target.value)}
                  placeholder="예: 로그인 테스트, 결제 플로우"
                  style={{
                    width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb',
                    borderRadius: 6, fontSize: 13, boxSizing: 'border-box',
                  }}
                />
              </div>
              <button
                onClick={handleStartSessionRecording}
                style={{
                  width: '100%', padding: '12px', border: 'none', borderRadius: 8,
                  background: '#10b981', color: 'white', fontSize: 15, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                세션 녹화 시작
              </button>
            </div>
          ) : (
            <div>
              <div style={{
                textAlign: 'center', padding: 16, background: '#f0fdf4',
                borderRadius: 8, marginBottom: 8,
              }}>
                <div style={{
                  display: 'inline-block', width: 12, height: 12,
                  borderRadius: '50%', background: '#10b981',
                  animation: 'pulse 1s ease-in-out infinite',
                  marginBottom: 4, marginRight: 6, verticalAlign: 'middle',
                }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: '#059669' }}>
                  녹화 중 {formatTime(sessionElapsed)}
                </span>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                  {sessionCurrentUrl ? (() => { try { return new URL(sessionCurrentUrl).hostname; } catch { return sessionCurrentUrl; } })() : ''}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {sessionPageCount} pages visited
                </div>
              </div>
              <button
                onClick={handleAddMark}
                style={{
                  width: '100%', padding: '10px', border: '1px solid #e5e7eb', borderRadius: 8,
                  background: 'white', fontSize: 14, cursor: 'pointer', marginBottom: 6,
                  color: '#374151',
                }}
              >
                마크 추가
              </button>
              <button
                onClick={handleStopSessionRecording}
                style={{
                  width: '100%', padding: '12px', border: 'none', borderRadius: 8,
                  background: '#374151', color: 'white', fontSize: 15, fontWeight: 600,
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
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
            현재 페이지의 시각적 변경을 감지합니다
          </div>
          <button
            style={{
              width: '100%', padding: '12px', border: 'none', borderRadius: 8,
              background: '#6366f1', color: 'white', fontSize: 15, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            베이스라인 저장
          </button>
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
