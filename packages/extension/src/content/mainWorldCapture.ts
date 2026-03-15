// Main-world content script for Deep Work
// Runs in the PAGE's JavaScript context (not the isolated content script world).
// This allows us to intercept the page's console.log, fetch, XHR, etc.
// Registered in manifest.json with "world": "MAIN".
//
// Communication: writes JSON messages into a hidden DOM element's data-msg attribute.
// The ISOLATED world content script detects changes via MutationObserver.
// DOM is truly shared between MAIN and ISOLATED worlds, so attribute mutations
// made in MAIN world ARE observable by MutationObserver in ISOLATED world.

(function () {
  // Guard against double-injection
  if ((window as any).__deepwork_main_world_active__) return;
  (window as any).__deepwork_main_world_active__ = true;

  let bridge: HTMLElement | null = null;
  let msgSeq = 0;
  const pendingMessages: string[] = [];
  let bridgeReady = false;

  function getBridge(): HTMLElement | null {
    if (bridge && bridge.isConnected) return bridge;
    bridge = document.getElementById('__deepwork_bridge__');
    return bridge;
  }

  function flushPending() {
    const el = getBridge();
    if (!el || pendingMessages.length === 0) return;
    for (const msg of pendingMessages) {
      el.setAttribute('data-msg', msg);
    }
    pendingMessages.length = 0;
  }

  function sendToContentScript(type: string, data: Record<string, unknown>) {
    try {
      // Include _seq to ensure attribute value changes even for identical payloads
      const payload = JSON.stringify({ type, ...data, _seq: msgSeq++ });

      if (!bridgeReady) {
        if (pendingMessages.length < 300) pendingMessages.push(payload);
        return;
      }

      const el = getBridge();
      if (!el) {
        if (pendingMessages.length < 300) pendingMessages.push(payload);
        bridgeReady = false;
        return;
      }

      // Write to attribute — ISOLATED world's MutationObserver will pick this up
      el.setAttribute('data-msg', payload);
    } catch { /* ignore */ }
  }

  // MAIN world must NEVER create bridge — only find the one created by ISOLATED world
  function checkBridgeReady() {
    const el = getBridge();
    if (!el) return false;
    if (el.hasAttribute('data-ready')) {
      bridgeReady = true;
      flushPending();
      return true;
    }
    return false;
  }

  // Watch for ISOLATED world to signal readiness via data-ready attribute
  function waitForBridge() {
    if (checkBridgeReady()) return;

    const observer = new MutationObserver(() => {
      if (checkBridgeReady()) observer.disconnect();
    });

    const root = document.documentElement || document;
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-ready'],
    });

    // Fallback polling
    const delays = [50, 150, 400, 1000, 2000, 5000, 10000];
    for (const d of delays) {
      setTimeout(() => { if (!bridgeReady) checkBridgeReady(); }, d);
    }
  }

  // Periodic health check
  setInterval(() => {
    if (bridge && !bridge.isConnected) {
      bridge = null;
      bridgeReady = false;
    }
    if (!bridgeReady) checkBridgeReady();
  }, 3000);

  // ---- Console interception ----
  const origLog = console.log;
  const origError = console.error;
  const origWarn = console.warn;
  const origInfo = console.info;
  const origDebug = console.debug;
  const origTrace = console.trace;

  function fmtArgs(args: IArguments | any[]): string {
    const parts: string[] = [];
    for (let i = 0; i < args.length; i++) {
      try {
        parts.push(typeof args[i] === 'object' ? JSON.stringify(args[i]) : String(args[i]));
      } catch {
        parts.push(String(args[i]));
      }
    }
    return parts.join(' ').slice(0, 500);
  }

  function postLog(level: string, args: IArguments | any[]) {
    const data: Record<string, unknown> = {
      level,
      message: fmtArgs(args),
      timestamp: Date.now(),
    };
    if (level === 'error') {
      try {
        const e = new Error();
        if (e.stack) data.stack = e.stack.split('\n').slice(3, 6).join('\n');
      } catch { /* ignore */ }
    }
    sendToContentScript('console', data);
  }

  console.log = function () { postLog('log', arguments); return origLog.apply(console, arguments as any); };
  console.error = function () { postLog('error', arguments); return origError.apply(console, arguments as any); };
  console.warn = function () { postLog('warn', arguments); return origWarn.apply(console, arguments as any); };
  console.info = function () { postLog('info', arguments); return origInfo.apply(console, arguments as any); };
  console.debug = function () { postLog('log', arguments); return origDebug.apply(console, arguments as any); };
  console.trace = function () { postLog('warn', arguments); return origTrace.apply(console, arguments as any); };

  // Capture unhandled errors and promise rejections
  window.addEventListener('error', (e) => {
    sendToContentScript('console', {
      level: 'error',
      timestamp: Date.now(),
      message: (e.message || 'Uncaught error') + (e.filename ? ' at ' + e.filename + ':' + e.lineno : ''),
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    sendToContentScript('console', {
      level: 'error',
      timestamp: Date.now(),
      message: 'Unhandled Promise rejection: ' + (e.reason?.message || String(e.reason)),
    });
  });

  // ---- Fetch interception ----
  const origFetch = window.fetch;
  window.fetch = function (this: Window, ...args: any[]) {
    const req = args[0];
    const url = typeof req === 'string' ? req : (req?.url || '');
    const init = args[1] || {};
    const method = (init.method || req?.method || 'GET').toUpperCase();
    const start = Date.now();
    return origFetch.apply(this, args as any).then((response: Response) => {
      sendToContentScript('network', {
        name: url,
        method,
        initiatorType: 'fetch',
        duration: Date.now() - start,
        responseStatus: response.status,
      });
      // Log failed HTTP responses as console errors
      if (response.status >= 400) {
        sendToContentScript('console', {
          level: 'error',
          timestamp: Date.now(),
          message: `HTTP ${response.status} ${method} ${url.slice(0, 200)}`,
        });
      }
      return response;
    }).catch((err: any) => {
      sendToContentScript('network', {
        name: url,
        method,
        initiatorType: 'fetch',
        duration: Date.now() - start,
        responseStatus: 0,
      });
      // Log network errors as console errors
      sendToContentScript('console', {
        level: 'error',
        timestamp: Date.now(),
        message: `Network error: ${method} ${url.slice(0, 200)} - ${err.message || err}`,
      });
      throw err;
    });
  } as typeof fetch;

  // ---- XMLHttpRequest interception ----
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
    (this as any).__dwMethod = method;
    (this as any).__dwUrl = typeof url === 'string' ? url : String(url);
    (this as any).__dwStart = Date.now();
    return origOpen.apply(this, [method, url, ...rest] as any);
  };

  XMLHttpRequest.prototype.send = function (...args: any[]) {
    const xhr = this;
    xhr.addEventListener('loadend', () => {
      const xhrUrl = (xhr as any).__dwUrl || '';
      const xhrMethod = ((xhr as any).__dwMethod || 'GET').toUpperCase();
      const xhrStatus = xhr.status;
      sendToContentScript('network', {
        name: xhrUrl,
        method: xhrMethod,
        initiatorType: 'xmlhttprequest',
        duration: Date.now() - ((xhr as any).__dwStart || Date.now()),
        responseStatus: xhrStatus,
      });
      // Log failed XHR as console errors (status 0 = network error, 400+ = HTTP error)
      if (xhrStatus === 0 || xhrStatus >= 400) {
        sendToContentScript('console', {
          level: 'error',
          timestamp: Date.now(),
          message: xhrStatus === 0
            ? `Network error: ${xhrMethod} ${xhrUrl.slice(0, 200)}`
            : `HTTP ${xhrStatus} ${xhrMethod} ${xhrUrl.slice(0, 200)}`,
        });
      }
    });
    return origSend.apply(this, args as any);
  };

  // Start bridge initialization
  waitForBridge();
})();
