import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { timingSafeEqual } from 'crypto';
import { bugReportRoutes } from './routes/bug-reports.js';
import { baselineRoutes } from './routes/baselines.js';
import { visualDiffRoutes } from './routes/visual-diffs.js';
import { ignoreRegionRoutes } from './routes/ignore-regions.js';
import { comparisonRunRoutes } from './routes/comparison-runs.js';
import { aiRoutes } from './routes/ai.js';
import { uploadRoutes } from './routes/uploads.js';

export const app = new Hono();

// Global error handler — prevent internal details from leaking
app.onError((err, c) => {
  console.error('[error]', err.message);
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } }, 500);
});

// Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
// Allow cross-origin resource loading for uploaded images (served to web dashboard on a different port)
app.use('*', secureHeaders({
  crossOriginResourcePolicy: 'cross-origin',
}));

// CORS — configurable via CORS_ORIGIN env var (comma-separated origins)
// Defaults to localhost origins only; set CORS_ORIGIN=* to allow all (not recommended for production)
const corsOrigin = process.env.CORS_ORIGIN;
app.use('*', cors({
  origin: corsOrigin
    ? corsOrigin === '*' ? '*' : corsOrigin.split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://localhost:5173'],
}));

app.use('*', logger());

// API key authentication — applies to /v1/* and /uploads/*
const apiKey = process.env.DEEP_WORK_API_KEY;
if (apiKey) {
  const apiKeyBuffer = new Uint8Array(Buffer.from(apiKey));

  const authMiddleware = async (c: any, next: any) => {
    const provided = c.req.header('X-API-Key') || '';
    const providedBuffer = new Uint8Array(Buffer.from(provided));
    const isValid =
      providedBuffer.length === apiKeyBuffer.length &&
      timingSafeEqual(providedBuffer, apiKeyBuffer);
    if (!isValid) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' } }, 401);
    }
    await next();
  };

  app.use('/v1/*', authMiddleware);
  app.use('/uploads/*', authMiddleware);
  console.log('[auth] API key authentication enabled.');
} else {
  console.warn('[auth] WARNING: No DEEP_WORK_API_KEY set — API is unauthenticated. Set DEEP_WORK_API_KEY for production use.');
}

// Rate limiting — simple in-memory sliding window
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 120; // requests per window

app.use('/v1/*', async (c, next) => {
  const key = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  const now = Date.now();
  let entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(key, entry);
  }
  entry.count++;
  c.header('X-RateLimit-Limit', String(RATE_LIMIT_MAX));
  c.header('X-RateLimit-Remaining', String(Math.max(0, RATE_LIMIT_MAX - entry.count)));
  if (entry.count > RATE_LIMIT_MAX) {
    return c.json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } }, 429);
  }
  await next();
});

// Periodically clean up expired rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, RATE_LIMIT_WINDOW_MS);

// Health check
app.get('/', (c) => c.json({ name: 'Deep Work API', version: '0.1.0', status: 'ok' }));
app.get('/health', (c) => c.json({ status: 'ok' }));

// Routes
app.route('/v1/bug-reports', bugReportRoutes);
app.route('/v1/baselines', baselineRoutes);
app.route('/v1/baselines', ignoreRegionRoutes);
app.route('/v1/visual-diffs', visualDiffRoutes);
app.route('/v1/comparison-runs', comparisonRunRoutes);
app.route('/v1/ai', aiRoutes);
app.route('/uploads', uploadRoutes);
