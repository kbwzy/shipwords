import { readFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import { WaffoPancake } from '../../../../packages/core/node_modules/@waffo/pancake-ts/dist/index.js';

const dir = dirname(fileURLToPath(import.meta.url));
const site = resolve(dir, '../..');

const MERCHANT_QUERY = `query MerchantKeys($id: String!) {
  merchant(id: $id) {
    id
    status
    apiKeys { nickname environment recentlyUsed createdAt }
  }
}`;

const PRODUCTS_QUERY = `query StoreProducts($storeId: String!) {
  onetimeProducts(storeId: $storeId) {
    id name status
  }
}`;

async function main() {
  const vars = parseEnv(await readFile(join(site, '.dev.vars'), 'utf8'));
  if (!vars.WAFFO_MERCHANT_ID || !vars.WAFFO_PRIVATE_KEY || !vars.WAFFO_STORE_ID) {
    throw new Error('waffo configuration incomplete in .dev.vars');
  }
  const client = new WaffoPancake({
    merchantId: vars.WAFFO_MERCHANT_ID,
    privateKey: vars.WAFFO_PRIVATE_KEY,
  });
  const merchant = await client.graphql.query({
    query: MERCHANT_QUERY,
    variables: { id: vars.WAFFO_MERCHANT_ID },
  });
  if (merchant.errors?.length || !merchant.data?.merchant) throw new Error('merchant query failed');
  const products = await client.graphql.query({
    query: PRODUCTS_QUERY,
    variables: { storeId: vars.WAFFO_STORE_ID },
  });
  if (products.errors?.length || !products.data?.onetimeProducts) throw new Error('products query failed');
  const report = {
    merchantStatus: merchant.data.merchant.status,
    apiKeys: merchant.data.merchant.apiKeys.map((k) => ({
      nickname: k.nickname,
      environment: k.environment,
      recentlyUsed: k.recentlyUsed,
      createdAt: k.createdAt,
    })),
    products: products.data.onetimeProducts.map((p) => ({ id: p.id, name: p.name, status: p.status })),
  };
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error('Stopped: configuration, transport, or API response unavailable.');
    process.exitCode = 1;
  });
}
