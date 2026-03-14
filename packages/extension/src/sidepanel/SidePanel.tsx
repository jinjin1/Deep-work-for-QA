import React, { useState, useEffect, useCallback } from 'react';
import { createBugReport, generateReproSteps } from '../lib/api';

type Severity = 'critical' | 'major' | 'minor' | 'trivial';
type SidePanelView = 'recording' | 'form' | 'success';

interface CaptureData {
  events: unknown[];
  console_logs: unknown[];
  network_logs: unknown[];
  url: string;
  duration: number;
  environment: {
    browser: string;
    viewport: { width: number; height: number };
    devicePixelRatio: number;
    language?: string;
    platform?: string;
  };
}

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

const c = {
  text: '#111111',
  secondary: '#555555',
  muted: '#999999',
  border: '#E5E5E5',
  bg: '#FAFAFA',
  surface: '#FFFFFF',
  accent: '#E63946',
};

export function SidePanel() {
  const [view, setView] = useState<SidePanelView>('form');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Severity>('major');
  const [sendToLinear, setSendToLinear] = useState(true);

  const [captureData, setCaptureData] = useState<CaptureData | null>(null);
  const [loadingCapture, setLoadingCapture] = useState(false);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);

  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitError, setSubmitError] = useState('');
  const [submittedReport, setSubmittedReport] = useState<{ id?: string; title?: string } | null>(null);

  const [reproSteps, setReproSteps] = useState<string[] | null>(null);
  const [loadingRepro, setLoadingRepro] = useState(false);
  const [reproError, setReproError] = useState('');
  const [currentPageUrl, setCurrentPageUrl] = useState('');

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) setCurrentPageUrl(tabs[0].url);
    });

    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.isRecording) { setIsRecording(true); setView('recording'); }
      else { loadCaptureData(); }
    });
    loadScreenshotData();
  }, []);

  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => setRecordingElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    const listener = (message: { type: string }) => {
      if (message.type === 'RECORDING_STARTED') { setIsRecording(true); setRecordingElapsed(0); setView('recording'); }
      else if (message.type === 'RECORDING_STOPPED') { setIsRecording(false); loadCaptureData(); setView('form'); }
      else if (message.type === 'SCREENSHOT_TAKEN') { loadScreenshotData(true); setView('form'); }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const loadCaptureData = useCallback(() => {
    setLoadingCapture(true);
    chrome.runtime.sendMessage({ type: 'GET_CAPTURE_DATA' }, (response) => {
      if (chrome.runtime.lastError) { setLoadingCapture(false); return; }
      setLoadingCapture(false);
      if (response?.success && response.data) setCaptureData(response.data);
    });
  }, []);

  const loadScreenshotData = useCallback((ignoreExpiry = false) => {
    chrome.storage.local.get('screenshotData', (result) => {
      if (chrome.runtime.lastError) return;
      if (result.screenshotData?.dataUrl) {
        const age = Date.now() - (result.screenshotData.timestamp || 0);
        if (ignoreExpiry || age < 5 * 60 * 1000) setScreenshotDataUrl(result.screenshotData.dataUrl);
        else chrome.storage.local.remove('screenshotData');
      }
    });
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleStartRecording = () => {
    setIsRecording(true); setRecordingElapsed(0); setView('recording');
    setCaptureData(null); setScreenshotDataUrl(null);
    chrome.runtime.sendMessage({ type: 'START_RECORDING' });
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
    setTimeout(() => { loadCaptureData(); setView('form'); }, 500);
  };

  const fetchBackgroundLogs = (): Promise<{
    console_logs: unknown[]; network_logs: unknown[]; url: string; environment: CaptureData['environment'];
  } | null> => {
    return new Promise((resolve) => {
      try {
        const timeout = setTimeout(() => resolve(null), 5000);
        chrome.runtime.sendMessage({ type: 'GET_BACKGROUND_LOGS' }, (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError || !response?.success || !response?.data) { resolve(null); return; }
          resolve(response.data);
        });
      } catch { resolve(null); }
    });
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitState('submitting'); setSubmitError(''); setReproSteps(null); setReproError('');

    try {
      let consoleLogs = captureData?.console_logs || [];
      let networkLogs = captureData?.network_logs || [];
      let pageUrl = captureData?.url || currentPageUrl || 'unknown';
      let environment = captureData?.environment || {
        browser: navigator.userAgent, viewport: { width: window.screen.width, height: window.screen.height },
        devicePixelRatio: window.devicePixelRatio, language: navigator.language, platform: navigator.platform,
      };

      const bgLogs = await fetchBackgroundLogs();
      if (bgLogs) {
        if (!consoleLogs.length) consoleLogs = bgLogs.console_logs || [];
        if (!networkLogs.length) networkLogs = bgLogs.network_logs || [];
        if (!captureData?.url && bgLogs.url) pageUrl = bgLogs.url;
        if (!captureData?.environment && bgLogs.environment) environment = bgLogs.environment;
      }

      const reportResult = await createBugReport({
        title: title.trim(), description: description.trim() || undefined, severity,
        page_url: pageUrl, environment, console_logs: consoleLogs, network_logs: networkLogs,
        events: captureData?.events || [], screenshot_urls: screenshotDataUrl ? [screenshotDataUrl] : [],
      });
      setSubmittedReport(reportResult); setSubmitState('success'); setView('success');

      setLoadingRepro(true);
      try {
        const reproResult = await generateReproSteps({
          events: captureData?.events || [], console_logs: captureData?.console_logs || [],
          page_url: pageUrl, environment: captureData?.environment || {},
        });
        if (reproResult?.steps) setReproSteps(reproResult.steps);
        else if (reproResult?.repro_steps) setReproSteps(reproResult.repro_steps);
        else if (Array.isArray(reproResult)) setReproSteps(reproResult as string[]);
        else { setReproSteps(null); setReproError('AI 재현 스텝을 생성하지 못했습니다.'); }
      } catch (reproErr: unknown) {
        setReproError(reproErr instanceof Error ? reproErr.message : 'AI 재현 스텝 생성 실패');
      } finally { setLoadingRepro(false); }

      chrome.runtime.sendMessage({ type: 'CLEAR_CAPTURE_DATA' }, () => {
        if (chrome.runtime.lastError) console.warn('[SidePanel] CLEAR_CAPTURE_DATA failed');
      });
    } catch (err: unknown) {
      setSubmitState('error');
      setSubmitError(err instanceof Error ? err.message : '리포트 제출 중 오류가 발생했습니다.');
    }
  };

  const handleReset = () => {
    setTitle(''); setDescription(''); setSeverity('major'); setSubmitState('idle');
    setSubmitError(''); setSubmittedReport(null); setReproSteps(null); setReproError('');
    setCaptureData(null); setScreenshotDataUrl(null); setView('form');
  };

  const baseStyle: React.CSSProperties = {
    padding: 16, maxWidth: 400, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif',
    background: c.surface, color: c.text,
  };

  // ===================== RECORDING VIEW =====================
  if (view === 'recording') {
    return (
      <div style={baseStyle}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, letterSpacing: '-0.02em' }}>Deep Work</div>
        <div style={{ textAlign: 'center', padding: 32, border: `1px solid ${c.border}`, borderRadius: 4, marginBottom: 16 }}>
          <div style={{
            display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: c.accent,
            animation: 'pulse 1s ease-in-out infinite', marginBottom: 8,
          }} />
          <div style={{ fontSize: 28, fontWeight: 700, color: c.accent, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
            {formatTime(recordingElapsed)}
          </div>
          <div style={{ fontSize: 12, color: c.secondary, marginTop: 6 }}>버그를 재현한 후 녹화를 중지하세요</div>
        </div>
        <button onClick={handleStopRecording} style={{
          width: '100%', padding: 12, border: 'none', borderRadius: 4,
          background: c.text, color: c.surface, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          녹화 중지 & 리포트 작성
        </button>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      </div>
    );
  }

  // ===================== SUCCESS VIEW =====================
  if (view === 'success') {
    return (
      <div style={baseStyle}>
        <div style={{ textAlign: 'center', padding: 24, border: `1px solid ${c.border}`, borderRadius: 4, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#16A34A', marginBottom: 4 }}>리포트 제출 완료</div>
          <div style={{ fontSize: 12, color: c.muted }}>버그 리포트가 성공적으로 생성되었습니다.</div>
        </div>

        {submittedReport && (
          <div style={{ padding: 12, background: c.bg, borderRadius: 4, marginBottom: 16, border: `1px solid ${c.border}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: c.text }}>{submittedReport.title || title}</div>
            <div style={{ fontSize: 11, color: c.muted, fontFamily: 'monospace' }}>ID: {submittedReport.id || 'N/A'}</div>
          </div>
        )}

        <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: c.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            AI 재현 스텝
          </div>
          {loadingRepro && <div style={{ fontSize: 12, color: c.secondary }}>생성 중...</div>}
          {reproError && <div style={{ fontSize: 11, color: c.accent, padding: 8, background: '#FEF0F1', borderRadius: 4 }}>{reproError}</div>}
          {reproSteps && reproSteps.length > 0 && (
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: c.secondary, lineHeight: 1.6 }}>
              {reproSteps.map((step, i) => (
                <li key={i} style={{ marginBottom: 2 }}>
                  {typeof step === 'string' ? step : (step as any).description || `Step ${(step as any).step_number}: ${(step as any).action}`}
                </li>
              ))}
            </ol>
          )}
          {!loadingRepro && !reproError && (!reproSteps || reproSteps.length === 0) && (
            <div style={{ fontSize: 11, color: c.muted }}>재현 스텝 없음</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <a
            href={`${import.meta.env.VITE_WEB_URL || 'http://localhost:3000'}/bug-reports`}
            target="_blank" rel="noopener noreferrer"
            style={{
              flex: 1, textAlign: 'center', padding: 10, background: c.bg, color: c.text,
              borderRadius: 4, fontSize: 12, fontWeight: 600, textDecoration: 'none', border: `1px solid ${c.border}`,
            }}
          >
            대시보드에서 보기
          </a>
          <button onClick={handleReset} style={{
            flex: 1, padding: 10, background: c.text, color: c.surface,
            border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            새 리포트
          </button>
        </div>
      </div>
    );
  }

  // ===================== FORM VIEW =====================
  return (
    <div style={baseStyle}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, letterSpacing: '-0.02em' }}>새 버그 리포트</div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 10, fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em', color: c.muted }}>제목 *</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="버그를 간단히 설명하세요" disabled={submitState === 'submitting'}
          style={{
            width: '100%', padding: '8px 10px', border: `1px solid ${c.border}`, borderRadius: 4,
            fontSize: 13, boxSizing: 'border-box', opacity: submitState === 'submitting' ? 0.6 : 1,
            outline: 'none', color: c.text,
          }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 10, fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em', color: c.muted }}>설명</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="추가 설명 (선택)" rows={3} disabled={submitState === 'submitting'}
          style={{
            width: '100%', padding: '8px 10px', border: `1px solid ${c.border}`, borderRadius: 4,
            fontSize: 13, resize: 'vertical', boxSizing: 'border-box', opacity: submitState === 'submitting' ? 0.6 : 1,
            outline: 'none', color: c.text, fontFamily: 'inherit',
          }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 10, fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em', color: c.muted }}>심각도</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['critical', 'major', 'minor', 'trivial'] as Severity[]).map((s) => (
            <button key={s} onClick={() => setSeverity(s)} disabled={submitState === 'submitting'}
              style={{
                padding: '4px 10px', border: `1px solid ${severity === s ? c.text : c.border}`, borderRadius: 4,
                cursor: 'pointer', fontSize: 11, background: severity === s ? c.text : c.surface,
                color: severity === s ? c.surface : c.secondary, fontWeight: severity === s ? 600 : 400,
                opacity: submitState === 'submitting' ? 0.6 : 1, transition: 'all 0.15s',
              }}
            >
              {s === 'critical' ? 'Critical' : s === 'major' ? 'Major' : s === 'minor' ? 'Minor' : 'Trivial'}
            </button>
          ))}
        </div>
      </div>

      {screenshotDataUrl && (
        <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: c.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>스크린샷</div>
            <button onClick={() => { setScreenshotDataUrl(null); chrome.storage.local.remove('screenshotData'); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: c.muted, textDecoration: 'underline' }}>
              삭제
            </button>
          </div>
          <img src={screenshotDataUrl} alt="Screenshot"
            style={{ width: '100%', borderRadius: 4, border: `1px solid ${c.border}`, cursor: 'pointer' }}
            onClick={() => window.open(screenshotDataUrl, '_blank')}
          />
        </div>
      )}

      <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: c.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>자동 수집 데이터</div>
        {loadingCapture ? (
          <div style={{ fontSize: 11, color: c.muted }}>데이터 로딩 중...</div>
        ) : captureData ? (
          <div style={{ fontSize: 11, color: c.secondary, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span>환경: {captureData.environment?.viewport ? `${captureData.environment.viewport.width}x${captureData.environment.viewport.height}` : '수집 완료'}</span>
            <span>이벤트: {(captureData.events as unknown[])?.length || 0}개</span>
            <span>
              콘솔: {(captureData.console_logs as unknown[])?.length || 0}개
              {(() => {
                const logs = captureData.console_logs as { level?: string }[];
                const errors = logs?.filter(l => l.level === 'error').length || 0;
                return errors ? ` (${errors} errors)` : '';
              })()}
            </span>
            <span>
              네트워크: {(captureData.network_logs as unknown[])?.length || 0}개
              {(() => {
                const logs = captureData.network_logs as { status?: number }[];
                const failed = logs?.filter(l => !l.status || l.status >= 400).length || 0;
                return failed ? ` (${failed} failed)` : '';
              })()}
            </span>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: c.accent }}>수집된 데이터 없음. 녹화를 시작하세요.</div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: c.secondary }}>
          <input type="checkbox" checked={sendToLinear} onChange={(e) => setSendToLinear(e.target.checked)} disabled={submitState === 'submitting'} />
          Linear Issue 생성
        </label>
      </div>

      {submitState === 'error' && submitError && (
        <div style={{ padding: 10, background: '#FEF0F1', borderLeft: `2px solid ${c.accent}`, marginBottom: 12, fontSize: 12, color: c.accent }}>
          {submitError}
        </div>
      )}

      <button onClick={handleSubmit} disabled={!title.trim() || submitState === 'submitting'}
        style={{
          width: '100%', padding: 12, border: 'none', borderRadius: 4,
          background: !title.trim() || submitState === 'submitting' ? c.border : c.text,
          color: c.surface, fontSize: 13, fontWeight: 600,
          cursor: !title.trim() || submitState === 'submitting' ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        {submitState === 'submitting' ? (
          <>
            <span style={{
              display: 'inline-block', width: 14, height: 14,
              border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
            }} />
            제출 중...
          </>
        ) : '리포트 생성'}
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
