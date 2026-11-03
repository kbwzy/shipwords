import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { admitGarmentRequest, admitTrialGarmentRequest, admitPaidGarmentRequest } from '../src/site/garment-admission.server.ts';

async function memoryDb() {
  const sqlite = new DatabaseSync(':memory:');
  for (const name of ['20261027054645_init.sql', '20261028144218_little_mulholland_black.sql', '20261103020513_rainy_rhino.sql', '20261103063105_tiny_sunset_bain.sql']) {
    const migration = await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8');
    sqlite.exec(migration.replaceAll('--> statement-breakpoint', ''));
  }
  return {
    sqlite,
    prepare(sql) { return { bind(...values) { return { async first() { return sqlite.prepare(sql).get(...values) ?? null; } }; } }; },
  };
}
const base = { ownerId: 'guest_a', requestKey: 'request-00000001', inputDigest: 'a'.repeat(64), nowMs: Date.UTC(2026, 10, 3), dailySiteLimit: 3, dailyOwnerLimit: 2, dailyIpLimit: 10000, ipHash: '1'.repeat(64) };

test('replays recover the same job, changed inputs conflict, even after the quota fills', async () => {
  const db = await memoryDb();
  const first = await admitGarmentRequest(db, base);
  assert.equal(first.kind, 'accepted');
  assert.deepEqual(await admitGarmentRequest(db, base), { kind: 'existing', id: first.id, status: 'accepted' });
  assert.deepEqual(await admitGarmentRequest(db, { ...base, inputDigest: 'b'.repeat(64) }), { kind: 'conflict' });
  assert.equal((await admitGarmentRequest(db, { ...base, requestKey: 'request-00000002' })).kind, 'accepted');
  assert.deepEqual(await admitGarmentRequest(db, { ...base, requestKey: 'request-00000003' }), { kind: 'limit' });
  assert.equal((await admitGarmentRequest(db, base)).kind, 'existing');
  assert.equal((await admitGarmentRequest(db, { ...base, requestKey: 'request-00000003', nowMs: base.nowMs + 86_400_000 })).kind, 'accepted');
  db.sqlite.close();
});

test('paid rows persist the user id and ignore trial quotas; trial rows stay anonymous', async () => {
  const db = await memoryDb();
  const paid = await admitPaidGarmentRequest(db, { ...base, userId: 'user_123' });
  assert.equal(paid.kind, 'accepted');
  assert.equal(db.sqlite.prepare('SELECT user_id FROM garment_requests WHERE id=?').get(paid.id).user_id, 'user_123');
  // Paid admission has no per-owner cap: 4 requests over dailyOwnerLimit 2 all land.
  for (let i = 0; i < 4; i++) {
    const result = await admitPaidGarmentRequest(db, { ...base, ownerId: `guest_paid_${i}`, requestKey: `request-paid-${String(i).padStart(8, '0')}` });
    assert.equal(result.kind, 'accepted');
  }
  const trial = await admitTrialGarmentRequest(db, { ownerId: 'guest_b', requestKey: 'request-00000010', inputDigest: 'c'.repeat(64), nowMs: base.nowMs, ipHash: '2'.repeat(64) });
  assert.equal(trial.kind, 'accepted');
  assert.equal(db.sqlite.prepare('SELECT user_id FROM garment_requests WHERE id=?').get(trial.id).user_id, null);
  db.sqlite.close();
});

test('concurrent identities cannot exceed the daily site cap or create duplicate jobs', async () => {
  const db = await memoryDb();
  const same = await Promise.all(Array.from({ length: 20 }, () => admitGarmentRequest(db, base)));
  assert.equal(same.filter((result) => result.kind === 'accepted').length, 1);
  assert.equal(new Set(same.map((result) => result.id)).size, 1);
  const others = await Promise.all(Array.from({ length: 20 }, (_, i) => admitGarmentRequest(db, { ...base, ownerId: `guest_${i}`, requestKey: `request-${String(i).padStart(8, '0')}` })));
  assert.equal(others.filter((result) => result.kind === 'accepted').length, 2);
  assert.equal(db.sqlite.prepare('select count(*) as count from garment_requests').get().count, 3);
  db.sqlite.close();
});

test('rejects unsafe limits and malformed identity or keys', async () => {
  const db = await memoryDb();
  for (const changes of [{ dailySiteLimit: -1 }, { dailyOwnerLimit: 1.2 }, { ownerId: '' }, { requestKey: 'bad' }, { inputDigest: 'bad' }]) {
    await assert.rejects(admitGarmentRequest(db, { ...base, ...changes }));
  }
  assert.equal(db.sqlite.prepare('select count(*) as count from garment_requests').get().count, 0);
  db.sqlite.close();
});
