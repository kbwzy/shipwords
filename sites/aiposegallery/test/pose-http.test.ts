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
  expect((await get()).status).toBe('needs_attention');
  await deps.bucket.put(`pose-tasks/${admitted.id}/manifest.json`,'{}');
  expect((await get()).status).toBe('needs_attention');
  exists=true;
  expect((await get()).status).toBe('accepted');
  state='complete';
  expect((await get()).status).toBe('needs_attention');
  await env.DB.prepare("UPDATE pose_requests SET status='unknown' WHERE id=?").bind(admitted.id).run();
  expect((await get()).status).toBe('needs_attention');
});

it('keeps uncertain accepted guest and paid tasks safe across status, recovery and history',async()=>{
  const origin='https://aiposegallery.example',cookieSecret='s'.repeat(48);
  let workflowState='queued';
  const workflow={async create(){},async get(){if(workflowState==='get_error')throw new Error('unavailable');return {async status(){if(workflowState==='status_error')throw new Error('unavailable');return {status:workflowState};}};}};
  const deps={db:env.DB,bucket:env.TEST_MEDIA as R2Bucket,workflow,origin,cookieSecret,ipHashSecret:'i'.repeat(48),
    authUser:async(request:Request)=>{const id=request.headers.get('x-test-user');return id?{id}:null;},
    ledger:{spend:async()=>'ok' as const,refund:async()=>{}}};
  const session=async()=>(await handlePoseHttp(new Request(`${origin}/api/pose/session`,{method:'POST',headers:{origin}}),deps)).headers.get('set-cookie')!.split(';')[0]!;
  const cookie=await session(),otherCookie=await session();
  const create=async(user?:string)=>{const key=`request_${crypto.randomUUID()}`,form=new FormData();form.set('consent','yes');form.set('prompt','stand');
    const headers=new Headers({origin,cookie,'idempotency-key':key,'cf-connecting-ip':'192.0.2.43'});if(user)headers.set('x-test-user',user);
    const response=await handlePoseHttp(new Request(`${origin}/api/pose/jobs`,{method:'POST',headers,body:form}),deps);
    expect(response.status).toBe(202);return {...await response.json() as {id:string},key};};
  const guest=await create(),paid=await create('paid_owner');
  const request=(job:{id:string;key:string},kind:'status'|'recover',identity:string,user?:string)=>{
    const headers=new Headers({cookie:identity});if(user)headers.set('x-test-user',user);if(kind==='recover')headers.set('idempotency-key',job.key);
    return handlePoseHttp(new Request(`${origin}${kind==='recover'?'/api/pose/recover':`/api/pose/jobs/${job.id}`}`,{headers}),deps);
  };
  for(const state of ['unknown','errored','terminated','complete','get_error','status_error']) {
    workflowState=state;
    for(const [job,user] of [[guest,undefined],[paid,'paid_owner']] as const) {
      for(const kind of ['status','recover'] as const) {
        const response=await request(job,kind,cookie,user);
        expect(response.status,`${state} ${kind}`).toBe(200);
        expect(await response.json(),`${state} ${kind}`).toMatchObject({id:job.id,status:'needs_attention'});
      }
    }
    const list=await handlePoseHttp(new Request(`${origin}/api/pose/jobs`,{headers:{'x-test-user':'paid_owner'}}),deps);
    const body=await list.json() as {jobs:Array<{id:string;status:string}>};
    expect(body.jobs.find(job=>job.id===paid.id),state).toMatchObject({id:paid.id,status:'needs_attention'});
  }
  expect((await request(guest,'status',otherCookie)).status).toBe(404);
  expect((await request(guest,'recover',otherCookie)).status).toBe(404);
  for(const kind of ['status','recover'] as const)expect((await request(paid,kind,cookie,'other_user')).status).toBe(404);
  workflowState='queued';
  await deps.bucket.delete(`pose-tasks/${guest.id}/manifest.json`);
  await deps.bucket.delete(`pose-tasks/${paid.id}/manifest.json`);
  for(const [job,user] of [[guest,undefined],[paid,'paid_owner']] as const) {
    for(const kind of ['status','recover'] as const)expect(await (await request(job,kind,cookie,user)).json()).toMatchObject({id:job.id,status:'needs_attention'});
  }
  const list=await handlePoseHttp(new Request(`${origin}/api/pose/jobs`,{headers:{'x-test-user':'paid_owner'}}),deps);
  expect((await list.json() as {jobs:Array<{id:string;status:string}>}).jobs.find(job=>job.id===paid.id)).toMatchObject({id:paid.id,status:'needs_attention'});
});

it('enforces paid account identity for status, result and recovery while retaining guest cookie ownership',async()=>{
  const origin='https://aiposegallery.example',cookieSecret='a'.repeat(48);
  const workflow={async create(){},async get(){return {async status(){return {status:'queued'};}};}};
  const deps={db:env.DB,bucket:env.TEST_MEDIA as R2Bucket,workflow,origin,cookieSecret,ipHashSecret:'i'.repeat(48),
    authUser:async(request:Request)=>{const id=request.headers.get('x-test-user');return id?{id}:null;},
    ledger:{spend:async()=>'ok' as const,refund:async()=>{}}};
  const session=async()=>(await handlePoseHttp(new Request(`${origin}/api/pose/session`,{method:'POST',headers:{origin}}),deps)).headers.get('set-cookie')!.split(';')[0]!;
  const cookie=await session(),otherCookie=await session();
  const create=async(user?:string)=>{const key=`request_${crypto.randomUUID()}`,form=new FormData();form.set('consent','yes');form.set('prompt','stand');
    const headers=new Headers({origin,cookie,'idempotency-key':key,'cf-connecting-ip':'192.0.2.42'});if(user)headers.set('x-test-user',user);
    const response=await handlePoseHttp(new Request(`${origin}/api/pose/jobs`,{method:'POST',headers,body:form}),deps);
    expect(response.status).toBe(202);return {...await response.json() as {id:string},key};};
  const paid=await create('user_a'),guest=await create();
  const owner=await poseSessionOwner(new Request(origin,{headers:{cookie}}),cookieSecret);
  const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
  const output=await putPrivateImage(deps.bucket,owner!,'result',png,'image/png');
  for(const job of [paid,guest])await env.DB.prepare("UPDATE pose_requests SET status='succeeded', output_key=? WHERE id=?").bind(output,job.id).run();
  const request=async(job:{id:string;key:string},kind:'status'|'result'|'recover',sessionCookie?:string,user?:string)=>{
    const headers=new Headers();if(sessionCookie)headers.set('cookie',sessionCookie);if(user)headers.set('x-test-user',user);
    if(kind==='recover')headers.set('idempotency-key',job.key);
    return handlePoseHttp(new Request(`${origin}${kind==='recover'?'/api/pose/recover':`/api/pose/jobs/${job.id}${kind==='result'?'/result':''}`}`,{headers}),deps);
  };
  for(const kind of ['status','result','recover'] as const){
    expect.soft((await request(paid,kind,cookie,'user_a')).status,`paid ${kind} A`).toBe(200);
    expect.soft((await request(paid,kind,cookie,'user_b')).status,`paid ${kind} B`).toBe(404);
    expect.soft((await request(paid,kind,cookie)).status,`paid ${kind} logged out`).toBe(404);
    expect.soft((await request(guest,kind,cookie)).status,`guest ${kind} logged out`).toBe(200);
    expect.soft((await request(guest,kind,cookie,'user_b')).status,`guest ${kind} B`).toBe(200);
    expect.soft((await request(guest,kind,otherCookie,'user_a')).status,`guest ${kind} other cookie`).toBe(404);
  }
  for(const kind of ['status','result'] as const)expect.soft((await request(paid,kind,undefined,'user_a')).status,`paid ${kind} without cookie`).toBe(200);
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
