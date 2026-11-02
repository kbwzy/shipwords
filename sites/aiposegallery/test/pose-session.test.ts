import { expect, it } from 'vitest';
import { poseSessionOwner, startPoseSession } from '../src/site/pose-session.server';

it('issues only same-origin secure guest sessions and rejects forged identities', async () => {
  const origin='https://aiposegallery.example',secret='a'.repeat(48);
  const session=await startPoseSession(new Request(`${origin}/api/pose/session`,{method:'POST',headers:{origin}}),origin,secret);
  expect(session.status).toBe(200);
  const cookie=session.headers.get('set-cookie')!;
  expect(cookie).toContain('HttpOnly');expect(cookie).toContain('Secure');expect(cookie).toContain('SameSite=Strict');expect(cookie).toContain('Max-Age=86400');
  const header=cookie.split(';')[0]!;
  const owner=await poseSessionOwner(new Request(origin,{headers:{cookie:header}}),secret);
  expect(owner).toMatch(/^guest_[a-f0-9]{64}$/);
  expect(await poseSessionOwner(new Request(origin,{headers:{cookie:header}}),secret,Date.now()+86_400_000)).toBeNull();
  expect(await poseSessionOwner(new Request(origin,{headers:{cookie:`${header}; ${header}`}}),secret)).toBeNull();
  expect(await poseSessionOwner(new Request(origin,{headers:{cookie:`${header}x`}}),secret)).toBeNull();
  expect(await poseSessionOwner(new Request(origin),secret)).toBeNull();
  expect(await poseSessionOwner(new Request(origin,{headers:{cookie:'aiposegallery_pose_gid=%ZZ'}}),secret)).toBeNull();
  expect((await startPoseSession(new Request(origin,{method:'POST',headers:{origin:'https://other.example'}}),origin,secret)).status).toBe(403);
  expect((await startPoseSession(new Request(origin,{method:'POST',headers:{origin}}),origin,'short')).status).toBe(503);
});
