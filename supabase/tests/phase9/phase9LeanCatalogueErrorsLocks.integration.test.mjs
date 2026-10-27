// 02b §§1/6.1/6.2/11/12 AC7-14/20/22: Add rollback and fixed lock vectors.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { createLeanDatabase, requireLean } from './leanCatalogueFixture.mjs';
import { add, catalogueBytes, currentCommitSql, effects, olCard, resetActor,
  scalar, selectionBytes, setActor, unmatched } from './catalogueLinkFixture.mjs';
let db;
before(async () => { db = await createLeanDatabase(); });
beforeEach(async () => { await resetActor(db); await db.exec('TRUNCATE public.stores,public.canonical_works,public.canonical_editions CASCADE'); });
after(async () => { await db?.close(); });
const signature = 'marketplace_sec.phase9_catalogue_identity_lock_key_v1(text,jsonb)';

// Hand-fixed vectors computed 2026-10-26 with independent node:crypto over the
// displayed PostgreSQL jsonb::text serialization; signed big-endian int64.
for (const [kind, tuple, expected] of [
  ['work', ['catalogue sample', ['a. author', 'b. author']], '1261730660845302972'],
  ['isbn13', ['9780306406157'], '3695878281435915731'],
  ['isbn10', ['0306406152'], '3738317457280343681'],
  ['provider', ['open_library', 'edition', 'OL100M'], '-7293041302991827196'],
]) test('AC7-22: shared signed SHA-256 lock vector ' + kind, async () => {
  await requireLean(db, signature);
  const actual = (await db.query('SELECT marketplace_sec.phase9_catalogue_identity_lock_key_v1($1,$2::jsonb)::text AS key', [kind, tuple])).rows[0].key;
  assert.equal(actual, expected);
});
test('AC7-22: work input normalization has parity across case/order/spacing and preserves duplicates', async () => {
  await requireLean(db, signature);
  const key = async authors => (await db.query(`SELECT marketplace_sec.phase9_catalogue_identity_lock_key_v1('work',
    jsonb_build_array(btrim(marketplace_sec.phase9_metadata_normalized_text(' Catalogue  Sample ')),
    (SELECT jsonb_agg(k ORDER BY k COLLATE "C") FROM (SELECT btrim(marketplace_sec.phase9_metadata_normalized_text(a)) k
      FROM jsonb_array_elements_text($1::jsonb) a) normalized)))::text AS key`, [authors])).rows[0].key;
  assert.equal(await key([' B. AUTHOR ', 'a. author']), '1261730660845302972');
  assert.equal(await key(['A. Author', 'b. author']), '1261730660845302972');
  assert.notEqual(await key(['A. Author', 'b. author', 'b. author']), '1261730660845302972');
});
for (const [kind, tuple] of [
  ['unknown', ['value']], ['isbn13', ['978-0306406157']], ['isbn13', ['9780306406158']],
  ['isbn10', ['0306406153']], ['provider', ['open_library', 'author', 'OL100M']],
  ['provider', ['open_library', 'edition', ' OL100M']], ['work', ['Catalogue Sample', ['a. author']]],
  ['work', ['catalogue sample', ['b. author', 'a. author']]], ['work', []],
]) test('AC7-22: malformed/noncanonical lock tuple refuses ' + JSON.stringify([kind, tuple]), async () => {
  await requireLean(db, signature);
  const key = (await db.query('SELECT marketplace_sec.phase9_catalogue_identity_lock_key_v1($1,$2::jsonb) AS key', [kind, tuple])).rows[0].key;
  assert.equal(key, null, 'each malformed key kind is refused with SQL NULL');
});

test('AC7-14: maximum-size provider authors safely skip all shared writes but Add preserves private metadata', async () => {
  await requireLean(db);
  const authors = Array.from({ length: 20 }, (_, a) => Array.from({ length: 4 }, (_, c) =>
    createHash('sha256').update(`lean-catalogue-oversized:${a}:${c}`).digest('hex')).join(''));
  const f = await olCard(db, { authors }, { queryAuthors: authors.slice(0, 1) });
  const before = await catalogueBytes(db), chosen = await selectionBytes(db, f);
  const committed = await add(db, f); unmatched(committed.item);
  assert.deepEqual(committed.item.authors, authors);
  assert.deepEqual(await catalogueBytes(db), before); assert.equal(await selectionBytes(db, f), chosen);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.canonical_provider_ids'), 0);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.book_metadata_sources'), 0);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.canonical_work_stats'), 0);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.canonical_edition_stats'), 0);
});
for (const [label, raised] of [
  ['unrelated 54000', "RAISE EXCEPTION USING ERRCODE='54000', MESSAGE='unrelated program limit'"],
  ['unknown unique constraint', "RAISE unique_violation USING CONSTRAINT='lean_unrelated_constraint', MESSAGE='unrelated uniqueness'"],
  ['index-sized message with wrong index', "RAISE EXCEPTION USING ERRCODE='54000', MESSAGE='index row size 5000 exceeds maximum for index lean_unknown_index'"],
]) test('AC7-14: ' + label + ' propagates and rolls back the whole Add', async () => {
  await requireLean(db);
  const f = await olCard(db), before = await effects(db, f), canonicalBefore = await catalogueBytes(db), chosen = await selectionBytes(db, f);
  const command = await currentCommitSql(db, f);
  await resetActor(db);
  await db.exec(`CREATE FUNCTION public.lean_raise_error() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN ${raised}; RETURN NEW; END$$;
    CREATE TRIGGER lean_raise_error BEFORE INSERT ON public.canonical_editions FOR EACH ROW EXECUTE FUNCTION public.lean_raise_error()`);
  try {
    await setActor(db, f.ownerId);
    await assert.rejects(scalar(db, command), error => error.code === (label === 'unknown unique constraint' ? '23505' : '54000'));
  } finally { await resetActor(db); await db.exec('DROP TRIGGER lean_raise_error ON public.canonical_editions; DROP FUNCTION public.lean_raise_error()'); }
  assert.deepEqual(await effects(db, f), before); assert.equal(await selectionBytes(db, f), chosen);
  assert.deepEqual(await catalogueBytes(db), canonicalBefore, 'propagated errors roll back all canonical rows');
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.canonical_provider_ids'), 0);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.book_metadata_sources'), 0);
  assert.equal(await scalar(db, 'SELECT coalesce(sum(times_added),0)::int FROM public.canonical_edition_stats'), 0);
});
