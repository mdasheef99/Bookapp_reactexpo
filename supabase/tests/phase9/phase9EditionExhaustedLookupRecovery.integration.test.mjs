// M75 / picker SDD §§4.3/5/9 (2026-10-17 amendment): exhausted edition-search recovery.
// Disposable SQL proof, synthetic data only. M75_BASELINE=1 runs without M75 (expected RED).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { migrationPath } from './databaseHarness.mjs';
import { createCommitDatabase } from './editionPickerCommitFixture.mjs';
import { lookupSql, readSql, resetActor, scalar, setActor } from './editionPickerFixture.mjs';
import { candidateTruth, fail, seedOperation } from './editionOptionsCompletionFixture.mjs';

const M75 = '20261017000075_marketplace_phase9_edition_picker_exhausted_lookup_recovery.sql';
const baseline = process.env.M75_BASELINE === '1';
let db;
before(async () => {
  db = await createCommitDatabase();
  for (const file of [
    '20261008000070_marketplace_phase9_edition_picker_confirmation.sql',
    '20261010000071_marketplace_phase9_edition_picker_selection_eligibility.sql',
    '20261010000072_marketplace_phase9_edition_picker_superseded_jobs.sql',
    '20261011000073_marketplace_phase9_open_library_edition_options.sql',
    '20261012000074_marketplace_phase9_open_library_author_isolation.sql',
    '20261016000076_marketplace_phase9_edition_explicit_matching.sql',
    ...(baseline ? [] : [M75]),
    '20261017000077_marketplace_phase9_edition_matching_variants.sql',
  ]) await db.exec(fs.readFileSync(migrationPath(file), 'utf8'));
});
after(async () => { await db?.close(); });

// A claimed request moved to attempt `attempt` of 5 with the given status and lease.
async function request(attempt = 5, status = 'in_progress', lease = "transaction_timestamp()-interval '1 minute'") {
  const f = await seedOperation(db);
  await resetActor(db);
  await db.query('UPDATE public.image_extraction_jobs SET status=$1,attempt_count=$2,lease_expires_at='
    + (status === 'in_progress' ? lease : 'NULL') + ' WHERE id=$3', [status, attempt, f.jobId]);
  f.attempt = attempt;
  return f;
}
async function job(id) {
  await resetActor(db);
  return (await db.query('SELECT status,attempt_count,last_safe_error_code,lease_expires_at,lease_token_hash,'
    + 'dead_lettered_at FROM public.image_extraction_jobs WHERE id=$1', [id])).rows[0];
}
async function jobs(f) {
  await resetActor(db);
  return (await db.query("SELECT id,status FROM public.image_extraction_jobs WHERE entity_id=$1"
    + " AND operation_version='p9-owner-edition-options-v1' ORDER BY created_at,id", [f.candidateId])).rows;
}
async function state(f) {
  await resetActor(db);
  return (await db.query('SELECT request_id,request_generation,selection_id,selected_source,selected_source_id,'
    + 'selected_option_snapshot FROM public.phase9_candidate_edition_state WHERE candidate_id=$1', [f.candidateId])).rows[0];
}
async function asOwner(f, sql) { await setActor(db, f.ownerId); return scalar(db, sql); }
const search = (f, key = randomUUID(), command = randomUUID(), generation = 0) =>
  asOwner(f, lookupSql(f, generation, key, command));

test('M75 helper is private to the owning role', { skip: baseline }, async () => {
  await resetActor(db);
  const row = (await db.query(`SELECT r.rolname AS owner,
    has_function_privilege('anon',p.oid,'EXECUTE') AS anon,
    has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated,
    has_function_privilege('service_role',p.oid,'EXECUTE') AS service
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner
    WHERE n.nspname='marketplace_sec' AND p.proname='phase9_edition_job_exhausted'`)).rows;
  assert.deepEqual(row, [{ owner: 'postgres', anon: false, authenticated: false, service: false }]);
});

for (const [label, status] of [['expired fifth lease', 'in_progress'], ['fifth retry', 'retry_scheduled'],
  ['open at the limit', 'open']]) {
  test('exhausted request (' + label + ') reads failed and Search Books starts exactly one new request', async () => {
    const f = await request(5, status);
    const before = await candidateTruth(db, f);
    const selection = await state(f);
    assert.equal((await asOwner(f, readSql(f))).lookupStatus, 'failed');
    // Reads stay read-only.
    assert.equal((await job(f.jobId)).status, status);

    const receipt = await search(f);
    assert.notEqual(receipt.operationId, f.jobId);
    assert.equal(receipt.status, 'pending');
    const old = await job(f.jobId);
    assert.equal(old.status, 'dead_letter');
    assert.equal(old.attempt_count, 5);
    assert.equal(old.last_safe_error_code, 'P9_METADATA_ATTEMPTS_EXHAUSTED');
    assert.equal(old.lease_expires_at, null); assert.equal(old.lease_token_hash, null);
    assert.notEqual(old.dead_lettered_at, null);
    const all = await jobs(f);
    assert.equal(all.length, 2);
    assert.deepEqual(all.find(j => j.id === receipt.operationId), { id: receipt.operationId, status: 'open' });
    const after = await state(f);
    assert.equal(after.request_id, receipt.operationId);
    assert.deepEqual({ ...after, request_id: null }, { ...selection, request_id: null });
    assert.deepEqual(await candidateTruth(db, f), before);
    assert.equal((await asOwner(f, readSql(f))).lookupStatus, 'pending');
  });
}

for (const [label, attempt, lease] of [
  ['an active fifth lease', 5, "transaction_timestamp()+interval '4 minutes'"],
  ['a reclaimable earlier attempt', 2, "transaction_timestamp()-interval '1 minute'"],
]) test(label + ' stays pending and Search Books keeps it', async () => {
  const f = await request(attempt, 'in_progress', lease);
  assert.equal((await asOwner(f, readSql(f))).lookupStatus, 'pending');
  const receipt = await search(f);
  assert.equal(receipt.operationId, f.jobId);
  assert.equal(receipt.status, 'pending');
  assert.equal((await job(f.jobId)).status, 'in_progress');
  assert.equal((await jobs(f)).length, 1);
});

test('replaying the same Search Books command returns the same new request', async () => {
  const f = await request();
  const key = randomUUID(), command = randomUUID();
  const first = await search(f, key, command);
  const second = await search(f, key, command);
  assert.equal(second.operationId, first.operationId);
  assert.equal((await jobs(f)).length, 2);
  // A second, different command finds the new request pending and adds nothing.
  assert.equal((await search(f)).operationId, first.operationId);
  assert.equal((await jobs(f)).length, 2);
});

test('another user or a stale generation cannot close the exhausted request', async () => {
  const f = await request();
  await setActor(db, randomUUID());
  await assert.rejects(scalar(db, lookupSql(f)));
  await assert.rejects(search(f, randomUUID(), randomUUID(), 7), /P9_VERSION_CONFLICT/u);
  assert.equal((await job(f.jobId)).status, 'in_progress');
  assert.equal((await jobs(f)).length, 1);
});

test('a late worker result for the retired request is rejected', async () => {
  const f = await request();
  await search(f);
  await setActor(db, f.ownerId, 'service_role');
  await assert.rejects(fail(db, f));
  assert.equal((await job(f.jobId)).status, 'dead_letter');
});

test('the worker claim never takes an exhausted request', async () => {
  const f = await request();
  await setActor(db, f.ownerId, 'service_role');
  const rows = (await db.query("SELECT id FROM public.claim_phase9_metadata_jobs(10,'picker-worker-0002')")).rows;
  assert.equal(rows.some(r => r.id === f.jobId), false);
  assert.equal((await job(f.jobId)).status, 'in_progress');
});

test('only edition-options jobs count as exhausted', { skip: baseline }, async () => {
  const f = await request();
  await resetActor(db);
  const check = async version => Object.values((await db.query('SELECT marketplace_sec.phase9_edition_job_exhausted(jsonb_populate_record('
    + "NULL::public.image_extraction_jobs, to_jsonb(i) || jsonb_build_object('operation_version', $2::text)))"
    + ' FROM public.image_extraction_jobs i WHERE id=$1', [f.jobId, version])).rows[0])[0];
  assert.equal(await check('p9-owner-edition-options-v1'), true);
  assert.equal(await check('p9-metadata-lookup-v1'), false);
});
