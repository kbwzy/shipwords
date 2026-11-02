import { createPoseJob, recoverPoseJob } from './pose-jobs.server.ts';
import { poseSessionOwner, startPoseSession } from './pose-session.server.ts';
import { getPrivateImage } from './private-media.server.ts';

type Workflow = {create(options:{id:string;params:{jobId:string}}):Promise<unknown>;get(id:string):Promise<{status():Promise<{status:string}>}>};
export type PoseHttpEnv = {db:D1Database;bucket:R2Bucket;workflow:Workflow;origin:string;cookieSecret:string;ipHashSecret?:string;
  authUser?: (request:Request)=>Promise<{id:string}|null>;
  ledger?: {spend(userId:string,requestKey:string):Promise<'ok'|'insufficient'|'unavailable'>;refund(requestKey:string):Promise<void>};
};
type Job = {id:string;status:string;output_key:string|null;error_code:string|null};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});

async function visibleStatus(env:PoseHttpEnv, job:Pick<Job,'id'|'status'>):Promise<string> {
  if(job.status==='unknown')return 'needs_attention';
  if(!['accepted','preparing','quoted','submitting','submitted','result_pending'].includes(job.status))return job.status;
  if(job.status==='accepted' && !await env.bucket.head(`pose-tasks/${job.id}/manifest.json`))return 'input_required';
  try {
    const workflow=await env.workflow.get(job.id), state=await workflow.status();
    if(['errored','terminated','unknown'].includes(state.status))return job.status==='accepted' && state.status==='unknown'?'input_required':'needs_attention';
    if(state.status==='complete')return 'needs_attention';
  } catch { return job.status==='accepted'?'input_required':'needs_attention'; }
  return job.status;
}

/** Only call for enabled pose routes, after binding and canonical origin checks. */
export async function handlePoseHttp(request:Request,env:PoseHttpEnv):Promise<Response> {
  const pathname=new URL(request.url).pathname;
  if(pathname==='/api/pose/session' && request.method==='POST')return startPoseSession(request,env.origin,env.cookieSecret);
  if(pathname==='/api/pose/jobs' && request.method==='POST')return createPoseJob(request,env);
  if(pathname==='/api/pose/recover' && request.method==='GET') {
    const response=await recoverPoseJob(request,env);
    if(!response.ok)return response;
    const job=await response.json() as {id:string;status:string};
    return json({...job,status:await visibleStatus(env,job)});
  }
  const match=/^\/api\/pose\/jobs\/([^/]+)(\/result)?$/.exec(pathname);
  if(!match || request.method!=='GET' || !UUID.test(match[1]!))return json({error:'Not found'},404);
  const ownerId=await poseSessionOwner(request,env.cookieSecret);
  if(!ownerId)return json({error:'Not found'},404);
  const job=await env.db.prepare('SELECT id, status, output_key, error_code FROM pose_requests WHERE id = ? AND owner_id = ?').bind(match[1],ownerId).first<Job>();
  if(!job)return json({error:'Not found'},404);
  if(match[2]) {
    if(job.status!=='succeeded'||!job.output_key)return json({error:'Not found'},404);
    return getPrivateImage(env.bucket,ownerId,job.output_key);
  }
  const status=await visibleStatus(env,job);
  return json({id:job.id,status,...(job.status==='succeeded'&&job.output_key?{resultUrl:`/api/pose/jobs/${job.id}/result`}:{}),...(job.status==='failed'?{error:'Generation failed. Please try again.'}:{})});
}
