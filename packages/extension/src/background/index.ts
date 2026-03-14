// Deep Work Background Service Worker
export {};

const API_BASE = 'http://localhost:3001/v1';

/** Crop a full-page screenshot to a specific region using OffscreenCanvas */
async function cropScreenshot(
  dataUrl: string,
  rect: { x: number; y: number; w: number; h: number },
  devicePixelRatio: number
): Promise<string> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const sx = Math.round(rect.x * devicePixelRatio);
  const sy = Math.round(rect.y * devicePixelRatio);
  const sw = Math.round(rect.w * devicePixelRatio);
  const sh = Math.round(rect.h * devicePixelRatio);

  // Clamp to bitmap bounds
  const clampedSw = Math.min(sw, bitmap.width - sx);
  const clampedSh = Math.min(sh, bitmap.height - sy);

  const canvas = new OffscreenCanvas(clampedSw, clampedSh);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, sx, sy, clampedSw, clampedSh, 0, 0, clampedSw, clampedSh);
  bitmap.close();

  const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(croppedBlob);
  });
}

/**
 * Phase 1: Region selection overlay. Injected via chrome.scripting.executeScript.
 */
function injectRegionCaptureOverlay() {
  const existing = document.getElementById('__deep_work_overlay__');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = '__deep_work_overlay__';
  Object.assign(overlay.style, {
    position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
    zIndex: '2147483647', cursor: 'crosshair', margin: '0', padding: '0',
    border: 'none', background: 'transparent',
  });

  const canvas = document.createElement('canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  Object.assign(canvas.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%' });
  overlay.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  const tooltip = document.createElement('div');
  Object.assign(tooltip.style, {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
    background: 'rgba(0,0,0,0.8)', color: 'white', padding: '12px 24px',
    borderRadius: '8px', fontSize: '15px', fontWeight: '500', pointerEvents: 'none',
    zIndex: '2147483647', userSelect: 'none',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  });
  tooltip.textContent = '드래그하여 캡처 영역을 선택하세요 (ESC: 취소)';
  overlay.appendChild(tooltip);

  let isDragging = false;
  let startX = 0, startY = 0;
  let rect: { x: number; y: number; w: number; h: number } | null = null;

  function draw(r: typeof rect) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (r && r.w > 0 && r.h > 0) {
      ctx.clearRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = '#4f46e5'; ctx.lineWidth = 2; ctx.setLineDash([]);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      const label = `${Math.round(r.w)} × ${Math.round(r.h)}`;
      ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
      const tw = ctx.measureText(label).width + 12;
      ctx.fillStyle = 'rgba(79,70,229,0.9)';
      ctx.beginPath(); ctx.roundRect(r.x + r.w / 2 - tw / 2, r.y + r.h + 6, tw, 22, 4); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, r.x + r.w / 2, r.y + r.h + 17);
    }
  }

  function norm(sx: number, sy: number, ex: number, ey: number) {
    return { x: Math.min(sx, ex), y: Math.min(sy, ey), w: Math.abs(ex - sx), h: Math.abs(ey - sy) };
  }

  function cleanup() { overlay.remove(); document.removeEventListener('keydown', onKey, true); }

  function finish(r: { x: number; y: number; w: number; h: number }) {
    cleanup();
    requestAnimationFrame(() => {
      setTimeout(() => {
        chrome.runtime.sendMessage({
          type: 'REGION_SELECTED',
          data: { rect: r, devicePixelRatio: window.devicePixelRatio },
        });
      }, 80);
    });
  }

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isDragging = true; startX = e.clientX; startY = e.clientY; rect = null;
    tooltip.style.display = 'none';
  });
  canvas.addEventListener('mousemove', (e) => { if (isDragging) { rect = norm(startX, startY, e.clientX, e.clientY); draw(rect); } });
  canvas.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    if (!rect || rect.w < 10 || rect.h < 10) { rect = null; draw(null); tooltip.style.display = 'block'; return; }
    draw(rect); canvas.style.pointerEvents = 'none';
    // Show confirm buttons
    const bc = document.createElement('div');
    Object.assign(bc.style, { position: 'fixed', left: `${rect.x + rect.w / 2}px`, top: `${rect.y + rect.h + 34}px`, transform: 'translateX(-50%)', display: 'flex', gap: '8px', zIndex: '2147483647' });
    const bs: Record<string, string> = { padding: '6px 16px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', outline: 'none' };
    const cb = document.createElement('button'); Object.assign(cb.style, { ...bs, background: '#4f46e5', color: '#fff' });
    cb.textContent = '✓ 캡처'; cb.onclick = (e) => { e.stopPropagation(); finish(rect!); };
    const xb = document.createElement('button'); Object.assign(xb.style, { ...bs, background: '#fff', color: '#374151', border: '1px solid #d1d5db' });
    xb.textContent = '✕ 취소'; xb.onclick = (e) => { e.stopPropagation(); cleanup(); };
    bc.appendChild(cb); bc.appendChild(xb); overlay.appendChild(bc);
  });

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cleanup(); }
    else if (e.key === 'Enter' && rect) { e.preventDefault(); e.stopPropagation(); finish(rect); }
  }
  document.addEventListener('keydown', onKey, true);
  draw(null);
  document.body.appendChild(overlay);
}

/**
 * Phase 2: Annotation overlay. Injected after region capture with cropped image.
 * Supports: Pen drawing, Text input, Arrow, Colors, Undo.
 */
function injectAnnotationOverlay(imageDataUrl: string) {
  const existing = document.getElementById('__deep_work_overlay__');
  if (existing) existing.remove();

  const F = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  // Root overlay
  const root = document.createElement('div');
  root.id = '__deep_work_overlay__';
  Object.assign(root.style, {
    position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
    zIndex: '2147483647', background: 'rgba(0,0,0,0.75)', display: 'flex',
    flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    fontFamily: F, margin: '0', padding: '0',
  });

  // Load image to get dimensions
  const img = new Image();
  img.onload = () => {
    const maxW = window.innerWidth * 0.85;
    const maxH = window.innerHeight - 120;
    let w = img.width, h = img.height;
    if (w > maxW) { h = h * (maxW / w); w = maxW; }
    if (h > maxH) { w = w * (maxH / h); h = maxH; }
    w = Math.round(w); h = Math.round(h);

    // State
    let activeTool: 'pen' | 'arrow' | 'text' = 'pen';
    let activeColor = '#ef4444';
    const colors = ['#ef4444', '#3b82f6', '#000000', '#22c55e', '#eab308', '#ffffff'];
    type DrawAction = { type: 'pen'; points: { x: number; y: number }[]; color: string; width: number }
      | { type: 'arrow'; from: { x: number; y: number }; to: { x: number; y: number }; color: string }
      | { type: 'text'; x: number; y: number; text: string; color: string; fontSize: number };
    const actions: DrawAction[] = [];
    let currentPenPoints: { x: number; y: number }[] = [];
    let isDrawing = false;
    let arrowStart: { x: number; y: number } | null = null;

    // Toolbar
    const toolbar = document.createElement('div');
    Object.assign(toolbar.style, {
      display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px',
      background: 'rgba(255,255,255,0.95)', padding: '6px 12px', borderRadius: '8px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
    });

    function createToolBtn(label: string, tool: typeof activeTool) {
      const b = document.createElement('button');
      b.textContent = label;
      Object.assign(b.style, {
        padding: '5px 12px', border: '2px solid', borderRadius: '6px', fontSize: '13px',
        fontWeight: '600', cursor: 'pointer', fontFamily: F, outline: 'none',
        background: activeTool === tool ? '#eef2ff' : '#fff',
        borderColor: activeTool === tool ? '#4f46e5' : '#d1d5db',
        color: activeTool === tool ? '#4f46e5' : '#374151',
      });
      b.onclick = () => { activeTool = tool; updateToolbar(); };
      return b;
    }

    function createColorBtn(c: string) {
      const b = document.createElement('button');
      Object.assign(b.style, {
        width: '22px', height: '22px', borderRadius: '50%', border: activeColor === c ? '3px solid #4f46e5' : '2px solid #d1d5db',
        background: c, cursor: 'pointer', outline: 'none', padding: '0',
        boxSizing: 'border-box',
      });
      b.onclick = () => { activeColor = c; updateToolbar(); };
      return b;
    }

    function updateToolbar() {
      toolbar.innerHTML = '';
      toolbar.appendChild(createToolBtn('✏️ 펜', 'pen'));
      toolbar.appendChild(createToolBtn('➜ 화살표', 'arrow'));
      toolbar.appendChild(createToolBtn('T 텍스트', 'text'));
      // Separator
      const sep = document.createElement('div');
      Object.assign(sep.style, { width: '1px', height: '20px', background: '#d1d5db', margin: '0 4px' });
      toolbar.appendChild(sep);
      colors.forEach(c => toolbar.appendChild(createColorBtn(c)));
      // Separator
      const sep2 = sep.cloneNode() as HTMLElement;
      toolbar.appendChild(sep2);
      // Undo
      const ub = document.createElement('button');
      ub.textContent = '↩ 실행취소';
      Object.assign(ub.style, {
        padding: '5px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px',
        cursor: 'pointer', fontFamily: F, background: '#fff', color: '#374151', outline: 'none',
      });
      ub.onclick = () => { actions.pop(); redraw(); };
      toolbar.appendChild(ub);
      // Done
      const db = document.createElement('button');
      db.textContent = '✓ 완료';
      Object.assign(db.style, {
        padding: '5px 14px', border: 'none', borderRadius: '6px', fontSize: '13px',
        fontWeight: '600', cursor: 'pointer', fontFamily: F, background: '#4f46e5', color: '#fff', outline: 'none', marginLeft: '4px',
      });
      db.onclick = () => finishAnnotation();
      toolbar.appendChild(db);
      // Cancel
      const xb = document.createElement('button');
      xb.textContent = '✕';
      Object.assign(xb.style, {
        padding: '5px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px',
        cursor: 'pointer', fontFamily: F, background: '#fff', color: '#9ca3af', outline: 'none',
      });
      xb.onclick = () => root.remove();
      toolbar.appendChild(xb);
    }
    updateToolbar();
    root.appendChild(toolbar);

    // Canvas container
    const container = document.createElement('div');
    Object.assign(container.style, {
      position: 'relative', width: `${w}px`, height: `${h}px`,
      borderRadius: '4px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    });

    // Background canvas (image)
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = img.width; bgCanvas.height = img.height;
    Object.assign(bgCanvas.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%' });
    const bgCtx = bgCanvas.getContext('2d')!;
    bgCtx.drawImage(img, 0, 0);
    container.appendChild(bgCanvas);

    // Annotation canvas
    const annCanvas = document.createElement('canvas');
    annCanvas.width = img.width; annCanvas.height = img.height;
    Object.assign(annCanvas.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', cursor: 'crosshair' });
    container.appendChild(annCanvas);
    const annCtx = annCanvas.getContext('2d')!;

    const scaleX = img.width / w;
    const scaleY = img.height / h;

    function toCanvas(e: MouseEvent) {
      const r = annCanvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * scaleX, y: (e.clientY - r.top) * scaleY };
    }

    function drawArrowHead(ctx2: CanvasRenderingContext2D, fx: number, fy: number, tx: number, ty: number) {
      const angle = Math.atan2(ty - fy, tx - fx);
      const len = 14 * scaleX;
      ctx2.beginPath();
      ctx2.moveTo(tx, ty);
      ctx2.lineTo(tx - len * Math.cos(angle - 0.4), ty - len * Math.sin(angle - 0.4));
      ctx2.lineTo(tx - len * Math.cos(angle + 0.4), ty - len * Math.sin(angle + 0.4));
      ctx2.closePath();
      ctx2.fill();
    }

    function renderActions(ctx2: CanvasRenderingContext2D) {
      for (const a of actions) {
        if (a.type === 'pen' && a.points.length > 1) {
          ctx2.strokeStyle = a.color; ctx2.lineWidth = a.width * scaleX;
          ctx2.lineCap = 'round'; ctx2.lineJoin = 'round';
          ctx2.beginPath(); ctx2.moveTo(a.points[0].x, a.points[0].y);
          for (let i = 1; i < a.points.length; i++) ctx2.lineTo(a.points[i].x, a.points[i].y);
          ctx2.stroke();
        } else if (a.type === 'arrow') {
          ctx2.strokeStyle = a.color; ctx2.fillStyle = a.color;
          ctx2.lineWidth = 3 * scaleX; ctx2.lineCap = 'round';
          ctx2.beginPath(); ctx2.moveTo(a.from.x, a.from.y); ctx2.lineTo(a.to.x, a.to.y); ctx2.stroke();
          drawArrowHead(ctx2, a.from.x, a.from.y, a.to.x, a.to.y);
        } else if (a.type === 'text') {
          ctx2.font = `bold ${a.fontSize * scaleX}px ${F}`;
          ctx2.fillStyle = a.color;
          ctx2.textBaseline = 'top';
          // Text with dark outline for readability
          ctx2.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx2.lineWidth = 3;
          ctx2.strokeText(a.text, a.x, a.y);
          ctx2.fillText(a.text, a.x, a.y);
        }
      }
    }

    function redraw() {
      annCtx.clearRect(0, 0, annCanvas.width, annCanvas.height);
      renderActions(annCtx);
    }

    // Mouse handlers
    annCanvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const p = toCanvas(e);
      if (activeTool === 'pen') {
        isDrawing = true;
        currentPenPoints = [p];
      } else if (activeTool === 'arrow') {
        isDrawing = true;
        arrowStart = p;
      } else if (activeTool === 'text') {
        // Disable canvas pointer events so input is interactable
        annCanvas.style.pointerEvents = 'none';
        // Show text input
        const inputDiv = document.createElement('div');
        Object.assign(inputDiv.style, {
          position: 'absolute', left: `${e.clientX - container.getBoundingClientRect().left}px`,
          top: `${e.clientY - container.getBoundingClientRect().top}px`, zIndex: '2147483647',
        });
        const input = document.createElement('input');
        input.type = 'text'; input.placeholder = '텍스트 입력...';
        Object.assign(input.style, {
          fontSize: '16px', fontWeight: 'bold', fontFamily: F, padding: '4px 8px',
          border: `2px solid ${activeColor}`, borderRadius: '4px', background: 'rgba(255,255,255,0.9)',
          color: '#000', outline: 'none', minWidth: '120px',
        });
        inputDiv.appendChild(input);
        container.appendChild(inputDiv);
        setTimeout(() => input.focus(), 50);
        const color = activeColor;
        let confirmed = false;
        const confirmText = () => {
          if (confirmed) return;
          confirmed = true;
          if (input.value.trim()) {
            actions.push({ type: 'text', x: p.x, y: p.y, text: input.value.trim(), color, fontSize: 18 });
            redraw();
          }
          inputDiv.remove();
          annCanvas.style.pointerEvents = 'auto';
        };
        input.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') confirmText();
          else if (ke.key === 'Escape') { inputDiv.remove(); annCanvas.style.pointerEvents = 'auto'; }
          ke.stopPropagation();
        });
        input.addEventListener('blur', () => setTimeout(confirmText, 100));
      }
    });

    annCanvas.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;
      const p = toCanvas(e);
      if (activeTool === 'pen') {
        currentPenPoints.push(p);
        redraw();
        // Draw current stroke
        if (currentPenPoints.length > 1) {
          annCtx.strokeStyle = activeColor; annCtx.lineWidth = 3 * scaleX;
          annCtx.lineCap = 'round'; annCtx.lineJoin = 'round';
          annCtx.beginPath(); annCtx.moveTo(currentPenPoints[0].x, currentPenPoints[0].y);
          for (let i = 1; i < currentPenPoints.length; i++) annCtx.lineTo(currentPenPoints[i].x, currentPenPoints[i].y);
          annCtx.stroke();
        }
      } else if (activeTool === 'arrow' && arrowStart) {
        redraw();
        annCtx.strokeStyle = activeColor; annCtx.fillStyle = activeColor;
        annCtx.lineWidth = 3 * scaleX; annCtx.lineCap = 'round';
        annCtx.beginPath(); annCtx.moveTo(arrowStart.x, arrowStart.y); annCtx.lineTo(p.x, p.y); annCtx.stroke();
        drawArrowHead(annCtx, arrowStart.x, arrowStart.y, p.x, p.y);
      }
    });

    let arrowEnd: { x: number; y: number } | null = null;
    annCanvas.addEventListener('mousemove', (e) => {
      if (isDrawing && activeTool === 'arrow') arrowEnd = toCanvas(e);
    });

    annCanvas.addEventListener('mouseup', () => {
      if (!isDrawing) return;
      isDrawing = false;
      if (activeTool === 'pen' && currentPenPoints.length > 1) {
        actions.push({ type: 'pen', points: [...currentPenPoints], color: activeColor, width: 3 });
        currentPenPoints = [];
      } else if (activeTool === 'arrow' && arrowStart && arrowEnd) {
        const dx = arrowEnd.x - arrowStart.x, dy = arrowEnd.y - arrowStart.y;
        if (Math.sqrt(dx * dx + dy * dy) > 10) {
          actions.push({ type: 'arrow', from: { ...arrowStart }, to: { ...arrowEnd }, color: activeColor });
        }
      }
      arrowStart = null; arrowEnd = null;
      redraw();
    });

    function finishAnnotation() {
      // Merge bg + annotations
      const mergeCanvas = document.createElement('canvas');
      mergeCanvas.width = img.width; mergeCanvas.height = img.height;
      const mCtx = mergeCanvas.getContext('2d')!;
      mCtx.drawImage(img, 0, 0);
      renderActions(mCtx);
      const resultDataUrl = mergeCanvas.toDataURL('image/png');
      root.remove();
      chrome.runtime.sendMessage({ type: 'ANNOTATION_COMPLETE', data: { dataUrl: resultDataUrl } });
    }

    // Escape key
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); root.remove(); }
    }
    document.addEventListener('keydown', onKey, true);

    root.appendChild(container);
  };
  img.src = imageDataUrl;
  document.body.appendChild(root);
}

let isRecording = false;

// In-memory store for the latest capture data
let latestCaptureData: Record<string, unknown> | null = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'START_RECORDING':
      isRecording = true;
      console.log('[Deep Work] Recording started');
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'START_CAPTURE' });
        }
      });
      // Broadcast to SidePanel and other extension pages
      chrome.runtime.sendMessage({ type: 'RECORDING_STARTED' }).catch(() => {
        // No listeners — safe to ignore
      });
      sendResponse({ success: true });
      break;

    case 'STOP_RECORDING':
      isRecording = false;
      console.log('[Deep Work] Recording stopped');
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'STOP_CAPTURE' });
        }
      });
      // Broadcast to SidePanel and other extension pages
      chrome.runtime.sendMessage({ type: 'RECORDING_STOPPED' }).catch(() => {
        // No listeners — safe to ignore
      });
      sendResponse({ success: true });
      break;

    case 'CAPTURE_DATA':
      latestCaptureData = message.data;
      console.log('[Deep Work] Capture data received:', {
        events: message.data?.events?.length || 0,
        console_logs: message.data?.console_logs?.length || 0,
        network_logs: message.data?.network_logs?.length || 0,
      });
      chrome.storage.local.set({ captureData: message.data }, () => {
        console.log('[Deep Work] Capture data persisted to storage');
      });
      sendResponse({ success: true });
      break;

    case 'GET_CAPTURE_DATA':
      if (latestCaptureData) {
        sendResponse({ success: true, data: latestCaptureData });
      } else {
        chrome.storage.local.get('captureData', (result) => {
          if (result.captureData) {
            latestCaptureData = result.captureData;
            sendResponse({ success: true, data: result.captureData });
          } else {
            sendResponse({ success: false, data: null });
          }
        });
        return true;
      }
      break;

    case 'GET_STATUS':
      sendResponse({ isRecording });
      break;

    case 'TAKE_SCREENSHOT':
      chrome.tabs.captureVisibleTab(
        undefined as unknown as number,
        { format: 'png' },
        (dataUrl) => {
          if (chrome.runtime.lastError) {
            console.error('[Deep Work] Screenshot failed:', chrome.runtime.lastError.message);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            console.log('[Deep Work] Screenshot captured');
            const screenshotData = { dataUrl, timestamp: Date.now() };
            chrome.storage.local.set({ screenshotData }, () => {
              // Broadcast to SidePanel so it can show the screenshot
              chrome.runtime.sendMessage({ type: 'SCREENSHOT_TAKEN' }).catch(() => {
                // No listeners — safe to ignore
              });
              sendResponse({ success: true, dataUrl });
            });
          }
        }
      );
      return true;

    case 'START_REGION_CAPTURE':
      // Inject region capture overlay directly into the active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          const tabId = tabs[0].id;
          chrome.scripting.executeScript({
            target: { tabId },
            func: injectRegionCaptureOverlay,
          }).catch((err) => {
            console.error('[Deep Work] Failed to inject region capture:', err);
          });
        }
      });
      sendResponse({ success: true });
      break;

    case 'REGION_SELECTED': {
      const { rect, devicePixelRatio: dpr } = message.data;
      chrome.tabs.captureVisibleTab(
        undefined as unknown as number,
        { format: 'png' },
        async (fullDataUrl) => {
          if (chrome.runtime.lastError) {
            console.error('[Deep Work] Region screenshot failed:', chrome.runtime.lastError.message);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
            return;
          }
          try {
            const croppedDataUrl = await cropScreenshot(fullDataUrl, rect, dpr);
            console.log('[Deep Work] Region screenshot cropped, injecting annotation overlay');
            // Inject annotation overlay on the page with cropped image
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs[0]?.id) {
                chrome.scripting.executeScript({
                  target: { tabId: tabs[0].id },
                  func: injectAnnotationOverlay,
                  args: [croppedDataUrl],
                }).catch((err) => {
                  console.error('[Deep Work] Failed to inject annotation overlay:', err);
                });
              }
            });
            sendResponse({ success: true });
          } catch (err) {
            console.error('[Deep Work] Crop failed:', err);
            sendResponse({ success: false, error: String(err) });
          }
        }
      );
      return true;
    }

    case 'ANNOTATION_COMPLETE': {
      const annotatedDataUrl = message.data?.dataUrl;
      if (annotatedDataUrl) {
        console.log('[Deep Work] Annotation complete, saving');
        const screenshotData = { dataUrl: annotatedDataUrl, timestamp: Date.now() };
        chrome.storage.local.set({ screenshotData }, () => {
          chrome.runtime.sendMessage({ type: 'SCREENSHOT_TAKEN' }).catch(() => {});
          sendResponse({ success: true });
        });
      } else {
        sendResponse({ success: false, error: 'No data' });
      }
      return true;
    }

    case 'CLEAR_CAPTURE_DATA':
      latestCaptureData = null;
      chrome.storage.local.remove(['captureData', 'screenshotData'], () => {
        console.log('[Deep Work] Capture data cleared');
        sendResponse({ success: true });
      });
      return true;
  }
  return true;
});

// Side panel behavior
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });

console.log('[Deep Work] Background service worker loaded');
