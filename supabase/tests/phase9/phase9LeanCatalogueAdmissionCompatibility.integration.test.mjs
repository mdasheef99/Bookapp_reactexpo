// 02b §§5/9/10/11/12 AC7-2b/17/21: real command admission and old-worker compatibility.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { createLeanDatabase, installSyntheticProvider, requireLean, resetSyntheticProvider } from './leanCatalogueFixture.mjs';
import { add, bytes, catalogueBytes, enableOL, facts, linked, olOperation, readSql, reviewValue,
  rpc, saveReview, scalar, selectionBytes, selectSql, setActor, resetActor, unmatched } from './catalogueLinkFixture.mjs';
import { claimJob, row, seedAutomaticLineage, seedCard } from './editionPickerFixture.mjs';
import { complete, token, worker } from './editionOptionsCompletionFixture.mjs';

let db;
before(async () => { db = await createLeanDatabase(); });
beforeEach(async () => {
  await resetActor(db);
  await db.exec('TRUNCATE public.stores,public.canonical_works,public.canonical_editions CASCADE');
  await resetSyntheticProvider(db);
  await enableOL(db);
});
after(async () => { await db?.close(); });

async function sharedState() {
  return [await catalogueBytes(db), ...await Promise.all(['canonical_provider_ids', 'book_metadata_sources',
    'canonical_work_stats', 'canonical_edition_stats'].map(table => bytes(db, table)))];
}
async function assertNoLaterSliceObjects() {
  await resetActor(db);
  for (const table of ['marketplace_sec.phase9_catalogue_companions', 'marketplace_sec.phase9_catalogue_lookup_effects']) {
    assert.equal((await db.query('SELECT to_regclass($1) AS object', [table])).rows[0].object, null, table);
  }
  const functions = ['phase9_catalogue_valid_companion_v1', 'phase9_catalogue_valid_cache_v1',
    'phase9_catalogue_cache_receipt_guard', 'phase9_catalogue_query_scope_v1', 'phase9_catalogue_store_cache_v1',
    'phase9_catalogue_reuse_cache_core_v1', 'phase9_complete_candidate_edition_options_v2',
    'phase9_reuse_candidate_edition_cache_v1'];
  assert.deepEqual((await db.query(`SELECT n.nspname,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN('public','marketplace_sec') AND p.proname=ANY($1::text[])`, [functions])).rows, []);
  assert.deepEqual((await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public'
    AND table_name='phase9_metadata_cache_entries'
    AND column_name IN('payload_kind','bibliographic_payload','payload_digest','routing_policy_version')`)).rows, []);
}

// Create the synthetic selected/saved source entirely through the existing
// automatic lookup, attempt, receipt, finalize and immutable-snapshot commands.
// This fixture never edits a saved payload, adds an allow-list entry or disables a guard.
async function syntheticSelectedCard(synthetic) {
  // M73's existing review/display validator admits a missing cover; a synthetic
  // cover host would fail review before the production catalogue admission check.
  const m = { ...facts(), ...synthetic.facts, isbn10: facts().isbn10, isbn13: facts().isbn13,
    coverReference: null };
  assert.equal((await db.query('SELECT marketplace_sec.phase9_edition_valid_metadata($1::jsonb) AS valid', [m])).rows[0].valid,
    true, 'synthetic facts must pass existing review validation before testing Add admission');
  const f = await seedCard(db, { isbn: m.isbn13, language: m.language, review: {
    originalTitle: m.title, authors: m.authors, originalLanguage: m.language,
    script: m.script, originalFieldConfirmation: { title: true, authors: m.authors.map(() => true) } } });
  await resetActor(db);
  await db.query('UPDATE public.image_extraction_candidates SET observed_title=$1,observed_authors=$2 WHERE id=$3',
    [m.title, m.authors, f.candidateId]);
  const { jobId } = await seedAutomaticLineage(db, f), context = await scalar(db, await claimJob(db, f, jobId));
  const lookup = await rpc(db, 'phase9_register_structural_metadata_lookup', [jobId, worker, token, 1,
    f.candidateId, context.candidateVersion, context.queryIdentity, 'synthetic:' + jobId,
    synthetic.adapterKey, '1.0.0', 'synthetic-capability-v1', 'p9-metadata-foundation-v1', 'bibliographic',
    'p9-metadata-lookup-v1', 'p9-bibliographic-normalizer-v1', 'p9-metadata-routing-v1',
    'store_private', '1', 'p9-metadata-cache-v1', 'metadata-v1', null]);
  const usage = await rpc(db, 'phase9_reserve_metadata_usage',
    [jobId, worker, token, 1, lookup.lookup_id, synthetic.adapterKey, '1.0.0', 1]);
  const attempt = await rpc(db, 'phase9_register_structural_metadata_attempt', [lookup.lookup_id, jobId, worker, token, 1,
    f.candidateId, context.candidateVersion, randomUUID(), 'synthetic:' + jobId, 'primary', 1,
    synthetic.adapterKey, '1.0.0', 'synthetic-capability-v1', 'p9-metadata-foundation-v1',
    'p9-bibliographic-normalizer-v1', 'p9-metadata-routing-v1', 'local_insufficient', usage.reservation_id]);
  const chosen = { ...m, correlationId: lookup.lookup_id, attemptId: attempt.attempt_id, fetchedAt: new Date().toISOString() };
  const call = await rpc(db, 'phase9_register_metadata_provider_call', [attempt.attempt_id, jobId, worker, token, 1, randomUUID()]);
  await rpc(db, 'phase9_finalize_metadata_provider_call', [call.provider_call_id, jobId, worker, token, 1,
    'finalized', 'coherent_match', 'coherent_match', 'synthetic-receipt', false, null, []]);
  await rpc(db, 'phase9_finalize_structural_metadata_attempt', [attempt.attempt_id, jobId, worker, token, 1,
    f.candidateId, context.candidateVersion, 'accepted', 'coherent_match', null, 'miss', 0,
    'fixture-pricing', { currency: 'USD' }, 0, chosen]);
  const selected = await rpc(db, 'phase9_select_structural_metadata_snapshot', [lookup.lookup_id, jobId, worker, token, 1,
    f.candidateId, context.candidateVersion, attempt.attempt_id, attempt.attempt_id, 'p9-selected-v1',
    'p9-metadata-selection-v1', chosen, ['validated_isbn'], 'accepted_metadata_match', null]);
  Object.assign(f, { lookupId: lookup.lookup_id, attemptId: attempt.attempt_id, selectionId: selected.snapshot_id, facts: chosen });
  await setActor(db, f.ownerId);
  await saveReview(db, f, { ...await reviewValue(db, f), metadataChoice: { mode: 'selected', selectionId: f.selectionId } });
  await saveReview(db, f);
  return f;
}

test('AC7-2b/21: public Add of a synthetic-provider saved selection succeeds privately with zero shared effects', async () => {
  await requireLean(db);
  const synthetic = await installSyntheticProvider(db), f = await syntheticSelectedCard(synthetic);
  await resetActor(db);
  const [lineage] = (await db.query(`SELECT x.coherent_edition,x.selected_attempt_id,x.canonical_edition_id,
    l.adapter_key AS lookup_adapter,a.adapter_key AS attempt_adapter,x.candidate_id,x.store_id,j.entity_id,j.store_id AS job_store
    FROM public.phase9_selected_metadata_snapshots x JOIN public.phase9_metadata_lookups l ON l.id=x.lookup_id
    JOIN public.metadata_enrichment_attempts a ON a.id=x.selected_attempt_id JOIN public.image_extraction_jobs j ON j.id=l.job_id
    WHERE x.id=$1`, [f.selectionId])).rows;
  assert.equal(lineage.coherent_edition.adapterKey, synthetic.adapterKey);
  assert.equal(lineage.lookup_adapter, synthetic.adapterKey); assert.equal(lineage.attempt_adapter, synthetic.adapterKey);
  assert.equal(lineage.selected_attempt_id, f.attemptId); assert.equal(lineage.canonical_edition_id, null);
  assert.equal(lineage.candidate_id, f.candidateId); assert.equal(lineage.entity_id, f.candidateId);
  assert.equal(lineage.store_id, f.storeId); assert.equal(lineage.job_store, f.storeId);
  assert.equal(await scalar(db, "SELECT marketplace_sec.phase9_catalogue_shared_admitted_v1('synthetic_catalogue')"), false);
  const workerMetadataValid = (await db.query('SELECT marketplace_sec.phase9_edition_valid_normalized_metadata($1::jsonb) AS valid',
    [lineage.coherent_edition])).rows[0].valid;
  const before = await sharedState(), saved = await selectionBytes(db, f), { receipt, item } = await add(db, f);
  assert.equal(receipt.outcome, 'committed_private'); unmatched(item);
  assert.equal(item.store_id, f.storeId); assert.equal(item.created_from_candidate_id, f.candidateId);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.store_inventory'), 1);
  assert.deepEqual(await sharedState(), before); assert.equal(await selectionBytes(db, f), saved);
  for (const table of ['canonical_provider_ids', 'book_metadata_sources', 'canonical_work_stats', 'canonical_edition_stats'])
    assert.equal(await bytes(db, table), '[]', table + ' remains empty after denied-provider Add');
  assert.equal(workerMetadataValid, false, 'M73 worker entry remains limited to its existing provider allow-list');
  assert.equal((await db.query(`SELECT valid FROM marketplace_sec.phase9_catalogue_provider_ids_valid_v1(
    $1,$2,NULL,NULL,$3,NULL)`, [synthetic.adapterKey, lineage.coherent_edition.providerRecordId,
    lineage.coherent_edition.coverReference])).rows[0].valid, true,
  'the unchanged generic Add path receives valid synthetic provider facts, while production admission stays denied');
});

for (const mode of ['ISBN', 'provider tuple']) test('AC7-17: 7a alone + old worker v1 completion without companion links Add via ' + mode, async () => {
  await requireLean(db);
  await assertNoLaterSliceObjects();
  const f = await olOperation(db, mode === 'provider tuple' ? { isbn10: null, isbn13: null } : {});
  for (const [sequence, stage] of [[0, 'search'], [1, 'editions']]) {
    const call = await rpc(db, 'phase9_register_edition_options_provider_call_v1',
      [f.attemptId, f.jobId, worker, token, 1, randomUUID(), sequence, stage]);
    await rpc(db, 'phase9_finalize_edition_options_provider_call_v1',
      [call.provider_call_id, f.jobId, worker, token, 1, 'finalized', 'no_acceptable_match', false, true]);
  }
  const option = row(0, { googleBooksUrl: 'https://openlibrary.org/books/' + f.facts.providerRecordId, metadata: f.facts });
  const result = { rows: [option], fetched: f.facts.fetchedAt,
    deadline: new Date(Date.parse(f.facts.fetchedAt) + 3600000).toISOString() };
  assert.equal((await complete(db, f, result)).status, 'completed'); // Existing sixteen-argument v1, no companion.
  await setActor(db, f.ownerId);
  f.selected = await scalar(db, selectSql(f, await scalar(db, readSql(f)), option.optionId));
  await saveReview(db, f);
  const saved = await selectionBytes(db, f), { item } = await add(db, f); linked(item);
  assert.equal(await selectionBytes(db, f), saved);
  const identifiers = (await db.query(`SELECT adapter_key,id_kind,external_id,canonical_edition_id
    FROM public.canonical_provider_ids`)).rows;
  assert.deepEqual(identifiers, [{ adapter_key: 'open_library', id_kind: 'edition', external_id: f.facts.providerRecordId,
    canonical_edition_id: item.canonical_edition_id }]);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.book_metadata_sources'), 1);
  assert.equal((await db.query('SELECT isbn_13 FROM public.canonical_editions WHERE id=$1',
    [item.canonical_edition_id])).rows[0].isbn_13, mode === 'ISBN' ? f.facts.isbn13 : null);
  await assertNoLaterSliceObjects();
});
