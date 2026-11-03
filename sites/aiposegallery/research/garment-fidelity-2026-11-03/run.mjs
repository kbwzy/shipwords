// Garment fidelity micro-test: 4 garments x 5 poses = 20 pairs.
// Question: does the two-reference pipeline reproduce a garment flat lay
// faithfully (text, logo, pattern, fabric) when a model wears it in a pose?
// Same safety pattern as ../pose-benchmark-2026-11-02/run.mjs: RUN-ONCE marker,
// per-pair idempotency, quote cap, total cap, failures never retried.
import { readFile, open, writeFile, readdir } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { createYirClient, createAndUploadFile } from '../../../../packages/jobs/node_modules/@yir-ai/sdk/dist/server/index.js';

const dir = dirname(fileURLToPath(import.meta.url));
const site = resolve(dir, '../..');
const POSE_DIR = resolve(dir, '../pose-benchmark-2026-11-02');
const GARMENTS = ['g1-text-tee', 'g2-logo-hoodie', 'g3-pattern-blouse', 'g4-sheer-chiffon'];
const POSES = ['standing', 'seated', 'turn', 'walking', 'upper'];
const MODEL = 'openai/gpt-image-2.5-sunburst';
const PARAMETERS = { resolution: '1K', aspect_ratio: '3:4', quality: 'medium', n: 1 };
const QUOTE_CAP_USD = 0.15;
const MAX_COST = '0.30';
const TOTAL_BUDGET_USD = 2.5;
// Garment-mode prompt: first reference is the product photo, not a person.
// This prompt is itself part of the test; note any wording that needs tuning.
const PROMPT = 'The first reference is a garment product photo: reproduce this exact garment faithfully — its shape, color, print pattern, logo, text, and fabric — worn by a model. Do not alter, restyle, or embellish the garment. The second reference is the pose reference: use only its body pose and composition, not its clothing or person.\nCreate one portrait-oriented e-commerce photo of a model wearing this garment, standing in a clean studio. User instructions: Use the reference pose.';

const digest = (b) => createHash('sha256').update(b).digest('hex');
const validAmount = (a) => typeof a === 'string' && /^\d+(?:\.\d+)?$/.test(a) && Number.isFinite(Number(a));

async function durableNew(filename, value) {
  const f = await open(filename, 'wx', 0o600);
  try { await f.writeFile(JSON.stringify(value, null, 2) + '\n'); await f.sync(); } finally { await f.close(); }
}
async function appendEvent(data) {
  const f = await open(join(dir, 'events.jsonl'), 'a', 0o600);
  try { await f.writeFile(JSON.stringify({ at: new Date().toISOString(), ...data }) + '\n'); await f.sync(); } finally { await f.close(); }
  console.log(`${data.pair ?? 'run'}: ${data.phase}${data.amount ? ` $${data.amount}` : ''}${data.status ? ` (${data.status})` : ''}`);
}

const transport = async ({ method, path, headers, body, signal }) => {
  let response;
  try {
    response = await fetch(`https://gateway.yir.ai${path}`, {
      method,
      headers: { Authorization: `Bearer ${apiKey}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
      signal: signal ?? AbortSignal.timeout(45000),
    });
  } catch { throw new Error('network_error'); }
  if (!response.ok) throw new Error(`http_${response.status}`);
  try { return await response.json(); } catch { throw new Error('invalid_response'); }
};

// Read-only calls (status polling) tolerate transient gateway blips: the job
// runs upstream regardless, so retrying a poll cannot double-spend or lose work.
const withPollRetry = async (fn, attempts = 6) => {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try { return await fn(); } catch (err) {
      if (!['network_error', 'invalid_response', 'http_502', 'http_503', 'http_504'].includes(err?.message)) throw err;
      lastErr = err;
      await new Promise((r) => setTimeout(r, 5000 * (i + 1)));
    }
  }
  throw lastErr;
};

let apiKey;
let current = 'run';
try {
  try {
    const existing = JSON.parse(await readFile(join(dir, 'RUN-ONCE.json'), 'utf8'));
    if (existing.created_at) await appendEvent({ phase: 'resume_existing_run', created_at: existing.created_at });
  } catch {
    await durableNew(join(dir, 'RUN-ONCE.json'), {
      created_at: new Date().toISOString(),
      policy: 'one shot; failures and uncertain outcomes are recorded, never retried',
      pairs: GARMENTS.length * POSES.length,
      budget_usd: TOTAL_BUDGET_USD,
    });
  }
  apiKey = parseEnv(await readFile(join(site, '.dev.vars'), 'utf8')).YIR_API_KEY;
  if (!apiKey) throw new Error('missing_credential');
  const client = createYirClient(transport);

  const balance = await client.getBalance();
  if (!validAmount(balance.available_amount) || Number(balance.available_amount) < TOTAL_BUDGET_USD) throw new Error('insufficient_available_balance');
  await appendEvent({ phase: 'balance_checked', currency: 'USD', available_amount: balance.available_amount });

  const garmentBytes = new Map();
  for (const g of GARMENTS) garmentBytes.set(g, await readFile(join(dir, `garment-${g}.png`)));
  const poseBytes = new Map();
  for (const q of POSES) poseBytes.set(q, await readFile(join(POSE_DIR, `pose-${q}.png`)));

  const done = new Set();
  try {
    for (const name of await readdir(dir)) {
      const m = /^result-(g\d-[a-z-]+)-(standing|seated|turn|walking|upper)\.(png|jpg|webp)$/.exec(name);
      if (m) done.add(`${m[1]}-${m[2]}`);
    }
  } catch { }
  // An idempotency record without a settled result file means the outcome is
  // unknown (submitted, then interrupted). Never resubmit: skip and record.
  const uncertain = new Set();
  try {
    for (const name of await readdir(dir)) {
      const m = /^(g\d-[a-z-]+)-(standing|seated|turn|walking|upper)\.idempotency\.json$/.exec(name);
      if (m && !done.has(`${m[1]}-${m[2]}`)) uncertain.add(`${m[1]}-${m[2]}`);
    }
  } catch { }
  if (done.size || uncertain.size) await appendEvent({ phase: 'resume_scan', already_settled: done.size, uncertain_skipped: uncertain.size });

  let total = 0;
  for (const g of GARMENTS) {
    for (const q of POSES) {
      const pair = `${g}-${q}`;
      if (done.has(pair)) { await appendEvent({ pair, phase: 'skipped_already_settled' }); continue; }
      if (uncertain.has(pair)) { await appendEvent({ pair, phase: 'skipped_uncertain_never_resubmit' }); continue; }
      current = pair;
      if (total >= TOTAL_BUDGET_USD) throw new Error('budget_exceeded');

      const generationKey = `garment-fidelity20-${randomUUID()}`;
      const keys = { generation: generationKey, garment_upload: `${generationKey}-garment`, pose_upload: `${generationKey}-pose` };
      const garment = garmentBytes.get(g), pose = poseBytes.get(q);
      await durableNew(join(dir, `${pair}.idempotency.json`), {
        keys, garment_sha256: digest(garment), pose_sha256: digest(pose),
        model: MODEL, parameters: PARAMETERS, prompt: PROMPT, max_cost: MAX_COST, quote_cap_usd: QUOTE_CAP_USD,
      });
      await appendEvent({ pair, phase: 'keys_persisted' });

      const refs = [];
      for (const [role, bytes] of [['garment', garment], ['pose', pose]]) {
        const f = await createAndUploadFile(
          client,
          { name: `${role}.png`, media_type: 'image/png', size: bytes.length },
          new Blob([bytes], { type: 'image/png' }),
          keys[`${role}_upload`],
        );
        if (f.status !== 'ready') throw new Error('upload_not_ready');
        refs.push({ role: 'reference_image', file_id: f.id });
      }
      const request = { model: MODEL, input: { type: 'image', prompt: PROMPT, references: refs }, parameters: PARAMETERS };

      const quote = await client.quoteImage(request);
      const quoteOk = quote.currency === 'USD' && quote.supply?.available === true
        && validAmount(quote.primary?.amount) && Number(quote.primary.amount) <= QUOTE_CAP_USD
        && (quote.expected_amount === undefined || (validAmount(quote.expected_amount) && Number(quote.expected_amount) <= QUOTE_CAP_USD))
        && Number.isSafeInteger(quote.expires_at) && quote.expires_at > Date.now() / 1000;
      if (!quoteOk) throw new Error('quote_rejected');
      await appendEvent({ pair, phase: 'quoted', amount: quote.primary.amount, expected_amount: quote.expected_amount ?? null, currency: 'USD' });

      await appendEvent({ pair, phase: 'submitting', max_cost: MAX_COST });
      const submitted = await client.submitImage({ ...request, max_cost: MAX_COST }, generationKey);
      if (!submitted.id) throw new Error('submit_no_id');
      await appendEvent({ pair, phase: 'submitted', job_id: submitted.id });

      let job = submitted;
      const deadline = Date.now() + 10 * 60 * 1000;
      while (!['succeeded', 'failed', 'cancelled'].includes(job.status)) {
        if (Date.now() > deadline) throw new Error('job_timeout');
        await withPollRetry(() => client.getJobStatus(submitted.id, { waitSeconds: 20 }));
        job = await withPollRetry(() => client.getJob(submitted.id));
      }
      await appendEvent({ pair, phase: 'terminal', status: job.status, billing_status: job.billing?.status ?? 'unknown' });
      if (job.status !== 'succeeded') throw new Error(`upstream_${job.status}`);

      while (job.billing?.status !== 'settled') {
        if (Date.now() > deadline) throw new Error('settlement_timeout');
        await new Promise((r) => setTimeout(r, 3000));
        job = await withPollRetry(() => client.getJob(submitted.id));
        if (job.status !== 'succeeded') throw new Error('unexpected_job_status');
      }
      const amount = job.billing?.total_charged_by_yir;
      if (job.billing?.currency !== 'USD' || !validAmount(amount)) throw new Error('invalid_settlement');
      total += Number(amount);
      await appendEvent({ pair, phase: 'settled', amount, currency: 'USD', total_so_far: total.toFixed(6) });
      if (Number(amount) > Number(MAX_COST) || total > TOTAL_BUDGET_USD) throw new Error('budget_exceeded');

      if (job.result?.availability !== 'available' || job.result.files?.length !== 1) throw new Error('result_unavailable');
      const file = job.result.files[0];
      const resultUrl = new URL(file.url);
      if (resultUrl.protocol !== 'https:' || resultUrl.username || resultUrl.password) throw new Error('invalid_result');
      let response;
      try { response = await fetch(resultUrl, { redirect: 'error', signal: AbortSignal.timeout(30000) }); } catch { throw new Error('result_download_failed'); }
      if (!response.ok) throw new Error(`download_http_${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error('invalid_result_size');
      const isPng = bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
      const isJpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      const isWebp = bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
      if ((!isPng && !isJpeg && !isWebp) || (isPng && file.media_type !== 'image/png') || (isJpeg && file.media_type !== 'image/jpeg') || (isWebp && file.media_type !== 'image/webp')) throw new Error('invalid_result_type');
      const filename = `result-${pair}.${isPng ? 'png' : isJpeg ? 'jpg' : 'webp'}`;
      await writeFile(join(dir, filename), bytes, { flag: 'wx', mode: 0o600 });
      await appendEvent({ pair, phase: 'downloaded', filename, bytes: bytes.length, sha256: digest(bytes) });
    }
  }
  await appendEvent({ phase: 'complete', amount: total.toFixed(6), currency: 'USD', settled_results: done.size + GARMENTS.length * POSES.length - done.size });
} catch (err) {
  const safe = /^(?:http_\d{3}|download_http_\d{3}|network_error|invalid_response|missing_credential|insufficient_available_balance|upload_not_ready|quote_rejected|submit_no_id|job_timeout|upstream_failed|upstream_cancelled|settlement_timeout|unexpected_job_status|invalid_settlement|budget_exceeded|result_unavailable|invalid_result|result_download_failed|invalid_result_size|invalid_result_type)$/.test(err?.message ?? '')
    ? err.message
    : (err?.code === 'EEXIST' ? 'one_shot_or_file_already_exists' : 'unexpected_error');
  if (safe !== 'one_shot_or_file_already_exists') await appendEvent({ pair: current, phase: 'stopped', reason: safe }).catch(() => { });
  console.log(`Stopped: ${safe}. No retry.`);
  process.exitCode = 1;
}
