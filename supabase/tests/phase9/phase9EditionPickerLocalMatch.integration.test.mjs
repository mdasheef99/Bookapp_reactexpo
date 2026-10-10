// Picker SDD §4.1, DOC-3 §5.1 and DOC-4 §8: local safety and confirmation regressions.
import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import {
  claimJob, createEditionPickerDatabase, metadata, readSql, resetActor, scalar,
  seedAutomaticLineage, seedCanonical, seedCard, selectSql, setActor,
} from './editionPickerFixture.mjs';
let db;
before(async () => { db = await createEditionPickerDatabase(); });
beforeEach(async () => { await db.exec('BEGIN'); });
afterEach(async () => { await db.exec('ROLLBACK'); await resetActor(db); });
after(async () => { await db?.close(); });

async function localCard(isbn = metadata.isbn13) {
  const card = await seedCard(db, { isbn });
  const lineage = await seedAutomaticLineage(db, card);
  const edition = await seedCanonical(db, card);
  const sql = await claimJob(db, card, lineage.jobId);
  return { card, lineage, edition, sql };
}
async function completeLocal(f, context, evidence) {
  return (await db.query(
    'SELECT public.phase9_complete_structural_local_metadata_match('
      + '$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb) AS result',
    [f.lineage.jobId, 'picker-worker-0001', 'a'.repeat(64), 1, f.card.candidateId,
      context.candidateVersion, context.queryIdentity, 'bibliographic',
      context.lookupContractVersion, context.normalizerVersion, context.routingPolicyVersion,
      'store_private', 'p9-metadata-v1', context.localCanonicalEditionId,
      'p9-metadata-snapshot-v1', context.selectionPolicyVersion, JSON.stringify(evidence)],
  )).rows[0].result;
}
const malformed = [
  ['empty author', 'authors', ['Fixture Author', '']],
  ['null author', 'authors', ['Fixture Author', null]],
  ['overlong author', 'authors', ['Fixture Author', 'x'.repeat(257)]],
  ['too many authors', 'authors', ['Fixture Author', ...Array.from({ length: 20 }, (_, i) => 'Author ' + i)]],
  ['overlong publisher', 'publisher', 'x'.repeat(257)],
  ['unsafe cover', 'cover_url', 'https://unapproved.example/cover'],
  ['out-of-bounds page count', 'page_count', 100001],
  ['empty category', 'categories', ['']],
];
for (const [label, column, value] of malformed) {
  test('malformed canonical ' + label + ' cannot complete the automatic local path', async () => {
    const f = await localCard();
    await resetActor(db);
    await db.query('UPDATE public.canonical_editions SET ' + column + '=$1 WHERE id=$2', [value, f.edition]);
    await setActor(db, f.card.ownerId, 'service_role');
    const context = await scalar(db, f.sql);
    // Exercise the same local-admission branch as the production gateway, using the real completion RPC.
    if (context.localCanonicalEditionId !== null) await completeLocal(f, context, ['validated_isbn']);
    assert.equal(context.localCanonicalEditionId, null);
    assert.equal(await scalar(db, "SELECT state FROM public.image_extraction_candidates WHERE id='" + f.card.candidateId + "'"), 'processing');
    assert.equal(await scalar(db, "SELECT count(*) FROM public.phase9_selected_metadata_snapshots WHERE candidate_id='" + f.card.candidateId + "'"), 0);
  });
}
test('safe coherent ISBN metadata still completes with validated ISBN evidence', async () => {
  const f = await localCard(), context = await scalar(db, f.sql);
  assert.equal(context.localCanonicalEditionId, f.edition);
  const result = await completeLocal(f, context, ['validated_isbn']);
  assert.equal(result.manual_outcome, 'local_canonical_match');
  assert.equal(result.creates_provider_charge, false);
  assert.deepEqual(await scalar(db, "SELECT match_evidence FROM public.phase9_selected_metadata_snapshots WHERE candidate_id='" + f.card.candidateId + "'"), ['validated_isbn']);
  await setActor(db, f.card.ownerId);
  assert.equal((await scalar(db, readSql(f.card))).selection.snapshot.title, metadata.title);
});
test('a unique exact text match is surfaced and confirmed without strong ISBN evidence', async () => {
  const f = await localCard(null);
  const selling = await scalar(db, "SELECT owner_review_snapshot->'value' FROM public.image_extraction_candidates WHERE id='" + f.card.candidateId + "'");
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_candidates SET owner_review_snapshot=jsonb_set(owner_review_snapshot,"
    + "'{value,originalFieldConfirmation}', $1::jsonb),review_ready=false WHERE id=$2",
  [JSON.stringify({ title: false, authors: [false] }), f.card.candidateId]);
  await setActor(db, f.card.ownerId, 'service_role');
  const context = await scalar(db, f.sql);
  assert.equal(context.localCanonicalEditionId, f.edition);
  await completeLocal(f, context, ['exact_original_title_author_language']);
  assert.deepEqual(await scalar(db, "SELECT match_evidence FROM public.phase9_selected_metadata_snapshots WHERE candidate_id='" + f.card.candidateId + "'"), ['exact_original_title_author_language']);
  assert.equal(await scalar(db, "SELECT review_ready FROM public.image_extraction_candidates WHERE id='" + f.card.candidateId + "'"), false);
  await resetActor(db);
  assert.equal(await scalar(db, "SELECT count(*) FROM public.phase9_candidate_edition_state WHERE candidate_id='" + f.card.candidateId + "'"), 0);
  await setActor(db, f.card.ownerId);
  const choices = await scalar(db, readSql(f.card));
  assert.equal(choices.selection.source, 'current_suggestion');
  assert.equal(choices.selection.snapshot.title, metadata.title);
  const selected = await scalar(db, selectSql(f.card, choices, choices.selection.selectionId, { source: 'current_suggestion' }));
  assert.notEqual(selected.selection.selectionId, choices.selection.selectionId);
  assert.equal(selected.selection.source, 'current_suggestion');
  await resetActor(db);
  const review = await scalar(db, "SELECT owner_review_snapshot->'value' FROM public.image_extraction_candidates WHERE id='" + f.card.candidateId + "'");
  assert.deepEqual(review.originalFieldConfirmation, { title: true, authors: [true] });
  for (const field of ['quantity', 'priceMinor', 'baseCondition', 'shelfLocation']) assert.deepEqual(review[field], selling[field]);
});
test('multiple coherent exact text editions are not resolved by record order', async () => {
  const f = await localCard(null);
  await seedCanonical(db, f.card, { isbn13: null });
  await setActor(db, f.card.ownerId, 'service_role');
  assert.equal((await scalar(db, f.sql)).localCanonicalEditionId, null);
  assert.equal(await scalar(db, "SELECT count(*) FROM public.phase9_selected_metadata_snapshots WHERE candidate_id='" + f.card.candidateId + "'"), 0);
});
for (const [label, assignment] of [
  ['title', "observed_title='Different book'"],
  ['authors', "observed_authors=ARRAY[]::text[]"],
  ['language', "observed_language='fr'"],
]) {
  test('text matching without compatible ' + label + ' cannot create a local suggestion', async () => {
    const f = await localCard(null);
    await resetActor(db);
    await db.query('UPDATE public.image_extraction_candidates SET ' + assignment + ' WHERE id=$1', [f.card.candidateId]);
    await setActor(db, f.card.ownerId, 'service_role');
    assert.equal((await scalar(db, f.sql)).localCanonicalEditionId, null);
  });
}
