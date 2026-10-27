// 02b §§4.2/5/6/10/11/12/14 OQ1/OQ7: safe facts and unchanged incumbents.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { blockIsbn, createLeanDatabase, hideEdition, olCardWithRecord, requireLean } from './leanCatalogueFixture.mjs';
import { add, bytes, canonicalCard, catalogueBytes, enableOL, facts, linked, olCard,
  readSql, resetActor, reviewValue, saveReview, scalar, seedIncumbent, selectionBytes,
  setActor } from './catalogueLinkFixture.mjs';
let db, originalNote;
before(async () => {
  db = await createLeanDatabase();
  originalNote = (await db.query("SELECT to_jsonb(r)->>'shared_source_note' AS note FROM public.phase9_provider_registry r WHERE adapter_key='open_library'")).rows[0].note;
});
beforeEach(async () => {
  await resetActor(db);
  await db.exec('TRUNCATE public.stores,public.canonical_works,public.canonical_editions CASCADE');
  await enableOL(db);
  if (originalNote !== null) await db.query("UPDATE public.phase9_provider_registry SET shared_source_note=$1 WHERE adapter_key='open_library'", [originalNote]);
  if (await scalar(db, "SELECT to_regclass('marketplace_sec.phase9_catalogue_isbn_blocklist') IS NOT NULL"))
    await db.exec('TRUNCATE marketplace_sec.phase9_catalogue_isbn_blocklist');
});
after(async () => { await db?.close(); });
async function edition(id) { return (await db.query('SELECT * FROM public.canonical_editions WHERE id=$1', [id])).rows[0]; }
async function source(id) { return (await db.query('SELECT * FROM public.book_metadata_sources WHERE canonical_edition_id=$1', [id])).rows[0]; }
const cardWithRecord = overrides => olCardWithRecord(db, overrides);

for (const noIsbn of [false, true]) test('AC7-17/19: old v1 worker and NULL companion stamp ' + (noIsbn ? 'provider-ID' : 'ISBN') + ' facts', async () => {
  const f = await olCard(db, noIsbn ? { isbn10: null, isbn13: null } : {}), chosen = await selectionBytes(db, f);
  const { item } = await add(db, f); linked(item);
  await requireLean(db, 'public.canonical_provider_ids');
  const e = await edition(item.canonical_edition_id), s = await source(e.id);
  assert.equal(e.metadata_selection_version, noIsbn ? 'psr-catalogue-provider-id-v1' : 'psr-catalogue-isbn-v1');
  assert.equal(new Date(e.metadata_verified_at).toISOString(), new Date(f.facts.fetchedAt).toISOString());
  assert.equal(e.normalizer_version, f.facts.normalizerVersion); assert.equal(e.hidden, false);
  assert.equal(e.oclc, null); assert.equal(e.lccn, null);
  assert.equal((await db.query('SELECT normalizer_version FROM public.canonical_works WHERE id=$1', [e.work_id])).rows[0].normalizer_version,
    f.facts.normalizerVersion);
  assert.equal(s.normalized_payload.workExternalId, null); assert.equal(s.normalized_payload.oclc, null);
  assert.equal(s.normalized_payload.lccn, null);
  assert.equal(await scalar(db, "SELECT count(*)::int FROM public.canonical_provider_ids WHERE id_kind='work'"), 0);
  assert.equal(await selectionBytes(db, f), chosen, 'old immutable metadata/review bytes remain identical');
});

test('AC7-19: source stores a strict public projection, registry retention and no private evidence', async () => {
  await requireLean(db);
  const f = await olCard(db), privateMarker = 'private-owner-' + randomUUID();
  await setActor(db, f.ownerId);
  const review = await reviewValue(db, f);
  await saveReview(db, f, { ...review, notes: { publicNote: privateMarker, internalNote: privateMarker } });
  const { item, receipt } = await add(db, f); linked(item);
  const e = await edition(item.canonical_edition_id), s = await source(e.id);
  const [registry] = (await db.query("SELECT * FROM public.phase9_provider_registry WHERE adapter_key='open_library'")).rows;
  assert.equal(s.source_book_id, null);
  assert.deepEqual([s.provider, s.adapter_key, s.provider_book_id], ['open_library', 'open_library', f.facts.providerRecordId]);
  assert.deepEqual([s.adapter_version, s.schema_version, s.reuse_policy_version, s.request_status],
    [f.facts.adapterVersion, f.facts.schemaVersion, registry.policy_version, 'completed']);
  assert.deepEqual([s.confidence, s.match_strength, s.match_rationale], [null, null, null]);
  assert.deepEqual(s.raw_payload, {});
  const fetched = Date.parse(f.facts.fetchedAt);
  assert.equal(new Date(s.fetched_at).getTime(), fetched);
  assert.equal(new Date(s.raw_delete_after).getTime(), fetched + registry.raw_retention_seconds * 1000);
  assert.equal(new Date(s.expires_at).getTime(), fetched + registry.revalidation_seconds * 1000);
  assert.equal(e.source_retention_note, registry.shared_source_note);
  const p = s.normalized_payload;
  assert.deepEqual(Object.keys(p).sort(), ['version', 'adapterKey', 'adapterVersion', 'schemaVersion',
    'normalizerVersion', 'providerRecordId', 'workExternalId', 'fetchedAt', 'title', 'subtitle',
    'authors', 'publisher', 'publishedDate', 'language', 'script', 'isbn10', 'isbn13', 'pageCount',
    'categories', 'description', 'editionStatement', 'volume', 'format', 'series', 'oclc', 'lccn',
    'coverRef', 'coverReference', 'sourceRetentionNote'].sort());
  assert.equal(p.version, 'psr-catalogue-facts-v1'); assert.equal(p.coverRef, '123');
  assert.equal(p.coverReference, f.facts.coverReference); assert.equal(p.sourceRetentionNote, registry.shared_source_note);
  for (const key of ['adapterKey', 'adapterVersion', 'schemaVersion', 'normalizerVersion', 'providerRecordId',
    'title', 'subtitle', 'authors', 'publisher', 'publishedDate', 'language', 'script', 'isbn10', 'isbn13',
    'pageCount', 'categories', 'description', 'editionStatement', 'volume', 'format', 'series'])
    assert.deepEqual(p[key], f.facts[key], key + ' comes from this coherent provider edition');
  const shared = JSON.stringify([e, s]);
  for (const value of [privateMarker, f.ownerId, f.storeId, f.sessionId, f.candidateId, f.lookupId,
    f.attemptId, f.jobId, receipt.inventoryId]) assert.equal(shared.includes(value), false, value + ' stays private');
});

test('AC7-19/21c: next new source uses registry note/deadlines and first source is never refreshed', async () => {
  await requireLean(db);
  const firstCard = await olCard(db), first = (await add(db, firstCard)).item;
  const canonicalBefore = await catalogueBytes(db), sourceBefore = await bytes(db, 'book_metadata_sources');
  const note = 'Reviewed registry note; normalized facts retained with attribution.';
  await db.query(`UPDATE public.phase9_provider_registry SET shared_source_note=$1,raw_retention_seconds=17,
    revalidation_seconds=1234 WHERE adapter_key='open_library'`, [note]);
  const replayCard = await olCard(db, { publisher: 'No refresh press' });
  assert.equal((await add(db, replayCard)).item.canonical_edition_id, first.canonical_edition_id);
  assert.deepEqual(await catalogueBytes(db), canonicalBefore); assert.equal(await bytes(db, 'book_metadata_sources'), sourceBefore);
  const next = await cardWithRecord({ providerRecordId: 'OL101M', isbn10: null, isbn13: '9780547928227' });
  const added = (await add(db, next)).item; linked(added);
  const e = await edition(added.canonical_edition_id), s = await source(e.id);
  assert.equal(e.source_retention_note, note); assert.equal(s.normalized_payload.sourceRetentionNote, note);
  assert.equal(Date.parse(s.raw_delete_after) - Date.parse(s.fetched_at), 17000);
  assert.equal(Date.parse(s.expires_at) - Date.parse(s.fetched_at), 1234000);
  assert.equal((await source(first.canonical_edition_id)).normalized_payload.sourceRetentionNote === note, false);
});

for (const legacy of ['raw-case Hobbit', 'sparse legacy']) test('AC7-19/OQ1: ' + legacy + ' canonical row hashes remain unchanged', async () => {
  await requireLean(db);
  const m = legacy === 'raw-case Hobbit' ? facts({ title: 'The Hobbit', authors: ['J.R.R. Tolkien'],
    isbn10: null, isbn13: '9780547928227' }) : facts();
  const t = await seedIncumbent(db, m, { sparse: legacy === 'sparse legacy', displayKey: legacy === 'raw-case Hobbit' });
  const before = await catalogueBytes(db);
  const f = await olCard(db, m), { item } = await add(db, f); linked(item);
  assert.equal(item.canonical_edition_id, t.editionId); assert.deepEqual(await catalogueBytes(db), before);
  const e = await edition(t.editionId);
  assert.deepEqual([e.metadata_verified_at, e.metadata_selection_version, e.normalizer_version, e.source_retention_note, e.oclc, e.lccn],
    [null, null, null, null, null, null], 'existing unknown provenance is never invented');
});

test('AC7-19: actual M81-created row hashes and original ISBN stamps survive the M83 upgrade', async () => {
  let before, original;
  // Compare pre-existing fields: M83 legitimately adds nullable columns and the
  // false hidden default, which are removed from both hash inputs below.
  const hashes = async database => (await database.query(`SELECT
    (SELECT md5((to_jsonb(w)-'normalizer_version')::text) FROM public.canonical_works w) AS work,
    (SELECT md5((to_jsonb(e)-ARRAY['oclc','lccn','hidden','source_retention_note','normalizer_version'])::text)
      FROM public.canonical_editions e) AS edition`)).rows[0];
  const upgraded = await createLeanDatabase({ beforeM83: async database => {
    const card = await olCard(database); original = await add(database, card);
    linked(original.item); before = await hashes(database);
    const e = (await database.query('SELECT metadata_selection_version FROM public.canonical_editions')).rows[0];
    assert.equal(e.metadata_selection_version, 'psr-catalogue-isbn-v1', 'upgrade fixture must be written by the actual M81 helper');
  } });
  try {
    await requireLean(upgraded);
    assert.deepEqual(await hashes(upgraded), before, 'M83 does not rewrite any M81 canonical field');
    const [e] = (await upgraded.query('SELECT hidden,normalizer_version,source_retention_note,oclc,lccn FROM public.canonical_editions')).rows;
    assert.deepEqual(e, { hidden: false, normalizer_version: null, source_retention_note: null, oclc: null, lccn: null });
    assert.equal(await scalar(upgraded, 'SELECT count(*)::int FROM public.book_metadata_sources'), 0, 'no historical source backfill');
    assert.equal(await scalar(upgraded, 'SELECT count(*)::int FROM public.canonical_edition_stats'), 0, 'no historical counter backfill');
    assert.equal(await scalar(upgraded, "SELECT canonical_edition_id FROM public.store_inventory WHERE id='" + original.item.id + "'"), original.item.canonical_edition_id);
  } finally { await upgraded.close(); }
});

test('AC7-19: repeated old-worker Add never clears existing OCLC/LCCN or optional facts', async () => {
  await requireLean(db);
  const m = facts(), t = await seedIncumbent(db, m);
  await db.query(`UPDATE public.canonical_editions SET oclc='00012345',lccn='n 79021164',
    normalizer_version='old-normalizer',source_retention_note='Original approved source.' WHERE id=$1`, [t.editionId]);
  const before = await catalogueBytes(db), f = await olCard(db, { coverReference: null, publisher: null });
  assert.equal((await add(db, f)).item.canonical_edition_id, t.editionId);
  assert.deepEqual(await catalogueBytes(db), before);
});

for (const currentSuggestion of [false, true]) test('AC7-6: hidden existing ' + (currentSuggestion ? 'current suggestion' : 'saved edition') + ' remains displayed and linked', async () => {
  await requireLean(db);
  const m = facts(), t = await seedIncumbent(db, m), first = await canonicalCard(db, m, t);
  const committed = await add(db, first); linked(committed.item);
  const held = await canonicalCard(db, m, t, currentSuggestion), chosen = await selectionBytes(db, held);
  const inventoryBefore = await bytes(db, 'store_inventory');
  await setActor(db, held.ownerId); const displayBefore = (await scalar(db, readSql(held))).selection;
  await hideEdition(db, t.editionId);
  const canonicalBefore = await catalogueBytes(db);
  await setActor(db, held.ownerId); const displayAfter = (await scalar(db, readSql(held))).selection;
  assert.deepEqual(displayAfter, displayBefore, 'selected/current snapshot readers retain the saved display');
  assert.equal(await selectionBytes(db, held), chosen); assert.equal(await bytes(db, 'store_inventory'), inventoryBefore);
  const result = await add(db, held); linked(result.item);
  assert.equal(result.item.canonical_edition_id, t.editionId); assert.equal(await selectionBytes(db, held), chosen);
  assert.deepEqual(await catalogueBytes(db), canonicalBefore, 'reuse preserves hidden canonical works and editions');
  assert.equal((await db.query('SELECT canonical_edition_id FROM public.store_inventory WHERE id=$1', [committed.item.id])).rows[0].canonical_edition_id, t.editionId);
});

test('AC7-3/6/OQ2: a new blocklist entry never mutates old links or saved bytes and exact replay stays linked', async () => {
  await requireLean(db);
  const f = await olCard(db), first = await add(db, f), chosen = await selectionBytes(db, f);
  const inventoryBefore = await bytes(db, 'store_inventory'), canonicalBefore = await catalogueBytes(db), sourcesBefore = await bytes(db, 'book_metadata_sources');
  await blockIsbn(db, f.facts.isbn13);
  assert.equal(await bytes(db, 'store_inventory'), inventoryBefore); assert.deepEqual(await catalogueBytes(db), canonicalBefore);
  assert.equal(await bytes(db, 'book_metadata_sources'), sourcesBefore); assert.equal(await selectionBytes(db, f), chosen);
  const replay = await add(db, f, first.command);
  assert.deepEqual(replay.receipt, first.receipt); linked(replay.item);
  assert.equal(await bytes(db, 'store_inventory'), inventoryBefore); assert.equal(await selectionBytes(db, f), chosen);
});
