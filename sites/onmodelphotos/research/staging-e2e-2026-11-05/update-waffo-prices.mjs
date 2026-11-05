import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';

// Updates the two Waffo TEST product prices in place (same PROD_ ids, so site.config
// refs stay valid). Test environment only — publishing to prod is a separate action.
const site = '/Users/horin/personal/projects/游戏攻略站/天蓝/shipwords/sites/onmodelphotos';
const vars = parseEnv(await readFile(`${site}/.dev.vars`, 'utf8'));
if (vars.WAFFO_ENVIRONMENT !== 'test' || !vars.WAFFO_STORE_ID || !vars.WAFFO_MERCHANT_ID || !vars.WAFFO_PRIVATE_KEY) throw new Error('test_configuration_missing');
const { WaffoPancake } = await import('/Users/horin/personal/projects/游戏攻略站/天蓝/shipwords/packages/core/node_modules/@waffo/pancake-ts/dist/index.js');
const client = new WaffoPancake({ merchantId: vars.WAFFO_MERCHANT_ID, privateKey: vars.WAFFO_PRIVATE_KEY, environment: 'test' });

const updates = [
  { id: 'PROD_1T4altg0bismS0mUiqXUZY', name: '200 credits', amount: '24.99' },
  { id: 'PROD_1hFVCCrny6rw63gjwMby1s', name: '1,000 credits', amount: '99.99' },
];
for (const u of updates) {
  const res = await client.onetimeProducts.update({
    id: u.id,
    name: u.name,
    prices: { USD: { amount: u.amount, taxCategory: 'digital_goods' } },
  });
  const p = res.product;
  const usd = p.prices?.USD?.amount ?? p.prices?.usd?.amount ?? JSON.stringify(p.prices);
  console.log(`${u.name}: id=${p.id} status=${p.status} USD=${usd}${res.warnings?.length ? ' warnings=' + res.warnings.map(w => w.code ?? w.message).join(',') : ''}`);
}
console.log('done');
