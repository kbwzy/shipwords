import { poseSessionOwner } from './pose-session.server.ts';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MEDIA=/^pose-media\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
type Row={id:string;owner_id:string;status:string;output_key:string|null;input_digest:string};

/**
 * Trusted infrastructure, not a client assertion: durably seal this task against ALL
 * future writers, drain every in-flight writer, and serialize cleanup callbacks.
 * The seal must survive crashes and retries. An ordinary mutex is insufficient.
 */
export type PoseCleanupBarrier={sealAndRun<T>(taskId:string,run:()=>Promise<T>):Promise<T>};
type Dependencies={db:D1Database;bucket:R2Bucket;origin:string;cookieSecret:string;barrier?:PoseCleanupBarrier};
const response=(status:number,message:string)=>new Response(JSON.stringify({message}),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const rowFor=(db:D1Database,id:string,owner:string)=>db.prepare('SELECT id, owner_id, status, output_key, input_digest FROM pose_requests WHERE id = ? AND owner_id = ?').bind(id,owner).first<Row>();
const terminal=(row:Row)=>row.status==='succeeded'||row.status==='failed';

/**
 * Removes known private objects only. The D1 admission row is never changed or deleted.
 * Success confirms these objects are absent in R2 under the barrier, not deletion of
 * provider copies, orphan outputs, backups, or any data outside this bucket.
 */
export async function deletePoseTask(request:Request,taskId:string,deps:Dependencies):Promise<Response> {
  if(request.method!=='POST'||request.headers.get('origin')!==deps.origin)return response(403,'Forbidden');
  const owner=await poseSessionOwner(request,deps.cookieSecret);
  if(!owner)return response(401,'Session not found');
  if(!UUID.test(taskId))return response(404,'Task not found');
  try {
    const initial=await rowFor(deps.db,taskId,owner);
    if(!initial)return response(404,'Task not found');
    if(!terminal(initial))return response(409,'Task is not finished');
    if(!deps.barrier)return response(503,'Deletion unavailable');
    return await deps.barrier.sealAndRun(taskId,async()=>{
      const row=await rowFor(deps.db,taskId,owner);
      if(!row)return response(404,'Task not found');
      if(!terminal(row))return response(409,'Task is not finished');
      if((row.status==='succeeded' && (!row.output_key||!MEDIA.test(row.output_key))) || (row.status==='failed' && row.output_key!==null))return response(503,'Deletion incomplete');
      const prefix=`pose-tasks/${taskId}/`;
      const names=['photo','pose','manifest.json','quoted-request.json','result.json'];
      const keys=names.map(name=>prefix+name);
      // Refuse unknown objects rather than claiming that an incomplete key inventory is clean.
      const listing=await deps.bucket.list({prefix,limit:1000});
      if(listing.truncated||listing.objects.some(object=>!keys.includes(object.key)))return response(503,'Deletion incomplete');
      if(row.output_key) {
        const shared=await deps.db.prepare('SELECT id FROM pose_requests WHERE output_key = ? AND id != ? LIMIT 1').bind(row.output_key,taskId).first();
        if(shared)return response(503,'Deletion incomplete');
      }
      for(const key of keys) {
        const object=await deps.bucket.head(key);
        if(object && object.customMetadata?.ownerId!==owner)return response(503,'Deletion incomplete');
      }
      const result=await deps.bucket.get(prefix+'result.json');
      if(result) {
        if(result.customMetadata?.inputDigest!==row.input_digest || result.size>1024 || !row.output_key)return response(503,'Deletion incomplete');
        let value:{outputKey?:unknown};
        try {value=await result.json();} catch {return response(503,'Deletion incomplete');}
        if(!value || value.outputKey!==row.output_key)return response(503,'Deletion incomplete');
      }
      if(row.output_key) {
        const output=await deps.bucket.head(row.output_key);
        if(output && (output.customMetadata?.ownerId!==owner || output.customMetadata?.kind!=='result'))return response(503,'Deletion incomplete');
      }
      // Delete the result first and its manifest last so a partial failure remains retryable.
      const toDelete=[...(row.output_key?[row.output_key]:[]),...keys];
      for(const key of toDelete)await deps.bucket.delete(key);
      for(const key of toDelete)if(await deps.bucket.head(key))return response(503,'Deletion incomplete');
      return response(200,'Known private task objects deleted');
    });
  } catch {return response(503,'Deletion incomplete');}
}
