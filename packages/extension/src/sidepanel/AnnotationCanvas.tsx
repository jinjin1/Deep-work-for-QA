import React, { useState, useRef, useEffect, useCallback } from 'react';

type Tool = 'pen' | 'text' | 'none';

interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

interface TextAnnotation {
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}

type AnnotationAction =
  | { type: 'stroke'; stroke: Stroke }
  | { type: 'text'; text: TextAnnotation };

interface AnnotationCanvasProps {
  screenshotDataUrl: string;
  onSave: (annotatedDataUrl: string) => void;
  onCancel: () => void;
}

const COLORS = [
  { value: '#ef4444', label: '빨강' },
  { value: '#3b82f6', label: '파랑' },
  { value: '#111827', label: '검정' },
  { value: '#22c55e', label: '초록' },
  { value: '#eab308', label: '노랑' },
];

export function AnnotationCanvas({ screenshotDataUrl, onSave, onCancel }: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#ef4444');
  const [actions, setActions] = useState<AnnotationAction[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokeRef = useRef<Stroke | null>(null);

  // Text input state
  const [textInputPos, setTextInputPos] = useState<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null);
  const [textInputValue, setTextInputValue] = useState('');
  const textInputRef = useRef<HTMLInputElement>(null);

  // Image dimensions
  const [imgSize, setImgSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Load the screenshot image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = screenshotDataUrl;
  }, [screenshotDataUrl]);

  // Get scale factor for mouse coordinate mapping
  const getScale = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || imgSize.width === 0) return 1;
    return imgSize.width / canvas.clientWidth;
  }, [imgSize.width]);

  // Redraw everything
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || imgSize.width === 0) return;

    canvas.width = imgSize.width;
    canvas.height = imgSize.height;

    const ctx = canvas.getContext('2d')!;

    // Draw screenshot
    ctx.drawImage(img, 0, 0);

    // Draw all completed actions
    for (const action of actions) {
      if (action.type === 'stroke') {
        drawStroke(ctx, action.stroke);
      } else if (action.type === 'text') {
        drawText(ctx, action.text);
      }
    }

    // Draw current in-progress stroke
    if (currentStrokeRef.current) {
      drawStroke(ctx, currentStrokeRef.current);
    }
  }, [actions, imgSize]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
    if (stroke.points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  }

  function drawText(ctx: CanvasRenderingContext2D, textAnno: TextAnnotation) {
    ctx.font = `bold ${textAnno.fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = textAnno.color;
    ctx.textBaseline = 'top';

    // Background for readability
    const metrics = ctx.measureText(textAnno.text);
    const padding = 4;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(
      textAnno.x - padding,
      textAnno.y - padding,
      metrics.width + padding * 2,
      textAnno.fontSize + padding * 2
    );

    ctx.fillStyle = textAnno.color;
    ctx.fillText(textAnno.text, textAnno.x, textAnno.y);
  }

  // Mouse position → canvas coordinates
  function getCanvasCoords(e: React.MouseEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scale = getScale();
    return {
      x: (e.clientX - rect.left) * scale,
      y: (e.clientY - rect.top) * scale,
    };
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (tool === 'pen') {
      const coords = getCanvasCoords(e);
      setIsDrawing(true);
      currentStrokeRef.current = {
        points: [coords],
        color,
        width: Math.max(3, Math.round(imgSize.width / 200)), // Scale pen width with image size
      };
    } else if (tool === 'text') {
      const coords = getCanvasCoords(e);
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      setTextInputPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        canvasX: coords.x,
        canvasY: coords.y,
      });
      setTextInputValue('');
      setTimeout(() => textInputRef.current?.focus(), 50);
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDrawing || tool !== 'pen' || !currentStrokeRef.current) return;
    const coords = getCanvasCoords(e);
    currentStrokeRef.current.points.push(coords);
    redraw();
  }

  function handleMouseUp() {
    if (!isDrawing || !currentStrokeRef.current) return;
    setIsDrawing(false);
    if (currentStrokeRef.current.points.length >= 2) {
      setActions((prev) => [...prev, { type: 'stroke', stroke: currentStrokeRef.current! }]);
    }
    currentStrokeRef.current = null;
  }

  function handleTextConfirm() {
    if (textInputValue.trim() && textInputPos) {
      const fontSize = Math.max(16, Math.round(imgSize.width / 30));
      setActions((prev) => [
        ...prev,
        {
          type: 'text',
          text: {
            x: textInputPos.canvasX,
            y: textInputPos.canvasY,
            text: textInputValue.trim(),
            color,
            fontSize,
          },
        },
      ]);
    }
    setTextInputPos(null);
    setTextInputValue('');
  }

  function handleUndo() {
    setActions((prev) => prev.slice(0, -1));
  }

  function handleClear() {
    setActions([]);
  }

  function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Canvas already has the final composite drawn
    redraw();
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  }

  if (imgSize.width === 0) {
    return <div style={{ padding: 16, fontSize: 13, color: '#9ca3af' }}>이미지 로딩 중...</div>;
  }

  const cursorStyle = tool === 'pen' ? 'crosshair' : tool === 'text' ? 'text' : 'default';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
        padding: '6px 0', borderBottom: '1px solid #e5e7eb',
      }}>
        {/* Tool buttons */}
        <button
          onClick={() => { setTool('pen'); setTextInputPos(null); }}
          style={{
            padding: '4px 8px', borderRadius: 4, border: '1px solid',
            borderColor: tool === 'pen' ? '#4f46e5' : '#d1d5db',
            background: tool === 'pen' ? '#eef2ff' : 'white',
            color: tool === 'pen' ? '#4f46e5' : '#374151',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          ✏️ 펜
        </button>
        <button
          onClick={() => setTool('text')}
          style={{
            padding: '4px 8px', borderRadius: 4, border: '1px solid',
            borderColor: tool === 'text' ? '#4f46e5' : '#d1d5db',
            background: tool === 'text' ? '#eef2ff' : 'white',
            color: tool === 'text' ? '#4f46e5' : '#374151',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          T 텍스트
        </button>

        <div style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 4px' }} />

        {/* Color picker */}
        {COLORS.map((c) => (
          <button
            key={c.value}
            onClick={() => setColor(c.value)}
            title={c.label}
            style={{
              width: 20, height: 20, borderRadius: '50%', border: '2px solid',
              borderColor: color === c.value ? '#374151' : '#e5e7eb',
              background: c.value, cursor: 'pointer', padding: 0,
              boxShadow: color === c.value ? '0 0 0 2px white, 0 0 0 3px #374151' : 'none',
            }}
          />
        ))}

        <div style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 4px' }} />

        {/* Actions */}
        <button
          onClick={handleUndo}
          disabled={actions.length === 0}
          style={{
            padding: '4px 8px', borderRadius: 4, border: '1px solid #d1d5db',
            background: 'white', fontSize: 12, cursor: actions.length > 0 ? 'pointer' : 'not-allowed',
            color: actions.length > 0 ? '#374151' : '#9ca3af',
          }}
        >
          ↩ 실행취소
        </button>
        <button
          onClick={handleClear}
          disabled={actions.length === 0}
          style={{
            padding: '4px 8px', borderRadius: 4, border: '1px solid #d1d5db',
            background: 'white', fontSize: 12, cursor: actions.length > 0 ? 'pointer' : 'not-allowed',
            color: actions.length > 0 ? '#374151' : '#9ca3af',
          }}
        >
          🗑 초기화
        </button>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        style={{ position: 'relative', width: '100%', borderRadius: 6, overflow: 'hidden', border: '1px solid #e5e7eb' }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', display: 'block', cursor: cursorStyle }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />

        {/* Floating text input */}
        {textInputPos && (
          <input
            ref={textInputRef}
            type="text"
            value={textInputValue}
            onChange={(e) => setTextInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTextConfirm();
              if (e.key === 'Escape') { setTextInputPos(null); setTextInputValue(''); }
            }}
            onBlur={handleTextConfirm}
            placeholder="텍스트 입력..."
            style={{
              position: 'absolute',
              left: textInputPos.x,
              top: textInputPos.y,
              fontSize: 14,
              color,
              fontWeight: 'bold',
              background: 'rgba(255,255,255,0.9)',
              border: `2px solid ${color}`,
              borderRadius: 4,
              padding: '2px 6px',
              outline: 'none',
              minWidth: 80,
              zIndex: 10,
            }}
          />
        )}
      </div>

      {/* Save / Cancel buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSave}
          style={{
            flex: 1, padding: 10, border: 'none', borderRadius: 8,
            background: '#4f46e5', color: 'white', fontSize: 14,
            fontWeight: 600, cursor: 'pointer',
          }}
        >
          ✓ 완료
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '10px 16px', border: '1px solid #d1d5db', borderRadius: 8,
            background: 'white', fontSize: 14, cursor: 'pointer', color: '#374151',
          }}
        >
          취소
        </button>
      </div>
    </div>
  );
}
