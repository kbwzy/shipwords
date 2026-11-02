import { WaffoPancake, verifyWebhook, type WebhookEvent, type WebhookEventData } from '@waffo/pancake-ts';
import type { Product } from '../site';
import type { CheckoutFact, CheckoutRequest, PaymentFact, PaymentProvider, SubscriptionFact, WebhookTrigger } from './provider';
import { WebhookSignatureError } from './provider';

export interface WaffoOptions {
  merchantId: string;
  privateKey: string;
  environment: 'test' | 'prod';
  storeId?: string;
  /** Catalog used to map Waffo product IDs (PROD_...) back to this site's product IDs. */
  products?: readonly Product[];
  /** Sandbox checkouts and reconciliation are enabled only when explicitly allowed. */
  enabled?: boolean;
  fetcher?: typeof fetch;
  /** Prefilled promotion code shown on the hosted cashier (checkout sessions only). */
  promotionCode?: string;
}

const BLOCKED = 'Waffo billing disabled: payment and refund evidence is unverified';

function isSandboxHost(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.test') ||
      hostname.startsWith('sandbox.') ||
      hostname.startsWith('test.')
    );
  } catch {
    return false;
  }
}

const CURRENCY_DECIMALS: Readonly<Record<string, number>> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  CNY: 2,
  EUR: 2,
  GBP: 2,
  USD: 2,
};

/** Waffo amounts are display strings ("4.99" for USD); convert to minor units. */
function displayToMinor(amount: string | undefined | null, currency: string): number {
  const raw = amount?.trim();
  if (!raw) return 0;
  const decimals = CURRENCY_DECIMALS[currency.toUpperCase()] ?? 2;
  const pattern = new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`);
  if (!pattern.test(raw)) throw new Error(`Invalid Waffo amount ${raw} for ${currency}`);
  const [whole, fraction = ''] = raw.split('.');
  const value = Number(whole) * 10 ** decimals + Number((fraction + '0'.repeat(decimals)).slice(0, decimals));
  if (!Number.isSafeInteger(value)) throw new Error(`Invalid Waffo amount ${raw} for ${currency}`);
  return value;
}

interface WaffoMoney {
  amount: string | null;
  currency: string | null;
}

interface WaffoRefund {
  id: string;
  status: string;
  amount: WaffoMoney | null;
}

interface WaffoChargeback {
  id: string;
  status: string;
  amount: WaffoMoney | null;
}

interface WaffoPayment {
  id: string;
  status: string;
  amount: WaffoMoney | null;
  refundedAmount: WaffoMoney | null;
  isFullyRefunded: boolean;
  refundStatus: string;
  pspPaymentId: string | null;
  createdAt: string | null;
  refunds: WaffoRefund[] | null;
  chargebacks: WaffoChargeback[] | null;
  onetimeOrder: WaffoOrder | null;
}

interface WaffoOrder {
  id: string;
  orderMerchantExternalId: string | null;
  merchantProvidedBuyerIdentity: string;
  buyerEmail: string;
  currency: string;
  status: string;
  testMode: boolean;
  createdAt: string | null;
  onetimeProduct: { id: string } | null;
  payments: WaffoPayment[] | null;
}

/** Chargeback statuses are provider strings; map conservatively to our dispute model. */
function disputeFor(chargebacks: WaffoChargeback[] | null): PaymentFact['dispute'] {
  if (!chargebacks?.length) return null;
  const status = chargebacks.map((item) => item.status.toLowerCase()).join(' ');
  if (status.includes('won') || status.includes('reversed') || status.includes('accepted')) return 'won';
  if (status.includes('lost') || status.includes('rejected') || status.includes('declined')) return 'lost';
  return 'open';
}

function productIdFor(options: WaffoOptions, waffoProductId: string | null | undefined): string | null {
  if (!waffoProductId) return null;
  return options.products?.find((product) => product.refs?.waffo === waffoProductId)?.id ?? null;
}

function paymentFact(options: WaffoOptions, payment: WaffoPayment): PaymentFact | null {
  const order = payment.onetimeOrder;
  if (!order) return null;
  const currency = payment.amount?.currency ?? order.currency ?? '';
  if (!currency) return null;
  return {
    provider: 'waffo',
    paymentRef: payment.id,
    chargeRef: payment.pspPaymentId ?? null,
    paid: payment.status === 'succeeded',
    amount: displayToMinor(payment.amount?.amount, currency),
    currency: currency.toLowerCase(),
    amountRefunded: displayToMinor(payment.refundedAmount?.amount, currency),
    dispute: disputeFor(payment.chargebacks),
    // Checkout is created with the merchant's private key and binds our
    // orderMerchantExternalId and buyerIdentity server-side, so the metadata is
    // as trustworthy as Stripe's server-key metadata.
    metadataTrusted: true,
    userId: order.merchantProvidedBuyerIdentity || null,
    productId: productIdFor(options, order.onetimeProduct?.id),
    orderId: order.orderMerchantExternalId,
    subscriptionRef: null,
    periodStart: null,
    periodEnd: null,
    paidAt: payment.createdAt ? Date.parse(payment.createdAt) || null : null,
    fetchedAt: Date.now(),
  };
}

const ORDER_FIELDS = `
  id orderMerchantExternalId merchantProvidedBuyerIdentity buyerEmail currency status testMode createdAt
  onetimeProduct { id }
  payments {
    id status pspPaymentId createdAt refundStatus isFullyRefunded
    amount { amount currency } refundedAmount { amount currency }
    refunds { id status amount { amount currency } }
    chargebacks { id status amount { amount currency } }
    onetimeOrder { id orderMerchantExternalId merchantProvidedBuyerIdentity currency status testMode onetimeProduct { id } }
  }
`;

export class WaffoProvider implements PaymentProvider {
  readonly name = 'waffo';
  readonly enabled: boolean;
  private readonly client: WaffoPancake;
  private readonly products: readonly Product[] | undefined;

  constructor(private readonly options: WaffoOptions) {
    this.enabled = options.enabled ?? false;
    this.products = options.products;
    this.client = new WaffoPancake({
      merchantId: options.merchantId,
      privateKey: options.privateKey,
      ...(options.fetcher ? { fetch: options.fetcher } : {}),
    });
  }

  private ensureEnabled(): void {
    if (!this.enabled) throw new Error(BLOCKED);
  }

  async createCustomer(user: { id: string }): Promise<string> {
    // Waffo binds orders to the buyerIdentity we pass at checkout time; no
    // separate customer record exists, so the user id itself is the stable ref.
    return user.id;
  }

  async createCheckout(request: CheckoutRequest): Promise<{ url: string; checkoutRef: string }> {
    this.ensureEnabled();
    const productId = request.product.refs?.waffo;
    if (!productId) throw new Error('Waffo product not configured');
    const result = await this.client.checkout.authenticated.create({
      productId,
      currency: request.product.price.currency.toUpperCase(),
      buyerIdentity: request.customerRef,
      successUrl: request.successUrl,
      orderMerchantExternalId: request.orderId,
      ...(this.options.promotionCode
        ? { promotionCode: this.options.promotionCode, allowPromotionCodes: true }
        : {}),
    });
    // Our order id is the stable ref; the provider fetches by orderMerchantExternalId.
    return { url: result.checkoutUrl, checkoutRef: request.orderId };
  }

  async parseWebhook(request: Request): Promise<WebhookTrigger> {
    this.ensureEnabled();
    if (this.options.environment === 'test' && !isSandboxHost(request.url)) {
      throw new WebhookSignatureError('Waffo test webhook requires a sandbox host');
    }
    const signature = request.headers.get('x-waffo-signature');
    if (!signature) throw new WebhookSignatureError('missing x-waffo-signature header');
    const body = await request.text();
    let event: WebhookEvent<WebhookEventData>;
    try {
      event = verifyWebhook<WebhookEventData>(body, signature, { environment: this.options.environment });
    } catch (error) {
      throw new WebhookSignatureError(error instanceof Error ? error.message : 'invalid Waffo signature');
    }
    if (event.mode !== this.options.environment || (this.options.storeId && event.storeId !== this.options.storeId)) {
      throw new WebhookSignatureError('Waffo webhook environment or store mismatch');
    }
    if (!event.id || !event.eventType) throw new WebhookSignatureError('invalid Waffo webhook event');
    const data = event.data ?? ({} as WebhookEventData);
    // Order and refund events converge on the whole order: fetchCheckout reads
    // payments, refunds and chargebacks from the provider before granting.
    if (event.eventType === 'order.completed' || event.eventType === 'refund.succeeded' || event.eventType === 'refund.failed') {
      return {
        eventId: event.id,
        type: event.eventType,
        target: { kind: 'checkout', ref: data.orderMerchantExternalId ?? data.orderId },
      };
    }
    return { eventId: event.id, type: event.eventType, target: null };
  }

  async fetchCheckout(checkoutRef: string): Promise<CheckoutFact> {
    this.ensureEnabled();
    const byExternal = await this.queryOrders(checkoutRef);
    const order = byExternal ?? (await this.queryOrderById(checkoutRef));
    if (!order) return { orderId: null, payment: null, subscription: null };
    const payment = order.payments?.find((item) => item.status === 'succeeded');
    return {
      orderId: order.orderMerchantExternalId,
      payment: payment ? paymentFact(this.options, payment) : null,
      subscription: null,
    };
  }

  async fetchPayment(paymentRef: string): Promise<PaymentFact | null> {
    this.ensureEnabled();
    const response = await this.client.graphql.query<{ payment: WaffoPayment | null }>({
      query: `query ($id: String!) { payment(id: $id) { ${ORDER_FIELDS} } }`,
      variables: { id: paymentRef },
    });
    const payment = response.data?.payment;
    if (!payment?.onetimeOrder) return null;
    return paymentFact(this.options, payment);
  }

  async fetchPaymentByCharge(chargeRef: string): Promise<PaymentFact | null> {
    this.ensureEnabled();
    const response = await this.client.graphql.query<{ payments: WaffoPayment[] | null }>({
      query: `query ($storeId: String!, $chargeRef: String!) {
        payments(storeId: $storeId, limit: 1, filter: { pspPaymentId: { eq: $chargeRef } }) {
          id status pspPaymentId createdAt refundStatus isFullyRefunded
          amount { amount currency } refundedAmount { amount currency }
          refunds { id status amount { amount currency } }
          chargebacks { id status amount { amount currency } }
          onetimeOrder { id orderMerchantExternalId merchantProvidedBuyerIdentity currency status testMode onetimeProduct { id } }
        }
      }`,
      variables: { storeId: this.options.storeId, chargeRef },
    });
    const payment = response.data?.payments?.[0];
    if (!payment?.onetimeOrder) return null;
    return paymentFact(this.options, payment);
  }

  async fetchSubscription(_subscriptionRef: string): Promise<SubscriptionFact | null> {
    // One-time credit packs only; subscriptions are rejected at catalog load.
    return null;
  }

  async portalUrl(customerRef: string): Promise<string> {
    this.ensureEnabled();
    if (!this.options.storeId) throw new Error('Waffo store not configured');
    const link = await this.client.auth.createCustomerPortalLink({ storeId: this.options.storeId, buyerIdentity: customerRef });
    return link.portalUrl;
  }

  private async queryOrders(externalId: string): Promise<WaffoOrder | null> {
    const response = await this.client.graphql.query<{ onetimeOrders: WaffoOrder[] | null }>({
      query: `query ($storeId: String!, $externalId: String!) {
        onetimeOrders(storeId: $storeId, limit: 1, filter: { orderMerchantExternalId: { eq: $externalId } }) {
          ${ORDER_FIELDS}
        }
      }`,
      variables: { storeId: this.options.storeId, externalId },
    });
    return response.data?.onetimeOrders?.[0] ?? null;
  }

  private async queryOrderById(id: string): Promise<WaffoOrder | null> {
    const response = await this.client.graphql.query<{ onetimeOrder: WaffoOrder | null }>({
      query: `query ($id: String!) { onetimeOrder(id: $id) { ${ORDER_FIELDS} } }`,
      variables: { id },
    });
    return response.data?.onetimeOrder ?? null;
  }
}
