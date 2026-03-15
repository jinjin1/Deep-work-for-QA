import React, { useState } from 'react';

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
  const [screenshotStatus, setScreenshotStatus] = useState<'idle' | 'capturing' | 'done' | 'error'>('idle');
  const [screenshotError, setScreenshotError] = useState('');

  const handleScreenshot = () => {
    chrome.runtime.sendMessage({ type: 'START_REGION_CAPTURE' });
    window.close();
  };

  return (
    <div style={{ padding: 16, minWidth: 280, background: c.surface, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 15, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: c.text }}>Deep Work</h1>
        <span style={{ fontSize: 10, color: c.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>FOR QA</span>
      </div>

      <div style={{ fontSize: 12, color: c.secondary, marginBottom: 12, lineHeight: 1.5 }}>
        현재 페이지에서 버그를 캡처합니다.
        <br />
        <span style={{ fontSize: 11, color: c.muted }}>
          영역을 선택하면 스크린샷이 버그 리포트에 첨부됩니다.
        </span>
      </div>

      <button onClick={handleScreenshot} disabled={screenshotStatus === 'capturing'} style={{
        width: '100%', padding: 10, border: 'none', borderRadius: 4,
        background: screenshotStatus === 'done' ? '#16A34A' : screenshotStatus === 'error' ? c.accent : c.text,
        color: '#fff', fontSize: 13, fontWeight: 600,
        cursor: screenshotStatus === 'capturing' ? 'wait' : 'pointer',
      }}>
        {screenshotStatus === 'idle' && '스크린샷 캡처'}
        {screenshotStatus === 'capturing' && '캡처 중...'}
        {screenshotStatus === 'done' && '캡처 완료'}
        {screenshotStatus === 'error' && '캡처 실패'}
      </button>
      {screenshotStatus === 'error' && screenshotError && (
        <div style={{ fontSize: 11, color: c.accent, marginTop: 6 }}>{screenshotError}</div>
      )}
    </div>
  );
}
