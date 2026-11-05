import { open, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

// This creates exactly one real provider task through the protected staging Worker
// (garment + model references, matching the two-reference pipeline validated in
// aiposegallery/research/garment-fidelity-2026-11-03). The exclusive marker file is
// created before anything else so an interrupted run still preserves the idempotency
// key: on rerun the Worker replays the same job instead of double-charging.
const dir = '/Users/horin/personal/projects/游戏攻略站/天蓝/shipwords/sites/onmodelphotos/research/staging-e2e-2026-11-05';
const key = `staging-garment-e2e-${randomUUID()}`;
const marker = await open(`${dir}/STAGING-ONCE.json`, 'wx', 0o600);
try {
  await marker.writeFile(JSON.stringify({ key, at: new Date().toISOString() }) + '\n');
  await marker.sync();
} finally {
  await marker.close();
}

const token = (await readFile('/tmp/onmodelphotos-staging/stage-token', 'utf8')).trim();
const files = await Promise.all([
  // Garment first, model second — the reference order the prompt text and provider assume.
  '../garment-fidelity-2026-11-03/garment-g1-text-tee.png'.replace('../', '/Users/horin/personal/projects/游戏攻略站/天蓝/shipwords/sites/aiposegallery/research/'),
  '/Users/horin/personal/projects/游戏攻略站/天蓝/shipwords/sites/aiposegallery/research/pose-benchmark-2026-11-02/pose-standing.png',
].map(async (path) => Array.from(await readFile(path))));

// Node fetch goes through the local proxy because workers.dev is DNS-poisoned here.
// undici is not a workspace dependency, so resolve it from the pnpm store directly.
const proxy = 'http://127.0.0.1:7890';
const base = 'https://onmodelphotos-staging.penghuolin1990.workers.dev';
let undiciLoaded = false;
for (const root of ['/Users/horin/personal/projects/游戏攻略站/天蓝/shipwords/node_modules/.pnpm',
                    '/Users/horin/personal/projects/游戏攻略站/天蓝/shipwords/sites/onmodelphotos/node_modules/.pnpm']) {
  try {
    const { readdirSync } = await import('node:fs');
    const store = readdirSync(root).find((n) => n.startsWith('undici@'));
    if (!store) continue;
    const { ProxyAgent, setGlobalDispatcher } = await import(`${root}/${store}/node_modules/undici/index.js`);
    setGlobalDispatcher(new ProxyAgent(proxy));
    undiciLoaded = true;
    break;
  } catch { /* try next root */ }
}
if (!undiciLoaded) {
  console.error('proxy setup failed, aborting before any request');
  process.exit(1);
}

const headers = {
  'x-garment-stage-token': token,
  // startGarmentSession rejects requests whose Origin differs from the canonical origin.
  Origin: base,
};
const steps = [];

// 1. Guest session (sets the guest cookie).
const session = await fetch(`${base}/api/garment/session`, { method: 'POST', headers });
steps.push({ step: 'session', status: session.status, cookie: session.headers.get('set-cookie')?.split(';')[0] ?? null });
if (!session.ok) throw new Error(`session failed: ${session.status}`);
const setCookie = session.headers.get('set-cookie') ?? '';
const cookie = setCookie.split(';')[0];
if (!cookie) throw new Error('no guest cookie issued');
// The job GET /result endpoints are owner-scoped to this cookie; persist it in the
// run record so the poll step can read the job without a browser.
await writeFile(`${dir}/staging-cookie.txt`, cookie + '\n', { flag: 'wx', mode: 0o600 });

// 2. Submit the job (garment + model, brief instructions) with the idempotency key.
const form = new FormData();
form.set('consent', 'yes');
form.set('prompt', 'Show the white t-shirt on the model in a natural standing pose against a clean studio background.');
form.set('garment', new Blob([new Uint8Array(files[0])], { type: 'image/png' }), 'garment.png');
form.set('model', new Blob([new Uint8Array(files[1])], { type: 'image/png' }), 'model.png');
const submit = await fetch(`${base}/api/garment/jobs`, {
  method: 'POST',
  headers: { ...headers, 'Idempotency-Key': key, cookie },
  body: form,
});
let job;
try { job = await submit.json(); } catch { job = {}; }
steps.push({ step: 'submit', status: submit.status, id: job.id ?? null, state: job.status ?? null, error: job.error ?? null });
await writeFile(`${dir}/staging-response.json`, JSON.stringify({ steps, job }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify(steps, null, 2));
if (!submit.ok) throw new Error('submit failed');
console.log('JOB_ID=' + job.id);
