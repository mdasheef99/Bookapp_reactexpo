// 02b sections 5/6.2/7.2/11/13.3: carried M83 fixes, disposable PGlite only.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { catalogueBatch, completeCatalogueV2, createLeanDatabase, requireLean, requireM84, selectAdmissionPath } from './leanCatalogueFixture.mjs';
import { add, automaticCard, bytes, catalogueBytes, completeOL, enableOL, facts, olOperation,
  readSql, resetActor, saveReview, scalar, seedIncumbent, selectionBytes, selectSql, setActor,
  unmatched } from './catalogueLinkFixture.mjs';

let db;
before(async () => { db = await createLeanDatabase({ m84: true }); });
beforeEach(async () => {
  await resetActor(db);
  await db.exec('TRUNCATE public.stores,public.canonical_works,public.canonical_editions CASCADE');
  await enableOL(db);
});
after(async () => { await db?.close(); });

async function effect(selectionId) {
  await resetActor(db);
  return (await db.query(`SELECT counted,canonical_edition_id,completed_at
    FROM marketplace_sec.phase9_catalogue_choice_effects WHERE selection_id=$1`, [selectionId])).rows[0];
}
async function chosen() {
  await resetActor(db);
  return scalar(db, 'SELECT coalesce(sum(times_chosen),0)::int FROM public.canonical_edition_stats');
}
async function selectOption(f, option) {
  await setActor(db, f.ownerId);
  const command = selectSql(f, await scalar(db, readSql(f)), option.optionId);
  const receipt = await scalar(db, command);
  assert.ok(receipt.selection?.selectionId, 'Select must succeed and return its new receipt');
  assert.deepEqual(await scalar(db, command), { ...receipt, rows: [], optionsExpiresAt: null },
    'Select replay retains the receipt but omits the temporary option list');
  return { receipt, command };
}
async function saveAndAdd(f) {
  await setActor(db, f.ownerId); await saveReview(db, f);
  const snapshot = await selectionBytes(db, f), result = await add(db, f);
  assert.equal(await selectionBytes(db, f), snapshot, 'Add preserves the selected review and snapshot bytes');
  return result;
}
async function source(target) {
  await resetActor(db);
  // 02b section 13.3: direct postgres seed models the retained combined source that
  // the current v1 worker cannot create; real completion/Select/Add remain intact.
  await db.query(`INSERT INTO public.book_metadata_sources
    (id,provider,adapter_key,provider_book_id,canonical_edition_id,normalized_payload)
    VALUES($1,'open_library','open_library','OL100M',$2,$3)`, [randomUUID(), target.editionId,
    { version: 'psr-catalogue-facts-v1', adapterKey: 'open_library', providerRecordId: 'OL100M',
      workExternalId: 'OL700W', coverReference: 'https://covers.openlibrary.org/b/id/123-M.jpg' }]);
}
async function workTuple(workId) {
  await db.query(`INSERT INTO public.canonical_provider_ids(adapter_key,id_kind,external_id,canonical_work_id)
    VALUES('open_library','work','OL700W',$1)`, [workId]);
}
async function otherWork() {
  return seedIncumbent(db, facts({ title: 'Competing work', isbn10: null, isbn13: null }));
}

test('[baseline] fixture sees the M83 target and a matching Select/Add count and link', async () => {
  await requireLean(db);
  // Positive scanner controls are real M83 objects, not claims that M84 exists.
  await requireM84(db, 'marketplace_sec.phase9_catalogue_resolve_v1');
  await requireM84(db, 'marketplace_sec.phase9_catalogue_choice_effects');
  const target = await seedIncumbent(db), f = await olOperation(db), option = await completeOL(db, f);
  const { receipt } = await selectOption(f, option), selected = await effect(receipt.selection.selectionId);
  assert.equal(selected.counted, true); assert.equal(selected.canonical_edition_id, target.editionId);
  assert.equal(await chosen(), 1);
  const result = await saveAndAdd(f);
  assert.equal(result.item.canonical_edition_id, target.editionId);
  assert.equal((await effect(receipt.selection.selectionId)).counted, true);
  assert.equal(await chosen(), 1);
});

for (const variant of ['adapter key', 'adapter version', 'attempt normalizer', 'lookup normalizer']) {
  test(`AC7-29: ${variant} mismatch leaves Select pending and Add unlinked`, async () => {
    await seedIncumbent(db);
    const f = await olOperation(db), option = await completeOL(db, f);
    await resetActor(db);
    // 02b section 13.3: simulate retained/seeded lineage that the current worker
    // normally refuses, after completing the real fenced provider operation.
    if (variant === 'adapter key') {
      await db.exec(`INSERT INTO public.phase9_provider_registry(adapter_key,provider_kind,adapter_version,
        enabled,matching_allowed,storage_allowed,revalidation_seconds,policy_version)
        VALUES('google_books','metadata','1.0.0',true,true,true,86400,1)
        ON CONFLICT(adapter_key) DO UPDATE SET enabled=true,matching_allowed=true,storage_allowed=true,
        adapter_version='1.0.0',policy_version=1`);
      await db.query("UPDATE public.metadata_enrichment_attempts SET adapter_key='google_books' WHERE id=$1", [f.attemptId]);
    }
    if (variant === 'adapter version') await db.query(`UPDATE public.phase9_candidate_edition_state
      SET options=jsonb_set(options,'{0,metadata,adapterVersion}',to_jsonb('fixture-different'::text))
      WHERE candidate_id=$1`, [f.candidateId]);
    if (variant === 'attempt normalizer') await db.query(
      "UPDATE public.metadata_enrichment_attempts SET normalizer_version='fixture-different' WHERE id=$1", [f.attemptId]);
    if (variant === 'lookup normalizer') await db.query(
      "UPDATE public.phase9_metadata_lookups SET normalizer_version='fixture-different' WHERE id=$1", [f.lookupId]);
    const { receipt } = await selectOption(f, option);
    const selectionId = receipt.selection.selectionId, beforeAdd = await effect(selectionId), count = await chosen();
    const result = await saveAndAdd(f), afterAdd = await effect(selectionId);
    unmatched(result.item); // Prove the Add-side control before the Select parity assertion.
    assert.equal(beforeAdd.counted, false, 'mismatched lineage must leave the choice effect pending');
    assert.equal(beforeAdd.canonical_edition_id, null);
    assert.equal(beforeAdd.completed_at, null);
    assert.equal(count, 0, 'mismatched lineage must not increment chosen');
    assert.equal(Boolean(result.item.canonical_edition_id), beforeAdd.counted, 'Select and Add must agree');
    assert.deepEqual(afterAdd, beforeAdd, 'unlinked Add cannot flush a pending choice');
  });
}

test('[baseline] AC7-31/33 control: hinted Select with no option companion still counts', async () => {
  const target = await seedIncumbent(db);
  const f = await automaticCard(db, {}, { target: target.editionId, currentSuggestion: true });
  assert.equal((await effect(f.selected.selection.selectionId)).counted, true,
    'hinted Select has no option companion by design and must keep counting');
  assert.equal(await chosen(), 1);
});

test('AC7-31/33: Select with a foreign companion work leaves the choice pending like Add', async () => {
  await requireM84(db, 'marketplace_sec.phase9_catalogue_lookup_effects');
  const f = await catalogueBatch(db, { isbn10: '0306406152', isbn13: '9780306406157' });
  await seedIncumbent(db, f.rows[0].metadata);
  await workTuple((await otherWork()).workId);
  await resetActor(db);
  const editionsBefore = await scalar(db, 'SELECT count(*)::int FROM public.canonical_editions');
  assert.equal((await completeCatalogueV2(db, f)).status, 'completed');
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.canonical_editions'), editionsBefore,
    'completion skips every shared write whose companion work conflicts with the ISBN-matching edition');
  const { receipt } = await selectOption(f, f.rows[0]);
  const selected = await effect(receipt.selection.selectionId), count = await chosen();
  await resetActor(db);
  const attribution = (await db.query(`SELECT search_counted FROM marketplace_sec.phase9_catalogue_lookup_effects
    WHERE lookup_id=$1`, [f.lookupId])).rows[0];
  const result = await saveAndAdd(f);
  unmatched(result.item); // Add refuses the foreign-companion link, before and after the Select fix.
  assert.equal(selected.counted, false, 'foreign-companion Select must leave the choice effect pending');
  assert.equal(count, 0, 'foreign-companion Select must not increment chosen');
  assert.equal(attribution.search_counted, false, 'foreign-companion Select must not attribute searched');
  assert.equal(Boolean(result.item.canonical_edition_id), selected.counted, 'Select and Add must agree');
});

// 02b sections 6.1/7.2, AC7-12/31/33: retained source and fresh companion must agree.
for (const [workExternalId, shouldLink] of [['OL701W', false], ['OL700W', true]]) {
  test(`AC7-12/31/33: ${shouldLink ? 'matching' : 'conflicting'} source/companion work keeps Select and Add in parity`, async () => {
    const f = await catalogueBatch(db, { isbn10: '0306406152', isbn13: '9780306406157' }, null, { workExternalId });
    const option = f.rows[0], target = await seedIncumbent(db, option.metadata);
    await source(target);
    const sourcesBefore = await bytes(db, 'book_metadata_sources');
    assert.equal((await completeCatalogueV2(db, f, { rows: [option],
      catalogueCompanions: [f.catalogueCompanions[0]] })).status, 'completed');
    await resetActor(db);
    assert.equal(await bytes(db, 'book_metadata_sources'), sourcesBefore, 'completion preserves the retained source');
    assert.equal((await db.query(`SELECT count(*)::int FROM marketplace_sec.phase9_catalogue_companions
      WHERE lookup_id=$1 AND companion->>'workExternalId'=$2`, [f.lookupId, workExternalId])).rows[0].count, 1);
    if (!shouldLink) assert.equal((await db.query(`SELECT count(*)::int FROM public.canonical_provider_ids
      WHERE adapter_key='open_library' AND id_kind='work' AND external_id=$1`, [workExternalId])).rows[0].count, 0,
      'the conflicting companion work has no tuple before Select');
    const { receipt } = await selectOption(f, option);
    const selected = await effect(receipt.selection.selectionId), count = await chosen();
    const attribution = (await db.query(`SELECT search_counted,searched_work_id
      FROM marketplace_sec.phase9_catalogue_lookup_effects WHERE lookup_id=$1`, [f.lookupId])).rows[0];
    const searched = await scalar(db, 'SELECT coalesce(sum(times_searched),0)::int FROM public.canonical_work_stats');
    const result = await saveAndAdd(f);
    if (shouldLink) {
      assert.equal(result.item.canonical_work_id, target.workId);
      assert.equal(result.item.canonical_edition_id, target.editionId);
    } else unmatched(result.item); // Prove Add's refusal before asserting Select parity.
    assert.deepEqual({ choiceCounted: selected.counted, chosen: count, searched, ...attribution },
      { choiceCounted: shouldLink, chosen: shouldLink ? 1 : 0, searched: shouldLink ? 1 : 0,
        search_counted: shouldLink, searched_work_id: shouldLink ? target.workId : null },
      'source/companion work disagreement must not count search or choice');
    assert.equal(selected.canonical_edition_id, shouldLink ? target.editionId : null);
    assert.equal(Boolean(result.item.canonical_edition_id), selected.counted, 'Select counts iff Add links');
    assert.deepEqual(await effect(receipt.selection.selectionId), selected, 'Add cannot change the choice accounting');
    assert.equal(await chosen(), count);
  });
}

test('[baseline] AC7-30: target admission distinguishes admitted, unknown, disabled and storage-revoked providers', async () => {
  const target = await seedIncumbent(db), f = await olOperation(db);
  await completeOL(db, f); await resetActor(db);
  const m = f.facts;
  const probe = async key => (await db.query(
    'SELECT * FROM marketplace_sec.phase9_catalogue_choice_target_v1($1,NULL,$2,$3)',
    [m, key, m.providerRecordId])).rows[0];
  assert.deepEqual(await probe('open_library'), { canonical_work_id: target.workId, canonical_edition_id: target.editionId });
  assert.deepEqual(await probe('unknown_provider'), { canonical_work_id: null, canonical_edition_id: null });
  for (const column of ['enabled', 'storage_allowed']) {
    await db.exec(`UPDATE public.phase9_provider_registry SET ${column}=false WHERE adapter_key='open_library'`);
    assert.deepEqual(await probe('open_library'), { canonical_work_id: null, canonical_edition_id: null });
    await enableOL(db);
  }
});

test('AC7-30: no-hint target admission uses the locked source-policy builder', async () => {
  await requireLean(db);
  // AC7-30 fixes the Select admission path, not the helper that owns the call.
  // Native AC7-30 tests observe UPDATE waiting and registry-before-identity order.
  const reachable = await selectAdmissionPath(db);
  assert.ok(reachable.has('marketplace_sec.phase9_catalogue_source_policy_v1'),
    'the real Select call path must reach the locked source-policy builder');
  assert.match([...reachable.values()].join('\n'), /sharedAdmitted/,
    'the Select admission path must consume the locked admission decision');
});

for (const variant of ['foreign', 'absent', 'own']) {
  test(`${variant === 'foreign' ? '' : '[baseline] '}AC7-31: saved-ID Add with ${variant} work tuple`, async () => {
    const target = await seedIncumbent(db), f = await automaticCard(db, {}, { target: target.editionId });
    await source(target);
    if (variant === 'foreign') await workTuple((await otherWork()).workId);
    if (variant === 'own') await workTuple(target.workId);
    const before = [await catalogueBytes(db), await bytes(db, 'canonical_provider_ids'), await bytes(db, 'book_metadata_sources')];
    const pair = (await db.query('SELECT * FROM marketplace_sec.phase9_catalogue_link_for_add_v1($1,$2,$3)',
      [f.candidateId, f.sessionId, f.storeId])).rows[0];
    const result = await add(db, f);
    assert.deepEqual(pair, variant === 'foreign' ? { canonical_work_id: null, canonical_edition_id: null }
      : { canonical_work_id: target.workId, canonical_edition_id: target.editionId }, 'saved target must respect the source work tuple');
    if (variant === 'foreign') unmatched(result.item);
    else assert.equal(result.item.canonical_edition_id, target.editionId);
    assert.deepEqual([await catalogueBytes(db), await bytes(db, 'canonical_provider_ids'), await bytes(db, 'book_metadata_sources')], before);
  });
}

for (const cover of ['other provider', 'null']) {
  test(`${cover === 'null' ? '[baseline] ' : ''}AC7-32: hinted Select counts with ${cover} display cover`, async () => {
    const target = await seedIncumbent(db);
    await db.query('UPDATE public.canonical_editions SET cover_url=$1 WHERE id=$2',
      [cover === 'null' ? null : 'https://books.google.com/books/content?id=other', target.editionId]);
    const f = await automaticCard(db, {}, { target: target.editionId, currentSuggestion: true });
    assert.equal((await effect(f.selected.selection.selectionId)).counted, true,
      'canonical display cover is not provider-sourced metadata');
    assert.equal(await chosen(), 1);
  });
}

test('[baseline] AC7-32: provider-sourced option with another provider cover stays pending', async () => {
  await seedIncumbent(db); const f = await olOperation(db), option = await completeOL(db, f);
  // The ordinary completion rejects this; bounded seed models the retained bad
  // option covered by section 13.3, without replacing the Select implementation.
  await resetActor(db);
  await db.query(`UPDATE public.phase9_candidate_edition_state SET options=jsonb_set(options,
    '{0,metadata,coverReference}',to_jsonb('https://books.google.com/books/content?id=other'::text))
    WHERE candidate_id=$1`, [f.candidateId]);
  const { receipt } = await selectOption(f, option);
  assert.equal((await effect(receipt.selection.selectionId)).counted, false);
  assert.equal(await chosen(), 0);
});

for (const label of ['absent', 'foreign', 'own', 'foreign searched']) {
  const variant = label === 'foreign searched' ? 'foreign' : label;
  const name = label === 'foreign searched' ? 'AC7-12: foreign-tuple Select leaves searched attribution pending'
    : `${variant === 'absent' ? '' : '[baseline] '}AC7-33: ${variant} work tuple agrees with Add`;
  test(name, async () => {
    if (label === 'foreign searched') await requireM84(db,'marketplace_sec.phase9_catalogue_lookup_effects');
    const target = await seedIncumbent(db); await source(target);
    if (variant === 'foreign') await workTuple((await otherWork()).workId);
    if (variant === 'own') await workTuple(target.workId);
    const f = await olOperation(db);
    // The future v1 delegate must not create the missing work tuple before
    // this Select test; public display admission is independent of M73's gate.
    await resetActor(db);
    await db.exec("UPDATE public.phase9_provider_registry SET public_display_allowed=false WHERE adapter_key='open_library'");
    const sharedBefore = [await catalogueBytes(db),await bytes(db,'canonical_provider_ids'),await bytes(db,'book_metadata_sources')];
    await setActor(db, f.ownerId, 'service_role');
    const option = await completeOL(db, f); await resetActor(db);
    assert.deepEqual([await catalogueBytes(db),await bytes(db,'canonical_provider_ids'),await bytes(db,'book_metadata_sources')],
      sharedBefore,'denied completion admission must leave every shared catalogue effect absent');
    const tuple = (await db.query(`SELECT canonical_work_id FROM public.canonical_provider_ids
      WHERE adapter_key='open_library' AND id_kind='work' AND external_id='OL700W'`)).rows;
    if (variant === 'absent') assert.deepEqual(tuple,[],'the missing-tuple precondition must still hold before Select');
    await enableOL(db);
    const searchedBefore = await bytes(db,'canonical_work_stats');
    const hasEffects = variant === 'foreign' && await scalar(db,"SELECT to_regclass('marketplace_sec.phase9_catalogue_lookup_effects') IS NOT NULL");
    const attribution = async () => (await db.query(`SELECT search_counted,searched_work_id
      FROM marketplace_sec.phase9_catalogue_lookup_effects WHERE lookup_id=$1`,[f.lookupId])).rows;
    if (hasEffects) assert.deepEqual(await attribution(),[{search_counted:false,searched_work_id:null}]);
    const { receipt } = await selectOption(f, option), selected = await effect(receipt.selection.selectionId);
    if (variant === 'foreign') {
      // On M83 the receipt relation is absent; retain the green legacy control.
      // M84 absence has its own RED and must precede queries of its new columns.
      if (hasEffects) assert.deepEqual(await attribution(),[{search_counted:false,searched_work_id:null}]);
      assert.equal(await bytes(db,'canonical_work_stats'),searchedBefore,'foreign-tuple Select cannot increment searched');
    }
    const result = await saveAndAdd(f), shouldLink = variant !== 'foreign';
    assert.equal(selected.counted, shouldLink, 'Select must permit a missing tuple when the work key matches');
    assert.equal(Boolean(result.item.canonical_edition_id), shouldLink, 'Add must agree with the initial Select count');
    if (shouldLink) {
      assert.equal(result.item.canonical_edition_id, target.editionId);
      assert.equal(await scalar(db, `SELECT canonical_work_id FROM public.canonical_provider_ids
        WHERE adapter_key='open_library' AND id_kind='work' AND external_id='OL700W'`), target.workId);
    } else unmatched(result.item);
  });
}

test('[baseline] AC7-33: differing work key without provider proof remains unlinked', async () => {
  const target = await seedIncumbent(db);
  await db.query("UPDATE public.canonical_works SET title_normalized='different work',primary_title='Different work' WHERE id=$1", [target.workId]);
  const f = await olOperation(db), option = await completeOL(db, f), { receipt } = await selectOption(f, option);
  const selected = await effect(receipt.selection.selectionId), result = await saveAndAdd(f);
  assert.equal(selected.counted, false); unmatched(result.item);
});

test('AC7-34: normalized work probe index exists and uses the immutable M83 expressions', async () => {
  await requireM84(db, 'public.canonical_works_normalized_probe_idx');
  const rows = (await db.query(`SELECT i.indisunique,pg_get_indexdef(i.indexrelid) AS definition,
      pg_get_expr(i.indexprs,i.indrelid) AS expressions
    FROM pg_index i WHERE i.indexrelid='public.canonical_works_normalized_probe_idx'::regclass
      AND i.indrelid='public.canonical_works'::regclass`)).rows;
  assert.equal(rows.length, 1); assert.equal(rows[0].indisunique, false);
  const expression = rows[0].expressions.replace(/\s+/g, '').toLowerCase().replaceAll('pg_catalog.', '');
  assert.match(expression, /btrim\(marketplace_sec\.phase9_metadata_normalized_text\(coalesce\(title_normalized,primary_title\)\)\)/);
  assert.match(expression, /marketplace_sec\.phase9_catalogue_normalized_authors_v1\(primary_authors\)/);
  const volatility = (await db.query(`SELECT proname,provolatile FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='marketplace_sec' AND proname IN('phase9_metadata_normalized_text','phase9_catalogue_normalized_authors_v1')
    ORDER BY proname`)).rows;
  assert.deepEqual(volatility.map(row => row.provolatile), ['i', 'i']);
  const baseline = await createLeanDatabase({ m84: false });
  try {
    const indexes = async d => (await d.query(`SELECT tablename,indexname FROM pg_indexes
      WHERE schemaname='public' AND tablename IN('canonical_editions','canonical_provider_ids','book_metadata_sources')
      ORDER BY tablename,indexname`)).rows;
    assert.deepEqual(await indexes(db), await indexes(baseline), 'M84 adds no index to other existing probes');
  } finally { await baseline.close(); }
});

for (const probe of ['resolver work list', 'recovery competitor', 'saved target count']) {
  test(`AC7-34: ${probe} uses the index and preserves legacy raw-case results`, async () => {
    await requireM84(db, 'public.canonical_works_normalized_probe_idx');
    const target = await seedIncumbent(db, facts({ title: 'The Hobbit', authors: ['J.R.R. Tolkien'],
      isbn10: null, isbn13: '9780547928227' }), { displayKey: true });
    const predicate = `pg_catalog.btrim(marketplace_sec.phase9_metadata_normalized_text(
      coalesce(w.title_normalized,w.primary_title)))=$1 AND
      marketplace_sec.phase9_catalogue_normalized_authors_v1(w.primary_authors)=$2::text[]`;
    // These are the three M83 statements at lines 396-399, 552-555 and 890-893,
    // with only PL/pgSQL variables replaced by bound parameters.
    const statement = probe === 'recovery competitor'
      ? `SELECT EXISTS(SELECT 1 FROM public.canonical_works w WHERE w.id<>$3::uuid AND ${predicate}) AS present`
      : probe === 'resolver work list'
        ? `SELECT pg_catalog.array_agg(w.id ORDER BY w.id) AS ids FROM public.canonical_works w WHERE ${predicate}`
        : `SELECT pg_catalog.count(*)::integer AS count FROM public.canonical_works w WHERE ${predicate}`;
    const args = probe === 'recovery competitor'
      ? ['the hobbit', ['j.r.r. tolkien'], randomUUID()] : ['the hobbit', ['j.r.r. tolkien']];
    try {
      await db.exec('SET enable_seqscan=off');
      const plan = (await db.query('EXPLAIN ' + statement, args)).rows.map(row => row['QUERY PLAN']).join('\n');
      const indexed = (await db.query(statement, args)).rows;
      assert.match(plan, /canonical_works_normalized_probe_idx/, 'the M83 predicate must use the probe index');
      await db.exec('SET enable_seqscan=on; SET enable_indexscan=off; SET enable_indexonlyscan=off; SET enable_bitmapscan=off');
      const sequential = (await db.query(statement, args)).rows;
      assert.deepEqual(indexed, probe === 'recovery competitor' ? [{ present: true }]
        : probe === 'resolver work list' ? [{ ids: [target.workId] }] : [{ count: 1 }]);
      assert.deepEqual(sequential, indexed, 'index and sequential scans find the same raw-case incumbent');
      assert.equal(await scalar(db, `SELECT count(*)::int FROM public.canonical_works WHERE id='${target.workId}'`), 1);
    } finally {
      await db.exec('RESET enable_seqscan; RESET enable_indexscan; RESET enable_indexonlyscan; RESET enable_bitmapscan');
    }
  });
}


for (const variant of ['lookup policy version', 'provider disabled', 'provider storage revoked']) {
  test(`[baseline] AC7-29/30: ${variant} is refused (pre-empted by the M73 source-policy gate)`, async () => {
    const f = await olOperation(db);
    // Prevent a future M84 completion from populating shared targets; M73 permits
    // this pre-completion policy and the later Select retains a real pending choice.
    await resetActor(db);
    await db.exec("UPDATE public.phase9_provider_registry SET public_display_allowed=false WHERE adapter_key='open_library'");
    await setActor(db, f.ownerId, 'service_role');
    const option = await completeOL(db, f); await enableOL(db);
    const { receipt } = await selectOption(f, option);
    await setActor(db, f.ownerId); await saveReview(db, f);
    await seedIncumbent(db);
    await setActor(db, f.ownerId);
    const command = selectSql(f, await scalar(db, readSql(f)), option.optionId);
    await resetActor(db);
    const before = [await catalogueBytes(db), await bytes(db, 'canonical_provider_ids'), await bytes(db, 'book_metadata_sources')];
    const prior = await effect(receipt.selection.selectionId);
    assert.equal(prior.counted, false, 'control starts from an actual pending choice');
    if (variant === 'lookup policy version') await db.query(
      "UPDATE public.phase9_metadata_lookups SET reuse_policy_version='2' WHERE id=$1", [f.lookupId]);
    else await db.exec(`UPDATE public.phase9_provider_registry SET ${variant === 'provider disabled' ? 'enabled' : 'storage_allowed'}=false
      WHERE adapter_key='open_library'`);
    await setActor(db, f.ownerId);
    await assert.rejects(() => scalar(db, command), /P9_STATE_CONFLICT/,
      'M73 must refuse a fresh Select before a new choice effect');
    await resetActor(db);
    assert.equal(await scalar(db, 'SELECT count(*)::int FROM marketplace_sec.phase9_catalogue_choice_effects'), 1);
    assert.deepEqual(await effect(receipt.selection.selectionId), prior);
    const result = await add(db, f); unmatched(result.item);
    assert.equal(await chosen(), 0);
    assert.deepEqual(await effect(receipt.selection.selectionId), prior);
    assert.deepEqual([await catalogueBytes(db), await bytes(db, 'canonical_provider_ids'), await bytes(db, 'book_metadata_sources')], before);
  });
}

test('[baseline] AC7-29: lookup policy mismatch is refused at Select (pre-empted by the M73 source-policy gate)', async () => {
  await seedIncumbent(db); const f = await olOperation(db), option = await completeOL(db,f);
  const {receipt} = await selectOption(f,option);
  assert.equal((await effect(receipt.selection.selectionId)).counted,true,'matching public Select counts');
  const before = [await bytes(db,'phase9_candidate_edition_state'),await bytes(db,'phase9_selected_metadata_snapshots'),
    await bytes(db,'canonical_edition_stats'),await selectionBytes(db,f),await effect(receipt.selection.selectionId)];
  await setActor(db,f.ownerId); const command = selectSql(f,await scalar(db,readSql(f)),option.optionId);
  await resetActor(db);
  await db.query("UPDATE public.phase9_metadata_lookups SET reuse_policy_version='2' WHERE id=$1",[f.lookupId]);
  await setActor(db,f.ownerId);
  await assert.rejects(() => scalar(db,command),/P9_STATE_CONFLICT/);
  assert.deepEqual([await bytes(db,'phase9_candidate_edition_state'),await bytes(db,'phase9_selected_metadata_snapshots'),
    await bytes(db,'canonical_edition_stats'),await selectionBytes(db,f),await effect(receipt.selection.selectionId)],before);
  assert.equal(await scalar(db,'SELECT count(*)::int FROM marketplace_sec.phase9_catalogue_choice_effects'),1);
});
