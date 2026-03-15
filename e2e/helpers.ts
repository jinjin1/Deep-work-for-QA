const API_BASE = 'http://localhost:3001/v1';

/** Direct API call helper — simulates what the Chrome extension does */
export async function api(method: string, path: string, body?: unknown) {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  return { status: res.status, json: await res.json() };
}

/** Create a bug report via API (simulating the Chrome extension) */
export async function createBugReportViaAPI(overrides: Record<string, unknown> = {}) {
  const payload = {
    title: `E2E Test Bug ${Date.now()}`,
    severity: 'major',
    page_url: 'https://example.com/test-page',
    environment: {
      browser: 'Chrome 120',
      platform: 'macOS',
      viewport: { width: 1920, height: 1080 },
      devicePixelRatio: 2,
      language: 'ko-KR',
    },
    console_logs: [
      { level: 'error', message: 'Uncaught TypeError: Cannot read property', timestamp: 1200 },
      { level: 'warn', message: 'Deprecated API usage detected', timestamp: 2400 },
      { level: 'log', message: 'App initialized', timestamp: 100 },
    ],
    network_logs: [
      { method: 'GET', url: 'https://api.example.com/data', status: 200, duration: 145, type: 'fetch' },
      { method: 'POST', url: 'https://api.example.com/submit', status: 500, duration: 2300, type: 'xhr' },
    ],
    screenshot_urls: ['https://example.com/screenshot1.png'],
    ...overrides,
  };

  const { json } = await api('POST', '/bug-reports', payload);
  return json.data;
}
