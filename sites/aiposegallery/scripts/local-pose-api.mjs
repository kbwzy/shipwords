import http from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { open, mkdir, lstat, readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SITE = resolve(ROOT, 'sites/aiposegallery');
// dev-port derives a fixed per-site port (6043 for this site); 6044 is kept for
// older checkouts whose README suggested running the dev server there.
const ORIGINS = new Set(['http://localhost:6043', 'http://127.0.0.1:6043', 'http://localhost:6044', 'http://127.0.0.1:6044']);
const HOSTS = new Set(['localhost:6045', '127.0.0.1:6045']);
const MAX_FILE = 10 * 1024 * 1024;
const MAX_BODY = 2 * MAX_FILE + 64 * 1024;
const MAX_RESULT = 20 * 1024 * 1024;
const TTL = 30 * 60 * 1000;
const MODEL = 'openai/gpt-image-2.5-sunburst';
const PARAMETERS = Object.freeze({ resolution: '1K', aspect_ratio: '3:4', quality: 'medium', n: 1 });
const hash = data => createHash('sha256').update(data).digest('hex');
class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }

function imageType(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}
async function readLimited(stream, limit) {
  const chunks = []; let size = 0;
  const source = typeof stream.iterator === 'function' ? stream.iterator({ destroyOnReturn: false }) : stream;
  for await (const chunk of source) {
    size += chunk.length;
    if (size > limit) { stream.resume?.(); throw new ApiError(413, 'Body too large'); }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, size);
}
async function parseInput(req) {
  if (!/^multipart\/form-data\s*;/i.test(req.headers['content-type'] ?? '')) throw new ApiError(415, 'Expected multipart/form-data');
  const length = req.headers['content-length'];
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY)) throw new ApiError(413, 'Body too large');
  const bytes = await readLimited(req, MAX_BODY);
  let form;
  try { form = await new Response(bytes, { headers: { 'content-type': req.headers['content-type'] } }).formData(); }
  catch { throw new ApiError(400, 'Invalid multipart body'); }
  for (const name of form.keys()) {
    if (!['photo', 'pose', 'prompt', 'consent'].includes(name) || form.getAll(name).length !== 1) throw new ApiError(400, 'Unknown or repeated field');
  }
  const consent = form.get('consent');
  const prompt = form.get('prompt') ?? '';
  if (consent !== 'yes') throw new ApiError(400, 'Consent must be yes');
  if (typeof prompt !== 'string' || prompt.length > 2000) throw new ApiError(400, 'Invalid prompt');
  const files = {};
  for (const name of ['photo', 'pose']) {
    const file = form.get(name);
    if (file === null) continue;
    if (typeof file === 'string') throw new ApiError(400, 'Invalid image');
    if (file.size > MAX_FILE) throw new ApiError(413, 'Image too large');
    const data = Buffer.from(await file.arrayBuffer());
    if (!imageType(data) || imageType(data) !== file.type) throw new ApiError(400, 'Invalid image type or signature');
    files[name] = { name, type: file.type, data };
  }
  if (!files.pose && !prompt.trim()) throw new ApiError(400, 'Choose a pose or describe the change');
  return { files, prompt: prompt.trim() };
}
function requestDigest(input) {
  const h = createHash('sha256').update(JSON.stringify({ prompt: input.prompt }));
  for (const name of ['photo', 'pose']) {
    const file = input.files[name];
    h.update(JSON.stringify([name, file?.type ?? null, file?.data.length ?? 0]));
    if (file) h.update(file.data);
  }
  return h.digest('hex');
}
async function privateDir(dir) {
  await mkdir(dir, { mode: 0o700, recursive: true });
  const st = await lstat(dir);
  if (!st.isDirectory() || st.isSymbolicLink() || (st.mode & 0o077) !== 0 || (process.getuid && st.uid !== process.getuid())) throw new Error('Unsafe private state directory');
}
async function exclusiveFile(filename, data) {
  const f = await open(filename, 'wx', 0o600);
  try { await f.writeFile(JSON.stringify(data)); await f.sync(); } finally { await f.close(); }
}
async function syncDir(dir) {
  const fd = await open(dir, 'r');
  try { await fd.sync(); } finally { await fd.close(); }
}
function makePrompt(input) {
  let instruction;
  if (input.files.photo && input.files.pose) instruction = 'The first reference is the person photo: preserve that person’s identity, face, and clothing. The second reference is the pose reference: use only its body pose and composition, not its person, identity, face, or clothing.';
  else if (input.files.photo) instruction = 'The only reference is the person photo: preserve that person’s identity, face, and clothing while following the requested pose.';
  else if (input.files.pose) instruction = 'The only reference is a pose reference: use its body pose and composition only. Create a new person; do not copy the reference person’s identity, face, or clothing.';
  else instruction = 'Create a new person based on the requested pose.';
  return `${instruction}\nCreate one portrait-oriented image. User instructions: ${input.prompt || 'Use the reference pose.'}`;
}
function priceOK(quote) {
  const withinBudget = s => {
    if (typeof s !== 'string' || !/^\d+(?:\.\d+)?$/.test(s) || s.length > 100) return false;
    const [integer, fraction = ''] = s.split('.');
    return BigInt(integer) === 0n && (fraction + '00').slice(0, 2) <= '15' && ((fraction + '00').slice(0, 2) !== '15' || !/[1-9]/.test(fraction.slice(2)));
  };
  return quote?.currency === 'USD' && quote?.supply?.available === true && withinBudget(quote?.primary?.amount) && (quote?.expected_amount === undefined || withinBudget(quote.expected_amount)) && Number.isSafeInteger(quote.expires_at) && quote.expires_at > Date.now() / 1000;
}
async function realProvider() {
  const vars = parseEnv(await readFile(join(SITE, '.dev.vars'), 'utf8'));
  if (!vars.YIR_API_KEY) throw new Error('YIR_API_KEY missing in site .dev.vars');
  return createYirProvider(vars.YIR_API_KEY);
}
export async function createYirProvider(apiKey, networkFetch = globalThis.fetch) {
  const packageDir = join(ROOT, 'packages/jobs/node_modules/@yir-ai/sdk');
  const manifest = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8'));
  const entry = manifest.exports?.['./server']?.import;
  if (typeof entry !== 'string' || !entry.startsWith('./') || entry.includes('..')) throw new Error('Invalid SDK server export');
  const sdk = await import(pathToFileURL(join(packageDir, entry)).href);
  const client = sdk.createNodeYirClient({ apiKey, baseURL: 'https://gateway.yir.ai', fetch: networkFetch });
  return {
    upload: (file, key) => sdk.createAndUploadFile(client, { name: `${file.name}.${file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]}`, media_type: file.type, size: file.data.length }, new Blob([file.data], { type: file.type }), key, { fetch: networkFetch }),
    quote: request => client.quoteImage(request),
    submit: (request, key) => client.submitImage(request, key),
    wait: async id => {
      const end = Date.now() + 10 * 60 * 1000;
      while (Date.now() < end) {
        const status = await client.getJobStatus(id, { waitSeconds: 20 });
        if (['succeeded', 'failed', 'cancelled'].includes(status.status)) return client.getJob(id);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      throw new Error('status_unknown');
    },
    download: async url => {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('invalid_result');
      const response = await networkFetch(parsed, { redirect: 'error', signal: AbortSignal.timeout(30000) });
      if (!response.ok || !response.body || Number(response.headers.get('content-length') || 0) > MAX_RESULT) throw new Error('invalid_result');
      const bytes = await readLimited(response.body, MAX_RESULT);
      return { bytes, mediaType: response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() };
    },
  };
}

export async function createLocalPoseService({ provider, stateDir = join(tmpdir(), `aiposegallery-local-api-${process.getuid?.() ?? 'user'}`) } = {}) {
  if (process.env.NODE_ENV === 'production') throw new Error('Local service disabled in production');
  await privateDir(stateDir);
  provider ??= await realProvider();
  const jobs = new Map(); const keys = new Map();
  const lockPath = join(stateDir, 'active.lock');
  let busy = false;
  function expire() { const now = Date.now(); for (const [id, job] of jobs) if (job.finishedAt && now - job.finishedAt >= TTL) { jobs.delete(id); keys.delete(job.keyHash); } }
  async function work(job, input) {
    let uncertain = false;
    try {
      job.status = 'running';
      const refs = [];
      for (const name of ['photo', 'pose']) if (input.files[name]) {
        const file = await provider.upload(input.files[name], `${job.idempotencyKey}-${name}`);
        if (file.status !== 'ready' || typeof file.id !== 'string' || !file.id) throw new Error('upload_failed');
        refs.push({ role: 'reference_image', file_id: file.id });
      }
      const prompt = makePrompt(input);
      const request = { model: MODEL, input: refs.length ? { type: 'image', prompt, references: refs } : { type: 'text', prompt }, parameters: { ...PARAMETERS } };
      const quote = await provider.quote(request);
      if (!priceOK(quote)) throw new Error('quote_rejected');
      // The persistent key and digest were synced before this call. Unknown outcomes are never retried.
      uncertain = true;
      const upstream = await provider.submit({ ...request, max_cost: '0.30' }, job.idempotencyKey);
      if (!upstream || typeof upstream.id !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(upstream.id)) throw new Error('submission_unknown');
      await exclusiveFile(join(stateDir, `${job.keyHash}.upstream.json`), { upstreamId: upstream.id });
      await syncDir(stateDir);
      const result = await provider.wait(upstream.id);
      if (!['succeeded', 'failed', 'cancelled'].includes(result?.status)) throw new Error('status_unknown');
      uncertain = false;
      if (result.status !== 'succeeded') throw new Error('generation_failed');
      if (result.result?.availability !== 'available' || result.result.files?.length !== 1) throw new Error('result_unavailable');
      const downloaded = await provider.download(result.result.files[0].url);
      if (!Buffer.isBuffer(downloaded.bytes) || downloaded.bytes.length > MAX_RESULT || !imageType(downloaded.bytes) || imageType(downloaded.bytes) !== downloaded.mediaType || downloaded.mediaType !== result.result.files[0].media_type) throw new Error('result_invalid');
      job.image = downloaded.bytes; job.mediaType = downloaded.mediaType; job.status = 'succeeded';
    } catch (error) {
      job.status = 'failed';
      job.error = uncertain ? 'Submission or job outcome is unknown; retry is blocked. Inspect the provider before clearing the local lock.' : error?.message === 'quote_rejected' ? 'Quote unavailable, expired, or above $0.15.' : 'Generation failed before a usable result was returned.';
    } finally {
      job.finishedAt = Date.now();
      delete job.idempotencyKey;
      if (!uncertain) { try { await unlink(lockPath); } catch { job.status = 'failed'; job.error = 'Local state error; new jobs are blocked.'; } }
      busy = false;
    }
  }
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, payload) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(payload)); };
    try {
      const headerCounts = name => req.rawHeaders.filter((value, index) => index % 2 === 0 && value.toLowerCase() === name).length;
      if (headerCounts('host') !== 1 || headerCounts('origin') !== 1 || !HOSTS.has(req.headers.host) || !ORIGINS.has(origin)) throw new ApiError(403, 'Forbidden');
      res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin');
      if (req.method === 'OPTIONS') {
        const method = req.headers['access-control-request-method'];
        const headers = (req.headers['access-control-request-headers'] ?? '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
        if (!['GET', 'POST'].includes(method) || headers.some(x => !['content-type', 'idempotency-key'].includes(x))) throw new ApiError(403, 'Forbidden preflight');
        res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key', 'Access-Control-Max-Age': '600' }); return res.end();
      }
      expire();
      const url = req.url;
      if (req.method === 'GET' && url === '/health') return send(200, { available: true });
      if (req.method === 'GET' && url === '/jobs/recover') {
        const key = req.headers['idempotency-key'];
        if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(key)) throw new ApiError(400, 'Idempotency-Key required');
        const keyHash = hash(key);
        const previous = keys.get(keyHash);
        const job = previous && jobs.get(previous.id);
        if (job) return send(200, { id: job.id, status: job.status, ...(job.error ? { error: job.error } : {}), ...(job.status === 'succeeded' ? { resultUrl: `/result/${job.id}` } : {}) });
        try { await lstat(join(stateDir, `${keyHash}.json`)); throw new ApiError(410, 'Task no longer available locally; inspect provider before starting again'); }
        catch (error) { if (error instanceof ApiError) throw error; if (error.code !== 'ENOENT') throw error; }
        throw new ApiError(404, 'Task not found; check again before starting another');
      }
      const match = /^\/(jobs|result)\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/.exec(url);
      if (req.method === 'GET' && match) {
        const job = jobs.get(match[2]); if (!job) throw new ApiError(404, 'Job not found');
        if (match[1] === 'jobs') return send(200, { id: job.id, status: job.status, ...(job.error ? { error: job.error } : {}), ...(job.status === 'succeeded' ? { resultUrl: `/result/${job.id}` } : {}) });
        if (job.status !== 'succeeded') throw new ApiError(404, 'Result not available');
        res.writeHead(200, { 'Content-Type': job.mediaType, 'Content-Length': job.image.length }); return res.end(job.image);
      }
      if (req.method !== 'POST' || url !== '/generate') throw new ApiError(404, 'Not found');
      const key = req.headers['idempotency-key'];
      if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(key)) throw new ApiError(400, 'Idempotency-Key required (8-128 letters, digits, _ or -)');
      const input = await parseInput(req);
      const digest = requestDigest(input), keyHash = hash(key);
      const previous = keys.get(keyHash);
      if (previous) {
        if (previous.digest !== digest) throw new ApiError(409, 'Idempotency key already used for different input');
        return send(202, { id: previous.id, status: 'queued' });
      }
      if (busy) throw new ApiError(409, 'Another job is active or has an unknown outcome');
      busy = true;
      const id = randomUUID(); const job = { id, status: 'queued', keyHash, idempotencyKey: `pose-local-gen-${keyHash}` };
      let locked = false;
      try {
        try { await exclusiveFile(lockPath, { id, keyHash, digest }); locked = true; }
        catch (error) { if (error.code === 'EEXIST') throw new ApiError(409, 'An earlier job is active or has an unknown outcome; inspect provider before clearing local lock'); throw error; }
        try { await exclusiveFile(join(stateDir, `${keyHash}.json`), { id, digest }); }
        catch (error) { if (error.code === 'EEXIST') throw new ApiError(409, 'Idempotency key already used; automatic retry is blocked'); throw error; }
        await syncDir(stateDir);
      } catch (error) {
        if (locked) await unlink(lockPath).catch(() => {});
        busy = false; throw error;
      }
      jobs.set(id, job); keys.set(keyHash, { id, digest });
      send(202, { id, status: 'queued' });
      void work(job, input);
    } catch (error) {
      if (!res.headersSent) {
        if (error instanceof ApiError && error.status === 413) { res.setHeader('Connection', 'close'); req.resume(); }
        send(error instanceof ApiError ? error.status : 500, { error: error instanceof ApiError ? error.message : 'Local service error' });
      } else res.destroy();
    }
  });
  server.requestTimeout = 30000; server.headersTimeout = 10000;
  return { server };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { server } = await createLocalPoseService();
    server.on('error', () => { console.error('Local service failed to start.'); process.exitCode = 1; });
    server.listen(6045, '127.0.0.1', () => console.log('Local pose service listening on 127.0.0.1:6045'));
  } catch { console.error('Local service could not start; check local configuration and private state directory.'); process.exitCode = 1; }
}
