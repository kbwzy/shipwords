import { readFile, open, writeFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { parseEnv } from 'node:util';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createYirClient, createAndUploadFile } from '../../../../packages/jobs/node_modules/@yir-ai/sdk/dist/server/index.js';
import { buildPoseQuoteRequest, buildPoseSubmitRequest, poseQuoteAllowed } from '../../src/site/pose-provider.server.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const site = resolve(dir, '../..');
const inputs = [resolve(dir, '../pose-edit-2026-10-29/person-source.png'), resolve(dir, '../pose-edit-2026-10-29/benchmark-3/pose-seated.png')];
const sha = (value) => createHash('sha256').update(value).digest('hex');
async function durable(filename, value) { const f=await open(join(dir,filename),'wx',0o600); try { await f.writeFile(JSON.stringify(value,null,2)+'\n'); await f.sync(); } finally { await f.close(); } }
async function event(value) { const f=await open(join(dir,'events.jsonl'),'a',0o600); try { await f.writeFile(JSON.stringify({at:new Date().toISOString(),...value})+'\n');await f.sync(); } finally {await f.close();} console.log(value.phase); }
let apiKey;
const transport = async ({method,path,headers,body,signal,holdMs}) => {
  let response;
  try { response=await fetch(`https://gateway.yir.ai${path}`,{method,headers:{Authorization:`Bearer ${apiKey}`,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual',signal:signal??AbortSignal.timeout(45000+(holdMs??0))}); }
  catch { throw new Error('network_error'); }
  if (!response.ok) throw new Error(`http_${response.status}`);
  try { return await response.json(); } catch { throw new Error('invalid_response'); }
};
try {
  await durable('RUN-ONCE.json',{created_at:new Date().toISOString(),policy:'one generation only; inspect existing records before any further call'});
  apiKey=parseEnv(await readFile(join(site,'.dev.vars'),'utf8')).YIR_API_KEY;
  if(!apiKey)throw new Error('missing_key');
  const client=createYirClient(transport);
  const files=await Promise.all(inputs.map((filename)=>readFile(filename)));
  const generationKey=`pose-official-${randomUUID()}`;
  const keys={generation:generationKey,photo:`${generationKey}-photo`,pose:`${generationKey}-pose`};
  await durable('idempotency.json',{keys,source_sha256:files.map(sha),model:'openai/gpt-image-2.5-sunburst',routing:{only:['official'],fallback:false,fidelity:'original'},max_cost:'0.30'});
  const refs=[];
  for (const [index, bytes] of files.entries()) {
    const kind=index===0?'photo':'pose';
    const f=await createAndUploadFile(client,{name:`${kind}.png`,media_type:'image/png',size:bytes.length},new Blob([bytes],{type:'image/png'}),keys[kind]);
    if(f.status!=='ready')throw new Error('upload_not_ready');
    refs.push(f.id);
  }
  const request=buildPoseQuoteRequest({photoFileId:refs[0],poseFileId:refs[1],instructions:'Sit upright facing forward on a chair, hands on knees, feet on the floor. Full body.'});
  const quote=await client.quoteImage(request);
  if(!poseQuoteAllowed(quote))throw new Error('quote_rejected');
  await event({phase:'quoted',currency:quote.currency,primary:quote.primary.amount,expected:quote.expected_amount??null});
  await event({phase:'submitting',max_cost:'0.30'});
  const submitted=await client.submitImage(buildPoseSubmitRequest(request),generationKey);
  await durable('upstream.json',{job_id:submitted.id});
  await event({phase:'submitted'});
  let job=submitted;const deadline=Date.now()+10*60*1000;
  while(!['succeeded','failed','cancelled'].includes(job.status)) {
    if(Date.now()>deadline)throw new Error('job_timeout');
    await client.getJobStatus(submitted.id,{waitSeconds:20});job=await client.getJob(submitted.id);
  }
  await event({phase:'terminal',status:job.status,billing_status:job.billing?.status??'unknown'});
  if(job.status!=='succeeded')throw new Error('job_failed');
  while(job.billing?.status!=='settled') {
    if(Date.now()>deadline)throw new Error('settlement_timeout');
    await new Promise(resolve=>setTimeout(resolve,3000));job=await client.getJob(submitted.id);
  }
  const amount=job.billing?.total_charged_by_yir;
  if(job.billing?.currency!=='USD'||typeof amount!=='string'||!/^\d+(?:\.\d+)?$/.test(amount)||Number(amount)>0.30)throw new Error('invalid_settlement');
  await event({phase:'settled',currency:'USD',amount});
  if(job.result?.availability!=='available'||job.result.files?.length!==1)throw new Error('result_unavailable');
  const output=job.result.files[0], url=new URL(output.url);
  if(url.protocol!=='https:'||url.username||url.password||url.port)throw new Error('invalid_result_url');
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!response.ok||!response.body||Number(response.headers.get('content-length')||0)>20*1024*1024)throw new Error('invalid_result');
  const reader=response.body.getReader();let size=0;const chunks=[];
  try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>20*1024*1024){await reader.cancel();throw new Error('invalid_result');}chunks.push(value);} } finally {reader.releaseLock();}
  const data=Buffer.concat(chunks,size), type=response.headers.get('content-type')?.split(';')[0];
  const png=data.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')),jpeg=data[0]===255&&data[1]===216&&data[2]===255;
  if((!png&&!jpeg)||(png&&type!=='image/png')||(jpeg&&type!=='image/jpeg')||type!==output.media_type)throw new Error('invalid_result');
  const filename=png?'result.png':'result.jpg';await writeFile(join(dir,filename),data,{flag:'wx',mode:0o600});
  await event({phase:'downloaded',filename,bytes:size,sha256:sha(data),result_host:url.hostname});
} catch(error) {
  const reason=/^(http_\d{3}|network_error|invalid_response|missing_key|upload_not_ready|quote_rejected|job_timeout|job_failed|settlement_timeout|invalid_settlement|result_unavailable|invalid_result_url|invalid_result)$/.test(error?.message??'')?error.message:error?.code==='EEXIST'?'already_run':'unexpected_error';
  if(reason!=='already_run')await event({phase:'stopped',reason}).catch(()=>{});
  console.log(`Stopped: ${reason}; inspect existing records before retrying.`);process.exitCode=1;
}
