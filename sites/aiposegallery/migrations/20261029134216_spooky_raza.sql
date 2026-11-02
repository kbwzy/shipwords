CREATE TABLE `pose_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`request_key` text NOT NULL,
	`input_digest` text NOT NULL,
	`day` text NOT NULL,
	`status` text DEFAULT 'accepted' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pose_requests_owner_key_idx` ON `pose_requests` (`owner_id`,`request_key`);--> statement-breakpoint
CREATE INDEX `pose_requests_day_idx` ON `pose_requests` (`day`);--> statement-breakpoint
CREATE INDEX `pose_requests_owner_day_idx` ON `pose_requests` (`owner_id`,`day`);