import { readFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import { generateKeyPairSync, sign } from 'node:crypto';
import { WaffoPancake, verifyWebhook } from '../../../../packages/core/node_modules/@waffo/pancake-ts/dist/index.js';

const dir = dirname(fileURLToPath(import.meta.url));
const site = resolve(dir, '../..');
export const schemaQuery = `query SandboxSchema { __schema { queryType { fields { name args { name type { kind name ofType { kind name ofType { kind name } } } } } } } payment: __type(name: "Payment") { name fields { name type { kind name ofType { kind name } } } } refund: __type(name: "Refund") { name fields { name type { kind name ofType { kind name } } } } ticket: __type(name: "RefundTicket") { name fields { name type { kind name ofType { kind name } } } } order: __type(name: "OnetimeOrder") { name fields { name type { kind name ofType { kind name } } } } psp: __type(name: "PspAmountDetails") { name fields { name type { kind name ofType { kind name } } } } paymentFilter: __type(name: "PaymentFilter") { inputFields { name type { kind name ofType { kind name } } } } refundFilter: __type(name: "RefundFilter") { inputFields { name type { kind name ofType { kind name } } } } }`;
export const orderQuery = `query SandboxOrder($ref: String!, $store: String!) {
  payments(storeId: $store, limit: 100, filter: { orderMerchantExternalId: { eq: $ref }, testMode: { eq: true } }) {
    id orderId status testMode orderMerchantExternalId pspAmountDetails { currency amount }
    snapshotAmountDetails { currency subtotal taxAmount total }
    onetimeOrder { id storeId testMode orderMerchantExternalId }
    refunds { id paymentId ticketId status testMode orderMerchantExternalId refundTicketMerchantExternalId pspAmountDetails { amount currency } }
  }
  paymentsCount(storeId: $store, filter: { orderMerchantExternalId: { eq: $ref }, testMode: { eq: true } })
}`;

// Defense in depth: only these literal query documents may reach the single official
// GraphQL path; redirects and any arbitrary GraphQL operations are rejected locally.
export function guardedFetch(transport = globalThis.fetch) {
  return async (url, options) => {
    if (url !== 'https://api.waffo.ai/v1/graphql' || options.method !== 'POST') throw Error('blocked_endpoint');
    const body = JSON.parse(options.body);
    if (body.query !== schemaQuery && body.query !== orderQuery) throw Error('blocked_query');
    if (body.query === schemaQuery && body.variables != null) throw Error('blocked_variables');
    if (body.query === orderQuery && (Object.keys(body.variables ?? {}).sort().join() !== 'ref,store' || !/^pose-test-[0-9a-f-]{36}$/.test(body.variables.ref) || !/^STO_[A-Za-z0-9]+$/.test(body.variables.store))) throw Error('blocked_variables');
    return transport(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
  };
}

export function localSignatureChecks() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  const body = JSON.stringify({ id: 'local-event', eventType: 'refund.succeeded', mode: 'test', storeId: 'local-store', data: { paymentId: 'local-payment' } });
  const header = (payload, timestamp) => `t=${timestamp},v1=${sign('RSA-SHA256', Buffer.from(`${timestamp}.${payload}`), privateKey).toString('base64')}`;
  const now = Date.now();
  const valid = header(body, now);
  const verify = (payload, sig) => verifyWebhook(payload, sig, { publicKey });
  const rejects = (fn) => { try { fn(); return false; } catch { return true; } };
  return {
    valid: verify(body, valid).id === 'local-event',
    changedBodyRejected: rejects(() => verify(`${body} `, valid)),
    missingRejected: rejects(() => verify(body, null)),
    malformedRejected: rejects(() => verify(body, 't=abc')),
    staleRejected: rejects(() => verify(body, header(body, now - 46 * 60 * 1000))),
    futureRejected: rejects(() => verify(body, header(body, now + 2 * 60 * 1000))),
    wrongKeyRejected: rejects(() => verifyWebhook(body, valid, { publicKey: generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } }).publicKey })),
  };
}

function typeText(t) { return t ? (t.name ?? `${t.kind}<${typeText(t.ofType)}>` ) : '?'; }
function safeFields(value) { return value?.fields?.map(f => `${f.name}: ${typeText(f.type)}`) ?? null; }
function safeInputs(value) { return value?.inputFields?.map(f => `${f.name}: ${typeText(f.type)}`) ?? null; }
function listRoot(data) {
  const allowed = new Set(['payments', 'paymentsCount', 'refunds', 'refundsCount', 'refundTickets', 'refundTicketsCount', 'onetimeOrders', 'onetimeOrder']);
  return data.__schema.queryType.fields.filter(f => allowed.has(f.name)).map(f => ({ name: f.name, args: f.args.map(a => `${a.name}: ${typeText(a.type)}`) }));
}
async function query(client, query, variables) {
  const response = await client.graphql.query({ query, ...(variables ? { variables } : {}) });
  if (response.errors?.length || !response.data) return { ok: false, errors: response.errors?.length ?? 0 };
  return { ok: true, data: response.data };
}

async function live() {
  const vars = parseEnv(await readFile(join(site, '.dev.vars'), 'utf8'));
  if (vars.WAFFO_ENVIRONMENT !== 'test' || !vars.WAFFO_MERCHANT_ID || !vars.WAFFO_PRIVATE_KEY || !vars.WAFFO_STORE_ID) throw Error('test_configuration_missing');
  const checkout = JSON.parse(await readFile(join(site, 'research/waffo-sandbox-2026-10-29/CHECKOUT-ONCE.json'), 'utf8'));
  if (checkout.environment !== 'test' || !/^pose-test-[0-9a-f-]{36}$/.test(checkout.orderId)) throw Error('test_order_reference_missing');
  const client = new WaffoPancake({ merchantId: vars.WAFFO_MERCHANT_ID, privateKey: vars.WAFFO_PRIVATE_KEY, environment: 'test', fetch: guardedFetch() });
  const schema = await query(client, schemaQuery);
  const order = await query(client, orderQuery, { ref: checkout.orderId, store: vars.WAFFO_STORE_ID });
  // Report only schema names, counts and boolean association facts, never raw IDs,
  // prices, credentials, requests, response bodies, signatures or URLs.
  return {
    environmentConfigured: 'test',
    schema: schema.ok ? { ok: true, root: listRoot(schema.data), payment: safeFields(schema.data.payment), refund: safeFields(schema.data.refund), ticket: safeFields(schema.data.ticket), order: safeFields(schema.data.order), psp: safeFields(schema.data.psp), paymentFilter: safeInputs(schema.data.paymentFilter), refundFilter: safeInputs(schema.data.refundFilter) } : schema,
    knownTestOrderPayments: order.ok && Array.isArray(order.data.payments) ? {
      ok: true,
      count: order.data.payments.length,
      providerCount: order.data.paymentsCount,
      firstPageComplete: typeof order.data.paymentsCount === 'number' && order.data.paymentsCount === order.data.payments.length,
      orderReferenceMatches: order.data.payments.length ? order.data.payments.every(p => p.orderMerchantExternalId === checkout.orderId) : null,
      paymentsWithOrderId: order.data.payments.filter(p => !!p.orderId).length,
      paymentOrdersMatchStoreAndTest: order.data.payments.length ? order.data.payments.every(p => p.testMode === true && p.onetimeOrder?.testMode === true && p.onetimeOrder?.storeId === vars.WAFFO_STORE_ID && p.onetimeOrder?.id === p.orderId && p.onetimeOrder?.orderMerchantExternalId === checkout.orderId) : null,
      refundsMatchPaymentAndTest: order.data.payments.some(p => p.refunds?.length) ? order.data.payments.every(p => p.refunds.every(r => r.paymentId === p.id && r.testMode === true)) : null,
      paymentsWithRefunds: order.data.payments.filter(p => Array.isArray(p.refunds) && p.refunds.length).length,
      totalRefunds: order.data.payments.reduce((n, p) => n + (p.refunds?.length ?? 0), 0),
    } : { ok: false, errors: order.errors ?? 0 },
  };
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'offline') {
    const results = localSignatureChecks();
    console.log(JSON.stringify(results, null, 2));
    if (Object.values(results).some(value => !value)) process.exitCode = 1;
  } else if (mode === 'read-only') {
    const result = await live();
    console.log(JSON.stringify(result, null, 2));
    if (!result.schema.ok || !result.knownTestOrderPayments.ok) process.exitCode = 1;
  } else {
    console.log('Usage: node verify.mjs offline|read-only');
    process.exitCode = 2;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(() => { console.error('Stopped: configuration, transport, or API response unavailable; no raw error printed.'); process.exitCode = 1; });
