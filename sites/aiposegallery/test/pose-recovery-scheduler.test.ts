import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { schedulePoseRecoveries, schedulePoseRefunds, POSE_RECOVERY_MIN_COOLDOWN_MS } from '../src/site/pose-recovery-scheduler.server';
import { createDb } from '@shipwords/core/db/client';
import { getBalance, grantCredits } from '@shipwords/core/credits/ledger';
import { poseLedger } from '../src/site/pose-billing.server';
import type { PoseWorkflowDependencies } from '../src/site/pose-workflow.server';

const start = 2_000_000_000_000;
let now = start;
let polls: string[];
let gate: (() => Promise<void>) | undefined;
let workflowStatus = 'complete';
let workflowError = false;
const workflowBinding = { get: async (_id: string) => ({ status: async () => { if (workflowError) throw Error('unavailable'); return { status: workflowStatus }; } }) };
const schedule = (d: PoseWorkflowDependencies, options: {limit?: number} = {}) => schedulePoseRecoveries(d, { ...options, workflow: workflowBinding });

async function add(status: string, error: string | null, updated = start - POSE_RECOVERY_MIN_COOLDOWN_MS) {
  const id = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO pose_requests (id, owner_id, request_key, input_digest, day, status, created_at, updated_at, error_code, upstream_job_id)
    VALUES (?, ?, ?, 'digest', '2026-01-01', ?, ?, ?, ?, ?)`)
    .bind(id, `owner_${id}`, `key_${id}`, status, start - 10000000, updated, error, ['submitted','result_pending','unknown'].includes(status) ? `job_${id}` : null).run();
  return id;
}
function deps(): PoseWorkflowDependencies {
  return { db: env.DB, bucket: env.TEST_MEDIA as R2Bucket, resultHosts: [], uploadHosts: [], now: () => now,
    client: { getJob: async (id: string) => { polls.push(id); if (gate) await gate(); return { id, status: 'running' }; } } as unknown as PoseWorkflowDependencies['client'] };
}

beforeEach(async () => {
  await env.DB.exec('DELETE FROM pose_recovery_schedule');
  await env.DB.exec('DELETE FROM pose_requests');
  now = start; polls = []; gate = undefined; workflowStatus = 'complete'; workflowError = false;
});

describe('pose recovery scheduling on D1', () => {
  it('refunds a proven pre-submit failure without a provider or Workflow and is idempotent', async () => {
    const id = await add('failed', 'prompt_blocked');
    const user = `payer_${id}`, key = `key_${id}`;
    await env.DB.prepare('UPDATE pose_requests SET user_id = ? WHERE id = ?').bind(user, id).run();
    await grantCredits(createDb(env.DB), { userId: user, amount: 1, idemKey: `grant:${id}`, source: 'test' });
    await poseLedger(env.DB).spend(user, key, id);
    await Promise.all([schedulePoseRefunds(env.DB, { now: () => now }), schedulePoseRefunds(env.DB, { now: () => now })]);
    await schedulePoseRefunds(env.DB, { now: () => now });
    expect((await getBalance(createDb(env.DB), user)).available).toBe(1);
    expect((await env.DB.prepare("SELECT count(*) AS n FROM credit_ledger WHERE idem_key = ? AND kind = 'refund'").bind(`refund:pose:task:${id}`).first<{n:number}>())?.n).toBe(1);
  });

  it('retries after a ledger write fails and the lease expires', async () => {
    const id = await add('failed', 'quote_expired_or_invalid'), user = `payer_${id}`;
    await env.DB.prepare('UPDATE pose_requests SET user_id = ? WHERE id = ?').bind(user, id).run();
    await grantCredits(createDb(env.DB), { userId: user, amount: 1, idemKey: `grant:${id}`, source: 'test' });
    await poseLedger(env.DB).spend(user, `key_${id}`, id);
    await env.DB.exec("CREATE TRIGGER fail_pose_refund BEFORE INSERT ON credit_ledger WHEN NEW.kind = 'refund' BEGIN SELECT RAISE(ABORT, 'temporary ledger failure'); END");
    try {
      await schedulePoseRefunds(env.DB, { now: () => now });
      expect((await getBalance(createDb(env.DB), user)).available).toBe(0);
    } finally { await env.DB.exec('DROP TRIGGER fail_pose_refund'); }
    now += 31 * POSE_RECOVERY_MIN_COOLDOWN_MS;
    await schedulePoseRefunds(env.DB, { now: () => now });
    expect((await getBalance(createDb(env.DB), user)).available).toBe(1);
  });

  it('does not refund ambiguous failures or mismatched task ownership', async () => {
    // The last row is a clean pre-submit failure but carries no task-scoped charge
    // (a guest trial), so the scheduler must leave it untouched.
    const statuses = [['failed','upstream_failed'], ['failed','workflow_retry_exhausted'], ['unknown','prompt_blocked'], ['submitted','prompt_blocked'], ['failed','prompt_blocked'], ['failed','prompt_blocked']] as const;
    const ids: string[] = [];
    for (const [i, [status, error]] of statuses.entries()) {
      const id = await add(status, error), user = `payer_${id}`;
      ids.push(id);
      await env.DB.prepare('UPDATE pose_requests SET user_id = ?, upstream_job_id = ? WHERE id = ?').bind(i === 4 ? 'other' : user, i === 3 ? `job_${id}` : null, id).run();
      await grantCredits(createDb(env.DB), { userId: user, amount: 1, idemKey: `grant:${id}`, source: 'test' });
      if (i !== 5) await poseLedger(env.DB).spend(user, `key_${id}`, id);
    }
    await schedulePoseRefunds(env.DB, { now: () => now });
    for (const id of ids) expect(await env.DB.prepare('SELECT id FROM credit_ledger WHERE idem_key = ?').bind(`refund:pose:task:${id}`).first()).toBeNull();
  });
  it('only recovers cooled marked eligible states, obeys the limit and preserves quota rows', async () => {
    const first = await add('submitted', 'workflow_poll_exhausted', start - 900000);
    const second = await add('submitted', 'workflow_retry_exhausted', start - 800000);
    await add('submitted', 'result_expired');
    await add('submitted', 'workflow_poll_exhausted', start - 1);
    await add('submitting', 'workflow_retry_exhausted'); await add('unknown', 'workflow_poll_exhausted');
    await add('accepted', 'workflow_retry_exhausted'); await add('failed', 'workflow_retry_exhausted');
    const before = await env.DB.prepare('SELECT count(*) AS n FROM pose_requests').first<{n:number}>();
    const result = await schedule(deps(), { limit: 1 });
    expect(result.attempted).toBe(1);
    expect(polls).toEqual([`job_${first}`]);
    expect((await schedule(deps(), { limit: 1 })).attempted).toBe(1);
    expect(polls).toEqual([`job_${first}`, `job_${second}`]);
    expect(await env.DB.prepare('SELECT count(*) AS n FROM pose_requests').first()).toEqual(before);
  });

  it('recovers historical null updated_at rows without starving later tasks', async () => {
    const historical = await add('submitted', 'workflow_poll_exhausted');
    await env.DB.prepare('UPDATE pose_requests SET updated_at = NULL WHERE id = ?').bind(historical).run();
    const later = await add('submitted', 'workflow_poll_exhausted', start - 900000);

    expect(await schedule(deps(), { limit: 2 })).toEqual({ attempted: 2, locked: 0 });
    expect(polls).toEqual([`job_${historical}`, `job_${later}`]);
    const claim = await env.DB.prepare('SELECT attempts, claim_token FROM pose_recovery_schedule WHERE request_id = ?')
      .bind(historical).first<{attempts:number; claim_token:string|null}>();
    expect(claim).toEqual({ attempts: 1, claim_token: null });
  });

  it('shares the lock and exponential cooldown across concurrent scheduler instances', async () => {
    const id = await add('submitted', 'workflow_poll_exhausted');
    let entered!: () => void; let release!: () => void;
    const inside = new Promise<void>(r => { entered = r; });
    const hold = new Promise<void>(r => { release = r; });
    gate = async () => { entered(); await hold; };
    const active = schedule(deps());
    await inside;
    expect((await schedule(deps())).attempted).toBe(0);
    release(); await active; gate = undefined;
    expect((await schedule(deps())).attempted).toBe(0);
    now += POSE_RECOVERY_MIN_COOLDOWN_MS;
    expect((await schedule(deps())).attempted).toBe(1);
    now += POSE_RECOVERY_MIN_COOLDOWN_MS;
    expect((await schedule(deps())).attempted).toBe(0);
    now += POSE_RECOVERY_MIN_COOLDOWN_MS;
    expect((await schedule(deps())).attempted).toBe(1);
    expect(polls).toEqual([`job_${id}`, `job_${id}`, `job_${id}`]);
  });

  it('fences an old worker after its lease expires and a new worker claims the task', async () => {
    const id = await add('submitted', 'workflow_poll_exhausted');
    let entered!: () => void; let release!: () => void;
    const inside = new Promise<void>(r => { entered = r; });
    const hold = new Promise<void>(r => { release = r; });
    gate = async () => { entered(); await hold; };
    const old = schedule(deps());
    await inside;
    now += 31 * POSE_RECOVERY_MIN_COOLDOWN_MS;
    let enteredNew!: () => void; let releaseNew!: () => void;
    const newInside = new Promise<void>(r => { enteredNew = r; });
    const newHold = new Promise<void>(r => { releaseNew = r; });
    gate = async () => { enteredNew(); await newHold; };
    const current = schedule(deps());
    await newInside;
    const before = await env.DB.prepare('SELECT claim_token FROM pose_recovery_schedule WHERE request_id = ?').bind(id).first<{claim_token:string}>();
    release(); await old;
    expect(await env.DB.prepare('SELECT claim_token FROM pose_recovery_schedule WHERE request_id = ?').bind(id).first()).toEqual(before);
    releaseNew(); await current;
    expect(polls).toEqual([`job_${id}`, `job_${id}`]);
    expect((await env.DB.prepare('SELECT claim_token FROM pose_recovery_schedule WHERE request_id = ?').bind(id).first<{claim_token:string|null}>())?.claim_token).toBeNull();
  });

  it('does not start recovery after losing its lease during a Workflow status lookup', async () => {
    const id = await add('submitted', 'workflow_poll_exhausted');
    let entered!: () => void; let release!: () => void;
    const inside = new Promise<void>(r => { entered = r; });
    const hold = new Promise<void>(r => { release = r; });
    const delayedBinding = { get: async () => ({ status: async () => { entered(); await hold; return {status:'complete'}; } }) };
    const old = schedulePoseRecoveries(deps(), { workflow: delayedBinding });
    await inside;
    now += 31 * POSE_RECOVERY_MIN_COOLDOWN_MS;
    expect((await schedule(deps())).attempted).toBe(1);
    release();
    expect((await old).attempted).toBe(0);
    expect(polls).toEqual([`job_${id}`]);
  });

  it('reclaims an abandoned expired claim and polls only the known job', async () => {
    const id = await add('submitted', 'workflow_retry_exhausted');
    await env.DB.prepare("INSERT INTO pose_recovery_schedule (request_id, claim_token, attempts, next_attempt_at) VALUES (?, 'interrupted', 1, 0)").bind(id).run();
    now += 100 * POSE_RECOVERY_MIN_COOLDOWN_MS;
    expect((await schedule(deps())).attempted).toBe(1);
    expect(polls).toEqual([`job_${id}`]);
  });

  it('restores the exhaustion marker after a retryable transfer transition, but keeps result expiry', async () => {
    const id = await add('submitted', 'workflow_poll_exhausted');
    const workflow = deps();
    workflow.client = { getJob: async (job: string) => ({ id: job, status: 'succeeded', result: { availability: 'available', files: [{ url: 'https://untrusted.test/image', media_type: 'image/png' }] } }) } as unknown as PoseWorkflowDependencies['client'];
    expect((await schedule(workflow)).attempted).toBe(1);
    expect(await env.DB.prepare('SELECT status, error_code FROM pose_requests WHERE id = ?').bind(id).first()).toEqual({ status: 'result_pending', error_code: 'workflow_poll_exhausted' });
    now += POSE_RECOVERY_MIN_COOLDOWN_MS;
    workflow.client = { getJob: async (job: string) => ({ id: job, status: 'succeeded', result: { availability: 'expired' } }) } as unknown as PoseWorkflowDependencies['client'];
    expect((await schedule(workflow)).attempted).toBe(1);
    expect(await env.DB.prepare('SELECT status, error_code FROM pose_requests WHERE id = ?').bind(id).first()).toEqual({ status: 'result_pending', error_code: 'result_expired' });
    now += 10 * POSE_RECOVERY_MIN_COOLDOWN_MS;
    expect((await schedule(workflow)).attempted).toBe(0);
  });

  it('excludes preparing and quoted rows from automatic recovery', async () => {
    const preparing = await add('preparing', 'workflow_retry_exhausted');
    const quoted = await add('quoted', 'workflow_poll_exhausted');
    expect((await schedule(deps())).attempted).toBe(0);
    expect(polls).toEqual([]);
    expect((await env.DB.prepare('SELECT count(*) AS n FROM pose_requests WHERE id IN (?, ?) AND error_code IS NOT NULL').bind(preparing, quoted).first<{n:number}>())?.n).toBe(2);
  });

  it('keeps an uncertain failing invocation locked and continues other tasks within the batch', async () => {
    await env.DB.prepare("INSERT INTO pose_requests (id, owner_id, request_key, input_digest, day, status, created_at, updated_at, error_code, upstream_job_id) VALUES ('invalid-id','o','k','d','day','submitted',0,0,'workflow_retry_exhausted','job_invalid')").run();
    const id = await add('submitted', 'workflow_poll_exhausted');
    expect(await schedule(deps(), { limit: 2 })).toEqual({ attempted: 2, locked: 1 });
    expect(polls).toEqual([`job_${id}`]);
    expect((await env.DB.prepare("SELECT claim_token FROM pose_recovery_schedule WHERE request_id = 'invalid-id'").first<{claim_token:string}>())?.claim_token).toBeTruthy();
  });


  it('waits for terminal Workflow status and treats lookup errors as unsafe', async () => {
    const id = await add('submitted', 'workflow_poll_exhausted');
    workflowStatus = 'running';
    expect((await schedule(deps())).attempted).toBe(0);
    expect(polls).toEqual([]);
    now += POSE_RECOVERY_MIN_COOLDOWN_MS;
    workflowError = true;
    expect((await schedule(deps())).attempted).toBe(0);
    expect(polls).toEqual([]);
    now += POSE_RECOVERY_MIN_COOLDOWN_MS;
    workflowError = false; workflowStatus = 'complete';
    expect((await schedule(deps())).attempted).toBe(1);
    expect(polls).toEqual([`job_${id}`]);
  });

  it('does not recreate a terminal paid accepted Workflow', async () => {
    const id = crypto.randomUUID();
    const owner = `guest_${'c'.repeat(64)}`;
    const { storePoseTaskInput, poseInputDigest } = await import('../src/site/pose-task-input.server');
    const input = { prompt: 'a portrait' };
    await env.DB.prepare("INSERT INTO pose_requests (id, owner_id, request_key, input_digest, day, status, created_at, user_id) VALUES (?, ?, ?, ?, '2026-01-01', 'accepted', ?, 'payer')")
      .bind(id, owner, `key_${id}`, await poseInputDigest(input), start - POSE_RECOVERY_MIN_COOLDOWN_MS).run();
    await storePoseTaskInput(env.TEST_MEDIA as R2Bucket, id, owner, input);
    await env.DB.prepare("INSERT INTO credit_ledger (id,user_id,kind,delta,idem_key,ref) VALUES (?, 'payer','spend',-1,?,'pose-image')").bind(`ledger_${id}`, `spend:pose:task:${id}`).run();
    const creates: string[] = [];
    const binding = { ...workflowBinding, create: async ({id}: {id:string}) => { creates.push(id); } };
    workflowStatus = 'terminated';
    expect((await schedulePoseRecoveries(deps(), {workflow: binding})).attempted).toBe(0);
    expect(creates).toEqual([]);
  });

  it('does not automatically dispatch a paid accepted task even with durable matching input', async () => {
    const id = crypto.randomUUID();
    const owner = `guest_${'a'.repeat(64)}`;
    const { storePoseTaskInput, poseInputDigest } = await import('../src/site/pose-task-input.server');
    const input = { prompt: 'a portrait' };
    await env.DB.prepare("INSERT INTO pose_requests (id, owner_id, request_key, input_digest, day, status, created_at, user_id) VALUES (?, ?, ?, ?, '2026-01-01', 'accepted', ?, 'payer')")
      .bind(id, owner, `key_${id}`, await poseInputDigest(input), start - POSE_RECOVERY_MIN_COOLDOWN_MS).run();
    await storePoseTaskInput(env.TEST_MEDIA as R2Bucket, id, owner, input);
    const creates: string[] = [];
    const binding = { ...workflowBinding, create: async ({id}: {id:string}) => { creates.push(id); } };
    expect((await schedulePoseRecoveries(deps(), {workflow: binding})).attempted).toBe(0);
    await env.DB.prepare("INSERT INTO credit_ledger (id,user_id,kind,delta,idem_key,ref) VALUES (?, 'payer','spend',-1,?,'pose-image')").bind(`ledger_${id}`, `spend:pose:task:${id}`).run();
    expect((await schedulePoseRecoveries(deps(), {workflow: binding})).attempted).toBe(0);
    expect(creates).toEqual([]);
  });

  it('does not dispatch accepted tasks with mismatched, refunded, or missing payment and input', async () => {
    const { storePoseTaskInput, poseInputDigest } = await import('../src/site/pose-task-input.server');
    const owner = `guest_${'b'.repeat(64)}`, input = {prompt:'portrait'};
    const digest = await poseInputDigest(input);
    const ids = Array.from({length: 5}, () => crypto.randomUUID());
    for (const [index, id] of ids.entries()) {
      await env.DB.prepare("INSERT INTO pose_requests (id,owner_id,request_key,input_digest,day,status,created_at,user_id) VALUES (?,?,?,?,'day','accepted',? ,?)")
        .bind(id, owner, `key_${id}`, digest, start - POSE_RECOVERY_MIN_COOLDOWN_MS, index === 4 ? null : 'payer').run();
      if (index !== 3) await storePoseTaskInput(env.TEST_MEDIA as R2Bucket,id,owner,input);
      if (index !== 0) await env.DB.prepare("INSERT INTO credit_ledger (id,user_id,kind,delta,idem_key,ref) VALUES (?,?,'spend',-1,?,'pose-image')")
        .bind(`spend_${id}`, index === 1 ? 'other' : 'payer', `spend:pose:task:${id}`).run();
    }
    await env.DB.prepare("INSERT INTO credit_ledger (id,user_id,kind,delta,idem_key) VALUES ('refund','payer','refund',1,?)").bind(`refund:pose:task:${ids[2]}`).run();
    const creates: string[] = [];
    const binding = { ...workflowBinding, create: async ({id}: {id:string}) => { creates.push(id); } };
    expect((await schedulePoseRecoveries(deps(), {workflow:binding})).attempted).toBe(0);
    expect(creates).toEqual([]);
  });

  it('recovers a hard-killed terminal Workflow with a persisted upstream ID and no marker', async () => {
    const id = await add('submitted', null);
    workflowStatus = 'running';
    expect((await schedule(deps())).attempted).toBe(0);
    expect(polls).toEqual([]);
    now += POSE_RECOVERY_MIN_COOLDOWN_MS;
    workflowStatus = 'terminated';
    expect((await schedule(deps())).attempted).toBe(1);
    expect(polls).toEqual([`job_${id}`]);
  });

  it('excludes a submitted row without a known upstream ID', async () => {
    const id = await add('submitted', 'workflow_poll_exhausted');
    await env.DB.prepare('UPDATE pose_requests SET upstream_job_id = NULL WHERE id = ?').bind(id).run();
    expect((await schedule(deps())).attempted).toBe(0);
    expect(polls).toEqual([]);
  });

  it('caps each batch and rejects invalid limits', async () => {
    for (let i = 0; i < 12; i++) await add('submitted', 'workflow_poll_exhausted');
    expect((await schedule(deps())).attempted).toBe(10);
    expect((await schedule(deps())).attempted).toBe(2);
    await expect(schedule(deps(), { limit: 11 })).rejects.toThrow('Invalid recovery batch limit');
    await expect(schedule(deps(), { limit: 0 })).rejects.toThrow('Invalid recovery batch limit');
  });

  it('does not claim the same request when schedulers start at once', async () => {
    for (let i = 0; i < 8; i++) await add('submitted', 'workflow_retry_exhausted');
    const results = await Promise.all(Array.from({ length: 5 }, () => schedule(deps())));
    expect(results.reduce((sum, result) => sum + result.attempted, 0)).toBe(8);
    expect(polls).toHaveLength(8);
    expect(new Set(polls).size).toBe(8);
  });
});
