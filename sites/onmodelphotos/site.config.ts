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
      price: { amount: 499, currency: 'usd' },
      credits: 200,
      expiresDays: null,
      refs: { waffo: 'PROD_1T4altg0bismS0mUiqXUZY' },
    },
    {
      id: 'pack_1000',
      kind: 'credits',
      name: '1,000 credits',
      price: { amount: 1999, currency: 'usd' },
      credits: 1000,
      expiresDays: null,
      refs: { waffo: 'PROD_1hFVCCrny6rw63gjwMby1s' },
    },
  ],
  signup: { bonusCredits: 20, bonusExpiresDays: 30, bonusPerIpDaily: 3, bonusSiteDaily: 50 },
  guest: { dailyPerDevice: 2, dailyPerIp: 4, dailySiteBudget: 200, minRecaptchaScore: 0.5 },
  billing: { provider: 'waffo' },
  analytics: {},
});
