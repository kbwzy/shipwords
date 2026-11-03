import { GARMENT_TRIAL_LIMITS } from './garment-limits.server.ts';

type AdmissionRow = { id: string; input_digest: string; status: string };
type AdmissionResult =
  | { kind: 'accepted'; id: string; status: string }
  | { kind: 'existing'; id: string; status: string }
  | { kind: 'conflict' }
  | { kind: 'limit' };

// Group IPv4 by /24 and IPv6 by /64. The URL parser canonicalizes IPv6;
// strict input checks prevent it from accepting hostnames, ports or zone IDs.
function ipPrefix(ip: string): string | null {
  const ipv4 = (value: string): string | null => {
    const parts=value.split('.');
    if(parts.length!==4 || parts.some(part=>!/^(0|[1-9][0-9]{0,2})$/.test(part)||Number(part)>255))return null;
    return `v4:${parts.slice(0,3).join('.')}`;
  };
  if(!ip.includes(':'))return ipv4(ip);
  if(!/^[a-fA-F0-9:.]+$/.test(ip))return null;
  // Reject noncanonical dotted suffixes before URL parsing.
  if(ip.includes('.') && !ipv4(ip.slice(ip.lastIndexOf(':')+1)))return null;
  let host:string;
  try {host=new URL(`http://[${ip}]/`).hostname.slice(1,-1);} catch {return null;}
  const halves=host.split('::');
  if(halves.length>2)return null;
  const left=halves[0]?halves[0].split(':'):[], right=halves[1]?halves[1].split(':'):[];
  const words=halves.length===2?[...left,...Array(8-left.length-right.length).fill('0'),...right]:left;
  if(words.length!==8)return null;
  const values=words.map(word=>parseInt(word,16));
  if(values.slice(0,5).every(value=>value===0)&&values[5]===0xffff) {
    return `v4:${values[6]! >> 8}.${values[6]! & 255}.${values[7]! >> 8}`;
  }
  return `v6:${values.slice(0,4).map(value=>value.toString(16).padStart(4,'0')).join(':')}`;
}

/** The caller must provide only Cloudflare's trusted cf-connecting-ip header. */
export async function garmentIpPrefixHash(ip:string|null, secret:string|undefined, nowMs:number):Promise<string|null> {
  if(typeof ip!=='string'||typeof secret!=='string'||secret.length<32||!Number.isSafeInteger(nowMs)||nowMs<0)return null;
  const prefix=ipPrefix(ip);
  if(!prefix || !Number.isFinite(new Date(nowMs).getTime()))return null;
  const day=new Date(nowMs).toISOString().slice(0,10);
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const digest=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`garment-ip-prefix:v1:${day}:${prefix}`));
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}

/**
 * Claim one daily generation slot. Caller must supply an owner from verified server auth,
 * a digest of the validated input and fixed server-side limits. One atomic SQL statement
 * enforces the budget even when several Workers submit concurrently. A claimed slot is
 * not released for failed or ambiguous upstream requests: they can still incur costs.
 */
export async function admitGarmentRequest(db: D1Database, input: {
  ownerId: string; requestKey: string; inputDigest: string; nowMs: number;
  dailySiteLimit: number; dailyOwnerLimit: number; dailyIpLimit: number; ipHash: string;
  userId?: string | null;
}): Promise<AdmissionResult> {
  const { ownerId, requestKey, inputDigest, nowMs, dailySiteLimit, dailyOwnerLimit, dailyIpLimit, ipHash, userId = null } = input;
  if (userId !== null && !/^[A-Za-z0-9_-]{4,128}$/.test(userId)) throw new Error('Invalid garment admission user');
  if (!/^[A-Za-z0-9_:-]{1,160}$/.test(ownerId) || !/^[A-Za-z0-9_-]{8,128}$/.test(requestKey) || !/^[a-f0-9]{64}$/.test(inputDigest) || !/^[a-f0-9]{64}$/.test(ipHash) || !Number.isSafeInteger(nowMs) || nowMs < 0 || !Number.isFinite(new Date(nowMs).getTime()) || [dailySiteLimit,dailyOwnerLimit,dailyIpLimit].some(limit=>!Number.isSafeInteger(limit)||limit<0||limit>10000)) throw new Error('Invalid garment admission parameters');
  const day = new Date(nowMs).toISOString().slice(0, 10);
  const id = crypto.randomUUID();
  const inserted = await db.prepare(`INSERT INTO garment_requests (id, owner_id, request_key, input_digest, day, status, created_at, ip_hash, user_id)
    SELECT ?, ?, ?, ?, ?, 'accepted', ?, ?, ?
    WHERE (SELECT count(*) FROM garment_requests WHERE day = ?) < ?
      AND (SELECT count(*) FROM garment_requests WHERE owner_id = ? AND day = ?) < ?
      AND (SELECT count(*) FROM garment_requests WHERE ip_hash = ? AND day = ?) < ?
    ON CONFLICT(owner_id, request_key) DO NOTHING
    RETURNING id, input_digest, status`).bind(id, ownerId, requestKey, inputDigest, day, nowMs, ipHash, userId, day, dailySiteLimit, ownerId, day, dailyOwnerLimit, ipHash, day, dailyIpLimit).first<AdmissionRow>();
  if (inserted) return { kind: 'accepted', id: inserted.id, status: inserted.status };
  const existing = await db.prepare('SELECT id, input_digest, status FROM garment_requests WHERE owner_id = ? AND request_key = ?').bind(ownerId, requestKey).first<AdmissionRow>();
  if (!existing) return { kind: 'limit' };
  return existing.input_digest === inputDigest ? { kind: 'existing', id: existing.id, status: existing.status } : { kind: 'conflict' };
}
/** Public trial admission always uses the server-owned limits; a request body cannot raise them. */
export function admitTrialGarmentRequest(db: D1Database, input: {ownerId:string;requestKey:string;inputDigest:string;nowMs:number;ipHash:string}) {
  return admitGarmentRequest(db, {...input, dailySiteLimit:GARMENT_TRIAL_LIMITS.dailySiteLimit, dailyOwnerLimit:GARMENT_TRIAL_LIMITS.dailyOwnerLimit, dailyIpLimit:12});
}

/** Paid requests bypass the trial budget; the generous caps are only a fail-safe backstop. */
export function admitPaidGarmentRequest(db: D1Database, input: {ownerId:string;requestKey:string;inputDigest:string;nowMs:number;ipHash:string;userId?: string|null}) {
  return admitGarmentRequest(db, {...input, dailySiteLimit:10000, dailyOwnerLimit:10000, dailyIpLimit:10000, userId: input.userId ?? null});
}
