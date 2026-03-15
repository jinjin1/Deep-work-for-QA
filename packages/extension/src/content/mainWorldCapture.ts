// Main-world content script for Deep Work
// Runs in the PAGE's JavaScript context (not the isolated content script world).
// This allows us to intercept the page's console.log, fetch, XHR, etc.
// Registered in manifest.json with "world": "MAIN".

(function () {
  // Guard against double-injection
  if ((window as any).__deepwork_main_world_active__) return;
  (window as any).__deepwork_main_world_active__ = true;

  // ---- Console interception ----
  const origLog = console.log;
  const origError = console.error;
  const origWarn = console.warn;
  const origInfo = console.info;

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
    const msg: any = {
      __deepwork_console__: true,
      level,
      message: fmtArgs(args),
      timestamp: Date.now(),
    };
    if (level === 'error') {
      try {
        const e = new Error();
        if (e.stack) msg.stack = e.stack.split('\n').slice(3, 6).join('\n');
      } catch { /* ignore */ }
    }
    window.postMessage(msg, '*');
  }

  console.log = function () { postLog('log', arguments); return origLog.apply(console, arguments as any); };
  console.error = function () { postLog('error', arguments); return origError.apply(console, arguments as any); };
  console.warn = function () { postLog('warn', arguments); return origWarn.apply(console, arguments as any); };
  console.info = function () { postLog('info', arguments); return origInfo.apply(console, arguments as any); };

  // Capture unhandled errors and promise rejections
  window.addEventListener('error', (e) => {
    window.postMessage({
      __deepwork_console__: true,
      level: 'error',
      timestamp: Date.now(),
      message: (e.message || 'Uncaught error') + (e.filename ? ' at ' + e.filename + ':' + e.lineno : ''),
    }, '*');
  });

  window.addEventListener('unhandledrejection', (e) => {
    window.postMessage({
      __deepwork_console__: true,
      level: 'error',
      timestamp: Date.now(),
      message: 'Unhandled Promise rejection: ' + (e.reason?.message || String(e.reason)),
    }, '*');
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
      window.postMessage({
        __deepwork_network__: true,
        name: url,
        method,
        initiatorType: 'fetch',
        duration: Date.now() - start,
        responseStatus: response.status,
      }, '*');
      return response;
    }).catch((err: any) => {
      window.postMessage({
        __deepwork_network__: true,
        name: url,
        method,
        initiatorType: 'fetch',
        duration: Date.now() - start,
        responseStatus: 0,
      }, '*');
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
      window.postMessage({
        __deepwork_network__: true,
        name: (xhr as any).__dwUrl || '',
        method: ((xhr as any).__dwMethod || 'GET').toUpperCase(),
        initiatorType: 'xmlhttprequest',
        duration: Date.now() - ((xhr as any).__dwStart || Date.now()),
        responseStatus: xhr.status,
      }, '*');
    });
    return origSend.apply(this, args as any);
  };
})();
