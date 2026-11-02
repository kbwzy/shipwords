import { env } from 'cloudflare:test';
import { expect, it } from 'vitest';
import { createPoseJob, recoverPoseJob } from '../src/site/pose-jobs.server';
import { poseSessionOwner, startPoseSession } from '../src/site/pose-session.server';
import { loadPoseTaskInput } from '../src/site/pose-task-input.server';

it('fails closed for absent or malformed Cloudflare IP and missing secret', async () => {
  const origin='https://aiposegallery.example', cookieSecret='x'.repeat(48);
  const cookie=(await startPoseSession(new Request(origin,{method:'POST',headers:{origin}}),origin,cookieSecret)).headers.get('set-cookie')!.split(';')[0]!;
  const workflow={async create(){throw new Error('must not dispatch');},async get(){throw new Error('must not query');}};
  const deps={db:env.DB,bucket:env.TEST_MEDIA as R2Bucket,workflow,origin,cookieSecret,ipHashSecret:'i'.repeat(48)};
  const request=(ip?:string)=>{const form=new FormData();form.set('consent','yes');form.set('prompt','stand');const headers=new Headers({origin,cookie,'idempotency-key':`request_${crypto.randomUUID()}`,'x-forwarded-for':'203.0.113.1'});if(ip!==undefined)headers.set('cf-connecting-ip',ip);return new Request(`${origin}/api/pose`,{method:'POST',headers,body:form});};
  for(const ip of [undefined,'invalid','203.0.113.1, 203.0.113.2','[2001:db8::1]']) expect((await createPoseJob(request(ip),deps)).status).toBe(503);
  expect((await createPoseJob(request('203.0.113.1'),{...deps,ipHashSecret:''})).status).toBe(503);
});

it('rejects multi-person instructions before creating a job', async () => {
  const origin='https://aiposegallery.example', cookieSecret='m'.repeat(48);
  const cookie=(await startPoseSession(new Request(origin,{method:'POST',headers:{origin}}),origin,cookieSecret)).headers.get('set-cookie')!.split(';')[0]!;
  const workflow={async create(){throw new Error('must not dispatch');},async get(){throw new Error('must not query');}};
  const deps={db:env.DB,bucket:env.TEST_MEDIA as R2Bucket,workflow,origin,cookieSecret,ipHashSecret:'i'.repeat(48)};
  const form=new FormData();form.set('consent','yes');form.set('prompt','Two adults embracing');
  const request=new Request(`${origin}/api/pose`,{method:'POST',headers:{origin,cookie,'idempotency-key':`request_${crypto.randomUUID()}`,'cf-connecting-ip':'203.0.113.1'},body:form});
  const response=await createPoseJob(request,deps);
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({error:'This generator creates one person per request. Rewrite the instructions for a single person.'});
});

it('uses the Cloudflare IP prefix across concurrent sessions and ignores forwarded IP headers', async () => {
  const origin='https://aiposegallery.example',cookieSecret='j'.repeat(48),ipHashSecret='k'.repeat(48);
  const workflow={async create(){},async get(){return {async status(){return {status:'queued'};}};}};
  const deps={db:env.DB,bucket:env.TEST_MEDIA as R2Bucket,workflow,origin,cookieSecret,ipHashSecret};
  const cookies=await Promise.all(Array.from({length:20},async()=> (await startPoseSession(new Request(origin,{method:'POST',headers:{origin}}),origin,cookieSecret)).headers.get('set-cookie')!.split(';')[0]!));
  const make=(cookie:string,key:string,ip:string,forwarded:string)=>{const form=new FormData();form.set('consent','yes');form.set('prompt','stand');return new Request(`${origin}/api/pose`,{method:'POST',headers:{origin,cookie,'idempotency-key':key,'cf-connecting-ip':ip,'x-forwarded-for':forwarded},body:form});};
  const keys=cookies.map(()=>`request_${crypto.randomUUID()}`);
  const responses=await Promise.all(cookies.map((cookie,i)=>createPoseJob(make(cookie,keys[i]!,`198.51.100.${i+1}`,`203.0.${i}.1`),deps)));
  expect(responses.filter(r=>r.status===202)).toHaveLength(12);
  expect(responses.filter(r=>r.status===429)).toHaveLength(8);
  const index=responses.findIndex(r=>r.status===202);
  const first=await responses[index]!.json() as {id:string};
  const retry=await createPoseJob(make(cookies[index]!,keys[index]!,'198.51.100.250','1.2.3.4'),deps);
  expect(retry.status).toBe(202);
  expect(await retry.json()).toMatchObject({id:first.id});
  const denied=responses.findIndex(r=>r.status===429);
  expect((await createPoseJob(make(cookies[denied]!,keys[denied]!,'198.51.101.1','198.51.100.1'),deps)).status).toBe(202);
});

it('deduplicates jobs, binds input and recovery to the signed owner, and treats dispatch ambiguity safely', async () => {
  const origin='https://aiposegallery.example', cookieSecret='x'.repeat(48);
  const session=async () => (await startPoseSession(new Request(origin,{method:'POST',headers:{origin}}),origin,cookieSecret)).headers.get('set-cookie')!.split(';')[0]!;
  const cookie=await session(), other=await session();
  const instances=new Set<string>();
  let uncertain=false;
  const workflow={
    async create({id}:{id:string;params:{jobId:string}}) { if (instances.has(id)) throw new Error('duplicate'); instances.add(id); if (uncertain) throw new Error('lost response'); },
    async get(id:string) { if (!instances.has(id)) throw new Error('not found'); return {async status(){return {status:uncertain?'unknown':'queued'};}}; },
  };
  const deps={db:env.DB,bucket:env.TEST_MEDIA as R2Bucket,workflow,origin,cookieSecret,ipHashSecret:'i'.repeat(48)};
  const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
  const make=(key:string, text='stand', identity=cookie, image=png) => {
    const form=new FormData();form.set('consent','yes');form.set('prompt',text);form.set('pose',new File([image], 'pose.png',{type:'image/png'}));
    return new Request(`${origin}/api/pose`,{method:'POST',headers:{origin,cookie:identity,'idempotency-key':key,'cf-connecting-ip':'203.0.113.1'},body:form});
  };
  const key=`request_${crypto.randomUUID()}`;
  const responses=await Promise.all(Array.from({length:6},()=>createPoseJob(make(key),deps)));
  expect(responses.every(r=>r.status===202)).toBe(true);
  const rows=await Promise.all(responses.map(r=>r.json() as Promise<{id:string}>));
  expect(new Set(rows.map(r=>r.id)).size).toBe(1);
  expect(instances.size).toBe(1);
  const owner=await poseSessionOwner(new Request(origin,{headers:{cookie}}),cookieSecret);
  const otherOwner=await poseSessionOwner(new Request(origin,{headers:{cookie:other}}),cookieSecret);
  expect((await loadPoseTaskInput(deps.bucket,rows[0]!.id,owner!))?.prompt).toBe('stand');
  expect(await loadPoseTaskInput(deps.bucket,rows[0]!.id,otherOwner!)).toBeNull();
  expect((await createPoseJob(make(key,'sit'),deps)).status).toBe(409);
  const recover=(identity:string)=>recoverPoseJob(new Request(origin,{headers:{cookie:identity,'idempotency-key':key}}),deps);
  expect((await recover(cookie)).status).toBe(200);
  expect((await recover(other)).status).toBe(404);
  expect((await createPoseJob(make(`request_${crypto.randomUUID()}`,'stand',cookie,new Uint8Array([1,2,3])),deps)).status).toBe(400);
  uncertain=true;
  const ambiguousKey=`request_${crypto.randomUUID()}`;
  const ambiguous=await createPoseJob(make(ambiguousKey),deps);
  expect(ambiguous.status).toBe(503);
  expect((await recoverPoseJob(new Request(origin,{headers:{cookie,'idempotency-key':ambiguousKey}}),deps)).status).toBe(200);
  uncertain=false;
  expect((await createPoseJob(make(ambiguousKey),deps)).status).toBe(202);
  expect(instances.size).toBe(2);
});
