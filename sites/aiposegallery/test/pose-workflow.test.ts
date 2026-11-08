import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createDb } from '@shipwords/core/db/client';
import { getBalance, grantCredits } from '@shipwords/core/credits/ledger';
import { poseLedger } from '../src/site/pose-billing.server';
import { admitPoseRequest } from '../src/site/pose-admission.server';
import { getPrivateImage, putPrivateImage } from '../src/site/private-media.server';
import { poseInputDigest, storePoseTaskInput } from '../src/site/pose-task-input.server';
import { advancePoseWorkflow, attachVerifiedPoseJob, createPoseWorkflowDependencies, recoverPoseWorkflow, runPoseWorkflow } from '../src/site/pose-workflow.server';

const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='), c => c.charCodeAt(0));
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });

async function fixture(options: { submitLost?: boolean; resultFails?: boolean; status?: string; amount?: string; withPhoto?: boolean; resultHost?: string; uploadHost?: string; promptAction?: 'allow' | 'block' | 'review'; prompt?: string } = {}) {
  const owner = `guest_${crypto.randomUUID().replaceAll('-', '').padEnd(64, '0')}`;
  const input = { prompt: options.prompt ?? 'sit', pose: { bytes: png, mediaType: 'image/png' }, ...(options.withPhoto ? { photo: { bytes: png, mediaType: 'image/png' } } : {}) };
  const digest = await poseInputDigest(input);
  const admitted = await admitPoseRequest(env.DB, { ownerId: owner, requestKey: `request_${crypto.randomUUID()}`, inputDigest: digest, nowMs: Date.now(), ipHash:'1'.repeat(64), dailyIpLimit:10000, dailySiteLimit: 1000, dailyOwnerLimit: 1000 });
  if (admitted.kind !== 'accepted') throw new Error('Test admission failed');
  const id = admitted.id;
  const bucket = env.TEST_MEDIA as R2Bucket;
  await storePoseTaskInput(bucket, id, owner, input);
  const files = new Map<string, Record<string, unknown>>();
  const counts = { submit: 0, quote: 0, download: 0, uploads: 0 };
  const submitted: { body?: any; key?: string } = {};
  let status = options.status ?? 'succeeded';
  let resultFails = options.resultFails ?? false;
  let resultExpired = false;
  let providerUnavailable = false;
  const fetcher: typeof fetch = async (target, init = {}) => {
    const url = new URL(typeof target === 'string' ? target : target instanceof URL ? target.href : target.url);
    if (url.hostname === 'upload.example.test') { counts.uploads++; return new Response(null, { status: 200 }); }
    if (url.hostname === 'cdn.example.test') {
      counts.download++;
      if (resultFails) return new Response(null, { status: 503 });
      expect(new Headers(init.headers).has('authorization')).toBe(false);
      return new Response(png, { headers: { 'content-type': 'image/png' } });
    }
    if (url.hostname !== 'gateway.yir.ai') throw new Error('Unexpected host');
    if (url.pathname === '/v1/files') {
      const meta = JSON.parse(init.body as string).files[0];
      const fileId = `file_${crypto.randomUUID()}`;
      const file = { ...meta, id: fileId, object: 'file', status: 'pending_upload', upload: { type: 'multipart', expires_at: Math.floor(Date.now()/1000)+60, parts: [{ part_number: 1, size: meta.size, url: `https://${options.uploadHost ?? 'upload.example.test'}/object` }] } };
      files.set(fileId, file);
      return json({ files: [file] });
    }
    if (url.pathname.endsWith('/complete')) return json({ ...files.get(url.pathname.split('/')[3]!), status: 'ready' });
    if (url.pathname === '/v1/images/quotes') {
      counts.quote++;
      const request = JSON.parse(init.body as string);
      return json({ object:'quote', currency:'USD', model:request.model, operation:'generate_image', input_mode:'image', parameters:request.parameters, expires_at:Math.floor(Date.now()/1000)+60, supply:{ available:true, issues:[] }, primary:{kind:'fixed',amount:options.amount ?? '0.05'}, official:{kind:'fixed',amount:'0.05'}, expected_amount:options.amount ?? '0.05' });
    }
    if (url.pathname === '/v1/images/generations') {
      counts.submit++;
      submitted.key = new Headers(init.headers).get('idempotency-key') ?? undefined;
      submitted.body = JSON.parse(init.body as string);
      if (options.submitLost) throw new Error('simulated lost response');
      return json({ id:'job_123', status:'queued' });
    }
    if (url.pathname === '/v1/jobs/job_123') {
      if (providerUnavailable) throw new Error('provider offline');
      return json({ id:'job_123', object:'job', status, model:'model', error:null, created_at:1, ...(status === 'succeeded' ? { result:resultExpired ? {availability:'expired'} : {availability:'available',files:[{url:`https://${options.resultHost ?? 'cdn.example.test'}/image`,media_type:'image/png',expires_at:9999999999}]} } : {}) });
    }
    throw new Error(`Unexpected path: ${url.pathname}`);
  };
  const deps = createPoseWorkflowDependencies({ DB:env.DB, POSE_MEDIA:bucket, YIR_API_KEY:'fake-test-only', POSE_RESULT_HOSTS:'cdn.example.test', POSE_UPLOAD_HOSTS:'upload.example.test' }, fetcher, { scanPrompt: async () => ({ action: options.promptAction ?? 'allow' }) });
  const row = async () => env.DB.prepare('SELECT status, upstream_job_id, output_key, error_code FROM pose_requests WHERE id = ?').bind(id).first<{status:string;upstream_job_id:string|null;output_key:string|null;error_code:string|null}>();
  return { id, owner, digest, input, bucket, deps, files, counts, submitted, row, setStatus: (s:string) => {status = s;}, setResultFails:(v:boolean) => {resultFails = v;}, setResultExpired:(v:boolean) => {resultExpired = v;}, setProviderUnavailable:(v:boolean) => {providerUnavailable = v;} };
}

describe('private pose workflow', () => {
  it.each(['missing', 'invalid'] as const)('refunds a paid task when the prompt scanner is %s', async (mode) => {
    const f = await fixture();
    const userId = `user_${crypto.randomUUID()}`;
    const db = createDb(env.DB);
    const ledger = poseLedger(env.DB);
    await grantCredits(db, { userId, amount: 1, idemKey: `grant:${f.id}`, source: 'test' });
    expect(await ledger.spend(userId, 'request_test', f.id)).toBe('ok');
    let attempts = 0;
    const refund = async (key: string, id: string) => {
      if (++attempts === 1) throw new Error('temporary ledger failure');
      await ledger.refund(key, id);
    };
    const deps = createPoseWorkflowDependencies({
      DB: env.DB, POSE_MEDIA: f.bucket, YIR_API_KEY: 'fake-test-only',
      POSE_RESULT_HOSTS: 'cdn.example.test', POSE_UPLOAD_HOSTS: 'upload.example.test',
      ...(mode === 'invalid' ? { WAFFO_MERCHANT_ID: 'invalid', WAFFO_PRIVATE_KEY: 'invalid', WAFFO_ENVIRONMENT: 'test' } : {}),
    }, undefined, undefined, refund);
    await expect(advancePoseWorkflow(deps, f.id)).rejects.toThrow('temporary ledger failure');
    expect(await f.row()).toMatchObject({ status: 'failed', error_code: 'prompt_screening_unavailable', upstream_job_id: null });
    expect((await getBalance(db, userId)).available).toBe(0);
    expect(await recoverPoseWorkflow(deps, f.id)).toEqual({ status: 'failed', action: 'done', reason: 'failed' });
    await advancePoseWorkflow(deps, f.id);
    expect((await getBalance(db, userId)).available).toBe(1);
    expect((await env.DB.prepare("SELECT count(*) AS n FROM credit_ledger WHERE idem_key = ? AND kind = 'refund'").bind(`refund:pose:task:${f.id}`).first<{n:number}>())?.n).toBe(1);
    expect(f.counts.submit).toBe(0);
  });
  it.each(['failed', 'lost'] as const)('does not refund a paid task after submission when the outcome is %s', async (outcome) => {
    const f = await fixture(outcome === 'lost' ? { submitLost: true } : { status: 'failed' });
    const userId = `user_${crypto.randomUUID()}`;
    const db = createDb(env.DB);
    const ledger = poseLedger(env.DB);
    await grantCredits(db, { userId, amount: 1, idemKey: `grant:${f.id}`, source: 'test' });
    expect(await ledger.spend(userId, 'request_test', f.id)).toBe('ok');
    const deps = { ...f.deps, refund: ledger.refund };
    expect(await advancePoseWorkflow(deps, f.id)).toBe(outcome === 'lost' ? 'unknown' : 'failed');
    await recoverPoseWorkflow(deps, f.id);
    expect(f.counts.submit).toBe(1);
    expect((await getBalance(db, userId)).available).toBe(0);
    expect((await env.DB.prepare("SELECT count(*) AS n FROM credit_ledger WHERE idem_key = ? AND kind = 'refund'").bind(`refund:pose:task:${f.id}`).first<{n:number}>())?.n).toBe(0);
  });

  it('retries a failed pre-submit refund and never refunds an upstream failure', async () => {
    const f = await fixture({promptAction:'block'});
    let calls=0;
    const deps={...f.deps, refund:async()=>{ calls++; if(calls===1) throw Error('ledger offline'); }};
    await expect(advancePoseWorkflow(deps,f.id)).rejects.toThrow('ledger offline');
    expect((await f.row())?.status).toBe('failed');
    expect(await recoverPoseWorkflow(deps,f.id)).toEqual({status:'failed',action:'done',reason:'failed'});
    expect(calls).toBe(2);
    const paid = await fixture({status:'failed'});
    let refunded=0;
    const paidDeps={...paid.deps,refund:async()=>{refunded++;}};
    expect(await advancePoseWorkflow(paidDeps,paid.id)).toBe('failed');
    await recoverPoseWorkflow(paidDeps,paid.id);
    expect(refunded).toBe(0);
  });

  it('blocks a multi-person instruction before uploading references', async () => {
    const f = await fixture({ prompt: 'Two fully clothed adults standing together' });
    expect(await advancePoseWorkflow(f.deps, f.id)).toBe('failed');
    expect(f.counts.uploads).toBe(0);
    expect(f.counts.quote).toBe(0);
    expect(f.counts.submit).toBe(0);
    expect((await f.row())?.error_code).toBe('multi_person_prompt_blocked');
  });

  it('blocks a prompt before uploading references when Waffo rejects it', async () => {
    const f = await fixture({ promptAction:'block', withPhoto:true });
    expect(await advancePoseWorkflow(f.deps, f.id)).toBe('failed');
    expect(f.counts.uploads).toBe(0);
    expect(f.counts.quote).toBe(0);
    expect(f.counts.submit).toBe(0);
    expect((await f.row())?.error_code).toBe('prompt_blocked');
  });

  it('claims a single submit concurrently, quotes ordered references and stores an owner-only result', async () => {
    const f = await fixture({ withPhoto:true });
    await Promise.all(Array.from({length:5}, () => advancePoseWorkflow(f.deps, f.id)));
    await advancePoseWorkflow(f.deps, f.id);
    expect(f.counts.submit).toBe(1);
    expect(f.submitted.key).toBe(`pose-${f.id}`);
    expect(f.submitted.body.input.references).toHaveLength(2);
    expect(f.submitted.body.input.references.map((ref: {file_id:string}) => f.files.get(ref.file_id)?.name)).toEqual(['photo.png', 'pose.png']);
    expect(f.submitted.body.max_cost).toBe('0.30');
    const row = await f.row();
    expect(row?.status).toBe('succeeded');
    expect(row?.output_key).toMatch(/^pose-media\/[0-9a-f-]{36}$/);
    expect((await getPrivateImage(f.bucket, f.owner, row!.output_key!)).status).toBe(200);
    expect((await getPrivateImage(f.bucket, `guest_${'f'.repeat(64)}`, row!.output_key!)).status).toBe(404);
    const quote = await f.bucket.get(`pose-tasks/${f.id}/quoted-request.json`);
    expect(quote?.customMetadata?.ownerId).toBe(f.owner);
  });

  it('does not resubmit a lost response or an interrupted submitting state', async () => {
    const f = await fixture({submitLost:true});
    expect(await advancePoseWorkflow(f.deps, f.id)).toBe('unknown');
    expect(await advancePoseWorkflow(f.deps, f.id)).toBe('unknown');
    expect(f.counts.submit).toBe(1);
    const other = await fixture();
    await env.DB.prepare("UPDATE pose_requests SET status='submitting' WHERE id=?").bind(other.id).run();
    expect(await advancePoseWorkflow(other.deps, other.id)).toBe('submitting');
    expect(other.counts.submit).toBe(0);
  });

  it('does not resubmit if persisting the returned provider ID fails', async () => {
    const f = await fixture();
    const db = {
      prepare(sql: string) {
        const statement = env.DB.prepare(sql);
        return {
          bind(...args: unknown[]) {
            if (sql.startsWith('UPDATE pose_requests') && args[0] === 'submitted') return { first: async () => { throw new Error('simulated D1 write failure'); } };
            return statement.bind(...args);
          },
        };
      },
    } as unknown as D1Database;
    expect(await advancePoseWorkflow({...f.deps, db}, f.id)).toBe('unknown');
    expect(await advancePoseWorkflow(f.deps, f.id)).toBe('unknown');
    expect(f.counts.submit).toBe(1);
  });

  it('recovers a known job after a transfer failure without submitting again', async () => {
    const f = await fixture({resultFails:true});
    await expect(advancePoseWorkflow(f.deps, f.id)).rejects.toThrow('Invalid result response');
    expect((await f.row())?.status).toBe('result_pending');
    f.setResultFails(false);
    expect(await advancePoseWorkflow(f.deps, f.id)).toBe('succeeded');
    expect(f.counts.submit).toBe(1);
    expect(f.counts.download).toBe(2);
  });

  it('finishes an already stored result while the provider is offline', async () => {
    const f = await fixture({resultFails:true});
    await expect(advancePoseWorkflow(f.deps, f.id)).rejects.toThrow();
    const key = await putPrivateImage(f.bucket, f.owner, 'result', png, 'image/png');
    await f.bucket.put(`pose-tasks/${f.id}/result.json`, JSON.stringify({outputKey:key}), { customMetadata:{ownerId:f.owner,inputDigest:f.digest} });
    f.setProviderUnavailable(true);
    expect(await advancePoseWorkflow(f.deps, f.id)).toBe('succeeded');
    expect(f.counts.submit).toBe(1);
  });

  it('rejects untrusted result hosts without fetching or exposing them', async () => {
    const f = await fixture({resultHost:'evil.example.test'});
    await expect(advancePoseWorkflow(f.deps, f.id)).rejects.toThrow('Invalid result URL');
    expect((await f.row())?.status).toBe('result_pending');
    expect(f.counts.download).toBe(0);
    expect(f.counts.submit).toBe(1);
  });

  it('rejects untrusted upload hosts before sending private input', async () => {
    const f = await fixture({uploadHost:'evil.example.test'});
    await expect(advancePoseWorkflow(f.deps, f.id)).rejects.toThrow();
    expect(f.counts.uploads).toBe(0);
    expect(f.counts.submit).toBe(0);
  });

  it('fails only on confirmed upstream failure; an over-budget quote never submits', async () => {
    const f = await fixture({status:'failed'});
    expect(await advancePoseWorkflow(f.deps, f.id)).toBe('failed');
    expect(f.counts.submit).toBe(1);
    const expensive = await fixture({amount:'0.16'});
    expect(await advancePoseWorkflow(expensive.deps, expensive.id)).toBe('failed');
    expect((await expensive.row())?.error_code).toBe('quote_unavailable_or_over_budget');
    expect(expensive.counts.submit).toBe(0);
  });

  it('polls only the known job, and leaves a long-running job resumable after the bound', async () => {
    const f = await fixture({status:'running'});
    const calls: string[] = [];
    const step = { do: async <T extends string>(name:string, fn:()=>Promise<T>) => { calls.push(name); return fn(); }, sleep: async () => {} };
    expect(await runPoseWorkflow(f.deps, f.id, step)).toBe('submitted');
    expect((await f.row())?.error_code).toBe('workflow_poll_exhausted');
    expect(calls).toHaveLength(60);
    expect(f.counts.submit).toBe(1);
    f.setStatus('succeeded');
    expect(await advancePoseWorkflow(f.deps, f.id)).toBe('succeeded');
    expect(f.counts.submit).toBe(1);
  });

  it('reports an unknown outcome and attaches only an independently verified job without replay', async () => {
    const f = await fixture({submitLost:true});
    expect(await advancePoseWorkflow(f.deps, f.id)).toBe('unknown');
    expect(await recoverPoseWorkflow(f.deps, f.id)).toEqual({status:'unknown',action:'reconcile',reason:'submission_unknown'});
    expect(await attachVerifiedPoseJob(f.deps, f.id, 'job_123')).toEqual({status:'succeeded',action:'done',reason:'completed'});
    expect(f.counts.submit).toBe(1);
    await expect(attachVerifiedPoseJob(f.deps, f.id, 'job_123')).rejects.toThrow();
  });

  it('does not disturb an in-flight submission and preserves its returned ID', async () => {
    const f = await fixture();
    const userId = `user_${crypto.randomUUID()}`;
    const db = createDb(env.DB);
    const ledger = poseLedger(env.DB);
    await grantCredits(db, { userId, amount: 1, idemKey: `grant:${f.id}`, source: 'test' });
    await ledger.spend(userId, 'request_test', f.id);
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const entered = new Promise<void>(resolve => { started = resolve; });
    const client = { ...f.deps.client, submitImage: async (...args: Parameters<typeof f.deps.client.submitImage>) => {
      started();
      await gate;
      return f.deps.client.submitImage(...args);
    } };
    const active = advancePoseWorkflow({...f.deps, client}, f.id);
    await entered;
    expect(await recoverPoseWorkflow({ ...f.deps, refund: ledger.refund }, f.id)).toEqual({status:'submitting',action:'reconcile',reason:'submission_unknown'});
    expect((await getBalance(db, userId)).available).toBe(0);
    release();
    expect(await active).toBe('succeeded');
    expect((await f.row())?.upstream_job_id).toBe('job_123');
    expect(f.counts.submit).toBe(1);
  });

  it.each(['preparing', 'quoted'] as const)('refunds a terminal Workflow stuck in %s exactly once', async (status) => {
    const f = await fixture();
    const userId = `user_${crypto.randomUUID()}`;
    const db = createDb(env.DB);
    const ledger = poseLedger(env.DB);
    await grantCredits(db, { userId, amount: 1, idemKey: `grant:${f.id}`, source: 'test' });
    await ledger.spend(userId, 'request_test', f.id);
    await env.DB.prepare('UPDATE pose_requests SET status = ? WHERE id = ?').bind(status, f.id).run();
    const deps = { ...f.deps, refund: ledger.refund };
    await Promise.all(Array.from({ length: 5 }, () => recoverPoseWorkflow(deps, f.id)));
    expect(await f.row()).toMatchObject({ status: 'failed', error_code: 'workflow_pre_submit_failed', upstream_job_id: null });
    expect((await getBalance(db, userId)).available).toBe(1);
    expect((await env.DB.prepare("SELECT count(*) AS n FROM credit_ledger WHERE idem_key = ? AND kind = 'refund'").bind(`refund:pose:task:${f.id}`).first<{n:number}>())?.n).toBe(1);
    expect(f.counts.submit).toBe(0);
  });

  it('retries an interrupted recovery refund using the real ledger', async () => {
    const f = await fixture();
    const userId = `user_${crypto.randomUUID()}`;
    const db = createDb(env.DB);
    const ledger = poseLedger(env.DB);
    await grantCredits(db, { userId, amount: 1, idemKey: `grant:${f.id}`, source: 'test' });
    await ledger.spend(userId, 'request_test', f.id);
    await env.DB.prepare("UPDATE pose_requests SET status = 'preparing' WHERE id = ?").bind(f.id).run();
    let calls = 0;
    const deps = { ...f.deps, refund: async (key: string, id: string) => { if (++calls === 1) throw Error('ledger offline'); await ledger.refund(key, id); } };
    await expect(recoverPoseWorkflow(deps, f.id)).rejects.toThrow('ledger offline');
    expect(await f.row()).toMatchObject({ status: 'failed', error_code: 'workflow_pre_submit_failed' });
    await Promise.all([recoverPoseWorkflow(deps, f.id), recoverPoseWorkflow(deps, f.id)]);
    expect((await getBalance(db, userId)).available).toBe(1);
    expect((await env.DB.prepare("SELECT count(*) AS n FROM credit_ledger WHERE idem_key = ? AND kind = 'refund'").bind(`refund:pose:task:${f.id}`).first<{n:number}>())?.n).toBe(1);
  });

  it('does not refund when a quoted row has an upstream ID', async () => {
    const f = await fixture();
    let refunds = 0;
    await env.DB.prepare("UPDATE pose_requests SET status = 'quoted', upstream_job_id = 'job_123' WHERE id = ?").bind(f.id).run();
    expect(await recoverPoseWorkflow({ ...f.deps, refund: async () => { refunds++; } }, f.id)).toEqual({ status: 'quoted', action: 'review', reason: 'preparation' });
    expect(refunds).toBe(0);
  });

  it('races the real quoted submit CAS against recovery and never refunds a submitted task', async () => {
    for (let i = 0; i < 8; i++) {
      const f = await fixture({ status: 'running' });
      const userId = `user_${crypto.randomUUID()}`;
      const db = createDb(env.DB);
      const ledger = poseLedger(env.DB);
      await grantCredits(db, { userId, amount: 1, idemKey: `grant:${f.id}`, source: 'test' });
      await ledger.spend(userId, 'request_test', f.id);
      const interruptedDb = { prepare(sql: string) {
        const statement = env.DB.prepare(sql);
        return { bind(...args: unknown[]) {
          if (sql.startsWith('UPDATE pose_requests') && args[0] === 'submitting') return { first: async () => { throw Error('pause before claim'); } };
          return statement.bind(...args);
        } };
      } } as unknown as D1Database;
      await expect(advancePoseWorkflow({ ...f.deps, db: interruptedDb }, f.id)).rejects.toThrow('pause before claim');
      const deps = { ...f.deps, refund: ledger.refund };
      await Promise.all([advancePoseWorkflow(deps, f.id), recoverPoseWorkflow(deps, f.id)]);
      const row = await f.row();
      const balance = (await getBalance(db, userId)).available;
      expect(f.counts.submit).toBeLessThanOrEqual(1);
      if (row?.status === 'failed') { expect(f.counts.submit).toBe(0); expect(balance).toBe(1); }
      else { expect(f.counts.submit).toBe(1); expect(balance).toBe(0); expect(row?.status).toBe('submitted'); }
    }
  });

  it('never submits or advances accepted tasks during recovery', async () => {
    const f = await fixture();
    expect(await recoverPoseWorkflow(f.deps, f.id)).toEqual({status:'accepted',action:'review',reason:'preparation'});
    await env.DB.prepare("UPDATE pose_requests SET status='quoted' WHERE id=?").bind(f.id).run();
    expect(await recoverPoseWorkflow(f.deps, f.id)).toEqual({status:'failed',action:'done',reason:'failed'});
    expect(f.counts.submit).toBe(0);
  });

  it('never submits even when a valid saved quote exists', async () => {
    const f = await fixture();
    const db = { prepare(sql: string) {
      const statement = env.DB.prepare(sql);
      return { bind(...args: unknown[]) {
        if (sql.startsWith('UPDATE pose_requests') && args[0] === 'submitting') return { first: async () => { throw new Error('interrupted before submit'); } };
        return statement.bind(...args);
      } };
    } } as unknown as D1Database;
    await expect(advancePoseWorkflow({...f.deps, db}, f.id)).rejects.toThrow('interrupted before submit');
    expect((await f.row())?.status).toBe('quoted');
    expect(await f.bucket.get(`pose-tasks/${f.id}/quoted-request.json`)).not.toBeNull();
    expect(await recoverPoseWorkflow(f.deps, f.id)).toEqual({status:'failed',action:'done',reason:'failed'});
    expect(f.counts.submit).toBe(0);
  });

  it('records Workflow retry exhaustion without automatically submitting', async () => {
    const f = await fixture();
    const exhausted = {do: async <T extends string>(_name:string, _fn:()=>Promise<T>):Promise<T> => {throw Error('network secret');}, sleep: async () => {}};
    expect(await runPoseWorkflow(f.deps, f.id, exhausted)).toBe('accepted');
    expect((await f.row())?.error_code).toBe('workflow_retry_exhausted');
    expect(await recoverPoseWorkflow(f.deps, f.id)).toEqual({status:'accepted',action:'review',reason:'preparation'});
    expect(f.counts.submit).toBe(0);
  });

  it('keeps poll and transfer errors resumable and reports result expiry for review', async () => {
    const f = await fixture({status:'running'});
    expect(await advancePoseWorkflow(f.deps, f.id)).toBe('submitted');
    f.setProviderUnavailable(true);
    expect(await recoverPoseWorkflow(f.deps, f.id)).toEqual({status:'submitted',action:'retry',reason:'poll'});
    f.setProviderUnavailable(false);
    f.setStatus('succeeded');
    f.setResultFails(true);
    expect(await recoverPoseWorkflow(f.deps, f.id)).toEqual({status:'result_pending',action:'retry',reason:'transfer'});
    f.setResultExpired(true);
    expect(await recoverPoseWorkflow(f.deps, f.id)).toEqual({status:'result_pending',action:'review',reason:'result_expired'});
    expect((await f.row())?.error_code).toBe('result_expired');
    expect(f.counts.submit).toBe(1);
    const key = await putPrivateImage(f.bucket, f.owner, 'result', png, 'image/png');
    await f.bucket.put(`pose-tasks/${f.id}/result.json`, JSON.stringify({outputKey:key}), { customMetadata:{ownerId:f.owner,inputDigest:f.digest} });
    expect(await recoverPoseWorkflow(f.deps, f.id)).toEqual({status:'succeeded',action:'done',reason:'completed'});
  });
});
