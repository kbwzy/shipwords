import { open, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

// Production-stack RUN-ONCE: one real task against the PRODUCTION D1/R2/Workflow and
// secrets (Waffo test env billing is enabled but this guest trial path spends no credits).
// Separate marker from the staging run. Cookie is persisted for the poll step.
const dir = '/Users/horin/personal/projects/游戏攻略站/天蓝/shipwords/sites/onmodelphotos/research/staging-e2e-2026-11-05';
const key = `production-e2e-${randomUUID()}`;
const marker = await open(`${dir}/PRODUCTION-ONCE.json`, 'wx', 0o600);
try {
  await marker.writeFile(JSON.stringify({ key, at: new Date().toISOString() }) + '\n');
  await marker.sync();
} finally {
  await marker.close();
}

const base = 'https://onmodelphotos.penghuolin1990.workers.dev';
const undiciRoot = '/Users/horin/personal/projects/游戏攻略站/天蓝/shipwords/node_modules/.pnpm';
const { readdirSync } = await import('node:fs');
const store = readdirSync(undiciRoot).find((n) => n.startsWith('undici@'));
const { ProxyAgent, setGlobalDispatcher } = await import(`${undiciRoot}/${store}/node_modules/undici/index.js`);
setGlobalDispatcher(new ProxyAgent('http://127.0.0.1:7890'));

const garment = await readFile('/Users/horin/personal/projects/游戏攻略站/天蓝/shipwords/sites/aiposegallery/research/garment-fidelity-2026-11-03/garment-g1-text-tee.png');
const model = await readFile('/Users/horin/personal/projects/游戏攻略站/天蓝/shipwords/sites/aiposegallery/research/pose-benchmark-2026-11-02/pose-standing.png');

const session = await fetch(`${base}/api/garment/session`, { method: 'POST', headers: { Origin: base } });
if (!session.ok) throw new Error(`session failed: ${session.status}`);
const cookie = (session.headers.get('set-cookie') ?? '').split(';')[0];
if (!cookie) throw new Error('no guest cookie');
await writeFile(`${dir}/production-cookie.txt`, cookie + '\n', { flag: 'wx', mode: 0o600 });

const form = new FormData();
form.set('consent', 'yes');
form.set('prompt', 'Show the white t-shirt on the model in a natural standing pose against a clean studio background.');
form.set('garment', new Blob([garment], { type: 'image/png' }), 'garment.png');
form.set('model', new Blob([model], { type: 'image/png' }), 'model.png');
const submit = await fetch(`${base}/api/garment/jobs`, {
  method: 'POST',
  headers: { Origin: base, 'Idempotency-Key': key, cookie },
  body: form,
});
let job = {};
try { job = await submit.json(); } catch {}
const record = { session: session.status, submit: submit.status, id: job.id ?? null, state: job.status ?? null, error: job.error ?? null };
await writeFile(`${dir}/production-response.json`, JSON.stringify(record, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify(record, null, 2));
if (!submit.ok) throw new Error('submit failed');
console.log('JOB_ID=' + job.id);
