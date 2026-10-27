// 02b §§4.1/5/6/11/12: Slice 7a identity only; synthetic disposable SQL facts.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { createLeanDatabase, installSyntheticProvider, providerOnlyFacts, requireLean, resetSyntheticProvider,
  sourcePolicy } from './leanCatalogueFixture.mjs';
import { add, bytes, catalogueBytes, enableOL, facts, linked, olCard, resetActor, scalar,
  seedIncumbent, selectionBytes, unmatched } from './catalogueLinkFixture.mjs';
let db;
before(async () => { db = await createLeanDatabase(); });
beforeEach(async () => {
  await resetActor(db);
  await db.exec('TRUNCATE public.stores,public.canonical_works,public.canonical_editions CASCADE');
  await resetSyntheticProvider(db);
  await enableOL(db);
});
after(async () => { await db?.close(); });
async function sharedBytes() {
  return [...await catalogueBytes(db), await bytes(db, 'canonical_provider_ids'),
    await bytes(db, 'book_metadata_sources')];
}
async function resolve(metadata, companion = null) {
  await resetActor(db);
  const policy = await sourcePolicy(db, metadata);
  const result = await db.query('SELECT * FROM marketplace_sec.phase9_catalogue_resolve_v1($1::jsonb,$2::jsonb,$3::jsonb)',
    [metadata, companion, policy]);
  assert.equal(result.rows.length, 1, 'AC7-20 core returns exactly one result');
  const pair = result.rows[0];
  assert.equal(pair.canonical_work_id === null, pair.canonical_edition_id === null, 'IDs form one coherent pair');
  if (pair.canonical_edition_id) assert.equal((await db.query(
    'SELECT work_id FROM public.canonical_editions WHERE id=$1', [pair.canonical_edition_id])).rows[0].work_id,
  pair.canonical_work_id);
  return pair;
}
function companion(m, workExternalId) {
  return { version: 'psr-catalogue-write-v1', optionId: randomUUID(), adapterKey: m.adapterKey,
    adapterVersion: m.adapterVersion, normalizerVersion: m.normalizerVersion,
    lookupId: m.correlationId, attemptId: m.attemptId, providerRecordId: m.providerRecordId,
    workExternalId, fetchedAt: m.fetchedAt, oclc: null, lccn: null };
}
// 02b §5: direct core fixtures need real lineage, including full fact overrides.
const coherent = (overrides = {}) => facts({ ...overrides, correlationId: randomUUID(), attemptId: randomUUID() });
const target = pair => ({ workId: pair.canonical_work_id, editionId: pair.canonical_edition_id });
async function insertId(t, overrides = {}) {
  const r = { adapter: 'open_library', kind: 'edition', external: 'OL700M', edition: t.editionId,
    work: null, ...overrides };
  return db.query(`INSERT INTO public.canonical_provider_ids(adapter_key,id_kind,external_id,
    canonical_edition_id,canonical_work_id) VALUES($1,$2,$3,$4,$5)`,
  [r.adapter, r.kind, r.external, r.edition, r.work]);
}

test('AC7-2: two stores without ISBN reuse one provider edition and preserve saved bytes', async () => {
  const a = await olCard(db, { isbn10: null, isbn13: null }), chosenA = await selectionBytes(db, a);
  const first = (await add(db, a)).item;
  linked(first); // Meaningful pre-M83 red: M81 cannot link this provider-only record.
  await requireLean(db, 'public.canonical_provider_ids');
  const canonicalBefore = await catalogueBytes(db), before = await sharedBytes(), b = await olCard(db, { isbn10: null, isbn13: null,
    publisher: 'Later source must not refresh the incumbent' });
  assert.notEqual(a.storeId, b.storeId);
  const chosenB = await selectionBytes(db, b), second = (await add(db, b)).item;
  linked(second);
  assert.deepEqual([second.canonical_work_id, second.canonical_edition_id],
    [first.canonical_work_id, first.canonical_edition_id]);
  assert.deepEqual(await sharedBytes(), before);
  assert.deepEqual(await catalogueBytes(db), canonicalBefore, 'provider-ID reuse preserves both canonical rows');
  assert.equal(await selectionBytes(db, a), chosenA); assert.equal(await selectionBytes(db, b), chosenB);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.canonical_provider_ids'), 1);
});

test('AC7-2d: provider tuple PK, reverse indexes, required fields and FK delete actions', async () => {
  await requireLean(db, 'public.canonical_provider_ids');
  const constraints = (await db.query(`SELECT contype,confdeltype,conkey,
    pg_get_constraintdef(oid) AS definition FROM pg_constraint
    WHERE conrelid='public.canonical_provider_ids'::regclass`)).rows;
  const pk = constraints.filter(c => c.contype === 'p');
  assert.equal(pk.length, 1); assert.match(pk[0].definition, /PRIMARY KEY \(adapter_key, id_kind, external_id\)/);
  for (const [table, action] of [['canonical_editions', 'CASCADE'], ['canonical_works', 'CASCADE'],
    ['phase9_provider_registry', null]]) {
    const fk = constraints.filter(c => c.contype === 'f' && c.definition.includes('REFERENCES ' + table + '('));
    assert.equal(fk.length, 1, table + ' has one real FK');
    assert.equal(fk[0].confdeltype, action === 'CASCADE' ? 'c' : 'a');
  }
  const indexes = (await db.query(`SELECT indexdef FROM pg_indexes WHERE schemaname='public'
    AND tablename='canonical_provider_ids'`)).rows.map(r => r.indexdef);
  for (const column of ['canonical_edition_id', 'canonical_work_id']) assert.ok(indexes.some(i =>
    i.includes('USING btree (' + column + ')') && i.includes('WHERE (' + column + ' IS NOT NULL)')), column + ' has a nonnull reverse index');
  const fields = (await db.query(`SELECT column_name,is_nullable,column_default FROM information_schema.columns
    WHERE table_schema='public' AND table_name='canonical_provider_ids'`)).rows;
  for (const column of ['adapter_key', 'id_kind', 'external_id', 'created_at'])
    assert.equal(fields.find(f => f.column_name === column)?.is_nullable, 'NO', column);
  assert.match(fields.find(f => f.column_name === 'created_at').column_default, /transaction_timestamp\(\)/);
});

for (const [label, changes, code] of [
  ['missing registry', { adapter: 'unregistered_provider' }, '23503'],
  ['missing edition', { edition: randomUUID() }, '23503'],
  ['missing work', { kind: 'work', edition: null, work: randomUUID() }, '23503'],
  ['no targets', { edition: null }, '23514'],
  ['both targets', { work: 'target' }, '23514'],
  ['wrong kind target', { kind: 'work' }, '23514'],
  ['unknown kind', { kind: 'author' }, '23514'],
  ['null key', { external: null }, '23502'],
  ['oversize key', { external: 'x'.repeat(257) }, '23514'],
  ['blank key', { external: ' ' }, '23514'],
  ['untrimmed key', { external: ' OL700M' }, '23514'],
  ['control key', { external: 'OL\n700M' }, '23514'],
  ['markup key', { external: '<OL700M>' }, '23514'],
  ['backslash key', { external: 'OL\\700M' }, '23514'],
  ['URL key', { external: 'https://example.test/OL700M' }, '23514'],
]) test('AC7-2d: provider-ID storage refuses ' + label, async () => {
  await requireLean(db, 'public.canonical_provider_ids');
  const t = await seedIncumbent(db), override = { ...changes };
  if (override.work === 'target') override.work = t.workId;
  const before = await sharedBytes();
  await assert.rejects(() => insertId(t, override), error => error.code === code);
  assert.deepEqual(await sharedBytes(), before);
});

test('AC7-2b/2d: bounded ID text is namespaced by provider and kind; target deletion cascades only IDs', async () => {
  await requireLean(db, 'public.canonical_provider_ids');
  const synthetic = await installSyntheticProvider(db), a = await seedIncumbent(db), b = await seedIncumbent(db,
    facts({ title: 'Other work', isbn10: null, isbn13: '9780547928227' }));
  for (const overrides of [{ external: 'same-id' }, { adapter: synthetic.adapterKey, external: 'same-id' },
    { kind: 'work', external: 'same-id', edition: null, work: a.workId }, { external: 'x'.repeat(256) }])
    await insertId(a, overrides);
  await assert.rejects(() => insertId(b, { external: 'same-id' }), error => error.code === '23505');
  await assert.rejects(() => db.query('DELETE FROM public.phase9_provider_registry WHERE adapter_key=$1',
    [synthetic.adapterKey]), error => error.code === '23503');
  await db.query('DELETE FROM public.canonical_editions WHERE id=$1', [a.editionId]);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.canonical_provider_ids'), 1);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.canonical_works'), 2);
  await db.query('DELETE FROM public.canonical_works WHERE id=$1', [a.workId]);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.canonical_provider_ids'), 0);
  assert.equal((await db.query('SELECT work_id FROM public.canonical_editions WHERE id=$1', [b.editionId])).rows[0].work_id, b.workId);
});

for (const hasIsbn of [true, false]) test('AC7-2b/21b: synthetic provider ' + (hasIsbn ? 'converges by ISBN' : 'keeps its no-ISBN edition separate'), async () => {
  await requireLean(db);
  const synthetic = await installSyntheticProvider(db), a = coherent(hasIsbn ? {} : providerOnlyFacts());
  const first = await resolve(a), before = await catalogueBytes(db);
  assert.ok(first.canonical_edition_id);
  const second = await resolve({ ...a, adapterKey: synthetic.adapterKey, providerRecordId: 'edition-1',
    publisher: 'Synthetic second provider press', coverReference: synthetic.facts.coverReference });
  assert.ok(second.canonical_edition_id);
  assert.equal(second.canonical_edition_id === first.canonical_edition_id, hasIsbn);
  if (hasIsbn) assert.deepEqual(await catalogueBytes(db), before, 'second source never enriches facts');
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.canonical_provider_ids'), 2);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.book_metadata_sources'), 2);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.canonical_editions'), hasIsbn ? 1 : 2);
  assert.equal(await scalar(db, "SELECT marketplace_sec.phase9_catalogue_shared_admitted_v1('synthetic_catalogue')"), false);
});

for (const conflict of ['ISBN versus edition tuple', 'edition title', 'edition authors', 'crossed ISBNs', 'orphan work', 'existing source target'])
  test('AC7-2c: Add atomically skips ' + conflict, async () => {
    await requireLean(db);
    const f = await olCard(db), a = await seedIncumbent(db, f.facts);
    if (conflict === 'ISBN versus edition tuple') {
      const b = await seedIncumbent(db, facts({ title: 'Other title', isbn10: null, isbn13: '9780547928227' }));
      await insertId(b, { external: f.facts.providerRecordId });
    } else if (conflict === 'edition title') await db.query('UPDATE public.canonical_editions SET title=$1 WHERE id=$2', ['Conflicting title', a.editionId]);
    else if (conflict === 'edition authors') await db.query('UPDATE public.canonical_editions SET authors=$1 WHERE id=$2', [['Other author'], a.editionId]);
    else if (conflict === 'crossed ISBNs') {
      await db.query('UPDATE public.canonical_editions SET isbn_10=NULL WHERE id=$1', [a.editionId]);
      const b = await seedIncumbent(db, facts({ title: 'Crossed target', isbn10: f.facts.isbn10, isbn13: '9780547928227' }));
      assert.notEqual(a.editionId, b.editionId);
    } else if (conflict === 'orphan work') await db.query('UPDATE public.canonical_editions SET work_id=NULL WHERE id=$1', [a.editionId]);
    else {
      const b = await seedIncumbent(db, facts({ title: 'Other source target', isbn10: null, isbn13: '9780547928227' }));
      await db.query(`INSERT INTO public.book_metadata_sources(id,provider,adapter_key,provider_book_id,canonical_edition_id,
        raw_payload,normalized_payload) VALUES($1,'open_library','open_library',$2,$3,'{}','{}')`,
      [randomUUID(), f.facts.providerRecordId, b.editionId]);
    }
    const before = await sharedBytes(), chosen = await selectionBytes(db, f);
    unmatched((await add(db, f)).item);
    assert.deepEqual(await sharedBytes(), before, 'no partial work/edition/provider-ID/source effects');
    assert.equal(await selectionBytes(db, f), chosen);
  });

test('AC7-2c: two ISBN editions of the same exact work safely share only the work', async () => {
  await requireLean(db);
  const a = await resolve(coherent()), canonicalBefore = await catalogueBytes(db);
  const b = await resolve(coherent({ providerRecordId: 'OL101M', isbn10: null, isbn13: '9780547928227' }));
  assert.ok(a.canonical_work_id); assert.equal(a.canonical_work_id, b.canonical_work_id);
  assert.notEqual(a.canonical_edition_id, b.canonical_edition_id);
  const canonicalAfter = await catalogueBytes(db);
  assert.equal(canonicalAfter[0], canonicalBefore[0], 'work reuse preserves every work byte');
  assert.deepEqual(JSON.parse(canonicalAfter[1]).filter(e => e.id === a.canonical_edition_id), JSON.parse(canonicalBefore[1]),
    'new edition creation preserves the existing edition');
});

for (const competing of [false, true]) test('§12: companion translation is refused ' + (competing ? 'with' : 'without') + ' a competing target', async () => {
  await requireLean(db);
  const original = coherent(), beforeOriginal = await sharedBytes();
  assert.deepEqual(await resolve(original, companion(original, 'OL700W')), { canonical_work_id: null, canonical_edition_id: null });
  assert.deepEqual(await sharedBytes(), beforeOriginal);
  const translated = coherent({ title: 'Le Livre', language: 'fr', providerRecordId: 'OL101M', isbn10: null, isbn13: '9780547928227' });
  if (competing) await seedIncumbent(db, { ...translated, isbn10: null, isbn13: null });
  const before = await sharedBytes();
  assert.deepEqual(await resolve(translated, companion(translated, 'OL700W')), { canonical_work_id: null, canonical_edition_id: null });
  assert.deepEqual(await sharedBytes(), before);
});

test('§12: companion refusal preserves an ISBN edition and competing provider-work tuple', async () => {
  await requireLean(db);
  const m = coherent(), first = await resolve(m), other = await seedIncumbent(db,
    facts({ title: 'Competing provider work', isbn10: null, isbn13: null }));
  await insertId(other, { kind: 'work', external: 'OL701W', edition: null, work: other.workId });
  const before = await sharedBytes();
  assert.deepEqual(await resolve(m, companion(m, 'OL701W')), { canonical_work_id: null, canonical_edition_id: null });
  assert.deepEqual(await sharedBytes(), before);
  assert.ok(target(first).editionId);
});

test('[baseline] AC7-2c/OQ3: source-backed provider-work conflict with NULL companion never reassigns an ISBN edition', async () => {
  await requireLean(db);
  const m = coherent(), first = await resolve(m), other = await seedIncumbent(db,
    facts({ title: 'Competing provider work', isbn10: null, isbn13: null }));
  await insertId(other, { kind: 'work', external: 'OL701W', edition: null, work: other.workId });
  const payload = (await db.query(`SELECT normalized_payload FROM public.book_metadata_sources
    WHERE adapter_key=$1 AND provider_book_id=$2`, [m.adapterKey, m.providerRecordId])).rows[0].normalized_payload;
  assert.equal(payload.version, 'psr-catalogue-facts-v1');
  assert.notEqual(other.workId, first.canonical_work_id);
  const reference = { ...m, providerRecordId: 'OL101M' };
  await db.query(`INSERT INTO public.book_metadata_sources(id,provider,adapter_key,provider_book_id,
    canonical_edition_id,normalized_payload) VALUES($1,$2,$2,$3,$4,$5)`,
  [randomUUID(), m.adapterKey, reference.providerRecordId, first.canonical_edition_id,
    { ...payload, providerRecordId: reference.providerRecordId, workExternalId: 'OL701W' }]);
  const before = await sharedBytes();
  assert.deepEqual(await resolve(reference, null), { canonical_work_id: null, canonical_edition_id: null });
  assert.deepEqual(await sharedBytes(), before, 'real source/tuple conflict preserves all shared bytes');
  assert.equal(await scalar(db, `SELECT canonical_work_id FROM public.canonical_provider_ids
    WHERE adapter_key='open_library' AND id_kind='work' AND external_id='OL701W'`), other.workId);
  // Same valid source and NULL companion resolve once only the conflicting tuple is removed.
  await db.exec("DELETE FROM public.canonical_provider_ids WHERE adapter_key='open_library' AND id_kind='work' AND external_id='OL701W'");
  assert.deepEqual(await resolve(reference, null), first, 'the work tuple conflict, not companion refusal, caused the skip');
});

test('AC7-20: denied policy and invalid pair return one NULL pair with no provisional work', async () => {
  await requireLean(db);
  const m = coherent(), policy = await sourcePolicy(db, m), before = await sharedBytes();
  const rows = (await db.query('SELECT * FROM marketplace_sec.phase9_catalogue_resolve_v1($1::jsonb,NULL,$2::jsonb)',
    [m, { ...policy, sharedAdmitted: false }])).rows;
  assert.deepEqual(rows, [{ canonical_work_id: null, canonical_edition_id: null }]);
  assert.deepEqual(await resolve({ ...m, isbn10: '054792822X' }), rows[0]);
  assert.deepEqual(await sharedBytes(), before);
});

test('AC7-21b: synthetic provider uses the unchanged generic increment helper', async () => {
  await requireLean(db, 'marketplace_sec.phase9_catalogue_increment_v1(uuid,uuid,integer,integer,integer)');
  const synthetic = await installSyntheticProvider(db);
  const pair = await resolve(coherent(synthetic.facts));
  assert.ok(pair.canonical_edition_id);
  await db.query('SELECT marketplace_sec.phase9_catalogue_increment_v1($1,$2,0,1,1)',
    [pair.canonical_work_id, pair.canonical_edition_id]);
  const counts = (await db.query('SELECT times_chosen::int,times_added::int FROM public.canonical_edition_stats WHERE canonical_edition_id=$1',
    [pair.canonical_edition_id])).rows;
  assert.deepEqual(counts, [{ times_chosen: 1, times_added: 1 }]);
  assert.equal(await scalar(db, 'SELECT coalesce(sum(times_searched),0)::int FROM public.canonical_work_stats'), 0);
});
