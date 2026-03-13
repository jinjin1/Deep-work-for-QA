import { Hono } from 'hono';
import { db } from '../db';
import { baselines, visualDiffs } from '../db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

export const baselineRoutes = new Hono();

// GET /v1/baselines - List all baselines
baselineRoutes.get('/', async (c) => {
  const result = await db.select().from(baselines).orderBy(baselines.createdAt);
  return c.json({
    data: result.map((b) => ({
      ...b,
      viewport: JSON.parse(b.viewport),
      page_url: b.pageUrl,
      screenshot_url: b.screenshotUrl,
      created_by: b.createdBy,
      created_at: b.createdAt,
      updated_at: b.updatedAt,
    })),
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
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
    data: {
      ...baseline,
      viewport: JSON.parse(baseline.viewport),
      page_url: baseline.pageUrl,
      screenshot_url: baseline.screenshotUrl,
      created_by: baseline.createdBy,
      created_at: baseline.createdAt,
      updated_at: baseline.updatedAt,
    },
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});

// POST /v1/baselines - Create a baseline
baselineRoutes.post('/', async (c) => {
  const body = await c.req.json();
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
  await db.delete(visualDiffs).where(eq(visualDiffs.baselineId, id));
  await db.delete(baselines).where(eq(baselines.id, id));
  return c.json({
    data: { deleted: true },
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});
