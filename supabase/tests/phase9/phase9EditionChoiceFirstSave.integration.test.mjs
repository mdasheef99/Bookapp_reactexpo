// Owner M82 brief (2026-10-26); picker SDD §§5-8/11; slice 6 SDD §§3/6/10.
// Real review/ISBN/select/Add RPCs, synthetic OL lineage, no provider HTTP.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { migrationPath, resetActor, scalar, setActor } from './databaseHarness.mjs';
import { add, candidate, completeOL, createCatalogueDatabase, linked, M82, olOperation } from './catalogueLinkFixture.mjs';
import { readSql, seedCard, selectSql } from './editionPickerFixture.mjs';
import { saveReview } from './editionPickerCommitFixture.mjs';
import { rpc } from './editionOptionsCompletionFixture.mjs';

const skipM82 = process.env.PHASE9_SKIP_M82 === '1'; // Same assertions; T1/T9 must be RED.
const signature = 'marketplace_sec.phase9_edition_identity_change()';
const removals = ['owner_removed_from_scan', 'skipped_false_detection'];
let db, catalogBefore, catalogAfter, functionBefore, triggerBefore;
const body = file => fs.readFileSync(migrationPath(file), 'utf8').replaceAll('\r\n', '\n')
  .match(/CREATE OR REPLACE FUNCTION marketplace_sec\.phase9_edition_identity_change\(\)[\s\S]*?AS \$\$([\s\S]*?)\$\$;/)[1];

async function catalog() {
  // OIDs/definitions/ACLs for every other object, not just the named trigger.
  const tables = ['pg_proc', 'pg_class', 'pg_attribute', 'pg_attrdef', 'pg_constraint',
    'pg_trigger', 'pg_policy', 'pg_index', 'pg_namespace', 'pg_type', 'pg_enum', 'pg_default_acl'];
  const result = {};
  for (const table of tables) result[table] = await scalar(db, `SELECT md5(coalesce(
    jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]')::text) FROM pg_catalog.${table} t`
    + (table === 'pg_proc' ? ` WHERE oid<>'${signature}'::regprocedure` : ''));
  return result;
}
const functionRow = () => scalar(db, `SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE oid='${signature}'::regprocedure`);
const trigger = () => scalar(db, `SELECT pg_get_triggerdef(oid) FROM pg_trigger
  WHERE tgrelid='public.image_extraction_candidates'::regclass AND tgname='phase9_edition_identity_change'`);

before(async () => {
  const nativePort = process.env.PHASE9_FIRST_SAVE_NATIVE_PORT;
  if (nativePort) {
    assert.match(nativePort, /^\d+$/);
    const database = process.env.PHASE9_FIRST_SAVE_NATIVE_DATABASE;
    assert.match(database, /^bookconnect_u8b_\d+81$/); // Disposable runner clone only.
    const { Client } = await import('pg');
    const client = new Client({ host: '127.0.0.1', port: Number(nativePort), database, user: 'postgres' });
    await client.connect();
    db = {
      // Fixture RPC arrays are jsonb; node-postgres otherwise encodes them as PG arrays.
      query: (sql, values = []) => client.query(sql, values.map(value =>
        /^SELECT public\./.test(sql) && Array.isArray(value) ? JSON.stringify(value) : value)),
      exec: sql => client.query(sql), close: () => client.end(),
    };
  } else db = await createCatalogueDatabase({ deferM82: true });
  catalogBefore = await catalog(); functionBefore = await functionRow(); triggerBefore = await trigger();
  if (!skipM82) await db.exec(fs.readFileSync(migrationPath(M82), 'utf8'));
  catalogAfter = await catalog();
});
after(async () => { await db?.close(); });

async function state(f) {
  await resetActor(db);
  return (await db.query('SELECT * FROM public.phase9_candidate_edition_state WHERE candidate_id=$1', [f.candidateId])).rows[0];
}
async function isbn(f, value) {
  const c = await candidate(db, f);
  await setActor(db, f.ownerId);
  return rpc(db, 'phase9_set_candidate_isbn_v1', [f.sessionId, f.candidateId,
    randomUUID(), randomUUID(), c.version, value]);
}
async function chosen(typed = true) {
  const f = await seedCard(db);
  await resetActor(db);
  // A real first-save card has no saved review. Select leaves that NULL intact.
  await db.query(`UPDATE public.image_extraction_candidates SET state='needs_review',
    review_disposition=NULL,owner_review_snapshot=NULL,review_ready=false,review_version=NULL WHERE id=$1`, [f.candidateId]);
  if (typed) await isbn(f, '9780306406157');
  const operation = await olOperation(db, typed ? {} : { title: 'THE FIXTURE BOOK', authors: ['FIXTURE AUTHOR'] }, false, false, f);
  const option = await completeOL(db, operation);
  await setActor(db, f.ownerId);
  await scalar(db, selectSql(f, await scalar(db, readSql(f)), option.optionId));
  const held = await state(f), c = await candidate(db, f), m = held.selected_option_snapshot;
  assert.equal(c.state, 'needs_review'); assert.equal(c.review_disposition, null);
  assert.equal(c.owner_review_snapshot, null);
  assert.equal(c.owner_isbn13, typed ? '9780306406157' : null);
  assert.notEqual(c.observed_title, m.title);
  assert.notDeepEqual(c.observed_authors, m.authors);
  assert.ok(held.selection_id); assert.equal(held.options.length, 1);
  const review = { ...f.review, originalTitle: m.title, authors: m.authors,
    originalLanguage: m.language, script: m.script,
    originalFieldConfirmation: { title: true, authors: m.authors.map(() => true) },
    metadataChoice: { mode: 'edition_option', selectionId: held.selection_id } };
  return { ...f, held, review };
}
async function firstSave(f) {
  await setActor(db, f.ownerId);
  await saveReview(db, f, f.review);
}
async function directSave(f, disposition = 'reviewed', observedTitle = null) {
  await resetActor(db);
  await db.query(`UPDATE public.image_extraction_candidates SET state='ready',review_disposition=$1,
    owner_review_snapshot=$2,observed_title=coalesce($3,observed_title) WHERE id=$4`,
  [disposition, { value: f.review, confirmed_title: { value: f.review.originalTitle }, confirmed_authors: f.review.authors }, observedTitle, f.candidateId]);
}
async function retained(f, typed = true) {
  const c = await candidate(db, f);
  assert.equal(c.owner_isbn13, typed ? '9780306406157' : null, 'chosen owner ISBN must survive the first review save');
  assert.deepEqual(c.owner_review_snapshot.value.metadataChoice, f.review.metadataChoice);
  assert.deepEqual(await state(f), f.held, 'all edition state, including options and source lineage, must survive unchanged');
}
async function cleared(f) {
  const s = await state(f);
  assert.equal(s.request_generation, f.held.request_generation + 1);
  assert.deepEqual(s.options, []); assert.equal(s.options_version, f.held.options_version);
  for (const field of ['request_id', 'source_lookup_id', 'source_attempt_id', 'source_fetched_at',
    'options_expires_at', 'selection_id', 'selected_source', 'selected_source_id',
    'selected_option_snapshot', 'selected_at', 'selected_by']) assert.equal(s[field], null, field);
  return candidate(db, f);
}

test('T1: first review RPC preserves typed ISBN and the complete chosen edition state', async () => {
  const f = await chosen(); await firstSave(f); await retained(f);
  const c = await candidate(db, f);
  assert.equal(c.state, 'ready'); assert.equal(c.review_disposition, 'reviewed'); assert.equal(c.review_ready, true);
});
test('T2: first review without a typed ISBN still preserves the chosen edition', async () => {
  const f = await chosen(false); await firstSave(f); await retained(f, false);
});
for (const disposition of removals) test(`T3: transition into ${disposition} still clears the edition`, async () => {
  const f = await chosen(); await directSave(f, disposition);
  const c = await cleared(f);
  assert.equal(c.owner_isbn13, null);
  assert.deepEqual(c.owner_review_snapshot.value.metadataChoice, { mode: 'manual', selectionId: null });
});
test('T4: stale edition_option with a real title/author edit resets ISBN and edition state', async () => {
  const f = await chosen();
  f.review = { ...f.review, originalTitle: 'Owner edited title', authors: ['Edited Author'],
    originalFieldConfirmation: { title: true, authors: [true] } };
  await directSave(f);
  const c = await cleared(f);
  assert.equal(c.owner_isbn13, null);
  assert.deepEqual(c.owner_review_snapshot.value.metadataChoice, { mode: 'manual', selectionId: null });
});
test('T5: observed title changing alongside an otherwise coherent review is not exempt', async () => {
  const f = await chosen(); await directSave(f, 'reviewed', 'Changed scan title');
  const c = await cleared(f);
  assert.equal(c.owner_isbn13, null);
  assert.deepEqual(c.owner_review_snapshot.value.metadataChoice, { mode: 'manual', selectionId: null });
});
test('T6: owner ISBN command still resets a previously selected edition', async () => {
  const f = await chosen(); await isbn(f, '9780140449136');
  assert.equal((await cleared(f)).owner_isbn13, '9780140449136');
});
for (const disposition of removals) test(`T7: an already ${disposition} row retains an otherwise exempt choice`, async () => {
  const f = await chosen();
  await resetActor(db);
  await db.query('UPDATE public.image_extraction_candidates SET review_disposition=$1 WHERE id=$2', [disposition, f.candidateId]);
  // Synthetic legacy state, not a claim that removed cards can select through RPC.
  const columns = Object.keys(f.held).filter(k => !['candidate_id', 'session_id', 'store_id'].includes(k));
  await db.query(`UPDATE public.phase9_candidate_edition_state s SET (${columns.join(',')})=
    (SELECT ${columns.join(',')} FROM jsonb_populate_record(NULL::public.phase9_candidate_edition_state,$1::jsonb))
    WHERE candidate_id=$2`, [JSON.stringify(f.held), f.candidateId]);
  // Keep state AND disposition unchanged, as the M81 exemption required.
  await db.query('UPDATE public.image_extraction_candidates SET owner_review_snapshot=$1 WHERE id=$2',
    [{ value: f.review }, f.candidateId]);
  await retained(f);
});
test('T8: exact private function contract, unchanged M78 trigger and no other catalog changes', async () => {
  await resetActor(db);
  assert.deepEqual(catalogAfter, catalogBefore);
  assert.deepEqual(await functionRow(), functionBefore);
  assert.equal(await trigger(), triggerBefore);
  const m78 = fs.readFileSync(migrationPath('20261022000078_marketplace_phase9_owner_isbn_edition_lookup.sql'), 'utf8');
  const expectedTrigger = m78.match(/CREATE TRIGGER phase9_edition_identity_change[\s\S]*?;/)[0].replace(/\s+/g, ' ').replace('();', '()');
  assert.equal((await trigger()).replace(/\s+/g, ''), expectedTrigger.replace(/\s+/g, ''));
  const p = (await db.query(`SELECT r.rolname,p.prosecdef,p.proconfig,p.prosrc FROM pg_proc p
    JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid=$1::regprocedure`, [signature])).rows[0];
  assert.equal(p.rolname, 'postgres'); assert.equal(p.prosecdef, true);
  assert.deepEqual(p.proconfig, ['search_path=""']);
  assert.equal(skipM82 ? p.prosrc.replaceAll('\r\n', '\n') : p.prosrc,
    body(skipM82 ? '20261022000078_marketplace_phase9_owner_isbn_edition_lookup.sql' : M82));
  for (const role of ['anon', 'authenticated', 'service_role']) {
    assert.equal((await db.query("SELECT has_function_privilege($1,$2,'EXECUTE') AS allowed", [role, signature])).rows[0].allowed, false);
  }
  assert.equal(await scalar(db, `SELECT NOT EXISTS(SELECT 1 FROM pg_proc p,
    aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    WHERE p.oid='${signature}'::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE')`), true);
});
test('T9: first review save then real M81 Add retains OL catalogue links', async () => {
  const f = await chosen(); await firstSave(f);
  const { item } = await add(db, f);
  linked(item);
  const edition = (await db.query('SELECT * FROM public.canonical_editions WHERE id=$1', [item.canonical_edition_id])).rows[0];
  assert.equal(edition.work_id, item.canonical_work_id);
  assert.equal(edition.isbn_13, '9780306406157'); assert.equal(edition.title, f.review.originalTitle);
});
