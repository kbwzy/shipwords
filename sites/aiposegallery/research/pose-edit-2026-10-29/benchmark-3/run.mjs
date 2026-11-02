import { readFile, open, writeFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { createYirClient, createAndUploadFile } from '../../../../../packages/jobs/node_modules/@yir-ai/sdk/dist/server/index.js';

const dir = dirname(fileURLToPath(import.meta.url));
const site = resolve(dir, '../../..');
const personPath = resolve(dir, '../person-source.png');
const cases = [
  { name: 'walking', prompt: 'Match the second reference: natural walking stride, full body, side view. Show both feet.' },
  { name: 'seated', prompt: 'Match the second reference: sit upright facing forward on a simple chair, hands resting on knees, feet on the floor. Show the full body and feet.' },
  { name: 'upper', prompt: 'Match the second reference: upper-body portrait facing forward with chin resting on one hand. Frame the upper body as in the reference.' },
];
const common = 'The first reference is the person: preserve her facial features, dark wavy hair, skin tone, sage green long-sleeved top, terracotta trousers and beige heels where visible. The second reference supplies only the pose and framing; do not copy its person or clothing. Photographic realism, warm neutral studio background, no text or watermark. ';
const parameters = { resolution: '1K', aspect_ratio: '3:4', quality: 'medium', n: 1 };
async function durableNew(filename, value) {
  const f = await open(filename, 'wx', 0o600);
  try { await f.writeFile(JSON.stringify(value, null, 2) + '\n'); await f.sync(); } finally { await f.close(); }
}
async function event(name, data) {
  const f = await open(join(dir, `${name}.events.jsonl`), 'a', 0o600);
  try { await f.writeFile(JSON.stringify({ at: new Date().toISOString(), ...data }) + '\n'); await f.sync(); } finally { await f.close(); }
  console.log(`${name}: ${data.phase}${data.amount ? ` $${data.amount}` : ''}`);
}
function validAmount(a) { return typeof a === 'string' && /^\d+(?:\.\d+)?$/.test(a) && Number.isFinite(Number(a)); }
const transport = async ({method, path, headers, body, signal, holdMs}) => {
  let response;
  try {
    response = await fetch(`https://gateway.yir.ai${path}`, { method, headers: { Authorization: `Bearer ${apiKey}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual', signal: signal ?? AbortSignal.timeout(45000 + (holdMs ?? 0)) });
  } catch { throw new Error('network_error'); }
  if (!response.ok) throw new Error(`http_${response.status}`);
  try { return await response.json(); } catch { throw new Error('invalid_response'); }
};
let apiKey;
let current = 'run';
try {
  // A durable one-shot marker prevents any rerun from generating a new set of keys.
  await durableNew(join(dir, 'RUN-ONCE.json'), { created_at: new Date().toISOString(), policy: 'one shot; never rerun or retry failures' });
  apiKey = parseEnv(await readFile(join(site, '.dev.vars'), 'utf8')).YIR_API_KEY;
  if (!apiKey) throw new Error('missing_credential');
  const client = createYirClient(transport);
  const balance = await client.getBalance();
  if (!validAmount(balance.available_amount) || Number(balance.available_amount) < 0.90) throw new Error('insufficient_available_balance');
  await event('run', {phase:'balance_checked', currency:'USD', available_amount: balance.available_amount});
  let total = 0;
  for (const item of cases) {
    current = item.name;
    const generationKey = `pose-benchmark-${randomUUID()}`;
    const person = await readFile(personPath);
    const pose = await readFile(join(dir, `pose-${item.name}.png`));
    const digest = b => createHash('sha256').update(b).digest('hex');
    const keys = { generation: generationKey, person_upload: `${generationKey}-person`, pose_upload: `${generationKey}-pose` };
    await durableNew(join(dir, `${item.name}.idempotency.json`), { keys, person_sha256: digest(person), pose_sha256: digest(pose), model: 'openai/gpt-image-2.5-sunburst', parameters, prompt: common + item.prompt, max_cost: '0.30' });
    await event(item.name, {phase:'keys_persisted'});
    const refs = [];
    for (const [role, bytes] of [['person', person], ['pose', pose]]) {
      const f = await createAndUploadFile(client, {name:`${role}.png`,media_type:'image/png',size:bytes.length}, new Blob([bytes],{type:'image/png'}), keys[`${role}_upload`]);
      if (f.status !== 'ready') throw new Error('upload_not_ready');
      refs.push({role:'reference_image',file_id:f.id});
    }
    const request = {model:'openai/gpt-image-2.5-sunburst', input:{type:'image', prompt:common + item.prompt, references:refs}, parameters};
    const quote = await client.quoteImage(request);
    if (quote.currency !== 'USD' || quote.supply?.available !== true || !validAmount(quote.primary?.amount) || Number(quote.primary.amount) > 0.30 || (quote.expected_amount !== undefined && (!validAmount(quote.expected_amount) || Number(quote.expected_amount) > 0.30)) || !Number.isSafeInteger(quote.expires_at) || quote.expires_at <= Date.now()/1000) throw new Error('quote_rejected');
    await event(item.name, {phase:'quoted',amount:quote.primary.amount,expected_amount:quote.expected_amount ?? null,currency:'USD',expires_at:quote.expires_at});
    await event(item.name, {phase:'submitting',max_cost:'0.30'});
    const submitted = await client.submitImage({...request,max_cost:'0.30'}, generationKey);
    await event(item.name, {phase:'submitted',job_id:submitted.id});
    let job = submitted;
    const deadline = Date.now()+10*60*1000;
    while (!['succeeded','failed','cancelled'].includes(job.status)) {
      if (Date.now() > deadline) throw new Error('job_timeout');
      await client.getJobStatus(submitted.id,{waitSeconds:20});
      job = await client.getJob(submitted.id);
    }
    await event(item.name, {phase:'terminal',status:job.status,billing_status:job.billing?.status ?? 'unknown'});
    if (job.status !== 'succeeded') throw new Error('upstream_job_failed');
    while (job.billing?.status !== 'settled') {
      if (Date.now() > deadline) throw new Error('settlement_timeout');
      await new Promise(r=>setTimeout(r,3000));
      job = await client.getJob(submitted.id);
      if (job.status !== 'succeeded') throw new Error('unexpected_job_status');
    }
    const amount = job.billing?.total_charged_by_yir;
    if (job.billing?.currency !== 'USD' || !validAmount(amount)) throw new Error('invalid_settlement');
    total += Number(amount);
    await event(item.name,{phase:'settled',amount,currency:'USD'});
    if (Number(amount) > 0.30 || total > 0.90) throw new Error('budget_exceeded');
    if (job.result?.availability !== 'available' || job.result.files?.length !== 1) throw new Error('result_unavailable');
    const result = job.result.files[0];
    const resultUrl = new URL(result.url);
    if (resultUrl.protocol !== 'https:' || resultUrl.username || resultUrl.password) throw new Error('invalid_result');
    let response;
    try { response = await fetch(resultUrl,{redirect:'error',signal:AbortSignal.timeout(30000)}); } catch { throw new Error('result_download_failed'); }
    if (!response.ok) throw new Error(`download_http_${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 20*1024*1024 || !bytes.length) throw new Error('invalid_result_size');
    const isPng=bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'));
    const isJpeg=bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
    if ((!isPng && !isJpeg) || (isPng && result.media_type !== 'image/png') || (isJpeg && result.media_type !== 'image/jpeg')) throw new Error('invalid_result_type');
    const filename = `result-${item.name}.${isPng?'png':'jpg'}`;
    await writeFile(join(dir,filename),bytes,{flag:'wx',mode:0o600});
    await event(item.name,{phase:'downloaded',filename,bytes:bytes.length,sha256:digest(bytes)});
  }
  await event('run',{phase:'complete',amount:total.toFixed(6),currency:'USD'});
} catch (err) {
  const safe = /^(?:http_\d{3}|download_http_\d{3}|network_error|invalid_response|missing_credential|insufficient_available_balance|upload_not_ready|quote_rejected|job_timeout|upstream_job_failed|settlement_timeout|unexpected_job_status|invalid_settlement|budget_exceeded|result_unavailable|invalid_result|result_download_failed|invalid_result_size|invalid_result_type)$/.test(err?.message ?? '') ? err.message : (err?.code === 'EEXIST' ? 'one_shot_or_file_already_exists' : 'unexpected_error');
  if (safe !== 'one_shot_or_file_already_exists') await event(current,{phase:'stopped',reason:safe}).catch(()=>{});
  console.log(`Stopped: ${safe}. No retry.`);
  process.exitCode = 1;
}
