import { recoverPoseWorkflow, type PoseWorkflowDependencies } from './pose-workflow.server.ts';
import { poseLedger } from './pose-billing.server.ts';

export const POSE_RECOVERY_MIN_COOLDOWN_MS = 5 * 60 * 1000;
export const POSE_RECOVERY_LEASE_MS = 30 * 60 * 1000;
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000;
const MAX_BATCH = 10;
const eligible = `(status IN ('submitted','result_pending') AND upstream_job_id IS NOT NULL AND upstream_job_id != '' AND (error_code IS NULL OR error_code IN ('workflow_poll_exhausted','workflow_retry_exhausted')))`;
const refundable = `pose_requests.status = 'failed' AND pose_requests.upstream_job_id IS NULL
  AND pose_requests.error_code IN ('multi_person_prompt_blocked','prompt_screening_unavailable','prompt_blocked','prompt_review_required','quote_unavailable_or_over_budget','quote_expired_or_invalid','workflow_pre_submit_failed')
  AND EXISTS (SELECT 1 FROM credit_ledger l WHERE l.idem_key = 'spend:pose:task:' || pose_requests.id
    AND l.user_id = pose_requests.user_id AND l.kind = 'spend' AND l.delta = -1 AND l.ref = 'pose-image')
  AND NOT EXISTS (SELECT 1 FROM credit_ledger r WHERE r.idem_key = 'refund:pose:task:' || pose_requests.id)`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const terminalWorkflowStates = new Set(['complete', 'errored', 'terminated']);

type Candidate = { id: string; error_code: string | null };
type Claim = { attempts: number };
/** Pass the same Workflow binding used to create the instance with ID equal to the pose request ID. */
export type PoseRecoveryWorkflowBinding = {
  get(id: string): Promise<{ status(): Promise<{ status: string }> }>;
  create?(options: { id: string; params: { jobId: string } }): Promise<unknown>;
};

function clock(deps: { now?: () => number }): number {
  const time = (deps.now ?? Date.now)();
  if (!Number.isSafeInteger(time) || time < 0 || time > Number.MAX_SAFE_INTEGER - MAX_BACKOFF_MS) throw new Error('Invalid recovery clock');
  return time;
}

/** Retry only durable pre-submit failures with a matching task-scoped charge. */
export async function schedulePoseRefunds(db: D1Database, options: { now?: () => number } = {}): Promise<void> {
  for (let scans = 0; scans < MAX_BATCH; scans++) {
    const now = clock(options), cutoff = now - POSE_RECOVERY_MIN_COOLDOWN_MS;
    const candidate = await db.prepare(`SELECT pose_requests.id, pose_requests.request_key FROM pose_requests
      LEFT JOIN pose_recovery_schedule s ON s.request_id = pose_requests.id
      WHERE ${refundable} AND COALESCE(pose_requests.updated_at, pose_requests.created_at) <= ?
      AND (s.request_id IS NULL OR (s.next_attempt_at <= ? AND (s.claim_token IS NULL OR s.claim_expires_at <= ?)))
      ORDER BY COALESCE(pose_requests.updated_at, pose_requests.created_at), pose_requests.id LIMIT 1`)
      .bind(cutoff, now, now).first<{id:string; request_key:string}>();
    if (!candidate) break;
    const token = crypto.randomUUID();
    const claim = await db.prepare(`INSERT INTO pose_recovery_schedule (request_id, claim_token, claim_expires_at, attempts, next_attempt_at)
      SELECT id, ?, ?, 1, 0 FROM pose_requests WHERE id = ? AND ${refundable} AND COALESCE(updated_at, created_at) <= ?
      ON CONFLICT(request_id) DO UPDATE SET claim_token = excluded.claim_token, claim_expires_at = excluded.claim_expires_at,
        attempts = MIN(pose_recovery_schedule.attempts + 1, 32)
      WHERE pose_recovery_schedule.next_attempt_at <= ? AND (pose_recovery_schedule.claim_token IS NULL OR pose_recovery_schedule.claim_expires_at <= ?)
      RETURNING attempts`).bind(token, now + POSE_RECOVERY_LEASE_MS, candidate.id, cutoff, now, now).first<Claim>();
    if (!claim) continue;
    try {
      const current = UUID.test(candidate.id) && await db.prepare(`SELECT pose_requests.id FROM pose_requests WHERE pose_requests.id = ? AND ${refundable}
        AND EXISTS (SELECT 1 FROM pose_recovery_schedule WHERE request_id = ? AND claim_token = ? AND claim_expires_at > ?)`)
        .bind(candidate.id, candidate.id, token, clock(options)).first();
      if (current) await poseLedger(db).refund(candidate.request_key, candidate.id);
      const delay = Math.min(MAX_BACKOFF_MS, POSE_RECOVERY_MIN_COOLDOWN_MS * 2 ** Math.min(claim.attempts - 1, 16));
      await db.prepare('UPDATE pose_recovery_schedule SET claim_token = NULL, claim_expires_at = 0, next_attempt_at = ? WHERE request_id = ? AND claim_token = ?')
        .bind(Math.max(now, clock(options)) + delay, candidate.id, token).run();
    } catch { /* An uncertain outcome is retried after the lease expires. */ }
  }
}

/**
 * Call from a scheduled handler after applying the migration. The original Workflow
 * must not be restarted while recovery is enabled: terminal status is checked per
 * attempt, but an administrator can otherwise restart it after that check.
 * Expired claims are safe to reclaim: recovery only reads a known upstream ID
 * and uses first-writer-wins storage. Accepted tasks require manual reconciliation.
 * Fenced writes cannot release a newer claim.
 */
export async function schedulePoseRecoveries(deps: PoseWorkflowDependencies, options: { workflow: PoseRecoveryWorkflowBinding; limit?: number }): Promise<{ attempted: number; locked: number }> {
  const limit = options.limit ?? MAX_BATCH;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_BATCH) throw new Error('Invalid recovery batch limit');
  if (!options.workflow || typeof options.workflow.get !== 'function') throw new Error('Pose Workflow binding required');
  let attempted = 0;
  let locked = 0;
  for (let scans = 0; attempted < limit && scans < MAX_BATCH * 4; scans++) {
    const now = clock(deps);
    const cutoff = now - POSE_RECOVERY_MIN_COOLDOWN_MS;
    const candidate = await deps.db.prepare(`SELECT pose_requests.id, pose_requests.error_code FROM pose_requests
      LEFT JOIN pose_recovery_schedule s ON s.request_id = pose_requests.id
      WHERE ${eligible} AND COALESCE(pose_requests.updated_at, pose_requests.created_at) <= ?
        AND (s.request_id IS NULL OR (s.next_attempt_at <= ? AND (s.claim_token IS NULL OR s.claim_expires_at <= ?)))
      ORDER BY COALESCE(pose_requests.updated_at, pose_requests.created_at), pose_requests.id LIMIT 1`).bind(cutoff, now, now).first<Candidate>();
    if (!candidate) break;
    const token = crypto.randomUUID();
    const claim = await deps.db.prepare(`INSERT INTO pose_recovery_schedule (request_id, claim_token, claim_expires_at, attempts, next_attempt_at)
      SELECT id, ?, ?, 1, 0 FROM pose_requests WHERE id = ? AND ${eligible} AND COALESCE(updated_at, created_at) <= ?
      ON CONFLICT(request_id) DO UPDATE SET claim_token = excluded.claim_token, claim_expires_at = excluded.claim_expires_at,
        attempts = MIN(pose_recovery_schedule.attempts + 1, 32)
      WHERE pose_recovery_schedule.next_attempt_at <= ? AND (pose_recovery_schedule.claim_token IS NULL OR pose_recovery_schedule.claim_expires_at <= ?)
      RETURNING attempts`).bind(token, now + POSE_RECOVERY_LEASE_MS, candidate.id, cutoff, now, now).first<Claim>();
    if (!claim) continue;
    try {
      // A D1 exhaustion marker is written just before Workflow completion. It does
      // not by itself prove that an earlier step is no longer running.
      let terminal = false;
      try { terminal = terminalWorkflowStates.has((await (await options.workflow.get(candidate.id)).status()).status); } catch { /* fail closed */ }
      if (!terminal) {
        await deps.db.prepare('UPDATE pose_recovery_schedule SET claim_token = NULL, claim_expires_at = 0, next_attempt_at = ? WHERE request_id = ? AND claim_token = ?')
          .bind(Math.max(now, clock(deps)) + POSE_RECOVERY_MIN_COOLDOWN_MS, candidate.id, token).run();
        continue;
      }
      const current = await deps.db.prepare(`SELECT id, error_code FROM pose_requests WHERE id = ? AND ${eligible} AND COALESCE(updated_at, created_at) <= ?
        AND EXISTS (SELECT 1 FROM pose_recovery_schedule WHERE request_id = ? AND claim_token = ? AND claim_expires_at > ?)` )
        .bind(candidate.id, cutoff, candidate.id, token, clock(deps)).first<Candidate>();
      if (!current) {
        await deps.db.prepare('UPDATE pose_recovery_schedule SET claim_token = NULL, claim_expires_at = 0 WHERE request_id = ? AND claim_token = ?').bind(candidate.id, token).run();
        continue;
      }
      attempted++;
      const result = await recoverPoseWorkflow(deps, candidate.id);
      const finished = Math.max(now, clock(deps));
      const delay = Math.min(MAX_BACKOFF_MS, POSE_RECOVERY_MIN_COOLDOWN_MS * 2 ** Math.min(claim.attempts - 1, 16));
      await deps.db.batch([
        deps.db.prepare(`UPDATE pose_requests SET error_code = ? WHERE id = ? AND status = ? AND error_code IS NULL
          AND ? = 'retry' AND status IN ('submitted','result_pending')
          AND EXISTS (SELECT 1 FROM pose_recovery_schedule WHERE request_id = ? AND claim_token = ?)`)
          .bind(current.error_code, candidate.id, result.status, result.action, candidate.id, token),
        deps.db.prepare('UPDATE pose_recovery_schedule SET claim_token = NULL, claim_expires_at = 0, next_attempt_at = ? WHERE request_id = ? AND claim_token = ?')
          .bind(result.status === 'failed' && result.action === 'done' ? Number.MAX_SAFE_INTEGER : finished + delay, candidate.id, token),
      ]);
    } catch {
      // If outcome or persistence is uncertain, the lease eventually allows a safe retry.
      locked++;
    }
  }
  return { attempted, locked };
}
