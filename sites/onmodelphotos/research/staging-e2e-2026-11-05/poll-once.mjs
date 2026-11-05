import { readFile, writeFile } from 'node:fs/promises';

// Polls the submitted staging job to a terminal state, verifies the result download,
// and records the settled job state. Does NOT resubmit anything.
const dir = '/Users/horin/personal/projects/游戏攻略站/天蓝/shipwords/sites/onmodelphotos/research/staging-e2e-2026-11-05';
const token = (await readFile('/tmp/onmodelphotos-staging/stage-token', 'utf8')).trim();
const cookie = (await readFile(`${dir}/staging-cookie.txt`, 'utf8')).trim();
const base = 'https://onmodelphotos-staging.penghuolin1990.workers.dev';
const submitted = JSON.parse(await readFile(`${dir}/staging-response.json`, 'utf8'));
const jobId = submitted.job.id;
const headers = { 'x-garment-stage-token': token, cookie, Origin: base };

const deadline = Date.now() + 12 * 60 * 1000;
let job = null;
while (Date.now() < deadline) {
  const res = await fetch(`${base}/api/garment/jobs/${jobId}`, { headers });
  if (res.ok) {
    job = await res.json();
    console.log(new Date().toISOString(), job.status);
    if (['succeeded', 'failed', 'canceled'].includes(job.status)) break;
  } else {
    console.log(new Date().toISOString(), `poll ${res.status}`);
    if (res.status === 404) break; // wrong cookie or lost row; stop rather than spin
  }
  await new Promise((r) => setTimeout(r, 5000));
}
if (!job) throw new Error('job never reached a readable terminal state');
await writeFile(`${dir}/poll-result.json`, JSON.stringify(job, null, 2) + '\n', { flag: 'wx', mode: 0o600 });

if (job.status === 'succeeded' && job.resultUrl) {
  const res = await fetch(`${base}${job.resultUrl}`, { headers });
  console.log('result download:', res.status, res.headers.get('content-type'));
  if (res.ok) {
    const buf = new Uint8Array(await res.arrayBuffer());
    await writeFile(`${dir}/result.png`, buf, { mode: 0o600 });
    console.log('saved result.png,', buf.length, 'bytes');
  }
}
console.log(JSON.stringify({ id: job.id, status: job.status, resultUrl: job.resultUrl ?? null }, null, 2));
