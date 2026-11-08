import { env } from 'cloudflare:test';
import { expect, it } from 'vitest';
import { createDb } from '@shipwords/core/db/client';
import { getBalance, grantCredits, spendCredits } from '@shipwords/core/credits/ledger';
import { poseLedger } from '../src/site/pose-billing.server';

it('refunds concurrent retries once against the real credit ledger', async () => {
  const db=createDb(env.DB), userId=`user_${crypto.randomUUID()}`, key=`request_${crypto.randomUUID()}`, taskId=crypto.randomUUID();
  await grantCredits(db,{userId,amount:1,idemKey:`grant:${key}`,source:'test'});
  const ledger=poseLedger(env.DB);
  expect(await ledger.spend(userId,key,taskId)).toBe('ok');
  await Promise.all(Array.from({length:4},()=>ledger.refund(key,taskId)));
  await ledger.refund(key,taskId);
  expect((await getBalance(db,userId)).available).toBe(1);
  const row=await env.DB.prepare("SELECT count(*) AS n FROM credit_ledger WHERE idem_key = ? AND kind = 'refund'").bind(`refund:pose:task:${taskId}`).first<{n:number}>();
  expect(row?.n).toBe(1);
});

it('does not refund another task that reused the same request key', async () => {
  const db=createDb(env.DB), userId=`user_${crypto.randomUUID()}`, key=`request_${crypto.randomUUID()}`;
  await grantCredits(db,{userId,amount:1,idemKey:`grant:${key}`,source:'test'});
  const ledger=poseLedger(env.DB);
  expect(await ledger.spend(userId,key,crypto.randomUUID())).toBe('ok');
  await ledger.refund(key,crypto.randomUUID());
  expect((await getBalance(db,userId)).available).toBe(0);
});

it('leaves ambiguous legacy charges for reconciliation without charging or refunding', async () => {
  const db=createDb(env.DB), userId=`user_${crypto.randomUUID()}`, key=`request_${crypto.randomUUID()}`, taskId=crypto.randomUUID();
  await grantCredits(db,{userId,amount:2,idemKey:`grant:${key}`,source:'test'});
  await spendCredits(db,{userId,amount:1,idemKey:`spend:pose:${key}`});
  const ledger=poseLedger(env.DB);
  expect(await ledger.spend(userId,key,taskId)).toBe('unavailable');
  await expect(ledger.refund(key,taskId)).rejects.toThrow('manual reconciliation');
  expect((await getBalance(db,userId)).available).toBe(1);
});

it('propagates ledger failures for recovery', async () => {
  const broken={prepare(){throw Error('ledger unavailable');}} as unknown as D1Database;
  await expect(poseLedger(broken).refund('request_123',crypto.randomUUID())).rejects.toThrow('ledger unavailable');
});
