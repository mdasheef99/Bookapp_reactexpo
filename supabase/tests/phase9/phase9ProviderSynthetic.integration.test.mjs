// 02c §§3.1/4.2/5.1/9 AC8-9a/11/11.1; no generic workflow edits for a third provider.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { clean, createProviderDatabase, genericHashes, installSyntheticProvider, needs, resetActor,
  resetSyntheticProvider, requireObject, setActor, synthetic, value } from './providerReplacementFixture.mjs';
import { completeCatalogueV2 } from './leanCatalogueFixture.mjs';
import { clearCatalogueOptions } from './leanCatalogueCompletionFixture.mjs';
import { cacheRequest, cacheVersions, reuseCatalogueCache } from './leanCatalogueCacheFixture.mjs';
import { add, facts, readSql, rpc, saveReview, selectSql } from './catalogueLinkFixture.mjs';
import { seedOperation, token, worker } from './editionOptionsCompletionFixture.mjs';
let db;
before(async()=>{db=await createProviderDatabase();});
beforeEach(async()=>{await clean(db);});
after(async()=>{await db?.close();});
const installer=new URL('./fixtures/provider-replacement-synthetic-install.sql',import.meta.url);

test('AC8-9a [8a-2] GREEN-control M88 synthetic IDs-only fixture preserves complete generic definitions but is not admitted',async()=>{
  const before=await genericHashes(db);
  try {
    await installSyntheticProvider(db);
    assert.deepEqual(await genericHashes(db),before,'validator extension alone must change zero complete generic definitions/CHECKs/ACLs');
    assert.equal(await value(db,"SELECT marketplace_sec.phase9_catalogue_shared_admitted_v1('synthetic_catalogue')"),false,
      'the old fixture lacks facts/stage/retention/full-field installation; do not relabel AC7-21(b) proven');
  } finally {await resetSyntheticProvider(db);}
});

async function install(t) {
  if(!fs.existsSync(installer)) {
    requireObject(t,db,false,'8a-2','test-only synthetic facts/stage/retention/full-field installation hook');
    return false;
  }
  if(!await needs(t,db,'public.phase9_complete_automatic_metadata_v1(jsonb)','8a-4'))return false;
  // Explicit fixture only. Never scan/apply unrelated or speculative migration files.
  await db.exec(fs.readFileSync(installer,'utf8'));
  await db.exec(`UPDATE public.phase9_provider_registry SET automatic_lookup_allowed=false,explicit_search_allowed=false,
    automatic_role=NULL,automatic_order=NULL,explicit_role=NULL,explicit_order=NULL WHERE adapter_key IN('google_books','open_library')`);
  await db.query(`INSERT INTO public.phase9_provider_registry(adapter_key,provider_kind,adapter_version,enabled,
    matching_allowed,storage_allowed,public_display_allowed,attribution_required,shared_source_note,revalidation_seconds,
    automatic_lookup_allowed,explicit_search_allowed,shared_catalogue_allowed,accepted_adapter_versions,
    version_contracts,validation_contract,host_policy_version,approved_request_hosts,approved_book_hosts,
    approved_cover_hosts,options_retention_seconds,display_label,automatic_role,automatic_order,explicit_role,explicit_order)
    VALUES($1,'metadata',$2,true,true,true,true,true,'Test-only synthetic full-field rights',3600,true,true,true,
    ARRAY[$2],$3,$4,$5,ARRAY['catalogue.example.test'],ARRAY['catalogue.example.test'],ARRAY['catalogue.example.test'],3600,'Synthetic Catalogue','primary',1,'primary',1)`,
  [synthetic.adapterKey,synthetic.adapterVersion,{[synthetic.adapterVersion]:{
    validationContract:synthetic.validationContract,hostPolicyVersion:synthetic.hostPolicyVersion,
    capabilityVersion:synthetic.capabilityVersion,normalizerVersion:synthetic.normalizerVersion,
    payloadSchemaVersion:synthetic.payloadSchemaVersion,lookupSchemaVersion:synthetic.lookupSchemaVersion,
  }},synthetic.validationContract,synthetic.hostPolicyVersion]);
  return true;
}
async function operation() {
  const f=await seedOperation(db),base=[f.jobId,worker,token,1],key='synthetic:'+f.jobId;
  const lookup=await rpc(db,'phase9_register_structural_metadata_lookup',[...base,f.candidateId,
    f.context.candidateVersion,f.context.queryIdentity,key,synthetic.adapterKey,synthetic.adapterVersion,
    synthetic.capabilityVersion,synthetic.lookupSchemaVersion,'bibliographic','p9-metadata-lookup-v1',
    synthetic.normalizerVersion,'p9-metadata-routing-v1','store_private','1','p9-metadata-cache-v1','metadata-v1',null]);
  const usage=await rpc(db,'phase9_reserve_metadata_usage',[...base,lookup.lookup_id,synthetic.adapterKey,synthetic.adapterVersion,1]);
  const attempt=await rpc(db,'phase9_register_structural_metadata_attempt',[lookup.lookup_id,...base,f.candidateId,
    f.context.candidateVersion,randomUUID(),key,'primary',1,synthetic.adapterKey,synthetic.adapterVersion,
    synthetic.capabilityVersion,synthetic.lookupSchemaVersion,synthetic.normalizerVersion,
    'p9-metadata-routing-v1','local_insufficient',usage.reservation_id]);
  Object.assign(f,{lookupId:lookup.lookup_id,attemptId:attempt.attempt_id});
  for(const [sequence,stage]of synthetic.stages.entries()) {
    const call=await rpc(db,'phase9_register_edition_options_provider_call_v1',[f.attemptId,...base,randomUUID(),sequence,stage]);
    await rpc(db,'phase9_finalize_edition_options_provider_call_v1',[call.provider_call_id,...base,'finalized','no_acceptable_match',false,true]);
  }
  const fetched=new Date().toISOString(),m=facts({title:f.context.title,authors:f.context.authors,
    adapterKey:synthetic.adapterKey,adapterVersion:synthetic.adapterVersion,providerRecordId:synthetic.providerRecordId,
    isbn10:null,isbn13:null,coverReference:synthetic.coverUrl,correlationId:f.lookupId,attemptId:f.attemptId,
    fetchedAt:fetched,matchRationale:'confirmation_required_text_evidence',confidence:0});
  const optionId=randomUUID();
  return {...f,fetched,deadline:new Date(Date.parse(fetched)+3600000).toISOString(),
    rows:[{optionId,ordinal:0,eligibility:'eligible',googleBooksUrl:synthetic.bookUrl,metadata:m}],
    catalogueCompanions:[{version:'psr-catalogue-write-v1',optionId,adapterKey:synthetic.adapterKey,
      adapterVersion:synthetic.adapterVersion,normalizerVersion:synthetic.normalizerVersion,lookupId:f.lookupId,
      attemptId:f.attemptId,providerRecordId:synthetic.providerRecordId,workExternalId:synthetic.workExternalId,
      fetchedAt:fetched,oclc:null,lccn:null}]};
}

test('AC8-9a [8a-2/3/4] synthetic admission→custom physical stages→completion→typed-cache reuse→Select→Add changes no generic hash',async t=>{
  const before=await genericHashes(db);
  const metadataDefinition=await value(db,"SELECT pg_get_functiondef('marketplace_sec.phase9_edition_valid_metadata(jsonb,boolean)'::regprocedure)");
  if(!await install(t))return;
  assert.equal(await value(db,'SELECT marketplace_sec.phase9_catalogue_shared_admitted_v1($1)',[synthetic.adapterKey]),true);
  const f=await operation();
  await resetActor(db);
  assert.equal(await value(db,'SELECT marketplace_sec.phase9_edition_valid_metadata($1,false)',[f.rows[0].metadata]),true,
    'SQL Select/Add accepts installed source-tagged facts');
  assert.equal(await value(db,'SELECT marketplace_sec.phase9_edition_valid_metadata(marketplace_sec.phase9_edition_snapshot($1),false)',[f.rows[0].metadata]),false,
    'anonymous legacy snapshots retain their existing host grammar; presentation remains gated');
  await setActor(db,f.ownerId,'service_role');
  assert.equal((await completeCatalogueV2(db,f)).status,'completed');
  await resetActor(db);
  assert.equal(await value(db,"SELECT count(*)::int FROM public.phase9_metadata_cache_entries WHERE adapter_key=$1 AND privacy_scope='store_private'",[synthetic.adapterKey]),1);
  await clearCatalogueOptions(db,f);
  const next=await cacheRequest(db,f),versions=cacheVersions({adapterKey:synthetic.adapterKey,
    capabilityVersion:synthetic.capabilityVersion});
  assert.notEqual(next.jobId,f.jobId,'cache reuse must have a fresh receiving operation');
  assert.equal((await reuseCatalogueCache(db,next,versions)).status,'completed');
  await resetActor(db);
  assert.equal(await value(db,'SELECT count(*)::int FROM public.phase9_metadata_provider_calls WHERE job_id=$1',[next.jobId]),0);
  await setActor(db,f.ownerId);
  const choices=await value(db,readSql(f));
  const option=choices.options?.[0] ?? choices.rows?.[0];
  assert.ok(option?.optionId,'SQL private reader must return the fresh receiving option UUID');
  await value(db,selectSql(f,choices,option.optionId)); await saveReview(db,f);
  const saved=await add(db,f); assert.ok(saved.item.canonical_edition_id); assert.ok(saved.item.canonical_work_id);
  assert.deepEqual(await genericHashes(db),before,'all generic SQL bodies/CHECKs/owners/ACLs remain byte-identical');
  assert.equal(await value(db,"SELECT pg_get_functiondef('marketplace_sec.phase9_edition_valid_metadata(jsonb,boolean)'::regprocedure)"),
    metadataDefinition,'provider installation does not edit the common metadata schema');
});

test('AC8-9a [8a-2..4] recorded generalized-8a golden freezes every generic definition without auto-rebaselining',async t=>{
  const goldenName=db.installedPackages.includes('8a-5')?'provider-replacement-generic-8a5-sha256.json':'provider-replacement-generic-sha256.json';
  const golden=JSON.parse(fs.readFileSync(new URL('./fixtures/'+goldenName,import.meta.url)));
  if(golden.baselineArtifact===null){requireObject(t,db,false,'8a-4','post-generalization SHA256 golden and metadata; never M88 hashes');return;}
  const current=await genericHashes(db);
  assert.deepEqual(current.sql,golden.sql);
  assert.deepEqual(current.metadata,golden.metadata,'separate owner/ACL/volatility/search-path evidence is mandatory');
  assert.deepEqual(current.checks,golden.checks);
});

for(const behavior of ['automatic retained winner and existing selected-snapshot cache',
  'public scan-origin cache with fresh two-store lineage and no private cross-store UUIDs',
  'unknown/cross-provider retention IDs, swapped lookup/cache schemas and mixed-rights rejection'])
  test.todo(`AC8-9a/11/13 UNPROVED-PREREQUISITE [8a-2/3/4]: reviewed synthetic retention/profile and automatic fixture: ${behavior}`);
