CREATE TABLE `learners` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`grade` text NOT NULL,
	`curriculum_id` text NOT NULL,
	`pin_hash` text
);
--> statement-breakpoint
-- Recreated rather than altered so learner_id gets ON DELETE CASCADE; this logs everyone out once.
DROP TABLE `logins`;
--> statement-breakpoint
CREATE TABLE `logins` (
	`token` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`learner_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`learner_id`) REFERENCES `learners`(`id`) ON UPDATE no action ON DELETE cascade
);
