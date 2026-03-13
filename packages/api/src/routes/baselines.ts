import { Hono } from 'hono';
import { db } from '../db';
import { baselines, visualDiffs } from '../db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

export const baselineRoutes = new Hono();

baselineRoutes.get('/', async (c) => {
  const result = await db.select().from(baselines).orderBy(baselines.createdAt);
  return c.json({
    data: result.map((b) => ({ ...b, viewport: JSON.parse(b.viewport) })),
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});

baselineRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const id = uuid();
  const now = new Date().toISOString();

  await db.insert(baselines).values({
    id,
    projectId: body.project_id || 'proj-default',
    name: body.name,
    pageUrl: body.page_url,
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

baselineRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  // Delete related visual diffs first to avoid foreign key constraint
  await db.delete(visualDiffs).where(eq(visualDiffs.baselineId, id));
  await db.delete(baselines).where(eq(baselines.id, id));
  return c.json({ data: { deleted: true }, meta: { request_id: uuid(), timestamp: new Date().toISOString() } });
});
