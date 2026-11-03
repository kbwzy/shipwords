import type { YirClient } from '@yir-ai/sdk/server';
import { createWaffoPromptScanner, type PromptScanner } from '@shipwords/core/content-safety/waffo';
import { putPrivateImage } from './private-media.server.ts';
import { transitionGarmentRequest } from './garment-lifecycle.server.ts';
import { isUnsupportedMultiPersonPrompt, garmentPrompt } from './garment-prompt.server.ts';
import { garmentQuoteAllowed } from './garment-provider.server.ts';
import { readGarmentResult } from './garment-result.server.ts';
import { loadGarmentTaskInput, garmentInputDigest } from './garment-task-input.server.ts';
import { createGarmentYirClient, quoteGarment, submitGarment, uploadGarmentReference } from './garment-yir.server.ts';

export type GarmentWorkflowStatus = 'accepted' | 'preparing' | 'quoted' | 'submitting' | 'submitted' | 'result_pending' | 'succeeded' | 'failed' | 'unknown';
type Status = GarmentWorkflowStatus;
type Row = { id: string; owner_id: string; request_key: string; input_digest: string; status: Status; upstream_job_id: string | null; error_code: string | null };
type SavedQuote = Awaited<ReturnType<typeof quoteGarment>>;
export type GarmentWorkflowDependencies = {
  db: D1Database;
  bucket: R2Bucket;
  client: YirClient;
  /** Exact trusted hostnames configured by the operator; never take these from Yir or the browser. */
  resultHosts: readonly string[];
  /** Exact trusted Yir upload hosts, separately verified before enabling the workflow. */
  uploadHosts: readonly string[];
  fetcher?: typeof fetch;
  promptScanner?: PromptScanner;
  /** Refund one spent credit on a confirmed failure; no-ops for guest/trial tasks. */
  refund?: (requestKey: string) => Promise<void>;
  now?: () => number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const quoteKey = (id: string) => `garment-tasks/${id}/quoted-request.json`;
const resultKey = (id: string) => `garment-tasks/${id}/result.json`;
const MEDIA_KEY = /^garment-media\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function garmentUploadErrorCode(error:unknown):string {
  const message=error instanceof Error?error.message:'';
  const code=(error as {code?:unknown})?.code;
  if(typeof code==='string' && /^(?:idempotency_key_invalid|file_count_invalid|unknown_field|file_name_invalid|file_media_type_invalid|file_size_invalid|upload_source_invalid|upload_plan_invalid)$/.test(code))return code;
  return /^(?:upload_transport_failed|upload_failed:\d{3}|file_response_invalid|file_processing_failed|file_expired|file_wait_timeout|file_id_invalid|upload_source_invalid|upload_plan_invalid|Invalid garment upload URL|Invalid garment reference|Yir request failed \(\d{3}\))$/.test(message)?message:'unexpected';
}

function uploadFetcher(deps: GarmentWorkflowDependencies): typeof fetch {
  return async (target, init) => {
    const url = new URL(typeof target === 'string' ? target : target instanceof URL ? target.href : target.url);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || !deps.uploadHosts.includes(url.hostname) || init?.method !== 'PUT') throw new Error('Invalid garment upload URL');
    return (deps.fetcher ?? fetch)(url, { ...init, redirect: 'manual', credentials: 'omit' });
  };
}

async function rowFor(db: D1Database, id: string): Promise<Row> {
  if (!UUID.test(id)) throw new Error('Invalid garment task ID');
  const row = await db.prepare('SELECT id, owner_id, request_key, input_digest, status, upstream_job_id, error_code FROM garment_requests WHERE id = ?').bind(id).first<Row>();
  if (!row) throw new Error('Garment task not found');
  return row;
}

async function savedQuote(bucket: R2Bucket, row: Row): Promise<SavedQuote | null> {
  const obj = await bucket.get(quoteKey(row.id));
  if (!obj || obj.customMetadata?.ownerId !== row.owner_id || obj.customMetadata?.inputDigest !== row.input_digest || obj.size > 64 * 1024) return null;
  try {
    const data = await obj.json<SavedQuote>();
    if (!data || !data.request || !data.quote) return null;
    return data;
  } catch { return null; }
}

/**
 * Advance once. The caller may run this again after interruptions, including concurrently.
 * A submitting task without an ID is intentionally left for reconciliation, never resubmitted.
 * No provider URLs, prompts or image bytes are returned to Workflow step history.
 */
export async function advanceGarmentWorkflow(deps: GarmentWorkflowDependencies, id: string): Promise<Status> {
  let row = await rowFor(deps.db, id);
  const now = () => (deps.now ?? Date.now)();
  const requestKey = row.request_key;
  const move = (from: Status, to: Status, extra: { upstreamJobId?: string; outputKey?: string; errorCode?: string } = {}) =>
    transitionGarmentRequest(deps.db, { id, from, to, nowMs: now(), ...extra }).then((applied) => {
      if (applied && to === 'failed') void deps.refund?.(requestKey);
      return applied;
    });

  if (row.status === 'accepted') {
    await move('accepted', 'preparing');
    row = await rowFor(deps.db, id);
  }
  if (row.status === 'preparing') {
    // Reads and file uploads are safe to retry using the same Yir file keys. The first
    // complete quote wins, so concurrent preparations cannot change a claimed request.
    let saved = await savedQuote(deps.bucket, row);
    if (!saved) {
      let input: Awaited<ReturnType<typeof loadGarmentTaskInput>>;
      try { input = await loadGarmentTaskInput(deps.bucket, id, row.owner_id); }
      catch { throw new Error('Garment preparation phase: input'); }
      if (!input || await garmentInputDigest(input) !== row.input_digest) throw new Error('Garment input unavailable or mismatched');
      // Re-check the single-person rule here as well, so an already-accepted
      // task cannot bypass admission when the workflow is run.
      if (isUnsupportedMultiPersonPrompt(input.prompt)) {
        await move('preparing', 'failed', { errorCode: 'multi_person_prompt_blocked' });
        return (await rowFor(deps.db, id)).status;
      }
      if (!deps.promptScanner) throw new Error('Prompt screening unavailable');
      let promptVerdict: Awaited<ReturnType<PromptScanner['scanPrompt']>>;
      try { promptVerdict = await deps.promptScanner.scanPrompt(garmentPrompt({ hasModel: !!input.model, hasGarment: !!input.garment, instructions: input.prompt })); }
      catch { await move('preparing', 'failed', { errorCode: 'prompt_screening_unavailable' }); return (await rowFor(deps.db, id)).status; }
      if (promptVerdict.action !== 'allow') {
        await move('preparing', 'failed', { errorCode: promptVerdict.action === 'block' ? 'prompt_blocked' : 'prompt_review_required' });
        return (await rowFor(deps.db, id)).status;
      }
      let garmentFileId: string | undefined, modelFileId: string | undefined;
      try { garmentFileId = input.garment ? await uploadGarmentReference(deps.client, { taskId: id, role: 'garment', ...input.garment, fetcher: uploadFetcher(deps) }) : undefined; }
      catch (error) { throw new Error(`Garment preparation phase: garment:${garmentUploadErrorCode(error)}`); }
      try { modelFileId = input.model ? await uploadGarmentReference(deps.client, { taskId: id, role: 'model', ...input.model, fetcher: uploadFetcher(deps) }) : undefined; }
      catch (error) { throw new Error(`Garment preparation phase: model:${garmentUploadErrorCode(error)}`); }
      let quoted: SavedQuote;
      try { quoted = await quoteGarment(deps.client, { garmentFileId, modelFileId, instructions: input.prompt }); }
      catch (error) {
        if (error instanceof Error && error.message === 'Garment quote unavailable or over budget') {
          await move('preparing', 'failed', { errorCode: 'quote_unavailable_or_over_budget' });
          return (await rowFor(deps.db, id)).status;
        }
        throw error;
      }
      await deps.bucket.put(quoteKey(id), JSON.stringify(quoted), {
        onlyIf: { etagDoesNotMatch: '*' },
        httpMetadata: { contentType: 'application/json' },
        customMetadata: { ownerId: row.owner_id, inputDigest: row.input_digest },
      });
      saved = await savedQuote(deps.bucket, row);
    }
    if (!saved) throw new Error('Garment quote unavailable');
    await move('preparing', 'quoted');
    row = await rowFor(deps.db, id);
  }
  if (row.status === 'quoted') {
    const saved = await savedQuote(deps.bucket, row);
    if (!saved) throw new Error('Saved garment quote unavailable');
    if (!garmentQuoteAllowed(saved.quote, now())) {
      await move('quoted', 'failed', { errorCode: 'quote_expired_or_invalid' });
      return (await rowFor(deps.db, id)).status;
    }
    // This CAS is the only permission to call submit, even if a Workflow step retries.
    if (await move('quoted', 'submitting')) {
      try {
        const result = await submitGarment(deps.client, { taskId: id, ...saved });
        if (!await move('submitting', 'submitted', { upstreamJobId: result.upstreamJobId })) {
          // A concurrent recovery may have classified the in-flight submit as unknown.
          await move('unknown', 'submitted', { upstreamJobId: result.upstreamJobId });
        }
      } catch {
        // This includes a lost provider response or failure to persist its ID.
        // Do not log the exception or request, retry submission, or infer failure.
        await move('submitting', 'unknown', { errorCode: 'submit_outcome_unknown' });
      }
    }
    row = await rowFor(deps.db, id);
  }
  if (row.status === 'unknown' && row.upstream_job_id) {
    await move('unknown', 'submitted', { upstreamJobId: row.upstream_job_id });
    row = await rowFor(deps.db, id);
  }
  const finishStoredResult = async (ownerId: string): Promise<boolean> => {
    const manifest = await deps.bucket.get(resultKey(id));
    if (!manifest) return false;
    if (manifest.customMetadata?.ownerId !== ownerId || manifest.customMetadata?.inputDigest !== row.input_digest || manifest.size > 1024) throw new Error('Private garment result manifest invalid');
    let outputKey: unknown;
    try { outputKey = (await manifest.json<{ outputKey?: unknown }>()).outputKey; } catch { throw new Error('Private garment result manifest invalid'); }
    if (typeof outputKey !== 'string' || !MEDIA_KEY.test(outputKey)) throw new Error('Private garment result manifest invalid');
    const stored = await deps.bucket.head(outputKey);
    if (!stored || stored.customMetadata?.ownerId !== ownerId || stored.customMetadata?.kind !== 'result' || !['image/png', 'image/jpeg', 'image/webp'].includes(stored.httpMetadata?.contentType ?? '')) throw new Error('Private garment output unavailable');
    await move('result_pending', 'succeeded', { outputKey });
    return true;
  };
  // A previous attempt may have completed the R2 write but lost the D1 response.
  // Finish from the private object without depending on another provider read.
  if (row.status === 'result_pending' && await finishStoredResult(row.owner_id)) return (await rowFor(deps.db, id)).status;
  if ((row.status === 'submitted' || row.status === 'result_pending') && row.upstream_job_id) {
    // Querying the known ID is safe after a timeout or failed private transfer.
    const job = await deps.client.getJob(row.upstream_job_id);
    if (job.id !== row.upstream_job_id) throw new Error('Garment upstream job mismatch');
    if (row.status === 'submitted' && (job.status === 'failed' || job.status === 'cancelled')) {
      await move('submitted', 'failed', { errorCode: job.status === 'cancelled' ? 'upstream_cancelled' : 'upstream_failed' });
      return (await rowFor(deps.db, id)).status;
    }
    if (job.status !== 'succeeded') return row.status;
    if (row.status === 'submitted') {
      await move('submitted', 'result_pending');
      row = await rowFor(deps.db, id);
    }
    if (row.status !== 'result_pending') return row.status;
    // A concurrent transfer can still finish after expiry, so retain result_pending;
    // exgarment the provider-confirmed expiry as a durable manual-review reason.
    if (job.result?.availability === 'expired') {
      await deps.db.prepare("UPDATE garment_requests SET error_code = 'result_expired', updated_at = ? WHERE id = ? AND status = 'result_pending'").bind(now(), id).run();
      return (await rowFor(deps.db, id)).status;
    }
    if (job.result?.availability !== 'available' || job.result.files.length !== 1) return row.status;
    const file = job.result.files[0]!;
    const image = await readGarmentResult({ url: file.url, declaredType: file.media_type, allowedHosts: deps.resultHosts, fetcher: deps.fetcher });
    const key = await putPrivateImage(deps.bucket, row.owner_id, 'result', image.bytes, image.mediaType);
    // First manifest wins. Concurrent transfers can leave orphaned objects, which
    // require the site's retention cleanup; never delete an object another run owns.
    await deps.bucket.put(resultKey(id), JSON.stringify({ outputKey: key }), {
      onlyIf: { etagDoesNotMatch: '*' },
      httpMetadata: { contentType: 'application/json' },
      customMetadata: { ownerId: row.owner_id, inputDigest: row.input_digest },
    });
    if (!await finishStoredResult(row.owner_id)) throw new Error('Private garment output unavailable');
    row = await rowFor(deps.db, id);
  }
  return row.status;
}

export type GarmentWorkflowStep = {
  do<T extends string>(name: string, fn: () => Promise<T>): Promise<T>;
  sleep(name: string, duration: number): Promise<void>;
};

export type GarmentRecoveryResult = {
  status: Status;
  action: 'done' | 'retry' | 'reconcile' | 'review';
  reason: 'completed' | 'failed' | 'preparation' | 'poll' | 'transfer' | 'submission_unknown' | 'result_expired';
};

/**
 * One bounded, reentrant recovery attempt for a known upstream ID. The scheduler must back off and
 * call it again for `retry`. `reconcile` requires independently verified evidence;
 * this function never replays an uncertain chargeable submission. Direct callers must
 * verify that the original Workflow is terminal; the scheduler enforces that check.
 */
export async function recoverGarmentWorkflow(deps: GarmentWorkflowDependencies, id: string): Promise<GarmentRecoveryResult> {
  let row = await rowFor(deps.db, id);
  // Recovery must never enter preparation or submit a chargeable request. In particular,
  // do not change an in-flight submitting row; the original call may still return its ID.
  if (row.upstream_job_id && ['submitted', 'result_pending', 'unknown'].includes(row.status)) {
    try { await advanceGarmentWorkflow(deps, id); } catch { /* Keep the durable state. */ }
  }
  row = await rowFor(deps.db, id);
  if (row.status === 'succeeded') return { status: row.status, action: 'done', reason: 'completed' };
  if (row.status === 'failed') return { status: row.status, action: 'done', reason: 'failed' };
  if (row.status === 'submitting' || (row.status === 'unknown' && !row.upstream_job_id)) return { status: row.status, action: 'reconcile', reason: 'submission_unknown' };
  if (row.status === 'result_pending' && row.error_code === 'result_expired') return { status: row.status, action: 'review', reason: 'result_expired' };
  if (row.status === 'result_pending') return { status: row.status, action: 'retry', reason: 'transfer' };
  if (row.status === 'submitted' || row.status === 'unknown') return { status: row.status, action: 'retry', reason: 'poll' };
  return { status: row.status, action: 'review', reason: 'preparation' };
}

/**
 * Trusted server/operator only: caller must independently verify that this Yir ID
 * belongs to this exact task/key/account. A successful getJob alone cannot prove
 * that association. Never exgarment this function directly to a browser.
 */
export async function attachVerifiedGarmentJob(deps: GarmentWorkflowDependencies, id: string, upstreamJobId: string): Promise<GarmentRecoveryResult> {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(upstreamJobId)) throw new Error('Invalid upstream job ID');
  const row = await rowFor(deps.db, id);
  if ((row.status !== 'unknown' && row.status !== 'submitting') || (row.upstream_job_id && row.upstream_job_id !== upstreamJobId)) throw new Error('Garment task cannot accept this job ID');
  const job = await deps.client.getJob(upstreamJobId);
  if (job.id !== upstreamJobId) throw new Error('Garment upstream job mismatch');
  const move = (from: 'submitting' | 'unknown') => transitionGarmentRequest(deps.db, { id, from, to: 'submitted', nowMs: (deps.now ?? Date.now)(), upstreamJobId });
  if (!await move(row.status) && row.status === 'submitting') await move('unknown');
  const current = await rowFor(deps.db, id);
  if (current.upstream_job_id !== upstreamJobId) throw new Error('Garment task job ID was not attached');
  return recoverGarmentWorkflow(deps, id);
}

async function markWorkflowRecoveryNeeded(deps: GarmentWorkflowDependencies, id: string, code: 'workflow_retry_exhausted' | 'workflow_poll_exhausted'): Promise<Status> {
  await deps.db.prepare("UPDATE garment_requests SET error_code = COALESCE(error_code, ?), updated_at = ? WHERE id = ? AND status IN ('accepted','preparing','quoted','submitted','result_pending')").bind(code, (deps.now ?? Date.now)(), id).run();
  return (await rowFor(deps.db, id)).status;
}

/** Bounded polling: exhausted or ambiguous jobs remain recoverable in D1, never re-created. */
export async function runGarmentWorkflow(deps: GarmentWorkflowDependencies, jobId: string, step: GarmentWorkflowStep): Promise<Status> {
  for (let poll = 0; poll < 60; poll++) {
    let status: Status;
    try { status = await step.do(`garment-advance-${poll}`, () => advanceGarmentWorkflow(deps, jobId)); }
    catch { return markWorkflowRecoveryNeeded(deps, jobId, 'workflow_retry_exhausted'); }
    if (status === 'succeeded' || status === 'failed' || status === 'unknown' || status === 'submitting') return status;
    if (poll < 59) {
      try { await step.sleep(`garment-wait-${poll}`, 10_000); }
      catch { return markWorkflowRecoveryNeeded(deps, jobId, 'workflow_retry_exhausted'); }
    }
  }
  return markWorkflowRecoveryNeeded(deps, jobId, 'workflow_poll_exhausted');
}

/** Production wiring must supply the secret, private bucket and a separately verified hostname allowlist. */
export function createGarmentWorkflowDependencies(env: { DB: D1Database; GARMENT_MEDIA: R2Bucket; YIR_API_KEY: string; GARMENT_RESULT_HOSTS: string; GARMENT_UPLOAD_HOSTS: string; WAFFO_MERCHANT_ID?: string; WAFFO_PRIVATE_KEY?: string; WAFFO_ENVIRONMENT?: string }, fetcher?: typeof fetch, promptScanner?: PromptScanner, refund?: (requestKey: string) => Promise<void>): GarmentWorkflowDependencies {
  const parseHosts = (value: string | undefined) => {
    const hosts = (value ?? '').split(',').map((host) => host.trim()).filter(Boolean);
    if (!hosts.length || hosts.some((host) => !/^(?=.{1,253}$)(?:[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(host))) throw new Error('Garment provider hosts not configured');
    return hosts;
  };
  const environment = env.WAFFO_ENVIRONMENT === 'prod' || env.WAFFO_ENVIRONMENT === 'production' ? 'prod' : env.WAFFO_ENVIRONMENT === 'test' ? 'test' : undefined;
  const scanner = promptScanner ?? (env.WAFFO_MERCHANT_ID && env.WAFFO_PRIVATE_KEY && environment ? createWaffoPromptScanner({ merchantId: env.WAFFO_MERCHANT_ID, privateKey: env.WAFFO_PRIVATE_KEY, environment, fetcher }) : undefined);
  return { db: env.DB, bucket: env.GARMENT_MEDIA, client: createGarmentYirClient(env.YIR_API_KEY, fetcher), resultHosts: parseHosts(env.GARMENT_RESULT_HOSTS), uploadHosts: parseHosts(env.GARMENT_UPLOAD_HOSTS), fetcher, promptScanner: scanner, refund };
}
