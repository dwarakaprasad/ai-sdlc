CREATE TABLE `logins` (
	`token` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `parent_credential` (
	`id` integer PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL
);
