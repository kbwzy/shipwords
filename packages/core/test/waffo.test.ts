import { env } from 'cloudflare:test';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { type BillingDeps, handleCheckout, handleWebhook } from '../src/billing/handlers';
import { WebhookSignatureError } from '../src/billing/provider';
import { applyCheckout, applyPayment } from '../src/billing/reconcile';
import { WaffoProvider } from '../src/billing/waffo';
import { getBalance } from '../src/credits/ledger';
import { createDb } from '../src/db/client';
import { orders, webhookEvents } from '../src/db/schema';
import { defineSite, type Product } from '../src/site';

const product: Product = {
  id: 'pack_5',
  kind: 'credits',
  name: 'Starter',
  price: { amount: 499, currency: 'usd' },
  credits: 5,
  expiresDays: null,
  refs: { waffo: 'PROD_2tcBAsv99JD5wzOdydQBSQ' },
};
// Throwaway RSA test key; the SDK validates the private key format eagerly.
const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDGiYybw5q2xt7X
9mEREwGFCzt+tQMwLqZICzAfNt+ZWaSbqmPCgC2WeQ92dBquTBIWj/nzQhqhAR5j
ZavrSRrZY8ent/nsI4ICRdcj0bGoVNlk56DxVFMzDx7cTYb5xG8SYmg8fpnyNO4I
WBLYCJGINCAClVewRtFJQnjU+wVSAziXhn/Qbj/1SNxH95J2RqG075nVoT1YcHRS
D7lw48srJEUA923aF5FwHfaE/0Iqm4vs5S2+PVNPTnEQepkqLjKWin1ybCumsFv0
VRXueoeAwOXKJ+WJaX2nOsPhiHmjvAOGPWKNommA0kn8FQPWpDeAS7t6YPfLHRXh
c7ehHptTAgMBAAECggEAJfHVB1InqCYzIghrPdWplTFz4gAbh2JrElrdDCIzMv5g
iQXUQjC4RcmGbIe9L7HHRTuoNFdeeoYZtjqQ1Iuoz4KT/piZcgnJR8DsYOKrdzYc
RH5Gkskgi6Iorkc89FCYP+XB8UnrB1EZa0vV8icVFXiM46GCXGT0i/Fh4abGOgmg
WirFQCawhm29rmdZma+5UYGflU0jK3exqAKAV4fjrSIX7MgXiiO3dWogp3GYdwFO
HwOr1KnR7EZfaH9noMB18i5T1yOPmhErLG92h++MCson1hrInriDhnxbTMUsxYtD
FSoZmlNHzVrNMJh8GCltsM8DWGibjWCPAq3Sq6SxBQKBgQDn0WkEgGZBOQNC9m3Q
Xq793McQUsDeiscShMs1EFJJngsd7k0nv9NVZLBoChJQDnISTKV7Q2NOsTqIWISr
2KL4Mk6Npp0Ajcw9317vbza1pch5ZwTDqwYTFSR8bNGNxpT/FOsBAofT3ouMPE/Z
nLgyrK9TKoHgunq3dpQpM0HO1wKBgQDbP2TAcmEH64evFRS6dSw3V8laqHAC5n85
unYQBXMeyvWhMcBfDZRPULZI7VrDO5H2nsA3Z17v0c+xRanKsV32orqXqrYgYouS
57VUuwudZ14HpDsU1tVqh6ABzLEV2ZM0dsZsnLv5FXwlRW7heR3hkNB9yLbBgrK7
Yu+3Rppz5QKBgQChskbvVeR9YBgvUBae/jxPZP0RHLfdQq3C9A+N7tmG8g9NDFiS
/lGZwcbuev/1CW515zKSPRn63NI4Io5AE7bxKp3yXiIrLb0l9zWQC2H86CtiywHe
vd9Z1iiCBaFRpA9vsZaOOManeRabdcI4xwEQj7UnbIH1T/2jFLoZ1t/zNwKBgDXS
/VAFhG6mUtwXp8wSofVANu1rtnvvzEIG1Z8fR2DC4MRe62QqeEN0hBupMYQGZtIN
rRCs7vCfKIbTnFhnbLL0xiwfu7B9oNhCzBBuDu7ohnwHxH1cNG5/tzdZ4guEK5BQ
rGvTmo4OyTh5MDxoOH68x4JpuPwOswQvyLvMuHRFAoGBAMxJbMC0A/y/5Z33hi49
7owvOGrpci0yov2iCUJq8B6aT+N+8oFPTdkSzkrTbsDbTc717O7BGq5OeZlCl61Y
5IXLjqMw5m5l4gSCgksJOAJ/OW6hxO6gO3PmjZIRl1GoFnCDGWzvVidzlcGXFVgc
Sj2au+0XLSqMGrfZbQqArs6S
-----END PRIVATE KEY-----`;
const site = defineSite({
  id: 'test',
  name: 'Test',
  url: 'https://test.example',
  locales: ['en'],
  defaultLocale: 'en',
  products: [product],
  signup: { bonusCredits: 0, bonusExpiresDays: null, bonusPerIpDaily: 0 },
  guest: { dailyPerDevice: 0, dailyPerIp: 0, dailySiteBudget: 0, minRecaptchaScore: 0.5 },
  billing: { provider: 'waffo' },
});
const db = createDb(env.DB);

type WaffoPaymentFixture = {
  id: string;
  status: string;
  pspPaymentId: string | null;
  createdAt: string;
  isFullyRefunded: boolean;
  amount: { amount: string; currency: string };
  refundedAmount: { amount: string; currency: string };
  refundStatus: string;
  refunds: { id: string; status: string; amount: { amount: string; currency: string } }[];
  chargebacks: { id: string; status: string; amount: { amount: string; currency: string } }[];
  onetimeOrder: {
    id: string;
    orderMerchantExternalId: string;
    merchantProvidedBuyerIdentity: string;
    currency: string;
    status: string;
    testMode: boolean;
    onetimeProduct: { id: string };
  };
};

type WaffoOrderFixture = {
  id: string;
  orderMerchantExternalId: string;
  merchantProvidedBuyerIdentity: string;
  currency: string;
  status: string;
  testMode: boolean;
  createdAt: string;
  onetimeProduct: { id: string };
  payments: WaffoPaymentFixture[];
};

function orderFixture(userId: string, overrides: Partial<WaffoOrderFixture> = {}, paymentOverrides: Partial<WaffoPaymentFixture> = {}): WaffoOrderFixture {
  const now = new Date().toISOString();
  const paymentId = `pay_${crypto.randomUUID()}`;
  const order = {
    id: 'ORD_1',
    orderMerchantExternalId: 'ord_1',
    merchantProvidedBuyerIdentity: userId,
    currency: 'USD',
    status: 'completed',
    testMode: true,
    createdAt: now,
    onetimeProduct: { id: product.refs!.waffo! },
    payments: [],
    ...overrides,
  };
  const payment: WaffoPaymentFixture = {
    id: paymentId,
    status: 'succeeded',
    pspPaymentId: `psp_${crypto.randomUUID()}`,
    createdAt: now,
    isFullyRefunded: false,
    amount: { amount: '4.99', currency: 'USD' },
    refundedAmount: { amount: '0.00', currency: 'USD' },
    refundStatus: 'none',
    refunds: [],
    chargebacks: [],
    onetimeOrder: { id: order.id, orderMerchantExternalId: order.orderMerchantExternalId, merchantProvidedBuyerIdentity: order.merchantProvidedBuyerIdentity, currency: order.currency, status: order.status, testMode: order.testMode, onetimeProduct: order.onetimeProduct },
    ...paymentOverrides,
  };
  order.payments = [payment];
  return order;
}

function json(value: unknown) {
  return new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
}

function waffoFetcher(order: WaffoOrderFixture | null) {
  return async (target: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(typeof target === 'string' ? target : target instanceof URL ? target.href : target.url);
    if (url.pathname === '/v1/actions/auth/issue-session-token') {
      return json({ data: { token: 'token_test', expiresAt: new Date(Date.now() + 300_000).toISOString() } });
    }
    if (url.pathname === '/v1/actions/checkout/create-session') {
      return json({ data: { sessionId: 'sess_test', checkoutUrl: 'https://pancake.test/store/slug/checkout/sess_test', expiresAt: new Date(Date.now() + 86_400_000).toISOString() } });
    }
    if (url.pathname === '/v1/graphql') {
      const body = JSON.parse(init.body as string) as { query: string };
      if (body.query.includes('onetimeOrders(')) return json({ data: { onetimeOrders: order ? [order] : [] } });
      if (body.query.includes('onetimeOrder(id')) return json({ data: { onetimeOrder: order } });
      if (body.query.includes('payment(id')) return json({ data: { payment: order?.payments?.[0] ?? null } });
      if (body.query.includes('payments(storeId')) return json({ data: { payments: order ? order.payments : [] } });
    }
    throw new Error(`unexpected Waffo path ${url.pathname}`);
  };
}

async function signedEvent(
  data: Record<string, unknown>,
  run: (request: (url?: string) => Request) => Promise<void>,
) {
  const keys = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const previous = process.env.WAFFO_WEBHOOK_TEST_PUBLIC_KEY;
  const publicKey = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('spki', keys.publicKey))));
  process.env.WAFFO_WEBHOOK_TEST_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;
  try {
    const body = JSON.stringify(data);
    const timestamp = String(Date.now());
    const signature = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, new TextEncoder().encode(`${timestamp}.${body}`)))));
    await run(
      (url = 'https://test.example/api/webhooks/waffo') =>
        new Request(url, { method: 'POST', headers: { 'x-waffo-signature': `t=${timestamp},v1=${signature}` }, body }),
    );
  } finally {
    if (previous === undefined) delete process.env.WAFFO_WEBHOOK_TEST_PUBLIC_KEY;
    else process.env.WAFFO_WEBHOOK_TEST_PUBLIC_KEY = previous;
  }
}

function deps(provider: WaffoProvider, user?: { id: string; name: string; email: string }): BillingDeps {
  return {
    db,
    site,
    provider,
    baseURL: site.url,
    getUser: async () => user ?? null,
    log: () => {},
  };
}

describe('Waffo sandbox billing', () => {
  it('fails closed when billing is not enabled', async () => {
    const provider = new WaffoProvider({ merchantId: 'MER_0123456789abcdefghijkl', privateKey: TEST_PRIVATE_KEY, environment: 'test', storeId: 'STO_0123456789abcdefghijkl', enabled: false, products: [product], fetcher: waffoFetcher(null) });
    const user = { id: `u_${crypto.randomUUID()}`, name: 'Test', email: 'test@example.com' };
    const request = new Request('https://test.example/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId: product.id }),
    });
    expect((await handleCheckout(deps(provider, user), request)).status).toBe(503);
    expect(await db.query.orders.findFirst({ where: eq(orders.userId, user.id) })).toBeUndefined();
    expect(await provider.createCustomer(user)).toBe(user.id);
    await expect(provider.fetchCheckout('ord_1')).rejects.toThrow(/disabled/);
    await expect(provider.fetchPayment('pay_1')).rejects.toThrow(/disabled/);
    await expect(provider.fetchPaymentByCharge('psp_1')).rejects.toThrow(/disabled/);
    await expect(provider.portalUrl(user.id)).rejects.toThrow(/disabled/);
    await expect(
      signedEvent({ id: 'evt_1', eventId: 'pay_1', eventType: 'order.completed', mode: 'test', storeId: 'STO_0123456789abcdefghijkl', data: {} }, async (request) => {
        await provider.parseWebhook(request());
      }),
    ).rejects.toThrow(/disabled/);
  });

  it('creates an authenticated checkout session bound to our order id', async () => {
    const calls: { path: string; body: Record<string, unknown> }[] = [];
    const fetcher = async (target: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(typeof target === 'string' ? target : target instanceof URL ? target.href : target.url);
      calls.push({ path: url.pathname, body: JSON.parse(init.body as string) });
      if (url.pathname === '/v1/actions/auth/issue-session-token') {
        return json({ data: { token: 'token_test', expiresAt: new Date(Date.now() + 300_000).toISOString() } });
      }
      if (url.pathname === '/v1/actions/checkout/create-session') {
        return json({ data: { sessionId: 'sess_test', checkoutUrl: 'https://pancake.test/store/slug/checkout/sess_test', expiresAt: new Date(Date.now() + 86_400_000).toISOString() } });
      }
      throw new Error(`unexpected path ${url.pathname}`);
    };
    const provider = new WaffoProvider({ merchantId: 'MER_0123456789abcdefghijkl', privateKey: TEST_PRIVATE_KEY, environment: 'test', storeId: 'STO_0123456789abcdefghijkl', enabled: true, products: [product], fetcher });
    const user = { id: `u_${crypto.randomUUID()}`, name: 'Test', email: 'test@example.com' };
    const response = await handleCheckout(deps(provider, user), new Request('https://test.example/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId: product.id, returnPath: '/?resume=1#tool' }),
    }));
    expect(response.status).toBe(200);
    const body = await response.json() as { url: string; orderId: string };
    expect(body.url).toContain('#token=token_test');
    const order = await db.query.orders.findFirst({ where: eq(orders.userId, user.id) });
    expect(order?.checkoutRef).toBe(body.orderId);
    const sessionCall = calls.find((call) => call.path === '/v1/actions/checkout/create-session');
    expect(sessionCall?.body).toMatchObject({
      productId: product.refs?.waffo,
      currency: 'USD',
      orderMerchantExternalId: body.orderId,
      successUrl: expect.stringContaining(`/billing/return?order=${body.orderId}`),
    });
    const tokenCall = calls.find((call) => call.path === '/v1/actions/auth/issue-session-token');
    expect(tokenCall?.body).toMatchObject({ productId: product.refs?.waffo, buyerIdentity: user.id });
  });

  it('maps order and refund webhooks to a checkout target and ignores unknown events', async () => {
    const provider = new WaffoProvider({ merchantId: 'MER_0123456789abcdefghijkl', privateKey: TEST_PRIVATE_KEY, environment: 'test', storeId: 'STO_0123456789abcdefghijkl', enabled: true, products: [product], fetcher: waffoFetcher(null) });
    await signedEvent({ id: 'evt_order', eventId: 'pay_1', eventType: 'order.completed', mode: 'test', storeId: 'STO_0123456789abcdefghijkl', data: { orderId: 'ORD_1', orderMerchantExternalId: 'ord_1' } }, async (request) => {
      const trigger = await provider.parseWebhook(request());
      expect(trigger.target).toEqual({ kind: 'checkout', ref: 'ord_1' });
    });
    await signedEvent({ id: 'evt_refund', eventId: 'ref_1', eventType: 'refund.succeeded', mode: 'test', storeId: 'STO_0123456789abcdefghijkl', data: { orderId: 'ORD_1', orderMerchantExternalId: 'ord_1', refundedAmount: '4.99' } }, async (request) => {
      const trigger = await provider.parseWebhook(request());
      expect(trigger.target).toEqual({ kind: 'checkout', ref: 'ord_1' });
    });
    await signedEvent({ id: 'evt_unknown', eventId: 'sub_1', eventType: 'subscription.activated', mode: 'test', storeId: 'STO_0123456789abcdefghijkl', data: {} }, async (request) => {
      expect((await provider.parseWebhook(request())).target).toBeNull();
      expect((await handleWebhook(deps(provider), request())).status).toBe(200);
    });
  });

  it('rejects signed events on a production host or with a mismatched environment or store', async () => {
    const provider = new WaffoProvider({ merchantId: 'MER_0123456789abcdefghijkl', privateKey: TEST_PRIVATE_KEY, environment: 'test', storeId: 'STO_0123456789abcdefghijkl', enabled: true, products: [product], fetcher: waffoFetcher(null) });
    const event = { id: 'evt_signed', eventType: 'order.completed', mode: 'test', storeId: 'STO_0123456789abcdefghijkl', data: {} };
    await signedEvent(event, async (request) => {
      expect((await provider.parseWebhook(request())).target).not.toBeNull();
      await expect(provider.parseWebhook(request('https://aiposegallery.com/api/webhooks/waffo'))).rejects.toBeInstanceOf(WebhookSignatureError);
    });
    for (const change of [{ mode: 'prod' }, { storeId: 'other' }]) {
      await signedEvent({ ...event, ...change }, async (request) => {
        await expect(provider.parseWebhook(request())).rejects.toBeInstanceOf(WebhookSignatureError);
      });
    }
  });

  it('grants credits from provider state after order.completed and deduplicates deliveries', async () => {
    const userId = `u_${crypto.randomUUID()}`;
    const provider = new WaffoProvider({ merchantId: 'MER_0123456789abcdefghijkl', privateKey: TEST_PRIVATE_KEY, environment: 'test', storeId: 'STO_0123456789abcdefghijkl', enabled: true, products: [product], fetcher: waffoFetcher(orderFixture(userId)) });
    const checkedOut = await provider.fetchCheckout('ord_1');
    expect(checkedOut.orderId).toBe('ord_1');
    expect(checkedOut.payment).toMatchObject({ provider: 'waffo', paymentRef: expect.stringMatching(/^pay_/), paid: true, amount: 499, currency: 'usd', userId, productId: product.id });
    expect(await applyCheckout({ db, site, provider, log: () => {} }, checkedOut)).toBe('applied');
    expect((await getBalance(db, userId)).available).toBe(5);

    const id = `evt_${crypto.randomUUID()}`;
    await signedEvent({ id, eventId: 'pay_1', eventType: 'order.completed', mode: 'test', storeId: 'STO_0123456789abcdefghijkl', data: { orderId: 'ORD_1', orderMerchantExternalId: 'ord_1' } }, async (request) => {
      expect((await handleWebhook(deps(provider), request())).status).toBe(200);
      expect((await handleWebhook(deps(provider), request())).status).toBe(200);
    });
    expect((await getBalance(db, userId)).available).toBe(5);
    expect(await db.query.webhookEvents.findFirst({ where: and(eq(webhookEvents.provider, 'waffo'), eq(webhookEvents.eventId, id)) })).toBeDefined();
  });

  it('claws back all credits on a full refund', async () => {
    const userId = `u_${crypto.randomUUID()}`;
    const order = orderFixture(userId);
    const provider = new WaffoProvider({ merchantId: 'MER_0123456789abcdefghijkl', privateKey: TEST_PRIVATE_KEY, environment: 'test', storeId: 'STO_0123456789abcdefghijkl', enabled: true, products: [product], fetcher: waffoFetcher(order) });
    expect(await applyCheckout({ db, site, provider, log: () => {} }, await provider.fetchCheckout('ord_1'))).toBe('applied');
    expect((await getBalance(db, userId)).available).toBe(5);
    const payment = order.payments![0]!;
    payment.refundStatus = 'refunded';
    payment.refundedAmount = { amount: '4.99', currency: 'USD' };
    payment.isFullyRefunded = true;
    payment.refunds = [{ id: `ref_${crypto.randomUUID()}`, status: 'succeeded', amount: { amount: '4.99', currency: 'USD' } }];
    expect(await applyPayment({ db, site, provider, log: () => {} }, (await provider.fetchCheckout('ord_1')).payment!)).toBe('applied');
    expect((await getBalance(db, userId)).available).toBe(0);
  });

  it('does not grant credits for an unmapped Waffo product', async () => {
    const userId = `u_${crypto.randomUUID()}`;
    const order = orderFixture(userId, { onetimeProduct: { id: 'PROD_unknown00000000000000' } });
    const provider = new WaffoProvider({ merchantId: 'MER_0123456789abcdefghijkl', privateKey: TEST_PRIVATE_KEY, environment: 'test', storeId: 'STO_0123456789abcdefghijkl', enabled: true, products: [product], fetcher: waffoFetcher(order) });
    const fact = (await provider.fetchCheckout('ord_1')).payment!;
    expect(fact.productId).toBeNull();
    expect(await applyPayment({ db, site, provider, log: () => {} }, fact)).toBe('unmapped');
    expect((await getBalance(db, userId)).available).toBe(0);
  });
});
