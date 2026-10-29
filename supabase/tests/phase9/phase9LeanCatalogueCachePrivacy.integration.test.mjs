// 02b ??8.1-8.2/12, AC7-7/26: M87 cross-store provenance matrix.
import assert from 'node:assert/strict';
import { after,before,beforeEach,test } from 'node:test';
import { cacheRequest,catalogueBatch,completeCatalogueV2,createLeanDatabase,reuseCatalogueCache,
  scanCacheCard,requireM86 } from './leanCatalogueFixture.mjs';
import { enableOL,readSql,resetActor,saveReview,scalar,setActor } from './catalogueLinkFixture.mjs';
import { clearCatalogueOptions, completionFootprint } from './leanCatalogueCompletionFixture.mjs';
let db;
before(async()=>{db=await createLeanDatabase({m88:true});});
beforeEach(async()=>{await resetActor(db); await db.exec(
  'TRUNCATE public.stores,public.canonical_works,public.canonical_editions,public.phase9_metadata_cache_entries CASCADE'); await enableOL(db);});
after(async()=>{await db?.close();});
async function originCard(origin) {
  const card=await scanCacheCard(db);
  if(['typed','unknown'].includes(origin)) {
    await resetActor(db);
    await db.query(`UPDATE public.image_extraction_candidates SET input_id=NULL,vision_job_id=NULL,
      analysis_observation_id=NULL,analysis_schema_version=NULL WHERE id=$1`,[card.candidateId]);
  }
  if(['typed','confirmed','edited'].includes(origin)) {
    const review={...card.review,originalTitle:card.facts.title,authors:card.facts.authors,
      originalLanguage:card.facts.language,originalFieldConfirmation:{title:true,authors:[true,true]}};
    await setActor(db,card.ownerId);
    if(origin==='edited') await saveReview(db,card,{...review,originalTitle:'Private draft title'});
    await saveReview(db,card,review);
  }
  return card;
}
async function publish(card) {
  const f=await catalogueBatch(db,{},null,{existing:card});
  assert.equal((await completeCatalogueV2(db,f)).status,'completed'); await resetActor(db);
  const receipt=(await db.query('SELECT * FROM marketplace_sec.phase9_catalogue_lookup_effects WHERE lookup_id=$1',[f.lookupId])).rows[0];
  assert.ok(receipt,'real M84 effect must exist');
  assert.notEqual(receipt.cache_entry_id,null,'M86 must publish the real scoped query');
  const entry=(await db.query('SELECT * FROM public.phase9_metadata_cache_entries WHERE id=$1',[receipt.cache_entry_id])).rows[0];
  return {...f,entry};
}
test('[baseline] privacy origins construct distinct observation and Owner-review states',async()=>{
  let queryIdentity;
  for(const origin of ['scan','typed','confirmed','edited','unknown']) {
    const f=await originCard(origin); await resetActor(db);
    const c=(await db.query('SELECT analysis_observation_id,owner_review_snapshot FROM public.image_extraction_candidates WHERE id=$1',[f.candidateId])).rows[0];
    assert.equal(c.analysis_observation_id!==null,['scan','confirmed','edited'].includes(origin),origin);
    assert.equal(c.owner_review_snapshot!==null,['typed','confirmed','edited'].includes(origin),origin);
    const request=await cacheRequest(db,f); queryIdentity??=request.context.queryIdentity;
    assert.equal(request.context.queryIdentity,queryIdentity,'all real origins must send the same query text');
  }
});
for(const origin of ['typed','confirmed','edited','unknown'])
for(const [direction,publisher] of [['A-to-B',0],['B-to-A',1]])
test(`AC7-26: ${origin} publication refuses cross-store reuse ${direction}`,async()=>{
  const cards=[await originCard(origin),await originCard(origin)];
  const a=await publish(cards[publisher]);
  const b=await cacheRequest(db,cards[1-publisher]);
  assert.notEqual(a.storeId,b.storeId); assert.equal(a.context.queryIdentity,b.context.queryIdentity);
  assert.equal(a.entry.privacy_scope,'store_private');
  assert.equal(a.entry.store_id,a.storeId);
  await requireM86(db,'marketplace_sec.phase9_catalogue_query_scope_v1(uuid,uuid)');
  // A requested lookup need not exist before reuse; use the persisted publisher for helper proof.
  const scope=(await db.query('SELECT marketplace_sec.phase9_catalogue_query_scope_v1($1,$2) AS scope',[a.candidateId,a.lookupId])).rows[0].scope;
  assert.equal(scope,a.entry.privacy_scope);
  const before=await completionFootprint(db);
  assert.deepEqual(await reuseCatalogueCache(db,b),{status:'miss'});
  assert.equal(await completionFootprint(db),before,'miss creates no receiving IDs/options/receipt/usage');
  await setActor(db,b.ownerId); const choices=await scalar(db,readSql(b));
  for(const id of [a.storeId,a.candidateId,a.lookupId,a.attemptId,...a.rows.map(r=>r.optionId)])
    assert.equal(JSON.stringify(choices).includes(id),false);
  // Same-store reuse succeeds: the scoped entry is real and usable.
  await clearCatalogueOptions(db,a);
  const own=await cacheRequest(db,a); assert.notEqual(own.jobId,a.jobId);
  assert.equal((await reuseCatalogueCache(db,own)).status,'completed'); await resetActor(db);
  const usage=(await db.query(`SELECT
    (SELECT count(*)::int FROM public.phase9_metadata_provider_calls WHERE job_id=$1) AS calls,
    (SELECT count(*)::int FROM public.phase9_usage_reservations WHERE job_id=$1) AS reservations`,[own.jobId])).rows[0];
  assert.deepEqual(usage,{calls:0,reservations:0});
});
test('AC7-7/26: scan publication hits across stores in both directions',async()=>{
  for(let direction=0;direction<2;direction++) {
    const cards=[await originCard('scan'),await originCard('scan')];
    const a=await publish(cards[direction]), b=await cacheRequest(db,cards[1-direction]);
    assert.notEqual(a.storeId,b.storeId); assert.equal(a.context.queryIdentity,b.context.queryIdentity);
    assert.equal(a.entry.privacy_scope,'public_bibliographic');
    assert.equal((await reuseCatalogueCache(db,b)).status,'completed');
  }
});
