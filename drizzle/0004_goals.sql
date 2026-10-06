CREATE TABLE `goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`learner_id` integer NOT NULL,
	`subject_key` text NOT NULL,
	`curriculum_key` text NOT NULL,
	`kind` text NOT NULL,
	`position` integer NOT NULL,
	`target_date` text NOT NULL,
	`status` text NOT NULL,
	FOREIGN KEY (`learner_id`) REFERENCES `learners`(`id`) ON UPDATE no action ON DELETE cascade
);
