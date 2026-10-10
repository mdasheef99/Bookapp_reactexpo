// Picker §§6-7 / EP-AC11/19: full M65-M69 stack, forward confirmation reader, no live access.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { migrationPath } from './databaseHarness.mjs';
import { chosenCard, createCommitDatabase, currentCommitSql, expire, originalSelection,
  readSql, resetActor, reviewValue, saveReview, scalar, seedCard, seedOptions, selectSql, setActor, inventory, optionsTruth } from './editionPickerCommitFixture.mjs';

const M70 = '20261008000070_marketplace_phase9_edition_picker_confirmation.sql';
let db, upgradeFixture;
before(async () => {
  db = await createCommitDatabase();
  // Exercise original readers/commands before migration, including an actual legacy receipt.
  upgradeFixture = await confirmedSuggestion();
  await resetActor(db);
  // Before the correction the complete prior stack gives semantic RED, not missing-file RED.
  if (fs.existsSync(migrationPath(M70))) await db.exec(fs.readFileSync(migrationPath(M70), 'utf8'));
  // Current correction gate: retain the legacy-receipt upgrade fixture, then M65-M71.
  await db.exec(fs.readFileSync(migrationPath('20261010000071_marketplace_phase9_edition_picker_selection_eligibility.sql'), 'utf8'));
});
after(async () => { if (db) await db.close(); });
async function withoutReview(f) {
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_candidates SET owner_review_snapshot='{}',review_version=NULL,"
    + "review_ready=false,review_disposition=NULL WHERE id=$1", [f.candidateId]);
  await setActor(db, f.ownerId);
  return f;
}
async function automaticCard() {
  const f = await originalSelection(db, await seedCard(db, { isbn: null }), true);
  const selling = await reviewValue(db, f);
  return { ...await withoutReview(f), selling };
}
async function confirmedSuggestion() {
  const f = await automaticCard(), choices = await scalar(db, readSql(f));
  const command = selectSql(f, choices, choices.selection.selectionId, {
    source: 'current_suggestion', key: randomUUID(), command: randomUUID(),
  });
  return { ...f, command, selected: await scalar(db, command) };
}
async function candidate(f) {
  await resetActor(db);
  const result = (await db.query('SELECT * FROM public.image_extraction_candidates WHERE id=$1', [f.candidateId])).rows[0];
  await setActor(db, f.ownerId);
  return result;
}
async function stripReceiptConfirmation(f) {
  await resetActor(db);
  await db.query("UPDATE public.phase9_idempotency_keys SET canonical_response=canonical_response #- '{selection,confirmedByOwner}' "
    + "WHERE actor_or_service=$1 AND operation='EP_SELECT_V1' AND canonical_response#>>'{selection,selectionId}'=$2",
  [f.ownerId, f.selected.selection.selectionId]);
  await setActor(db, f.ownerId);
}

test('automatic suggestion says false; reading cannot manufacture review or versions', async () => {
  const f = await automaticCard(), beforeRead = await candidate(f);
  const choices = await scalar(db, readSql(f));
  assert.equal(choices.selection.source, 'current_suggestion');
  assert.equal(choices.selection.confirmedByOwner, false);
  assert.equal(choices.reviewVersion, null);
  const afterRead = await candidate(f);
  for (const key of ['owner_review_snapshot', 'version', 'metadata_revision', 'review_version', 'review_ready']) {
    assert.deepEqual(afterRead[key], beforeRead[key], key);
  }
});
test('controlled current suggestion before first review says true on command and fresh read', async () => {
  const f = await confirmedSuggestion();
  assert.equal(f.selected.selection.confirmedByOwner, true);
  assert.equal(f.selected.reviewVersion, null);
  const choices = await scalar(db, readSql(f));
  assert.equal(choices.selection.confirmedByOwner, true);
  assert.equal(choices.selection.selectionId, f.selected.selection.selectionId);
  const c = await candidate(f);
  assert.deepEqual(c.owner_review_snapshot, {});
  assert.equal(c.review_version, null);
  assert.equal(c.review_ready, false);
  await assert.rejects(scalar(db, await currentCommitSql(db, f)), /P9_/);
});
test('selected option stays confirmed after alternatives expire', async () => {
  const f = await chosenCard(db);
  assert.equal(f.selected.selection.confirmedByOwner, true);
  await expire(db, f);
  const choices = await scalar(db, readSql(f));
  assert.deepEqual(choices.rows, []);
  assert.equal(choices.optionsExpiresAt, null);
  assert.equal(choices.selection.confirmedByOwner, true);
  assert.equal(choices.selection.selectionId, f.selected.selection.selectionId);
});
test('current-suggestion confirmation also survives expiry without a selling review', async () => {
  const f = await confirmedSuggestion();
  await seedOptions(db, f);
  await expire(db, f);
  const choices = await scalar(db, readSql(f));
  assert.equal(choices.selection.confirmedByOwner, true);
  assert.equal(choices.reviewVersion, null);
  assert.deepEqual(choices.rows, []);
});
test('identity replacement never exposes the stale held choice as confirmed', async () => {
  const f = await confirmedSuggestion();
  await resetActor(db);
  await db.query('UPDATE public.image_extraction_candidates SET observed_title=$1 WHERE id=$2', ['Replacement book', f.candidateId]);
  await setActor(db, f.ownerId);
  const choices = await scalar(db, readSql(f));
  assert.notEqual(choices.selection?.confirmedByOwner, true);
  assert.notEqual(choices.selection?.selectionId, f.selected.selection.selectionId);
});
test('confirmation is per card; an unfinished automatic card stays unconfirmed', async () => {
  const first = await confirmedSuggestion(), second = await automaticCard();
  await setActor(db, first.ownerId);
  assert.equal((await scalar(db, readSql(first))).selection.confirmedByOwner, true);
  await setActor(db, second.ownerId);
  assert.equal((await scalar(db, readSql(second))).selection.confirmedByOwner, false);
});
test('confirmation projection exposes a boolean without owner IDs or internal evidence', async () => {
  const f = await confirmedSuggestion();
  const selection = (await scalar(db, readSql(f))).selection;
  assert.deepEqual(Object.keys(selection).sort(), ['confirmedByOwner', 'optionId', 'selectionId', 'snapshot', 'source'].sort());
  assert.equal(JSON.stringify(selection).includes(f.ownerId), false);
});
test('selection replay retains confirmation and remains slim after expiry', async () => {
  const f = await confirmedSuggestion();
  await seedOptions(db, f);
  await expire(db, f);
  const replay = await scalar(db, f.command);
  assert.equal(replay.selection.confirmedByOwner, true);
  assert.equal(replay.selection.selectionId, f.selected.selection.selectionId);
  assert.deepEqual(replay.rows, []);
  assert.equal(replay.optionsExpiresAt, null);
});
test('legacy receipt is projected from held authority without rewriting its stored body', async () => {
  const f = await confirmedSuggestion();
  await stripReceiptConfirmation(f);
  const replay = await scalar(db, f.command);
  assert.equal(replay.selection.confirmedByOwner, true);
  assert.deepEqual(replay.rows, []);
  await resetActor(db);
  const stored = await scalar(db, "SELECT canonical_response FROM public.phase9_idempotency_keys WHERE actor_or_service='"
    + f.ownerId + "' AND operation='EP_SELECT_V1'");
  assert.equal(stored.selection.confirmedByOwner, undefined);
});
test('legacy replay after a newer choice says false and keeps its original versions', async () => {
  const f = await confirmedSuggestion();
  await stripReceiptConfirmation(f);
  const current = await scalar(db, readSql(f));
  const next = await scalar(db, selectSql(f, current, f.selectionId, { source: 'current_suggestion' }));
  const replay = await scalar(db, f.command);
  assert.equal(replay.selection.confirmedByOwner, false);
  assert.equal(replay.metadataRevision, f.selected.metadataRevision);
  assert.equal(replay.selection.selectionId, f.selected.selection.selectionId);
  assert.equal((await scalar(db, readSql(f))).selection.selectionId, next.selection.selectionId);
});
test('legacy replay after changed identity does not manufacture current confirmation', async () => {
  const f = await confirmedSuggestion();
  await stripReceiptConfirmation(f);
  await resetActor(db);
  await db.query('UPDATE public.image_extraction_candidates SET observed_language=$1 WHERE id=$2', ['fr', f.candidateId]);
  await setActor(db, f.ownerId);
  const replay = await scalar(db, f.command);
  assert.equal(replay.selection.confirmedByOwner, false);
});
test('another store owner cannot read or replay the first card confirmation', async () => {
  const f = await confirmedSuggestion(), other = await seedCard(db);
  await setActor(db, other.ownerId);
  await assert.rejects(scalar(db, readSql(f)), /P9_NOT_FOUND|P9_OWNER_NOT_AUTHORIZED/);
  await assert.rejects(scalar(db, f.command), /P9_NOT_FOUND|P9_OWNER_NOT_AUTHORIZED/);
});
test('private readers and delegates deny direct execution, public signatures stay authenticated only', async () => {
  await resetActor(db);
  const functions = (await db.query("SELECT p.oid::regprocedure::text AS signature, p.prosecdef, p.proconfig, r.rolname "
    + "FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner "
    + "WHERE n.nspname='marketplace_sec' AND p.proname IN ('phase9_edition_choices','phase9_edition_legacy_choices','phase9_edition_legacy_select_candidate')")).rows;
  assert.equal(functions.length, 3);
  for (const fn of functions) {
    assert.equal(fn.rolname, 'postgres');
    assert.equal(fn.prosecdef, true);
    assert.ok(fn.proconfig.some(value => value.startsWith('search_path=')));
    for (const role of ['anon', 'authenticated', 'service_role']) {
      assert.equal(await scalar(db, `SELECT has_function_privilege('${role}','${fn.signature}','EXECUTE')`), false);
    }
  }
  for (const signature of ['public.phase9_owner_candidate_edition_choices_v1(uuid,uuid)',
    'public.phase9_select_candidate_edition_v1(uuid,uuid,integer,integer,integer,text,integer,uuid,uuid,text,uuid)']) {
    assert.equal(await scalar(db, `SELECT has_function_privilege('authenticated','${signature}','EXECUTE')`), true);
    for (const role of ['anon', 'service_role']) {
      assert.equal(await scalar(db, `SELECT has_function_privilege('${role}','${signature}','EXECUTE')`), false);
    }
  }
});
test('new-format replay after a newer choice cannot claim current confirmation', async () => {
  const f = await confirmedSuggestion(), current = await scalar(db, readSql(f));
  const next = await scalar(db, selectSql(f, current, f.selectionId, { source: 'current_suggestion' }));
  const replay = await scalar(db, f.command);
  assert.equal(replay.selection.confirmedByOwner, false);
  assert.equal(replay.metadataRevision, f.selected.metadataRevision);
  assert.equal((await scalar(db, readSql(f))).selection.selectionId, next.selection.selectionId);
});
for (const source of ['current_suggestion', 'edition_option']) {
  test(source + ': resumed choice saves and Adds the coherent edition after expiry', async () => {
    let f, selling, selected;
    if (source === 'current_suggestion') {
      f = await confirmedSuggestion(); selling = f.selling; selected = f.selected;
      await seedOptions(db, f);
    } else {
      f = await seedCard(db); selling = await reviewValue(db, f); await withoutReview(f);
      const saved = await seedOptions(db, f);
      selected = await scalar(db, selectSql(f, saved.choices, saved.rows[0].optionId));
    }
    await expire(db, f);
    const choices = await scalar(db, readSql(f));
    assert.equal(choices.selection.confirmedByOwner, true);
    const m = choices.selection.snapshot;
    const detail = await scalar(db, "SELECT public.phase9_owner_candidate_detail_v2('" + f.sessionId + "','" + f.candidateId + "')");
    const batch = await scalar(db, "SELECT public.phase9_owner_batch_review_v1('" + f.sessionId + "')");
    assert.equal(detail.metadata.selectionId, selected.selection.selectionId);
    assert.equal(batch.items[0].metadataSummary.selectionId, selected.selection.selectionId);
    assert.equal(detail.review.value, null);
    const review = { ...selling, originalTitle: m.title, authors: m.authors, originalLanguage: m.language, script: m.script,
      quantity: 4, priceMinor: 0, shelfLocation: 'A2', notes: { publicNote: null, internalNote: 'latest selling note' },
      originalFieldConfirmation: { title: true, authors: m.authors.map(() => true) },
      metadataChoice: { mode: 'edition_option', selectionId: selected.selection.selectionId } };
    await saveReview(db, f, review);
    const result = await scalar(db, await currentCommitSql(db, f));
    await resetActor(db);
    const item = await inventory(db, result.inventoryId);
    assert.equal(item.title, m.title); assert.deepEqual(item.authors, m.authors);
    assert.equal(item.cover_url, m.coverReference); assert.equal(item.publisher, m.publisher);
    assert.equal(item.selling_price_minor, 0); assert.equal(item.quantity_total, 4);
    assert.equal(item.shelf_location, 'A2'); assert.equal(item.internal_notes, 'latest selling note');
    const state = await optionsTruth(db, f);
    assert.deepEqual(state.options, []); assert.equal(state.selected_option_snapshot.title, m.title);
  });
}
test('validated-ISBN automatic choice remains legacy selected without Owner-confirmed flag', async () => {
  const f = await originalSelection(db, await seedCard(db));
  const choices = await scalar(db, readSql(f));
  assert.equal(choices.selection.confirmedByOwner, false);
  await saveReview(db, f);
  assert.equal((await scalar(db, await currentCommitSql(db, f))).outcome, 'committed_private');
});
test('manual review invalidates held confirmation and remains independently Add-ready', async () => {
  const f = await chosenCard(db);
  await saveReview(db, f, { ...await reviewValue(db, f), metadataChoice: { mode: 'manual', selectionId: null } });
  assert.equal((await scalar(db, readSql(f))).selection, null);
  // Existing M69 identity invalidation clears readiness; read current versions before canonical resave.
  assert.equal((await candidate(f)).review_ready, false);
  await assert.rejects(scalar(db, await currentCommitSql(db, f)), /P9_STATE_CONFLICT/);
  await saveReview(db, f);
  assert.equal((await scalar(db, await currentCommitSql(db, f))).outcome, 'committed_private');
});
test('a card without any suggestion still returns null selection and no authority', async () => {
  const f = await seedCard(db);
  assert.equal((await scalar(db, readSql(f))).selection, null);
});
test('forward migration preserves a real pre-M70 held choice, receipt and warmed reader', async () => {
  const f = upgradeFixture;
  await setActor(db, f.ownerId);
  const read = await scalar(db, readSql(f)), replay = await scalar(db, f.command);
  assert.equal(read.selection.confirmedByOwner, true);
  assert.equal(replay.selection.confirmedByOwner, true);
  assert.equal(replay.selection.selectionId, f.selected.selection.selectionId);
  assert.equal(replay.metadataRevision, f.selected.metadataRevision);
  await resetActor(db);
  const stored = await scalar(db, "SELECT canonical_response FROM public.phase9_idempotency_keys WHERE actor_or_service='"
    + f.ownerId + "' AND operation='EP_SELECT_V1'");
  assert.equal(stored.selection.confirmedByOwner, undefined);
});
