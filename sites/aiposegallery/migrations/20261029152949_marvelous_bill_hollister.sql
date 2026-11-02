CREATE TABLE `pose_recovery_schedule` (
	`request_id` text PRIMARY KEY NOT NULL,
	`claim_token` text,
	`claim_expires_at` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `pose_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
