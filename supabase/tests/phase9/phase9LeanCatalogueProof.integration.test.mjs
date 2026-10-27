// 02b §§4.4/6.1–6.2/11 OQ3: exact-reference proof and required identity locks.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { createLeanDatabase, installSyntheticProvider, requireLean, resetSyntheticProvider,
  sourcePolicy } from './leanCatalogueFixture.mjs';
import { add, automaticCard, bytes, canonicalCard, catalogueBytes, enableOL, facts, linked,
  readSql, resetActor, scalar, seedIncumbent, selectSql, selectionBytes, setActor, unmatched } from './catalogueLinkFixture.mjs';

let db;
before(async () => { db = await createLeanDatabase(); });
beforeEach(async () => {
  await resetActor(db);
  await db.exec('TRUNCATE public.stores,public.canonical_works,public.canonical_editions CASCADE');
  await resetSyntheticProvider(db);
  await enableOL(db);
});
after(async () => { await db?.close(); });
const nullPair = { canonical_work_id: null, canonical_edition_id: null };
const coherent = changes => facts({ ...changes, correlationId: randomUUID(), attemptId: randomUUID() });
async function sharedBytes() {
  return [...await catalogueBytes(db), ...await Promise.all(['canonical_provider_ids',
    'book_metadata_sources', 'canonical_work_stats', 'canonical_edition_stats'].map(table => bytes(db, table)))];
}
async function resolve(metadata) {
  const policy = await sourcePolicy(db, metadata);
  return (await db.query('SELECT * FROM marketplace_sec.phase9_catalogue_resolve_v1($1::jsonb,NULL,$2::jsonb)',
    [metadata, policy])).rows;
}
async function changeWorkTitle(target) {
  await resetActor(db);
  await db.query("UPDATE public.canonical_works SET title_normalized='original work',primary_title='Original Work' WHERE id=$1",
    [target.workId]);
}
async function sourceProof(target, metadata, { otherProvider = false, wrongRecord = false } = {}) {
  await resetActor(db);
  const synthetic = otherProvider ? await installSyntheticProvider(db) : null;
  const adapter = synthetic?.adapterKey ?? metadata.adapterKey;
  const record = otherProvider ? 'other-edition' : wrongRecord ? 'OL101M' : metadata.providerRecordId;
  const work = otherProvider ? 'other-work' : 'OL700W';
  const publicKeys = ['adapterVersion', 'schemaVersion', 'normalizerVersion', 'fetchedAt', 'title',
    'subtitle', 'authors', 'publisher', 'publishedDate', 'language', 'script', 'isbn10', 'isbn13',
    'pageCount', 'categories', 'description', 'editionStatement', 'volume', 'format', 'series'];
  const payload = Object.fromEntries(publicKeys.map(key => [key, metadata[key]]));
  Object.assign(payload, { version: 'psr-catalogue-facts-v1', adapterKey: adapter, providerRecordId: record,
    workExternalId: work, oclc: null, lccn: null, coverRef: otherProvider ? '1' : '123',
    coverReference: otherProvider ? synthetic.facts.coverReference : metadata.coverReference,
    sourceRetentionNote: otherProvider ? synthetic.note : 'Same provider normalized facts.' });
  await db.query(`INSERT INTO public.canonical_provider_ids(adapter_key,id_kind,external_id,canonical_edition_id)
    VALUES($1,'edition',$2,$3)`, [adapter, record, target.editionId]);
  await db.query(`INSERT INTO public.canonical_provider_ids(adapter_key,id_kind,external_id,canonical_work_id)
    VALUES($1,'work',$2,$3)`, [adapter, work, target.workId]);
  await db.query(`INSERT INTO public.book_metadata_sources(id,provider,adapter_key,provider_book_id,
    canonical_edition_id,normalized_payload) VALUES($1,$2,$2,$3,$4,$5::jsonb)`,
  [randomUUID(), adapter, record, target.editionId, payload]);
}

for (const proof of ['same provider', 'other provider', 'wrong provider record']) test(
  'AC7-2c/OQ3: core work grouping uses only ' + proof + ' proof for the current reference', async () => {
    await requireLean(db);
    const m = coherent(), target = await seedIncumbent(db, m);
    await changeWorkTitle(target);
    await sourceProof(target, m, { otherProvider: proof === 'other provider', wrongRecord: proof === 'wrong provider record' });
    const before = await sharedBytes(), rows = await resolve(m);
    assert.deepEqual(rows, [proof === 'same provider'
      ? { canonical_work_id: target.workId, canonical_edition_id: target.editionId } : nullPair]);
    assert.deepEqual(await sharedBytes(), before, 'proof reuse/denial never rewrites or creates shared facts');
  });

for (const currentSuggestion of [false, true]) for (const proof of [
  'same provider', 'competing translation', 'other provider', 'wrong provider record',
]) test('AC7-17/OQ3: saved-ID ' + (currentSuggestion ? 'current suggestion' : 'selected') + ' Add ' + proof, async () => {
  await requireLean(db);
  const m = facts(), target = await seedIncumbent(db, m);
  const f = await automaticCard(db, m, { target: target.editionId, currentSuggestion });
  await changeWorkTitle(target);
  await sourceProof(target, f.facts, { otherProvider: proof === 'other provider', wrongRecord: proof === 'wrong provider record' });
  if (proof === 'competing translation') await seedIncumbent(db, facts({ isbn10: null, isbn13: null }));
  const before = await sharedBytes(), chosen = await selectionBytes(db, f);
  const { item } = await add(db, f);
  if (proof === 'same provider') {
    linked(item);
    assert.deepEqual([item.canonical_work_id, item.canonical_edition_id], [target.workId, target.editionId]);
    assert.deepEqual((await sharedBytes()).slice(0, 4), before.slice(0, 4), 'saved-ID link does not refresh facts or provenance');
  } else {
    unmatched(item);
    assert.deepEqual(await sharedBytes(), before, 'refused grouping has zero shared/catalogue/stat effects');
  }
  assert.equal(await selectionBytes(db, f), chosen, 'saved metadata/selection bytes survive Add');
});

test('AC7-4/17/OQ3: translated current suggestion counts chosen immediately at Select using scoped provider proof', async () => {
  await requireLean(db);
  const m = facts(), target = await seedIncumbent(db, m);
  await changeWorkTitle(target);
  const f = await automaticCard(db, m, { target: target.editionId });
  await sourceProof(target, f.facts);
  const before = await sharedBytes();
  const projected = await scalar(db, `SELECT marketplace_sec.phase9_edition_current_snapshot(c)
    FROM public.image_extraction_candidates c WHERE id='${f.candidateId}'`);
  assert.equal(Object.hasOwn(projected, 'adapterKey'), false, 'canonical display projection has no provider proof IDs');
  assert.equal(Object.hasOwn(projected, 'providerRecordId'), false);
  assert.equal(await scalar(db, 'SELECT coalesce(sum(times_chosen),0)::int FROM public.canonical_edition_stats'), 0);
  await setActor(db, f.ownerId);
  const command = selectSql(f, await scalar(db, readSql(f)), f.selectionId, { source: 'current_suggestion' });
  const selected = await scalar(db, command);
  await resetActor(db);
  assert.equal(await scalar(db, 'SELECT coalesce(sum(times_chosen),0)::int FROM public.canonical_edition_stats'), 1,
    'translated current-suggestion Select must count chosen immediately');
  const effect = (await db.query(`SELECT counted,canonical_edition_id,completed_at
    FROM marketplace_sec.phase9_catalogue_choice_effects WHERE selection_id=$1`, [selected.selection.selectionId])).rows[0];
  assert.deepEqual([effect.counted, effect.canonical_edition_id], [true, target.editionId]);
  assert.ok(effect.completed_at);
  assert.deepEqual(await scalar(db, `SELECT selected_option_snapshot FROM public.phase9_candidate_edition_state
    WHERE candidate_id='${f.candidateId}'`), projected, 'persist the coherent projection without adding provider facts');
  assert.deepEqual((await sharedBytes()).slice(0, 4), before.slice(0, 4), 'Select never rewrites canonical facts, IDs or sources');
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.store_inventory'), 0);
  await setActor(db, f.ownerId);
  assert.equal((await scalar(db, command)).selection.selectionId, selected.selection.selectionId);
  await resetActor(db);
  assert.equal(await scalar(db, 'SELECT coalesce(sum(times_chosen),0)::int FROM public.canonical_edition_stats'), 1);
});

// Disposable fault injection: return NULL only for a required work identity key;
// retain the real function for every other kind and restore it in finally.
async function withNullWorkKey(action) {
  await resetActor(db);
  const signature = 'marketplace_sec.phase9_catalogue_identity_lock_key_v1(text,jsonb)';
  const definition = await scalar(db, `SELECT pg_get_functiondef('${signature}'::regprocedure)`);
  await db.exec(definition.replace('FUNCTION marketplace_sec.phase9_catalogue_identity_lock_key_v1(',
    'FUNCTION marketplace_sec.phase9_test_real_identity_lock_key_v1('));
  await db.exec(`REVOKE ALL ON FUNCTION marketplace_sec.phase9_test_real_identity_lock_key_v1(text,jsonb)
    FROM PUBLIC,anon,authenticated,service_role;
    CREATE OR REPLACE FUNCTION marketplace_sec.phase9_catalogue_identity_lock_key_v1(p_kind text,p_key jsonb)
    RETURNS bigint LANGUAGE sql IMMUTABLE SET search_path='' AS $$
    SELECT CASE WHEN p_kind='work' THEN NULL::bigint ELSE
      marketplace_sec.phase9_test_real_identity_lock_key_v1(p_kind,p_key) END $$;
    REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_identity_lock_key_v1(text,jsonb)
      FROM PUBLIC,anon,authenticated,service_role;`);
  try { await action(); }
  finally {
    await resetActor(db);
    await db.exec(definition);
    await db.exec('DROP FUNCTION marketplace_sec.phase9_test_real_identity_lock_key_v1(text,jsonb)');
  }
}
test('AC7-20/22: resolver safely rolls back when a required identity key is NULL', async () => {
  await requireLean(db);
  const m = coherent(), before = await sharedBytes();
  await withNullWorkKey(async () => {
    assert.deepEqual(await resolve(m), [nullPair], 'a missing required lock is a catalogue skip');
    assert.deepEqual(await sharedBytes(), before, 'no provisional work, edition, ID, source or stat survives');
  });
});
test('AC7-20/22: saved-ID Add safely skips when a required identity key is NULL', async () => {
  await requireLean(db);
  const m = facts(), target = await seedIncumbent(db, m), f = await canonicalCard(db, m, target);
  const before = await sharedBytes(), chosen = await selectionBytes(db, f);
  await withNullWorkKey(async () => {
    unmatched((await add(db, f)).item);
    assert.deepEqual(await sharedBytes(), before, 'NULL key cannot admit shared/counter effects');
    assert.equal(await selectionBytes(db, f), chosen);
  });
});
test('AC7-20/22: read-only choice target safely skips when a required identity key is NULL', async () => {
  await requireLean(db);
  const m = coherent(), target = await seedIncumbent(db, m), before = await sharedBytes();
  await withNullWorkKey(async () => {
    const rows = (await db.query('SELECT * FROM marketplace_sec.phase9_catalogue_choice_target_v1($1::jsonb,$2::uuid,$3,$4)',
      [m, target.editionId, m.adapterKey, m.providerRecordId])).rows;
    assert.deepEqual(rows, [nullPair], 'read-only target resolution requires every planned lock');
    assert.deepEqual(await sharedBytes(), before);
  });
});
