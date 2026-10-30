// 02c §9 AC8-13; reuse M88 origin construction independently of synthetic installation.
import assert from 'node:assert/strict';
import {after,before,beforeEach,test} from 'node:test';
import {clean,createProviderDatabase,resetActor,setActor,value} from './providerReplacementFixture.mjs';
import {cacheRequest,catalogueBatch,completeCatalogueV2,reuseCatalogueCache,scanCacheCard} from './leanCatalogueFixture.mjs';
import {readSql,saveReview} from './catalogueLinkFixture.mjs';
import {clearCatalogueOptions,completionFootprint} from './leanCatalogueCompletionFixture.mjs';
let db;
before(async()=>{db=await createProviderDatabase();});
beforeEach(async()=>{await clean(db);});
after(async()=>{await db?.close();});
async function originCard(origin) {
  const f=await scanCacheCard(db);await resetActor(db);
  if(['typed','unknown'].includes(origin)) await db.query(`UPDATE public.image_extraction_candidates SET input_id=NULL,
    vision_job_id=NULL,analysis_observation_id=NULL,analysis_schema_version=NULL WHERE id=$1`,[f.candidateId]);
  if(['typed','confirmed','edited'].includes(origin)) {
    const review={...f.review,originalTitle:f.facts.title,authors:f.facts.authors,originalLanguage:f.facts.language,
      originalFieldConfirmation:{title:true,authors:[true,true]}};
    await setActor(db,f.ownerId);
    if(origin==='edited')await saveReview(db,f,{...review,originalTitle:'Private draft title'});
    await saveReview(db,f,review);
  }
  return f;
}
for(const origin of ['scan','typed','confirmed','edited','unknown']) for(const direction of [0,1])
test(`AC8-13 GREEN-control ${origin} explicit cache ${direction?'B-to-A':'A-to-B'} scope and receiving lineage`,async()=>{
  const cards=[await originCard(origin),await originCard(origin)];
  const a=await catalogueBatch(db,{},null,{existing:cards[direction]});await completeCatalogueV2(db,a);await resetActor(db);
  const entry=await value(db,`SELECT to_jsonb(c) FROM public.phase9_metadata_cache_entries c JOIN
    marketplace_sec.phase9_catalogue_lookup_effects e ON e.cache_entry_id=c.id WHERE e.lookup_id=$1`,[a.lookupId]);
  assert.ok(entry);assert.equal(entry.privacy_scope,origin==='scan'?'public_bibliographic':'store_private');
  const b=await cacheRequest(db,cards[1-direction]),before=await completionFootprint(db);
  assert.notEqual(a.storeId,b.storeId);assert.equal(a.context.queryIdentity,b.context.queryIdentity);
  const result=await reuseCatalogueCache(db,b);
  if(origin==='scan') {
    assert.equal(result.status,'completed');await resetActor(db);
    const l=(await db.query('SELECT * FROM public.phase9_metadata_lookups WHERE job_id=$1',[b.jobId])).rows[0];
    const attempts=(await db.query('SELECT * FROM public.metadata_enrichment_attempts WHERE lookup_id=$1',[l.id])).rows;
    assert.equal(l.candidate_id,b.candidateId);assert.equal(l.store_id,b.storeId);assert.notEqual(l.id,a.lookupId);
    assert.ok(attempts.length);assert.ok(attempts.every(r=>r.store_id===b.storeId && r.id!==a.attemptId));
    assert.equal(await value(db,'SELECT count(*)::int FROM public.phase9_metadata_provider_calls WHERE job_id=$1',[b.jobId]),0);
    assert.equal(await value(db,'SELECT count(*)::int FROM public.phase9_usage_reservations WHERE job_id=$1',[b.jobId]),0);
  } else {
    assert.deepEqual(result,{status:'miss'});assert.equal(await completionFootprint(db),before);
    await clearCatalogueOptions(db,a);const own=await cacheRequest(db,a);
    assert.equal((await reuseCatalogueCache(db,own)).status,'completed','private entry remains usable by its own store');
  }
  await setActor(db,b.ownerId);const choices=JSON.stringify(await value(db,readSql(b)));
  for(const id of [a.storeId,a.candidateId,a.lookupId,a.attemptId,...a.rows.map(r=>r.optionId)])assert.equal(choices.includes(id),false,id);
});
test('AC8-13 GATED OQ8-11 provider-facts-only origin remains UNPROVEN',
  {skip:'GATED OQ8-11: no distinct persisted producer; never relabel unknown as proof'},()=>{});
test('AC8-13 NEEDS-OBJECT 02d prefill privacy negatives: typed/confirmed/edited/unknown never publish publicly',
  {todo:'NEEDS-OBJECT separately approved 02d prefill transaction and recorded origin fixtures'},()=>{});
