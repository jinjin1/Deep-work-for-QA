// Deep Work Content Script
// Captures DOM events, console logs, and network requests
export {};

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

let isCapturing = false;
let capturedEvents: CapturedEvent[] = [];
let capturedConsoleLogs: ConsoleLogEntry[] = [];
let capturedNetworkLogs: NetworkLogEntry[] = [];
let startTime = 0;
let performanceObserver: PerformanceObserver | null = null;

// Session capture state (separate from bug report capture)
let isSessionCapturing = false;
let sessionEvents: CapturedEvent[] = [];
let sessionConsoleLogs: ConsoleLogEntry[] = [];
let sessionNetworkLogs: NetworkLogEntry[] = [];
let sessionStartTime = 0;
let sessionPerformanceObserver: PerformanceObserver | null = null;
let lastUrl = '';

// Store original console methods
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

function getTimestamp(): number {
  return Date.now() - startTime;
}

function getSessionTimestamp(): number {
  return Date.now() - sessionStartTime;
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
  if (!isCapturing && !isSessionCapturing) return;
  const target = e.target as Element;
  const selector = getTargetSelector(target);
  const eventData: CapturedEvent = {
    timestamp: isCapturing ? getTimestamp() : getSessionTimestamp(),
    type: 'click',
    target: selector,
    data: { x: e.clientX, y: e.clientY },
  };

  if (isCapturing) capturedEvents.push(eventData);
  if (isSessionCapturing) sessionEvents.push({ ...eventData, timestamp: getSessionTimestamp() });
}

function handleInput(e: Event) {
  if (!isCapturing && !isSessionCapturing) return;
  const target = e.target as HTMLInputElement;
  const isSensitive = target.type === 'password';
  const selector = getTargetSelector(target);
  const eventData: CapturedEvent = {
    timestamp: isCapturing ? getTimestamp() : getSessionTimestamp(),
    type: 'input',
    target: selector,
    data: { value: isSensitive ? '********' : '[input]' },
  };

  if (isCapturing) capturedEvents.push(eventData);
  if (isSessionCapturing) sessionEvents.push({ ...eventData, timestamp: getSessionTimestamp() });
}

function handleScroll() {
  if (!isSessionCapturing) return;
  // Throttle: only record once per 150ms
  const now = getSessionTimestamp();
  const lastScroll = sessionEvents.filter(e => e.type === 'scroll').pop();
  if (lastScroll && now - lastScroll.timestamp < 150) return;

  sessionEvents.push({
    timestamp: now,
    type: 'scroll',
    data: { scrollX: window.scrollX, scrollY: window.scrollY },
  });
}

function handleResize() {
  if (!isSessionCapturing) return;
  sessionEvents.push({
    timestamp: getSessionTimestamp(),
    type: 'resize',
    data: { width: window.innerWidth, height: window.innerHeight },
  });
}

// Console log capture
function startConsoleCapture() {
  console.error = (...args: any[]) => {
    const active = isCapturing || isSessionCapturing;
    if (active) {
      const message = args.map((a) => {
        try {
          return typeof a === 'object' ? JSON.stringify(a) : String(a);
        } catch {
          return String(a);
        }
      }).join(' ');

      const entry: ConsoleLogEntry = {
        timestamp: isSessionCapturing ? getSessionTimestamp() : getTimestamp(),
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

      if (isCapturing) capturedConsoleLogs.push(entry);
      if (isSessionCapturing) sessionConsoleLogs.push({ ...entry, timestamp: getSessionTimestamp() });
    }
    originalConsoleError.apply(console, args);
  };

  console.warn = (...args: any[]) => {
    const active = isCapturing || isSessionCapturing;
    if (active) {
      const message = args.map((a) => {
        try {
          return typeof a === 'object' ? JSON.stringify(a) : String(a);
        } catch {
          return String(a);
        }
      }).join(' ');

      const entry: ConsoleLogEntry = {
        timestamp: isSessionCapturing ? getSessionTimestamp() : getTimestamp(),
        level: 'warn',
        message: message.slice(0, 500),
      };

      if (isCapturing) capturedConsoleLogs.push(entry);
      if (isSessionCapturing) sessionConsoleLogs.push({ ...entry, timestamp: getSessionTimestamp() });
    }
    originalConsoleWarn.apply(console, args);
  };
}

function stopConsoleCapture() {
  if (!isCapturing && !isSessionCapturing) {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  }
}

// Network request capture
function startNetworkCapture() {
  if (performanceObserver) performanceObserver.disconnect();

  performanceObserver = new PerformanceObserver((list) => {
    if (!isCapturing && !isSessionCapturing) return;

    for (const entry of list.getEntries()) {
      const resourceEntry = entry as PerformanceResourceTiming;
      const logEntry: NetworkLogEntry = {
        timestamp: isSessionCapturing ? getSessionTimestamp() : getTimestamp(),
        name: resourceEntry.name,
        initiatorType: resourceEntry.initiatorType,
        duration: Math.round(resourceEntry.duration),
        transferSize: resourceEntry.transferSize || 0,
        responseStatus: (resourceEntry as any).responseStatus || undefined,
      };

      if (isCapturing) capturedNetworkLogs.push(logEntry);
      if (isSessionCapturing) sessionNetworkLogs.push({ ...logEntry, timestamp: getSessionTimestamp() });
    }
  });

  try {
    performanceObserver.observe({ type: 'resource', buffered: false });
  } catch {
    try {
      performanceObserver.observe({ entryTypes: ['resource'] });
    } catch {
      // ignore
    }
  }
}

function stopNetworkCapture() {
  if (!isCapturing && !isSessionCapturing) {
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

  originalConsoleError.call(console, '[Deep Work] Capture started');
}

function stopCapture() {
  isCapturing = false;

  if (!isSessionCapturing) {
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('input', handleInput, true);
    stopConsoleCapture();
    stopNetworkCapture();
  }

  originalConsoleError.call(console, '[Deep Work] Capture stopped. Events:', capturedEvents.length);

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

// --- Session Capture lifecycle ---

function startSessionCapture() {
  isSessionCapturing = true;
  sessionStartTime = Date.now();
  sessionEvents = [];
  sessionConsoleLogs = [];
  sessionNetworkLogs = [];
  lastUrl = window.location.href;

  // Record initial page visit
  sessionEvents.push({
    timestamp: 0,
    type: 'page_visit',
    data: { url: window.location.href, title: document.title },
  });

  document.addEventListener('click', handleClick, true);
  document.addEventListener('input', handleInput, true);
  document.addEventListener('scroll', handleScroll, true);
  window.addEventListener('resize', handleResize);
  startConsoleCapture();
  startNetworkCapture();

  // Monitor URL changes for SPA navigation
  monitorUrlChanges();

  // Capture global errors
  window.addEventListener('error', handleGlobalError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  originalConsoleError.call(console, '[Deep Work] Session capture started');
}

function stopSessionCapture(): { events: CapturedEvent[]; console_logs: ConsoleLogEntry[]; network_logs: NetworkLogEntry[] } {
  isSessionCapturing = false;

  if (!isCapturing) {
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('input', handleInput, true);
    stopConsoleCapture();
    stopNetworkCapture();
  }
  document.removeEventListener('scroll', handleScroll, true);
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('error', handleGlobalError);
  window.removeEventListener('unhandledrejection', handleUnhandledRejection);

  originalConsoleError.call(console, '[Deep Work] Session capture stopped. Events:', sessionEvents.length);

  return {
    events: sessionEvents,
    console_logs: sessionConsoleLogs,
    network_logs: sessionNetworkLogs,
  };
}

// Monitor SPA URL changes
function monitorUrlChanges() {
  const checkUrl = () => {
    if (!isSessionCapturing) return;
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      sessionEvents.push({
        timestamp: getSessionTimestamp(),
        type: 'page_visit',
        data: { url: lastUrl, title: document.title },
      });
      // Notify background for page count
      chrome.runtime.sendMessage({
        type: 'SESSION_PAGE_VISIT',
        data: { url: lastUrl },
      });
    }
    if (isSessionCapturing) {
      setTimeout(checkUrl, 500);
    }
  };
  setTimeout(checkUrl, 500);
}

// Global error handlers
function handleGlobalError(e: ErrorEvent) {
  if (!isSessionCapturing) return;
  sessionConsoleLogs.push({
    timestamp: getSessionTimestamp(),
    level: 'error',
    message: `${e.message} at ${e.filename}:${e.lineno}:${e.colno}`.slice(0, 500),
  });
}

function handleUnhandledRejection(e: PromiseRejectionEvent) {
  if (!isSessionCapturing) return;
  sessionConsoleLogs.push({
    timestamp: getSessionTimestamp(),
    level: 'error',
    message: `Unhandled rejection: ${String(e.reason)}`.slice(0, 500),
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
    case 'START_SESSION_CAPTURE':
      startSessionCapture();
      break;
    case 'STOP_SESSION_CAPTURE': {
      const data = stopSessionCapture();
      sendResponse({ data });
      return true;
    }
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
  }
});

console.log('[Deep Work] Content script loaded');
