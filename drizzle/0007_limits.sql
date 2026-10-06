ALTER TABLE `settings` ADD `daily_token_cap` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `break_minutes` integer DEFAULT 25 NOT NULL;