import { Hono } from 'hono';
import { db } from '../db';
import { visualDiffs, baselines, bugReports } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { generateMockVisualAnalysis, type BoundingBox } from '../lib/visual-comparison';

export const visualDiffRoutes = new Hono();

// GET /v1/visual-diffs - List visual diffs with optional filters
visualDiffRoutes.get('/', async (c) => {
  const baselineId = c.req.query('baseline_id');
  const status = c.req.query('status');
  const projectId = c.req.query('project_id');

  let query = db.select().from(visualDiffs).orderBy(desc(visualDiffs.createdAt));

  // Apply filters using chained where conditions
  const conditions = [];
  if (baselineId) conditions.push(eq(visualDiffs.baselineId, baselineId));
  if (status) conditions.push(eq(visualDiffs.overallStatus, status as any));
  if (projectId) conditions.push(eq(visualDiffs.projectId, projectId));

  let result;
  if (conditions.length > 0) {
    result = await db.select().from(visualDiffs)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(visualDiffs.createdAt));
  } else {
    result = await db.select().from(visualDiffs).orderBy(desc(visualDiffs.createdAt));
  }

  return c.json({
    data: result.map((d) => ({
      ...d,
      changes: JSON.parse(d.changes),
      baseline_id: d.baselineId,
      current_screenshot_url: d.currentScreenshotUrl,
      diff_image_url: d.diffImageUrl,
      overall_status: d.overallStatus,
      ai_analysis_status: d.aiAnalysisStatus,
      created_by: d.createdBy,
      created_at: d.createdAt,
    })),
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});

// GET /v1/visual-diffs/:id - Get visual diff details
visualDiffRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const [diff] = await db.select().from(visualDiffs).where(eq(visualDiffs.id, id));
  if (!diff) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Visual diff not found' } }, 404);
  }

  // Also fetch associated baseline info
  const [baseline] = await db.select().from(baselines).where(eq(baselines.id, diff.baselineId));

  return c.json({
    data: {
      ...diff,
      changes: JSON.parse(diff.changes),
      baseline_id: diff.baselineId,
      current_screenshot_url: diff.currentScreenshotUrl,
      diff_image_url: diff.diffImageUrl,
      overall_status: diff.overallStatus,
      ai_analysis_status: diff.aiAnalysisStatus,
      created_by: diff.createdBy,
      created_at: diff.createdAt,
      baseline: baseline
        ? {
            id: baseline.id,
            name: baseline.name,
            page_url: baseline.pageUrl,
            viewport: JSON.parse(baseline.viewport),
            screenshot_url: baseline.screenshotUrl,
          }
        : null,
    },
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});

// POST /v1/visual-diffs - Create a new visual diff comparison
visualDiffRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const id = uuid();
  const now = new Date().toISOString();

  // Verify baseline exists
  const [baseline] = await db.select().from(baselines).where(eq(baselines.id, body.baseline_id));
  if (!baseline) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Baseline not found' } }, 404);
  }

  await db.insert(visualDiffs).values({
    id,
    baselineId: body.baseline_id,
    projectId: body.project_id || baseline.projectId,
    currentScreenshotUrl: body.current_screenshot_url || '',
    changes: '[]',
    overallStatus: 'no_change',
    aiAnalysisStatus: 'pending',
    createdBy: body.created_by || 'user-default',
    createdAt: now,
  });

  return c.json({
    data: { id, ai_analysis_status: 'pending', created_at: now },
    meta: { request_id: uuid(), timestamp: now },
  }, 201);
});

// POST /v1/visual-diffs/:id/analyze - Trigger AI analysis
visualDiffRoutes.post('/:id/analyze', async (c) => {
  const id = c.req.param('id');
  const [diff] = await db.select().from(visualDiffs).where(eq(visualDiffs.id, id));
  if (!diff) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Visual diff not found' } }, 404);
  }

  // Get associated baseline
  const [baseline] = await db.select().from(baselines).where(eq(baselines.id, diff.baselineId));
  const pageUrl = baseline?.pageUrl || '';

  // Generate mock diff regions (in production, this would use actual pixel comparison)
  const mockRegions: BoundingBox[] = [
    { x: 0, y: 0, width: 1440, height: 60 },
    { x: 200, y: 300, width: 400, height: 200 },
  ];

  // Run mock AI analysis
  const analysis = generateMockVisualAnalysis(mockRegions, pageUrl);

  // Update the visual diff with analysis results
  await db.update(visualDiffs).set({
    changes: JSON.stringify(analysis.changes),
    overallStatus: analysis.overall_status,
    aiAnalysisStatus: 'completed',
    diffImageUrl: `mock://diffs/${id}.png`,
  }).where(eq(visualDiffs.id, id));

  return c.json({
    data: {
      id,
      ai_analysis_status: 'completed',
      overall_status: analysis.overall_status,
      changes: analysis.changes,
      summary: analysis.summary,
      diff_image_url: `mock://diffs/${id}.png`,
    },
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});

// POST /v1/visual-diffs/:id/approve - Approve changes, update baseline
visualDiffRoutes.post('/:id/approve', async (c) => {
  const id = c.req.param('id');
  const [diff] = await db.select().from(visualDiffs).where(eq(visualDiffs.id, id));
  if (!diff) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Visual diff not found' } }, 404);
  }

  const now = new Date().toISOString();

  // Update baseline screenshot with current screenshot
  await db.update(baselines).set({
    screenshotUrl: diff.currentScreenshotUrl,
    updatedAt: now,
  }).where(eq(baselines.id, diff.baselineId));

  // Mark diff as approved (intentional)
  await db.update(visualDiffs).set({
    overallStatus: 'intentional',
  }).where(eq(visualDiffs.id, id));

  return c.json({
    data: { baseline_updated: true, approved_at: now },
    meta: { request_id: uuid(), timestamp: now },
  });
});

// POST /v1/visual-diffs/:id/bug-report - Create bug report from visual diff
visualDiffRoutes.post('/:id/bug-report', async (c) => {
  const id = c.req.param('id');
  const [diff] = await db.select().from(visualDiffs).where(eq(visualDiffs.id, id));
  if (!diff) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Visual diff not found' } }, 404);
  }

  const body = await c.req.json();
  const [baseline] = await db.select().from(baselines).where(eq(baselines.id, diff.baselineId));

  const bugReportId = uuid();
  const now = new Date().toISOString();

  // Parse changes to build description
  const changes = JSON.parse(diff.changes) as any[];
  const regressions = changes.filter((c: any) => c.classification === 'regression');
  const autoDescription = regressions.length > 0
    ? regressions.map((r: any) => `- ${r.description}`).join('\n')
    : '시각적 회귀가 감지되었습니다.';

  await db.insert(bugReports).values({
    id: bugReportId,
    projectId: diff.projectId,
    reporterId: diff.createdBy,
    title: body.title || `시각적 회귀: ${baseline?.name || 'Unknown'}`,
    description: body.description || autoDescription,
    severity: body.severity || 'major',
    status: 'open',
    pageUrl: baseline?.pageUrl || '',
    environment: JSON.stringify({ source: 'visual-regression', viewport: baseline ? JSON.parse(baseline.viewport) : {} }),
    screenshotUrls: JSON.stringify([diff.currentScreenshotUrl]),
    visualDiffId: id,
    aiAnalysisStatus: 'completed',
    createdAt: now,
    updatedAt: now,
  });

  return c.json({
    data: { id: bugReportId, visual_diff_id: id, created_at: now },
    meta: { request_id: uuid(), timestamp: now },
  }, 201);
});

// DELETE /v1/visual-diffs/:id
visualDiffRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await db.delete(visualDiffs).where(eq(visualDiffs.id, id));
  return c.json({
    data: { deleted: true },
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});
