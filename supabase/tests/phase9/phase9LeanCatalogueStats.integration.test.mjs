// 02b §§4.3/4.4/7.2/11/12/14 OQ6: 7a chosen/added only; disposable SQL, no HTTP.
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createLeanDatabase, requireLean } from './leanCatalogueFixture.mjs';
import { add, bytes, catalogueBytes, completeOL, currentCommitSql, facts, linked,
  olCard, olOperation, readSql, resetActor, reviewValue, saveReview, scalar,
  seedIncumbent, selectSql, setActor } from './catalogueLinkFixture.mjs';
let db;
before(async () => { db = await createLeanDatabase(); });
beforeEach(async () => {
  await resetActor(db);
  await db.exec('TRUNCATE public.stores,public.canonical_works,public.canonical_editions CASCADE');
});
after(async () => { await db?.close(); });
const editionStats = 'public.canonical_edition_stats', workStats = 'public.canonical_work_stats';
const effects = 'marketplace_sec.phase9_catalogue_choice_effects';
async function totals() {
  await requireLean(db, editionStats); await requireLean(db, workStats);
  await resetActor(db);
  const e = (await db.query(`SELECT coalesce(sum(times_chosen),0)::int AS chosen,
    coalesce(sum(times_added),0)::int AS added FROM ${editionStats}`)).rows[0];
  return { ...e, searched: await scalar(db, `SELECT coalesce(sum(times_searched),0)::int FROM ${workStats}`) };
}
async function choice(f, selectionId = f.selected.selection.selectionId) {
  await requireLean(db, effects); await resetActor(db);
  return (await db.query(`SELECT * FROM ${effects} WHERE selection_id=$1`, [selectionId])).rows[0];
}
async function choose(overrides = {}) {
  const f = await olOperation(db, overrides), row = await completeOL(db, f);
  await setActor(db, f.ownerId);
  const command = selectSql(f, await scalar(db, readSql(f)), row.optionId);
  const selected = await scalar(db, command);
  await saveReview(db, f);
  return { ...f, selected, command, optionId: row.optionId };
}
async function replaySelect(f) {
  await setActor(db, f.ownerId);
  const receipt = await scalar(db, f.command);
  assert.equal(receipt.selection.selectionId, f.selected.selection.selectionId);
}
async function replayAdd(f, committed) {
  await setActor(db, f.ownerId);
  assert.deepEqual(await scalar(db, committed.command), committed.receipt);
}
async function counts(chosen, added) {
  assert.deepEqual(await totals(), { chosen, added, searched: 0 }, 'searched must remain zero throughout 7a');
}

test('AC7-4: successful Select of a coherent incumbent counts once; lost-response replay adds zero', async () => {
  const target = await seedIncumbent(db), f = await choose();
  await counts(1, 0);
  const effect = await choice(f);
  assert.ok(effect, 'new committed Select requires a private choice receipt');
  assert.deepEqual([effect.counted, effect.canonical_edition_id], [true, target.editionId]);
  assert.ok(effect.completed_at);
  assert.equal(effect.candidate_id, f.candidateId); assert.equal(effect.store_id, f.storeId);
  assert.equal(effect.session_id, f.sessionId); assert.equal(effect.lookup_id, f.lookupId);
  assert.equal(effect.attempt_id, f.attemptId); assert.equal(effect.option_id, f.optionId);
  const snapshotDigest = await scalar(db, `SELECT encode(sha256(convert_to(selected_option_snapshot::text,'UTF8')),'hex')
    FROM public.phase9_candidate_edition_state WHERE candidate_id='${f.candidateId}'`);
  assert.equal(effect.metadata_digest, snapshotDigest, 'digest is computed from exact persisted SQL jsonb');
  await replaySelect(f); await counts(1, 0);
  assert.deepEqual(await choice(f), effect, 'replay must preserve the original effect bytes');
});

test('AC7-4/OQ6: fresh-key same-option reselection creates a new selection and chosen +1', async () => {
  await seedIncumbent(db); const f = await choose(); await counts(1, 0);
  await setActor(db, f.ownerId);
  const command = selectSql(f, await scalar(db, readSql(f)), f.optionId);
  const next = await scalar(db, command);
  assert.notEqual(next.selection.selectionId, f.selected.selection.selectionId);
  await counts(2, 0);
  const second = { ...f, selected: next, command };
  assert.equal((await choice(second)).counted, true);
  await replaySelect(f); await replaySelect(second); await counts(2, 0);
});

test('AC7-4: confirmed Select counts even when the legacy review object is absent', async () => {
  await seedIncumbent(db);
  const f = await olOperation(db), row = await completeOL(db, f);
  await resetActor(db);
  await db.query(`UPDATE public.image_extraction_candidates SET owner_review_snapshot='{}'::jsonb,
    review_version=NULL WHERE id=$1`, [f.candidateId]);
  await setActor(db, f.ownerId);
  const selected = await scalar(db, selectSql(f, await scalar(db, readSql(f)), row.optionId));
  assert.equal(selected.selection.confirmedByOwner, true);
  await counts(1, 0);
  assert.equal((await choice({ ...f, selected })).counted, true);
});

test('AC7-4: Select without a target stays pending; exact current choice flushes once at Add', async () => {
  const f = await choose();
  await counts(0, 0);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.canonical_editions'), 0, 'Select resolves read-only');
  const pending = await choice(f);
  assert.ok(pending); assert.deepEqual([pending.counted, pending.canonical_edition_id, pending.completed_at], [false, null, null]);
  await replaySelect(f); await counts(0, 0);
  const committed = await add(db, f); linked(committed.item); await counts(1, 1);
  const counted = await choice(f);
  assert.equal(counted.counted, true); assert.equal(counted.canonical_edition_id, committed.item.canonical_edition_id);
  assert.ok(counted.completed_at); assert.equal(counted.metadata_digest, pending.metadata_digest);
  await replayAdd(f, committed); await counts(1, 1);
  assert.deepEqual(await choice(f), counted);
});

test('AC7-4: Add flushes only the current pending selection, leaving superseded same-option effects pending', async () => {
  const f = await choose(), old = await choice(f);
  await setActor(db, f.ownerId);
  const command = selectSql(f, await scalar(db, readSql(f)), f.optionId), selected = await scalar(db, command);
  const current = { ...f, command, selected }; await saveReview(db, current);
  const committed = await add(db, current); linked(committed.item); await counts(1, 1);
  assert.deepEqual(await choice(f), old, 'Add must not scan and flush historical candidate choices');
  assert.equal((await choice(current)).counted, true);
});

test('AC7-4: a pending receipt with a different metadata digest cannot supply chosen attribution', async () => {
  const f = await choose(); await requireLean(db, effects); await resetActor(db);
  await db.query(`UPDATE ${effects} SET metadata_digest=repeat('0',64) WHERE selection_id=$1`, [f.selected.selection.selectionId]);
  const committed = await add(db, f); linked(committed.item); await counts(0, 1);
  assert.equal((await choice(f)).counted, false, 'changed digest must not be repaired or counted');
});

test('AC7-4/5: quantity q counts one Add; an already counted choice is not counted again', async () => {
  await seedIncumbent(db); const f = await choose(); await counts(1, 0);
  await setActor(db, f.ownerId);
  await saveReview(db, f, { ...await reviewValue(db, f), quantity: 7 });
  const committed = await add(db, f); linked(committed.item);
  assert.equal(committed.item.quantity_total, 7); await counts(1, 1);
  await replayAdd(f, committed); await counts(1, 1);
});

test('AC7-4: two stores adding one edition contribute +2; each independent lost-response replay adds zero', async () => {
  const a = await choose(), first = await add(db, a); linked(first.item);
  const b = await choose(), second = await add(db, b); linked(second.item);
  assert.notEqual(a.storeId, b.storeId); assert.notEqual(first.item.id, second.item.id);
  assert.equal(first.item.canonical_edition_id, second.item.canonical_edition_id);
  await counts(2, 2);
  await replayAdd(a, first); await replayAdd(b, second); await counts(2, 2);
  // Actual simultaneous waiting/commit/rollback is proved by the native suite, not sequential PGlite.
});

test('AC7-4: no-link manual Add contributes no choice or Add count', async () => {
  const f = await olCard(db);
  await setActor(db, f.ownerId);
  await saveReview(db, f, { ...await reviewValue(db, f), metadataChoice: { mode: 'manual', selectionId: null } });
  await saveReview(db, f);
  const committed = await add(db, f);
  assert.equal(committed.item.canonical_edition_id, null); await counts(0, 0);
});

test('AC7-4: outer inventory failure rolls back counters, pending marker and shared inserts', async () => {
  const f = await choose(); await requireLean(db, effects);
  const pending = await choice(f), before = await catalogueBytes(db);
  await db.exec('ALTER TABLE public.store_inventory ADD CONSTRAINT lean_stats_failure CHECK(false) NOT VALID');
  try {
    await setActor(db, f.ownerId);
    await assert.rejects(scalar(db, await currentCommitSql(db, f)), /lean_stats_failure/);
  } finally { await resetActor(db); await db.exec('ALTER TABLE public.store_inventory DROP CONSTRAINT lean_stats_failure'); }
  await counts(0, 0); assert.deepEqual(await choice(f), pending); assert.deepEqual(await catalogueBytes(db), before);
});

test('AC7-4: missing pre-upgrade choice receipt never receives historical chosen attribution at Add', async () => {
  const f = await choose(); await requireLean(db, effects); await resetActor(db);
  // Model an existing legacy saved selection without reconstructing old receipts.
  await db.query(`DELETE FROM ${effects} WHERE selection_id=$1`, [f.selected.selection.selectionId]);
  const committed = await add(db, f); linked(committed.item); await counts(0, 1);
  assert.equal(await choice(f), undefined, 'Add must not backfill old selections');
});

test('AC7-5: nonempty aggregate schema/data contain no private identity, query, quantity or price', async () => {
  const f = await choose(), committed = await add(db, f); linked(committed.item); await counts(1, 1);
  await resetActor(db);
  // A zero searched delta need not create a work aggregate; seed its approved zero
  // state so both schema/data scans and the nonnegative CHECK probes are nonvacuous.
  await db.query(`INSERT INTO ${workStats}(canonical_work_id) VALUES($1) ON CONFLICT DO NOTHING`, [committed.item.canonical_work_id]);
  const allowed = {
    canonical_work_stats: ['canonical_work_id', 'times_searched', 'updated_at'],
    canonical_edition_stats: ['canonical_edition_id', 'times_chosen', 'times_added', 'updated_at'],
  };
  for (const [table, expected] of Object.entries(allowed)) {
    const columns = (await db.query(`SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1 ORDER BY column_name`, [table])).rows.map(r => r.column_name);
    assert.deepEqual(columns, [...expected].sort(), 'aggregate tables expose only approved columns');
  }
  const rows = (await db.query(`SELECT to_jsonb(t) AS value FROM ${editionStats} t`)).rows;
  assert.equal(rows.length, 1, 'privacy scan must inspect populated stats');
  assert.equal(await scalar(db, `SELECT count(*)::int FROM ${workStats}`), 1);
  const shared = JSON.stringify([rows, await bytes(db, 'canonical_work_stats')]);
  for (const privateId of [f.ownerId, f.storeId, f.candidateId, f.sessionId, f.lookupId, f.attemptId,
    f.jobId, f.optionId, f.selected.selection.selectionId, committed.item.id]) {
    assert.equal(shared.includes(privateId), false, 'shared aggregates must omit private lineage');
  }
  for (const [table, columns] of Object.entries({ canonical_work_stats: ['times_searched'], canonical_edition_stats: ['times_chosen', 'times_added'] })) {
    for (const column of columns) {
      await assert.rejects(db.exec(`UPDATE public.${table} SET ${column}=-1`), error => error.code === '23514');
    }
  }
});

test('AC7-5: popularity leaves sparse incumbent facts and verification stamps byte-identical', async () => {
  const target = await seedIncumbent(db, facts(), { sparse: true });
  const before = await catalogueBytes(db), f = await choose(), committed = await add(db, f);
  assert.equal(committed.item.canonical_edition_id, target.editionId); await counts(1, 1);
  assert.deepEqual(await catalogueBytes(db), before, 'popularity cannot enrich or verify canonical facts');
  const e = (await db.query('SELECT metadata_verified_at,metadata_selection_version FROM public.canonical_editions WHERE id=$1', [target.editionId])).rows[0];
  assert.deepEqual(e, { metadata_verified_at: null, metadata_selection_version: null });
});
