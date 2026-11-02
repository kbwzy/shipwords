import {open,readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

// This creates exactly one real provider task through the protected staging Worker.
// The exclusive marker preserves its key across uncertain outcomes.
const dir='/Users/horin/personal/projects/游戏攻略站/天蓝/shipwords/sites/aiposegallery/research/local-e2e-2026-10-29';
const key=`staging-e2e-${randomUUID()}`;
const marker=await open(`${dir}/STAGING-ONCE.json`,'wx',0o600);
try {await marker.writeFile(JSON.stringify({key,at:new Date().toISOString()})+'\n');await marker.sync();} finally {await marker.close();}
const token=await readFile('/tmp/aiposegallery-staging-token','utf8');
const files=await Promise.all(['../pose-edit-2026-10-29/person-source.png','../pose-edit-2026-10-29/benchmark-3/pose-seated.png'].map(async path=>Array.from(await readFile(`${dir}/${path}`))));
const task=await taskSpace(34),page=task.page('p2');
const result=await page.evaluate(async ({token,key,files})=>{
  const headers={'x-pose-stage-token':token};
  const session=await fetch('/api/pose/session',{method:'POST',headers,credentials:'same-origin'});
  if(!session.ok)return {phase:'session',status:session.status};
  const form=new FormData();form.set('consent','yes');form.set('prompt','Sit upright on a chair facing forward, hands on knees, feet on the floor.');
  form.set('photo',new Blob([new Uint8Array(files[0])],{type:'image/png'}),'photo.png');
  form.set('pose',new Blob([new Uint8Array(files[1])],{type:'image/png'}),'pose.png');
  const response=await fetch('/api/pose/jobs',{method:'POST',headers:{...headers,'Idempotency-Key':key},body:form,credentials:'same-origin'});
  let data;try{data=await response.json();}catch{data={};}
  return {phase:'submit',status:response.status,id:data.id??null,state:data.status??null,error:data.error??null};
},{token,key,files});
await writeFile(`${dir}/staging-response.json`,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(result);
