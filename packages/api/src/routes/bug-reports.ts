import { Hono } from 'hono';
import { db } from '../db';
import { bugReports } from '../db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { generateMockReproSteps } from './ai';

export const bugReportRoutes = new Hono();

/** Parse a JSON column value safely, returning fallback on failure. */
function safeJsonParse(value: string | null | undefined, fallback: unknown = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** Transform a raw DB row into an API-friendly object. */
function formatReport(r: typeof bugReports.$inferSelect) {
  return {
    ...r,
    environment: safeJsonParse(r.environment, {}),
    consoleLogs: safeJsonParse(r.consoleLogs, []),
    networkLogs: safeJsonParse(r.networkLogs, []),
    reproSteps: safeJsonParse(r.reproSteps, null),
    screenshotUrls: safeJsonParse(r.screenshotUrls, []),
  };
}

// List bug reports (with pagination)
bugReportRoutes.get('/', async (c) => {
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 20));
  const offset = (page - 1) * limit;

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(bugReports);

  // Get paginated results (newest first)
  const reports = await db
    .select()
    .from(bugReports)
    .orderBy(desc(bugReports.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    data: reports.map(formatReport),
    meta: {
      request_id: uuid(),
      timestamp: new Date().toISOString(),
      page,
      limit,
      total: Number(count),
      total_pages: Math.ceil(Number(count) / limit),
    },
  });
});

// Get single bug report
bugReportRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const [report] = await db.select().from(bugReports).where(eq(bugReports.id, id));
  if (!report) return c.json({ error: { code: 'NOT_FOUND', message: 'Bug report not found' } }, 404);
  return c.json({
    data: formatReport(report),
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});

// Create bug report
bugReportRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const id = uuid();
  const now = new Date().toISOString();

  const report = {
    id,
    projectId: body.project_id || 'proj-default',
    reporterId: body.reporter_id || 'user-default',
    title: body.title || 'Untitled Bug Report',
    description: body.description || null,
    severity: body.severity || 'major',
    status: 'open' as const,
    pageUrl: body.page_url || '',
    environment: JSON.stringify(body.environment || {}),
    consoleLogs: JSON.stringify(body.console_logs || []),
    networkLogs: JSON.stringify(body.network_logs || []),
    reproSteps: null,
    aiSummary: null,
    recordingUrl: body.recording_url || null,
    screenshotUrls: JSON.stringify(body.screenshot_urls || []),
    sessionId: body.session_id || null,
    visualDiffId: null,
    linearIssueId: null,
    linearIssueUrl: null,
    aiAnalysisStatus: 'pending' as const,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(bugReports).values(report);

  // Fire-and-forget: trigger mock AI analysis asynchronously
  triggerAiAnalysis(id, body.events || [], body.console_logs || []).catch((err) => {
    console.error(`[ai] Failed to run AI analysis for bug report ${id}:`, err);
  });

  // Return the full bug report data
  return c.json({
    data: formatReport({
      ...report,
      reproSteps: report.reproSteps as string | null,
    } as typeof bugReports.$inferSelect),
    meta: { request_id: uuid(), timestamp: now },
  }, 201);
});

// Update bug report
bugReportRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const now = new Date().toISOString();

  await db.update(bugReports).set({
    title: body.title,
    description: body.description,
    severity: body.severity,
    status: body.status,
    updatedAt: now,
  }).where(eq(bugReports.id, id));

  return c.json({
    data: { id, updated_at: now },
    meta: { request_id: uuid(), timestamp: now },
  });
});

// Delete bug report
bugReportRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await db.delete(bugReports).where(eq(bugReports.id, id));
  return c.json({ data: { deleted: true }, meta: { request_id: uuid(), timestamp: new Date().toISOString() } });
});

/**
 * Trigger mock AI analysis asynchronously.
 * Generates reproduction steps from recorded events and updates the bug report.
 */
async function triggerAiAnalysis(
  bugReportId: string,
  events: unknown[],
  consoleLogs: unknown[],
) {
  try {
    // Mark as processing
    await db
      .update(bugReports)
      .set({ aiAnalysisStatus: 'processing', updatedAt: new Date().toISOString() })
      .where(eq(bugReports.id, bugReportId));

    // Generate mock repro steps
    const result = generateMockReproSteps(events as any[]);

    // Update bug report with AI analysis results
    await db
      .update(bugReports)
      .set({
        reproSteps: JSON.stringify(result.steps),
        aiSummary: result.summary,
        aiAnalysisStatus: 'completed',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(bugReports.id, bugReportId));

    console.log(`[ai] Analysis completed for bug report ${bugReportId}: ${result.steps.length} steps generated.`);
  } catch (err) {
    // Mark as failed
    await db
      .update(bugReports)
      .set({ aiAnalysisStatus: 'failed', updatedAt: new Date().toISOString() })
      .where(eq(bugReports.id, bugReportId));

    console.error(`[ai] Analysis failed for bug report ${bugReportId}:`, err);
  }
}
