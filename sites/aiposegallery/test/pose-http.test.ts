import { env } from 'cloudflare:test';
import { expect, it } from 'vitest';
import { handlePoseHttp } from '../src/site/pose-http.server';
import { poseSessionOwner } from '../src/site/pose-session.server';
import { putPrivateImage } from '../src/site/private-media.server';
import { admitTrialPoseRequest } from '../src/site/pose-admission.server';

it('only exposes status and private result to the owner of an admitted task',async()=>{
  const origin='https://aiposegallery.example',instances=new Set<string>();
  const workflow={async create({id}:{id:string;params:{jobId:string}}){instances.add(id);},async get(id:string){if(!instances.has(id))throw new Error('not found');return {async status(){return {status:'queued'};}};}};
  const deps={db:env.DB,bucket:env.TEST_MEDIA as R2Bucket,workflow,origin,cookieSecret:'x'.repeat(48),ipHashSecret:'i'.repeat(48)};
  const session=async()=> (await handlePoseHttp(new Request(`${origin}/api/pose/session`,{method:'POST',headers:{origin}}),deps)).headers.get('set-cookie')!.split(';')[0]!;
  const cookie=await session(),other=await session(),key=`request_${crypto.randomUUID()}`;
  const form=new FormData();form.set('consent','yes');form.set('prompt','A standing pose');
  const created=await handlePoseHttp(new Request(`${origin}/api/pose/jobs`,{method:'POST',headers:{origin,cookie,'idempotency-key':key,'cf-connecting-ip':'203.0.113.1'},body:form}),deps);
  expect(created.status).toBe(202);
  const {id}=await created.json() as {id:string};
  const get=(suffix:string,identity:string)=>handlePoseHttp(new Request(`${origin}/api/pose/jobs/${id}${suffix}`,{headers:{cookie:identity}}),deps);
  expect((await get('',other)).status).toBe(404);
  expect((await get('/result',cookie)).status).toBe(404);
  const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
  const owner=await poseSessionOwner(new Request(origin,{headers:{cookie}}),deps.cookieSecret);
  const output=await putPrivateImage(deps.bucket,owner!,'result',png,'image/png');
  await deps.db.prepare("UPDATE pose_requests SET status='succeeded', output_key=? WHERE id=?").bind(output,id).run();
  const status=await get('',cookie);
  expect(await status.json()).toMatchObject({id,status:'succeeded',resultUrl:`/api/pose/jobs/${id}/result`});
  const image=await get('/result',cookie);
  expect(image.status).toBe(200);
  expect(image.headers.get('cache-control')).toBe('private, no-store');
  expect(Array.from(new Uint8Array(await image.arrayBuffer()))).toEqual(Array.from(png));
  expect((await get('/result',other)).status).toBe(404);
  const recovered=await handlePoseHttp(new Request(`${origin}/api/pose/recover`,{headers:{cookie,'idempotency-key':key}}),deps);
  expect(await recovered.json()).toMatchObject({id,status:'succeeded'});
});

it('exposes an actionable recovery state when admission or workflow dispatch is interrupted',async()=>{
  const origin='https://aiposegallery.example',cookieSecret='y'.repeat(48);
  let state='queued', exists=false;
  const workflow={async create(){},async get(){if(!exists)throw new Error('not found');return {async status(){return {status:state};}};}};
  const deps={db:env.DB,bucket:env.TEST_MEDIA as R2Bucket,workflow,origin,cookieSecret};
  const session=await handlePoseHttp(new Request(`${origin}/api/pose/session`,{method:'POST',headers:{origin}}),deps);
  const cookie=session.headers.get('set-cookie')!.split(';')[0]!;
  const ownerId=await poseSessionOwner(new Request(origin,{headers:{cookie}}),cookieSecret);
  const key=`request_${crypto.randomUUID()}`;
  const admitted=await admitTrialPoseRequest(env.DB,{ownerId:ownerId!,requestKey:key,inputDigest:'a'.repeat(64),nowMs:Date.now(),ipHash:'1'.repeat(64)});
  if(admitted.kind!=='accepted')throw new Error('not admitted');
  const get=()=>handlePoseHttp(new Request(`${origin}/api/pose/jobs/${admitted.id}`,{headers:{cookie}}),deps).then(r=>r.json() as Promise<{status:string}>);
  expect((await get()).status).toBe('input_required');
  await deps.bucket.put(`pose-tasks/${admitted.id}/manifest.json`,'{}');
  expect((await get()).status).toBe('input_required');
  exists=true;
  expect((await get()).status).toBe('accepted');
  state='complete';
  expect((await get()).status).toBe('needs_attention');
  await env.DB.prepare("UPDATE pose_requests SET status='unknown' WHERE id=?").bind(admitted.id).run();
  expect((await get()).status).toBe('needs_attention');
});

it('lists paid pose results for the signed-in user and lets them open results without the pose session',async()=>{
  const origin='https://aiposegallery.example',userId='user_test123',instances=new Set<string>();
  const workflow={async create({id}:{id:string;params:{jobId:string}}){instances.add(id);},async get(id:string){if(!instances.has(id))throw new Error('not found');return {async status(){return {status:'queued'};}};}};
  const deps={
    db:env.DB,bucket:env.TEST_MEDIA as R2Bucket,workflow,origin,cookieSecret:'z'.repeat(48),ipHashSecret:'i'.repeat(48),
    authUser:async(request:Request)=>request.headers.get('x-test-user')===userId?{id:userId}:null,
    ledger:{spend:async()=>'ok' as const,refund:async()=>{}},
  };
  const session=async()=> (await handlePoseHttp(new Request(`${origin}/api/pose/session`,{method:'POST',headers:{origin}}),deps)).headers.get('set-cookie')!.split(';')[0]!;
  const cookie=await session(),key=`request_${crypto.randomUUID()}`;
  const form=new FormData();form.set('consent','yes');form.set('prompt','A standing pose');
  const created=await handlePoseHttp(new Request(`${origin}/api/pose/jobs`,{method:'POST',headers:{origin,cookie,'idempotency-key':key,'cf-connecting-ip':'203.0.113.5','x-test-user':userId},body:form}),deps);
  expect(created.status).toBe(202);
  const {id}=await created.json() as {id:string};

  // Anonymous list stays closed; the signed-in user sees the paid job.
  expect((await handlePoseHttp(new Request(`${origin}/api/pose/jobs`),deps)).status).toBe(404);
  const list=await handlePoseHttp(new Request(`${origin}/api/pose/jobs`,{headers:{'x-test-user':userId}}),deps);
  expect(list.status).toBe(200);
  const listed=await list.json() as {jobs:Array<{id:string;status:string}>};
  expect(listed.jobs.map(job=>job.id)).toContain(id);
  expect(listed.jobs[0]).toMatchObject({id,status:'accepted'});

  // Without the pose session cookie, the user match still grants status and result access.
  const status=await handlePoseHttp(new Request(`${origin}/api/pose/jobs/${id}`,{headers:{'x-test-user':userId}}),deps);
  expect(status.status).toBe(200);
  const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
  const owner=await poseSessionOwner(new Request(origin,{headers:{cookie}}),deps.cookieSecret);
  const output=await putPrivateImage(deps.bucket,owner!,'result',png,'image/png');
  await deps.db.prepare("UPDATE pose_requests SET status='succeeded', output_key=? WHERE id=?").bind(output,id).run();
  const image=await handlePoseHttp(new Request(`${origin}/api/pose/jobs/${id}/result`,{headers:{'x-test-user':userId}}),deps);
  expect(image.status).toBe(200);
  expect(Array.from(new Uint8Array(await image.arrayBuffer()))).toEqual(Array.from(png));
  const listedAfter=await (await handlePoseHttp(new Request(`${origin}/api/pose/jobs`,{headers:{'x-test-user':userId}}),deps)).json() as {jobs:Array<{id:string;resultUrl?:string}>};
  expect(listedAfter.jobs[0]).toMatchObject({id,resultUrl:`/api/pose/jobs/${id}/result`});
});
