CREATE TABLE `garment_recovery_schedule` (
	`request_id` text PRIMARY KEY NOT NULL,
	`claim_token` text,
	`claim_expires_at` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `garment_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `garment_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`request_key` text NOT NULL,
	`input_digest` text NOT NULL,
	`day` text NOT NULL,
	`ip_hash` text,
	`status` text DEFAULT 'accepted' NOT NULL,
	`created_at` integer NOT NULL,
	`upstream_job_id` text,
	`output_key` text,
	`error_code` text,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `garment_requests_owner_key_idx` ON `garment_requests` (`owner_id`,`request_key`);--> statement-breakpoint
CREATE INDEX `garment_requests_day_idx` ON `garment_requests` (`day`);--> statement-breakpoint
CREATE INDEX `garment_requests_owner_day_idx` ON `garment_requests` (`owner_id`,`day`);--> statement-breakpoint
CREATE INDEX `garment_requests_ip_day_idx` ON `garment_requests` (`ip_hash`,`day`);