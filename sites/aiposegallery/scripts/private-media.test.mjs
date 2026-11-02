import { test } from 'node:test';
import assert from 'node:assert/strict';
import { putPrivateImage, getPrivateImage, deletePrivateImage } from '../src/site/private-media.server.ts';

function fakeBucket() {
  const objects = new Map();
  return {
    objects,
    async put(key, bytes, options) { objects.set(key, { bytes: Uint8Array.from(bytes), ...options }); },
    async get(key) {
      const value = objects.get(key);
      return value && { ...value, body: new Blob([value.bytes]).stream() };
    },
    async head(key) { return objects.get(key); },
    async delete(key) { objects.delete(key); },
  };
}

test('only the owner can read or delete an image and responses are not cacheable', async () => {
  const bucket = fakeBucket();
  const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
  const key = await putPrivateImage(bucket, 'owner-a', 'input', png, 'image/png');
  const denied = await getPrivateImage(bucket, 'owner-b', key);
  assert.equal(denied.status, 404);
  assert.equal(denied.headers.get('cache-control'), 'private, no-store');
  assert.equal(await deletePrivateImage(bucket, 'owner-b', key), false);
  const response = await getPrivateImage(bucket, 'owner-a', key);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), png);
  assert.equal(await deletePrivateImage(bucket, 'owner-a', key), true);
  assert.equal((await getPrivateImage(bucket, 'owner-a', key)).status, 404);
});

test('rejects unrecognized, oversized and incorrectly declared images and invalid keys', async () => {
  const bucket = fakeBucket();
  await assert.rejects(putPrivateImage(bucket, '', 'input', new Uint8Array([1]), 'image/png'));
  await assert.rejects(putPrivateImage(bucket, 'owner', 'input', new Uint8Array([1]), 'image/png'));
  await assert.rejects(putPrivateImage(bucket, 'owner', 'input', new Uint8Array(10 * 1024 * 1024 + 1), 'image/jpeg'));
  await assert.rejects(putPrivateImage(bucket, 'owner', 'input', Uint8Array.from([255, 216, 255]), 'image/png'));
  const oversized=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
  new DataView(oversized.buffer).setUint32(16,8193);
  await assert.rejects(putPrivateImage(bucket, 'owner', 'input', oversized, 'image/png'));
  assert.equal((await getPrivateImage(bucket, 'owner', '../other')).status, 404);
  assert.equal(await deletePrivateImage(bucket, 'owner', '../other'), false);
  assert.equal(bucket.objects.size, 0);
});
