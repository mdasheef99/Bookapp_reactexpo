// 02c §4.2 AC8-12 G/H: genuine old receipts + explicitly bounded historical row.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createProviderDatabase,footprint,resetActor,setActor,sourcePolicy,value} from './providerReplacementFixture.mjs';
import {legacyGoogleCache} from './providerLegacyCacheFixture.mjs';
import {fence} from './editionOptionsCompletionFixture.mjs';
for(const scope of ['public_bibliographic','store_private'])for(const boundary of ['publication early return','reuse'])
test(`AC8-12 ${boundary==='reuse'?'H':'G'} [8a-2/4] Google ${scope} ${boundary} denies a historical cache`,async()=>{
  const db=await createProviderDatabase({beforeMigrations:d=>legacyGoogleCache(d,scope)});
  try {
    const {f,receiving,versions,policy}=db.legacyFixture;
    await resetActor(db);const before=await footprint(db);
    if(boundary==='publication early return')assert.equal(await value(db,
      'SELECT marketplace_sec.phase9_catalogue_store_cache_v1($1,$2)',[f.lookupId,policy]),null,
      'Google publication veto must precede an existing cache-entry hint');
    else {await db.exec(`SELECT set_config('request.jwt.claim.sub','${receiving.ownerId}',false);
      SELECT set_config('request.jwt.claim.role','service_role',false)`);
      assert.deepEqual(await value(db,'SELECT marketplace_sec.phase9_catalogue_reuse_cache_core_v1('+Array.from({length:12},(_,i)=>'$'+(i+1)).join(',')+')',
      [...fence(receiving),versions,policy]),{status:'miss'},'Google historical typed cache must not be reused in either scope');
    }
    assert.deepEqual(await footprint(db),before,'veto leaves existing cache and all shared/private effects unchanged');
  } finally {await db.close();}
});

test('AC8-12 G/H GREEN-control admitted OL publishes and reuses a usable cache',async()=>{
  const db=await createProviderDatabase();
  try {
    const {catalogueBatch,completeCatalogueV2}=await import('./leanCatalogueFixture.mjs');
    const {clearCatalogueOptions}=await import('./leanCatalogueCompletionFixture.mjs');
    const {cacheRequest,reuseCatalogueCache}=await import('./leanCatalogueCacheFixture.mjs');
    const f=await catalogueBatch(db);await completeCatalogueV2(db,f);
    const policy=await sourcePolicy(db,f.rows[0].metadata);
    assert.ok(await value(db,'SELECT marketplace_sec.phase9_catalogue_store_cache_v1($1,$2)',[f.lookupId,policy]));
    await clearCatalogueOptions(db,f);const next=await cacheRequest(db,f);
    assert.equal((await reuseCatalogueCache(db,next)).status,'completed');
  }finally{await db.close();}
});
