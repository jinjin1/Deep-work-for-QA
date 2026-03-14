// Deep Work Content Script
// Captures DOM events, console logs, and network requests
export {};

import { startRegionCapture } from './regionCapture';

interface CapturedEvent {
  timestamp: number;
  type: string;
  target?: string;
  data?: Record<string, unknown>;
}

interface ConsoleLogEntry {
  timestamp: number;
  level: 'error' | 'warn' | 'log' | 'info';
  message: string;
  stack?: string;
}

interface NetworkLogEntry {
  timestamp: number;
  name: string;
  initiatorType: string;
  duration: number;
  transferSize: number;
  responseStatus?: number;
}

// --- Always-on background log buffers (filled continuously) ---
const MAX_CONSOLE_LOGS = 1000;
const MAX_NETWORK_LOGS = 500;
let backgroundConsoleLogs: ConsoleLogEntry[] = [];
let backgroundNetworkLogs: NetworkLogEntry[] = [];

// --- Recording capture state ---
let isCapturing = false;
let capturedEvents: CapturedEvent[] = [];
let capturedConsoleLogs: ConsoleLogEntry[] = [];
let capturedNetworkLogs: NetworkLogEntry[] = [];
let startTime = 0;
let performanceObserver: PerformanceObserver | null = null;

// Store original console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

function getTimestamp(): number {
  return Date.now() - startTime;
}

function getTargetSelector(el: Element): string {
  if (el.id) return `${el.tagName.toLowerCase()}#${el.id}`;
  const classes = Array.from(el.classList).slice(0, 3).join('.');
  if (classes) return `${el.tagName.toLowerCase()}.${classes}`;
  const text = el.textContent?.trim().slice(0, 30);
  if (text) return `${el.tagName.toLowerCase()} "${text}"`;
  return el.tagName.toLowerCase();
}

// ---- Bug Report Capture (existing) ----

function handleClick(e: MouseEvent) {
  if (!isCapturing) return;
  const target = e.target as Element;
  const selector = getTargetSelector(target);
  capturedEvents.push({
    timestamp: getTimestamp(),
    type: 'click',
    target: selector,
    data: { x: e.clientX, y: e.clientY },
  });
}

function handleInput(e: Event) {
  if (!isCapturing) return;
  const target = e.target as HTMLInputElement;
  const isSensitive = target.type === 'password';
  const selector = getTargetSelector(target);
  capturedEvents.push({
    timestamp: getTimestamp(),
    type: 'input',
    target: selector,
    data: { value: isSensitive ? '********' : '[input]' },
  });
}

// Console log capture (both background and recording)
function startConsoleCapture() {
  console.error = (...args: any[]) => {
    const message = args.map((a) => {
      try {
        return typeof a === 'object' ? JSON.stringify(a) : String(a);
      } catch {
        return String(a);
      }
    }).join(' ');

    const entry: ConsoleLogEntry = {
      timestamp: isCapturing ? getTimestamp() : Date.now(),
      level: 'error',
      message: message.slice(0, 500),
    };

    try {
      const err = new Error();
      if (err.stack) {
        entry.stack = err.stack.split('\n').slice(2, 5).join('\n');
      }
    } catch {
      // ignore
    }

    // Always add to background buffer
    backgroundConsoleLogs.push(entry);
    if (backgroundConsoleLogs.length > MAX_CONSOLE_LOGS) {
      backgroundConsoleLogs.splice(0, Math.floor(MAX_CONSOLE_LOGS * 0.2));
    }

    // Also add to recording if capturing
    if (isCapturing) {
      capturedConsoleLogs.push({ ...entry, timestamp: getTimestamp() });
    }

    originalConsoleError.apply(console, args);
  };

  console.warn = (...args: any[]) => {
    const message = args.map((a) => {
      try {
        return typeof a === 'object' ? JSON.stringify(a) : String(a);
      } catch {
        return String(a);
      }
    }).join(' ');

    const entry: ConsoleLogEntry = {
      timestamp: isCapturing ? getTimestamp() : Date.now(),
      level: 'warn',
      message: message.slice(0, 500),
    };

    // Always add to background buffer
    backgroundConsoleLogs.push(entry);
    if (backgroundConsoleLogs.length > MAX_CONSOLE_LOGS) {
      backgroundConsoleLogs.splice(0, Math.floor(MAX_CONSOLE_LOGS * 0.2));
    }

    // Also add to recording if capturing
    if (isCapturing) {
      capturedConsoleLogs.push({ ...entry, timestamp: getTimestamp() });
    }

    originalConsoleWarn.apply(console, args);
  };
}

function stopConsoleCapture() {
  if (!isCapturing) {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  }
}

// Network request capture (both background and recording)
function startNetworkCapture() {
  if (performanceObserver) performanceObserver.disconnect();

  performanceObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const resourceEntry = entry as PerformanceResourceTiming;
      const logEntry: NetworkLogEntry = {
        timestamp: isCapturing ? getTimestamp() : Date.now(),
        name: resourceEntry.name,
        initiatorType: resourceEntry.initiatorType,
        duration: Math.round(resourceEntry.duration),
        transferSize: resourceEntry.transferSize || 0,
        responseStatus: (resourceEntry as any).responseStatus || undefined,
      };

      // Always add to background buffer
      backgroundNetworkLogs.push(logEntry);
      if (backgroundNetworkLogs.length > MAX_NETWORK_LOGS) {
        backgroundNetworkLogs.splice(0, Math.floor(MAX_NETWORK_LOGS * 0.2));
      }

      // Also add to recording if capturing
      if (isCapturing) {
        capturedNetworkLogs.push({ ...logEntry, timestamp: getTimestamp() });
      }
    }
  });

  try {
    performanceObserver.observe({ type: 'resource', buffered: true });
  } catch {
    try {
      performanceObserver.observe({ entryTypes: ['resource'] });
    } catch (err) {
      console.error('[Deep Work] PerformanceObserver setup failed:', err);
    }
  }
}

function stopNetworkCapture() {
  if (!isCapturing) {
    if (performanceObserver) {
      performanceObserver.disconnect();
      performanceObserver = null;
    }
  }
}

// --- Bug Report Capture lifecycle ---

function startCapture() {
  isCapturing = true;
  startTime = Date.now();
  capturedEvents = [];
  capturedConsoleLogs = [];
  capturedNetworkLogs = [];

  document.addEventListener('click', handleClick, true);
  document.addEventListener('input', handleInput, true);
  startConsoleCapture();
  startNetworkCapture();

  originalConsoleLog.call(console, '[Deep Work] Capture started');
}

function stopCapture() {
  isCapturing = false;

  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('input', handleInput, true);
  stopConsoleCapture();
  stopNetworkCapture();

  originalConsoleLog.call(console, '[Deep Work] Capture stopped. Events:', capturedEvents.length);

  chrome.runtime.sendMessage({
    type: 'CAPTURE_DATA',
    data: {
      events: capturedEvents,
      console_logs: capturedConsoleLogs,
      network_logs: capturedNetworkLogs,
      url: window.location.href,
      duration: Date.now() - startTime,
      environment: {
        browser: navigator.userAgent,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        devicePixelRatio: window.devicePixelRatio,
        language: navigator.language,
        platform: navigator.platform,
      },
    },
  });
}

// --- Message handling ---

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'START_CAPTURE':
      startCapture();
      break;
    case 'STOP_CAPTURE':
      stopCapture();
      break;
    case 'TAKE_SCREENSHOT':
      sendResponse({
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          devicePixelRatio: window.devicePixelRatio,
        },
        url: window.location.href,
        title: document.title,
      });
      return true;

    case 'START_REGION_CAPTURE': {
      startRegionCapture().then((rect) => {
        if (rect) {
          chrome.runtime.sendMessage({
            type: 'REGION_SELECTED',
            data: {
              rect,
              devicePixelRatio: window.devicePixelRatio,
              viewport: { width: window.innerWidth, height: window.innerHeight },
            },
          });
        }
      });
      sendResponse({ success: true });
      return true;
    }

    // Return always-on background logs (for reports without recording)
    case 'GET_BACKGROUND_LOGS': {
      sendResponse({
        success: true,
        data: {
          console_logs: backgroundConsoleLogs.slice(),
          network_logs: backgroundNetworkLogs.slice(),
          url: window.location.href,
          environment: {
            browser: navigator.userAgent,
            viewport: { width: window.innerWidth, height: window.innerHeight },
            devicePixelRatio: window.devicePixelRatio,
            language: navigator.language,
            platform: navigator.platform,
          },
        },
      });
      return true;
    }
  }
});

console.log('[Deep Work] Content script loaded');
