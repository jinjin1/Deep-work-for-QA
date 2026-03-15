// Deep Work Background Service Worker
export {};

// Server URLs — loaded from chrome.storage.sync, with localhost defaults
let API_BASE = 'http://localhost:3001/v1';
let WEB_BASE = 'http://localhost:3000';
let API_KEY = '';

// Load saved settings on startup
chrome.storage.sync.get(['apiUrl', 'webUrl', 'apiKey'], (result) => {
  if (result.apiUrl) API_BASE = result.apiUrl;
  if (result.webUrl) WEB_BASE = result.webUrl;
  if (result.apiKey) API_KEY = result.apiKey;
  console.log('[Deep Work] Server URLs:', { API_BASE, WEB_BASE });
});

// Listen for settings changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') {
    if (changes.apiUrl?.newValue) API_BASE = changes.apiUrl.newValue;
    if (changes.webUrl?.newValue) WEB_BASE = changes.webUrl.newValue;
    if (changes.apiKey) API_KEY = changes.apiKey.newValue || '';
    console.log('[Deep Work] Server URLs updated:', { API_BASE, WEB_BASE });
  }
});

/** Build request headers, including API key if configured */
function apiHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (API_KEY) headers['X-API-Key'] = API_KEY;
  return headers;
}

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

  function removeOverlay() {
    overlay.remove();
    document.removeEventListener('keydown', onKey, true);
  }

  function cleanup() {
    removeOverlay();
    chrome.runtime.sendMessage({ type: 'REGION_CAPTURE_CANCELLED' });
  }

  function finish(r: { x: number; y: number; w: number; h: number }) {
    removeOverlay();
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
    const btnsY = Math.max(8, Math.min(window.innerHeight - 50,
      (rect.y + rect.h + 60) > window.innerHeight ? rect.y - 46 : rect.y + rect.h + 34
    ));
    Object.assign(bc.style, { position: 'fixed', left: `${rect.x + rect.w / 2}px`, top: `${btnsY}px`, transform: 'translateX(-50%)', display: 'flex', gap: '8px', zIndex: '2147483647' });
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
 * Combined annotation + bug report overlay (Jam.dev-inspired).
 * Full-screen dark overlay with screenshot+tools on top, form panel on right.
 */
function injectAnnotationOverlay(imageDataUrl: string) {
  const existing = document.getElementById('__deep_work_overlay__');
  if (existing) existing.remove();

  const F = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const ACCENT = '#6366f1'; // Indigo-500
  const ACCENT_LIGHT = '#eef2ff';
  const BORDER = '#e2e8f0';
  const TEXT = '#1e293b';
  const TEXT_MUTED = '#94a3b8';

  const root = document.createElement('div');
  root.id = '__deep_work_overlay__';
  Object.assign(root.style, {
    position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
    zIndex: '2147483647', background: 'rgba(15,23,42,0.85)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontFamily: F, margin: '0',
    padding: '24px', boxSizing: 'border-box', backdropFilter: 'blur(4px)',
  });

  // Close button (top-left)
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  Object.assign(closeBtn.style, {
    position: 'fixed', top: '16px', left: '16px', zIndex: '2147483647',
    width: '36px', height: '36px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', fontSize: '14px',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: F, outline: 'none', transition: 'all 0.15s',
  });
  closeBtn.onmouseenter = () => { closeBtn.style.background = 'rgba(255,255,255,0.15)'; closeBtn.style.color = '#fff'; };
  closeBtn.onmouseleave = () => { closeBtn.style.background = 'rgba(255,255,255,0.08)'; closeBtn.style.color = 'rgba(255,255,255,0.7)'; };
  closeBtn.onclick = () => { root.remove(); document.removeEventListener('keydown', onKey, true); chrome.runtime.sendMessage({ type: 'REGION_CAPTURE_CANCELLED' }); };
  root.appendChild(closeBtn);

  const img = new Image();
  img.onload = () => {
    const formWidth = 360;
    const gap = 20;
    const availW = window.innerWidth - formWidth - gap - 80;
    const availH = window.innerHeight - 80;
    let w = img.width, h = img.height;
    if (w > availW) { h = h * (availW / w); w = availW; }
    if (h > availH) { w = w * (availH / h); h = availH; }
    w = Math.round(w); h = Math.round(h);

    // Main layout
    const layout = document.createElement('div');
    Object.assign(layout.style, {
      display: 'flex', gap: `${gap}px`, alignItems: 'center', maxWidth: '100%', maxHeight: '100%',
    });

    // ===== LEFT: Canvas + Toolbar =====
    const leftPanel = document.createElement('div');
    Object.assign(leftPanel.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', flexShrink: '0',
    });

    const container = document.createElement('div');
    Object.assign(container.style, {
      position: 'relative', width: `${w}px`, height: `${h}px`,
      borderRadius: '12px', overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)',
    });

    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = img.width; bgCanvas.height = img.height;
    Object.assign(bgCanvas.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%' });
    bgCanvas.getContext('2d')!.drawImage(img, 0, 0);
    container.appendChild(bgCanvas);

    const annCanvas = document.createElement('canvas');
    annCanvas.width = img.width; annCanvas.height = img.height;
    Object.assign(annCanvas.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', cursor: 'crosshair' });
    container.appendChild(annCanvas);
    const annCtx = annCanvas.getContext('2d')!;

    const scaleX = img.width / w;
    const scaleY = img.height / h;

    let activeTool: 'pen' | 'arrow' | 'text' = 'pen';
    let activeColor = '#ef4444';
    const colors = ['#ef4444', '#3b82f6', '#111111', '#22c55e', '#eab308', '#ffffff'];
    type DrawAction = { type: 'pen'; points: { x: number; y: number }[]; color: string; width: number }
      | { type: 'arrow'; from: { x: number; y: number }; to: { x: number; y: number }; color: string }
      | { type: 'text'; x: number; y: number; text: string; color: string; fontSize: number };
    const actions: DrawAction[] = [];
    let currentPenPoints: { x: number; y: number }[] = [];
    let isDrawing = false;
    let arrowStart: { x: number; y: number } | null = null;
    let arrowEnd: { x: number; y: number } | null = null;

    function toCanvas(e: MouseEvent) {
      const r = annCanvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * scaleX, y: (e.clientY - r.top) * scaleY };
    }

    function drawArrowHead(ctx2: CanvasRenderingContext2D, fx: number, fy: number, tx: number, ty: number) {
      const angle = Math.atan2(ty - fy, tx - fx);
      const len = 14 * scaleX;
      ctx2.beginPath(); ctx2.moveTo(tx, ty);
      ctx2.lineTo(tx - len * Math.cos(angle - 0.4), ty - len * Math.sin(angle - 0.4));
      ctx2.lineTo(tx - len * Math.cos(angle + 0.4), ty - len * Math.sin(angle + 0.4));
      ctx2.closePath(); ctx2.fill();
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
          ctx2.fillStyle = a.color; ctx2.textBaseline = 'top';
          ctx2.strokeStyle = 'rgba(0,0,0,0.5)'; ctx2.lineWidth = 3;
          ctx2.strokeText(a.text, a.x, a.y); ctx2.fillText(a.text, a.x, a.y);
        }
      }
    }

    function redraw() { annCtx.clearRect(0, 0, annCanvas.width, annCanvas.height); renderActions(annCtx); }

    // Mouse handlers
    annCanvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const p = toCanvas(e);
      if (activeTool === 'pen') { isDrawing = true; currentPenPoints = [p]; }
      else if (activeTool === 'arrow') { isDrawing = true; arrowStart = p; }
      else if (activeTool === 'text') {
        annCanvas.style.pointerEvents = 'none';
        const inputDiv = document.createElement('div');
        Object.assign(inputDiv.style, {
          position: 'absolute', left: `${e.clientX - container.getBoundingClientRect().left}px`,
          top: `${e.clientY - container.getBoundingClientRect().top}px`, zIndex: '2147483647',
        });
        const input = document.createElement('input');
        input.type = 'text'; input.placeholder = '텍스트 입력...';
        Object.assign(input.style, {
          fontSize: '16px', fontWeight: 'bold', fontFamily: F, padding: '4px 8px',
          border: `2px solid ${activeColor}`, borderRadius: '4px', background: 'rgba(255,255,255,0.95)',
          color: '#000', outline: 'none', minWidth: '120px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        });
        inputDiv.appendChild(input); container.appendChild(inputDiv);
        setTimeout(() => input.focus(), 50);
        const color = activeColor;
        let confirmed = false;
        const confirmText = () => {
          if (confirmed) return; confirmed = true;
          if (input.value.trim()) { actions.push({ type: 'text', x: p.x, y: p.y, text: input.value.trim(), color, fontSize: 18 }); redraw(); }
          inputDiv.remove(); annCanvas.style.pointerEvents = 'auto';
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
        currentPenPoints.push(p); redraw();
        if (currentPenPoints.length > 1) {
          annCtx.strokeStyle = activeColor; annCtx.lineWidth = 3 * scaleX;
          annCtx.lineCap = 'round'; annCtx.lineJoin = 'round';
          annCtx.beginPath(); annCtx.moveTo(currentPenPoints[0].x, currentPenPoints[0].y);
          for (let i = 1; i < currentPenPoints.length; i++) annCtx.lineTo(currentPenPoints[i].x, currentPenPoints[i].y);
          annCtx.stroke();
        }
      } else if (activeTool === 'arrow' && arrowStart) {
        arrowEnd = p; redraw();
        annCtx.strokeStyle = activeColor; annCtx.fillStyle = activeColor;
        annCtx.lineWidth = 3 * scaleX; annCtx.lineCap = 'round';
        annCtx.beginPath(); annCtx.moveTo(arrowStart.x, arrowStart.y); annCtx.lineTo(p.x, p.y); annCtx.stroke();
        drawArrowHead(annCtx, arrowStart.x, arrowStart.y, p.x, p.y);
      }
    });

    annCanvas.addEventListener('mouseup', () => {
      if (!isDrawing) return; isDrawing = false;
      if (activeTool === 'pen' && currentPenPoints.length > 1) {
        actions.push({ type: 'pen', points: [...currentPenPoints], color: activeColor, width: 3 });
        currentPenPoints = [];
      } else if (activeTool === 'arrow' && arrowStart && arrowEnd) {
        const dx = arrowEnd.x - arrowStart.x, dy = arrowEnd.y - arrowStart.y;
        if (Math.sqrt(dx * dx + dy * dy) > 10) {
          actions.push({ type: 'arrow', from: { ...arrowStart }, to: { ...arrowEnd }, color: activeColor });
        }
      }
      arrowStart = null; arrowEnd = null; redraw();
    });

    // Toolbar (floating, below canvas)
    const toolbar = document.createElement('div');
    Object.assign(toolbar.style, {
      display: 'flex', gap: '3px', alignItems: 'center',
      background: 'rgba(30,41,59,0.95)', padding: '6px 10px', borderRadius: '10px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
    });

    function createToolBtn(label: string, tool: typeof activeTool) {
      const b = document.createElement('button'); b.textContent = label;
      const isActive = activeTool === tool;
      Object.assign(b.style, {
        padding: '5px 10px', border: 'none', borderRadius: '6px', fontSize: '12px',
        fontWeight: '500', cursor: 'pointer', fontFamily: F, outline: 'none',
        background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
        color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
        transition: 'all 0.15s',
      });
      b.onmouseenter = () => { if (activeTool !== tool) b.style.color = 'rgba(255,255,255,0.85)'; };
      b.onmouseleave = () => { if (activeTool !== tool) b.style.color = 'rgba(255,255,255,0.6)'; };
      b.onclick = () => { activeTool = tool; updateToolbar(); };
      return b;
    }

    function createColorBtn(c: string) {
      const b = document.createElement('button');
      const isActive = activeColor === c;
      Object.assign(b.style, {
        width: '18px', height: '18px', borderRadius: '50%',
        border: isActive ? `2px solid #fff` : '2px solid rgba(255,255,255,0.2)',
        background: c, cursor: 'pointer', outline: 'none', padding: '0', boxSizing: 'border-box',
        transition: 'all 0.15s', transform: isActive ? 'scale(1.15)' : 'scale(1)',
      });
      b.onclick = () => { activeColor = c; updateToolbar(); };
      return b;
    }

    function updateToolbar() {
      toolbar.innerHTML = '';
      toolbar.appendChild(createToolBtn('Pen', 'pen'));
      toolbar.appendChild(createToolBtn('Arrow', 'arrow'));
      toolbar.appendChild(createToolBtn('Text', 'text'));
      const sep = document.createElement('div');
      Object.assign(sep.style, { width: '1px', height: '16px', background: 'rgba(255,255,255,0.15)', margin: '0 4px' });
      toolbar.appendChild(sep);
      colors.forEach(c => toolbar.appendChild(createColorBtn(c)));
      const sep2 = sep.cloneNode() as HTMLElement;
      toolbar.appendChild(sep2);
      const ub = document.createElement('button');
      ub.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 10h10a5 5 0 015 5v2M3 10l5-5M3 10l5 5"/></svg>';
      Object.assign(ub.style, {
        padding: '5px 6px', border: 'none', borderRadius: '6px',
        cursor: 'pointer', fontFamily: F, background: 'transparent', color: 'rgba(255,255,255,0.6)',
        outline: 'none', display: 'flex', alignItems: 'center', transition: 'all 0.15s',
      });
      ub.onmouseenter = () => { ub.style.color = '#fff'; ub.style.background = 'rgba(255,255,255,0.1)'; };
      ub.onmouseleave = () => { ub.style.color = 'rgba(255,255,255,0.6)'; ub.style.background = 'transparent'; };
      ub.onclick = () => { actions.pop(); redraw(); };
      toolbar.appendChild(ub);
    }
    updateToolbar();

    leftPanel.appendChild(container);
    leftPanel.appendChild(toolbar);

    // ===== RIGHT: Bug Report Form =====
    const formPanel = document.createElement('div');
    Object.assign(formPanel.style, {
      width: `${formWidth}px`, flexShrink: '0', background: '#fff', borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column',
      maxHeight: `${h + 60}px`, overflow: 'hidden', fontFamily: F, color: TEXT,
    });

    // Form header
    const formHeader = document.createElement('div');
    Object.assign(formHeader.style, {
      padding: '18px 20px 14px', display: 'flex', alignItems: 'center', gap: '8px',
    });
    const formIcon = document.createElement('div');
    formIcon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>';
    Object.assign(formIcon.style, { color: ACCENT, display: 'flex' });
    const formTitle = document.createElement('div');
    formTitle.textContent = 'Bug Report';
    Object.assign(formTitle.style, { fontSize: '15px', fontWeight: '700', letterSpacing: '-0.02em', color: TEXT });
    formHeader.appendChild(formIcon); formHeader.appendChild(formTitle);
    formPanel.appendChild(formHeader);

    // Divider
    const divider = document.createElement('div');
    Object.assign(divider.style, { height: '1px', background: BORDER, margin: '0 20px' });
    formPanel.appendChild(divider);

    // Form body (scrollable)
    const formBody = document.createElement('div');
    Object.assign(formBody.style, {
      padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px',
      flex: '1', overflowY: 'auto',
    });

    // Prevent host page from intercepting keyboard events on our inputs
    function shieldInput(el: HTMLElement) {
      for (const evt of ['keydown', 'keyup', 'keypress'] as const) {
        el.addEventListener(evt, (e) => e.stopPropagation(), true);
      }
    }

    // Helper: create form group
    function createFormGroup(labelText: string, required?: boolean) {
      const group = document.createElement('div');
      const label = document.createElement('label');
      label.innerHTML = required ? `${labelText} <span style="color:${ACCENT}">*</span>` : labelText;
      Object.assign(label.style, {
        fontSize: '12px', fontWeight: '600', color: TEXT_MUTED,
        display: 'block', marginBottom: '6px',
      });
      group.appendChild(label);
      return group;
    }

    // Title
    const titleGroup = createFormGroup('Title', true);
    const titleInput = document.createElement('input');
    titleInput.type = 'text'; titleInput.placeholder = 'Describe the bug briefly';
    Object.assign(titleInput.style, {
      width: '100%', padding: '10px 12px', border: `1.5px solid ${BORDER}`, borderRadius: '8px',
      fontSize: '13px', boxSizing: 'border-box', outline: 'none', color: TEXT, fontFamily: F,
      transition: 'border-color 0.15s, box-shadow 0.15s',
    });
    titleInput.onfocus = () => { titleInput.style.borderColor = ACCENT; titleInput.style.boxShadow = `0 0 0 3px ${ACCENT}20`; };
    titleInput.onblur = () => { titleInput.style.borderColor = BORDER; titleInput.style.boxShadow = 'none'; };
    shieldInput(titleInput);
    titleGroup.appendChild(titleInput);
    formBody.appendChild(titleGroup);

    // Description
    const descGroup = createFormGroup('Description');
    const descInput = document.createElement('textarea');
    descInput.placeholder = 'Steps to reproduce, expected behavior...'; descInput.rows = 3;
    Object.assign(descInput.style, {
      width: '100%', padding: '10px 12px', border: `1.5px solid ${BORDER}`, borderRadius: '8px',
      fontSize: '13px', boxSizing: 'border-box', outline: 'none', color: TEXT, fontFamily: F,
      resize: 'vertical', transition: 'border-color 0.15s, box-shadow 0.15s', lineHeight: '1.5',
    });
    descInput.onfocus = () => { descInput.style.borderColor = ACCENT; descInput.style.boxShadow = `0 0 0 3px ${ACCENT}20`; };
    descInput.onblur = () => { descInput.style.borderColor = BORDER; descInput.style.boxShadow = 'none'; };
    shieldInput(descInput);
    descGroup.appendChild(descInput);
    formBody.appendChild(descGroup);

    // Severity
    const sevGroup = createFormGroup('Severity');
    const sevRow = document.createElement('div');
    Object.assign(sevRow.style, { display: 'flex', gap: '6px' });
    let selectedSeverity = 'major';
    const severities: { key: string; label: string; color: string }[] = [
      { key: 'critical', label: 'Critical', color: '#ef4444' },
      { key: 'major', label: 'Major', color: '#f97316' },
      { key: 'minor', label: 'Minor', color: '#eab308' },
      { key: 'trivial', label: 'Trivial', color: '#94a3b8' },
    ];
    const sevButtons: HTMLButtonElement[] = [];

    function updateSevButtons() {
      sevButtons.forEach((btn, i) => {
        const s = severities[i]; const sel = s.key === selectedSeverity;
        Object.assign(btn.style, {
          background: sel ? s.color : '#fff',
          color: sel ? '#fff' : TEXT_MUTED,
          borderColor: sel ? s.color : BORDER,
          fontWeight: sel ? '600' : '500',
          boxShadow: sel ? `0 2px 8px ${s.color}30` : 'none',
        });
      });
    }
    severities.forEach((s) => {
      const btn = document.createElement('button');
      btn.textContent = s.label;
      Object.assign(btn.style, {
        padding: '5px 12px', border: `1.5px solid ${BORDER}`, borderRadius: '6px',
        fontSize: '12px', cursor: 'pointer', fontFamily: F, outline: 'none',
        transition: 'all 0.15s',
      });
      btn.onclick = () => { selectedSeverity = s.key; updateSevButtons(); };
      sevButtons.push(btn); sevRow.appendChild(btn);
    });
    updateSevButtons();
    sevGroup.appendChild(sevRow);
    formBody.appendChild(sevGroup);

    formPanel.appendChild(formBody);

    // Status message
    const statusMsg = document.createElement('div');
    Object.assign(statusMsg.style, { padding: '0 20px 10px', fontSize: '12px', display: 'none' });
    formPanel.appendChild(statusMsg);

    // Form footer
    const formFooter = document.createElement('div');
    Object.assign(formFooter.style, {
      padding: '14px 20px', borderTop: `1px solid ${BORDER}`,
      display: 'flex', justifyContent: 'flex-end', gap: '8px', background: '#fafbfc',
      borderRadius: '0 0 16px 16px',
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    Object.assign(cancelBtn.style, {
      padding: '9px 16px', border: `1.5px solid ${BORDER}`, borderRadius: '8px',
      fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: F,
      background: '#fff', color: TEXT_MUTED, outline: 'none', transition: 'all 0.15s',
    });
    cancelBtn.onmouseenter = () => { cancelBtn.style.borderColor = '#cbd5e1'; cancelBtn.style.color = TEXT; };
    cancelBtn.onmouseleave = () => { cancelBtn.style.borderColor = BORDER; cancelBtn.style.color = TEXT_MUTED; };
    cancelBtn.onclick = () => { root.remove(); document.removeEventListener('keydown', onKey, true); chrome.runtime.sendMessage({ type: 'REGION_CAPTURE_CANCELLED' }); };

    const submitBtn = document.createElement('button');
    submitBtn.textContent = 'Create & copy link';
    Object.assign(submitBtn.style, {
      padding: '9px 20px', border: 'none', borderRadius: '8px',
      fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: F,
      background: ACCENT, color: '#fff', outline: 'none', transition: 'all 0.15s',
      boxShadow: `0 2px 8px ${ACCENT}30`,
    });
    submitBtn.onmouseenter = () => { submitBtn.style.background = '#4f46e5'; };
    submitBtn.onmouseleave = () => { submitBtn.style.background = ACCENT; };

    submitBtn.onclick = () => {
      const title = titleInput.value.trim();
      if (!title) {
        titleInput.style.borderColor = '#ef4444';
        titleInput.style.boxShadow = '0 0 0 3px #ef444420';
        titleInput.focus(); return;
      }
      submitBtn.disabled = true; submitBtn.textContent = 'Submitting...';
      Object.assign(submitBtn.style, { opacity: '0.7', cursor: 'wait' });

      // Merge annotations onto screenshot
      const mergeCanvas = document.createElement('canvas');
      mergeCanvas.width = img.width; mergeCanvas.height = img.height;
      const mCtx = mergeCanvas.getContext('2d')!;
      mCtx.drawImage(img, 0, 0); renderActions(mCtx);
      const finalDataUrl = mergeCanvas.toDataURL('image/png');

      chrome.runtime.sendMessage({
        type: 'SUBMIT_BUG_REPORT',
        data: {
          title, description: descInput.value.trim() || undefined,
          severity: selectedSeverity, screenshotDataUrl: finalDataUrl, pageUrl: window.location.href,
        },
      }, (response: { success: boolean; error?: string; reportId?: string }) => {
        if (response?.success) {
          formPanel.innerHTML = '';
          Object.assign(formPanel.style, {
            justifyContent: 'center', alignItems: 'center',
            minHeight: '300px', overflow: 'visible',
          });
          const successDiv = document.createElement('div');
          Object.assign(successDiv.style, {
            padding: '48px 24px', textAlign: 'center', display: 'flex',
            flexDirection: 'column', alignItems: 'center', gap: '14px',
            width: '100%',
          });
          const checkmark = document.createElement('div');
          checkmark.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>';
          Object.assign(checkmark.style, {
            width: '56px', height: '56px', borderRadius: '50%', background: '#f0fdf4',
            display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #bbf7d0',
          });
          const msg = document.createElement('div'); msg.textContent = 'Report created';
          Object.assign(msg.style, { fontSize: '16px', fontWeight: '700', color: TEXT });
          const subMsg = document.createElement('div');
          subMsg.textContent = response.reportId ? `ID: ${response.reportId}` : 'Successfully submitted';
          Object.assign(subMsg.style, { fontSize: '12px', color: TEXT_MUTED, fontFamily: 'monospace' });
          // Copy link to clipboard
          if (response.reportId) {
            const reportLink = `${WEB_BASE}/bug-reports/${response.reportId}`;
            navigator.clipboard.writeText(reportLink).catch(() => {});
            const copiedMsg = document.createElement('div');
            copiedMsg.textContent = 'Link copied to clipboard';
            Object.assign(copiedMsg.style, { fontSize: '12px', color: '#16a34a', fontWeight: '500' });
            successDiv.appendChild(copiedMsg);
          }
          const btnRow = document.createElement('div');
          Object.assign(btnRow.style, { display: 'flex', gap: '8px', marginTop: '8px' });
          if (response.reportId) {
            const viewBtn = document.createElement('button'); viewBtn.textContent = 'View Report';
            Object.assign(viewBtn.style, {
              padding: '10px 20px', border: 'none', borderRadius: '8px',
              fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: F,
              background: ACCENT, color: '#fff', outline: 'none', transition: 'all 0.15s',
              boxShadow: `0 2px 8px ${ACCENT}30`,
            });
            viewBtn.onmouseenter = () => { viewBtn.style.background = '#4f46e5'; };
            viewBtn.onmouseleave = () => { viewBtn.style.background = ACCENT; };
            viewBtn.onclick = () => {
              window.open(`${WEB_BASE}/bug-reports/${response.reportId}`, '_blank');
              root.remove(); document.removeEventListener('keydown', onKey, true);
            };
            btnRow.appendChild(viewBtn);
          }
          const doneBtn = document.createElement('button'); doneBtn.textContent = 'Done';
          Object.assign(doneBtn.style, {
            padding: '10px 20px', border: `1.5px solid ${BORDER}`, borderRadius: '8px',
            fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: F,
            background: '#fff', color: TEXT_MUTED, outline: 'none', transition: 'all 0.15s',
          });
          doneBtn.onclick = () => { root.remove(); document.removeEventListener('keydown', onKey, true); };
          btnRow.appendChild(doneBtn);
          successDiv.appendChild(checkmark); successDiv.appendChild(msg);
          successDiv.appendChild(subMsg); successDiv.appendChild(btnRow);
          formPanel.appendChild(successDiv);
        } else {
          submitBtn.disabled = false; submitBtn.textContent = 'Create & copy link';
          Object.assign(submitBtn.style, { opacity: '1', cursor: 'pointer' });
          statusMsg.textContent = response?.error || 'Submission failed';
          Object.assign(statusMsg.style, { display: 'block', color: '#ef4444', fontWeight: '500' });
        }
      });
    };

    formFooter.appendChild(cancelBtn); formFooter.appendChild(submitBtn);
    formPanel.appendChild(formFooter);

    layout.appendChild(leftPanel);
    layout.appendChild(formPanel);
    root.appendChild(layout);

    setTimeout(() => titleInput.focus(), 100);
  };
  img.src = imageDataUrl;

  function onKey(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); root.remove(); document.removeEventListener('keydown', onKey, true); chrome.runtime.sendMessage({ type: 'REGION_CAPTURE_CANCELLED' }); }
  }
  document.addEventListener('keydown', onKey, true);
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

    case 'GET_BACKGROUND_LOGS': {
      // Forward to content script to get always-on logs
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]?.id) {
          console.warn('[Deep Work] No active tab for GET_BACKGROUND_LOGS');
          sendResponse({ success: false, data: null });
          return;
        }

        // Set a timeout to prevent hanging
        const timeoutId = setTimeout(() => {
          console.warn('[Deep Work] GET_BACKGROUND_LOGS timeout');
          sendResponse({ success: false, data: null });
        }, 5000);

        chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_BACKGROUND_LOGS' }, (response) => {
          clearTimeout(timeoutId);
          if (chrome.runtime.lastError) {
            console.warn('[Deep Work] GET_BACKGROUND_LOGS failed:', chrome.runtime.lastError.message);
            sendResponse({ success: false, data: null });
          } else if (response?.success && response?.data) {
            console.log('[Deep Work] Background logs forwarded:', {
              consoleLogs: response.data.console_logs?.length || 0,
              networkLogs: response.data.network_logs?.length || 0,
            });
            sendResponse(response);
          } else {
            console.warn('[Deep Work] GET_BACKGROUND_LOGS: empty response');
            sendResponse({ success: false, data: null });
          }
        });
      });
      return true; // async
    }

    case 'TAKE_SCREENSHOT':
      chrome.tabs.captureVisibleTab(
        { format: 'png' },
        (dataUrl) => {
          if (chrome.runtime.lastError) {
            console.error('[Deep Work] Screenshot failed:', chrome.runtime.lastError.message);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            console.log('[Deep Work] Screenshot captured');
            const screenshotData = { dataUrl, timestamp: Date.now() };
            chrome.storage.local.set({ screenshotData }, () => {
              sendResponse({ success: true, dataUrl });
            });
          }
        }
      );
      return true;

    case 'START_REGION_CAPTURE': {
      // Inject overlay - use tabs from sender or query active tab
      const injectCapture = async () => {
        try {
          const tabId = sender.tab?.id;
          if (tabId) {
            await chrome.scripting.executeScript({
              target: { tabId },
              func: injectRegionCaptureOverlay,
            });
          } else {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]?.id) {
              await chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: injectRegionCaptureOverlay,
              });
            }
          }
          sendResponse({ success: true });
        } catch (err) {
          console.error('[Deep Work] Failed to inject region capture:', err);
          sendResponse({ success: false, error: String(err) });
        }
      };
      injectCapture();
      return true;
    }

    case 'REGION_SELECTED': {
      const { rect, devicePixelRatio: dpr } = message.data;
      chrome.tabs.captureVisibleTab(
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
      // No longer used for side panel flow — form is shown inline via showBugReportForm.
      // Keep for backwards compatibility (e.g. side panel screenshot button).
      const annotatedDataUrl = message.data?.dataUrl;
      if (annotatedDataUrl) {
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

    case 'SUBMIT_BUG_REPORT': {
      const { title, description, severity, screenshotDataUrl: ssDataUrl, pageUrl } = message.data;
      console.log('[Deep Work] Submitting bug report:', title);

      // Fetch background logs from content script
      const submitReport = async (consoleLogs: unknown[], networkLogs: unknown[], environment: object) => {
        try {
          const res = await fetch(`${API_BASE}/bug-reports`, {
            method: 'POST',
            headers: apiHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              title,
              description,
              severity,
              page_url: pageUrl || 'unknown',
              environment,
              console_logs: consoleLogs,
              network_logs: networkLogs,
              events: [],
              screenshot_urls: ssDataUrl ? [ssDataUrl] : [],
            }),
          });
          const json = await res.json().catch(() => null);
          if (!res.ok) {
            sendResponse({ success: false, error: json?.error?.message || `API error (${res.status})` });
            return;
          }
          // Save screenshot
          if (ssDataUrl) {
            chrome.storage.local.set({ screenshotData: { dataUrl: ssDataUrl, timestamp: Date.now() } });
          }
          sendResponse({ success: true, reportId: json?.data?.id });
        } catch (err) {
          console.error('[Deep Work] Submit failed:', err);
          sendResponse({ success: false, error: String(err) });
        }
      };

      // Try to get background logs — use sender.tab.id if available (from injected script),
      // otherwise fall back to querying the active tab
      const getLogsFromTab = (tabId: number, retryCount = 0) => {
        chrome.tabs.sendMessage(tabId, { type: 'GET_BACKGROUND_LOGS' }, (response) => {
          if (chrome.runtime.lastError || !response?.success) {
            const errMsg = chrome.runtime.lastError?.message || 'unsuccessful response';
            console.warn('[Deep Work] GET_BACKGROUND_LOGS failed for tab', tabId, ':', errMsg, '(attempt', retryCount + 1, ')');

            // If content script is not connected, inject it and retry
            if (retryCount < 2) {
              console.log('[Deep Work] Injecting content scripts into tab', tabId, 'and retrying...');
              Promise.all([
                chrome.scripting.executeScript({
                  target: { tabId },
                  files: ['src/content/mainWorldCapture.ts'],
                  world: 'MAIN' as any,
                }).catch(() => {}),
                chrome.scripting.executeScript({
                  target: { tabId },
                  files: ['src/content/index.ts'],
                }).catch(() => {}),
              ]).then(() => {
                // Wait for scripts to initialize and collect some data
                setTimeout(() => getLogsFromTab(tabId, retryCount + 1), 500);
              });
            } else {
              console.warn('[Deep Work] All retries exhausted, submitting without logs');
              submitReport([], [], {});
            }
          } else {
            console.log('[Deep Work] Got background logs from tab', tabId, ':',
              'console:', response.data?.console_logs?.length || 0,
              'network:', response.data?.network_logs?.length || 0);
            submitReport(
              response.data?.console_logs || [],
              response.data?.network_logs || [],
              response.data?.environment || {},
            );
          }
        });
      };

      if (sender.tab?.id) {
        getLogsFromTab(sender.tab.id);
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (!tabs[0]?.id) {
            console.warn('[Deep Work] No active tab found for GET_BACKGROUND_LOGS');
            submitReport([], [], {});
            return;
          }
          getLogsFromTab(tabs[0].id);
        });
      }
      return true; // async
    }

    case 'SAVE_BASELINE': {
      const { tabId, url, title } = message.data || {};
      if (!tabId) {
        sendResponse({ success: false, error: 'No tab ID' });
        break;
      }

      (async () => {
        try {
          // Capture visible tab screenshot
          const tab = await chrome.tabs.get(tabId);
          const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });

          // Get viewport info from the tab
          const [viewportResult] = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => ({ width: window.innerWidth, height: window.innerHeight }),
          });
          const viewport = viewportResult?.result || { width: 1440, height: 900 };

          // Generate baseline name from page title or URL
          let baselineName = title || '';
          if (!baselineName) {
            try {
              baselineName = new URL(url).hostname;
            } catch {
              baselineName = 'Untitled';
            }
          }
          baselineName = `${baselineName} - ${new Date().toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`;

          // POST to API
          const res = await fetch(`${API_BASE}/baselines`, {
            method: 'POST',
            headers: apiHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              name: baselineName,
              page_url: url,
              viewport,
              screenshot_url: dataUrl,
            }),
          });

          if (!res.ok) {
            const errBody = await res.json().catch(() => null);
            throw new Error(errBody?.error?.message || `API error (${res.status})`);
          }

          const result = await res.json();
          console.log('[Deep Work] Baseline saved:', result.data?.id);
          sendResponse({ success: true, data: result.data });
        } catch (err: any) {
          console.error('[Deep Work] Failed to save baseline:', err);
          sendResponse({ success: false, error: err.message || 'Failed to save baseline' });
        }
      })();
      return true;
    }

    case 'GET_BASELINES': {
      (async () => {
        try {
          const res = await fetch(`${API_BASE}/baselines`);
          if (!res.ok) throw new Error(`API error (${res.status})`);
          const json = await res.json();
          sendResponse({ success: true, data: json.data || [] });
        } catch (err: any) {
          console.error('[Deep Work] Failed to fetch baselines:', err);
          sendResponse({ success: false, error: err.message, data: [] });
        }
      })();
      return true;
    }

    case 'RUN_COMPARISON': {
      const { baselineId, tabId } = message.data || {};
      if (!baselineId || !tabId) {
        sendResponse({ success: false, error: 'baselineId and tabId are required' });
        break;
      }

      (async () => {
        try {
          // Capture current page screenshot
          const tab = await chrome.tabs.get(tabId);
          const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });

          // Create visual diff
          const diffRes = await fetch(`${API_BASE}/visual-diffs`, {
            method: 'POST',
            headers: apiHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              baseline_id: baselineId,
              current_screenshot_url: dataUrl,
            }),
          });
          if (!diffRes.ok) {
            const errBody = await diffRes.json().catch(() => null);
            throw new Error(errBody?.error?.message || `API error (${diffRes.status})`);
          }
          const diffJson = await diffRes.json();
          const diffId = diffJson.data?.id;

          // Trigger analysis
          const analyzeRes = await fetch(`${API_BASE}/visual-diffs/${diffId}/analyze`, {
            method: 'POST',
            headers: apiHeaders({ 'Content-Type': 'application/json' }),
          });
          if (!analyzeRes.ok) throw new Error('Analysis failed');
          const analyzeJson = await analyzeRes.json();

          console.log('[Deep Work] Comparison complete:', diffId, analyzeJson.data?.overall_status);
          sendResponse({
            success: true,
            data: {
              diffId,
              overallStatus: analyzeJson.data?.overall_status,
              changesCount: analyzeJson.data?.changes?.length || 0,
              summary: analyzeJson.data?.summary,
            },
          });
        } catch (err: any) {
          console.error('[Deep Work] Comparison failed:', err);
          sendResponse({ success: false, error: err.message || 'Comparison failed' });
        }
      })();
      return true;
    }

    case 'REGION_CAPTURE_CANCELLED': {
      sendResponse({ success: true });
      break;
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


console.log('[Deep Work] Background service worker loaded');
