/**
 * Region screenshot capture overlay.
 * Injects a full-screen overlay with crosshair cursor.
 * User drags to select a rectangular area, then confirms or cancels.
 */

export interface RegionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function startRegionCapture(): Promise<RegionRect | null> {
  return new Promise((resolve) => {
    // Prevent multiple overlays
    const existing = document.getElementById('__deep_work_region_overlay__');
    if (existing) {
      existing.remove();
    }

    // Container
    const overlay = document.createElement('div');
    overlay.id = '__deep_work_region_overlay__';
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      zIndex: '2147483647',
      cursor: 'crosshair',
      margin: '0',
      padding: '0',
      border: 'none',
      background: 'transparent',
    });

    // Canvas for drawing selection
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    Object.assign(canvas.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
    });
    overlay.appendChild(canvas);

    const ctx = canvas.getContext('2d')!;

    // Instructions tooltip
    const tooltip = document.createElement('div');
    Object.assign(tooltip.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '12px 24px',
      borderRadius: '8px',
      fontSize: '15px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontWeight: '500',
      pointerEvents: 'none',
      zIndex: '2147483647',
      userSelect: 'none',
      letterSpacing: '0.3px',
    });
    tooltip.textContent = '드래그하여 캡처 영역을 선택하세요 (ESC: 취소)';
    overlay.appendChild(tooltip);

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let currentRect: RegionRect | null = null;

    // Draw the overlay with selection cutout
    function drawOverlay(rect: RegionRect | null) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Dark overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (rect && rect.w > 0 && rect.h > 0) {
        // Clear the selected region (show page through)
        ctx.clearRect(rect.x, rect.y, rect.w, rect.h);

        // White border around selection
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

        // Blue accent border
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(rect.x - 1, rect.y - 1, rect.w + 2, rect.h + 2);
        ctx.setLineDash([]);

        // Dimension label
        const label = `${Math.round(rect.w)} × ${Math.round(rect.h)}`;
        ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const metrics = ctx.measureText(label);
        const labelW = metrics.width + 12;
        const labelH = 22;
        const labelX = rect.x + rect.w / 2 - labelW / 2;
        const labelY = rect.y + rect.h + 6;

        ctx.fillStyle = 'rgba(79, 70, 229, 0.9)';
        ctx.beginPath();
        ctx.roundRect(labelX, labelY, labelW, labelH, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, rect.x + rect.w / 2, labelY + labelH / 2);
      }
    }

    // Normalize rect (handle negative width/height from dragging in any direction)
    function normalizeRect(sx: number, sy: number, ex: number, ey: number): RegionRect {
      return {
        x: Math.min(sx, ex),
        y: Math.min(sy, ey),
        w: Math.abs(ex - sx),
        h: Math.abs(ey - sy),
      };
    }

    function cleanup() {
      overlay.remove();
      document.removeEventListener('keydown', onKeyDown);
    }

    function finishWithRect(rect: RegionRect) {
      cleanup();
      // Wait for overlay removal + repaint before resolving
      requestAnimationFrame(() => {
        setTimeout(() => resolve(rect), 60);
      });
    }

    function cancel() {
      cleanup();
      resolve(null);
    }

    function showConfirmButtons(rect: RegionRect) {
      // Remove tooltip
      tooltip.remove();

      const btnContainer = document.createElement('div');
      Object.assign(btnContainer.style, {
        position: 'fixed',
        left: `${rect.x + rect.w / 2}px`,
        top: `${rect.y + rect.h + 34}px`,
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '8px',
        zIndex: '2147483647',
      });

      const btnStyle = {
        padding: '6px 16px',
        border: 'none',
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        outline: 'none',
      };

      const confirmBtn = document.createElement('button');
      Object.assign(confirmBtn.style, {
        ...btnStyle,
        background: '#4f46e5',
        color: '#ffffff',
      });
      confirmBtn.textContent = '✓ 캡처';
      confirmBtn.onclick = (e) => {
        e.stopPropagation();
        finishWithRect(rect);
      };

      const cancelBtn = document.createElement('button');
      Object.assign(cancelBtn.style, {
        ...btnStyle,
        background: '#ffffff',
        color: '#374151',
        border: '1px solid #d1d5db',
      });
      cancelBtn.textContent = '✕ 취소';
      cancelBtn.onclick = (e) => {
        e.stopPropagation();
        cancel();
      };

      btnContainer.appendChild(confirmBtn);
      btnContainer.appendChild(cancelBtn);
      overlay.appendChild(btnContainer);
    }

    // Event handlers
    function onMouseDown(e: MouseEvent) {
      if (e.button !== 0) return; // left click only
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      currentRect = null;
      tooltip.style.display = 'none';
    }

    function onMouseMove(e: MouseEvent) {
      if (!isDragging) return;
      currentRect = normalizeRect(startX, startY, e.clientX, e.clientY);
      drawOverlay(currentRect);
    }

    function onMouseUp(e: MouseEvent) {
      if (!isDragging) return;
      isDragging = false;
      const rect = normalizeRect(startX, startY, e.clientX, e.clientY);

      // Minimum size check
      if (rect.w < 10 || rect.h < 10) {
        currentRect = null;
        drawOverlay(null);
        tooltip.style.display = 'block';
        return;
      }

      currentRect = rect;
      drawOverlay(rect);

      // Disable further dragging, show confirm buttons
      canvas.style.pointerEvents = 'none';
      showConfirmButtons(rect);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cancel();
      } else if (e.key === 'Enter' && currentRect) {
        e.preventDefault();
        e.stopPropagation();
        finishWithRect(currentRect);
      }
    }

    // Initial draw
    drawOverlay(null);

    // Attach events
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown, true);

    document.body.appendChild(overlay);
  });
}
