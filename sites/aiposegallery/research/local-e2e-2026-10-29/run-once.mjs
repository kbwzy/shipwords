import {open,readFile,writeFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

// One chargeable local-service request. The marker is deliberately never removed;
// inspect the service and its durable state before retrying an ambiguous outcome.
const dir=dirname(fileURLToPath(import.meta.url));
const mark=await open(join(dir,'RUN-ONCE.json'),'wx',0o600);
const key=`local-e2e-${randomUUID()}`;
try {await mark.writeFile(JSON.stringify({key,at:new Date().toISOString()})+'\n');await mark.sync();} finally {await mark.close();}
const origin='http://127.0.0.1:6044',api='http://127.0.0.1:6045';
const form=new FormData();
form.set('consent','yes');form.set('prompt','Sit upright on a chair facing forward, hands on knees, feet on the floor.');
for(const [role,relative] of [['photo','../pose-edit-2026-10-29/person-source.png'],['pose','../pose-edit-2026-10-29/benchmark-3/pose-seated.png']]) {
  const bytes=await readFile(join(dir,relative));
  form.set(role,new Blob([bytes],{type:'image/png'}),`${role}.png`);
}
const response=await fetch(`${api}/generate`,{method:'POST',headers:{Origin:origin,'Idempotency-Key':key},body:form});
const job=await response.json();
await writeFile(join(dir,'response.json'),JSON.stringify({httpStatus:response.status,...job},null,2)+'\n',{flag:'wx',mode:0o600});
if(!response.ok||!job.id){console.log(`Local submit: HTTP ${response.status}`);process.exitCode=1;}
else {
  console.log(`Local task accepted: ${job.id}`);
  const deadline=Date.now()+180_000;
  while(Date.now()<deadline){
    await new Promise(resolve=>setTimeout(resolve,3000));
    const statusResponse=await fetch(`${api}/jobs/${job.id}`,{headers:{Origin:origin}});
    const status=await statusResponse.json();
    if(status.status==='succeeded'){
      const result=await fetch(`${api}/result/${job.id}`,{headers:{Origin:origin}});
      if(!result.ok)throw new Error('Local result unavailable');
      const bytes=new Uint8Array(await result.arrayBuffer());
      await writeFile(join(dir,'result.png'),bytes,{flag:'wx',mode:0o600});
      await writeFile(join(dir,'result.json'),JSON.stringify({status:'succeeded',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')},null,2)+'\n',{flag:'wx',mode:0o600});
      console.log(`Local generation succeeded: ${bytes.length} bytes`);break;
    }
    if(status.status==='failed'){await writeFile(join(dir,'result.json'),JSON.stringify({status:'failed',error:status.error},null,2)+'\n',{flag:'wx',mode:0o600});console.log('Local generation failed');process.exitCode=1;break;}
  }
}
