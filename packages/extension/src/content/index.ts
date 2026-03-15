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
  method: string;
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
const originalConsoleInfo = console.info;

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

// Helper to push to console log buffer with size limit
function pushConsoleLog(entry: ConsoleLogEntry) {
  backgroundConsoleLogs.push(entry);
  if (backgroundConsoleLogs.length > MAX_CONSOLE_LOGS) {
    backgroundConsoleLogs.splice(0, Math.floor(MAX_CONSOLE_LOGS * 0.2));
  }
  if (isCapturing) {
    capturedConsoleLogs.push({ ...entry, timestamp: getTimestamp() });
  }
}

// Helper to format console args to string
function formatArgs(args: any[]): string {
  return args.map((a) => {
    try {
      return typeof a === 'object' ? JSON.stringify(a) : String(a);
    } catch {
      return String(a);
    }
  }).join(' ').slice(0, 500);
}

// Console log capture (both background and recording)
let consoleCapturing = false;
function startConsoleCapture() {
  if (consoleCapturing) return;
  consoleCapturing = true;

  console.error = (...args: any[]) => {
    const entry: ConsoleLogEntry = {
      timestamp: isCapturing ? getTimestamp() : Date.now(),
      level: 'error',
      message: formatArgs(args),
    };
    try {
      const err = new Error();
      if (err.stack) entry.stack = err.stack.split('\n').slice(2, 5).join('\n');
    } catch { /* ignore */ }
    pushConsoleLog(entry);
    originalConsoleError.apply(console, args);
  };

  console.warn = (...args: any[]) => {
    const entry: ConsoleLogEntry = {
      timestamp: isCapturing ? getTimestamp() : Date.now(),
      level: 'warn',
      message: formatArgs(args),
    };
    pushConsoleLog(entry);
    originalConsoleWarn.apply(console, args);
  };

  console.log = (...args: any[]) => {
    const entry: ConsoleLogEntry = {
      timestamp: isCapturing ? getTimestamp() : Date.now(),
      level: 'log',
      message: formatArgs(args),
    };
    pushConsoleLog(entry);
    originalConsoleLog.apply(console, args);
  };

  console.info = (...args: any[]) => {
    const entry: ConsoleLogEntry = {
      timestamp: isCapturing ? getTimestamp() : Date.now(),
      level: 'info',
      message: formatArgs(args),
    };
    pushConsoleLog(entry);
    originalConsoleInfo.apply(console, args);
  };
}

function stopConsoleCapture() {
  // Don't restore originals — background collection should continue
}

// Helper to push to network log buffer with size limit
function pushNetworkLog(entry: NetworkLogEntry) {
  backgroundNetworkLogs.push(entry);
  if (backgroundNetworkLogs.length > MAX_NETWORK_LOGS) {
    backgroundNetworkLogs.splice(0, Math.floor(MAX_NETWORK_LOGS * 0.2));
  }
  if (isCapturing) {
    capturedNetworkLogs.push({ ...entry, timestamp: getTimestamp() });
  }
}

// Network request capture via PerformanceObserver (sees all resource loads)
function startNetworkCapture() {
  if (performanceObserver) return;

  const processEntry = (entry: PerformanceEntry) => {
    const resourceEntry = entry as PerformanceResourceTiming;
    pushNetworkLog({
      timestamp: isCapturing ? getTimestamp() : Date.now(),
      name: resourceEntry.name,
      method: 'GET', // PerformanceResourceTiming doesn't expose method
      initiatorType: resourceEntry.initiatorType,
      duration: Math.round(resourceEntry.duration),
      transferSize: resourceEntry.transferSize || 0,
      responseStatus: (resourceEntry as any).responseStatus || undefined,
    });
  };

  performanceObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      processEntry(entry);
    }
  });

  try {
    performanceObserver.observe({ type: 'resource', buffered: true });
  } catch {
    try {
      performanceObserver.observe({ entryTypes: ['resource'] });
    } catch (err) {
      originalConsoleError.call(console, '[Deep Work] PerformanceObserver setup failed:', err);
    }
  }

  // Also collect any existing performance entries that buffered: true may have missed
  try {
    const existingEntries = performance.getEntriesByType('resource');
    if (existingEntries.length > 0 && backgroundNetworkLogs.length === 0) {
      for (const entry of existingEntries) {
        processEntry(entry);
      }
      originalConsoleLog.call(console, '[Deep Work] Collected', existingEntries.length, 'existing resource entries');
    }
  } catch { /* ignore */ }
}

function stopNetworkCapture() {
  // Don't disconnect observer — background collection should continue
}

// Listen for messages from main-world capture script (mainWorldCapture.ts)
// Registered in manifest.json with "world": "MAIN" to bypass CSP.
// Uses a hidden DOM element + attribute for cross-world communication.
// Both worlds share the DOM, so getAttribute works reliably across worlds.
function setupMainWorldListener() {
  // Ensure bridge element exists (mainWorldCapture.ts may create it first)
  const ensureBridge = () => {
    let bridge = document.getElementById('__deepwork_bridge__');
    if (!bridge) {
      bridge = document.createElement('div');
      bridge.id = '__deepwork_bridge__';
      bridge.style.display = 'none';
      (document.documentElement || document.body || document).appendChild(bridge);
    }
    return bridge;
  };

  const attachListener = () => {
    const bridge = ensureBridge();
    bridge.addEventListener('__deepwork_msg__', () => {
      let d: any;
      try {
        d = JSON.parse(bridge.getAttribute('data-payload') || '{}');
      } catch {
        return;
      }

      // Console logs from main world
      if (d.type === 'console') {
        if (backgroundConsoleLogs.length < 3) {
          originalConsoleLog.call(console, '[Deep Work] Received main-world console log:', d.level, d.message?.substring(0, 60));
        }
        pushConsoleLog({
          timestamp: d.timestamp || Date.now(),
          level: d.level || 'log',
          message: d.message || '',
          stack: d.stack,
        });
        return;
      }

      // Network logs from main world
      if (d.type === 'network') {
        pushNetworkLog({
          timestamp: Date.now(),
          name: d.name || '',
          method: d.method || 'GET',
          initiatorType: d.initiatorType || 'fetch',
          duration: d.duration || 0,
          transferSize: 0,
          responseStatus: d.responseStatus,
        });
      }
    });
    originalConsoleLog.call(console, '[Deep Work] Bridge listener attached');
  };

  // At document_start, documentElement may not exist yet
  if (document.documentElement) {
    attachListener();
  } else {
    // Wait for document to be ready
    const observer = new MutationObserver(() => {
      if (document.documentElement) {
        observer.disconnect();
        attachListener();
      }
    });
    observer.observe(document, { childList: true });
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
      originalConsoleLog.call(console, '[Deep Work] GET_BACKGROUND_LOGS requested. console:', backgroundConsoleLogs.length, 'network:', backgroundNetworkLogs.length);
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

// Start always-on background log collection immediately
startConsoleCapture();      // Captures logs from content script isolated world
startNetworkCapture();      // PerformanceObserver for resource timing
setupMainWorldListener();   // Receives console + network logs from mainWorldCapture.ts

// Log initialization status after a brief delay to show collected data
setTimeout(() => {
  originalConsoleLog.call(console, '[Deep Work] Content script initialized. Buffers:', backgroundConsoleLogs.length, 'console,', backgroundNetworkLogs.length, 'network');
}, 1000);

originalConsoleLog.call(console, '[Deep Work] Content script loaded');
