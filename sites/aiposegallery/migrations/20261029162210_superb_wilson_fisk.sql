ALTER TABLE `pose_requests` ADD `ip_hash` text;--> statement-breakpoint
CREATE INDEX `pose_requests_ip_day_idx` ON `pose_requests` (`ip_hash`,`day`);