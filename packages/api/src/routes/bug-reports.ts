import { Hono } from 'hono';
import { db } from '../db/index.js';
import { bugReports } from '../db/schema.js';
import { eq, desc, sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { generateMockReproSteps } from './ai.js';
import { processScreenshotUrls, deleteUploadedFile } from './uploads.js';

export const bugReportRoutes = new Hono();

// --- Zod schemas for input validation ---

const createBugReportSchema = z.object({
  project_id: z.string().max(100).optional(),
  reporter_id: z.string().max(100).optional(),
  title: z.string().min(1).max(500).default('Untitled Bug Report'),
  description: z.string().max(10_000).nullable().optional(),
  severity: z.enum(['critical', 'major', 'minor', 'trivial']).default('major'),
  page_url: z.string().max(2000).default(''),
  environment: z.record(z.unknown()).default({}),
  console_logs: z.array(z.unknown()).max(500).default([]),
  network_logs: z.array(z.unknown()).max(500).default([]),
  events: z.array(z.unknown()).max(1000).default([]),
  screenshot_urls: z.array(z.string().max(5_000_000)).max(10).default([]),
  recording_url: z.string().max(2000).nullable().optional(),
  session_id: z.string().max(100).nullable().optional(),
});

const updateBugReportSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10_000).nullable().optional(),
  severity: z.enum(['critical', 'major', 'minor', 'trivial']).optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
});

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
  const rawBody = await c.req.json();
  const parsed = createBugReportSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    }, 400);
  }
  const body = parsed.data;

  const id = uuid();
  const now = new Date().toISOString();

  const report = {
    id,
    projectId: body.project_id || 'proj-default',
    reporterId: body.reporter_id || 'user-default',
    title: body.title,
    description: body.description || null,
    severity: body.severity,
    status: 'open' as const,
    pageUrl: body.page_url,
    environment: JSON.stringify(body.environment),
    consoleLogs: JSON.stringify(body.console_logs),
    networkLogs: JSON.stringify(body.network_logs),
    reproSteps: null,
    aiSummary: null,
    recordingUrl: body.recording_url || null,
    screenshotUrls: JSON.stringify(processScreenshotUrls(body.screenshot_urls)),
    sessionId: body.session_id || null,
    linearIssueId: null,
    linearIssueUrl: null,
    aiAnalysisStatus: 'pending' as const,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(bugReports).values(report);

  // Fire-and-forget: trigger mock AI analysis asynchronously
  triggerAiAnalysis(id, body.events, body.console_logs).catch((err) => {
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
  const rawBody = await c.req.json();
  const parsed = updateBugReportSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    }, 400);
  }
  const body = parsed.data;
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

// Delete bug report — also cleans up uploaded files
bugReportRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');

  // Fetch report to get screenshot URLs before deleting
  const [report] = await db.select().from(bugReports).where(eq(bugReports.id, id));
  if (report) {
    const screenshotUrls = safeJsonParse(report.screenshotUrls, []) as string[];
    for (const url of screenshotUrls) {
      if (url.startsWith('/uploads/')) {
        const filename = url.replace('/uploads/', '');
        deleteUploadedFile(filename);
      }
    }
  }

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
