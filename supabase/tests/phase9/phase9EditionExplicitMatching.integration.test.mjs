// M76 / DOC-3 §5.2.1 / picker SDD §§3.1/4.1: disposable SQL proof, synthetic data only.
// M76_BASELINE=1 runs the same assertions against M65-M74 alone (expected RED for new rules).
// M77_BASELINE=1 runs them against M76 without M77 (expected RED for the 2026-10-17 variants).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test, before, after } from 'node:test';
import { migrationPath } from './databaseHarness.mjs';
import * as commit from './editionPickerCommitFixture.mjs';
import * as operation from './editionOptionsCompletionFixture.mjs';

const { metadata, row, seedCard, readSql, selectSql, resetActor, setActor } = commit;
const M76 = '20261016000076_marketplace_phase9_edition_explicit_matching.sql';
const M77 = '20261017000077_marketplace_phase9_edition_matching_variants.sql';
const baseline = process.env.M76_BASELINE === '1';
const m77Baseline = baseline || process.env.M77_BASELINE === '1';
const marker = 'bookconnect/edition-reasons-v1';
const shared = JSON.parse(fs.readFileSync(new URL('./explicitEditionMatchingCases.json', import.meta.url), 'utf8'));
let db;
async function scalar(sql, values = []) {
  const result = await db.query(sql, values);
  return Object.values(result.rows[0] ?? {})[0];
}
async function headers(value = marker) {
  await scalar("SELECT set_config('request.headers',$1,false)", [value === null ? '{}' : JSON.stringify({ 'x-client-info': value })]);
}
async function asPostgres(work) {
  const role = await scalar('SELECT current_user');
  await db.exec('RESET ROLE');
  try { return await work(); }
  finally { if (role !== 'postgres') await db.exec('SET ROLE ' + role); }
}
const normalized = value => value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
const queryText = (side, isbn = null) => JSON.stringify(['p9-metadata-lookup-v1', 'p9-bibliographic-normalizer-v1',
  'bibliographic', isbn, normalized(side.title), side.authors.map(normalized), side.language, []]);
const editionMetadata = side => ({ ...metadata, title: side.title, authors: side.authors, language: side.language,
  script: /^[ऀ-ॿ]/u.test(side.title) ? 'Deva' : 'Latn', isbn10: null, isbn13: null });
const eligible = (value, query) => asPostgres(() => scalar(
  'SELECT marketplace_sec.phase9_edition_option_eligible($1::jsonb,$2)', [JSON.stringify(value), query]));

before(async () => {
  db = await commit.createCommitDatabase();
  for (const file of [
    '20261008000070_marketplace_phase9_edition_picker_confirmation.sql',
    '20261010000071_marketplace_phase9_edition_picker_selection_eligibility.sql',
    '20261010000072_marketplace_phase9_edition_picker_superseded_jobs.sql',
    '20261011000073_marketplace_phase9_open_library_edition_options.sql',
    '20261012000074_marketplace_phase9_open_library_author_isolation.sql',
    ...(baseline ? [] : [M76]), ...(m77Baseline ? [] : [M77]),
    '20261022000078_marketplace_phase9_owner_isbn_edition_lookup.sql',
  ]) await db.exec(fs.readFileSync(migrationPath(file), 'utf8'));
});
after(async () => { await db?.close(); });

for (const c of shared.cases) test('shared explicit-option case: ' + c.name, async () => {
  assert.equal(await eligible(editionMetadata(c.result), queryText(c.query)), c.eligible);
});

test('exact-ISBN unknown-query-language exception is preserved', async () => {
  const value = { ...metadata, title: 'The Fixture Book' };
  const query = JSON.stringify(['p9-metadata-lookup-v1', 'p9-bibliographic-normalizer-v1', 'bibliographic',
    metadata.isbn13, 'the fixture book', ['fixture author'], 'und', []]);
  assert.equal(await eligible(value, query), true);
});

test('current-suggestion identity remains exact', async () => {
  const c = shared.cases.find(entry => entry.name === 'ampersand, spaced initials and accent');
  assert.equal(await asPostgres(() => scalar('SELECT marketplace_sec.phase9_edition_identity_compatible($1::jsonb,$2)',
    [JSON.stringify(editionMetadata(c.result)), queryText(c.query)])), false);
});

for (const [name, fields, expected] of [
  ['author typo', { authors: ['Fixture Authr'] }, 'author_differs'],
  ['different title', { title: 'Another Book' }, 'title_differs'],
  ['known other language', { language: 'fr' }, 'language_differs'],
  ['accent-only author difference is not an author reason', { authors: ['Fixture Authór'] }, 'identity_unverified'],
]) test('rejection reason uses the explicit comparison: ' + name, { skip: baseline }, async () => {
  const query = queryText({ title: 'The Fixture Book', authors: ['Fixture Author'], language: 'en' });
  const blocked = row(0, { eligibility: 'ineligible', metadata: { ...metadata, isbn10: null, isbn13: null, ...fields } });
  assert.equal(await asPostgres(() => scalar('SELECT marketplace_sec.phase9_edition_rejection_reason($1::jsonb,$2,$3::jsonb)',
    [JSON.stringify(blocked), query, '[]'])), expected);
});

test('opt-in reads add reasons; legacy reads keep the exact legacy shape', { skip: baseline }, async () => {
  const f = await seedCard(db);
  await headers(null);
  await commit.seedOptions(db, f, [row(0), row(1, { eligibility: 'ineligible',
    metadata: { ...metadata, isbn10: null, isbn13: null, authors: ['Wrong Author'] } })]);
  const legacy = await scalar(readSql(f));
  assert.equal(JSON.stringify(legacy).includes('rejectionReason'), false);
  await headers();
  const value = await scalar(readSql(f));
  assert.deepEqual(value.rows.map(entry => entry.rejectionReason), [null, 'author_differs']);
  await headers('bookconnect/edition-reasons-v3');
  assert.deepEqual(await scalar(readSql(f)), legacy);
  await headers(null);
});

test('worker-eligible variant completes, is selectable, saves and adds once', async () => {
  const f = await operation.seedOperation(db, { isbn: null });
  await operation.prepareCall(db, f); await operation.finalize(db, f);
  const result = operation.resultRows(f);
  // Leading-The title difference plus a Latin accent in the author (worker rule: eligible).
  result.rows[0].metadata = { ...result.rows[0].metadata, title: 'Fixture Book',
    authors: ['Fixture Authór', 'Second Author'], isbn10: null, isbn13: null, coverReference: null };
  if (baseline) { await assert.rejects(operation.complete(db, f, result), /P9_EDITION_ROWS_INVALID/u); return; }
  await operation.complete(db, f, result);
  await setActor(db, f.ownerId); await headers(null);
  const choices = await scalar(readSql(f));
  assert.equal(choices.rows[0].eligibility, 'eligible');
  const picked = await scalar(selectSql(f, choices, result.rows[0].optionId));
  assert.equal(picked.selection.optionId, result.rows[0].optionId);
  assert.equal(picked.selection.snapshot.title, 'Fixture Book');
  const review = await commit.reviewValue(db, f); await commit.saveReview(db, f, review);
  await resetActor(db); const beforeCount = await scalar('SELECT count(*)::int FROM public.store_inventory');
  await setActor(db, f.ownerId); const command = await commit.currentCommitSql(db, f);
  const added = await scalar(command); assert.deepEqual(await scalar(command), added);
  await resetActor(db);
  assert.equal(await scalar('SELECT count(*)::int FROM public.store_inventory'), beforeCount + 1);
  assert.deepEqual(await scalar('SELECT options FROM public.phase9_candidate_edition_state WHERE candidate_id=$1', [f.candidateId]), []);
});

test('completion still rejects a row falsely marked eligible (OCR typo author)', async () => {
  const f = await operation.seedOperation(db, { isbn: null });
  await operation.prepareCall(db, f); await operation.finalize(db, f);
  const result = operation.resultRows(f);
  result.rows[0].metadata = { ...result.rows[0].metadata, authors: ['Fixture Authr'], isbn10: null, isbn13: null };
  await assert.rejects(operation.complete(db, f, result), /P9_EDITION_ROWS_INVALID/u);
  await resetActor(db);
});

test('new helpers are immutable, empty-path and not client-executable', { skip: baseline }, async () => {
  for (const signature of ['phase9_edition_title_key(text,boolean)', 'phase9_edition_author_key(text)',
    'phase9_edition_explicit_query(jsonb,text)', 'phase9_edition_rejection_reason(jsonb,text,jsonb)',
    'phase9_edition_option_eligible(jsonb,text)', ...(m77Baseline ? [] : ['phase9_edition_author_middle_match(text,text)'])]) {
    const info = (await asPostgres(() => db.query("SELECT provolatile,proconfig,"
      + "has_function_privilege('authenticated',oid,'EXECUTE') AS a,has_function_privilege('anon',oid,'EXECUTE') AS b,"
      + "has_function_privilege('service_role',oid,'EXECUTE') AS c FROM pg_proc WHERE oid=$1::regprocedure",
    ['marketplace_sec.' + signature]))).rows[0];
    assert.equal(info.provolatile, 'i', signature); assert.deepEqual(info.proconfig, ['search_path=""'], signature);
    assert.deepEqual([info.a, info.b, info.c], [false, false, false], signature);
  }
});
