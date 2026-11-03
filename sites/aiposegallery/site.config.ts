import { defineSite, type Product } from '@shipwords/core/site';

// Credit packs published on Waffo (prod versions, 2026-11-02). Prices stay
// fail-closed in prod until WAFFO_ENVIRONMENT=prod and WAFFO_BILLING_ENABLED=true.
const products: Product[] = [
  { id: 'pack_5', kind: 'credits', name: 'Starter', price: { amount: 499, currency: 'usd' }, credits: 5, expiresDays: null, refs: { waffo: 'PROD_2tcBAsv99JD5wzOdydQBSQ' } },
  { id: 'pack_15', kind: 'credits', name: 'Studio', price: { amount: 1199, currency: 'usd' }, credits: 15, expiresDays: null, refs: { waffo: 'PROD_4e8gjpYq74t2pmYlnQJU39' } },
  { id: 'pack_40', kind: 'credits', name: 'Pro', price: { amount: 2899, currency: 'usd' }, credits: 40, expiresDays: null, refs: { waffo: 'PROD_0bUr7GeXBuquFUd8lRQs9R' } },
];

export default defineSite({
  id: 'aiposegallery',
  name: 'AI Pose Gallery',
  url: 'https://aiposegallery.com',
  locales: ['en'],
  defaultLocale: 'en',
  products,
  signup: { bonusCredits: 0, bonusExpiresDays: null, bonusPerIpDaily: 0 },
  guest: { dailyPerDevice: 0, dailyPerIp: 0, dailySiteBudget: 0, minRecaptchaScore: 0.5 },
  billing: { provider: 'waffo' },
  analytics: { ga4: 'G-9YRWPVK12E', clarity: 'z7nnys9r4v' },
});
