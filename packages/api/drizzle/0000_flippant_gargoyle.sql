CREATE TABLE `baselines` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`page_url` text NOT NULL,
	`viewport` text NOT NULL,
	`screenshot_url` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bug_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`reporter_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`severity` text DEFAULT 'major' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`page_url` text NOT NULL,
	`environment` text NOT NULL,
	`console_logs` text DEFAULT '[]' NOT NULL,
	`network_logs` text DEFAULT '[]' NOT NULL,
	`repro_steps` text,
	`ai_summary` text,
	`recording_url` text,
	`screenshot_urls` text DEFAULT '[]' NOT NULL,
	`session_id` text,
	`visual_diff_id` text,
	`linear_issue_id` text,
	`linear_issue_url` text,
	`ai_analysis_status` text DEFAULT 'pending',
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_slug_unique` ON `organizations` (`slug`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`url_patterns` text DEFAULT '[]' NOT NULL,
	`linear_team_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`start_url` text NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`page_count` integer DEFAULT 0 NOT NULL,
	`event_count` integer DEFAULT 0 NOT NULL,
	`environment` text NOT NULL,
	`events_url` text,
	`events_data` text,
	`console_logs` text DEFAULT '[]' NOT NULL,
	`network_logs` text DEFAULT '[]' NOT NULL,
	`anomalies` text DEFAULT '[]' NOT NULL,
	`ai_analysis_status` text DEFAULT 'pending',
	`session_summary` text,
	`causal_chain` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'recording' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `session_anomalies` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`type` text NOT NULL,
	`timestamp_start` integer NOT NULL,
	`timestamp_end` integer NOT NULL,
	`severity` text NOT NULL,
	`description` text NOT NULL,
	`related_events` text DEFAULT '[]' NOT NULL,
	`screenshot_url` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `session_bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`timestamp` integer NOT NULL,
	`label` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `session_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`avatar_url` text,
	`linear_user_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `visual_diffs` (
	`id` text PRIMARY KEY NOT NULL,
	`baseline_id` text NOT NULL,
	`project_id` text NOT NULL,
	`current_screenshot_url` text NOT NULL,
	`diff_image_url` text,
	`changes` text DEFAULT '[]' NOT NULL,
	`overall_status` text DEFAULT 'no_change',
	`ai_analysis_status` text DEFAULT 'pending',
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`baseline_id`) REFERENCES `baselines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
