import React, { useState, useEffect } from 'react';

type Tab = 'report' | 'visual';

const c = {
  text: '#111111',
  secondary: '#555555',
  muted: '#999999',
  border: '#E5E5E5',
  bg: '#FAFAFA',
  surface: '#FFFFFF',
  accent: '#E63946',
};

export function Popup() {
  const [activeTab, setActiveTab] = useState<Tab>('report');
  const [isRecording, setIsRecording] = useState(false);
  const [screenshotStatus, setScreenshotStatus] = useState<'idle' | 'capturing' | 'done' | 'error'>('idle');
  const [screenshotError, setScreenshotError] = useState('');

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
    openSidePanel();
    window.close();
  };

  const handleOpenSidePanel = () => {
    openSidePanel();
    window.close();
  };

  const handleScreenshot = () => {
    openSidePanel();
    chrome.runtime.sendMessage({ type: 'START_REGION_CAPTURE' });
    window.close();
  };

  return (
    <div style={{ padding: 16, minWidth: 300, background: c.surface, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 15, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: c.text }}>Deep Work</h1>
        <span style={{ fontSize: 10, color: c.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>QA</span>
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: `1px solid ${c.border}` }}>
        {(['report', 'visual'] as Tab[]).map((tab) => (
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
            {tab === 'report' ? 'Report' : 'Visual'}
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
              }}>
                {screenshotStatus === 'idle' && '스크린샷 캡처'}
                {screenshotStatus === 'capturing' && '캡처 중...'}
                {screenshotStatus === 'done' && '캡처 완료'}
                {screenshotStatus === 'error' && '캡처 실패'}
              </button>
              {screenshotStatus === 'error' && screenshotError && (
                <div style={{ fontSize: 11, color: c.accent, marginTop: 4 }}>{screenshotError}</div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'visual' && (
        <div>
          <div style={{ fontSize: 12, color: c.secondary, marginBottom: 12 }}>
            현재 페이지의 시각적 변경을 감지합니다
          </div>
          <button style={{
            width: '100%', padding: 10, border: 'none', borderRadius: 4,
            background: c.text, color: c.surface, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
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
