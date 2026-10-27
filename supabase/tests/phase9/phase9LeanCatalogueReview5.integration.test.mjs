// 02b §§5/6.1/6.2/7.2/12: review-round identity and scope regressions.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { createLeanDatabase, sourcePolicy } from './leanCatalogueFixture.mjs';
import { add, automaticCard, bytes, catalogueBytes, completeOL, enableOL, facts, linked, olOperation,
  readSql, resetActor, reviewValue, saveReview, scalar, seedIncumbent, selectionBytes, selectSql,
  setActor, unmatched } from './catalogueLinkFixture.mjs';

let db;
before(async () => { db = await createLeanDatabase(); });
beforeEach(async () => {
  await resetActor(db);
  await db.exec('TRUNCATE public.stores,public.canonical_works,public.canonical_editions CASCADE');
  await enableOL(db);
});
after(async () => { await db?.close(); });
async function editionStats(editionId) {
  await resetActor(db);
  return (await db.query(`SELECT coalesce(sum(times_chosen),0)::int AS chosen,
    coalesce(sum(times_added),0)::int AS added FROM public.canonical_edition_stats
    WHERE canonical_edition_id=$1`, [editionId])).rows[0];
}

test('a real save of automatic choice does not flush a retained option effect', async () => {
  const f = await automaticCard(db), snapshotId = f.selectionId;
  const option = await olOperation(db, { ...f.facts, providerRecordId: 'OL101M' }, false, false, f);
  const row = await completeOL(db, option);
  await setActor(db, f.ownerId);
  const selected = await scalar(db, selectSql(f, await scalar(db, readSql(f)), row.optionId));
  const selectionId = selected.selection.selectionId;
  await saveReview(db, f, { ...await reviewValue(db, f), metadataChoice: { mode: 'selected', selectionId: snapshotId } });
  await resetActor(db);
  const effect = () => db.query('SELECT counted,canonical_edition_id FROM marketplace_sec.phase9_catalogue_choice_effects WHERE selection_id=$1', [selectionId]);
  assert.deepEqual((await effect()).rows, [{ counted: false, canonical_edition_id: null }]);
  const result = await add(db, f); linked(result.item);
  assert.deepEqual((await effect()).rows, [{ counted: false, canonical_edition_id: null }]);
  assert.equal(await scalar(db, 'SELECT coalesce(sum(times_chosen),0)::int FROM public.canonical_edition_stats'), 0);
  assert.deepEqual(await editionStats(result.item.canonical_edition_id), { chosen: 0, added: 1 });
  assert.deepEqual((await add(db, f, result.command)).receipt, result.receipt, 'exact Add replay retains its receipt');
  assert.deepEqual(await editionStats(result.item.canonical_edition_id), { chosen: 0, added: 1 }, 'automatic Add replay changes neither counter');
  assert.deepEqual((await effect()).rows, [{ counted: false, canonical_edition_id: null }]);
});

test('[baseline] automatic choice switched back to the same retained option flushes its effect once', async () => {
  const f = await automaticCard(db), snapshotId = f.selectionId;
  const option = await olOperation(db, { ...f.facts, providerRecordId: 'OL101M' }, false, false, f);
  const row = await completeOL(db, option);
  await setActor(db, f.ownerId);
  const selected = await scalar(db, selectSql(f, await scalar(db, readSql(f)), row.optionId));
  const selectionId = selected.selection.selectionId;
  await saveReview(db, f, { ...await reviewValue(db, f), metadataChoice: { mode: 'selected', selectionId: snapshotId } });
  await saveReview(db, f, { ...await reviewValue(db, f), metadataChoice: { mode: 'edition_option', selectionId } });
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT selection_id::text FROM public.phase9_candidate_edition_state
    WHERE candidate_id='${f.candidateId}'`), selectionId, 'switching review mode retains the exact selection');
  const effect = () => db.query(`SELECT counted,canonical_edition_id,completed_at FROM marketplace_sec.phase9_catalogue_choice_effects
    WHERE selection_id=$1`, [selectionId]);
  assert.deepEqual((await effect()).rows, [{ counted: false, canonical_edition_id: null, completed_at: null }]);
  const result = await add(db, f); linked(result.item);
  assert.deepEqual(await editionStats(result.item.canonical_edition_id), { chosen: 1, added: 1 });
  const counted = (await effect()).rows;
  assert.equal(counted.length, 1); assert.equal(counted[0].counted, true); assert.ok(counted[0].completed_at);
  assert.equal(counted[0].canonical_edition_id, result.item.canonical_edition_id);
  assert.deepEqual((await add(db, f, result.command)).receipt, result.receipt);
  assert.deepEqual(await editionStats(result.item.canonical_edition_id), { chosen: 1, added: 1 }, 'retained-option Add replay counts zero');
  assert.deepEqual((await effect()).rows, counted, 'replay keeps the exact counted effect');
});

for (const conflict of ['isbn', 'provider', 'source']) test('saved target refuses competing ' + conflict, async () => {
  const m = facts(), first = await seedIncumbent(db, m);
  let second;
  if (conflict === 'isbn') {
    second = await seedIncumbent(db, facts({ title: 'Other work', isbn10: null, isbn13: null }));
    await db.query(`INSERT INTO public.canonical_provider_ids(adapter_key,id_kind,external_id,canonical_edition_id)
      VALUES($1,'edition',$2,$3)`, [m.adapterKey, m.providerRecordId, second.editionId]);
  }
  const f = await automaticCard(db, m, { target: first.editionId, currentSuggestion: conflict === 'isbn' });
  await resetActor(db);
  if (conflict === 'isbn') {
    await db.query('DELETE FROM public.canonical_provider_ids WHERE adapter_key=$1 AND external_id=$2', [m.adapterKey, m.providerRecordId]);
    await db.query('UPDATE public.canonical_editions SET isbn_10=NULL,isbn_13=NULL WHERE id=$1', [first.editionId]);
    await db.query('UPDATE public.canonical_editions SET isbn_10=$1,isbn_13=$2 WHERE id=$3', [m.isbn10, m.isbn13, second.editionId]);
  } else second = await seedIncumbent(db, facts({ title: 'Other work', isbn10: null, isbn13: null }));
  if (conflict === 'provider') await db.query(`INSERT INTO public.canonical_provider_ids
    (adapter_key,id_kind,external_id,canonical_edition_id) VALUES($1,'edition',$2,$3)`,
  [m.adapterKey, m.providerRecordId, second.editionId]);
  if (conflict === 'source') await db.query(`INSERT INTO public.book_metadata_sources
    (id,provider,adapter_key,provider_book_id,canonical_edition_id) VALUES($1,$2,$2,$3,$4)`,
  [randomUUID(), m.adapterKey, m.providerRecordId, second.editionId]);
  let pending = conflict === 'isbn' ? f.selected.selection.selectionId : null;
  if (conflict !== 'isbn') {
    const option = await olOperation(db, f.facts, false, false, f), row = await completeOL(db, option);
    await setActor(db, f.ownerId);
    const selected = await scalar(db, selectSql(f, await scalar(db, readSql(f)), row.optionId));
    pending = selected.selection.selectionId;
    await saveReview(db, f, { ...await reviewValue(db, f), metadataChoice: { mode: 'selected', selectionId: f.selectionId } });
    await resetActor(db);
    assert.deepEqual((await db.query('SELECT counted,canonical_edition_id FROM marketplace_sec.phase9_catalogue_choice_effects WHERE selection_id=$1', [pending])).rows,
      [{ counted: false, canonical_edition_id: null }]);
  }
  if (pending) assert.deepEqual((await db.query('SELECT counted,canonical_edition_id FROM marketplace_sec.phase9_catalogue_choice_effects WHERE selection_id=$1', [pending])).rows,
    [{ counted: false, canonical_edition_id: null }]);
  const before = await catalogueBytes(db), chosen = await selectionBytes(db, f);
  unmatched((await add(db, f)).item);
  assert.deepEqual(await catalogueBytes(db), before);
  assert.equal(await selectionBytes(db, f), chosen);
  if (pending) assert.deepEqual((await db.query('SELECT counted,canonical_edition_id FROM marketplace_sec.phase9_catalogue_choice_effects WHERE selection_id=$1', [pending])).rows,
    [{ counted: false, canonical_edition_id: null }]);
  assert.equal(await scalar(db, 'SELECT coalesce(sum(times_chosen),0)::int FROM public.canonical_edition_stats'), 0);
});

test('no saved hint and no provider record cannot count an ISBN target', async () => {
  const m = facts(), t = await seedIncumbent(db, m);
  delete m.providerRecordId;
  const pair = (await db.query('SELECT * FROM marketplace_sec.phase9_catalogue_choice_target_v1($1,NULL,$2,NULL)',
    [m, m.adapterKey])).rows[0];
  assert.deepEqual(pair, { canonical_work_id: null, canonical_edition_id: null });
  assert.ok(t.editionId);
});

test('7a refuses a valid companion without shared writes', async () => {
  const m = facts({ correlationId: randomUUID(), attemptId: randomUUID() });
  const companion = { version: 'psr-catalogue-write-v1', optionId: randomUUID(), adapterKey: m.adapterKey,
    adapterVersion: m.adapterVersion, normalizerVersion: m.normalizerVersion, lookupId: m.correlationId,
    attemptId: m.attemptId, providerRecordId: m.providerRecordId, workExternalId: 'OL700W',
    fetchedAt: m.fetchedAt, oclc: null, lccn: null };
  const before = [await catalogueBytes(db), await bytes(db, 'canonical_provider_ids'), await bytes(db, 'book_metadata_sources')];
  const pair = (await db.query('SELECT * FROM marketplace_sec.phase9_catalogue_resolve_v1($1,$2,$3)',
    [m, companion, await sourcePolicy(db, m)])).rows[0];
  assert.deepEqual(pair, { canonical_work_id: null, canonical_edition_id: null });
  assert.deepEqual([await catalogueBytes(db), await bytes(db, 'canonical_provider_ids'), await bytes(db, 'book_metadata_sources')], before);
});
