import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePoseRequest } from '../src/site/pose-request.server.ts';

const origin = 'https://aiposegallery.com';
function request(form, actualOrigin = origin) {
  return new Request(`${origin}/api/pose`, { method: 'POST', headers: { origin: actualOrigin }, body: form });
}
function form() { const result = new FormData(); result.set('consent', 'yes'); result.set('prompt', 'A seated pose'); return result; }

test('requires same-origin adult and permission consent and valid content', async () => {
  const input = form();
  assert.equal((await parsePoseRequest(request(input), origin)).prompt, 'A seated pose');
  await assert.rejects(parsePoseRequest(request(input, 'https://other.example'), origin), { status: 403 });
  input.delete('consent');
  await assert.rejects(parsePoseRequest(request(input), origin), { status: 400 });
  input.set('consent', 'yes'); input.append('consent', 'yes');
  await assert.rejects(parsePoseRequest(request(input), origin), { status: 400 });
  const noPose = new FormData(); noPose.set('consent', 'yes');
  noPose.set('photo', new File(['abc'], 'photo.jpg', { type: 'image/jpeg' }));
  await assert.rejects(parsePoseRequest(request(noPose), origin), { status: 400 });
});

test('enforces image type and a streaming request limit', async () => {
  const input = form();
  input.set('photo', new File(['x'], 'bad.txt', { type: 'text/plain' }));
  await assert.rejects(parsePoseRequest(request(input), origin), { status: 400 });
  const tooLarge = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(21 * 1024 * 1024)); controller.close(); } });
  const req = new Request(`${origin}/api/pose`, { method: 'POST', headers: { origin, 'content-type': 'multipart/form-data; boundary=x' }, body: tooLarge, duplex: 'half' });
  await assert.rejects(parsePoseRequest(req, origin), { status: 413 });
});
