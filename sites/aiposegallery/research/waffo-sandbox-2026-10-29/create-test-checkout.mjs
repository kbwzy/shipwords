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
  if(vars.WAFFO_ENVIRONMENT!=='test')throw Error('not_sandbox');
  const product=JSON.parse(await readFile(join(dir,'product.json'),'utf8'));
  if(product.environment!=='test'||!/^PROD_[A-Za-z0-9_-]+$/.test(product.id))throw Error('invalid_test_product');
  const id=randomUUID(),orderId=`pose-test-${id}`,key=`pose-test-checkout-${id}`;
  await save('CHECKOUT-ONCE.json',{orderId,idempotencyKey:key,environment:'test',createdAt:new Date().toISOString()});
  const client=new WaffoPancake({merchantId:vars.WAFFO_MERCHANT_ID,privateKey:vars.WAFFO_PRIVATE_KEY,environment:'test'});
  const result=await client.checkout.authenticated.create({productId:product.id,currency:'USD',buyerIdentity:`test-${id}`,successUrl:'https://aiposegallery.com/billing/return',metadata:{siteId:'aiposegallery',test:'sandbox-only'},orderMerchantExternalId:orderId},{idempotencyKey:key});
  const url=new URL(result.checkoutUrl);
  if(url.protocol!=='https:'||!url.hostname.endsWith('.waffo.ai')||!result.sessionId)throw Error('invalid_checkout_result');
  await save('checkout-result.json',{sessionCreated:true,host:url.hostname,environment:'test',createdAt:new Date().toISOString()});
  console.log('Sandbox checkout session created. No payment was submitted.');
}catch(error){const reason=/^(not_sandbox|invalid_test_product|invalid_checkout_result)$/.test(error?.message??'')?error.message:error?.code==='EEXIST'?'already_attempted':'request_failed_or_unknown';console.log(`Stopped: ${reason}. Inspect sandbox state before retrying.`);process.exitCode=1;}
