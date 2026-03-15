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
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);