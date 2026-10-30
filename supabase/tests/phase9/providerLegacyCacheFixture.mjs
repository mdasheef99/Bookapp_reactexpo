// 02c §4.2 AC8-12 G/H: bounded historical cache construction BEFORE 8a.
// Rows derive from real M88 physical/completion receipts; no trigger/CHECK bypass.
// This models an adversarial old cache, not a claim that public Google publication was reachable.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {footprint,permissive,resetActor,setActor,sourcePolicy,value} from './providerReplacementFixture.mjs';
import {cacheRequest,catalogueBatch,completeCatalogueV2,scanCacheCard} from './leanCatalogueFixture.mjs';
import {claimJob,lookupSql,readSql} from './editionPickerFixture.mjs';
import {completeV2,finalize,prepareCall,resultRows} from './editionOptionsCompletionFixture.mjs';
import {clearCatalogueOptions} from './leanCatalogueCompletionFixture.mjs';
import {cacheVersions} from './leanCatalogueCacheFixture.mjs';
export async function legacyGoogleCache(db,scope) {
  const ol=await catalogueBatch(db);await completeCatalogueV2(db,ol);await resetActor(db);
  const template=await value(db,`SELECT to_jsonb(c) FROM public.phase9_metadata_cache_entries c
    JOIN marketplace_sec.phase9_catalogue_lookup_effects e ON e.cache_entry_id=c.id WHERE e.lookup_id=$1`,[ol.lookupId]);
  assert.ok(template,'genuine usable OL publication supplies the historical row shape');
  const card=scope==='public_bibliographic'?await scanCacheCard(db):(await import('./editionPickerFixture.mjs')).seedCard;
  const f=typeof card==='function'?await card(db):card;
  await setActor(db,f.ownerId);const choices=await value(db,readSql(f));
  const request=await value(db,lookupSql(f,choices.requestGeneration));
  Object.assign(f,{jobId:request.operationId,context:await value(db,await claimJob(db,f,request.operationId)),attempt:1});
  await prepareCall(db,f);await finalize(db,f);const result=resultRows(f);
  result.rows[0].metadata.authors=f.context.authors;
  await permissive(db,'google_books');await setActor(db,f.ownerId,'service_role');
  assert.equal((await completeV2(db,f,result)).status,'completed');await resetActor(db);
  const m={...result.rows[0].metadata};for(const k of ['correlationId','attemptId','confidence','matchRationale'])delete m[k];
  const payload={version:'psr-edition-cache-v1',sourceFetchedAt:result.fetched,rows:[{ordinal:0,eligibility:'eligible',
    googleBooksUrl:result.rows[0].googleBooksUrl,providerRecordId:m.providerRecordId,metadata:m,
    companion:{version:'psr-catalogue-write-v1',workExternalId:null,oclc:null,lccn:null}}]};
  const versions=cacheVersions({adapterKey:'google_books',capabilityVersion:'cap-v1'});
  const identity=await value(db,`SELECT 'psr-edition-cache-v1:'||encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex')`,
    [['psr-edition-cache-v1',scope,scope==='store_private'?f.storeId:null,f.context.queryIdentity,...[
      'adapterKey','adapterVersion','capabilityVersion','normalizerVersion','schemaVersion','routingPolicyVersion',
      'cachePolicyVersion','reusePolicyVersion','companionVersion'].map(k=>versions[k])]]);
  const legacy={...template,id:randomUUID(),provider_cache_identity:identity,query_identity:f.context.queryIdentity,
    adapter_key:'google_books',capability_version:'cap-v1',privacy_scope:scope,store_id:scope==='store_private'?f.storeId:null,
    bibliographic_payload:payload,source_fetched_at:result.fetched,expires_at:result.deadline};
  legacy.payload_digest=await value(db,"SELECT encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex')",[payload]);
  await db.query(`INSERT INTO public.phase9_metadata_cache_entries SELECT
    (jsonb_populate_record(NULL::public.phase9_metadata_cache_entries,$1::jsonb)).*`,[legacy]);
  await db.query('UPDATE marketplace_sec.phase9_catalogue_lookup_effects SET cache_entry_id=$1,cache_payload_digest=$2 WHERE lookup_id=$3',
    [legacy.id,legacy.payload_digest,f.lookupId]);
  await clearCatalogueOptions(db,f);const receiving=await cacheRequest(db,f);await resetActor(db);
  assert.equal(await value(db,'SELECT marketplace_sec.phase9_catalogue_query_scope_v1($1,NULL)',[f.candidateId]),scope);
  return {f,receiving,versions,legacy,payload,policy:await sourcePolicy(db,m),before:await footprint(db)};
}
