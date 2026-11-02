import { env } from 'cloudflare:test';
import { expect, it } from 'vitest';
import { handlePoseHttp } from '../src/site/pose-http.server';
import { advancePoseWorkflow, createPoseWorkflowDependencies } from '../src/site/pose-workflow.server';

it('connects session, admission, private input, mocked provider, private output and recovery',async()=>{
  const origin='https://aiposegallery.example', cookieSecret='z'.repeat(48), jobs=new Set<string>();
  const workflow={async create({id}:{id:string;params:{jobId:string}}){jobs.add(id);},async get(id:string){if(!jobs.has(id))throw new Error('missing');return {async status(){return {status:'running'};}};}};
  const bucket=env.TEST_MEDIA as R2Bucket, deps={db:env.DB,bucket,workflow,origin,cookieSecret,ipHashSecret:'i'.repeat(48)};
  const session=await handlePoseHttp(new Request(`${origin}/api/pose/session`,{method:'POST',headers:{origin}}),deps);
  const cookie=session.headers.get('set-cookie')!.split(';')[0]!;
  const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
  const key=`request_${crypto.randomUUID()}`,form=new FormData();
  form.set('consent','yes');form.set('prompt','Sit comfortably');form.set('pose',new File([png],'pose.png',{type:'image/png'}));
  const create=await handlePoseHttp(new Request(`${origin}/api/pose/jobs`,{method:'POST',headers:{origin,cookie,'idempotency-key':key,'cf-connecting-ip':'203.0.113.1'},body:form}),deps);
  expect(create.status).toBe(202);
  const {id}=await create.json() as {id:string};
  let submissions=0;
  const json=(v:unknown)=>new Response(JSON.stringify(v),{headers:{'content-type':'application/json'}});
  const fetcher:typeof fetch=async(target,init={})=>{
    const url=new URL(typeof target==='string'?target:target instanceof URL?target.href:target.url);
    if(url.hostname==='upload.example.test')return new Response(null,{status:200});
    if(url.hostname==='cdn.example.test')return new Response(png,{headers:{'content-type':'image/png'}});
    if(url.hostname!=='gateway.yir.ai')throw new Error('unexpected host');
    if(url.pathname==='/v1/files')return json({files:[{id:'file_12345678-1234-4234-8234-123456789abc',name:'pose.png',media_type:'image/png',size:png.length,object:'file',status:'pending_upload',upload:{type:'multipart',expires_at:Math.floor(Date.now()/1000)+60,parts:[{part_number:1,size:png.length,url:'https://upload.example.test/object'}]}}]});
    if(url.pathname.endsWith('/complete'))return json({id:'file_12345678-1234-4234-8234-123456789abc',name:'pose.png',media_type:'image/png',size:png.length,object:'file',status:'ready'});
    if(url.pathname==='/v1/images/quotes')return json({object:'quote',currency:'USD',model:'openai/gpt-image-2.5-sunburst',operation:'generate_image',input_mode:'image',parameters:JSON.parse(init.body as string).parameters,expires_at:Math.floor(Date.now()/1000)+60,supply:{available:true,issues:[]},primary:{kind:'fixed',amount:'0.05'},official:{kind:'fixed',amount:'0.05'},expected_amount:'0.05'});
    if(url.pathname==='/v1/images/generations'){submissions++;return json({id:'job_123',status:'queued'});}
    if(url.pathname==='/v1/jobs/job_123')return json({id:'job_123',status:'succeeded',result:{availability:'available',files:[{url:'https://cdn.example.test/result',media_type:'image/png'}]}});
    throw new Error('unexpected path');
  };
  const provider=createPoseWorkflowDependencies({DB:env.DB,POSE_MEDIA:bucket,YIR_API_KEY:'test-only',POSE_UPLOAD_HOSTS:'upload.example.test',POSE_RESULT_HOSTS:'cdn.example.test'},fetcher,{scanPrompt:async()=>({action:'allow'})});
  expect(await advancePoseWorkflow(provider,id)).toBe('succeeded');
  expect(await advancePoseWorkflow(provider,id)).toBe('succeeded');
  expect(submissions).toBe(1);
  const recovered=await handlePoseHttp(new Request(`${origin}/api/pose/recover`,{headers:{cookie,'idempotency-key':key}}),deps);
  expect(await recovered.json()).toMatchObject({id,status:'succeeded'});
  const status=await handlePoseHttp(new Request(`${origin}/api/pose/jobs/${id}`,{headers:{cookie}}),deps);
  const body=await status.json() as {resultUrl:string};
  const result=await handlePoseHttp(new Request(`${origin}${body.resultUrl}`,{headers:{cookie}}),deps);
  expect(result.status).toBe(200);
  expect(Array.from(new Uint8Array(await result.arrayBuffer()))).toEqual(Array.from(png));
  expect((await handlePoseHttp(new Request(`${origin}${body.resultUrl}`),deps)).status).toBe(404);
});
