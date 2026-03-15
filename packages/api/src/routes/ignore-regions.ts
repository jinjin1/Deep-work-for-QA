import { Hono } from 'hono';
import { db } from '../db';
import { ignoreRegions, baselines } from '../db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

export const ignoreRegionRoutes = new Hono();

// GET /v1/baselines/:baselineId/ignore-regions - List ignore regions for a baseline
ignoreRegionRoutes.get('/:baselineId/ignore-regions', async (c) => {
  const baselineId = c.req.param('baselineId');

  // Verify baseline exists
  const [baseline] = await db.select().from(baselines).where(eq(baselines.id, baselineId));
  if (!baseline) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Baseline not found' } }, 404);
  }

  const result = await db.select().from(ignoreRegions).where(eq(ignoreRegions.baselineId, baselineId));

  return c.json({
    data: result.map((r) => ({
      id: r.id,
      baseline_id: r.baselineId,
      region: JSON.parse(r.region),
      reason: r.reason,
      created_at: r.createdAt,
    })),
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});

// POST /v1/baselines/:baselineId/ignore-regions - Add an ignore region
ignoreRegionRoutes.post('/:baselineId/ignore-regions', async (c) => {
  const baselineId = c.req.param('baselineId');

  // Verify baseline exists
  const [baseline] = await db.select().from(baselines).where(eq(baselines.id, baselineId));
  if (!baseline) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Baseline not found' } }, 404);
  }

  const body = await c.req.json();

  if (!body.region || typeof body.region !== 'object') {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'region is required (object with x, y, width, height)' } }, 400);
  }
  const { x, y, width, height } = body.region;
  if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'region must have numeric x, y, width, height' } }, 400);
  }

  const id = uuid();
  const now = new Date().toISOString();

  await db.insert(ignoreRegions).values({
    id,
    baselineId,
    region: JSON.stringify(body.region),
    reason: body.reason || null,
    createdAt: now,
  });

  return c.json({
    data: { id, baseline_id: baselineId, region: body.region, reason: body.reason || null, created_at: now },
    meta: { request_id: uuid(), timestamp: now },
  }, 201);
});

// DELETE /v1/baselines/:baselineId/ignore-regions/:regionId - Delete an ignore region
ignoreRegionRoutes.delete('/:baselineId/ignore-regions/:regionId', async (c) => {
  const baselineId = c.req.param('baselineId');
  const regionId = c.req.param('regionId');

  const [existing] = await db.select().from(ignoreRegions)
    .where(eq(ignoreRegions.id, regionId));

  if (!existing || existing.baselineId !== baselineId) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Ignore region not found' } }, 404);
  }

  await db.delete(ignoreRegions).where(eq(ignoreRegions.id, regionId));

  return c.json({
    data: { deleted: true },
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});
