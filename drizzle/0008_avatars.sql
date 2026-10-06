ALTER TABLE `learners` ADD `avatar` text;--> statement-breakpoint
-- The default only fills existing rows; the app always sets a new Learner's colour itself.
ALTER TABLE `learners` ADD `color` text NOT NULL DEFAULT 'coral';--> statement-breakpoint
-- Existing Learners get the accent colours in palette order (ACCENT_COLORS), oldest first, so siblings differ.
UPDATE `learners` SET `color` = CASE (SELECT count(*) FROM `learners` AS `earlier` WHERE `earlier`.`id` < `learners`.`id`) % 8
  WHEN 0 THEN 'coral'
  WHEN 1 THEN 'amber'
  WHEN 2 THEN 'sun'
  WHEN 3 THEN 'mint'
  WHEN 4 THEN 'sky'
  WHEN 5 THEN 'indigo'
  WHEN 6 THEN 'violet'
  ELSE 'pink'
END;
