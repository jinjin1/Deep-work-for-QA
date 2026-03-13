import { Hono } from 'hono';
import { db } from '../db';
import { sessions, sessionAnomalies, sessionBookmarks, sessionTags, bugReports } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { detectAnomalies } from '../lib/anomaly-detector';

export const sessionRoutes = new Hono();

// Helper to parse JSON fields safely
function safeJsonParse(val: string | null | undefined, fallback: unknown = []) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

// Helper to format session response
function formatSession(s: any, tags?: any[], bookmarks?: any[], anomalyRows?: any[]) {
  return {
    ...s,
    environment: safeJsonParse(s.environment, {}),
    anomalies: anomalyRows
      ? anomalyRows.map((a: any) => ({
          id: a.id,
          type: a.type,
          timestamp_start: a.timestampStart,
          timestamp_end: a.timestampEnd,
          severity: a.severity,
          description: a.description,
          related_events: safeJsonParse(a.relatedEvents),
        }))
      : safeJsonParse(s.anomalies),
    causal_chain: safeJsonParse(s.causalChain),
    console_logs: safeJsonParse(s.consoleLogs),
    network_logs: safeJsonParse(s.networkLogs),
    tags: tags || [],
    bookmarks: bookmarks || [],
  };
}

// GET /v1/sessions - List sessions with filters
sessionRoutes.get('/', async (c) => {
  const projectId = c.req.query('project_id');
  const hasAnomalies = c.req.query('has_anomalies');
  const tag = c.req.query('tag');
  const status = c.req.query('status');

  const conditions = [];
  if (projectId) conditions.push(eq(sessions.projectId, projectId));
  if (status) conditions.push(eq(sessions.status, status as any));

  const result = conditions.length > 0
    ? await db.select().from(sessions).where(and(...conditions)).orderBy(desc(sessions.createdAt))
    : await db.select().from(sessions).orderBy(desc(sessions.createdAt));

  // Fetch tags for all sessions
  const allTags = result.length > 0
    ? await db.select().from(sessionTags)
    : [];

  // Fetch anomalies
  const allAnomalies = result.length > 0
    ? await db.select().from(sessionAnomalies)
    : [];

  let formattedSessions = result.map(s => {
    const sTags = allTags.filter(t => t.sessionId === s.id);
    const sAnomalies = allAnomalies.filter(a => a.sessionId === s.id);
    return formatSession(s, sTags, undefined, sAnomalies);
  });

  // Filter by tag name
  if (tag) {
    formattedSessions = formattedSessions.filter(s =>
      s.tags.some((t: any) => t.name === tag)
    );
  }

  // Filter by anomaly presence
  if (hasAnomalies === 'true') {
    formattedSessions = formattedSessions.filter(s => s.anomalies.length > 0);
  } else if (hasAnomalies === 'false') {
    formattedSessions = formattedSessions.filter(s => s.anomalies.length === 0);
  }

  return c.json({
    data: formattedSessions,
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});

// GET /v1/sessions/:id - Session detail
sessionRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
  if (!session) return c.json({ error: { code: 'NOT_FOUND', message: 'Session not found' } }, 404);

  const tags = await db.select().from(sessionTags).where(eq(sessionTags.sessionId, id));
  const bookmarks = await db.select().from(sessionBookmarks).where(eq(sessionBookmarks.sessionId, id));
  const anomalyRows = await db.select().from(sessionAnomalies).where(eq(sessionAnomalies.sessionId, id));

  return c.json({
    data: formatSession(session, tags, bookmarks, anomalyRows),
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});

// POST /v1/sessions - Create session (recording start)
sessionRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const id = uuid();
  const now = new Date().toISOString();

  await db.insert(sessions).values({
    id,
    projectId: body.project_id || 'proj-default',
    userId: body.user_id || 'user-default',
    startUrl: body.start_url || '',
    environment: JSON.stringify(body.environment || {}),
    anomalies: '[]',
    consoleLogs: '[]',
    networkLogs: '[]',
    causalChain: '[]',
    status: 'recording',
    createdAt: now,
  });

  // Create tags if provided
  if (body.tags && Array.isArray(body.tags)) {
    for (const tagName of body.tags) {
      await db.insert(sessionTags).values({
        id: uuid(),
        sessionId: id,
        name: tagName,
      });
    }
  }

  return c.json({
    data: { id, status: 'recording', ai_analysis_status: 'pending', created_at: now },
    meta: { request_id: uuid(), timestamp: now },
  }, 201);
});

// PUT /v1/sessions/:id - Update session (recording stop, data upload)
sessionRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  const [existing] = await db.select().from(sessions).where(eq(sessions.id, id));
  if (!existing) return c.json({ error: { code: 'NOT_FOUND', message: 'Session not found' } }, 404);

  const updateData: Record<string, any> = {};

  if (body.duration_ms !== undefined) updateData.durationMs = body.duration_ms;
  if (body.page_count !== undefined) updateData.pageCount = body.page_count;
  if (body.event_count !== undefined) updateData.eventCount = body.event_count;
  if (body.events_url !== undefined) updateData.eventsUrl = body.events_url;
  if (body.events_data !== undefined) updateData.eventsData = JSON.stringify(body.events_data);
  if (body.console_logs !== undefined) updateData.consoleLogs = JSON.stringify(body.console_logs);
  if (body.network_logs !== undefined) updateData.networkLogs = JSON.stringify(body.network_logs);
  if (body.status !== undefined) updateData.status = body.status;

  // If session is being finalized, run anomaly detection
  if (body.status === 'ready' || body.events_data) {
    updateData.aiAnalysisStatus = 'processing';
    updateData.status = 'processing';
  }

  await db.update(sessions).set(updateData).where(eq(sessions.id, id));

  // Run anomaly detection if we have event data
  if (body.events_data || body.status === 'ready') {
    try {
      const events = body.events_data || safeJsonParse(existing.eventsData) || [];
      const consoleLogs = body.console_logs || safeJsonParse(existing.consoleLogs) || [];
      const networkLogs = body.network_logs || safeJsonParse(existing.networkLogs) || [];
      const duration = body.duration_ms || existing.durationMs || 0;

      const analysis = detectAnomalies(events, consoleLogs, networkLogs, duration);

      // Store anomalies in separate table
      for (const anomaly of analysis.anomalies) {
        await db.insert(sessionAnomalies).values({
          id: anomaly.id,
          sessionId: id,
          type: anomaly.type as any,
          timestampStart: anomaly.timestamp_start,
          timestampEnd: anomaly.timestamp_end,
          severity: anomaly.severity as any,
          description: anomaly.description,
          relatedEvents: JSON.stringify(anomaly.related_events),
          createdAt: new Date().toISOString(),
        });
      }

      // Update session with analysis results
      await db.update(sessions).set({
        anomalies: JSON.stringify(analysis.anomalies),
        sessionSummary: analysis.session_summary,
        causalChain: JSON.stringify(analysis.causal_chain),
        aiAnalysisStatus: 'completed',
        status: 'ready',
      }).where(eq(sessions.id, id));
    } catch (err) {
      console.error('[sessions] Anomaly detection failed:', err);
      await db.update(sessions).set({
        aiAnalysisStatus: 'failed',
        status: 'ready',
      }).where(eq(sessions.id, id));
    }
  }

  return c.json({
    data: { id, updated: true },
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});

// DELETE /v1/sessions/:id - Delete session
sessionRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const [existing] = await db.select().from(sessions).where(eq(sessions.id, id));
  if (!existing) return c.json({ error: { code: 'NOT_FOUND', message: 'Session not found' } }, 404);

  // Delete related data first
  await db.delete(sessionAnomalies).where(eq(sessionAnomalies.sessionId, id));
  await db.delete(sessionBookmarks).where(eq(sessionBookmarks.sessionId, id));
  await db.delete(sessionTags).where(eq(sessionTags.sessionId, id));
  await db.delete(sessions).where(eq(sessions.id, id));

  return c.json({
    data: { id, deleted: true },
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});

// POST /v1/sessions/:id/events/upload-url - Get upload URL for events
sessionRoutes.post('/:id/events/upload-url', async (c) => {
  const id = c.req.param('id');
  const [existing] = await db.select().from(sessions).where(eq(sessions.id, id));
  if (!existing) return c.json({ error: { code: 'NOT_FOUND', message: 'Session not found' } }, 404);

  // MVP: store events directly via PUT, return direct endpoint
  const uploadUrl = `http://localhost:3001/v1/sessions/${id}`;

  return c.json({
    data: { upload_url: uploadUrl, method: 'PUT', expires_in: 3600 },
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});

// GET /v1/sessions/:id/events - Get session events
sessionRoutes.get('/:id/events', async (c) => {
  const id = c.req.param('id');
  const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
  if (!session) return c.json({ error: { code: 'NOT_FOUND', message: 'Session not found' } }, 404);

  return c.json({
    data: {
      events: safeJsonParse(session.eventsData),
      console_logs: safeJsonParse(session.consoleLogs),
      network_logs: safeJsonParse(session.networkLogs),
    },
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});

// GET /v1/sessions/:id/anomalies - Get anomaly detection results
sessionRoutes.get('/:id/anomalies', async (c) => {
  const id = c.req.param('id');
  const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
  if (!session) return c.json({ error: { code: 'NOT_FOUND', message: 'Session not found' } }, 404);

  const anomalyRows = await db.select().from(sessionAnomalies).where(eq(sessionAnomalies.sessionId, id));

  return c.json({
    data: {
      session_id: id,
      ai_analysis_status: session.aiAnalysisStatus,
      anomalies: anomalyRows.map(a => ({
        id: a.id,
        type: a.type,
        timestamp_start: a.timestampStart,
        timestamp_end: a.timestampEnd,
        severity: a.severity,
        description: a.description,
        related_events: safeJsonParse(a.relatedEvents),
      })),
      session_summary: session.sessionSummary,
      causal_chain: safeJsonParse(session.causalChain),
    },
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});

// POST /v1/sessions/:id/bookmarks - Add bookmark
sessionRoutes.post('/:id/bookmarks', async (c) => {
  const sessionId = c.req.param('id');
  const body = await c.req.json();
  const id = uuid();
  const now = new Date().toISOString();

  const [existing] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
  if (!existing) return c.json({ error: { code: 'NOT_FOUND', message: 'Session not found' } }, 404);

  await db.insert(sessionBookmarks).values({
    id,
    sessionId,
    timestamp: body.timestamp || 0,
    label: body.label || null,
    createdBy: body.created_by || 'user-default',
    createdAt: now,
  });

  return c.json({
    data: { id, session_id: sessionId, timestamp: body.timestamp, label: body.label, created_at: now },
    meta: { request_id: uuid(), timestamp: now },
  }, 201);
});

// GET /v1/sessions/:id/bookmarks - List bookmarks
sessionRoutes.get('/:id/bookmarks', async (c) => {
  const sessionId = c.req.param('id');
  const bookmarks = await db.select().from(sessionBookmarks).where(eq(sessionBookmarks.sessionId, sessionId));

  return c.json({
    data: bookmarks,
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});

// POST /v1/sessions/:id/tags - Add tag
sessionRoutes.post('/:id/tags', async (c) => {
  const sessionId = c.req.param('id');
  const body = await c.req.json();
  const id = uuid();

  const [existing] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
  if (!existing) return c.json({ error: { code: 'NOT_FOUND', message: 'Session not found' } }, 404);

  await db.insert(sessionTags).values({
    id,
    sessionId,
    name: body.name,
  });

  return c.json({
    data: { id, session_id: sessionId, name: body.name },
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  }, 201);
});

// DELETE /v1/sessions/:id/tags/:tag_id - Remove tag
sessionRoutes.delete('/:id/tags/:tag_id', async (c) => {
  const tagId = c.req.param('tag_id');

  await db.delete(sessionTags).where(eq(sessionTags.id, tagId));

  return c.json({
    data: { id: tagId, deleted: true },
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});

// POST /v1/sessions/:id/bug-report - Create bug report from session (UC1 integration)
sessionRoutes.post('/:id/bug-report', async (c) => {
  const sessionId = c.req.param('id');
  const body = await c.req.json();

  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
  if (!session) return c.json({ error: { code: 'NOT_FOUND', message: 'Session not found' } }, 404);

  const bugReportId = uuid();
  const now = new Date().toISOString();

  // Get anomaly details if anomaly_id provided
  let description = body.description || '';
  if (body.anomaly_id) {
    const [anomaly] = await db.select().from(sessionAnomalies)
      .where(eq(sessionAnomalies.id, body.anomaly_id));
    if (anomaly) {
      description = description || anomaly.description;
    }
  }

  await db.insert(bugReports).values({
    id: bugReportId,
    projectId: session.projectId,
    reporterId: session.userId,
    title: body.title || 'Bug from session replay',
    description,
    severity: body.severity || 'major',
    status: 'open',
    pageUrl: session.startUrl,
    environment: session.environment,
    consoleLogs: session.consoleLogs || '[]',
    networkLogs: session.networkLogs || '[]',
    sessionId,
    screenshotUrls: '[]',
    createdAt: now,
    updatedAt: now,
  });

  return c.json({
    data: {
      bug_report_id: bugReportId,
      session_id: sessionId,
      created_at: now,
    },
    meta: { request_id: uuid(), timestamp: now },
  }, 201);
});

// GET /v1/sessions/:id/share-link - Generate share link
sessionRoutes.get('/:id/share-link', async (c) => {
  const id = c.req.param('id');
  const t = c.req.query('t');

  const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
  if (!session) return c.json({ error: { code: 'NOT_FOUND', message: 'Session not found' } }, 404);

  const baseUrl = process.env.WEB_URL || 'http://localhost:3000';
  let shareUrl = `${baseUrl}/sessions/${id}/replay`;
  if (t) shareUrl += `?t=${t}`;

  return c.json({
    data: { url: shareUrl, session_id: id, expires_in: null },
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});
