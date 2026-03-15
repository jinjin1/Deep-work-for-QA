import { Hono } from 'hono';
import { db } from '../db';
import { visualDiffs, baselines, bugReports, ignoreRegions } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { PNG } from 'pngjs';
import { generateMockVisualAnalysis, runVisualComparison, type BoundingBox } from '../lib/visual-comparison';

export const visualDiffRoutes = new Hono();

// GET /v1/visual-diffs - List visual diffs with optional filters
visualDiffRoutes.get('/', async (c) => {
  const baselineId = c.req.query('baseline_id');
  const status = c.req.query('status');
  const projectId = c.req.query('project_id');
  const limit = Math.min(Number(c.req.query('limit')) || 50, 100);
  const offset = Number(c.req.query('offset')) || 0;

  // Apply filters using chained where conditions
  const conditions = [];
  if (baselineId) conditions.push(eq(visualDiffs.baselineId, baselineId));
  if (status) conditions.push(eq(visualDiffs.overallStatus, status as any));
  if (projectId) conditions.push(eq(visualDiffs.projectId, projectId));

  let result;
  if (conditions.length > 0) {
    result = await db.select().from(visualDiffs)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(visualDiffs.createdAt))
      .limit(limit).offset(offset);
  } else {
    result = await db.select().from(visualDiffs)
      .orderBy(desc(visualDiffs.createdAt))
      .limit(limit).offset(offset);
  }

  return c.json({
    data: result.map((d) => ({
      ...d,
      changes: JSON.parse(d.changes),
      project_id: d.projectId,
      baseline_id: d.baselineId,
      current_screenshot_url: d.currentScreenshotUrl,
      diff_image_url: d.diffImageUrl,
      overall_status: d.overallStatus,
      ai_analysis_status: d.aiAnalysisStatus,
      created_by: d.createdBy,
      created_at: d.createdAt,
    })),
    meta: { request_id: uuid(), timestamp: new Date().toISOString(), limit, offset },
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
      project_id: diff.projectId,
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

  if (!body.baseline_id || typeof body.baseline_id !== 'string') {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'baseline_id is required' } }, 400);
  }
  if (!body.current_screenshot_url || typeof body.current_screenshot_url !== 'string') {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'current_screenshot_url is required' } }, 400);
  }

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

// Helper: decode a data:image/png;base64,... URL into raw RGBA + dimensions
function decodePngDataUrl(dataUrl: string): { data: Uint8Array; width: number; height: number } | null {
  try {
    const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
    if (!match) return null;
    const buffer = Buffer.from(match[1], 'base64');
    const png = PNG.sync.read(buffer);
    return { data: new Uint8Array(png.data), width: png.width, height: png.height };
  } catch {
    return null;
  }
}

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

  // Get ignore regions for this baseline
  const ignoreRegionRows = await db.select().from(ignoreRegions).where(eq(ignoreRegions.baselineId, diff.baselineId));
  const ignoreRects = ignoreRegionRows.map((r) => JSON.parse(r.region));

  let analysis;

  // Try real pixel comparison if both screenshots are data: URLs
  const baselineImg = baseline?.screenshotUrl ? decodePngDataUrl(baseline.screenshotUrl) : null;
  const currentImg = diff.currentScreenshotUrl ? decodePngDataUrl(diff.currentScreenshotUrl) : null;

  if (baselineImg && currentImg && baselineImg.width === currentImg.width && baselineImg.height === currentImg.height) {
    // Real pixel-level comparison
    const result = runVisualComparison(
      baselineImg.data, currentImg.data,
      baselineImg.width, baselineImg.height,
      pageUrl,
    );
    analysis = {
      changes: result.changes,
      overall_status: result.overall_status,
      summary: result.summary,
      diffPixelCount: result.diffPixelCount,
      diffPercentage: result.diffPercentage,
    };
  } else {
    // Fallback to mock analysis (seed data or mismatched dimensions)
    const mockRegions: BoundingBox[] = [
      { x: 0, y: 0, width: 1440, height: 60 },
      { x: 200, y: 300, width: 400, height: 200 },
    ];
    analysis = { ...generateMockVisualAnalysis(mockRegions, pageUrl), diffPixelCount: undefined, diffPercentage: undefined };
  }

  // Filter out changes that overlap with ignore regions
  if (ignoreRects.length > 0) {
    analysis.changes = analysis.changes.filter((change: any) => {
      const cr = change.region;
      return !ignoreRects.some((ir: any) =>
        cr.x < ir.x + ir.width && cr.x + cr.width > ir.x &&
        cr.y < ir.y + ir.height && cr.y + cr.height > ir.y,
      );
    });
    // Recalculate overall status and summary after filtering
    if (analysis.changes.length === 0) {
      analysis.overall_status = 'no_change';
      analysis.summary = '무시 영역을 제외한 결과 변경 사항이 없습니다.';
    } else {
      const hasReg = analysis.changes.some((c: any) => c.classification === 'regression');
      const hasInt = analysis.changes.some((c: any) => c.classification === 'intentional');
      const hasUnc = analysis.changes.some((c: any) => c.classification === 'uncertain');
      if (hasReg && (hasInt || hasUnc)) analysis.overall_status = 'mixed';
      else if (hasReg) analysis.overall_status = 'regression';
      else if (hasInt && hasUnc) analysis.overall_status = 'mixed';
      else if (hasInt) analysis.overall_status = 'intentional';
      else analysis.overall_status = 'mixed'; // all uncertain
      const regCount = analysis.changes.filter((c: any) => c.classification === 'regression').length;
      const intCount = analysis.changes.filter((c: any) => c.classification === 'intentional').length;
      const parts = [];
      if (regCount > 0) parts.push(`회귀 ${regCount}건`);
      if (intCount > 0) parts.push(`의도적 변경 ${intCount}건`);
      analysis.summary = `${analysis.changes.length}건의 변경 감지 (무시 영역 필터 적용): ${parts.join(', ')}`;
    }
  }

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
      diff_pixel_count: analysis.diffPixelCount,
      diff_percentage: analysis.diffPercentage,
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

  if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'title is required' } }, 400);
  }

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
    reporterId: body.created_by || diff.createdBy,
    title: body.title || `시각적 회귀: ${baseline?.name || 'Unknown'}`,
    description: body.description || autoDescription,
    severity: body.severity || 'major',
    status: 'open',
    pageUrl: baseline?.pageUrl || '',
    environment: JSON.stringify({ source: 'visual-regression', viewport: baseline ? JSON.parse(baseline.viewport) : {} }),
    consoleLogs: JSON.stringify(body.console_logs || []),
    networkLogs: JSON.stringify(body.network_logs || []),
    screenshotUrls: JSON.stringify([diff.currentScreenshotUrl]),
    visualDiffId: id,
    aiAnalysisStatus: 'completed',
    createdAt: now,
    updatedAt: now,
  });

  // Link regression changes back to the bug report
  for (const change of regressions) {
    change.bug_report_id = bugReportId;
  }
  await db.update(visualDiffs).set({
    changes: JSON.stringify(changes),
  }).where(eq(visualDiffs.id, id));

  return c.json({
    data: { id: bugReportId, visual_diff_id: id, created_at: now },
    meta: { request_id: uuid(), timestamp: now },
  }, 201);
});

// PUT /v1/visual-diffs/:id/changes/:changeId - Update a single change classification
visualDiffRoutes.put('/:id/changes/:changeId', async (c) => {
  const id = c.req.param('id');
  const changeId = c.req.param('changeId');
  const [diff] = await db.select().from(visualDiffs).where(eq(visualDiffs.id, id));
  if (!diff) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Visual diff not found' } }, 404);
  }

  const body = await c.req.json();
  const newClassification = body.classification;
  if (!['intentional', 'regression', 'uncertain'].includes(newClassification)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'classification must be intentional, regression, or uncertain' } }, 400);
  }

  const changes = JSON.parse(diff.changes) as any[];
  const changeIndex = changes.findIndex((c: any) => c.id === changeId);
  if (changeIndex === -1) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Change not found' } }, 404);
  }

  changes[changeIndex].classification = newClassification;

  // Recalculate overall status (consistent with classifyOverallStatus in visual-comparison.ts)
  const hasRegression = changes.some((c: any) => c.classification === 'regression');
  const hasIntentional = changes.some((c: any) => c.classification === 'intentional');
  const hasUncertain = changes.some((c: any) => c.classification === 'uncertain');
  let overallStatus: 'no_change' | 'intentional' | 'regression' | 'mixed' = 'no_change';
  if (changes.length === 0) overallStatus = 'no_change';
  else if (hasRegression && (hasIntentional || hasUncertain)) overallStatus = 'mixed';
  else if (hasRegression) overallStatus = 'regression';
  else if (hasIntentional && hasUncertain) overallStatus = 'mixed';
  else if (hasIntentional) overallStatus = 'intentional';
  else overallStatus = 'mixed'; // all uncertain

  await db.update(visualDiffs).set({
    changes: JSON.stringify(changes),
    overallStatus,
  }).where(eq(visualDiffs.id, id));

  return c.json({
    data: { change_id: changeId, classification: newClassification, overall_status: overallStatus },
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});

// DELETE /v1/visual-diffs/:id
visualDiffRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');

  const [existing] = await db.select().from(visualDiffs).where(eq(visualDiffs.id, id));
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Visual diff not found' } }, 404);
  }

  await db.delete(visualDiffs).where(eq(visualDiffs.id, id));
  return c.json({
    data: { deleted: true },
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});
