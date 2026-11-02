import { validImageDimensions } from './private-media.server.ts';

type InputImage = { bytes:Uint8Array<ArrayBuffer>; mediaType:string };
type PoseInput = { prompt:string; photo?:InputImage; pose?:InputImage };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const OWNER = /^guest_[a-f0-9]{64}$/;

/** Include roles, lengths, MIME types and prompt in the digest to bind idempotency to exact input. */
export async function poseInputDigest(input:PoseInput):Promise<string> {
  const header=new TextEncoder().encode(JSON.stringify({version:1,prompt:input.prompt,photo:input.photo?[input.photo.mediaType,input.photo.bytes.length]:null,pose:input.pose?[input.pose.mediaType,input.pose.bytes.length]:null}));
  const photo=input.photo?.bytes,pose=input.pose?.bytes;
  const data=new Uint8Array(header.length+(photo?.length??0)+(pose?.length??0));
  data.set(header);let offset=header.length;
  if(photo){data.set(photo,offset);offset+=photo.length;}if(pose)data.set(pose,offset);
  const hash=await crypto.subtle.digest('SHA-256',data);
  return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');
}

/** Fixed internal keys make a replay with the same admitted digest safe; the manifest is written last. */
export async function storePoseTaskInput(bucket:R2Bucket,taskId:string,ownerId:string,input:PoseInput):Promise<void> {
  if(!UUID.test(taskId)||!OWNER.test(ownerId)||input.prompt.length>2000||(!input.pose&&!input.prompt.trim())) throw new Error('Invalid pose task input');
  for(const role of ['photo','pose'] as const) {
    const file=input[role];if(!file)continue;
    if(file.bytes.length>10*1024*1024||!validImageDimensions(file.bytes,file.mediaType))throw new Error('Invalid pose image');
  }
  const metadata={ownerId};
  for(const role of ['photo','pose'] as const) {
    const file=input[role];if(!file)continue;
    await bucket.put(`pose-tasks/${taskId}/${role}`,file.bytes,{httpMetadata:{contentType:file.mediaType},customMetadata:metadata});
  }
  const manifest={version:1,ownerId,prompt:input.prompt,photo:input.photo?.mediaType??null,pose:input.pose?.mediaType??null};
  await bucket.put(`pose-tasks/${taskId}/manifest.json`,JSON.stringify(manifest),{httpMetadata:{contentType:'application/json'},customMetadata:metadata});
}

/** Internal worker access is bound to the task's server-derived owner, never a client path. */
export async function loadPoseTaskInput(bucket:R2Bucket,taskId:string,ownerId:string):Promise<PoseInput | null> {
  if(!UUID.test(taskId)||!OWNER.test(ownerId))return null;
  const object=await bucket.get(`pose-tasks/${taskId}/manifest.json`);
  if(!object||object.customMetadata?.ownerId!==ownerId||object.size>16*1024)return null;
  let manifest:{version?:number;ownerId?:string;prompt?:string;photo?:string|null;pose?:string|null};
  try {manifest=await object.json();} catch {return null;}
  if(manifest.version!==1||manifest.ownerId!==ownerId||typeof manifest.prompt!=='string'||manifest.prompt.length>2000)return null;
  const input:PoseInput={prompt:manifest.prompt};
  for(const role of ['photo','pose'] as const) {
    const type=manifest[role];if(type===null)continue;
    if(typeof type!=='string')return null;
    const file=await bucket.get(`pose-tasks/${taskId}/${role}`);
    if(!file||file.customMetadata?.ownerId!==ownerId||file.httpMetadata?.contentType!==type||file.size>10*1024*1024)return null;
    const bytes=new Uint8Array(await file.arrayBuffer());
    if(!validImageDimensions(bytes,type))return null;
    input[role]={bytes,mediaType:type};
  }
  return input;
}
