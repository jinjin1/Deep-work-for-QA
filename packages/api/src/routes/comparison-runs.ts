import { Hono } from 'hono';
import { db } from '../db/index.js';
import { comparisonRuns, baselines, visualDiffs } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { generateMockVisualAnalysis, type BoundingBox } from '../lib/visual-comparison.js';

export const comparisonRunRoutes = new Hono();

function safeJsonParse(value: string | null | undefined, fallback: unknown = null) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

// POST /v1/comparison-runs - Start a batch comparison run
comparisonRunRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const projectId = body.project_id || 'proj-default';
  const trigger = body.trigger || 'manual';
  const createdBy = body.created_by || 'user-default';

  // Get all baselines for the project
  const projectBaselines = await db.select().from(baselines).where(eq(baselines.projectId, projectId));

  if (projectBaselines.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'No baselines found for this project' } }, 404);
  }

  const runId = uuid();
  const now = new Date().toISOString();

  // Create visual diffs for each baseline (using mock screenshots for batch)
  const diffIds: string[] = [];
  let noChangeCount = 0;
  let intentionalCount = 0;
  let regressionCount = 0;
  let uncertainCount = 0;

  for (const baseline of projectBaselines) {
    const diffId = uuid();
    const currentScreenshotUrl = body.screenshots?.[baseline.id] || `mock://batch/${runId}/${baseline.id}.png`;

    // Create the diff
    await db.insert(visualDiffs).values({
      id: diffId,
      baselineId: baseline.id,
      projectId,
      currentScreenshotUrl,
      changes: '[]',
      overallStatus: 'no_change',
      aiAnalysisStatus: 'pending',
      createdBy,
      createdAt: now,
    });

    // Run mock analysis
    const mockRegions: BoundingBox[] = [
      { x: 0, y: 0, width: 1440, height: 60 },
      { x: 200, y: 300, width: 400, height: 200 },
    ];
    const analysis = generateMockVisualAnalysis(mockRegions, baseline.pageUrl);

    await db.update(visualDiffs).set({
      changes: JSON.stringify(analysis.changes),
      overallStatus: analysis.overall_status,
      aiAnalysisStatus: 'completed',
      diffImageUrl: `mock://diffs/batch-${runId}-${diffId}.png`,
    }).where(eq(visualDiffs.id, diffId));

    diffIds.push(diffId);

    // Count statuses
    switch (analysis.overall_status) {
      case 'no_change': noChangeCount++; break;
      case 'intentional': intentionalCount++; break;
      case 'regression': regressionCount++; break;
      case 'mixed': {
        // Count as regression for the run-level stat, but also tally uncertain changes
        regressionCount++;
        const hasUncertain = analysis.changes.some((ch: any) => ch.classification === 'uncertain');
        if (hasUncertain) uncertainCount++;
        break;
      }
    }
  }

  // Create the comparison run record
  await db.insert(comparisonRuns).values({
    id: runId,
    projectId,
    trigger,
    status: 'completed',
    totalBaselines: String(projectBaselines.length),
    noChangeCount: String(noChangeCount),
    intentionalCount: String(intentionalCount),
    regressionCount: String(regressionCount),
    uncertainCount: String(uncertainCount),
    visualDiffIds: JSON.stringify(diffIds),
    createdBy,
    createdAt: now,
    completedAt: now,
  });

  return c.json({
    data: {
      id: runId,
      project_id: projectId,
      trigger,
      status: 'completed',
      total_baselines: projectBaselines.length,
      no_change_count: noChangeCount,
      intentional_count: intentionalCount,
      regression_count: regressionCount,
      uncertain_count: uncertainCount,
      visual_diff_ids: diffIds,
      created_at: now,
      completed_at: now,
    },
    meta: { request_id: uuid(), timestamp: now },
  }, 201);
});

// GET /v1/comparison-runs - List comparison runs
comparisonRunRoutes.get('/', async (c) => {
  const projectId = c.req.query('project_id');
  const limit = Math.min(Number(c.req.query('limit')) || 50, 100);
  const offset = Number(c.req.query('offset')) || 0;

  let result;
  if (projectId) {
    result = await db.select().from(comparisonRuns)
      .where(eq(comparisonRuns.projectId, projectId))
      .orderBy(desc(comparisonRuns.createdAt))
      .limit(limit).offset(offset);
  } else {
    result = await db.select().from(comparisonRuns)
      .orderBy(desc(comparisonRuns.createdAt))
      .limit(limit).offset(offset);
  }

  return c.json({
    data: result.map((r) => ({
      id: r.id,
      project_id: r.projectId,
      trigger: r.trigger,
      status: r.status,
      total_baselines: Number(r.totalBaselines),
      no_change_count: Number(r.noChangeCount),
      intentional_count: Number(r.intentionalCount),
      regression_count: Number(r.regressionCount),
      uncertain_count: Number(r.uncertainCount),
      visual_diff_ids: safeJsonParse(r.visualDiffIds, []),
      created_by: r.createdBy,
      created_at: r.createdAt,
      completed_at: r.completedAt,
    })),
    meta: { request_id: uuid(), timestamp: new Date().toISOString(), limit, offset },
  });
});

// GET /v1/comparison-runs/:id - Get comparison run details
comparisonRunRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const [run] = await db.select().from(comparisonRuns).where(eq(comparisonRuns.id, id));

  if (!run) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Comparison run not found' } }, 404);
  }

  return c.json({
    data: {
      id: run.id,
      project_id: run.projectId,
      trigger: run.trigger,
      status: run.status,
      total_baselines: Number(run.totalBaselines),
      no_change_count: Number(run.noChangeCount),
      intentional_count: Number(run.intentionalCount),
      regression_count: Number(run.regressionCount),
      uncertain_count: Number(run.uncertainCount),
      visual_diff_ids: JSON.parse(run.visualDiffIds),
      created_by: run.createdBy,
      created_at: run.createdAt,
      completed_at: run.completedAt,
    },
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});
