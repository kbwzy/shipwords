import { defineSite } from '@shipwords/core/site';

// All config for this site. Prices are in the smallest currency unit (cents). Do not change id after launch.
export default defineSite({
  id: 'onmodelphotos',
  name: 'OnModel Photos',
  url: 'https://onmodelphotos.com',
  locales: ['en'],
  defaultLocale: 'en',
  products: [
    {
      id: 'pack_200',
      kind: 'credits',
      name: '200 credits',
      price: { amount: 2499, currency: 'usd' },
      credits: 200,
      expiresDays: null,
      refs: { waffo: 'PROD_1T4altg0bismS0mUiqXUZY' },
    },
    {
      id: 'pack_1000',
      kind: 'credits',
      name: '1,000 credits',
      price: { amount: 9999, currency: 'usd' },
      credits: 1000,
      expiresDays: null,
      refs: { waffo: 'PROD_1hFVCCrny6rw63gjwMby1s' },
    },
  ],
  // 5 bonus credits ≈ $0.15 upstream CAC; enough to try the studio and one retry.
  signup: { bonusCredits: 5, bonusExpiresDays: 30, bonusPerIpDaily: 3, bonusSiteDaily: 50 },
  // This guest block feeds core.authorize (recaptcha path), not the garment trial gate;
  // the live garment limits are GARMENT_TRIAL_LIMITS in src/site/garment-limits.server.ts. Keep both aligned.
  guest: { dailyPerDevice: 3, dailyPerIp: 12, dailySiteBudget: 30, minRecaptchaScore: 0.5 },
  billing: { provider: 'waffo' },
  analytics: {},
});
