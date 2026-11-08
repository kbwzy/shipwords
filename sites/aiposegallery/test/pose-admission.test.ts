import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { admitPoseRequest, admitTrialPoseRequest, poseIpPrefixHash } from '../src/site/pose-admission.server';

describe('pose admission in D1', () => {
  it('groups normalized prefixes with a secret and UTC day, without exposing an address', async () => {
    const day=Date.UTC(2060,0,1), secret='s'.repeat(48);
    const hash=await poseIpPrefixHash('203.0.113.1',secret,day);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(await poseIpPrefixHash('203.0.113.254',secret,day)).toBe(hash);
    expect(await poseIpPrefixHash('203.0.114.1',secret,day)).not.toBe(hash);
    expect(await poseIpPrefixHash('203.0.113.1',secret,day+86_400_000)).not.toBe(hash);
    expect(await poseIpPrefixHash('203.0.113.1','t'.repeat(48),day)).not.toBe(hash);
    expect(await poseIpPrefixHash('2001:db8:0:1::1',secret,day)).toBe(await poseIpPrefixHash('2001:0db8:0000:0001:abcd::2',secret,day));
    expect(await poseIpPrefixHash('2001:db8:0:1::1',secret,day)).not.toBe(await poseIpPrefixHash('2001:db8:0:2::1',secret,day));
    expect(await poseIpPrefixHash('::ffff:203.0.113.1',secret,day)).toBe(hash);
    for(const bad of ['','1.2.3.999','01.2.3.4','2001:db8::1%eth0','1.2.3.4:80','1.2.3.4, 5.6.7.8']) expect(await poseIpPrefixHash(bad,secret,day)).toBeNull();
  });

  it('enforces a shared 12 request IP-prefix cap atomically and keeps retries free', async () => {
    const nowMs=Date.UTC(2061,0,1), prefix=crypto.randomUUID(), inputDigest='a'.repeat(64), secret='i'.repeat(48);
    const ipHash=(await poseIpPrefixHash('203.0.113.8',secret,nowMs))!;
    const requests=Array.from({length:60},(_,i)=>({ownerId:`owner_${prefix}_${i}`,requestKey:`request-${String(i).padStart(8,'0')}`,inputDigest,nowMs,ipHash}));
    const results=await Promise.all(requests.map(input=>admitTrialPoseRequest(env.DB,input)));
    expect(results.filter(r=>r.kind==='accepted')).toHaveLength(12);
    const index=results.findIndex(r=>r.kind==='accepted');
    const retries=await Promise.all(Array.from({length:30},()=>admitTrialPoseRequest(env.DB,requests[index]!)));
    expect(retries.every(r=>r.kind==='existing')).toBe(true);
    expect(await admitTrialPoseRequest(env.DB,{...requests[index]!,inputDigest:'b'.repeat(64)})).toEqual({kind:'conflict'});
    const otherHash=(await poseIpPrefixHash('203.0.114.8',secret,nowMs))!;
    expect((await admitTrialPoseRequest(env.DB,{...requests[59]!,ipHash:otherHash})).kind).toBe('accepted');
    const nextDay=nowMs+86_400_000, nextHash=(await poseIpPrefixHash('203.0.113.8',secret,nextDay))!;
    expect((await admitTrialPoseRequest(env.DB,{...requests[58]!,nowMs:nextDay,ipHash:nextHash})).kind).toBe('accepted');
    const row=await env.DB.prepare('SELECT ip_hash FROM pose_requests WHERE id=?').bind((results[index] as {id:string}).id).first<{ip_hash:string}>();
    expect(row?.ip_hash).toBe(ipHash);
    expect(JSON.stringify(row)).not.toContain('203.0.113');
  });
  it('binds concurrent retries to the persisted user identity, including guests', async () => {
    const input={ownerId:`owner_${crypto.randomUUID()}`,requestKey:'request-identity-01',inputDigest:'a'.repeat(64),nowMs:Date.UTC(2062,0,1),dailySiteLimit:100,dailyOwnerLimit:100,dailyIpLimit:100,ipHash:'1'.repeat(64)};
    const identities=[null,'user_alpha','user_bravo'] as const;
    const results=await Promise.all(Array.from({length:45},(_,i)=>admitPoseRequest(env.DB,{...input,userId:identities[i%3]})));
    const accepted=results.findIndex(result=>result.kind==='accepted');
    expect(accepted).toBeGreaterThanOrEqual(0);
    const winner=identities[accepted%3];
    const row=await env.DB.prepare('SELECT user_id FROM pose_requests WHERE owner_id=? AND request_key=?').bind(input.ownerId,input.requestKey).first<{user_id:string|null}>();
    expect(row?.user_id).toBe(winner);
    results.forEach((result,i)=>expect(result.kind).toBe(i===accepted?'accepted':identities[i%3]===winner?'existing':'conflict'));
    for(const userId of identities) {
      expect((await admitPoseRequest(env.DB,{...input,userId})).kind).toBe(userId===winner?'existing':'conflict');
    }
  });

  it('rejects every different identity after an admission, regardless of ordering', async () => {
    const identities=[null,'user_alpha','user_bravo'] as const;
    for(const userId of identities) {
      const input={ownerId:`owner_${crypto.randomUUID()}`,requestKey:'request-identity-02',inputDigest:'b'.repeat(64),nowMs:Date.UTC(2063,0,1),dailySiteLimit:100,dailyOwnerLimit:100,dailyIpLimit:100,ipHash:'2'.repeat(64),userId};
      expect((await admitPoseRequest(env.DB,input)).kind).toBe('accepted');
      for(const retryId of identities) expect((await admitPoseRequest(env.DB,{...input,userId:retryId})).kind).toBe(retryId===userId?'existing':'conflict');
    }
  });

  it('deduplicates concurrent requests and enforces the daily cap across owners', async () => {
    const prefix = crypto.randomUUID();
    const nowMs = Date.UTC(2026, 9, 29);
    const input = { ownerId: `owner_${prefix}`, requestKey:'request-00000001', inputDigest:'a'.repeat(64), nowMs, dailySiteLimit:3, dailyOwnerLimit:2, dailyIpLimit:10000, ipHash:'1'.repeat(64) };
    const duplicate = await Promise.all(Array.from({length:20}, () => admitPoseRequest(env.DB, input)));
    expect(duplicate.filter((result) => result.kind === 'accepted')).toHaveLength(1);
    expect(new Set(duplicate.map((result) => 'id' in result ? result.id : null)).size).toBe(1);
    const rest = await Promise.all(Array.from({length:20}, (_, index) => admitPoseRequest(env.DB, {...input, ownerId:`${prefix}_${index}`, requestKey:`request-${String(index).padStart(8, '0')}`})));
    expect(rest.filter((result) => result.kind === 'accepted')).toHaveLength(2);
    expect(await admitPoseRequest(env.DB, {...input, inputDigest:'b'.repeat(64)})).toEqual({kind:'conflict'});
    expect((await admitPoseRequest(env.DB, input)).kind).toBe('existing');
  });

  it('uses the configured 30-per-day site limit and 3-per-owner limit', async () => {
    const nowMs=Date.UTC(2026, 10, 2), prefix=crypto.randomUUID(), inputDigest='b'.repeat(64);
    const ownerId=`owner_${prefix}`;
    const mine=await Promise.all(Array.from({length:4},(_,index)=>admitTrialPoseRequest(env.DB,{ownerId,requestKey:`request-${String(index).padStart(8,'0')}`,inputDigest,nowMs,ipHash:'1'.repeat(64)})));
    expect(mine.filter(result=>result.kind==='accepted')).toHaveLength(3);
    const others=await Promise.all(Array.from({length:40},(_,index)=>admitTrialPoseRequest(env.DB,{ownerId:`${prefix}_${index}`,requestKey:`request-${String(index).padStart(8,'0')}`,inputDigest,nowMs,ipHash:index.toString(16).padStart(64,'0')})));
    expect(others.filter(result=>result.kind==='accepted')).toHaveLength(27);
  });

  it('holds the site budget across a burst of 200 visitors and preserves accepted keys at the limit', async () => {
    const nowMs=Date.UTC(2050, 0, 15), prefix=crypto.randomUUID(), inputDigest='c'.repeat(64);
    const requests=Array.from({length:200},(_,i)=>({ownerId:`owner_${prefix}_${i}`,requestKey:`request-${String(i).padStart(8,'0')}`,inputDigest,nowMs,ipHash:i.toString(16).padStart(64,'0')}));
    const results=await Promise.all(requests.map(request=>admitTrialPoseRequest(env.DB,request)));
    const accepted=results.flatMap((result,i)=>result.kind==='accepted'?[i]:[]);
    expect(accepted).toHaveLength(30);
    expect(results.filter(result=>result.kind==='limit')).toHaveLength(170);
    const index=accepted[0]!;
    const retries=await Promise.all(Array.from({length:50},()=>admitTrialPoseRequest(env.DB,requests[index]!)));
    expect(retries.every(result=>result.kind==='existing')).toBe(true);
    expect(new Set(retries.map(result=>'id' in result?result.id:null)).size).toBe(1);
    expect(await admitTrialPoseRequest(env.DB,{...requests[index]!,inputDigest:'d'.repeat(64)})).toEqual({kind:'conflict'});
    expect((await admitTrialPoseRequest(env.DB,{...requests[199]!,requestKey:'next-day-0001',nowMs:nowMs+86_400_000})).kind).toBe('accepted');
  });

  it('holds the per-visitor cap across 100 simultaneous distinct requests', async () => {
    const nowMs=Date.UTC(2051, 0, 15),ownerId=`owner_${crypto.randomUUID()}`,inputDigest='e'.repeat(64);
    const results=await Promise.all(Array.from({length:100},(_,i)=>admitTrialPoseRequest(env.DB,{ownerId,requestKey:`request-${String(i).padStart(8,'0')}`,inputDigest,nowMs,ipHash:'1'.repeat(64)})));
    expect(results.filter(result=>result.kind==='accepted')).toHaveLength(3);
    expect(results.filter(result=>result.kind==='limit')).toHaveLength(97);
  });
});
