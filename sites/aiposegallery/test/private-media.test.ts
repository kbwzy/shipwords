import { env } from 'cloudflare:test';
import { expect, it } from 'vitest';
import { deletePrivateImage, getPrivateImage, putPrivateImage } from '../src/site/private-media.server';

it('keeps uploaded images private using real R2 metadata and no-store responses', async () => {
  const bucket=env.TEST_MEDIA as R2Bucket;
  const data=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),char=>char.charCodeAt(0));
  const key=await putPrivateImage(bucket,'guest_owner','input',data,'image/png');
  const denied=await getPrivateImage(bucket,'guest_other',key);
  expect(denied.status).toBe(404);
  expect(denied.headers.get('cache-control')).toBe('private, no-store');
  expect(await deletePrivateImage(bucket,'guest_other',key)).toBe(false);
  const allowed=await getPrivateImage(bucket,'guest_owner',key);
  expect(allowed.status).toBe(200);
  expect(Array.from(new Uint8Array(await allowed.arrayBuffer()))).toEqual(Array.from(data));
  expect(await deletePrivateImage(bucket,'guest_owner',key)).toBe(true);
  expect((await getPrivateImage(bucket,'guest_owner',key)).status).toBe(404);
});
