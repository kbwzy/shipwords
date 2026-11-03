const COOKIE = 'onmodelphotos_garment_gid';
const DAY_SECONDS = 86_400;
function validSecret(secret: string) { return typeof secret === 'string' && secret.length >= 32; }
async function signature(secret: string, value: string): Promise<string> {
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)));
  return Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
}
async function readSession(request:Request,secret:string,nowMs:number):Promise<string|null> {
  if(!validSecret(secret))return null;
  const entries=(request.headers.get('cookie')??'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(`${COOKIE}=`));
  if(entries.length!==1)return null;
  const parts=entries[0]!.slice(COOKIE.length+1).split('.');
  if(parts.length!==3)return null;
  const [id,expires,mac]=parts;
  if(!id||!/^g_[a-f0-9]{32}$/.test(id)||!expires||!/^\d{10}$/.test(expires)||!mac||!/^[a-f0-9]{64}$/.test(mac))return null;
  const expiry=Number(expires),now=Math.floor(nowMs/1000);
  if(!Number.isSafeInteger(now)||expiry<=now||expiry>now+DAY_SECONDS)return null;
  const expected=await signature(secret,`${id}.${expires}`);
  let difference=0;for(let i=0;i<expected.length;i++)difference|=expected.charCodeAt(i)^mac.charCodeAt(i);
  return difference===0?id:null;
}

/** Bootstrap a signed, server-expiring guest session before a potentially billable request. */
export async function startGarmentSession(request:Request,canonicalOrigin:string,secret:string,nowMs=Date.now()):Promise<Response> {
  if(request.method!=='POST'||request.headers.get('origin')!==canonicalOrigin)return new Response('Forbidden',{status:403,headers:{'Cache-Control':'no-store'}});
  if(!validSecret(secret))return new Response('Unavailable',{status:503,headers:{'Cache-Control':'no-store'}});
  const headers=new Headers({'Cache-Control':'no-store','Content-Type':'application/json'});
  if(!await readSession(request,secret,nowMs)) {
    const id=`g_${crypto.randomUUID().replaceAll('-','')}`,expires=String(Math.floor(nowMs/1000)+DAY_SECONDS);
    const value=`${id}.${expires}.${await signature(secret,`${id}.${expires}`)}`;
    headers.append('Set-Cookie',`${COOKIE}=${value}; Path=/; Max-Age=${DAY_SECONDS}; HttpOnly; Secure; SameSite=Strict`);
  }
  return new Response(JSON.stringify({ready:true}),{headers});
}

/** The owner is derived solely from a verified, unexpired HttpOnly cookie. */
export async function garmentSessionOwner(request:Request,secret:string,nowMs=Date.now()):Promise<string|null> {
  const guestId=await readSession(request,secret,nowMs);
  if(!guestId)return null;
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(guestId));
  return `guest_${Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('')}`;
}
