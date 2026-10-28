// 02b sections 4.3/4.4/7.2/11 AC7-4/5/11/12/25: disposable PGlite.
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { applyM84IfPresent, catalogueBatch, completeCatalogueV2, createLeanDatabase, requireM84 } from './leanCatalogueFixture.mjs';
import { add, bytes, enableOL, facts, readSql, resetActor, saveReview, scalar, seedIncumbent,
  selectionBytes, selectSql, setActor } from './catalogueLinkFixture.mjs';
import { complete, rpc, token, worker } from './editionOptionsCompletionFixture.mjs';
import { claimJob, seedAutomaticLineage, seedCard } from './editionPickerFixture.mjs';

const effects = 'marketplace_sec.phase9_catalogue_lookup_effects';
const v2 = 'public.phase9_complete_candidate_edition_options_v2(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,uuid,uuid,timestamptz,timestamptz,boolean,jsonb,jsonb)';
let db;
before(async () => { db = await createLeanDatabase({ m84:true }); });
beforeEach(async () => {
  await resetActor(db); await db.exec('TRUNCATE public.stores,public.canonical_works,public.canonical_editions,marketplace_sec.phase9_catalogue_isbn_blocklist CASCADE'); await enableOL(db);
});
after(async () => { await db?.close(); });

async function stats(database = db) {
  await resetActor(database);
  return (await database.query(`SELECT (SELECT coalesce(sum(times_searched),0)::int FROM public.canonical_work_stats) AS searched,
    (SELECT coalesce(sum(times_chosen),0)::int FROM public.canonical_edition_stats) AS chosen,
    (SELECT coalesce(sum(times_added),0)::int FROM public.canonical_edition_stats) AS added`)).rows[0];
}
async function effect(lookupId, database = db) {
  await resetActor(database);
  return (await database.query(`SELECT lookup_id,searched_work_id,search_counted,canonical_results,completion_response
    FROM marketplace_sec.phase9_catalogue_lookup_effects WHERE lookup_id=$1`, [lookupId])).rows[0];
}
async function choose(f, ordinal = 0) {
  await setActor(db, f.ownerId);
  const command = selectSql(f, await scalar(db, readSql(f)), f.rows[ordinal].optionId);
  const response = await scalar(db, command);
  return { command, response };
}
async function multiWorkBatch() {
  // The query names one author; each pair carries a different second author
  // and original provider work. Both pairs still satisfy the real predicate.
  const f = await catalogueBatch(db, {}, ['B. Author']);
  for (const ordinal of [2,3]) {
    f.rows[ordinal].metadata.authors = ['B. Author','C. Author'];
    const companion = f.catalogueCompanions.find(c => c.optionId === f.rows[ordinal].optionId);
    companion.workExternalId = 'OL701W';
  }
  return f;
}
async function prepareLocal(database = db) {
  const m = facts(), target = await seedIncumbent(database, m);
  const f = await seedCard(database, { isbn:m.isbn13, review:{ originalTitle:m.title, authors:m.authors,
    originalLanguage:m.language, script:m.script, originalFieldConfirmation:{ title:true, authors:m.authors.map(() => true) } } });
  await resetActor(database);
  await database.query('UPDATE public.image_extraction_candidates SET observed_title=$1,observed_authors=$2 WHERE id=$3',
    [m.title,m.authors,f.candidateId]);
  assert.equal(await scalar(database,`SELECT marketplace_sec.phase9_edition_local_match(c)
    FROM public.image_extraction_candidates c WHERE id='${f.candidateId}'`),target.editionId);
  const { jobId } = await seedAutomaticLineage(database, f);
  const context = await scalar(database, await claimJob(database, f, jobId));
  const args = [jobId,worker,token,1,f.candidateId,context.candidateVersion,context.queryIdentity,
    'bibliographic','p9-metadata-lookup-v1','p9-bibliographic-normalizer-v1','p9-metadata-routing-v1',
    'store_private','p9-metadata-v1',target.editionId,'p9-selected-v1','p9-metadata-selection-v1',['validated_isbn']];
  return { ...f, target, jobId, args };
}
async function localComplete(f, database = db) {
  await setActor(database, f.ownerId, 'service_role');
  return rpc(database, 'phase9_complete_structural_local_metadata_match', f.args);
}
async function localM15Replay(f, database = db) {
  await resetActor(database);
  const args = [...f.args.slice(0,4),...f.args.slice(6)];
  return (await database.query('SELECT marketplace_sec.phase9_complete_local_metadata_match('
    + args.map((_,i) => '$' + (i+1)).join(',') + ') AS response', args)).rows[0].response;
}
async function localPhysical(f, database = db) {
  await resetActor(database);
  return (await database.query(`SELECT (SELECT count(*)::int FROM public.phase9_metadata_lookups WHERE job_id=$1) AS lookups,
    (SELECT count(*)::int FROM public.phase9_selected_metadata_snapshots WHERE candidate_id=$2) AS snapshots,
    (SELECT count(*)::int FROM public.metadata_enrichment_attempts WHERE candidate_id=$2) AS attempts,
    (SELECT count(*)::int FROM public.phase9_usage_reservations WHERE job_id=$1) AS reservations,
    (SELECT count(*)::int FROM public.phase9_metadata_provider_calls WHERE job_id=$1) AS calls`, [f.jobId,f.candidateId])).rows[0];
}

test('[baseline] real M32 local completion creates one snapshot without attempts or provider spend', async () => {
  const f = await prepareLocal(), before = await localPhysical(f), result = await localComplete(f), after = await localPhysical(f);
  assert.ok(result.lookup_id); assert.ok(result.snapshot_id); assert.equal(result.creates_provider_charge, false);
  assert.deepEqual(before, { lookups:0,snapshots:0,attempts:0,reservations:0,calls:0 });
  assert.deepEqual(after, { lookups:1,snapshots:1,attempts:0,reservations:0,calls:0 });
  assert.deepEqual(await localM15Replay(f),result);
  assert.deepEqual(await localPhysical(f),after);
});

test('AC7-25: real local completion records one searched effect and replay adds nothing', async () => {
  await requireM84(db, effects);
  const f = await prepareLocal(), first = await localComplete(f), saved = await effect(first.lookup_id);
  assert.equal(saved.search_counted, true); assert.equal(saved.searched_work_id, f.target.workId);
  assert.match(JSON.stringify(saved.canonical_results), /"optionId":null/);
  assert.ok(JSON.stringify(saved.canonical_results).includes(f.target.editionId));
  assert.deepEqual(await stats(), { searched:1,chosen:0,added:0 });
  assert.deepEqual(await localPhysical(f), { lookups:1,snapshots:1,attempts:0,reservations:0,calls:0 });
  assert.deepEqual(await localM15Replay(f), first);
  assert.deepEqual(await stats(), { searched:1,chosen:0,added:0 });
  assert.deepEqual(await effect(first.lookup_id), saved);
});

for (const invalidation of ['hidden','blocklisted']) test(`AC7-3/25: local completion rechecks a target ${invalidation} after discovery`, async () => {
  await requireM84(db,effects); const f=await prepareLocal(); await resetActor(db);
  if (invalidation==='hidden') await db.query('UPDATE public.canonical_editions SET hidden=true WHERE id=$1',[f.target.editionId]);
  else await db.query(`INSERT INTO marketplace_sec.phase9_catalogue_isbn_blocklist(isbn13,list_version,reason)
    VALUES($1,'fixture-v1','Blocked after discovery')`,[facts().isbn13]);
  let result;
  try { result=await localComplete(f); }
  catch (error) {
    assert.match(error.code??'',/^[0-9A-Z]{5}$/); assert.notEqual(error.code.slice(0,2),'42');
  }
  assert.deepEqual(await stats(),{searched:0,chosen:0,added:0});
  if (result?.lookup_id) {
    const saved=await effect(result.lookup_id); assert.ok(saved);
    assert.equal(saved.search_counted,false); assert.equal(saved.searched_work_id,null);
  }
});

test('AC7-25: pre-M84 local completion is not retrofitted when M15 replays', async () => {
  const old = await createLeanDatabase({ m84:false });
  try {
    const f = await prepareLocal(old), first = await localComplete(f,old);
    await resetActor(old); await applyM84IfPresent(old); await requireM84(old, effects);
    assert.deepEqual(await localM15Replay(f,old), first);
    assert.equal(await scalar(old, `SELECT count(*)::int FROM ${effects}`), 0);
    assert.deepEqual(await stats(old), { searched:0,chosen:0,added:0 });
  } finally { await old.close(); }
});

test('AC7-25: failed local effect insertion rolls back lookup, snapshot, count and job completion', async () => {
  await requireM84(db, effects); const f = await prepareLocal(), before = await localPhysical(f); await resetActor(db);
  await db.exec(`CREATE FUNCTION public.phase9_test_abort_local_effect() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE unique_violation USING CONSTRAINT='fixture_local_effect'; RETURN NEW; END$$;
    CREATE TRIGGER phase9_test_abort_local_effect BEFORE INSERT ON marketplace_sec.phase9_catalogue_lookup_effects
      FOR EACH ROW EXECUTE FUNCTION public.phase9_test_abort_local_effect()`);
  try { await assert.rejects(() => localComplete(f), error => error.code === '23505'); }
  finally { await resetActor(db); await db.exec(`DROP TRIGGER phase9_test_abort_local_effect ON ${effects}; DROP FUNCTION public.phase9_test_abort_local_effect()`); }
  assert.deepEqual(await localPhysical(f), before); assert.deepEqual(await stats(), { searched:0,chosen:0,added:0 });
  assert.equal(await scalar(db, `SELECT status FROM public.image_extraction_jobs WHERE id='${f.jobId}'`), 'in_progress');
});

test('AC7-4/12: first explicit choice attributes searched once; reselection and replay cannot recount', async () => {
  await requireM84(db, v2); await requireM84(db, effects);
  const f = await catalogueBatch(db); await completeCatalogueV2(db, f);
  assert.deepEqual(await stats(), { searched:0,chosen:0,added:0 });
  const beforeChoice = await effect(f.lookupId);
  assert.equal(beforeChoice.search_counted,false); assert.equal(beforeChoice.searched_work_id,null);
  const first = await choose(f), afterFirst = await effect(f.lookupId), firstStats = await stats();
  assert.equal(afterFirst.search_counted, true); assert.ok(afterFirst.searched_work_id);
  assert.equal(firstStats.searched, 1); assert.equal(firstStats.chosen, 1); assert.equal(firstStats.added, 0);
  await setActor(db, f.ownerId); await scalar(db, first.command);
  const second = await choose(f,1);
  assert.notEqual(second.response.selection.selectionId, first.response.selection.selectionId);
  assert.deepEqual(await stats(), { searched:1,chosen:2,added:0 });
  assert.equal((await effect(f.lookupId)).searched_work_id, afterFirst.searched_work_id);
  await setActor(db, f.ownerId); await saveReview(db, f); const committed = await add(db, f);
  assert.ok(committed.item.canonical_edition_id);
  assert.deepEqual(await stats(), { searched:1,chosen:2,added:1 });
});

test('[baseline] multi-work fixture has four eligible rows and completes unchanged through v1', async () => {
  const f = await multiWorkBatch(); await resetActor(db);
  const eligible = (await db.query(`SELECT marketplace_sec.phase9_edition_option_eligible(x->'metadata',$1) AS ok
    FROM jsonb_array_elements($2::jsonb) x WHERE (x->>'ordinal')::int<4 ORDER BY (x->>'ordinal')::int`,
  [f.context.queryIdentity,f.rows])).rows;
  assert.deepEqual(eligible.map(row => row.ok),[true,true,true,true]);
  await setActor(db,f.ownerId,'service_role');
  assert.equal((await complete(db,f,{rows:f.rows,fetched:f.fetched,deadline:f.deadline})).status,'completed');
});

test('AC7-4/5/12: a multi-work lookup counts only its first explicitly chosen resolved work', async () => {
  await requireM84(db,v2); await requireM84(db,effects);
  const f = await multiWorkBatch(); await completeCatalogueV2(db,f);
  assert.equal(await scalar(db,'SELECT count(*)::int FROM public.canonical_works'),2);
  assert.deepEqual(await stats(),{searched:0,chosen:0,added:0});
  assert.equal((await effect(f.lookupId)).search_counted,false);
  await choose(f,0); const first = await effect(f.lookupId);
  assert.equal(first.search_counted,true); assert.ok(first.searched_work_id);
  await choose(f,2);
  assert.deepEqual(await stats(),{searched:1,chosen:2,added:0});
  assert.equal((await effect(f.lookupId)).searched_work_id,first.searched_work_id);
  const counted = (await db.query('SELECT canonical_work_id,times_searched FROM public.canonical_work_stats WHERE times_searched>0')).rows;
  assert.deepEqual(counted.map(row => row.canonical_work_id),[first.searched_work_id]);
});

test('AC7-4/5/12: two stores count one searched work each without private identifiers in stats', async () => {
  await requireM84(db, v2); await requireM84(db, effects);
  const a = await catalogueBatch(db); await completeCatalogueV2(db,a); await choose(a);
  const b = await catalogueBatch(db); await completeCatalogueV2(db,b); await choose(b);
  assert.notEqual(a.storeId,b.storeId);
  const ae = await effect(a.lookupId), be = await effect(b.lookupId);
  assert.equal(ae.search_counted,true); assert.equal(be.search_counted,true);
  assert.equal(ae.searched_work_id,be.searched_work_id);
  assert.deepEqual(await stats(), { searched:2,chosen:2,added:0 });
  const columns = (await db.query(`SELECT table_name,column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name IN('canonical_work_stats','canonical_edition_stats')`)).rows;
  assert.ok(columns.length >= 5, 'schema scan must see populated statistic tables');
  for (const c of columns) assert.doesNotMatch(c.column_name, /store|user|candidate|inventory|lookup|query|receipt/i);
  const rows = await bytes(db,'canonical_work_stats');
  for (const id of [a.storeId,b.storeId,a.candidateId,b.candidateId,a.lookupId,b.lookupId]) assert.equal(rows.includes(id), false);
});

test('AC7-11: an already saved v1 selection keeps identical bytes across the M84 upgrade', async () => {
  const old = await createLeanDatabase({ m84:false });
  try {
    const f = await catalogueBatch(old);
    await complete(old,f,{rows:f.rows,fetched:f.fetched,deadline:f.deadline});
    await setActor(old,f.ownerId); const command = selectSql(f,await scalar(old,readSql(f)),f.rows[0].optionId);
    await scalar(old,command); await saveReview(old,f); const before = await selectionBytes(old,f);
    await resetActor(old); await applyM84IfPresent(old); await requireM84(old,effects);
    assert.equal(await selectionBytes(old,f),before);
  } finally { await old.close(); }
});
