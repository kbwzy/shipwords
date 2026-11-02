import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { admitPoseRequest } from '../src/site/pose-admission.server.ts';

async function memoryDb() {
  const sqlite = new DatabaseSync(':memory:');
  const migration = await readFile(new URL('../migrations/20261029134216_spooky_raza.sql', import.meta.url), 'utf8');
  sqlite.exec(migration.replaceAll('--> statement-breakpoint', ''));
  const ipMigration = await readFile(new URL('../migrations/20261029162210_superb_wilson_fisk.sql', import.meta.url), 'utf8');
  sqlite.exec(ipMigration.replaceAll('--> statement-breakpoint', ''));
  const userMigration = await readFile(new URL('../migrations/20261103100000_pose_user_id.sql', import.meta.url), 'utf8');
  sqlite.exec(userMigration.replaceAll('--> statement-breakpoint', ''));
  return {
    sqlite,
    prepare(sql) { return { bind(...values) { return { async first() { return sqlite.prepare(sql).get(...values) ?? null; } }; } }; },
  };
}
const base = { ownerId: 'guest_a', requestKey: 'request-00000001', inputDigest: 'a'.repeat(64), nowMs: Date.UTC(2026, 9, 29), dailySiteLimit: 3, dailyOwnerLimit: 2, dailyIpLimit:10000, ipHash:'1'.repeat(64) };

test('migration preserves pre-existing admissions and their site and visitor quotas', async () => {
  const sqlite = new DatabaseSync(':memory:');
  const original = await readFile(new URL('../migrations/20261029134216_spooky_raza.sql', import.meta.url), 'utf8');
  const migration = await readFile(new URL('../migrations/20261029162210_superb_wilson_fisk.sql', import.meta.url), 'utf8');
  const userMigration = await readFile(new URL('../migrations/20261103100000_pose_user_id.sql', import.meta.url), 'utf8');
  sqlite.exec(original.replaceAll('--> statement-breakpoint', ''));
  sqlite.prepare('INSERT INTO pose_requests (id,owner_id,request_key,input_digest,day,status,created_at) VALUES (?,?,?,?,?,?,?)').run('old-id',base.ownerId,base.requestKey,base.inputDigest,'2026-10-29','accepted',base.nowMs);
  sqlite.exec(migration.replaceAll('--> statement-breakpoint', ''));
  sqlite.exec(userMigration.replaceAll('--> statement-breakpoint', ''));
  const db={prepare(sql){return {bind(...values){return {async first(){return sqlite.prepare(sql).get(...values) ?? null;}};}};}};
  assert.deepEqual(await admitPoseRequest(db,base),{kind:'existing',id:'old-id',status:'accepted'});
  assert.deepEqual(await admitPoseRequest(db,{...base,requestKey:'request-00000002',dailyOwnerLimit:1}),{kind:'limit'});
  assert.equal(sqlite.prepare('SELECT ip_hash FROM pose_requests WHERE id=?').get('old-id').ip_hash,null);
  sqlite.close();
});

test('replays recover the same job, changed inputs conflict, even after the quota fills', async () => {
  const db = await memoryDb();
  const first = await admitPoseRequest(db, base);
  assert.equal(first.kind, 'accepted');
  assert.deepEqual(await admitPoseRequest(db, base), { kind: 'existing', id: first.id, status: 'accepted' });
  assert.deepEqual(await admitPoseRequest(db, {...base, inputDigest:'b'.repeat(64)}), {kind:'conflict'});
  assert.equal((await admitPoseRequest(db, {...base, requestKey:'request-00000002'})).kind, 'accepted');
  assert.deepEqual(await admitPoseRequest(db, {...base, requestKey:'request-00000003'}), {kind:'limit'});
  assert.equal((await admitPoseRequest(db, base)).kind, 'existing');
  assert.equal((await admitPoseRequest(db, {...base, requestKey:'request-00000003', nowMs:base.nowMs + 86_400_000})).kind, 'accepted');
  db.sqlite.close();
});

test('concurrent identities cannot exceed the daily site cap or create duplicate jobs', async () => {
  const db = await memoryDb();
  const same = await Promise.all(Array.from({length:20}, () => admitPoseRequest(db, base)));
  assert.equal(same.filter(result => result.kind === 'accepted').length, 1);
  assert.equal(new Set(same.map(result => result.id)).size, 1);
  const others = await Promise.all(Array.from({length:20}, (_, i) => admitPoseRequest(db, {...base, ownerId:`guest_${i}`, requestKey:`request-${String(i).padStart(8,'0')}`})));
  assert.equal(others.filter(result => result.kind === 'accepted').length, 2);
  assert.equal(db.sqlite.prepare('select count(*) as count from pose_requests').get().count, 3);
  db.sqlite.close();
});

test('rejects unsafe limits and malformed identity or keys', async () => {
  const db = await memoryDb();
  for (const changes of [{dailySiteLimit:-1}, {dailyOwnerLimit:1.2}, {ownerId:''}, {requestKey:'bad'}, {inputDigest:'bad'}]) {
    await assert.rejects(admitPoseRequest(db, {...base, ...changes}));
  }
  assert.equal(db.sqlite.prepare('select count(*) as count from pose_requests').get().count, 0);
  db.sqlite.close();
});
