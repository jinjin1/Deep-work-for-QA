import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { bugReportRoutes } from './routes/bug-reports';
import { baselineRoutes } from './routes/baselines';
import { visualDiffRoutes } from './routes/visual-diffs';
import { ignoreRegionRoutes } from './routes/ignore-regions';
import { comparisonRunRoutes } from './routes/comparison-runs';
import { aiRoutes } from './routes/ai';
import { uploadRoutes } from './routes/uploads';

export const app = new Hono();

// CORS — configurable via CORS_ORIGIN env var (comma-separated origins, or * for all)
const corsOrigin = process.env.CORS_ORIGIN;
app.use('*', cors({
  origin: corsOrigin
    ? corsOrigin.split(',').map((o) => o.trim())
    : '*',
}));

app.use('*', logger());

// Optional API key authentication
const apiKey = process.env.DEEP_WORK_API_KEY;
if (apiKey) {
  app.use('/v1/*', async (c, next) => {
    const provided = c.req.header('X-API-Key');
    if (provided !== apiKey) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' } }, 401);
    }
    await next();
  });
  console.log('[auth] API key authentication enabled.');
}

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
