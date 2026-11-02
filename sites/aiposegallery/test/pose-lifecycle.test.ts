import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { admitPoseRequest } from '../src/site/pose-admission.server';
import { transitionPoseRequest } from '../src/site/pose-lifecycle.server';

describe('pose generation lifecycle in D1', () => {
  it('claims each transition once and keeps provider success recoverable during output failures', async () => {
    const nowMs=Date.UTC(2026, 9, 30);
    const created=await admitPoseRequest(env.DB,{ownerId:`owner_${crypto.randomUUID()}`,requestKey:'request-00000001',inputDigest:'a'.repeat(64),nowMs,ipHash:'1'.repeat(64), dailyIpLimit:10000, dailySiteLimit:5,dailyOwnerLimit:5});
    if (created.kind !== 'accepted') throw new Error('Test task not admitted');
    const move = (from: 'accepted'|'preparing'|'quoted'|'submitting'|'submitted'|'result_pending'|'succeeded'|'failed'|'unknown', to: 'accepted'|'preparing'|'quoted'|'submitting'|'submitted'|'result_pending'|'succeeded'|'failed'|'unknown', extra = {}) => transitionPoseRequest(env.DB,{id:created.id,from,to,nowMs,...extra});
    expect((await Promise.all([move('accepted','preparing'),move('accepted','preparing')])).filter(Boolean)).toHaveLength(1);
    expect(await move('preparing','quoted')).toBe(true);
    expect(await move('quoted','submitting')).toBe(true);
    expect(await move('submitting','unknown')).toBe(true);
    await expect(move('unknown','submitted')).rejects.toThrow();
    expect(await move('unknown','submitted',{upstreamJobId:'job_1'})).toBe(true);
    expect(await move('submitted','unknown')).toBe(true);
    expect(await move('unknown','submitted',{upstreamJobId:'job_2'})).toBe(false);
    expect(await move('unknown','submitted',{upstreamJobId:'job_1'})).toBe(true);
    expect(await move('submitted','result_pending')).toBe(true);
    await expect(move('result_pending','failed')).rejects.toThrow();
    await expect(move('result_pending','succeeded')).rejects.toThrow();
    expect(await move('result_pending','succeeded',{outputKey:`pose-media/${crypto.randomUUID()}`})).toBe(true);
    expect(await move('submitted','failed')).toBe(false);
  });
});
