// 02a §5.2; 02b §§4.1/6.1–6.2/7.2: round-3 normalization, source identity and failures.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { createLeanDatabase, requireLean, sourcePolicy } from './leanCatalogueFixture.mjs';
import { add, automaticCard, bytes, canonicalCard, catalogueBytes, enableOL, facts, linked, olCard,
  resetActor, scalar, seedIncumbent, selectionBytes, unmatched } from './catalogueLinkFixture.mjs';

let db;
before(async () => { db = await createLeanDatabase(); });
beforeEach(async () => {
  await resetActor(db);
  await db.exec('TRUNCATE public.stores,public.canonical_works,public.canonical_editions CASCADE');
  await enableOL(db);
});
after(async () => { await db?.close(); });
const core = 'marketplace_sec.phase9_catalogue_resolve_v1(jsonb,jsonb,jsonb)';
const saved = 'marketplace_sec.phase9_catalogue_link_for_add_v1(uuid,uuid,uuid)';
const isbn = 'marketplace_sec.phase9_catalogue_isbn_v1(text,text)';
const definition = signature => scalar(db, `SELECT pg_get_functiondef('${signature}'::regprocedure)`);
async function resolve(m, companion = null) {
  const policy = await sourcePolicy(db, m);
  return (await db.query('SELECT * FROM marketplace_sec.phase9_catalogue_resolve_v1($1,$2,$3)',
    [m, companion, policy])).rows[0];
}
async function seedSource(m, target, workExternalId) {
  const fields = ['adapterKey', 'adapterVersion', 'schemaVersion', 'normalizerVersion', 'providerRecordId',
    'fetchedAt', 'title', 'subtitle', 'authors', 'publisher', 'publishedDate', 'language', 'script',
    'isbn10', 'isbn13', 'pageCount', 'categories', 'description', 'editionStatement', 'volume', 'format', 'series', 'coverReference'];
  const payload = Object.fromEntries(fields.map(k => [k, m[k]]));
  Object.assign(payload, { version: 'psr-catalogue-facts-v1', workExternalId, oclc: null, lccn: null,
    coverRef: '123', sourceRetentionNote: 'Synthetic normalized facts retained with attribution.' });
  await db.query(`INSERT INTO public.book_metadata_sources(id,provider,adapter_key,provider_book_id,
    canonical_edition_id,normalized_payload) VALUES($1,$2,$2,$3,$4,$5)`,
  [randomUUID(), m.adapterKey, m.providerRecordId, target.editionId, payload]);
}

for (const storedTitle of ['the hobbit', ' THE HOBBIT ']) test(
  'AC7-2c/19: new-ISBN Add reuses legacy display-author work with stored title ' + JSON.stringify(storedTitle), async () => {
    await requireLean(db);
    const m = facts({ title: 'The Hobbit', authors: ['J.R.R. Tolkien'], isbn10: null, isbn13: '9780547928227' });
    const target = await seedIncumbent(db, m, { displayKey: true });
    await db.query('UPDATE public.canonical_works SET title_normalized=$1 WHERE id=$2', [storedTitle, target.workId]);
    const before = await catalogueBytes(db);
    const f = await olCard(db, { ...m, providerRecordId: 'OL101M', isbn13: '9780306406157' });
    const chosen = await selectionBytes(db, f), { item } = await add(db, f); linked(item);
    assert.equal(item.canonical_work_id, target.workId, 'new ISBN must reuse the normalized legacy work identity');
    assert.notEqual(item.canonical_edition_id, target.editionId);
    assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.canonical_works'), 1, 'no duplicate normalized work');
    const after = await catalogueBytes(db);
    assert.equal(after[0], before[0], 'legacy work bytes are never repaired');
    assert.deepEqual(JSON.parse(after[1]).filter(e => e.id === target.editionId), JSON.parse(before[1]));
    assert.equal(await selectionBytes(db, f), chosen);
  });

for (const currentSuggestion of [false, true]) test(
  'AC7-2c/4/OQ3: display-key competing work refuses translated saved reference ' + currentSuggestion, async () => {
    await requireLean(db);
    const m = facts(), target = await seedIncumbent(db, m);
    await db.query("UPDATE public.canonical_works SET title_normalized='original work',primary_title='Original Work' WHERE id=$1", [target.workId]);
    await seedSource(m, target, 'OL700W');
    await db.query(`INSERT INTO public.canonical_provider_ids(adapter_key,id_kind,external_id,canonical_edition_id,canonical_work_id)
      VALUES('open_library','edition','OL100M',$1,NULL),('open_library','work','OL700W',NULL,$2)`, [target.editionId, target.workId]);
    await seedIncumbent(db, facts({ isbn10: null, isbn13: null }), { displayKey: true });
    const before = await catalogueBytes(db);
    const f = await automaticCard(db, m, { target: target.editionId, currentSuggestion });
    await resetActor(db);
    assert.equal(await scalar(db, 'SELECT coalesce(sum(times_chosen),0)::int FROM public.canonical_edition_stats'), 0,
      'normalized competing work must prevent chosen attribution at Select');
    unmatched((await add(db, f)).item);
    assert.deepEqual(await catalogueBytes(db), before, 'competing legacy work never permits grouping or repairs');
  });

for (const currentSuggestion of [false, true]) test(
  'AC7-2c/17: equal normalized work keys make saved canonical Add unlinked ' + currentSuggestion, async () => {
    await requireLean(db);
    const m = facts(), target = await seedIncumbent(db, m, { displayKey: true });
    await seedIncumbent(db, facts({ isbn10: null, isbn13: null }));
    const f = await canonicalCard(db, m, target, currentSuggestion);
    const before = await catalogueBytes(db), chosen = await selectionBytes(db, f);
    unmatched((await add(db, f)).item);
    assert.deepEqual(await catalogueBytes(db), before, 'ambiguous normalized work keys preserve every catalogue byte');
    assert.equal(await selectionBytes(db, f), chosen, 'ambiguous work identity never edits the saved choice');
  });

test('[baseline] AC7-18/19/OQ1: an unplanned ISBN winner on a legacy work keeps the atomic safe skip', async () => {
  const m = facts({ title: 'The Hobbit', authors: ['J.R.R. Tolkien'], isbn10: null, isbn13: '9780306406157' });
  const target = await seedIncumbent(db, m, { displayKey: true }), winner = randomUUID();
  await db.query("UPDATE public.canonical_works SET title_normalized='the hobbit' WHERE id=$1", [target.workId]);
  const f = await olCard(db, { ...m, providerRecordId: 'OL101M', isbn13: '9780547928227' }), before = await catalogueBytes(db);
  await resetActor(db);
  await db.exec(`CREATE FUNCTION public.lean_unplanned_winner() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.id<>'${winner}'::uuid THEN
      INSERT INTO public.canonical_editions(id,work_id,isbn_13,title,authors)
        VALUES('${winner}','${target.workId}',NEW.isbn_13,NEW.title,NEW.authors);
      RETURN NULL;
    END IF; RETURN NEW; END $$;
    CREATE TRIGGER lean_unplanned_winner BEFORE INSERT ON public.canonical_editions
      FOR EACH ROW EXECUTE FUNCTION public.lean_unplanned_winner()`);
  try {
    unmatched((await add(db, f)).item);
    assert.deepEqual(await catalogueBytes(db), before, 'unplanned winner cannot leave provisional catalogue writes');
  } finally {
    await resetActor(db);
    await db.exec('DROP TRIGGER lean_unplanned_winner ON public.canonical_editions; DROP FUNCTION public.lean_unplanned_winner()');
  }
});

for (const kind of ['source exact work', 'source translated work', 'supplied translated work']) test(
  'AC7-2c/OQ3: resolver persists a missing provider-work tuple from ' + kind, async () => {
    await requireLean(db);
    const m = facts({ correlationId: randomUUID(), attemptId: randomUUID() }), target = await seedIncumbent(db, m);
    if (kind !== 'source exact work') await db.query(`UPDATE public.canonical_works
      SET title_normalized='original work',primary_title='Original Work' WHERE id=$1`, [target.workId]);
    await seedSource(m, target, kind.startsWith('source') ? 'OL700W' : null);
    const before = await catalogueBytes(db), sourceBefore = await bytes(db, 'book_metadata_sources');
    const companion = kind.startsWith('supplied') ? { version: 'psr-catalogue-write-v1', optionId: randomUUID(),
      adapterKey: m.adapterKey, adapterVersion: m.adapterVersion, normalizerVersion: m.normalizerVersion,
      lookupId: m.correlationId, attemptId: m.attemptId, providerRecordId: m.providerRecordId,
      workExternalId: 'OL700W', fetchedAt: m.fetchedAt, oclc: null, lccn: null } : null;
    const idsBefore = await bytes(db, 'canonical_provider_ids');
    const pair = await resolve(m, companion);
    if (companion) {
      assert.deepEqual(pair, { canonical_work_id: null, canonical_edition_id: null });
      assert.deepEqual(await catalogueBytes(db), before);
      assert.equal(await bytes(db, 'book_metadata_sources'), sourceBefore);
      assert.equal(await bytes(db, 'canonical_provider_ids'), idsBefore);
      return;
    }
    assert.equal(pair.canonical_work_id, target.workId, 'missing source/supplied work tuple must be persisted before pair validation');
    assert.equal(pair.canonical_edition_id, target.editionId);
    assert.deepEqual((await db.query(`SELECT canonical_work_id FROM public.canonical_provider_ids
      WHERE adapter_key=$1 AND id_kind='work' AND external_id='OL700W'`, [m.adapterKey])).rows,
    [{ canonical_work_id: target.workId }]);
    assert.deepEqual(await catalogueBytes(db), before, 'resolving a tuple never edits incumbent canonical facts');
    assert.equal(await bytes(db, 'book_metadata_sources'), sourceBefore, 'first source is kept');
    const ids = await bytes(db, 'canonical_provider_ids');
    assert.deepEqual(await resolve(m, companion), pair, 'a retry resolves the same persisted tuple');
    assert.equal(await bytes(db, 'canonical_provider_ids'), ids);
  });

for (const code of ['42501', '42P01', '42883']) test(
  'AC7-6/14: local matcher propagates ISBN/blocklist dependency SQLSTATE ' + code, async () => {
    await requireLean(db);
    const f = await olCard(db); await seedIncumbent(db, f.facts);
    const real = await definition(isbn);
    await db.exec(real.replace(/AS \$function\$[\s\S]*?\$function\$/u,
      `AS $function$ BEGIN RAISE EXCEPTION USING ERRCODE='${code}',MESSAGE='synthetic ISBN dependency failure'; END $function$`));
    try {
      await assert.rejects(() => scalar(db, `SELECT marketplace_sec.phase9_edition_local_match(c)
        FROM public.image_extraction_candidates c WHERE id='${f.candidateId}'`),
      error => error.code === code, 'local matcher must propagate dependency SQLSTATE ' + code);
    } finally { await db.exec(real); }
  });

test('[baseline] AC7-6: local matcher retains its nondependency-error fallback', async () => {
  const f = await olCard(db); await seedIncumbent(db, f.facts);
  const real = await definition(isbn);
  await db.exec(real.replace(/AS \$function\$[\s\S]*?\$function\$/u,
    "AS $function$ BEGIN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='synthetic invalid input'; END $function$"));
  try {
    assert.equal(await scalar(db, `SELECT marketplace_sec.phase9_edition_local_match(c)
      FROM public.image_extraction_candidates c WHERE id='${f.candidateId}'`), null);
  } finally { await db.exec(real); }
});

// Force the saved block's P9C01 after its real advisory acquisitions. Observe
// the actual production fallback entry, without changing resolver behavior.
test('[baseline] AC7-17/22: aborted saved-ID phase releases its keys before the real resolver fallback', async () => {
  await requireLean(db);
  const m = facts(), target = await seedIncumbent(db, m), f = await automaticCard(db, m, { target: target.editionId });
  await resetActor(db);
  const before = await catalogueBytes(db), chosen = await selectionBytes(db, f);
  const realSaved = await definition(saved), realCore = await definition(core);
  const loop = 'LOOP PERFORM pg_catalog.pg_advisory_xact_lock(v_key); END LOOP;';
  assert.equal(realSaved.split(loop).length, 2, 'fault targets the single saved-reference advisory phase');
  await db.exec(`CREATE TABLE public.lean_fallback_keys(keys bigint[]);`);
  await db.exec(realCore.replace('FUNCTION marketplace_sec.phase9_catalogue_resolve_v1(',
    'FUNCTION marketplace_sec.phase9_test_real_resolve_v1('));
  await db.exec(`REVOKE ALL ON FUNCTION marketplace_sec.phase9_test_real_resolve_v1(jsonb,jsonb,jsonb)
    FROM PUBLIC,anon,authenticated,service_role;`);
  const forced = realSaved.replace(loop, loop + `
    IF NOT EXISTS(SELECT 1 FROM pg_locks WHERE pid=pg_backend_pid() AND locktype='advisory' AND granted)
    THEN RAISE EXCEPTION 'saved phase must have acquired real identity locks'; END IF;
    v_edition.id:=NULL;
    RAISE SQLSTATE 'P9C01';`);
  await db.exec(forced);
  await db.exec(`CREATE OR REPLACE FUNCTION marketplace_sec.phase9_catalogue_resolve_v1(
    p_metadata jsonb,p_companion jsonb,p_source_policy jsonb)
    RETURNS TABLE(canonical_work_id uuid,canonical_edition_id uuid)
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ BEGIN
      INSERT INTO public.lean_fallback_keys SELECT coalesce(array_agg((classid::bigint<<32)|objid::bigint),ARRAY[]::bigint[])
        FROM pg_locks WHERE pid=pg_backend_pid() AND locktype='advisory' AND objsubid=1 AND granted;
      RETURN QUERY SELECT * FROM marketplace_sec.phase9_test_real_resolve_v1(p_metadata,p_companion,p_source_policy);
    END $$;`);
  try {
    const { item } = await add(db, f); linked(item);
    assert.equal(item.canonical_work_id, target.workId); assert.equal(item.canonical_edition_id, target.editionId);
    assert.deepEqual((await db.query('SELECT keys FROM public.lean_fallback_keys')).rows, [{ keys: [] }],
      'no saved-reference advisory lock remains when fallback starts');
    assert.deepEqual(await catalogueBytes(db), before, 'subtransaction abort restores the disappeared target');
    assert.equal(await selectionBytes(db, f), chosen);
  } finally {
    await resetActor(db); await db.exec(realSaved); await db.exec(realCore);
    await db.exec('DROP FUNCTION marketplace_sec.phase9_test_real_resolve_v1(jsonb,jsonb,jsonb); DROP TABLE public.lean_fallback_keys');
  }
});
