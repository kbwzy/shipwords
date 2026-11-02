import {readFile,open} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {randomUUID} from 'node:crypto';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {WaffoPancake} from '../../../../packages/core/node_modules/@waffo/pancake-ts/dist/index.js';

const dir=dirname(fileURLToPath(import.meta.url)),site=resolve(dir,'../..');
async function save(name,data){const f=await open(join(dir,name),'wx',0o600);try{await f.writeFile(JSON.stringify(data,null,2)+'\n');await f.sync()}finally{await f.close()}}
try {
  const vars=parseEnv(await readFile(join(site,'.dev.vars'),'utf8'));
  if(vars.WAFFO_ENVIRONMENT!=='test'||!vars.WAFFO_STORE_ID||!vars.WAFFO_MERCHANT_ID||!vars.WAFFO_PRIVATE_KEY)throw Error('test_configuration_missing');
  const client=new WaffoPancake({merchantId:vars.WAFFO_MERCHANT_ID,privateKey:vars.WAFFO_PRIVATE_KEY,environment:'test'});
  const existing=await client.graphql.query({query:'query ($storeId: String!) { onetimeProducts(storeId: $storeId) { id name status } }',variables:{storeId:vars.WAFFO_STORE_ID}});
  if(existing.errors?.length||!existing.data)throw Error('product_query_failed');
  if(existing.data.onetimeProducts.some(x=>x.name==='TEST ONLY - Pose checkout'))throw Error('test_product_already_exists');
  const idempotencyKey=`pose-sandbox-${randomUUID()}`;
  await save('CREATE-ONCE.json',{idempotencyKey,name:'TEST ONLY - Pose checkout',currency:'USD',amount:'1.00',environment:'test',createdAt:new Date().toISOString()});
  const {product}=await client.onetimeProducts.create({storeId:vars.WAFFO_STORE_ID,name:'TEST ONLY - Pose checkout',description:'Sandbox checkout validation only; not a real purchase.',prices:{USD:{amount:'1.00',taxCategory:'digital_goods'}}},{idempotencyKey});
  if(!product?.id||!/^PROD_[A-Za-z0-9_-]+$/.test(product.id))throw Error('product_result_unknown');
  await save('product.json',{id:product.id,environment:'test',createdAt:new Date().toISOString()});
  console.log('Sandbox product created. No live product was published.');
} catch(error) {
  const reason=/^(test_configuration_missing|product_query_failed|test_product_already_exists|product_result_unknown)$/.test(error?.message??'')?error.message:error?.code==='EEXIST'?'already_attempted':'request_failed_or_unknown';
  console.log(`Stopped: ${reason}. Inspect sandbox state before retrying.`);process.exitCode=1;
}
