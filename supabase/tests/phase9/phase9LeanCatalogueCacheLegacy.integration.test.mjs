// 02b ??8.2/10/12: M85 legacy discrimination, real reader/writer commands.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after,before,beforeEach,test } from 'node:test';
import { createLeanDatabase } from './leanCatalogueFixture.mjs';
import { automaticCard,enableOL,resetActor,setActor } from './catalogueLinkFixture.mjs';
import { rpc,worker,token } from './editionOptionsCompletionFixture.mjs';
import { claimJob,scalar } from './editionPickerFixture.mjs';
let db;
before(async()=>{db=await createLeanDatabase({m85:true});});
beforeEach(async()=>{await resetActor(db); await db.exec(
  'TRUNCATE public.stores,public.canonical_works,public.canonical_editions,public.phase9_metadata_cache_entries CASCADE'); await enableOL(db);});
after(async()=>{await db?.close();});
test('[baseline] legacy fixture completes real automatic lookup and selected metadata',async()=>{
  const f=await automaticCard(db); await resetActor(db);
  const saved=(await db.query('SELECT coherent_edition FROM public.phase9_selected_metadata_snapshots WHERE lookup_id=$1',[f.lookupId])).rows[0];
  assert.deepEqual(saved.coherent_edition,f.facts);
});

// 02b sections 4.5/8.2/10: real automatic SQL writer and M32 legacy reader.
test('AC7-11/17: real legacy reader, completion and writer preserve old kind and refuse new kind',async()=>{
  const source=await automaticCard(db);
  await setActor(db,source.ownerId,'service_role');
  const stored=await rpc(db,'phase9_store_metadata_cache',[source.lookupId,worker,token,1,'positive',source.facts,
    source.facts.providerRecordId,source.facts.fetchedAt,new Date(Date.now()+3600000).toISOString()]);
  assert.equal(stored.outcome,'positive');
  await resetActor(db);
  const cached=(await db.query(`SELECT to_jsonb(c) AS row,normalized_snapshot::text AS snapshot_bytes,
    $2::jsonb::text AS source_bytes FROM public.phase9_metadata_cache_entries c WHERE id=$1`,
  [stored.cache_id,source.facts])).rows[0];
  assert.equal(cached.snapshot_bytes,cached.source_bytes);
  assert.equal(cached.row.source_attempt_id,source.attemptId);
  assert.equal(cached.row.privacy_scope,'store_private');
  assert.equal(cached.row.store_id,source.storeId);

  const follower={...source,candidateId:randomUUID()}, observationId=randomUUID(), jobId=randomUUID();
  // A second original observation from the same immutable scan; no Owner review.
  await db.query(`INSERT INTO public.image_analysis_observations
    SELECT (jsonb_populate_record(NULL::public.image_analysis_observations,
      to_jsonb(o)||jsonb_build_object('id',$1::uuid,'observation_ordinal',2))).*
    FROM public.image_analysis_observations o JOIN public.image_extraction_candidates c
      ON c.analysis_observation_id=o.id WHERE c.id=$2`,[observationId,source.candidateId]);
  await db.query(`INSERT INTO public.image_extraction_candidates(id,session_id,store_id,candidate_index,
    observed_title,observed_authors,observed_isbn_clue,observed_language,observed_script,state,
    input_id,vision_job_id,analysis_observation_id,analysis_schema_version)
    SELECT $1,session_id,store_id,2,observed_title,observed_authors,observed_isbn_clue,
    observed_language,observed_script,'processing',input_id,vision_job_id,$3,analysis_schema_version
    FROM public.image_extraction_candidates WHERE id=$2`,[follower.candidateId,source.candidateId,observationId]);
  await db.query(`INSERT INTO public.image_extraction_jobs(id,store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version)
    VALUES($1,$2,'candidate',$3,'metadata_enrich',$1::uuid::text,'p9-metadata-foundation-v1')`,
  [jobId,source.storeId,follower.candidateId]);
  const context=await scalar(db,await claimJob(db,follower,jobId));
  assert.equal(context.queryIdentity,cached.row.query_identity);
  const read=key=>rpc(db,'phase9_metadata_cache_reuse_context',[jobId,worker,token,1,follower.candidateId,
    context.candidateVersion,key]);
  assert.deepEqual(await read(cached.row.provider_cache_identity),{
    leaderLookupId:source.lookupId,normalizedOutcome:'accepted_metadata_match',
  });
  assert.deepEqual(await read('uncached-legacy-key'),{leaderLookupId:null,normalizedOutcome:null});
  assert.equal(cached.row.payload_kind,'selected_snapshot_v1','M85 legacy writer must persist the default kind');
  const metadata={...source.facts};
  for(const key of ['correlationId','attemptId','matchRationale','confidence']) delete metadata[key];
  const payload={version:'psr-edition-cache-v1',sourceFetchedAt:source.facts.fetchedAt,rows:[{
    ordinal:0,eligibility:'eligible',googleBooksUrl:'https://openlibrary.org/books/'+metadata.providerRecordId,
    providerRecordId:metadata.providerRecordId,metadata,
    companion:{version:'psr-catalogue-write-v1',workExternalId:null,oclc:null,lccn:null}}]};
  await resetActor(db);
  const newKey='psr-edition-cache-v1:'+'c'.repeat(64);
  await db.query(`INSERT INTO public.phase9_metadata_cache_entries SELECT x.* FROM
    public.phase9_metadata_cache_entries c CROSS JOIN LATERAL jsonb_populate_record(
      NULL::public.phase9_metadata_cache_entries,to_jsonb(c)||jsonb_build_object(
        'id',$2::uuid,'provider_cache_identity',$3::text,'payload_kind','edition_options_v1',
        'bibliographic_payload',$4::jsonb,'payload_digest',encode(sha256(convert_to($4::jsonb::text,'UTF8')),'hex'),
        'routing_policy_version','p9-metadata-routing-v1','normalized_snapshot',NULL,
        'source_attempt_id',NULL,'provider_record_id',NULL)) x WHERE c.id=$1`,[stored.cache_id,randomUUID(),newKey,payload]);
  const completeLegacy=key=>rpc(db,'phase9_complete_metadata_cache_reuse',[jobId,worker,token,1,
    follower.candidateId,context.candidateVersion,context.queryIdentity,key,cached.row.adapter_key,
    cached.row.adapter_version,cached.row.capability_version,cached.row.schema_version,'bibliographic',
    'p9-metadata-lookup-v1',cached.row.normalizer_version,'p9-metadata-routing-v1',cached.row.privacy_scope,
    cached.row.reuse_policy_version,cached.row.cache_policy_version,'metadata-v1','p9-selected-v1','p9-metadata-selection-v1']);
  await setActor(db,source.ownerId,'service_role');
  assert.deepEqual(await read(newKey),{leaderLookupId:null,normalizedOutcome:null});
  await assert.rejects(()=>completeLegacy(newKey),e=>e.code==='P0001' && e.message==='P9_METADATA_REUSE_DENIED');
  await resetActor(db);
  const newRow=()=>db.query('SELECT to_jsonb(c)::text AS bytes FROM public.phase9_metadata_cache_entries c WHERE provider_cache_identity=$1',[newKey]);
  const newBytes=(await newRow()).rows[0].bytes;
  // Point the valid old-kind writer command at a new-kind incumbent. Passing a
  // malformed snapshot would only prove coherence validation before this branch.
  await db.exec('BEGIN');
  try {
    await db.query('UPDATE public.phase9_metadata_lookups SET provider_cache_identity=$1 WHERE id=$2',[newKey,source.lookupId]);
    await db.query('UPDATE public.metadata_enrichment_attempts SET provider_cache_identity=$1 WHERE id=$2',[newKey,source.attemptId]);
    await setActor(db,source.ownerId,'service_role');
    let response,failure;
    try { response=await rpc(db,'phase9_store_metadata_cache',[source.lookupId,worker,token,1,
      'positive',source.facts,source.facts.providerRecordId,source.facts.fetchedAt,cached.row.expires_at]); }
    catch(error) { failure=error; }
    if(failure) {
      assert.equal(failure.code,'P0001');
      assert.ok(['P9_METADATA_REUSE_DENIED','P9_IDEMPOTENCY_MISMATCH',
        'P9_METADATA_COHERENCE_CONFLICT'].includes(failure.message),failure.message);
    } else {
      assert.equal(response?.cache_id??null,null,'ignoring the new kind must not return it as a legacy hit');
      await resetActor(db);
      assert.equal((await newRow()).rows[0].bytes,newBytes);
      assert.equal(await scalar(db,'SELECT count(*)::int FROM public.phase9_metadata_cache_entries'),2);
    }
  } finally { await db.exec('ROLLBACK'); await resetActor(db); }
  assert.equal((await newRow()).rows[0].bytes,newBytes,'legacy writer must preserve the new-kind incumbent');
  await setActor(db,source.ownerId,'service_role');
  const replay=await rpc(db,'phase9_store_metadata_cache',[source.lookupId,worker,token,1,'positive',source.facts,
    source.facts.providerRecordId,source.facts.fetchedAt,cached.row.expires_at]);
  assert.deepEqual(replay,stored);
  assert.equal((await completeLegacy(cached.row.provider_cache_identity)).status,'completed');
  await resetActor(db);
  const unchanged=(await db.query('SELECT normalized_snapshot::text AS bytes FROM public.phase9_metadata_cache_entries WHERE id=$1',[stored.cache_id])).rows[0];
  assert.equal(unchanged.bytes,cached.snapshot_bytes);
});


