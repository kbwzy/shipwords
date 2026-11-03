import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGarmentRequest } from '../src/site/garment-request.server.ts';

const origin = 'https://onmodelphotos.com';
function request(form, actualOrigin = origin) {
  return new Request(`${origin}/api/garment`, { method: 'POST', headers: { origin: actualOrigin }, body: form });
}
function form() { const result = new FormData(); result.set('consent', 'yes'); result.set('prompt', 'A standing pose'); return result; }

test('requires same-origin adult and permission consent and valid content', async () => {
  const input = form();
  assert.equal((await parseGarmentRequest(request(input), origin)).prompt, 'A standing pose');
  await assert.rejects(parseGarmentRequest(request(input, 'https://other.example'), origin), { status: 403 });
  input.delete('consent');
  await assert.rejects(parseGarmentRequest(request(input), origin), { status: 400 });
  input.set('consent', 'yes'); input.append('consent', 'yes');
  await assert.rejects(parseGarmentRequest(request(input), origin), { status: 400 });
  const noGarment = new FormData(); noGarment.set('consent', 'yes');
  noGarment.set('garment', new File(['abc'], 'garment.jpg', { type: 'image/jpeg' }));
  // Garment alone is accepted (new model wears it).
  assert.ok(await parseGarmentRequest(request(noGarment), origin));
});

test('garment and model files are accepted together as the core two-reference mode', async () => {
  const input = form();
  input.set('garment', new File(['abc'], 'garment.jpg', { type: 'image/jpeg' }));
  input.set('model', new File(['abc'], 'model.jpg', { type: 'image/png' }));
  const parsed = await parseGarmentRequest(request(input), origin);
  assert.equal(parsed.files.garment?.type, 'image/jpeg');
  assert.equal(parsed.files.model?.type, 'image/png');
});

test('enforces image type and a streaming request limit', async () => {
  const input = form();
  input.set('garment', new File(['x'], 'bad.txt', { type: 'text/plain' }));
  await assert.rejects(parseGarmentRequest(request(input), origin), { status: 400 });
  const tooLarge = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(21 * 1024 * 1024)); controller.close(); } });
  const req = new Request(`${origin}/api/garment`, { method: 'POST', headers: { origin, 'content-type': 'multipart/form-data; boundary=x' }, body: tooLarge, duplex: 'half' });
  await assert.rejects(parseGarmentRequest(req, origin), { status: 413 });
});

test('rejects multi-person and out-of-scope instructions including garment file names', async () => {
  const multi = form(); multi.set('prompt', 'a couple holding hands');
  await assert.rejects(parseGarmentRequest(request(multi), origin), { status: 400 });
  const intimate = form(); intimate.set('prompt', 'a bikini top on the model');
  await assert.rejects(parseGarmentRequest(request(intimate), origin), { status: 400 });
  const named = form(); named.set('garment', new File(['abc'], 'bikini.jpg', { type: 'image/jpeg' }));
  await assert.rejects(parseGarmentRequest(request(named), origin), { status: 400 });
});
