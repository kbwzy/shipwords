import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// A durable admission record, independent of browser retries and Worker instances.
export const garmentRequests = sqliteTable('garment_requests', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  requestKey: text('request_key').notNull(),
  inputDigest: text('input_digest').notNull(),
  day: text('day').notNull(),
  // Nullable for rows created before the IP-prefix quota was introduced.
  ipHash: text('ip_hash'),
  status: text('status', { enum: ['accepted', 'preparing', 'quoted', 'submitting', 'submitted', 'result_pending', 'succeeded', 'failed', 'unknown'] }).notNull().default('accepted'),
  createdAt: integer('created_at').notNull(),
  // Set for signed-in users so paid work survives guest-cookie rotation; null for guest trials.
  userId: text('user_id'),
  upstreamJobId: text('upstream_job_id'),
  outputKey: text('output_key'),
  errorCode: text('error_code'),
  updatedAt: integer('updated_at'),
}, (table) => [
  uniqueIndex('garment_requests_owner_key_idx').on(table.ownerId, table.requestKey),
  index('garment_requests_day_idx').on(table.day),
  index('garment_requests_owner_day_idx').on(table.ownerId, table.day),
  index('garment_requests_ip_day_idx').on(table.ipHash, table.day),
]);

// Claims are leases: stale workers may still finish, so all completion writes are
// fenced by claimToken and recovery must only perform safe known-ID operations.
export const garmentRecoverySchedule = sqliteTable('garment_recovery_schedule', {
  requestId: text('request_id').primaryKey().references(() => garmentRequests.id, { onDelete: 'cascade' }),
  claimToken: text('claim_token'),
  claimExpiresAt: integer('claim_expires_at').notNull().default(0),
  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: integer('next_attempt_at').notNull().default(0),
});
