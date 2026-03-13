import { Hono } from 'hono';
import { db } from '../db';
import { visualDiffs } from '../db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

export const visualDiffRoutes = new Hono();

visualDiffRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const [diff] = await db.select().from(visualDiffs).where(eq(visualDiffs.id, id));
  if (!diff) return c.json({ error: { code: 'NOT_FOUND', message: 'Visual diff not found' } }, 404);
  return c.json({
    data: { ...diff, changes: JSON.parse(diff.changes) },
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});

visualDiffRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const id = uuid();
  const now = new Date().toISOString();

  await db.insert(visualDiffs).values({
    id,
    baselineId: body.baseline_id,
    projectId: body.project_id || 'proj-default',
    currentScreenshotUrl: body.current_screenshot_url || '',
    changes: '[]',
    createdBy: body.created_by || 'user-default',
    createdAt: now,
  });

  return c.json({
    data: { id, ai_analysis_status: 'pending', created_at: now },
    meta: { request_id: uuid(), timestamp: now },
  }, 201);
});

visualDiffRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await db.delete(visualDiffs).where(eq(visualDiffs.id, id));
  return c.json({
    data: { deleted: true },
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});
