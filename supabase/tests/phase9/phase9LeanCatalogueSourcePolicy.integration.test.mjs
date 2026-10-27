// 02b §5/§12/§14 decision 9: strict trusted policy, builder and no-write denial.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { createLeanDatabase, installSyntheticProvider, requireLean, resetSyntheticProvider, sourcePolicy } from './leanCatalogueFixture.mjs';
import { bytes, enableOL, facts, resetActor, scalar } from './catalogueLinkFixture.mjs';

let db, registryDefaults;
const builder = 'marketplace_sec.phase9_catalogue_source_policy_v1(text)';
const keys = ['version', 'adapterKey', 'adapterVersion', 'policyVersion', 'rawRetentionSeconds',
  'revalidationSeconds', 'sharedSourceNote', 'sharedAdmitted'];
const metadata = () => facts({ correlationId: randomUUID(), attemptId: randomUUID() });
before(async () => {
  db = await createLeanDatabase();
  registryDefaults = (await db.query(`SELECT adapter_version,policy_version,raw_retention_seconds,
    revalidation_seconds,to_jsonb(r)->>'shared_source_note' AS shared_source_note
    FROM public.phase9_provider_registry r WHERE adapter_key='open_library'`)).rows[0];
});
beforeEach(async () => {
  await resetActor(db);
  await db.exec('TRUNCATE public.stores,public.canonical_works,public.canonical_editions CASCADE');
  await resetSyntheticProvider(db);
  await enableOL(db);
  await db.query(`UPDATE public.phase9_provider_registry SET adapter_version=$1,policy_version=$2,
    raw_retention_seconds=$3,revalidation_seconds=$4 WHERE adapter_key='open_library'`,
  [registryDefaults.adapter_version, registryDefaults.policy_version,
    registryDefaults.raw_retention_seconds, registryDefaults.revalidation_seconds]);
  if (registryDefaults.shared_source_note !== null) await db.query(
    "UPDATE public.phase9_provider_registry SET shared_source_note=$1 WHERE adapter_key='open_library'",
    [registryDefaults.shared_source_note]);
});
after(async () => { await db?.close(); });

test('AC7-21b: synthetic fixture reset restores dispatch and reinstalls independent registry facts', async () => {
  const signature = 'marketplace_sec.phase9_catalogue_provider_ids_valid_v1(text,text,text,text,text,jsonb)';
  await requireLean(db, signature);
  const hash = () => scalar(db, `SELECT md5(prosrc) FROM pg_proc WHERE oid='${signature}'::regprocedure`);
  const original = await hash();
  await installSyntheticProvider(db);
  assert.notEqual(await hash(), original);
  await db.exec("UPDATE public.phase9_provider_registry SET shared_source_note='Changed fixture note.',policy_version=9 WHERE adapter_key='synthetic_catalogue'");
  await resetSyntheticProvider(db);
  assert.equal(await hash(), original, 'original validator body is restored');
  assert.equal(await scalar(db, "SELECT count(*)::int FROM public.phase9_provider_registry WHERE adapter_key='synthetic_catalogue'"), 0);
  assert.equal(await scalar(db, "SELECT to_regprocedure('marketplace_sec.phase9_test_original_provider_ids_valid_v1(text,text,text,text,text,jsonb)') IS NULL"), true);
  const synthetic = await installSyntheticProvider(db);
  const policy = await sourcePolicy(db, synthetic.facts);
  assert.equal(policy.policyVersion, 1); assert.equal(policy.sharedSourceNote, synthetic.note);
});

async function sharedState() {
  const state = [];
  for (const table of ['canonical_works', 'canonical_editions', 'canonical_provider_ids',
    'book_metadata_sources', 'canonical_work_stats', 'canonical_edition_stats']) state.push(await bytes(db, table));
  return state;
}
async function resolve(m, policy, sqlNull = false) {
  return (await db.query('SELECT * FROM marketplace_sec.phase9_catalogue_resolve_v1($1::jsonb,NULL,$2::jsonb)',
    [m, sqlNull ? null : JSON.stringify(policy)])).rows;
}
async function builtPolicy(key) {
  return (await db.query('SELECT marketplace_sec.phase9_catalogue_source_policy_v1($1) AS policy', [key])).rows[0].policy;
}
async function refuses(change) {
  await requireLean(db);
  const m = metadata(), policy = await sourcePolicy(db, m), before = await sharedState();
  await assert.rejects(() => resolve(m, change(policy)), 'malformed or mismatched source policy must RAISE');
  assert.deepEqual(await sharedState(), before, 'refused policy must leave all shared rows unchanged');
}

for (const value of [null, [], false, 17, 'forged']) test(
  'AC7-20/21: resolver raises for non-object policy ' + JSON.stringify(value), async () => {
    await refuses(() => value);
  });
test('AC7-20/21: resolver raises for SQL NULL policy', async () => {
  await requireLean(db);
  const before = await sharedState();
  await assert.rejects(() => resolve(metadata(), null, true), 'SQL NULL policy must RAISE');
  assert.deepEqual(await sharedState(), before);
});
for (const key of keys) test('AC7-20/21: resolver raises for missing policy key ' + key, async () => {
  await refuses(policy => { delete policy[key]; return policy; });
});
test('AC7-20/21: resolver raises for an extra policy key', async () => {
  await refuses(policy => ({ ...policy, workerAdmission: true }));
});

for (const [label, key, value] of [
  ['wrong version', 'version', 'psr-catalogue-source-policy-v2'],
  ['numeric version', 'version', 1],
  ['null adapter key', 'adapterKey', null],
  ['numeric adapter key', 'adapterKey', 1],
  ['numeric adapter version', 'adapterVersion', 1],
  ['null adapter version', 'adapterVersion', null],
  ['string policy integer', 'policyVersion', '1'],
  ['null policy integer', 'policyVersion', null],
  ['boolean policy integer', 'policyVersion', true],
  ['zero policy integer', 'policyVersion', 0],
  ['negative policy integer', 'policyVersion', -1],
  ['fractional policy integer', 'policyVersion', 1.5],
  ['string raw retention', 'rawRetentionSeconds', '0'],
  ['null raw retention', 'rawRetentionSeconds', null],
  ['negative raw retention', 'rawRetentionSeconds', -1],
  ['fractional raw retention', 'rawRetentionSeconds', 0.5],
  ['string revalidation', 'revalidationSeconds', '3600'],
  ['zero revalidation', 'revalidationSeconds', 0],
  ['negative revalidation', 'revalidationSeconds', -1],
  ['fractional revalidation', 'revalidationSeconds', 0.5],
  ['numeric source note', 'sharedSourceNote', 1],
  ['empty source note', 'sharedSourceNote', ''],
  ['oversize source note', 'sharedSourceNote', 'x'.repeat(1025)],
  ['string admission', 'sharedAdmitted', 'true'],
  ['null admission', 'sharedAdmitted', null],
  ['numeric admission', 'sharedAdmitted', 1],
]) test('AC7-20/21: resolver raises for ' + label, async () => {
  await refuses(policy => ({ ...policy, [key]: value }));
});
for (const [key, value] of [['adapterKey', 'synthetic_catalogue'], ['adapterVersion', 'different-version']]) test(
  'AC7-20/21: resolver raises when policy ' + key + ' differs from metadata', async () => {
    await refuses(policy => ({ ...policy, [key]: value }));
  });
test('AC7-20/21: true admission with a null source note raises', async () => {
  await refuses(policy => ({ ...policy, sharedSourceNote: null }));
});
test('AC7-20/21: false admission cannot mask malformed policy', async () => {
  await refuses(policy => ({ ...policy, sharedAdmitted: false, policyVersion: '1' }));
});
test('AC7-20/21: false admission cannot mask an adapter mismatch', async () => {
  await refuses(policy => ({ ...policy, sharedAdmitted: false, adapterVersion: 'different-version' }));
});

for (const nullable of [false, true]) test('AC7-20: valid denied policy returns one NULL pair and no writes' +
  (nullable ? ' with null note/revalidation' : ''), async () => {
  await requireLean(db);
  const m = metadata(), policy = { ...await sourcePolicy(db, m), sharedAdmitted: false };
  if (nullable) { policy.sharedSourceNote = null; policy.revalidationSeconds = null; }
  const before = await sharedState();
  assert.deepEqual(await resolve(m, policy), [{ canonical_work_id: null, canonical_edition_id: null }]);
  assert.deepEqual(await sharedState(), before, 'denial writes no canonical, provider-ID, source or stats rows');
});

test('AC7-21: source-policy builder returns NULL for an unknown registry key', async () => {
  await requireLean(db, builder);
  const before = await sharedState();
  assert.equal(await builtPolicy('not_registered'), null);
  assert.deepEqual(await sharedState(), before);
});
test('AC7-21: source-policy builder returns exactly the current locked Open Library row values', async () => {
  await requireLean(db, builder);
  await db.query(`UPDATE public.phase9_provider_registry SET policy_version=7,raw_retention_seconds=0,
    revalidation_seconds=7200,shared_source_note=$1 WHERE adapter_key='open_library'`, ['Fixture registry attribution.']);
  const expected = await sourcePolicy(db, metadata());
  assert.deepEqual(Object.keys(expected).sort(), [...keys].sort());
  const actual = await builtPolicy('open_library');
  assert.deepEqual(actual, expected);
  assert.equal(actual.policyVersion, 7); assert.equal(actual.rawRetentionSeconds, 0);
  assert.equal(actual.revalidationSeconds, 7200); assert.equal(actual.sharedSourceNote, 'Fixture registry attribution.');
  assert.equal(actual.sharedAdmitted, true);
});
test('AC7-21: source-policy builder evaluates denied admission and preserves nullable row values', async () => {
  await requireLean(db, builder);
  await db.exec(`UPDATE public.phase9_provider_registry SET shared_source_note=NULL,revalidation_seconds=NULL
    WHERE adapter_key='open_library'`);
  const actual = await builtPolicy('open_library');
  assert.deepEqual(Object.keys(actual).sort(), [...keys].sort());
  assert.equal(actual.sharedAdmitted, false); assert.equal(actual.sharedSourceNote, null);
  assert.equal(actual.revalidationSeconds, null);
});
test('AC7-21b: direct synthetic policy is exact and leaves production admission denied', async () => {
  await requireLean(db, builder);
  const synthetic = await installSyntheticProvider(db), m = metadata();
  const direct = await sourcePolicy(db, { ...m, adapterKey: synthetic.adapterKey });
  assert.deepEqual(direct, { version: 'psr-catalogue-source-policy-v1', adapterKey: synthetic.adapterKey,
    adapterVersion: '1.0.0', policyVersion: 1, rawRetentionSeconds: 17, revalidationSeconds: 3600,
    sharedSourceNote: synthetic.note, sharedAdmitted: true });
  assert.deepEqual(await builtPolicy(synthetic.adapterKey), { ...direct, sharedAdmitted: false });
  assert.equal(await scalar(db, "SELECT marketplace_sec.phase9_catalogue_shared_admitted_v1('synthetic_catalogue')"), false);
});
test('AC7-19/21b: generic source writes use the direct policy version, deadlines and note', async () => {
  await requireLean(db);
  const synthetic = await installSyntheticProvider(db), m = { ...synthetic.facts,
    correlationId: randomUUID(), attemptId: randomUUID() };
  await db.query(`UPDATE public.phase9_provider_registry SET policy_version=9,raw_retention_seconds=23,
    revalidation_seconds=5400,shared_source_note=$1 WHERE adapter_key=$2`, ['Synthetic changed attribution.', synthetic.adapterKey]);
  const policy = await sourcePolicy(db, m), result = await resolve(m, policy);
  assert.equal(result.length, 1); assert.ok(result[0].canonical_edition_id); assert.ok(result[0].canonical_work_id);
  const source = (await db.query(`SELECT reuse_policy_version,raw_delete_after,expires_at,
    normalized_payload->>'sourceRetentionNote' AS note,raw_payload FROM public.book_metadata_sources
    WHERE canonical_edition_id=$1`, [result[0].canonical_edition_id])).rows[0];
  assert.equal(source.reuse_policy_version, 9); assert.equal(source.note, policy.sharedSourceNote);
  assert.equal(new Date(source.raw_delete_after).getTime(), Date.parse(m.fetchedAt) + 23000);
  assert.equal(new Date(source.expires_at).getTime(), Date.parse(m.fetchedAt) + 5400000);
  assert.deepEqual(source.raw_payload, {});
  assert.equal((await db.query('SELECT source_retention_note FROM public.canonical_editions WHERE id=$1',
    [result[0].canonical_edition_id])).rows[0].source_retention_note, policy.sharedSourceNote);
});
