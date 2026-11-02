ALTER TABLE `pose_requests` ADD `user_id` text;--> statement-breakpoint
CREATE INDEX `pose_requests_user_day_idx` ON `pose_requests` (`user_id`,`day`);
