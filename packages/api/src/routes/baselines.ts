import { Hono } from 'hono';
import { db } from '../db/index.js';
import { baselines, visualDiffs, ignoreRegions } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

export const baselineRoutes = new Hono();

// Helper to format baseline for response
function formatBaseline(b: typeof baselines.$inferSelect) {
  return {
    ...b,
    project_id: b.projectId,
    viewport: JSON.parse(b.viewport),
    page_url: b.pageUrl,
    screenshot_url: b.screenshotUrl,
    created_by: b.createdBy,
    created_at: b.createdAt,
    updated_at: b.updatedAt,
  };
}

// GET /v1/baselines - List baselines with optional filters and pagination
baselineRoutes.get('/', async (c) => {
  const projectId = c.req.query('project_id');
  const limit = Math.min(Number(c.req.query('limit')) || 50, 100);
  const offset = Number(c.req.query('offset')) || 0;

  let result;
  if (projectId) {
    result = await db.select().from(baselines)
      .where(eq(baselines.projectId, projectId))
      .orderBy(baselines.createdAt)
      .limit(limit).offset(offset);
  } else {
    result = await db.select().from(baselines)
      .orderBy(baselines.createdAt)
      .limit(limit).offset(offset);
  }

  return c.json({
    data: result.map(formatBaseline),
    meta: { request_id: uuid(), timestamp: new Date().toISOString(), limit, offset },
  });
});

// GET /v1/baselines/:id - Get a specific baseline
baselineRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const [baseline] = await db.select().from(baselines).where(eq(baselines.id, id));
  if (!baseline) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Baseline not found' } }, 404);
  }
  return c.json({
    data: formatBaseline(baseline),
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});

// POST /v1/baselines - Create a baseline
baselineRoutes.post('/', async (c) => {
  const body = await c.req.json();

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'name is required' } }, 400);
  }

  // Validate viewport if provided
  if (body.viewport) {
    const { width, height } = body.viewport;
    if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'viewport must have positive numeric width and height' } }, 400);
    }
  }

  const id = uuid();
  const now = new Date().toISOString();

  await db.insert(baselines).values({
    id,
    projectId: body.project_id || 'proj-default',
    name: body.name,
    pageUrl: body.page_url || '',
    viewport: JSON.stringify(body.viewport || { width: 1440, height: 900 }),
    screenshotUrl: body.screenshot_url || '',
    createdBy: body.created_by || 'user-default',
    createdAt: now,
    updatedAt: now,
  });

  return c.json({
    data: { id, created_at: now },
    meta: { request_id: uuid(), timestamp: now },
  }, 201);
});

// PUT /v1/baselines/:id - Update a baseline
baselineRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');

  // Check if baseline exists
  const [existing] = await db.select().from(baselines).where(eq(baselines.id, id));
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Baseline not found' } }, 404);
  }

  const body = await c.req.json();
  const now = new Date().toISOString();

  const updates: Record<string, any> = { updatedAt: now };
  if (body.name !== undefined) updates.name = body.name;
  if (body.page_url !== undefined) updates.pageUrl = body.page_url;
  if (body.viewport !== undefined) updates.viewport = JSON.stringify(body.viewport);
  if (body.screenshot_url !== undefined) updates.screenshotUrl = body.screenshot_url;

  await db.update(baselines).set(updates).where(eq(baselines.id, id));

  return c.json({
    data: { updated: true, updated_at: now },
    meta: { request_id: uuid(), timestamp: now },
  });
});

// DELETE /v1/baselines/:id - Delete a baseline and its visual diffs
baselineRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');

  const [existing] = await db.select().from(baselines).where(eq(baselines.id, id));
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Baseline not found' } }, 404);
  }

  await db.delete(ignoreRegions).where(eq(ignoreRegions.baselineId, id));
  await db.delete(visualDiffs).where(eq(visualDiffs.baselineId, id));
  await db.delete(baselines).where(eq(baselines.id, id));
  return c.json({
    data: { deleted: true },
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});
