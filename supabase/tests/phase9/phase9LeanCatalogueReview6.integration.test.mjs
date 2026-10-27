// 02b §§5/7.2: no-hint Select and Add must use the same shared admission.
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createLeanDatabase } from './leanCatalogueFixture.mjs';
import { add, bytes, catalogueBytes, completeOL, enableOL, facts, linked, olOperation,
  readSql, resetActor, saveReview, scalar, seedIncumbent, selectSql, setActor, unmatched } from './catalogueLinkFixture.mjs';
import { metadata, row, seedCard } from './editionPickerFixture.mjs';
import { seedOptions } from './editionPickerCommitFixture.mjs';

let db;
before(async () => { db = await createLeanDatabase(); });
beforeEach(async () => {
  await resetActor(db);
  await db.exec('TRUNCATE public.stores,public.canonical_works,public.canonical_editions CASCADE');
  await enableOL(db);
});
after(async () => { await db?.close(); });
async function stats(editionId) {
  await resetActor(db);
  return (await db.query(`SELECT coalesce(sum(times_chosen),0)::int AS chosen,
    coalesce(sum(times_added),0)::int AS added FROM public.canonical_edition_stats
    WHERE canonical_edition_id=$1`, [editionId])).rows[0];
}
async function sharedFacts() {
  return [await catalogueBytes(db), await bytes(db, 'canonical_provider_ids'), await bytes(db, 'book_metadata_sources')];
}

for (const admitted of [false, true]) test((admitted ? '[baseline] ' : '')
  + 'AC7-4/17: no-hint ' + (admitted ? 'Open Library' : 'Google Books') + ' Select and Add share admission', async () => {
  const m = admitted ? facts() : metadata;
  const target = await seedIncumbent(db, m);
  let f, option;
  if (admitted) {
    f = await olOperation(db);
    option = await completeOL(db, f);
  } else {
    f = await seedCard(db);
    option = (await seedOptions(db, f, [row()])).rows[0];
    await resetActor(db);
    await db.exec("UPDATE public.phase9_provider_registry SET public_display_allowed=true WHERE adapter_key='google_books'");
  }
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT marketplace_sec.phase9_catalogue_shared_admitted_v1('${m.adapterKey}')`), admitted);
  const before = await sharedFacts();
  await setActor(db, f.ownerId);
  const selected = await scalar(db, selectSql(f, await scalar(db, readSql(f)), option.optionId));
  const atSelect = await stats(target.editionId);
  await setActor(db, f.ownerId); await saveReview(db, f);
  const result = await add(db, f);
  if (admitted) {
    linked(result.item); assert.equal(result.item.canonical_edition_id, target.editionId);
  } else {
    unmatched(result.item);
    assert.deepEqual(await sharedFacts(), before, 'denied-provider Select/Add leave every shared fact byte unchanged');
  }
  assert.deepEqual(atSelect, { chosen: admitted ? 1 : 0, added: 0 },
    'no-hint Select must not count chosen for a provider that Add cannot share');
  assert.deepEqual(await stats(target.editionId), { chosen: admitted ? 1 : 0, added: admitted ? 1 : 0 });
  await resetActor(db);
  const effect = (await db.query(`SELECT counted,canonical_edition_id FROM marketplace_sec.phase9_catalogue_choice_effects
    WHERE selection_id=$1`, [selected.selection.selectionId])).rows[0];
  assert.deepEqual(effect, { counted: admitted, canonical_edition_id: admitted ? target.editionId : null });
  assert.deepEqual(await catalogueBytes(db), before[0], 'incumbent canonical bytes never change');
  assert.equal(await scalar(db, 'SELECT coalesce(sum(times_searched),0)::int FROM public.canonical_work_stats'), 0);
});
