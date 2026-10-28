// 02b sections 4.5/5/7.2/8/11: M85 green targets; real SQL, no provider HTTP.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { cacheRequest, cacheVersions, catalogueBatch, completeCatalogueV2, createLeanDatabase,
  requireM85, reuseCatalogueCache, scanCacheCard } from './leanCatalogueFixture.mjs';
import { add, enableOL, olOperation, readSql, resetActor, saveReview, scalar, selectSql, setActor } from './catalogueLinkFixture.mjs';
import { complete, fence, recover, rpc, token, worker } from './editionOptionsCompletionFixture.mjs';
import { seedCard } from './editionPickerFixture.mjs';
import { completionFootprint } from './leanCatalogueCompletionFixture.mjs';

let db;
before(async()=>{db=await createLeanDatabase({m84:true,m85:true});});
beforeEach(async()=>{
  await resetActor(db);
  await db.exec('TRUNCATE public.stores,public.canonical_works,public.canonical_editions,public.phase9_metadata_cache_entries CASCADE');
  await enableOL(db);
});
after(async()=>{await db?.close();});

async function state(f) {
  await resetActor(db);
  return (await db.query('SELECT * FROM public.phase9_candidate_edition_state WHERE candidate_id=$1',[f.candidateId])).rows[0];
}
async function ledger(f) {
  await resetActor(db);
  return (await db.query(`SELECT
    (SELECT count(*)::int FROM public.phase9_metadata_provider_calls WHERE job_id=$1) AS calls,
    (SELECT count(*)::int FROM public.phase9_usage_reservations WHERE job_id=$1) AS reservations,
    (SELECT coalesce(sum(actual_cost_units),0)::text FROM public.phase9_usage_reservations WHERE job_id=$1) AS spend,
    (SELECT count(*)::int FROM public.phase9_metadata_lookups WHERE job_id=$1) AS lookups,
    (SELECT count(*)::int FROM public.metadata_enrichment_attempts a JOIN public.phase9_metadata_lookups l
      ON l.id=a.lookup_id WHERE l.job_id=$1) AS attempts`,[f.jobId])).rows[0];
}
async function effect(f) {
  await resetActor(db);
  return (await db.query(`SELECT e.* FROM marketplace_sec.phase9_catalogue_lookup_effects e
    JOIN public.phase9_metadata_lookups l ON l.id=e.lookup_id WHERE l.job_id=$1`,[f.jobId])).rows[0];
}
async function source(overrides={}, card=null) {
  const f=await catalogueBatch(db,overrides,null,{existing:card??await scanCacheCard(db)});
  assert.equal((await completeCatalogueV2(db,f)).status,'completed');
  const saved=await effect(f);
  assert.ok(saved,'M84 must create the real completion effect');
  assert.notEqual(saved.cache_entry_id,null,'M85 completion must publish an admitted edition-list cache entry');
  const entry=(await db.query('SELECT * FROM public.phase9_metadata_cache_entries WHERE id=$1',[saved.cache_entry_id])).rows[0];
  assert.ok(entry,'published receipt must reference a persisted cache entry');
  return {...f,entry};
}
async function hit(f, versions=cacheVersions()) {
  const response=await reuseCatalogueCache(db,f,versions);
  assert.equal(response.status,'completed','an admitted matching query must complete from the edition cache');
  assert.deepEqual(await ledger(f),{calls:0,reservations:0,spend:'0',lookups:1,attempts:1});
  return response;
}
const bibliographic = rows => rows.map(r=>{
  const metadata=r.metadata===null?null:{...r.metadata};
  if(metadata) for(const key of ['correlationId','attemptId','matchRationale','confidence']) delete metadata[key];
  return {ordinal:r.ordinal,eligibility:r.eligibility,googleBooksUrl:r.googleBooksUrl,metadata};
});

test('[baseline] real scan fixture persists immutable evidence and external completion consumes usage',async()=>{
  const card=await scanCacheCard(db), f=await catalogueBatch(db,{},null,{existing:card});
  await resetActor(db);
  const c=(await db.query(`SELECT c.owner_review_snapshot,r.authoritative_outcome,o.observation_snapshot
    FROM public.image_extraction_candidates c JOIN public.image_analysis_observations o ON o.id=c.analysis_observation_id
    JOIN public.image_analysis_results r ON r.id=o.analysis_result_id WHERE c.id=$1`,[card.candidateId])).rows[0];
  assert.equal(c.owner_review_snapshot,null); assert.equal(c.authoritative_outcome,'accepted');
  assert.equal(c.observation_snapshot.title_guess,'Catalogue Sample');
  assert.equal((await completeCatalogueV2(db,f)).status,'completed');
  const actual=await ledger(f); assert.equal(actual.calls,3); assert.equal(actual.reservations,1);
  const charged=(await db.query(`SELECT u.status,u.reserved_cost_units FROM public.phase9_usage_reservations u
    JOIN public.metadata_enrichment_attempts a ON a.usage_reservation_id=u.id WHERE a.id=$1`,[f.attemptId])).rows[0];
  assert.equal(charged.status,'consumed'); // Explicit Open Library's recorded monetary price is zero.
});

test('[baseline] accounted external automatic execution can record nonzero provider spend',async()=>{
  const f=await olOperation(db,{isbn10:null,isbn13:null},true), base=[f.jobId,worker,token,1];
  const call=await rpc(db,'phase9_register_metadata_provider_call',[f.attemptId,...base,randomUUID()]);
  await rpc(db,'phase9_finalize_metadata_provider_call',[call.provider_call_id,...base,'finalized',
    'coherent_match','coherent_match','recorded-cost-control',false,null,[]]);
  await rpc(db,'phase9_finalize_structural_metadata_attempt',[f.attemptId,...base,f.candidateId,
    f.context.candidateVersion,'accepted','coherent_match',null,'miss',0,'fixture-pricing',{currency:'USD'},1,f.facts]);
  await resetActor(db);
  const cost=(await db.query(`SELECT a.calculated_cost_units,u.actual_cost_units FROM public.metadata_enrichment_attempts a
    JOIN public.phase9_usage_reservations u ON u.id=a.usage_reservation_id WHERE a.id=$1`,[f.attemptId])).rows[0];
  assert.equal(Number(cost.calculated_cost_units),1); assert.equal(Number(cost.actual_cost_units),1);
  assert.equal((await ledger(f)).calls,1); assert.equal((await ledger(f)).spend,'1');
});

test('AC7-7/16: public scan cache gives store B its own IDs and receipt with zero egress or usage',async()=>{
  const a=await source(), b=await cacheRequest(db,await scanCacheCard(db));
  assert.notEqual(a.storeId,b.storeId); assert.equal(a.context.queryIdentity,b.context.queryIdentity);
  assert.equal(a.entry.privacy_scope,'public_bibliographic'); assert.equal(a.entry.store_id,null);
  await hit(b); const bs=await state(b), be=await effect(b);
  assert.deepEqual(bibliographic(bs.options),bibliographic(a.rows));
  assert.notEqual(bs.source_lookup_id,a.lookupId); assert.notEqual(bs.source_attempt_id,a.attemptId);
  assert.equal(be.store_id,b.storeId); assert.equal(be.candidate_id,b.candidateId);
  assert.equal(be.cache_entry_id,a.entry.id); assert.equal(be.cache_payload_digest,a.entry.payload_digest);
  for(const r of bs.options) {
    assert.equal(a.rows.some(old=>old.optionId===r.optionId),false);
    if(r.metadata) {
      assert.equal(r.metadata.correlationId,bs.source_lookup_id); assert.equal(r.metadata.attemptId,bs.source_attempt_id);
      assert.equal(r.metadata.matchRationale,'confirmation_required_text_evidence'); assert.equal(r.metadata.confidence,0);
    }
  }
  assert.equal(JSON.stringify(bs).includes(a.storeId),false);
});

test('AC7-15/16: receiving logical attempt has cache-hit shape and no fabricated provider receipt',async()=>{
  const a=await source(), b=await cacheRequest(db,await scanCacheCard(db)); await hit(b); await resetActor(db);
  const l=(await db.query('SELECT * FROM public.phase9_metadata_lookups WHERE job_id=$1',[b.jobId])).rows[0];
  const attempt=(await db.query('SELECT * FROM public.metadata_enrichment_attempts WHERE lookup_id=$1',[l.id])).rows[0];
  assert.equal(l.execution_mode,'cache_hit'); assert.equal(l.privacy_scope,'store_private');
  for(const key of ['leader_lookup_id','reuse_source_attempt_id','canonical_edition_id']) assert.equal(l[key],null,key);
  assert.equal(l.outcome_source_attempt_id,attempt.id); assert.equal(attempt.attempt_sequence,1);
  assert.equal(attempt.provider_role,'primary'); assert.equal(attempt.cache_status,'positive_hit');
  assert.equal(attempt.status,'completed'); assert.equal(attempt.disposition,'rejected');
  assert.equal(attempt.normalized_outcome,'ambiguous_match'); assert.equal(Number(attempt.calculated_cost_units),0);
  assert.deepEqual(attempt.normalized_request_clues,{});
  for(const key of ['usage_reservation_id','provider_request_id','raw_payload','normalized_payload',
    'predecessor_attempt_id','possibly_duplicate_spend_of_attempt_id','provider_record_id','pricing_evidence','pricing_policy_version'])
    assert.equal(attempt[key],null,key);
  assert.notEqual(attempt.id,a.attemptId);
});

for(const [label,cover] of [['own admitted cover','https://covers.openlibrary.org/b/id/123-M.jpg'],['missing cover',null]])
test(`AC7-9: cache preserves ${label} without an HTTP request`,async()=>{
  await source({coverReference:cover}); const b=await cacheRequest(db,await scanCacheCard(db)); await hit(b);
  assert.deepEqual((await state(b)).options.filter(r=>r.metadata).map(r=>r.metadata.coverReference),Array(5).fill(cover));
});

test('AC7-24: a new request with a changed worker version misses; completed replay ignores upgrades',async()=>{
  const a=await source(), b=await cacheRequest(db,await scanCacheCard(db));
  const first=await hit(b), before=await completionFootprint(db);
  assert.deepEqual(await reuseCatalogueCache(db,b,cacheVersions({routingPolicyVersion:'routing-upgrade-v2'})),{...first,status:'replayed'});
  assert.equal(await completionFootprint(db),before);
  const c=await cacheRequest(db,await scanCacheCard(db)), untouched=await ledger(c);
  assert.deepEqual(await reuseCatalogueCache(db,c,cacheVersions({routingPolicyVersion:'routing-upgrade-v2'})),{status:'miss'});
  assert.deepEqual(await ledger(c),untouched); assert.equal((await effect(a)).cache_entry_id,a.entry.id);
});

test('AC7-27: twelve requests on one candidate get fresh sequence-one attempts; replay adds none',async()=>{
  await source(); const card=await scanCacheCard(db), lookups=new Set(), attempts=new Set();
  for(let n=0;n<12;n++) {
    const f=await cacheRequest(db,card); await hit(f); const s=await state(f);
    lookups.add(s.source_lookup_id); attempts.add(s.source_attempt_id);
    const before=await completionFootprint(db);
    assert.equal((await reuseCatalogueCache(db,f)).status,'replayed'); assert.equal(await completionFootprint(db),before);
  }
  assert.equal(lookups.size,12); assert.equal(attempts.size,12); await resetActor(db);
  const rows=(await db.query('SELECT attempt_sequence,provider_role FROM public.metadata_enrichment_attempts WHERE candidate_id=$1',[card.candidateId])).rows;
  assert.equal(rows.length,12); assert.equal(rows.every(r=>r.attempt_sequence===1 && r.provider_role==='primary'),true);
});

test('AC7-27: same-lookup sequence and role duplicates fail; legacy NULL-lookup uniqueness survives',async()=>{
  await source(); const f=await cacheRequest(db,await scanCacheCard(db)); await hit(f); const s=await state(f);
  await resetActor(db);
  const clone=async changes=>db.query(`INSERT INTO public.metadata_enrichment_attempts SELECT x.* FROM
    public.metadata_enrichment_attempts a CROSS JOIN LATERAL jsonb_populate_record(NULL::public.metadata_enrichment_attempts,
      to_jsonb(a)||$2::jsonb) x WHERE a.id=$1`,[s.source_attempt_id,{id:randomUUID(),provider_attempt_identity:randomUUID(),...changes}]);
  await assert.rejects(()=>clone({provider_role:'secondary'}),e=>e.code==='23505');
  await assert.rejects(()=>clone({attempt_sequence:2}),e=>e.code==='23505');
  await clone({lookup_id:null,provider_role:null});
  await assert.rejects(()=>clone({lookup_id:null,provider_role:null}),e=>e.code==='23505');
});

test('AC7-12/13: cache-hit first-choice searched count and recovery are exactly once after option cleanup',async()=>{
  await source(); const f=await cacheRequest(db,await scanCacheCard(db)); const completed=await hit(f), s=await state(f);
  await setActor(db,f.ownerId); const choices=await scalar(db,readSql(f));
  const command=selectSql(f,choices,s.options[0].optionId); await scalar(db,command); await scalar(db,command);
  await resetActor(db);
  const counts=(await db.query(`SELECT (SELECT sum(times_searched)::int FROM public.canonical_work_stats) AS searched,
    (SELECT sum(times_chosen)::int FROM public.canonical_edition_stats) AS chosen,
    (SELECT coalesce(sum(times_added),0)::int FROM public.canonical_edition_stats) AS added`)).rows[0];
  assert.deepEqual(counts,{searched:1,chosen:1,added:0});
  await db.query(`UPDATE public.phase9_candidate_edition_state SET options='[]',source_lookup_id=NULL,
    source_attempt_id=NULL,source_fetched_at=NULL,options_expires_at=NULL WHERE candidate_id=$1`,[f.candidateId]);
  const before=await completionFootprint(db); await setActor(db,f.ownerId,'service_role');
  // Selection updates the query only when bibliographic identity changes; this source is equal.
  assert.deepEqual(await recover(db,f),{...completed,status:'replayed'});
  assert.equal(await completionFootprint(db),before); assert.deepEqual((await state(f)).options,[]);
});

test('AC7-26: Owner-confirmed equal-looking text stays private and cannot hit in store B',async()=>{
  const card=await scanCacheCard(db); await setActor(db,card.ownerId);
  await saveReview(db,card,{...card.review,originalTitle:card.facts.title,authors:card.facts.authors,
    originalLanguage:card.facts.language,originalFieldConfirmation:{title:true,authors:[true,true]}});
  const a=await source({},card), b=await cacheRequest(db,await scanCacheCard(db));
  assert.equal(a.context.queryIdentity,b.context.queryIdentity,'origins differ while query text stays identical');
  assert.equal(a.entry.privacy_scope,'store_private'); assert.equal(a.entry.store_id,a.storeId);
  const before=await completionFootprint(db); assert.deepEqual(await reuseCatalogueCache(db,b),{status:'miss'});
  assert.equal(await completionFootprint(db),before);
  const own=await cacheRequest(db,a); await hit(own);
});

test('AC7-26: unknown-origin equal-looking query is private despite matching scan text',async()=>{
  const card=await scanCacheCard(db); await resetActor(db);
  await db.query(`UPDATE public.image_extraction_candidates SET input_id=NULL,vision_job_id=NULL,
    analysis_observation_id=NULL,analysis_schema_version=NULL WHERE id=$1`,[card.candidateId]);
  const f=await catalogueBatch(db,{},null,{existing:card}); assert.equal((await completeCatalogueV2(db,f)).status,'completed');
  const saved=await effect(f); assert.notEqual(saved.cache_entry_id,null,'M85 must support scoped private publication');
  const entry=(await db.query('SELECT * FROM public.phase9_metadata_cache_entries WHERE id=$1',[saved.cache_entry_id])).rows[0];
  assert.equal(entry.privacy_scope,'store_private'); assert.equal(entry.store_id,f.storeId);
  const b=await cacheRequest(db,await scanCacheCard(db)); assert.equal(f.context.queryIdentity,b.context.queryIdentity);
  assert.deepEqual(await reuseCatalogueCache(db,b),{status:'miss'});
});

test('AC7-6: hiding all discoverable cached editions makes reuse miss without partial effects',async()=>{
  const a=await source(); await resetActor(db);
  await db.query('UPDATE public.canonical_editions SET hidden=true');
  const b=await cacheRequest(db,await scanCacheCard(db)), before=await completionFootprint(db);
  assert.deepEqual(await reuseCatalogueCache(db,b),{status:'miss'}); assert.equal(await completionFootprint(db),before);
  assert.equal((await effect(a)).cache_entry_id,a.entry.id);
});

test('AC7-16: unresolved external work cannot be replaced by cache reuse',async()=>{
  await source(); const f=await olOperation(db,{isbn10:null,isbn13:null},false,false,await scanCacheCard(db));
  const before=await completionFootprint(db); await requireM85(db,'public.phase9_reuse_candidate_edition_cache_v1');
  let response, failure;
  try { response=await reuseCatalogueCache(db,f); } catch(e) { failure=e; }
  if(failure) assert.equal(failure.code,'P0001');
  else assert.ok(response && !['completed','replayed'].includes(response.status),'unresolved external request must be refused');
  assert.equal(await completionFootprint(db),before);
});

test('[baseline] external options without finalized egress remain pending and refuse completion',async()=>{
  const f=await olOperation(db,{isbn10:null,isbn13:null});
  const args={...f,rows:[],catalogueCompanions:[],fetched:f.facts.fetchedAt,deadline:new Date(Date.now()+3600000).toISOString()};
  const before=await completionFootprint(db);
  await assert.rejects(()=>completeCatalogueV2(db,args),e=>e.code==='P0001' && /P9_STATE_CONFLICT/.test(e.message));
  assert.equal(await completionFootprint(db),before); assert.equal((await ledger(f)).calls,0);
  const row=(await db.query('SELECT completed_at FROM public.phase9_metadata_lookups WHERE id=$1',[f.lookupId])).rows[0];
  assert.equal(row.completed_at,null);
});


test('AC7-24: every independent worker-version change misses the old key without a partial lookup',async()=>{
  await source();
  for(const name of Object.keys(cacheVersions())) {
    const f=await cacheRequest(db,await scanCacheCard(db)), before=await completionFootprint(db);
    let response, failure;
    try { response=await reuseCatalogueCache(db,f,cacheVersions({[name]:'unsupported-version-v2'})); }
    catch(e) { failure=e; }
    if(failure) assert.match(failure.code??'',/^(P[0-9A-Z]|22)[0-9A-Z]{3}$/,'unsupported versions must fail validation, not object resolution');
    else assert.deepEqual(response,{status:'miss'},name);
    assert.equal(await completionFootprint(db),before,name);
  }
  const exact=await cacheRequest(db,await scanCacheCard(db)); await hit(exact); await resetActor(db);
  const stored=(await db.query('SELECT * FROM public.phase9_metadata_lookups WHERE job_id=$1',[exact.jobId])).rows[0];
  for(const [column,key] of [['adapter_key','adapterKey'],['adapter_version','adapterVersion'],['capability_version','capabilityVersion'],
    ['normalizer_version','normalizerVersion'],['schema_version','schemaVersion'],['routing_policy_version','routingPolicyVersion'],
    ['cache_policy_version','cachePolicyVersion'],['reuse_policy_version','reusePolicyVersion']]) assert.equal(stored[column],cacheVersions()[key],column);
});

test('AC7-8/16: reuse refuses foreign scope and stale fences without private/cache effects',async()=>{
  const a=await source();
  for(const [label,index,value] of [['store',5,a.storeId],['candidate',4,a.candidateId],['session',6,a.sessionId],
    ['request',7,a.jobId],['claim token',2,'b'.repeat(64)],['query',9,'foreign-query']]) {
    const f=await cacheRequest(db,await scanCacheCard(db)), before=await completionFootprint(db);
    const parameters=[...fence(f),cacheVersions()]; parameters[index]=value;
    await setActor(db,f.ownerId,'service_role'); let result, failure;
    try { result=await rpc(db,'phase9_reuse_candidate_edition_cache_v1',parameters); } catch(e) { failure=e; }
    if(failure) assert.match(failure.code??'',/^(P[0-9A-Z]|22)[0-9A-Z]{3}$/,label);
    else assert.ok(result && !['completed','replayed'].includes(result.status),label);
    assert.equal(await completionFootprint(db),before,label);
  }
});

test('AC7-15/16: deferred guard refuses a cache-hit transaction whose matching private receipt is removed',async()=>{
  await source(); const f=await cacheRequest(db,await scanCacheCard(db)); await hit(f);
  const saved=await effect(f), before=await completionFootprint(db); await resetActor(db);
  await db.exec('BEGIN');
  try {
    await db.query('UPDATE public.phase9_metadata_lookups SET normalized_outcome=normalized_outcome WHERE id=$1',[saved.lookup_id]);
    await db.query('DELETE FROM marketplace_sec.phase9_catalogue_lookup_effects WHERE lookup_id=$1',[saved.lookup_id]);
    await assert.rejects(()=>db.exec('SET CONSTRAINTS ALL IMMEDIATE'),e=>/^(P[0-9A-Z]|23)[0-9A-Z]{3}$/.test(e.code??''));
  } finally { await db.exec('ROLLBACK'); }
  assert.equal(await completionFootprint(db),before);
});


test('AC7-3/11/17: cache-selected original facts survive option cleanup and link at delayed Add',async()=>{
  const a=await source(), f=await cacheRequest(db,await scanCacheCard(db)); await hit(f);
  const original=await state(f), option=original.options[0]; await setActor(db,f.ownerId);
  await scalar(db,selectSql(f,await scalar(db,readSql(f)),option.optionId)); await saveReview(db,f);
  const newer=await catalogueBatch(db,{},null,{existing:f,recordBase:200,workExternalId:'OL701W'});
  assert.equal((await complete(db,newer,{rows:newer.rows,fetched:newer.fetched,deadline:newer.deadline})).status,'completed');
  await resetActor(db);
  const preserved=(await state(f)).selected_option_snapshot; assert.deepEqual(preserved,option.metadata);
  const bound=(await db.query(`SELECT companion FROM marketplace_sec.phase9_catalogue_companions
    WHERE lookup_id=$1 AND option_id=$2`,[original.source_lookup_id,option.optionId])).rows[0];
  assert.ok(bound,'cache reuse must bind a receiving private companion for delayed Add');
  assert.equal(bound.companion.lookupId,original.source_lookup_id);
  assert.notEqual(bound.companion.lookupId,a.lookupId);
  await db.query(`UPDATE public.phase9_candidate_edition_state SET options='[]',source_lookup_id=NULL,
    source_attempt_id=NULL,source_fetched_at=NULL,options_expires_at=NULL WHERE candidate_id=$1`,[f.candidateId]);
  await setActor(db,f.ownerId); await saveReview(db,f); const committed=await add(db,f);
  assert.notEqual(committed.item.canonical_edition_id,null); assert.notEqual(committed.item.canonical_work_id,null);
  await resetActor(db);
  const record=(await db.query(`SELECT provider_book_id FROM public.book_metadata_sources WHERE canonical_edition_id=$1`,
    [committed.item.canonical_edition_id])).rows[0];
  assert.equal(record.provider_book_id,option.metadata.providerRecordId);
});

test('AC7-26: identical query text is public only with untouched real scan provenance',async()=>{
  const operations=[];
  for(const origin of ['scan','typed','confirmed','edited','unknown','provider-facts-only']) {
    let card=null;
    if(origin!=='typed') {
      card=await scanCacheCard(db);
      if(origin==='confirmed'||origin==='edited') {
        const review={...card.review,originalTitle:card.facts.title,authors:card.facts.authors,
          originalLanguage:card.facts.language,originalFieldConfirmation:{title:true,authors:[true,true]}};
        await setActor(db,card.ownerId);
        if(origin==='edited') await saveReview(db,card,{...review,originalTitle:'Private draft title'});
        await saveReview(db,card,review);
      }
      if(origin==='unknown'||origin==='provider-facts-only') {
        await resetActor(db);
        await db.query(`UPDATE public.image_extraction_candidates SET input_id=NULL,vision_job_id=NULL,
          analysis_observation_id=NULL,analysis_schema_version=NULL WHERE id=$1`,[card.candidateId]);
      }
    }
    const operation=await catalogueBatch(db,{},null,{existing:card});
    if(origin==='scan'||origin==='provider-facts-only')
      assert.equal((await completeCatalogueV2(db,operation)).status,'completed');
    await resetActor(db);
    const candidate=(await db.query(`SELECT owner_review_snapshot,analysis_observation_id
      FROM public.image_extraction_candidates WHERE id=$1`,[operation.candidateId])).rows[0];
    assert.equal(candidate.owner_review_snapshot!==null,['typed','confirmed','edited'].includes(origin),origin);
    assert.equal(candidate.analysis_observation_id!==null,['scan','confirmed','edited'].includes(origin),origin);
    operations.push({origin,...operation});
  }
  assert.equal(new Set(operations.map(f=>f.context.queryIdentity)).size,1,'only provenance differs, not final query identity');
  await requireM85(db,'marketplace_sec.phase9_catalogue_query_scope_v1(uuid,uuid)');
  for(const f of operations) {
    const scope=(await db.query('SELECT marketplace_sec.phase9_catalogue_query_scope_v1($1,$2) AS scope',
      [f.candidateId,f.lookupId])).rows[0].scope;
    assert.equal(scope,f.origin==='scan'?'public_bibliographic':'store_private',f.origin);
  }
});
