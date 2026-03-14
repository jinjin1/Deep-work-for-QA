import React, { useState, useEffect } from 'react';

type Tab = 'report' | 'visual';

export function Popup() {
  const [activeTab, setActiveTab] = useState<Tab>('report');
  const [isRecording, setIsRecording] = useState(false);
  const [screenshotStatus, setScreenshotStatus] = useState<'idle' | 'capturing' | 'done' | 'error'>('idle');
  const [screenshotError, setScreenshotError] = useState('');

  // Check recording status on mount
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.isRecording) setIsRecording(true);
    });
  }, []);

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
    // Open side panel so user can see recording status + stop there
    openSidePanel();
    // Close popup (it will close automatically when side panel opens, but be explicit)
    window.close();
  };

  const handleOpenSidePanel = () => {
    openSidePanel();
    window.close();
  };

  const handleScreenshot = () => {
    // Open SidePanel first so it's ready to receive the screenshot
    openSidePanel();
    // Start region capture on the page
    chrome.runtime.sendMessage({ type: 'START_REGION_CAPTURE' });
    // Close popup so user can interact with the page overlay
    window.close();
  };

  return (
    <div style={{ padding: 16, minWidth: 300 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Deep Work</h1>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>&#x2699;</button>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e5e7eb', paddingBottom: 8 }}>
        {(['report', 'visual'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '6px 12px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13,
              fontWeight: activeTab === tab ? 600 : 400,
              background: activeTab === tab ? '#f3f4f6' : 'transparent',
              color: activeTab === tab ? '#111827' : '#6b7280',
            }}
          >
            {tab === 'report' ? 'Report' : 'Visual'}
          </button>
        ))}
      </div>

      {/* ===== REPORT TAB ===== */}
      {activeTab === 'report' && (
        <div>
          {isRecording ? (
            /* Recording in progress — direct to SidePanel */
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
            /* Not recording — show start options */
            <div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                현재 페이지에서 버그를 녹화합니다.
                <br />
                <span style={{ fontSize: 11, color: '#9ca3af' }}>
                  녹화 시작 시 SidePanel이 열려 페이지와 동시에 사용 가능합니다.
                </span>
              </div>
              <button
                onClick={handleStartRecording}
                style={{
                  width: '100%', padding: '12px', border: 'none', borderRadius: 8,
                  background: '#ef4444', color: 'white', fontSize: 15, fontWeight: 600,
                  cursor: 'pointer', marginBottom: 8,
                }}
              >
                녹화 시작
              </button>
              <button
                onClick={handleScreenshot}
                disabled={screenshotStatus === 'capturing'}
                style={{
                  width: '100%', padding: '12px', border: '1px solid #e5e7eb', borderRadius: 8,
                  background: screenshotStatus === 'done' ? '#f0fdf4'
                    : screenshotStatus === 'error' ? '#fef2f2' : 'white',
                  fontSize: 15,
                  cursor: screenshotStatus === 'capturing' ? 'wait' : 'pointer',
                  color: screenshotStatus === 'done' ? '#16a34a'
                    : screenshotStatus === 'error' ? '#dc2626' : '#374151',
                  marginBottom: 8,
                }}
              >
                {screenshotStatus === 'idle' && '스크린샷 캡처'}
                {screenshotStatus === 'capturing' && '캡처 중...'}
                {screenshotStatus === 'done' && '캡처 완료!'}
                {screenshotStatus === 'error' && '캡처 실패'}
              </button>
              {screenshotStatus === 'error' && screenshotError && (
                <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4, padding: '0 4px' }}>
                  {screenshotError}
                </div>
              )}
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
