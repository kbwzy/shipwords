import { admitTrialPoseRequest, poseIpPrefixHash } from './pose-admission.server.ts';
import { admitPaidPoseRequest } from './pose-admission.server.ts';
import { parsePoseRequest, PoseRequestError } from './pose-request.server.ts';
import { poseSessionOwner } from './pose-session.server.ts';
import { poseInputDigest, storePoseTaskInput } from './pose-task-input.server.ts';
import { validImageDimensions } from './private-media.server.ts';

type JobRow = {id:string;status:string};
type PoseWorkflow = {create(options:{id:string;params:{jobId:string}}):Promise<unknown>;get(id:string):Promise<{status():Promise<{status:string}>}>};
type Dependencies = {db:D1Database;bucket:R2Bucket;workflow:PoseWorkflow;origin:string;cookieSecret:string;ipHashSecret?:string;
  /** Signed-in user for billing; absent until auth is configured. */
  authUser?: (request:Request)=>Promise<{id:string}|null>;
  ledger?: {spend(userId:string,requestKey:string):Promise<'ok'|'insufficient'|'unavailable'>;refund(requestKey:string):Promise<void>};
};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const validKey=(value:string|null):value is string => !!value && /^[A-Za-z0-9_-]{8,128}$/.test(value);

/** This is a server primitive; the public route must remain closed until the workflow and retention controls are ready. */
export async function createPoseJob(request:Request,deps:Dependencies):Promise<Response> {
  if(request.headers.get('origin')!==deps.origin || request.method!=='POST')return json({error:'Forbidden'},403);
  const guestOwnerId=await poseSessionOwner(request,deps.cookieSecret);
  if(!guestOwnerId)return json({error:'Start a session before generating.'},401);
  const requestKey=request.headers.get('idempotency-key');
  if(!validKey(requestKey))return json({error:'Invalid request key.'},400);
  try {
    const nowMs=Date.now();
    const ipHash=await poseIpPrefixHash(request.headers.get('cf-connecting-ip'),deps.ipHashSecret,nowMs);
    if(!ipHash)return json({error:'Generation is temporarily unavailable.'},503);
    const parsed=await parsePoseRequest(request,deps.origin);
    const input:{prompt:string;photo?:{bytes:Uint8Array<ArrayBuffer>;mediaType:string};pose?:{bytes:Uint8Array<ArrayBuffer>;mediaType:string}}={prompt:parsed.prompt};
    for(const role of ['photo','pose'] as const) {
      const file=parsed.files[role];if(!file)continue;
      const bytes=new Uint8Array(await file.arrayBuffer());
      if(!validImageDimensions(bytes,file.type))return json({error:'Invalid image or image dimensions.'},400);
      input[role]={bytes,mediaType:file.type};
    }
    const inputDigest=await poseInputDigest(input);
    const payer=deps.authUser?await deps.authUser(request):null;
    const paid=Boolean(payer&&deps.ledger);
    const admitted=paid
      ? await admitPaidPoseRequest(deps.db,{ownerId:guestOwnerId,requestKey,inputDigest,nowMs,ipHash})
      : await admitTrialPoseRequest(deps.db,{ownerId:guestOwnerId,requestKey,inputDigest,nowMs,ipHash});
    if(admitted.kind==='limit')return json({error:paid?'Daily generation limit reached. Please try again tomorrow.':'The daily trial limit has been reached.'},429);
    if(admitted.kind==='conflict')return json({error:'This request key was already used for different input.'},409);
    if(admitted.status!=='accepted')return json({id:admitted.id,status:admitted.status},202);
    if(paid&&deps.ledger&&payer) {
      const outcome=await deps.ledger.spend(payer.id,requestKey);
      if(outcome!=='ok') {
        // Roll back the admission so the same request can be retried after buying credits.
        await deps.db.prepare('DELETE FROM pose_requests WHERE id = ? AND status = ?').bind(admitted.id,'accepted').run();
        if(outcome==='insufficient')return json({error:'Not enough credits. Buy a pack from Pricing to continue.',status:'credits_required'},402);
        return json({error:'Generation is temporarily unavailable. Please try again later.'},503);
      }
    }
    await storePoseTaskInput(deps.bucket,admitted.id,guestOwnerId,input);
    try {await deps.workflow.create({id:admitted.id,params:{jobId:admitted.id}});}
    catch {
      // A lost response or duplicate must never cause a second Workflow ID or provider key.
      try {const instance=await deps.workflow.get(admitted.id);const state=await instance.status();if(!['queued','running','paused','waiting','waitingForPause','complete'].includes(state.status))throw new Error('workflow unavailable');}
      catch {return json({error:'Could not confirm task dispatch. Check the same request before trying again.',id:admitted.id},503);}
    }
    return json({id:admitted.id,status:'accepted'},202);
  } catch(error) {
    if(error instanceof PoseRequestError)return json({error:error.message},error.status);
    return json({error:'Could not prepare the task. Check the previous request before retrying.'},503);
  }
}

/** Recovery and status queries never create jobs or call the provider. */
export async function recoverPoseJob(request:Request,deps:Pick<Dependencies,'db'|'cookieSecret'>):Promise<Response> {
  const ownerId=await poseSessionOwner(request,deps.cookieSecret),key=request.headers.get('idempotency-key');
  if(!ownerId)return json({error:'Session not found.'},401);
  if(!validKey(key))return json({error:'Invalid request key.'},400);
  const row=await deps.db.prepare('SELECT id, status FROM pose_requests WHERE owner_id = ? AND request_key = ?').bind(ownerId,key).first<JobRow>();
  return row?json(row):json({error:'Request not found.'},404);
}
