import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { deletePoseTask, type PoseCleanupBarrier } from '../src/site/pose-cleanup.server';
import { admitPoseRequest } from '../src/site/pose-admission.server';
import { poseSessionOwner, startPoseSession } from '../src/site/pose-session.server';

const origin='https://aiposegallery.example', cookieSecret='x'.repeat(48);
const bucket=env.TEST_MEDIA as R2Bucket;
async function session() {
  const response=await startPoseSession(new Request(origin,{method:'POST',headers:{origin}}),origin,cookieSecret);
  const cookie=response.headers.get('set-cookie')!.split(';')[0]!;
  const owner=(await poseSessionOwner(new Request(origin,{headers:{cookie}}),cookieSecret))!;
  return {cookie,owner};
}
const request=(cookie:string, extra:Record<string,string>={})=>new Request(origin,{method:'POST',headers:{origin,cookie,...extra}});
async function task(owner:string,status='succeeded') {
  const nowMs=Date.now();
  const result=await admitPoseRequest(env.DB,{ownerId:owner,requestKey:`request_${crypto.randomUUID()}`,inputDigest:'a'.repeat(64),nowMs,ipHash:'1'.repeat(64), dailyIpLimit:10000, dailySiteLimit:10000,dailyOwnerLimit:10000});
  if(result.kind!=='accepted')throw new Error('admission failed');
  const outputKey=status==='succeeded'?`pose-media/${crypto.randomUUID()}`:null;
  await env.DB.prepare('UPDATE pose_requests SET status = ?, output_key = ? WHERE id = ?').bind(status,outputKey,result.id).run();
  return {id:result.id,outputKey};
}
async function seed(id:string,owner:string,outputKey:string|null) {
  const metadata={ownerId:owner};
  for(const suffix of ['manifest.json','photo','pose','quoted-request.json']) await bucket.put(`pose-tasks/${id}/${suffix}`,'private',{customMetadata:metadata});
  if(outputKey) {
    await bucket.put(outputKey,'result',{customMetadata:{ownerId:owner,kind:'result'}});
    await bucket.put(`pose-tasks/${id}/result.json`,JSON.stringify({outputKey}),{customMetadata:{ownerId:owner,inputDigest:'a'.repeat(64)}});
  }
}
// Test-only serialized, permanently sealed barrier. Real writers must share the same durable barrier.
function barrier():PoseCleanupBarrier {
  let tail=Promise.resolve();
  return {async sealAndRun(_id,run) {
    const previous=tail; let release!:()=>void;
    tail=new Promise<void>(resolve=>{release=resolve;});
    await previous;
    try{return await run();}finally{release();}
  }};
}
const deps=(gate?:PoseCleanupBarrier)=>({db:env.DB,bucket,origin,cookieSecret,barrier:gate});

describe('private task deletion in workerd',()=>{
  it('requires the signed owner, same origin and an installed write barrier',async()=>{
    const a=await session(),b=await session(),t=await task(a.owner);
    await seed(t.id,a.owner,t.outputKey);
    expect((await deletePoseTask(request(a.cookie),t.id,deps())).status).toBe(503);
    expect((await deletePoseTask(request(b.cookie),t.id,deps(barrier()))).status).toBe(404);
    expect((await deletePoseTask(request(`${a.cookie}x`),t.id,deps(barrier()))).status).toBe(401);
    expect((await deletePoseTask(request(a.cookie,{origin:'https://evil.example'}),t.id,deps(barrier()))).status).toBe(403);
    expect((await bucket.head(t.outputKey!))).not.toBeNull();
  });
  it('deletes only the owned task objects and retains its daily billing row through repeated concurrent requests',async()=>{
    const a=await session(),t=await task(a.owner); await seed(t.id,a.owner,t.outputKey);
    const other=`pose-media/${crypto.randomUUID()}`; await bucket.put(other,'keep',{customMetadata:{ownerId:a.owner,kind:'result'}});
    const gate=barrier();
    const results=await Promise.all(Array.from({length:4},()=>deletePoseTask(request(a.cookie),t.id,deps(gate))));
    expect(results.map(x=>x.status)).toEqual([200,200,200,200]);
    for(const key of [`pose-tasks/${t.id}/manifest.json`,`pose-tasks/${t.id}/photo`,`pose-tasks/${t.id}/pose`,`pose-tasks/${t.id}/quoted-request.json`,`pose-tasks/${t.id}/result.json`,t.outputKey!]) expect(await bucket.head(key)).toBeNull();
    expect(await bucket.head(other)).not.toBeNull();
    const row=await env.DB.prepare('SELECT status, output_key, day FROM pose_requests WHERE id = ?').bind(t.id).first<{status:string;output_key:string;day:string}>();
    expect(row).toMatchObject({status:'succeeded',output_key:t.outputKey,day:new Date().toISOString().slice(0,10)});
    const next=await admitPoseRequest(env.DB,{ownerId:a.owner,requestKey:`request_${crypto.randomUUID()}`,inputDigest:'b'.repeat(64),nowMs:Date.now(),ipHash:'1'.repeat(64), dailyIpLimit:10000, dailySiteLimit:10000,dailyOwnerLimit:1});
    expect(next.kind).toBe('limit');
  });
  it('does not delete active, unknown or result-pending tasks',async()=>{
    const a=await session(),gate=barrier();
    for(const status of ['accepted','preparing','quoted','submitting','submitted','unknown','result_pending']) {
      const t=await task(a.owner,status); await seed(t.id,a.owner,null);
      expect((await deletePoseTask(request(a.cookie),t.id,deps(gate))).status).toBe(409);
      expect(await bucket.head(`pose-tasks/${t.id}/photo`)).not.toBeNull();
    }
  });
  it('fails closed on ownership mismatch or inconsistent result metadata without deleting anything',async()=>{
    const a=await session(),t=await task(a.owner); await seed(t.id,a.owner,t.outputKey);
    await bucket.put(t.outputKey!,'other',{customMetadata:{ownerId:'guest_'+ 'b'.repeat(64),kind:'result'}});
    expect((await deletePoseTask(request(a.cookie),t.id,deps(barrier()))).status).toBe(503);
    expect(await bucket.head(`pose-tasks/${t.id}/photo`)).not.toBeNull();
    expect(await bucket.head(t.outputKey!)).not.toBeNull();
  });
  it('reports an R2 failure as incomplete and safely retries without touching billing rows',async()=>{
    const a=await session(),t=await task(a.owner); await seed(t.id,a.owner,t.outputKey);
    let deleted=0;
    const broken=new Proxy(bucket,{get(target,prop){if(prop==='delete')return async(key:string)=>{if(deleted++===1)throw new Error('R2 unavailable');await target.delete(key);};const value=Reflect.get(target,prop,target);return typeof value==='function'?value.bind(target):value;}});
    const gate=barrier();
    expect((await deletePoseTask(request(a.cookie),t.id,{...deps(gate),bucket:broken})).status).toBe(503);
    expect((await deletePoseTask(request(a.cookie),t.id,deps(gate))).status).toBe(200);
    expect(await env.DB.prepare('SELECT id FROM pose_requests WHERE id = ?').bind(t.id).first()).not.toBeNull();
  });
  it('rejects unexpected task keys and a result manifest pointing to a different object',async()=>{
    const a=await session(),t=await task(a.owner); await seed(t.id,a.owner,t.outputKey);
    const extra=`pose-tasks/${t.id}/unexpected`; await bucket.put(extra,'private',{customMetadata:{ownerId:a.owner}});
    expect((await deletePoseTask(request(a.cookie),t.id,deps(barrier()))).status).toBe(503);
    await bucket.delete(extra);
    await bucket.put(`pose-tasks/${t.id}/result.json`,JSON.stringify({outputKey:`pose-media/${crypto.randomUUID()}`}),{customMetadata:{ownerId:a.owner,inputDigest:'a'.repeat(64)}});
    expect((await deletePoseTask(request(a.cookie),t.id,deps(barrier()))).status).toBe(503);
    expect(await bucket.head(t.outputKey!)).not.toBeNull();
  });
  it('waits for an in-flight writer and prevents future writes when the trusted barrier enforces its contract',async()=>{
    const a=await session(),t=await task(a.owner); await seed(t.id,a.owner,t.outputKey);
    let sealed=false; let finish!:()=>void; let started!:()=>void;
    const entered=new Promise<void>(resolve=>{started=resolve;});
    const pending=new Promise<void>(resolve=>{finish=resolve;});
    const writer=async()=>{if(sealed)throw new Error('sealed'); started(); await pending; await bucket.put(`pose-tasks/${t.id}/photo`,'late',{customMetadata:{ownerId:a.owner}});};
    const writing=writer(); await entered;
    const gate:PoseCleanupBarrier={async sealAndRun(_id,run){sealed=true;await writing;return run();}};
    const deleting=deletePoseTask(request(a.cookie),t.id,deps(gate));
    // Wait until the test barrier has sealed the task before releasing the writer.
    while(!sealed)await new Promise(resolve=>setTimeout(resolve,0));
    await expect(writer()).rejects.toThrow('sealed');
    finish();
    expect((await deleting).status).toBe(200);
    expect(await bucket.head(`pose-tasks/${t.id}/photo`)).toBeNull();
  });
  it('does not seal a task that is still in progress',async()=>{
    const a=await session(),t=await task(a.owner,'result_pending');
    let called=false;
    const gate:PoseCleanupBarrier={async sealAndRun(_id,run){called=true;return run();}};
    expect((await deletePoseTask(request(a.cookie),t.id,deps(gate))).status).toBe(409);
    expect(called).toBe(false);
  });

  it('deletes a failed task without releasing its admission record',async()=>{
    const a=await session(),t=await task(a.owner,'failed'); await seed(t.id,a.owner,null);
    expect((await deletePoseTask(request(a.cookie),t.id,deps(barrier()))).status).toBe(200);
    expect(await bucket.head(`pose-tasks/${t.id}/manifest.json`)).toBeNull();
    expect(await env.DB.prepare('SELECT id FROM pose_requests WHERE id = ?').bind(t.id).first()).not.toBeNull();
  });

});
