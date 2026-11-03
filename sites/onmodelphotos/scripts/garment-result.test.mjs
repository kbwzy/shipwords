import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readGarmentResult } from '../src/site/garment-result.server.ts';

const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
const base = { url: 'https://cdn.example.test/result', declaredType: 'image/png', allowedHosts: ['cdn.example.test'] };

test('downloads a valid image without sending a provider credential or following redirects', async () => {
  let options;
  const result = await readGarmentResult({ ...base, fetcher: async (_url, init) => { options = init; return new Response(png, { headers: { 'content-type': 'image/png' } }); } });
  assert.deepEqual(result.bytes, png);
  assert.equal(result.mediaType, 'image/png');
  assert.equal(options.redirect, 'manual');
  assert.equal(new Headers(options.headers).has('authorization'), false);
  await assert.rejects(readGarmentResult({ ...base, fetcher: async () => new Response(null, { status: 302, headers: { location: 'https://evil.example' } }) }));
});

test('blocks unapproved URLs, mismatched types, signatures and oversized streams', async () => {
  for (const url of ['http://cdn.example.test/result', 'https://evil.example/result', 'https://user@cdn.example.test/result', 'https://cdn.example.test:8443/result']) {
    await assert.rejects(readGarmentResult({ ...base, url, fetcher: async () => { throw new Error('must not fetch'); } }), /Invalid result URL/);
  }
  await assert.rejects(readGarmentResult({ ...base, fetcher: async () => new Response(png, { headers: { 'content-type': 'image/jpeg' } }) }), /Invalid result type/);
  await assert.rejects(readGarmentResult({ ...base, fetcher: async () => new Response('bad', { headers: { 'content-type': 'image/png' } }) }), /Invalid result signature/);
  const huge = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(20 * 1024 * 1024 + 1)); controller.close(); } });
  await assert.rejects(readGarmentResult({ ...base, fetcher: async () => new Response(huge, { headers: { 'content-type': 'image/png' } }) }), /Result too large/);
});
