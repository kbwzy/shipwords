import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPoseYirClient, uploadPoseReference, quotePose, submitPose } from '../src/site/pose-yir.server.ts';

const bytes = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
const taskId = '11111111-1111-4111-8111-111111111111';
const json = value => new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});

test('uploads private bytes by role and submits the quoted official-channel request once', async () => {
  const seen=[];const files=new Map();let count=0;
  const fetcher=async (target, options={}) => {
    const url=new URL(target), headers=new Headers(options.headers);
    seen.push({host:url.host,path:url.pathname,method:options.method,headers,body:typeof options.body==='string'?JSON.parse(options.body):null});
    if(url.host==='upload.example.test') return new Response('',{status:200});
    if(url.pathname==='/v1/files') {
      const meta=JSON.parse(options.body).files[0],id=`file_0000000${++count}-0000-4000-8000-000000000000`;
      const value={...meta,id,object:'file',status:'pending_upload',upload:{type:'multipart',expires_at:Math.floor(Date.now()/1000)+60,parts:[{part_number:1,size:meta.size,url:'https://upload.example.test/object'}]}};
      files.set(id,value);return json({files:[value]});
    }
    if(url.pathname.endsWith('/complete')) return json({...files.get(url.pathname.split('/')[3]),status:'ready'});
    if(url.pathname==='/v1/images/quotes') return json({object:'quote',currency:'USD',model:JSON.parse(options.body).model,operation:'generate_image',input_mode:'image',parameters:JSON.parse(options.body).parameters,expires_at:Math.floor(Date.now()/1000)+60,supply:{available:true,issues:[]},primary:{kind:'fixed',amount:'0.05'},official:{kind:'fixed',amount:'0.05'},expected_amount:'0.05'});
    if(url.pathname==='/v1/images/generations') return json({id:'job_123',status:'queued'});
    throw new Error('unexpected request');
  };
  const client=createPoseYirClient('test-secret',fetcher);
  const photoFileId=await uploadPoseReference(client,{taskId,role:'photo',bytes,mediaType:'image/png',fetcher});
  const poseFileId=await uploadPoseReference(client,{taskId,role:'pose',bytes,mediaType:'image/png',fetcher});
  const quoted=await quotePose(client,{photoFileId,poseFileId,instructions:'sit'});
  assert.deepEqual(await submitPose(client,{taskId,...quoted}),{upstreamJobId:'job_123'});
  const uploads=seen.filter(x=>x.host==='upload.example.test');
  assert.equal(uploads.length,2);assert.ok(uploads.every(x=>!x.headers.has('authorization')));
  const submit=seen.filter(x=>x.path==='/v1/images/generations');
  assert.equal(submit.length,1);assert.equal(submit[0].headers.get('idempotency-key'),`pose-${taskId}`);
  assert.deepEqual(submit[0].body.input.references.map(x=>x.file_id),[photoFileId,poseFileId]);
  assert.deepEqual(submit[0].body.routing,{only:['official'],fallback:false,fidelity:'original'});
  assert.equal(submit[0].body.max_cost,'0.30');
});

test('never submits an over-budget quote and treats submit transport failure as uncertain', async () => {
  let submits=0;
  const client={quoteImage:async()=>({currency:'USD',expires_at:Math.floor(Date.now()/1000)+60,supply:{available:true},primary:{amount:'0.16'}}),submitImage:async()=>{submits++;throw Error('network');}};
  await assert.rejects(quotePose(client,{instructions:'stand'}),/over budget/);
  assert.equal(submits,0);
  client.quoteImage=async()=>({currency:'USD',expires_at:Math.floor(Date.now()/1000)+60,supply:{available:true},primary:{amount:'0.05'}});
  const quoted=await quotePose(client,{instructions:'stand'});
  await assert.rejects(submitPose(client,{taskId,...quoted}),/outcome unknown/);
  assert.equal(submits,1);
});
