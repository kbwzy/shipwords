// Recovery for one already-submitted job (g1-text-tee-seated, job_id from events.jsonl).
// Read-only polling of the existing job: no resubmission. Same contract as run.mjs.
import { open, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { createYirClient } from '../../../../packages/jobs/node_modules/@yir-ai/sdk/dist/server/index.js';

const dir = dirname(fileURLToPath(import.meta.url));
const site = resolve(dir, '../..');
const JOB_ID = '2117412493159567360';
const PAIR = 'g1-text-tee-seated';

const digest = (b) => createHash('sha256').update(b).digest('hex');
const validAmount = (a) => typeof a === 'string' && /^\d+(?:\.\d+)?$/.test(a) && Number.isFinite(Number(a));

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
try {
  apiKey = parseEnv(await readFile(join(site, '.dev.vars'), 'utf8')).YIR_API_KEY;
  if (!apiKey) throw new Error('missing_credential');
  const client = createYirClient(transport);

  let job = await withPollRetry(() => client.getJob(JOB_ID));
  appendEvent({ pair: PAIR, phase: 'recovery_status', status: job.status, billing_status: job.billing?.status ?? 'unknown' });
  const deadline = Date.now() + 8 * 60 * 1000;
  while (!['succeeded', 'failed', 'cancelled'].includes(job.status)) {
    if (Date.now() > deadline) throw new Error('job_timeout');
    await withPollRetry(() => client.getJobStatus(JOB_ID, { waitSeconds: 20 }));
    job = await withPollRetry(() => client.getJob(JOB_ID));
  }
  await appendEvent({ pair: PAIR, phase: 'terminal', status: job.status, billing_status: job.billing?.status ?? 'unknown' });
  if (job.status !== 'succeeded') { console.log(`Job ended ${job.status}. Recorded, no retry.`); process.exit(1); }

  while (job.billing?.status !== 'settled') {
    if (Date.now() > deadline) throw new Error('settlement_timeout');
    await new Promise((r) => setTimeout(r, 3000));
    job = await withPollRetry(() => client.getJob(JOB_ID));
    if (job.status !== 'succeeded') throw new Error('unexpected_job_status');
  }
  const amount = job.billing?.total_charged_by_yir;
  if (job.billing?.currency !== 'USD' || !validAmount(amount)) throw new Error('invalid_settlement');
  await appendEvent({ pair: PAIR, phase: 'settled', amount, currency: 'USD' });

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
  const filename = `result-${PAIR}.${isPng ? 'png' : isJpeg ? 'jpg' : 'webp'}`;
  await writeFile(join(dir, filename), bytes, { flag: 'wx', mode: 0o600 });
  await appendEvent({ pair: PAIR, phase: 'downloaded', filename, bytes: bytes.length, sha256: digest(bytes) });
} catch (err) {
  const safe = /^(?:http_\d{3}|network_error|invalid_response|missing_credential|job_timeout|upstream_failed|upstream_cancelled|settlement_timeout|unexpected_job_status|invalid_settlement|result_unavailable|invalid_result|result_download_failed|invalid_result_size|invalid_result_type)$/.test(err?.message ?? '')
    ? err.message
    : (err?.code === 'EEXIST' ? 'result_file_already_exists' : 'unexpected_error');
  await appendEvent({ pair: PAIR, phase: 'stopped', reason: safe }).catch(() => { });
  console.log(`Stopped: ${safe}. No retry.`);
  process.exitCode = 1;
}
