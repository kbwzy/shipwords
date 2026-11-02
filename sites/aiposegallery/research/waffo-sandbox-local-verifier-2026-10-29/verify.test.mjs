import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardedFetch, localSignatureChecks, orderQuery, schemaQuery } from './verify.mjs';

test('SDK verifies local RSA signature and rejects body, key, header and time tampering', () => {
  assert.ok(Object.values(localSignatureChecks()).every(Boolean));
});
test('network guard blocks action endpoints, mutations, arbitrary reads and non-test references', async () => {
  let calls = 0;
  const send = guardedFetch(async () => { calls++; });
  await assert.rejects(send('https://api.waffo.ai/v1/actions/checkout', { method: 'POST', body: '{}' }));
  await assert.rejects(send('https://api.waffo.ai/v1/graphql', { method: 'POST', body: JSON.stringify({ query: 'mutation { createPayment }' }) }));
  await assert.rejects(send('https://api.waffo.ai/v1/graphql', { method: 'GET', body: '{}' }));
  assert.equal(calls, 0);
});

test('network guard accepts only the fixed queries, restricts identifiers and blocks redirects', async () => {
  const seen = [];
  const send = guardedFetch(async (url, options) => { seen.push({ url, options }); return 'ok'; });
  const endpoint = 'https://api.waffo.ai/v1/graphql';
  const request = (body) => ({ method: 'POST', body: JSON.stringify(body) });
  await assert.rejects(send(endpoint, request({ query: orderQuery, variables: { ref: 'production-order', store: 'STO_123' } })));
  await assert.rejects(send(endpoint, request({ query: schemaQuery, variables: { ref: 'x' } })));
  await assert.rejects(send(endpoint, request({ query: orderQuery, variables: { ref: 'pose-test-00000000-0000-0000-0000-000000000000', store: 'STO_123', extra: 'x' } })));
  assert.equal(await send(endpoint, request({ query: schemaQuery })), 'ok');
  assert.equal(await send(endpoint, request({ query: orderQuery, variables: { ref: 'pose-test-00000000-0000-0000-0000-000000000000', store: 'STO_123' } })), 'ok');
  assert.equal(seen.length, 2);
  assert.ok(seen.every(call => call.options.redirect === 'error' && call.options.signal instanceof AbortSignal));
});
