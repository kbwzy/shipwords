import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGarmentQuoteRequest, buildGarmentSubmitRequest, garmentQuoteAllowed } from '../src/site/garment-provider.server.ts';

test('garment and model use ordered private file IDs matching the prompt order', () => {
  const request = buildGarmentQuoteRequest({ garmentFileId: 'file_garment', modelFileId: 'file_model', instructions: 'keep the logo' });
  assert.deepEqual(request.input.references.map((ref) => ref.file_id), ['file_garment', 'file_model']);
  assert.match(request.input.prompt, /first reference is a garment product photo.*second reference is a model reference/s);
  assert.deepEqual(request.routing, { only: ['official'], fallback: false, fidelity: 'original' });
  assert.deepEqual(buildGarmentSubmitRequest(request), { ...request, max_cost: '0.30' });
  assert.throws(() => buildGarmentQuoteRequest({ garmentFileId: 'https://evil.example', instructions: 'sit' }));
  // garment alone with instructions is valid; model-only needs instructions and has no garment to reproduce.
  assert.doesNotThrow(() => buildGarmentQuoteRequest({ garmentFileId: 'file_garment', instructions: 'sit' }));
  assert.doesNotThrow(() => buildGarmentQuoteRequest({ modelFileId: 'file_model', instructions: 'sit' }));
  assert.throws(() => buildGarmentQuoteRequest({ modelFileId: 'file_model', instructions: '' }));
});

test('rejects unavailable, expired or over-budget quotes including fractional excess', () => {
  const now = 1000;
  const q = { currency: 'USD', supply: { available: true }, primary: { amount: '0.15' }, expected_amount: '0.15', expires_at: 2 };
  assert.equal(garmentQuoteAllowed(q, now), true);
  for (const change of [{ primary: { amount: '0.15001' } }, { expected_amount: '0.15001' }, { currency: 'EUR' }, { expires_at: 1 }, { supply: { available: false } }, { primary: { amount: 'NaN' } }]) assert.equal(garmentQuoteAllowed({ ...q, ...change }, now), false);
});
