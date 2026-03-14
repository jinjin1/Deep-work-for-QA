import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
