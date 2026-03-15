import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { detectAnomalies } from '../lib/anomaly-detector';

export function seedDefaults(db: BetterSQLite3Database<any>) {
  const now = new Date().toISOString();

  // INSERT OR IGNORE for idempotency
  db.run(sql`
    INSERT OR IGNORE INTO organizations (id, name, slug, plan, created_at)
    VALUES ('org-default', 'Default Org', 'default', 'free', ${now})
  `);

  db.run(sql`
    INSERT OR IGNORE INTO projects (id, organization_id, name, url_patterns, created_at)
    VALUES ('proj-default', 'org-default', 'Default Project', '[]', ${now})
  `);

  db.run(sql`
    INSERT OR IGNORE INTO users (id, organization_id, email, name, role, created_at)
    VALUES ('user-default', 'org-default', 'default@deepwork.dev', 'Default User', 'member', ${now})
  `);

  console.log('[seed] Default organization, project, and user ensured.');

  // Seed demo sessions for local testing
  seedDemoSessions(db);

  // Seed demo baselines and visual diffs for visual regression testing
  seedDemoBaselines(db);
}

function seedDemoBaselines(db: BetterSQLite3Database<any>) {
  const existing = db.all(sql`SELECT id FROM baselines WHERE id = 'demo-baseline-1'`);
  if (existing.length > 0) {
    console.log('[seed] Demo baselines already exist, skipping.');
    return;
  }

  const now = new Date().toISOString();

  // 4 demo baselines
  const demoBaselines = [
    { id: 'demo-baseline-1', name: 'Homepage', pageUrl: 'https://app.example.com/', viewport: '{"width":1440,"height":900}' },
    { id: 'demo-baseline-2', name: 'Login Page', pageUrl: 'https://app.example.com/login', viewport: '{"width":1440,"height":900}' },
    { id: 'demo-baseline-3', name: 'Dashboard', pageUrl: 'https://app.example.com/dashboard', viewport: '{"width":1440,"height":900}' },
    { id: 'demo-baseline-4', name: 'Settings Page', pageUrl: 'https://app.example.com/settings', viewport: '{"width":1280,"height":720}' },
  ];

  for (const b of demoBaselines) {
    db.run(sql`
      INSERT OR IGNORE INTO baselines (id, project_id, name, page_url, viewport, screenshot_url, created_by, created_at, updated_at)
      VALUES (${b.id}, 'proj-default', ${b.name}, ${b.pageUrl}, ${b.viewport}, ${'mock://baselines/' + b.id + '.png'}, 'user-default', ${now}, ${now})
    `);
  }

  // 4 demo visual diffs
  const demoDiffs = [
    { id: 'demo-diff-1', baselineId: 'demo-baseline-1', status: 'no_change' },
    { id: 'demo-diff-2', baselineId: 'demo-baseline-2', status: 'regression' },
    { id: 'demo-diff-3', baselineId: 'demo-baseline-3', status: 'intentional' },
    { id: 'demo-diff-4', baselineId: 'demo-baseline-4', status: 'mixed' },
  ];

  for (const d of demoDiffs) {
    db.run(sql`
      INSERT OR IGNORE INTO visual_diffs (id, baseline_id, project_id, current_screenshot_url, diff_image_url, changes, overall_status, ai_analysis_status, created_by, created_at)
      VALUES (${d.id}, ${d.baselineId}, 'proj-default', ${'mock://current/' + d.id + '.png'}, ${'mock://diffs/' + d.id + '.png'}, '[]', ${d.status}, 'completed', 'user-default', ${now})
    `);
  }

  console.log('[seed] 4 demo baselines and 4 demo visual diffs created.');
}

function seedDemoSessions(db: BetterSQLite3Database<any>) {
  // Check if demo sessions already exist
  const existing = db.all(sql`SELECT id FROM sessions WHERE id = 'demo-session-1'`);
  if (existing.length > 0) {
    console.log('[seed] Demo sessions already exist, skipping.');
    return;
  }

  const now = Date.now();

  // ────────────────────────────────────────────
  // Session 1: Login flow with errors
  // ────────────────────────────────────────────
  const s1Id = 'demo-session-1';
  const s1Events = [
    { type: 'page_visit', timestamp: 0, url: 'https://app.example.com/login' },
    { type: 'click', timestamp: 2000, target: 'input.email' },
    { type: 'input', timestamp: 3000, target: 'input.email', data: { value: 'user@test.com' } },
    { type: 'click', timestamp: 4000, target: 'input.password' },
    { type: 'input', timestamp: 5000, target: 'input.password', data: { value: '****' } },
    { type: 'click', timestamp: 6000, target: 'button.login' },
    { type: 'click', timestamp: 6300, target: 'button.login' },
    { type: 'click', timestamp: 6600, target: 'button.login' },
    { type: 'click', timestamp: 6900, target: 'button.login' },
    { type: 'click', timestamp: 7100, target: 'button.login' },
    { type: 'page_visit', timestamp: 12000, url: 'https://app.example.com/dashboard' },
    { type: 'click', timestamp: 15000, target: 'nav.settings' },
    { type: 'page_visit', timestamp: 16000, url: 'https://app.example.com/settings' },
    { type: 'scroll', timestamp: 18000, data: { scrollY: 300 } },
    { type: 'click', timestamp: 20000, target: 'button.save-settings' },
  ];
  const s1Console = [
    { timestamp: 6200, level: 'error', message: 'TypeError: Cannot read properties of undefined (reading \'token\')', stack: 'at AuthService.login (auth.js:45)\nat handleSubmit (LoginForm.tsx:23)' },
    { timestamp: 7000, level: 'warn', message: 'Multiple rapid submissions detected' },
    { timestamp: 12500, level: 'log', message: 'Dashboard loaded in 5200ms' },
  ];
  const s1Network = [
    { timestamp: 6100, name: 'https://api.example.com/auth/login', method: 'POST', duration: 800, responseStatus: 500, initiatorType: 'fetch' },
    { timestamp: 12000, name: 'https://api.example.com/dashboard/data', method: 'GET', duration: 5200, responseStatus: 200, initiatorType: 'fetch' },
    { timestamp: 16000, name: 'https://api.example.com/settings', method: 'GET', duration: 300, responseStatus: 200, initiatorType: 'fetch' },
    { timestamp: 20100, name: 'https://api.example.com/settings', method: 'PUT', duration: 400, responseStatus: 200, initiatorType: 'fetch' },
  ];

  createDemoSession(db, {
    id: s1Id,
    startUrl: 'https://app.example.com/login',
    durationMs: 25000,
    pageCount: 3,
    events: s1Events,
    consoleLogs: s1Console,
    networkLogs: s1Network,
    tags: ['로그인 플로우', 'QA'],
    environment: { browser: 'Chrome 120', os: 'macOS', viewport: { width: 1440, height: 900 } },
    createdAt: new Date(now - 3600000).toISOString(), // 1 hour ago
  });

  // ────────────────────────────────────────────
  // Session 2: E-commerce checkout with dead clicks
  // ────────────────────────────────────────────
  const s2Id = 'demo-session-2';
  const s2Events = [
    { type: 'page_visit', timestamp: 0, url: 'https://shop.example.com/products' },
    { type: 'click', timestamp: 3000, target: 'div.product-card' },
    { type: 'page_visit', timestamp: 3500, url: 'https://shop.example.com/products/123' },
    { type: 'click', timestamp: 5000, target: 'button.add-to-cart' },
    { type: 'mutation', timestamp: 5200 },
    { type: 'click', timestamp: 8000, target: 'button.checkout' },
    { type: 'page_visit', timestamp: 8500, url: 'https://shop.example.com/checkout' },
    { type: 'click', timestamp: 10000, target: 'input.card-number' },
    { type: 'input', timestamp: 12000, target: 'input.card-number', data: { value: '4242****' } },
    { type: 'click', timestamp: 14000, target: 'button.pay-now' },
    { type: 'click', timestamp: 18000, target: 'button.pay-now' },
    { type: 'click', timestamp: 22000, target: 'span.coupon-link' },
    { type: 'click', timestamp: 26000, target: 'button.apply-coupon' },
    { type: 'scroll', timestamp: 28000, data: { scrollY: 500 } },
    { type: 'click', timestamp: 30000, target: 'button.pay-now' },
    { type: 'page_visit', timestamp: 35000, url: 'https://shop.example.com/order/confirmed' },
  ];
  const s2Console = [
    { timestamp: 14500, level: 'error', message: 'PaymentError: Card validation failed - missing CVC field' },
    { timestamp: 22500, level: 'warn', message: 'Coupon component not mounted' },
  ];
  const s2Network = [
    { timestamp: 3500, name: 'https://api.shop.example.com/products/123', method: 'GET', duration: 400, responseStatus: 200 },
    { timestamp: 5100, name: 'https://api.shop.example.com/cart/add', method: 'POST', duration: 300, responseStatus: 200 },
    { timestamp: 14200, name: 'https://api.shop.example.com/payments/process', method: 'POST', duration: 3000, responseStatus: 422 },
    { timestamp: 30200, name: 'https://api.shop.example.com/payments/process', method: 'POST', duration: 2000, responseStatus: 200 },
  ];

  createDemoSession(db, {
    id: s2Id,
    startUrl: 'https://shop.example.com/products',
    durationMs: 38000,
    pageCount: 4,
    events: s2Events,
    consoleLogs: s2Console,
    networkLogs: s2Network,
    tags: ['결제 플로우', 'E2E'],
    environment: { browser: 'Chrome 120', os: 'Windows 11', viewport: { width: 1920, height: 1080 } },
    createdAt: new Date(now - 7200000).toISOString(), // 2 hours ago
  });

  // ────────────────────────────────────────────
  // Session 3: 404 page & network errors
  // ────────────────────────────────────────────
  const s3Id = 'demo-session-3';
  const s3Events = [
    { type: 'page_visit', timestamp: 0, url: 'https://app.example.com/dashboard' },
    { type: 'click', timestamp: 2000, target: 'a.reports-link' },
    { type: 'page_visit', timestamp: 2500, url: 'https://app.example.com/reports' },
    { type: 'click', timestamp: 5000, target: 'a.report-detail' },
    { type: 'navigation', timestamp: 5500, url: 'https://app.example.com/404' },
    { type: 'click', timestamp: 8000, target: 'a.back-home' },
    { type: 'page_visit', timestamp: 8500, url: 'https://app.example.com/dashboard' },
    { type: 'click', timestamp: 10000, target: 'button.export' },
    { type: 'scroll', timestamp: 12000, data: { scrollY: 200 } },
  ];
  const s3Console = [
    { timestamp: 5600, level: 'error', message: 'Error: Page not found - /reports/deleted-item' },
    { timestamp: 10200, level: 'error', message: 'NetworkError: Failed to fetch export data' },
  ];
  const s3Network = [
    { timestamp: 2500, name: 'https://api.example.com/reports', method: 'GET', duration: 300, responseStatus: 200 },
    { timestamp: 5500, name: 'https://app.example.com/404', method: 'GET', duration: 200, responseStatus: 404, initiatorType: 'navigation' },
    { timestamp: 10100, name: 'https://api.example.com/reports/export', method: 'POST', duration: 8000, responseStatus: 503 },
  ];

  createDemoSession(db, {
    id: s3Id,
    startUrl: 'https://app.example.com/dashboard',
    durationMs: 15000,
    pageCount: 3,
    events: s3Events,
    consoleLogs: s3Console,
    networkLogs: s3Network,
    tags: ['리포트', '버그'],
    environment: { browser: 'Firefox 121', os: 'macOS', viewport: { width: 1440, height: 900 } },
    createdAt: new Date(now - 86400000).toISOString(), // 1 day ago
  });

  // ────────────────────────────────────────────
  // Session 4: Clean session (no anomalies)
  // ────────────────────────────────────────────
  const s4Id = 'demo-session-4';
  const s4Events = [
    { type: 'page_visit', timestamp: 0, url: 'https://app.example.com/dashboard' },
    { type: 'click', timestamp: 2000, target: 'nav.profile' },
    { type: 'page_visit', timestamp: 2500, url: 'https://app.example.com/profile' },
    { type: 'mutation', timestamp: 2600 },
    { type: 'click', timestamp: 4000, target: 'button.edit' },
    { type: 'mutation', timestamp: 4100 },
    { type: 'input', timestamp: 5000, target: 'input.name', data: { value: 'Updated Name' } },
    { type: 'click', timestamp: 6000, target: 'button.save' },
    { type: 'mutation', timestamp: 6200 },
  ];
  const s4Console: any[] = [];
  const s4Network = [
    { timestamp: 2500, name: 'https://api.example.com/profile', method: 'GET', duration: 250, responseStatus: 200 },
    { timestamp: 6100, name: 'https://api.example.com/profile', method: 'PUT', duration: 400, responseStatus: 200 },
  ];

  createDemoSession(db, {
    id: s4Id,
    startUrl: 'https://app.example.com/dashboard',
    durationMs: 8000,
    pageCount: 2,
    events: s4Events,
    consoleLogs: s4Console,
    networkLogs: s4Network,
    tags: ['프로필'],
    environment: { browser: 'Chrome 120', os: 'macOS', viewport: { width: 1440, height: 900 } },
    createdAt: new Date(now - 172800000).toISOString(), // 2 days ago
  });

  console.log('[seed] 4 demo sessions created with anomaly analysis.');
}

function createDemoSession(
  db: BetterSQLite3Database<any>,
  opts: {
    id: string;
    startUrl: string;
    durationMs: number;
    pageCount: number;
    events: any[];
    consoleLogs: any[];
    networkLogs: any[];
    tags: string[];
    environment: any;
    createdAt: string;
  },
) {
  // Run anomaly detection
  const analysis = detectAnomalies(opts.events, opts.consoleLogs, opts.networkLogs, opts.durationMs);

  // Insert session
  db.run(sql`
    INSERT OR IGNORE INTO sessions (
      id, project_id, user_id, start_url, duration_ms, page_count, event_count,
      environment, events_data, console_logs, network_logs,
      anomalies, ai_analysis_status, session_summary, causal_chain, status, created_at
    ) VALUES (
      ${opts.id}, 'proj-default', 'user-default', ${opts.startUrl},
      ${opts.durationMs}, ${opts.pageCount}, ${opts.events.length},
      ${JSON.stringify(opts.environment)}, ${JSON.stringify(opts.events)},
      ${JSON.stringify(opts.consoleLogs)}, ${JSON.stringify(opts.networkLogs)},
      ${JSON.stringify(analysis.anomalies)}, 'completed', ${analysis.session_summary},
      ${JSON.stringify(analysis.causal_chain)}, 'ready', ${opts.createdAt}
    )
  `);

  // Insert anomalies
  for (const anomaly of analysis.anomalies) {
    db.run(sql`
      INSERT OR IGNORE INTO session_anomalies (
        id, session_id, type, timestamp_start, timestamp_end, severity, description, related_events, created_at
      ) VALUES (
        ${anomaly.id}, ${opts.id}, ${anomaly.type}, ${anomaly.timestamp_start},
        ${anomaly.timestamp_end}, ${anomaly.severity}, ${anomaly.description},
        ${JSON.stringify(anomaly.related_events)}, ${opts.createdAt}
      )
    `);
  }

  // Insert tags
  for (const tagName of opts.tags) {
    db.run(sql`
      INSERT OR IGNORE INTO session_tags (id, session_id, name)
      VALUES (${uuid()}, ${opts.id}, ${tagName})
    `);
  }

  console.log(`[seed] Session ${opts.id}: ${analysis.anomalies.length} anomalies, ${analysis.causal_chain.length} causal chains`);
}

