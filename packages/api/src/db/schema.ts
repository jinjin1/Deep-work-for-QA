import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: text('plan', { enum: ['free', 'pro', 'enterprise'] }).notNull().default('free'),
  createdAt: text('created_at').notNull(),
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  urlPatterns: text('url_patterns').notNull().default('[]'), // JSON array
  linearTeamId: text('linear_team_id'),
  createdAt: text('created_at').notNull(),
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role', { enum: ['admin', 'member', 'viewer'] }).notNull().default('member'),
  avatarUrl: text('avatar_url'),
  linearUserId: text('linear_user_id'),
  createdAt: text('created_at').notNull(),
});

export const bugReports = sqliteTable('bug_reports', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  reporterId: text('reporter_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  description: text('description'),
  severity: text('severity', { enum: ['critical', 'major', 'minor', 'trivial'] }).notNull().default('major'),
  status: text('status', { enum: ['open', 'in_progress', 'resolved', 'closed'] }).notNull().default('open'),
  pageUrl: text('page_url').notNull(),
  environment: text('environment').notNull(), // JSON
  consoleLogs: text('console_logs').notNull().default('[]'), // JSON
  networkLogs: text('network_logs').notNull().default('[]'), // JSON
  reproSteps: text('repro_steps'), // JSON, nullable (AI generated)
  aiSummary: text('ai_summary'),
  recordingUrl: text('recording_url'),
  screenshotUrls: text('screenshot_urls').notNull().default('[]'), // JSON
  sessionId: text('session_id'),
  visualDiffId: text('visual_diff_id'),
  linearIssueId: text('linear_issue_id'),
  linearIssueUrl: text('linear_issue_url'),
  aiAnalysisStatus: text('ai_analysis_status', { enum: ['pending', 'processing', 'completed', 'failed'] }).default('pending'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  userId: text('user_id').notNull().references(() => users.id),
  startUrl: text('start_url').notNull(),
  durationMs: integer('duration_ms').notNull().default(0),
  pageCount: integer('page_count').notNull().default(0),
  eventCount: integer('event_count').notNull().default(0),
  environment: text('environment').notNull(), // JSON
  eventsUrl: text('events_url'),
  eventsData: text('events_data'), // JSON - stored event data for replay
  consoleLogs: text('console_logs').notNull().default('[]'), // JSON
  networkLogs: text('network_logs').notNull().default('[]'), // JSON
  anomalies: text('anomalies').notNull().default('[]'), // JSON
  aiAnalysisStatus: text('ai_analysis_status', { enum: ['pending', 'processing', 'completed', 'failed'] }).default('pending'),
  sessionSummary: text('session_summary'),
  causalChain: text('causal_chain').notNull().default('[]'), // JSON
  status: text('status', { enum: ['recording', 'uploading', 'processing', 'ready', 'failed'] }).notNull().default('recording'),
  createdAt: text('created_at').notNull(),
});

export const sessionAnomalies = sqliteTable('session_anomalies', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  type: text('type', { enum: ['error', 'rage_click', 'dead_click', 'long_wait', 'unexpected_nav', 'network_error'] }).notNull(),
  timestampStart: integer('timestamp_start').notNull(),
  timestampEnd: integer('timestamp_end').notNull(),
  severity: text('severity', { enum: ['high', 'medium', 'low'] }).notNull(),
  description: text('description').notNull(),
  relatedEvents: text('related_events').notNull().default('[]'), // JSON
  screenshotUrl: text('screenshot_url'),
  createdAt: text('created_at').notNull(),
});

export const sessionBookmarks = sqliteTable('session_bookmarks', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  timestamp: integer('timestamp').notNull(),
  label: text('label'),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull(),
});

export const sessionTags = sqliteTable('session_tags', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  name: text('name').notNull(),
});

export const baselines = sqliteTable('baselines', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
  pageUrl: text('page_url').notNull(),
  viewport: text('viewport').notNull(), // JSON { width, height }
  screenshotUrl: text('screenshot_url').notNull(),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const visualDiffs = sqliteTable('visual_diffs', {
  id: text('id').primaryKey(),
  baselineId: text('baseline_id').notNull().references(() => baselines.id),
  projectId: text('project_id').notNull().references(() => projects.id),
  currentScreenshotUrl: text('current_screenshot_url').notNull(),
  diffImageUrl: text('diff_image_url'),
  changes: text('changes').notNull().default('[]'), // JSON
  overallStatus: text('overall_status', { enum: ['no_change', 'intentional', 'regression', 'mixed'] }).default('no_change'),
  aiAnalysisStatus: text('ai_analysis_status', { enum: ['pending', 'processing', 'completed', 'failed'] }).default('pending'),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull(),
});
