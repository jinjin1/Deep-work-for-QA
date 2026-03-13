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

export function SidePanel() {
  // View state
  const [view, setView] = useState<SidePanelView>('form');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);

  // Form state
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

  // On mount: check recording status and capture data
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[SidePanel] GET_STATUS failed:', chrome.runtime.lastError.message);
        return;
      }
      if (response?.isRecording) {
        setIsRecording(true);
        setView('recording');
      } else {
        // Not recording — check for existing capture data
        loadCaptureData();
      }
    });
    // Also load any existing screenshot
    loadScreenshotData();
  }, []);

  // Recording timer
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      setRecordingElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  // Listen for messages from background (e.g., recording state changes)
  useEffect(() => {
    const listener = (message: { type: string }) => {
      if (message.type === 'RECORDING_STARTED') {
        setIsRecording(true);
        setRecordingElapsed(0);
        setView('recording');
      } else if (message.type === 'RECORDING_STOPPED') {
        setIsRecording(false);
        loadCaptureData();
        setView('form');
      } else if (message.type === 'SCREENSHOT_TAKEN') {
        loadScreenshotData();
        setView('form');
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const loadCaptureData = useCallback(() => {
    setLoadingCapture(true);
    chrome.runtime.sendMessage({ type: 'GET_CAPTURE_DATA' }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[SidePanel] GET_CAPTURE_DATA failed:', chrome.runtime.lastError.message);
        setLoadingCapture(false);
        return;
      }
      setLoadingCapture(false);
      if (response?.success && response.data) {
        setCaptureData(response.data);
      }
    });
  }, []);

  const loadScreenshotData = useCallback(() => {
    chrome.storage.local.get('screenshotData', (result) => {
      if (chrome.runtime.lastError) {
        console.warn('[SidePanel] Screenshot load failed:', chrome.runtime.lastError.message);
        return;
      }
      if (result.screenshotData?.dataUrl) {
        setScreenshotDataUrl(result.screenshotData.dataUrl);
      }
    });
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleStartRecording = () => {
    setIsRecording(true);
    setRecordingElapsed(0);
    setView('recording');
    setCaptureData(null);
    setScreenshotDataUrl(null);
    chrome.runtime.sendMessage({ type: 'START_RECORDING' });
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
    // Wait briefly for capture data to arrive, then load it
    setTimeout(() => {
      loadCaptureData();
      setView('form');
    }, 500);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;

    setSubmitState('submitting');
    setSubmitError('');
    setReproSteps(null);
    setReproError('');

    try {
      const reportPayload = {
        title: title.trim(),
        description: description.trim() || undefined,
        severity,
        page_url: captureData?.url || 'unknown',
        environment: captureData?.environment || {},
        console_logs: captureData?.console_logs || [],
        network_logs: captureData?.network_logs || [],
        events: captureData?.events || [],
      };

      const reportResult = await createBugReport(reportPayload);
      setSubmittedReport(reportResult);
      setSubmitState('success');
      setView('success');

      // Generate repro steps via AI
      setLoadingRepro(true);
      try {
        const reproResult = await generateReproSteps({
          events: captureData?.events || [],
          console_logs: captureData?.console_logs || [],
          page_url: captureData?.url || 'unknown',
          environment: captureData?.environment || {},
        });

        if (reproResult?.steps) {
          setReproSteps(reproResult.steps);
        } else if (reproResult?.repro_steps) {
          setReproSteps(reproResult.repro_steps);
        } else if (Array.isArray(reproResult)) {
          setReproSteps(reproResult as string[]);
        } else {
          setReproSteps(null);
          setReproError('AI 재현 스텝을 생성하지 못했습니다.');
        }
      } catch (reproErr: unknown) {
        setReproError(reproErr instanceof Error ? reproErr.message : 'AI 재현 스텝 생성 실패');
      } finally {
        setLoadingRepro(false);
      }

      // Clear stored capture data
      chrome.runtime.sendMessage({ type: 'CLEAR_CAPTURE_DATA' }, () => {
        if (chrome.runtime.lastError) {
          console.warn('[SidePanel] CLEAR_CAPTURE_DATA failed:', chrome.runtime.lastError.message);
        }
      });
    } catch (err: unknown) {
      setSubmitState('error');
      setSubmitError(err instanceof Error ? err.message : '리포트 제출 중 오류가 발생했습니다.');
    }
  };

  const handleReset = () => {
    setTitle('');
    setDescription('');
    setSeverity('major');
    setSubmitState('idle');
    setSubmitError('');
    setSubmittedReport(null);
    setReproSteps(null);
    setReproError('');
    setCaptureData(null);
    setScreenshotDataUrl(null);
    setView('form');
  };

  // ===================== RECORDING VIEW =====================
  if (view === 'recording') {
    return (
      <div style={{ padding: 16, maxWidth: 400 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Deep Work</h2>
        </div>

        <div style={{
          textAlign: 'center',
          padding: 32,
          background: '#fef2f2',
          borderRadius: 12,
          marginBottom: 16,
        }}>
          <div style={{
            display: 'inline-block', width: 20, height: 20,
            borderRadius: '50%', background: '#dc2626',
            animation: 'pulse 1s ease-in-out infinite',
            marginBottom: 8,
          }} />
          <div style={{ fontSize: 32, fontWeight: 700, color: '#dc2626', fontFamily: 'monospace' }}>
            {formatTime(recordingElapsed)}
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            버그를 재현한 후 녹화를 중지하세요
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
            페이지를 자유롭게 조작할 수 있습니다
          </div>
        </div>

        <button
          onClick={handleStopRecording}
          style={{
            width: '100%', padding: 14, border: 'none', borderRadius: 8,
            background: '#374151', color: 'white', fontSize: 15, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          녹화 중지 & 리포트 작성
        </button>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}</style>
      </div>
    );
  }

  // ===================== SUCCESS VIEW =====================
  if (view === 'success') {
    return (
      <div style={{ padding: 16, maxWidth: 400 }}>
        <div style={{
          textAlign: 'center',
          padding: 24,
          background: '#f0fdf4',
          borderRadius: 12,
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>&#x2705;</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#16a34a', margin: '0 0 4px 0' }}>
            리포트 제출 완료
          </h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            버그 리포트가 성공적으로 생성되었습니다.
          </p>
        </div>

        {submittedReport && (
          <div style={{
            padding: 12, background: '#f9fafb', borderRadius: 8,
            marginBottom: 16, border: '1px solid #e5e7eb',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              {submittedReport.title || title}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              ID: {submittedReport.id || 'N/A'}
            </div>
          </div>
        )}

        {/* AI Repro Steps */}
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>
            AI 재현 스텝
          </div>
          {loadingRepro && (
            <div style={{ fontSize: 13, color: '#6366f1' }}>&#x23F3; 생성 중...</div>
          )}
          {reproError && (
            <div style={{ fontSize: 12, color: '#dc2626', padding: 8, background: '#fef2f2', borderRadius: 6 }}>
              {reproError}
            </div>
          )}
          {reproSteps && reproSteps.length > 0 && (
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#374151' }}>
              {reproSteps.map((step, i) => (
                <li key={i} style={{ marginBottom: 4 }}>{step}</li>
              ))}
            </ol>
          )}
          {!loadingRepro && !reproError && (!reproSteps || reproSteps.length === 0) && (
            <div style={{ fontSize: 12, color: '#9ca3af' }}>재현 스텝 없음</div>
          )}
        </div>

        <a
          href="http://localhost:3000/bug-reports"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block', textAlign: 'center', padding: 10,
            background: '#eef2ff', color: '#4f46e5', borderRadius: 8,
            fontSize: 14, fontWeight: 600, textDecoration: 'none', marginBottom: 8,
          }}
        >
          &#x1F4CA; 대시보드에서 보기
        </a>

        <button
          onClick={handleReset}
          style={{
            width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8,
            background: 'white', fontSize: 14, cursor: 'pointer', color: '#374151',
          }}
        >
          새 리포트 작성
        </button>
      </div>
    );
  }

  // ===================== FORM VIEW =====================
  return (
    <div style={{ padding: 16, maxWidth: 400 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>새 버그 리포트</h2>
        {!captureData && (
          <button
            onClick={handleStartRecording}
            style={{
              padding: '6px 12px', border: 'none', borderRadius: 6,
              background: '#ef4444', color: 'white', fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            녹화 시작
          </button>
        )}
      </div>

      {/* Title */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>제목 *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="버그를 간단히 설명하세요"
          disabled={submitState === 'submitting'}
          style={{
            width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6,
            fontSize: 14, boxSizing: 'border-box',
            opacity: submitState === 'submitting' ? 0.6 : 1,
          }}
        />
      </div>

      {/* Description */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>설명</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="추가 설명 (선택)"
          rows={3}
          disabled={submitState === 'submitting'}
          style={{
            width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6,
            fontSize: 14, resize: 'vertical', boxSizing: 'border-box',
            opacity: submitState === 'submitting' ? 0.6 : 1,
          }}
        />
      </div>

      {/* Severity */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>심각도</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['critical', 'major', 'minor', 'trivial'] as Severity[]).map((s) => (
            <button
              key={s}
              onClick={() => setSeverity(s)}
              disabled={submitState === 'submitting'}
              style={{
                padding: '4px 10px', border: '1px solid', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                borderColor: severity === s ? '#6366f1' : '#d1d5db',
                background: severity === s ? '#eef2ff' : 'white',
                color: severity === s ? '#4f46e5' : '#374151',
                fontWeight: severity === s ? 600 : 400,
                opacity: submitState === 'submitting' ? 0.6 : 1,
              }}
            >
              {s === 'critical' ? 'Critical' : s === 'major' ? 'Major' : s === 'minor' ? 'Minor' : 'Trivial'}
            </button>
          ))}
        </div>
      </div>

      {/* Screenshot preview */}
      {screenshotDataUrl && (
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>스크린샷</div>
            <button
              onClick={() => {
                setScreenshotDataUrl(null);
                chrome.storage.local.remove('screenshotData');
              }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, color: '#9ca3af',
              }}
            >
              삭제
            </button>
          </div>
          <img
            src={screenshotDataUrl}
            alt="Screenshot"
            style={{
              width: '100%', borderRadius: 6, border: '1px solid #e5e7eb',
              cursor: 'pointer',
            }}
            onClick={() => window.open(screenshotDataUrl, '_blank')}
          />
        </div>
      )}

      {/* Auto-collected data */}
      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>자동 수집 데이터</div>
        {loadingCapture ? (
          <div style={{ fontSize: 12, color: '#9ca3af' }}>&#x23F3; 데이터 로딩 중...</div>
        ) : captureData ? (
          <div style={{ fontSize: 12, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>
              &#x1F5A5; 환경: {captureData.environment?.viewport
                ? `${captureData.environment.viewport.width}x${captureData.environment.viewport.height}`
                : '수집 완료'}
            </span>
            <span>&#x1F4CB; 이벤트: {(captureData.events as unknown[])?.length || 0}개 수집</span>
            <span>&#x1F6A8; 콘솔 로그: {(captureData.console_logs as unknown[])?.length || 0}개 수집</span>
            <span>&#x1F310; 네트워크: {(captureData.network_logs as unknown[])?.length || 0}개 수집</span>
            <span style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
              URL: {captureData.url ? captureData.url.slice(0, 50) + (captureData.url.length > 50 ? '...' : '') : 'N/A'}
            </span>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#f59e0b' }}>
            &#x26A0;&#xFE0F; 수집된 데이터가 없습니다. 녹화를 시작하세요.
          </div>
        )}
      </div>

      {/* Linear checkbox */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={sendToLinear}
            onChange={(e) => setSendToLinear(e.target.checked)}
            disabled={submitState === 'submitting'}
          />
          Linear Issue 생성
        </label>
      </div>

      {/* Error message */}
      {submitState === 'error' && submitError && (
        <div style={{
          padding: 10, background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 8, marginBottom: 12, fontSize: 13, color: '#dc2626',
        }}>
          {submitError}
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!title.trim() || submitState === 'submitting'}
        style={{
          width: '100%', padding: 12, border: 'none', borderRadius: 8,
          background: !title.trim() || submitState === 'submitting' ? '#d1d5db' : '#4f46e5',
          color: 'white', fontSize: 15, fontWeight: 600,
          cursor: !title.trim() || submitState === 'submitting' ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        {submitState === 'submitting' ? (
          <>
            <span style={{
              display: 'inline-block', width: 16, height: 16,
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: 'white', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            제출 중...
          </>
        ) : (
          '리포트 생성'
        )}
      </button>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
