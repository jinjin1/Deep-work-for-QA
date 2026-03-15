import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { bugReportRoutes } from './routes/bug-reports';
import { baselineRoutes } from './routes/baselines';
import { visualDiffRoutes } from './routes/visual-diffs';
import { ignoreRegionRoutes } from './routes/ignore-regions';
import { comparisonRunRoutes } from './routes/comparison-runs';
import { aiRoutes } from './routes/ai';

export const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger());

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
