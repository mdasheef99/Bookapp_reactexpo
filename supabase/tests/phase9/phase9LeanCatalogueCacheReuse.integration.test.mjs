// 02b sections 4.5/5/7.2/8/11: M87 green targets; real SQL, no provider HTTP.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { cacheRequest, cacheVersions, catalogueBatch, completeCatalogueV2, createLeanDatabase,
  asRole, requireM87, reuseCatalogueCache, scanCacheCard } from './leanCatalogueFixture.mjs';
import { add, enableOL, olOperation, readSql, resetActor, saveReview, scalar, seedIncumbent, selectSql, setActor } from './catalogueLinkFixture.mjs';
import { complete, fence, recover, rpc, token, worker } from './editionOptionsCompletionFixture.mjs';
import { seedCard } from './editionPickerFixture.mjs';
import { clearCatalogueOptions, completionFootprint } from './leanCatalogueCompletionFixture.mjs';

let db;
before(async()=>{db=await createLeanDatabase({m88:true});});
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
  assert.notEqual(saved.cache_entry_id,null,'M86 completion must publish an admitted edition-list cache entry');
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

// 02b sections 6.1/8.2, AC7-6: an ISBN-only hidden match must retain neighbours.
for(const [formatted,canonical] of [['0-306-40615-2','0306406152'],['0-8044-2957-x','080442957X']])
for(const hidden of [true,false])
test(`AC7-6: reuse normalizes ISBN-10 ${formatted}, hidden=${hidden}`,async()=>{
  const f=await catalogueBatch(db,{},null,{existing:await scanCacheCard(db)}), option=f.rows[4];
  option.metadata={...option.metadata,isbn10:formatted,isbn13:null};
  const target=await seedIncumbent(db,{...option.metadata,isbn10:canonical});
  assert.equal((await completeCatalogueV2(db,f)).status,'completed'); await resetActor(db);
  await db.query('UPDATE public.canonical_editions SET hidden=$2 WHERE id=$1',[target.editionId,hidden]);
  assert.equal(await scalar(db,`SELECT count(*)::int FROM public.canonical_provider_ids
    WHERE canonical_edition_id='${target.editionId}' AND adapter_key='open_library'`),0);
  const receiver=await cacheRequest(db,await scanCacheCard(db)); await hit(receiver);
  assert.equal((await state(receiver)).options.some(r=>r.metadata?.providerRecordId===option.metadata.providerRecordId),!hidden);
});

// 02b ?8.2 inherits existing claim/fence validation; unrelated raises cannot prove refusal.
async function refusal(action, reasons) {
  let response;
  try { response=await action(); }
  catch(error) {
    assert.equal(error.code,'P0001'); assert.ok(reasons.includes(error.message),error.message); return;
  }
  assert.deepEqual(response,{status:'miss'});
}

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
  await source(); const card=await scanCacheCard(db), jobs=new Set(), lookups=new Set(), attempts=new Set();
  for(let n=0;n<12;n++) {
    if(n>0) await clearCatalogueOptions(db,card);
    const f=await cacheRequest(db,card); await hit(f); const s=await state(f);
    jobs.add(f.jobId); lookups.add(s.source_lookup_id); attempts.add(s.source_attempt_id);
    const before=await completionFootprint(db);
    assert.equal((await reuseCatalogueCache(db,f)).status,'replayed'); assert.equal(await completionFootprint(db),before);
  }
  assert.equal(jobs.size,12); assert.equal(lookups.size,12); assert.equal(attempts.size,12); await resetActor(db);
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

test('AC7-6: hiding all discoverable cached editions makes reuse miss without partial effects',async()=>{
  const a=await source(); await resetActor(db);
  await db.query('UPDATE public.canonical_editions SET hidden=true');
  const b=await cacheRequest(db,await scanCacheCard(db)), before=await completionFootprint(db);
  assert.deepEqual(await reuseCatalogueCache(db,b),{status:'miss'}); assert.equal(await completionFootprint(db),before);
  assert.equal((await effect(a)).cache_entry_id,a.entry.id);
});

// 02b sections 6.2/8.2 AC7-6: deterministic interleaving hook in this disposable DB.
test('AC7-6: hide after tentative filtering is rechecked under resolved edition locks',async()=>{
  await source(); const f=await cacheRequest(db,await scanCacheCard(db)), before=await completionFootprint(db);
  await resetActor(db);
  await db.exec(`CREATE FUNCTION public.phase9_test_hide_before_cache_locks() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN UPDATE public.canonical_editions SET hidden=true; RETURN NEW; END$$;
    CREATE TRIGGER phase9_test_hide_before_cache_locks BEFORE INSERT ON public.phase9_metadata_lookups
      FOR EACH ROW WHEN (NEW.execution_mode='cache_hit') EXECUTE FUNCTION public.phase9_test_hide_before_cache_locks()`);
  try { assert.deepEqual(await reuseCatalogueCache(db,f),{status:'miss'}); }
  finally { await resetActor(db); await db.exec(`DROP TRIGGER phase9_test_hide_before_cache_locks ON public.phase9_metadata_lookups;
    DROP FUNCTION public.phase9_test_hide_before_cache_locks()`); }
  assert.equal(await completionFootprint(db),before,'post-lock refusal rolls back the whole reuse subtransaction');
  await hit(f);
});

for(const kind of ['ineligible','conflict-skipped'])
test(`AC7-6: final reuse recheck covers a ${kind} row after tentative filtering`,async()=>{
  const a=await catalogueBatch(db,{},null,{existing:await scanCacheCard(db)}), option=a.rows[kind==='ineligible'?4:0];
  option.metadata={...option.metadata,isbn10:'0-306-40615-2',isbn13:null};
  const target=await seedIncumbent(db,{...option.metadata,title:'Different canonical work',isbn10:'0306406152'});
  assert.equal((await completeCatalogueV2(db,a)).status,'completed'); await resetActor(db);
  const f=await cacheRequest(db,await scanCacheCard(db)), before=await completionFootprint(db);
  await db.exec(`CREATE FUNCTION public.phase9_test_hide_retained_row() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN UPDATE public.canonical_editions SET hidden=true WHERE id='${target.editionId}'; RETURN NEW; END$$;
    CREATE TRIGGER phase9_test_hide_retained_row BEFORE INSERT ON public.phase9_metadata_lookups
      FOR EACH ROW WHEN (NEW.execution_mode='cache_hit') EXECUTE FUNCTION public.phase9_test_hide_retained_row()`);
  try { assert.deepEqual(await reuseCatalogueCache(db,f),{status:'miss'}); }
  finally { await resetActor(db); await db.exec(`DROP TRIGGER phase9_test_hide_retained_row ON public.phase9_metadata_lookups;
    DROP FUNCTION public.phase9_test_hide_retained_row()`); }
  assert.equal(await completionFootprint(db),before,'late hidden match rolls back all private and shared effects');
  await hit(f); // Rollback leaves the same job reusable, including its visible row.
  assert.equal((await state(f)).options.some(r=>r.metadata?.providerRecordId===option.metadata.providerRecordId),true);
});

test('AC7-16: unresolved external work cannot be replaced by cache reuse',async()=>{
  await source(); const f=await olOperation(db,{isbn10:null,isbn13:null},false,false,await scanCacheCard(db));
  const before=await completionFootprint(db); await requireM87(db,'public.phase9_reuse_candidate_edition_cache_v1');
  await refusal(()=>reuseCatalogueCache(db,f),['P9_STATE_CONFLICT','P9_METADATA_REUSE_DENIED']);
  const pending=(await db.query('SELECT completed_at,outcome_source_attempt_id FROM public.phase9_metadata_lookups WHERE id=$1',[f.lookupId])).rows[0];
  assert.deepEqual(pending,{completed_at:null,outcome_source_attempt_id:null});
  assert.equal(await completionFootprint(db),before);
  const clean=await cacheRequest(db,await scanCacheCard(db)); await hit(clean);
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
    assert.deepEqual(await reuseCatalogueCache(db,f,cacheVersions({[name]:'unsupported-version-v2'})),{status:'miss'},name);
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
    // The unchanged M84 fence supplies the exact refusal reason for this malformed request.
    await setActor(db,f.ownerId,'service_role');
    if(label==='request') {
      const invalid=e=>e.code==='P0001' && e.message==='P9_REQUEST_INVALID';
      await assert.rejects(()=>rpc(db,'phase9_recover_candidate_edition_options_v1',parameters.slice(0,10)),invalid);
      await assert.rejects(()=>rpc(db,'phase9_reuse_candidate_edition_cache_v1',parameters),invalid);
    } else {
      assert.deepEqual(await rpc(db,'phase9_recover_candidate_edition_options_v1',parameters.slice(0,10)),{status:'stale_rejected'},label);
      assert.deepEqual(await rpc(db,'phase9_reuse_candidate_edition_cache_v1',parameters),{status:'miss'},label);
    }
    assert.equal(await completionFootprint(db),before,label);
    await hit(f); // Equivalent current fence must succeed for the same receiver.
  }
});

test('AC7-15/16: deferred guard refuses a cache-hit transaction whose matching private receipt is removed',async()=>{
  await source(); const f=await cacheRequest(db,await scanCacheCard(db)); await hit(f);
  const saved=await effect(f), before=await completionFootprint(db); await resetActor(db);
  await db.exec('BEGIN');
  await db.query('UPDATE public.phase9_metadata_lookups SET normalized_outcome=normalized_outcome WHERE id=$1',[saved.lookup_id]);
  await db.exec('SET CONSTRAINTS ALL IMMEDIATE; COMMIT'); // Intact receipt succeeds.
  await db.exec('BEGIN');
  try {
    await db.query('UPDATE public.phase9_metadata_lookups SET normalized_outcome=normalized_outcome WHERE id=$1',[saved.lookup_id]);
    await db.query('DELETE FROM marketplace_sec.phase9_catalogue_lookup_effects WHERE lookup_id=$1',[saved.lookup_id]);
    await assert.rejects(()=>db.exec('SET CONSTRAINTS ALL IMMEDIATE'),e=>
      ['P0001','23514'].includes(e.code) && /phase9_catalogue_cache_receipt_guard/.test(e.where??''));
  } finally { await db.exec('ROLLBACK'); }
  assert.equal(await completionFootprint(db),before);
});

// 02b section 8.2: test final transaction state, with real persisted hit lineage.
test('AC7-15/16: receipt guard rejects job usage, job call and sequence two at COMMIT',async()=>{
  const a=await source(), f=await cacheRequest(db,await scanCacheCard(db)); await hit(f);
  const saved=await effect(f), before=await completionFootprint(db);
  const touch=()=>db.query('UPDATE public.phase9_metadata_lookups SET normalized_outcome=normalized_outcome WHERE id=$1',[saved.lookup_id]);
  await db.exec('BEGIN'); await touch(); await db.exec('COMMIT'); // Positive control.
  for(const arm of ['usage','call','sequence']) {
    await db.exec('BEGIN');
    try {
      await touch();
      if(arm==='sequence') await db.query('UPDATE public.metadata_enrichment_attempts SET attempt_sequence=2 WHERE lookup_id=$1',[saved.lookup_id]);
      else {
        const table=arm==='usage'?'phase9_usage_reservations':'phase9_metadata_provider_calls';
        const changes={id:randomUUID(),job_id:f.jobId,store_id:f.storeId,
          ...(arm==='usage'?{}:{physical_call_identity:randomUUID(),candidate_id:f.candidateId,
            edition_call_sequence:null,edition_call_stage:null})};
        // Keep the donor logical attempt: the call arm specifically proves job_id denial.
        await db.query(`INSERT INTO public.${table} SELECT patched.* FROM public.${table} donor
          CROSS JOIN LATERAL jsonb_populate_record(NULL::public.${table},to_jsonb(donor)||$1::jsonb) patched
          WHERE donor.job_id=$2 LIMIT 1`,[changes,a.jobId]);
        assert.equal(await scalar(db,`SELECT count(*)::int FROM public.${table} WHERE job_id='${f.jobId}'`),1);
      }
      await assert.rejects(()=>db.exec('COMMIT'),e=>e.code==='P0001' && e.message==='P9_EDITION_CACHE_RECEIPT_REQUIRED',arm);
    } finally { await db.exec('ROLLBACK'); }
    assert.equal(await completionFootprint(db),before,arm);
  }
  await db.exec('BEGIN');
  try {
    // The existing automatic-payload BEFORE trigger refuses public lookup
    // scope before COMMIT; the immediate CHECK backs up the same boundary.
    await assert.rejects(()=>db.query("UPDATE public.phase9_metadata_lookups SET privacy_scope='public_bibliographic' WHERE id=$1",
      [saved.lookup_id]),e=>e.code==='P0001' && e.message==='P9_STATE_CONFLICT'
        && /phase9_edition_guard_automatic_payload/.test(e.where??''));
  } finally { await db.exec('ROLLBACK'); }
  assert.equal(await completionFootprint(db),before);
});

test('AC7-15/16: hostile reuse versions refuse without any partial effects',async()=>{
  await source(); const f=await cacheRequest(db,await scanCacheCard(db)), before=await completionFootprint(db);
  const valid=cacheVersions(), text=JSON.stringify(valid);
  const cases=[Object.assign({},valid,Object.fromEntries(Array.from({length:8192},(_,i)=>['key'+i,'x']))),
    Array(8192).fill(valid),{...valid,'版本\u200d':'x'},{...valid,reusePolicyVersion:1e308},
    text.slice(0,-1)+',"reusePolicyVersion":1e1000}']; // jsonb retains the last duplicate.
  for(const versions of cases) {
    await assert.rejects(()=>reuseCatalogueCache(db,f,versions),e=>e.code==='P0001' && e.message==='P9_REQUEST_INVALID');
    assert.equal(await completionFootprint(db),before);
  }
  await hit(f); // Refusals leave the same request usable.
});


test('AC7-3/11/17: cache-selected original facts survive option cleanup and link at delayed Add',async()=>{
  const a=await source(), f=await cacheRequest(db,await scanCacheCard(db)); await hit(f);
  const original=await state(f), option=original.options[0]; await setActor(db,f.ownerId);
  const selected=await scalar(db,selectSql(f,await scalar(db,readSql(f)),option.optionId));
  await saveReview(db,f,{...f.review,originalTitle:f.facts.title,authors:f.facts.authors,
    originalLanguage:f.facts.language,script:f.facts.script,
    originalFieldConfirmation:{title:true,authors:f.facts.authors.map(()=>true)},
    metadataChoice:{mode:'edition_option',selectionId:selected.selection.selectionId}});
  await clearCatalogueOptions(db,f);
  const newer=await catalogueBatch(db,{},null,{existing:f,recordBase:200,workExternalId:'OL701W'});
  assert.notEqual(newer.lookupId,original.source_lookup_id); assert.notEqual(newer.jobId,f.jobId);
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

test('AC7-11/16: M73 policy accepts genuine cache-only lineage and refuses it without the matching private receipt',async()=>{
  await source(); const f=await cacheRequest(db,await scanCacheCard(db));
  assert.equal((await reuseCatalogueCache(db,f)).status,'completed'); await resetActor(db);
  const policy=()=>db.query(`SELECT marketplace_sec.phase9_edition_source_policy(s) AS admitted
    FROM public.phase9_candidate_edition_state s WHERE candidate_id=$1`,[f.candidateId]);
  assert.equal((await policy()).rows[0].admitted,true);
  const state=(await db.query('SELECT source_lookup_id FROM public.phase9_candidate_edition_state WHERE candidate_id=$1',[f.candidateId])).rows[0];
  await db.query('DELETE FROM marketplace_sec.phase9_catalogue_lookup_effects WHERE lookup_id=$1',[state.source_lookup_id]);
  assert.equal((await policy()).rows[0].admitted,false,'a cache-hit flag without its private receipt grants no lineage');
});

test('AC7-8/10: reuse wrappers are service-only and preserve invoker/definer boundary',async()=>{
  const signature='phase9_reuse_candidate_edition_cache_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,jsonb)';
  for(const schema of ['public','marketplace_sec']) {
    const name=schema+'.'+signature; await requireM87(db,name);
    const row=(await db.query('SELECT p.prosecdef,p.proconfig,r.rolname FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid=to_regprocedure($1)',[name])).rows[0];
    assert.equal(row.rolname,'postgres'); assert.ok(row.proconfig.includes('search_path=""'));
    assert.equal(row.prosecdef,schema==='marketplace_sec');
    for(const role of ['anon','authenticated','service_role'])
      assert.equal((await db.query('SELECT has_function_privilege($1,$2,\'EXECUTE\') AS allowed',[role,name])).rows[0].allowed,role==='service_role');
    for(const role of ['anon','authenticated']) await asRole(db,role,null,async()=>{
      await assert.rejects(()=>db.query(`SELECT ${schema}.phase9_reuse_candidate_edition_cache_v1(
        NULL::uuid,NULL::text,NULL::text,NULL::integer,NULL::uuid,NULL::uuid,NULL::uuid,NULL::uuid,NULL::integer,NULL::text,NULL::jsonb)`),e=>e.code==='42501');
    });
  }
});


// 02b ?8.2 / AC7-6: filtering must retain usable neighbours.
test('AC7-6: reuse drops hidden editions and returns visible cached neighbours',async()=>{
  const a=await source(), results=(await effect(a)).canonical_results;
  const targets=results.filter(r=>r.canonicalEditionId); assert.ok(targets.length>=2);
  await db.query('UPDATE public.canonical_editions SET hidden=true WHERE id=$1',[targets[0].canonicalEditionId]);
  const f=await cacheRequest(db,await scanCacheCard(db)); await hit(f);
  const options=(await state(f)).options, hidden=a.rows.find(r=>r.optionId===targets[0].optionId);
  assert.ok(hidden?.metadata); assert.equal(options.some(r=>r.metadata?.providerRecordId===hidden.metadata.providerRecordId),false);
  const visible=a.rows.filter(r=>r.metadata && r.optionId!==hidden.optionId).map(r=>r.metadata.providerRecordId);
  assert.deepEqual(options.filter(r=>r.metadata).map(r=>r.metadata.providerRecordId),visible);
});

test('AC7-8: M87 reuse core is postgres-owned with private effective privileges',async()=>{
  const name='marketplace_sec.phase9_catalogue_reuse_cache_core_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,jsonb,jsonb)';
  await requireM87(db,name);
  const f=(await db.query(`SELECT r.rolname,p.proconfig,p.prosecdef FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
    WHERE p.oid=to_regprocedure($1)`,[name])).rows[0];
  assert.equal(f.rolname,'postgres'); assert.equal(f.prosecdef,true); assert.ok(f.proconfig.includes('search_path=""'));
  for(const role of ['anon','authenticated','service_role']) await asRole(db,role,null,async()=>{
    await assert.rejects(()=>db.query(`SELECT marketplace_sec.phase9_catalogue_reuse_cache_core_v1(
      NULL::uuid,NULL::text,NULL::text,NULL::integer,NULL::uuid,NULL::uuid,NULL::uuid,NULL::uuid,NULL::integer,NULL::text,NULL::jsonb,NULL::jsonb)`),e=>e.code==='42501');
  });
});
