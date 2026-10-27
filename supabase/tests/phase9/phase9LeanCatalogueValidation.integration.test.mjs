// 02b §§4.6/5/6.1/11/12/14 OQ2: facts-only, ISBN and discovery boundary.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { blockIsbn, createLeanDatabase, hideEdition, installSyntheticProvider,
  requireLean, resetSyntheticProvider } from './leanCatalogueFixture.mjs';
import { add, bytes, catalogueBytes, enableOL, facts, labelledCard, legacyCard, linked,
  olCard, resetActor, scalar, seedIncumbent, selectionBytes, unmatched } from './catalogueLinkFixture.mjs';
import { claimJob, row, seedAutomaticLineage, seedCard } from './editionPickerFixture.mjs';
let db, originalNote;
before(async () => {
  db = await createLeanDatabase();
  originalNote = (await db.query("SELECT to_jsonb(r)->>'shared_source_note' AS note FROM public.phase9_provider_registry r WHERE adapter_key='open_library'")).rows[0].note;
});
beforeEach(async () => {
  await resetActor(db);
  await db.exec('TRUNCATE public.stores,public.canonical_works,public.canonical_editions CASCADE');
  await resetSyntheticProvider(db);
  await enableOL(db);
  if (originalNote !== null) await db.query("UPDATE public.phase9_provider_registry SET shared_source_note=$1 WHERE adapter_key='open_library'", [originalNote]);
  if (await scalar(db, "SELECT to_regclass('marketplace_sec.phase9_catalogue_isbn_blocklist') IS NOT NULL"))
    await db.exec('TRUNCATE marketplace_sec.phase9_catalogue_isbn_blocklist');
});
after(async () => { await db?.close(); });
const isbnSignature = 'marketplace_sec.phase9_catalogue_isbn_v1(text,text)';

const validatorSignature = 'marketplace_sec.phase9_catalogue_provider_ids_valid_v1(text,text,text,text,text,jsonb)';
async function validate(overrides = {}) {
  const input = { adapter: 'open_library', record: 'OL100M', work: 'OL7W',
    book: 'https://openlibrary.org/books/OL100M', cover: 'https://covers.openlibrary.org/b/id/123-M.jpg',
    completion: null, ...overrides };
  await resetActor(db);
  const rows = (await db.query('SELECT * FROM marketplace_sec.phase9_catalogue_provider_ids_valid_v1($1,$2,$3,$4,$5,$6::jsonb)',
    [input.adapter, input.record, input.work, input.book, input.cover,
      input.completion === null ? null : JSON.stringify(input.completion)])).rows;
  assert.equal(rows.length, 1); return rows[0];
}
for (const kind of ['record', 'work']) test('AC7-23: facts validator refuses oversized numeric OL ' + kind + ' ID', async () => {
  await requireLean(db, validatorSignature);
  const id = 'OL' + '1'.repeat(254) + (kind === 'record' ? 'M' : 'W');
  const result = await validate({ [kind]: id, book: null });
  assert.equal(result.valid, false, '02b §3.1: provider IDs remain bounded to 256 characters');
});
async function localFixture(overrides = {}) {
  const m = facts(overrides), t = await seedIncumbent(db, m);
  const f = await seedCard(db, { isbn: m.isbn13 ?? m.isbn10, language: m.language,
    review: { originalTitle: m.title, authors: m.authors, originalLanguage: m.language } });
  await resetActor(db);
  await db.query('UPDATE public.image_extraction_candidates SET observed_title=$1,observed_authors=$2 WHERE id=$3',
    [m.title, m.authors, f.candidateId]);
  return { ...f, target: t, facts: m };
}
async function localMatch(f) {
  await resetActor(db);
  return (await db.query('SELECT marketplace_sec.phase9_edition_local_match(c) AS edition FROM public.image_extraction_candidates c WHERE id=$1',
    [f.candidateId])).rows[0].edition;
}
async function automaticMatch(f) {
  const { jobId } = await seedAutomaticLineage(db, f), sql = await claimJob(db, f, jobId);
  return (await scalar(db, sql)).localCanonicalEditionId;
}

test('AC7-3/OQ2: blocklist starts empty and ISBN policy reader is STABLE', async () => {
  await requireLean(db, 'marketplace_sec.phase9_catalogue_isbn_blocklist');
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM marketplace_sec.phase9_catalogue_isbn_blocklist'), 0);
  await requireLean(db, isbnSignature);
  const [f] = (await db.query('SELECT provolatile,prosecdef FROM pg_proc WHERE oid=$1::regprocedure', [isbnSignature])).rows;
  assert.deepEqual(f, { provolatile: 's', prosecdef: true });
});

for (const [label, raw10, raw13, admitted, compact10, compact13] of [
  ['compact pair', '0306406152', '9780306406157', true, '0306406152', '9780306406157'],
  ['hyphen/space pair', '0-306 40615-2', '978-0-306-40615-7', true, '0306406152', '9780306406157'],
  ['lowercase check digit', '0 547-92822 x', null, true, '054792822X', '9780547928227'],
  ['13 only', null, '9780306406157', true, null, '9780306406157'],
  ['neither', null, null, true, null, null],
  ['bad 10 checksum', '0306406153', null, false],
  ['bad 13 checksum', null, '9780306406158', false],
  ['nonbook prefix', null, '4006381333931', false],
  ['disagreeing valid pair', '054792822X', '9780306406157', false],
  ['placeholder', null, '0000000000000', false],
  ['blank supplied ISBN', '', null, false],
]) test('AC7-3: shared ISBN policy handles ' + label, async () => {
  await requireLean(db, isbnSignature);
  const result = (await db.query('SELECT * FROM marketplace_sec.phase9_catalogue_isbn_v1($1,$2)', [raw10, raw13])).rows;
  assert.equal(result.length, 1); assert.equal(result[0].admitted, admitted);
  if (admitted) assert.deepEqual([result[0].isbn10, result[0].isbn13], [compact10, compact13]);
});

test('AC7-3: Add stores compact ISBNs and creates the provider tuple/source', async () => {
  await requireLean(db);
  const f = await legacyCard(db, { isbn10: '0-306-40615-2', isbn13: '978-0-306-40615-7' });
  const { item } = await add(db, f); linked(item);
  const [e] = (await db.query('SELECT isbn_10,isbn_13 FROM public.canonical_editions WHERE id=$1', [item.canonical_edition_id])).rows;
  assert.deepEqual(e, { isbn_10: '0306406152', isbn_13: '9780306406157' });
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.canonical_provider_ids'), 1);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.book_metadata_sources'), 1);
});

for (const changes of [{ isbn10: '054792822X' }, { isbn10: null, isbn13: '0000000000000' }])
  test('AC7-3: malformed/bad-pair Add skips every catalogue write: ' + JSON.stringify(changes), async () => {
    await requireLean(db);
    const f = await legacyCard(db, changes), before = await catalogueBytes(db), chosen = await selectionBytes(db, f);
    unmatched((await add(db, f)).item);
    assert.deepEqual(await catalogueBytes(db), before); assert.equal(await selectionBytes(db, f), chosen);
    assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.canonical_provider_ids'), 0);
    assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.book_metadata_sources'), 0);
  });

for (const tenOnly of [false, true]) test('AC7-3/OQ2: blocked ' + (tenOnly ? 'converted ISBN-10' : 'ISBN-13') + ' skips a valid provider record', async () => {
  await requireLean(db, isbnSignature);
  const f = await olCard(db, tenOnly ? { isbn13: null } : {}), chosen = await selectionBytes(db, f);
  await blockIsbn(db, '9780306406157');
  const policy = (await db.query('SELECT * FROM marketplace_sec.phase9_catalogue_isbn_v1($1,$2)', [f.facts.isbn10, f.facts.isbn13])).rows[0];
  assert.equal(policy.admitted, false);
  const before = await catalogueBytes(db); unmatched((await add(db, f)).item);
  assert.deepEqual(await catalogueBytes(db), before); assert.equal(await selectionBytes(db, f), chosen);
  for (const table of ['canonical_provider_ids', 'book_metadata_sources']) assert.equal(await scalar(db,
    'SELECT count(*)::int FROM public.' + table), 0, 'valid provider ID cannot bypass whole-record ISBN block');
});

for (const mode of ['hidden', 'blocked', 'bad pair']) test('AC7-3/6: actual M67 discovery and automatic job context exclude ' + mode, async () => {
  await requireLean(db);
  const f = await localFixture(); assert.equal(await localMatch(f), f.target.editionId);
  if (mode === 'hidden') await hideEdition(db, f.target.editionId);
  if (mode === 'blocked') await blockIsbn(db, f.facts.isbn13);
  if (mode === 'bad pair') await db.query('UPDATE public.canonical_editions SET isbn_10=$1 WHERE id=$2', ['054792822X', f.target.editionId]);
  assert.equal(await localMatch(f), null, 'the real shared M67 matcher refuses the record');
  assert.equal(await automaticMatch(f), null, 'real M67/M38 job context passes no rejected local ID to the worker');
});

test('AC7-3: compact ISBN discovery still resolves through actual M67 and job context', async () => {
  await requireLean(db);
  const f = await localFixture();
  await db.query('UPDATE public.image_extraction_candidates SET observed_isbn_clue=$1 WHERE id=$2', ['978-0-306-40615-7', f.candidateId]);
  assert.equal(await localMatch(f), f.target.editionId); assert.equal(await automaticMatch(f), f.target.editionId);
});

test('AC7-6: hidden text-only edition cannot reenter local discovery through fallback', async () => {
  await requireLean(db);
  const f = await localFixture({ isbn10: null, isbn13: null });
  assert.equal(await localMatch(f), f.target.editionId);
  await hideEdition(db, f.target.editionId);
  assert.equal(await localMatch(f), null); assert.equal(await automaticMatch(f), null);
});

for (const [label, mutation] of [
  ['disabled', 'enabled=false'], ['storage only', 'matching_allowed=false'],
  ['no storage', 'storage_allowed=false'], ['not publicly displayable', 'public_display_allowed=false'],
  ['not metadata', "provider_kind='alias'"], ['missing source note', 'shared_source_note=NULL'],
]) test('AC7-10: new shared admission rejects ' + label + ' without shared effects', async () => {
  await requireLean(db, 'marketplace_sec.phase9_catalogue_shared_admitted_v1(text)');
  const f = await olCard(db); await resetActor(db);
  await db.exec("UPDATE public.phase9_provider_registry SET " + mutation + " WHERE adapter_key='open_library'");
  assert.equal(await scalar(db, "SELECT marketplace_sec.phase9_catalogue_shared_admitted_v1('open_library')"), false);
  const before = await catalogueBytes(db); unmatched((await add(db, f)).item);
  assert.deepEqual(await catalogueBytes(db), before);
  assert.equal(await bytes(db, 'canonical_provider_ids'), '[]'); assert.equal(await bytes(db, 'book_metadata_sources'), '[]');
});

for (const mutation of ["adapter_version='new-version'", 'policy_version=2'])
  test('AC7-10: Add rejects mismatched persisted provider/registry versions: ' + mutation, async () => {
    await requireLean(db);
    const f = await olCard(db); await resetActor(db);
    await db.exec("UPDATE public.phase9_provider_registry SET " + mutation + " WHERE adapter_key='open_library'");
    const before = await catalogueBytes(db); unmatched((await add(db, f)).item);
    assert.deepEqual(await catalogueBytes(db), before);
    assert.equal(await bytes(db, 'book_metadata_sources'), '[]');
  });

for (const label of ['G', 'MAN']) test('AC7-10: ' + label + ' Add stays private with the new catalogue core present', async () => {
  await requireLean(db);
  const f = await labelledCard(db, label), before = await catalogueBytes(db);
  unmatched((await add(db, f)).item); assert.deepEqual(await catalogueBytes(db), before);
  assert.equal(await bytes(db, 'canonical_provider_ids'), '[]'); assert.equal(await bytes(db, 'book_metadata_sources'), '[]');
});

test('AC7-10/21b: synthetic expiry-requiring provider remains outside production admission', async () => {
  await requireLean(db);
  const synthetic = await installSyntheticProvider(db);
  await db.query('UPDATE public.phase9_provider_registry SET revalidation_seconds=1,raw_retention_seconds=1 WHERE adapter_key=$1', [synthetic.adapterKey]);
  assert.equal((await db.query('SELECT marketplace_sec.phase9_catalogue_shared_admitted_v1($1) AS admitted', [synthetic.adapterKey])).rows[0].admitted, false);
  assert.equal(await scalar(db, "SELECT marketplace_sec.phase9_catalogue_shared_admitted_v1('google_books')"), false);
  assert.equal(await scalar(db, "SELECT marketplace_sec.phase9_catalogue_shared_admitted_v1('missing_provider')"), false);
});

test('AC7-23: facts-only OL validator accepts own edition IDs, URL, work and cover reference', async () => {
  await requireLean(db, validatorSignature);
  const result = await validate(); assert.equal(result.valid, true); assert.equal(result.cover_ref, '123');
  assert.equal((await validate({ work: null, book: null, cover: null })).valid, true, 'legacy Add can omit URL/work/cover');
});

for (const [label, overrides] of [
  ['wrong record grammar', { record: 'OL100W' }], ['wrong work grammar', { work: 'OL7M' }],
  ['zero record ID', { record: 'OL0M' }], ['foreign book', { book: 'https://example.test/books/OL100M' }],
  ['different book ID', { book: 'https://openlibrary.org/books/OL101M' }],
  ['book URL suffix', { book: 'https://openlibrary.org/books/OL100M?token=private' }],
  ['foreign cover', { cover: 'https://books.google.com/books/content?id=OL100M' }],
  ['zero cover', { cover: 'https://covers.openlibrary.org/b/id/0-M.jpg' }],
  ['unknown provider', { adapter: 'unknown_provider' }], ['null record', { record: null }],
  ['untrimmed record', { record: ' OL100M' }], ['oversize record', { record: 'M'.repeat(257) }],
]) test('AC7-23: facts validator refuses ' + label, async () => {
  await requireLean(db, validatorSignature); assert.equal((await validate(overrides)).valid, false);
});

test('AC7-23: facts-only Google validator retains ID/query and own-cover bindings', async () => {
  await requireLean(db, validatorSignature);
  const google = { adapter: 'google_books', record: 'fixture-ID_1', work: null,
    book: 'https://books.google.com/books?id=fixture-ID_1', cover: 'https://books.google.com/books/content?id=fixture-ID_1' };
  assert.equal((await validate(google)).valid, true);
  for (const overrides of [{ record: 'bad/id' }, { book: 'https://books.google.com/books?id=different' },
    { book: google.book + '&id=fixture-ID_1' }, { cover: 'https://books.google.com/books/content?id=different' },
    { cover: 'https://example.test/cover' }]) assert.equal((await validate({ ...google, ...overrides })).valid, false);
});

for (const completion of [{}, [], false, 'forged', { providerRole: 'primary', primaryAdapterKey: 'open_library',
  predecessorOutcome: null, queryKind: 'bibliographic', rows: [], terminalReceipt: null, receipts: [] }])
  test('AC7-23: every nonnull accounting argument is refused in facts-only 7a: ' + JSON.stringify(completion), async () => {
    await requireLean(db, validatorSignature);
    assert.equal((await validate({ completion })).valid, false);
    assert.equal((await validate({ record: null, work: null, book: null, cover: null, completion })).valid, false);
  });

test('AC7-23: facts-only 7a refuses realistic finalized M78 search and editions accounting', async () => {
  await requireLean(db, validatorSignature);
  const receipt = (callSequence, callStage) => ({ callSequence, callStage, status: 'finalized',
    egressStarted: true, retryable: false, normalizedOutcome: 'no_acceptable_match',
    logicalOutcome: 'no_acceptable_match', normalizedCandidate: null, matchEvidence: [] });
  const search = receipt(0, 'search'), editions = receipt(1, 'editions');
  const m = facts({ correlationId: randomUUID(), attemptId: randomUUID(), fetchedAt: new Date().toISOString() });
  const completion = { providerRole: 'primary', primaryAdapterKey: 'open_library', predecessorOutcome: null,
    queryKind: 'bibliographic', rows: [row(0, { googleBooksUrl: 'https://openlibrary.org/books/OL100M', metadata: m })],
    terminalReceipt: editions, receipts: [search, editions] };
  assert.equal((await validate()).valid, true, 'the same facts remain valid without accounting input');
  assert.equal((await validate({ completion })).valid, false, 'nonnull accounting input refuses even with valid facts');
  assert.equal((await validate({ record: null, work: null, book: null, cover: null, completion })).valid,
    false, 'the realistic accounting-only mode remains unavailable in 7a');
});
