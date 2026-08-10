import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, test } from 'node:test';
import { runMetadataWorkerBatch } from '../../../.phase9-dist/workers/phase9-metadata-worker/index.js';
import { buildMetadataQueryIdentity } from '../../../.phase9-dist/supabase/functions/_shared/imageInventory/metadata/queryIdentity.js';
import {
  GOOGLE_BOOKS_CAPABILITY, GoogleBooksAdapter,
} from '../../../.phase9-dist/supabase/functions/_shared/imageInventory/metadata/googleBooks/index.js';
import {
  createPhase9Database, migrationPath, resetActor, scalar, setActor,
} from './databaseHarness.mjs';

const STORE='aa000000-0000-0000-0000-000000000001';
const OWNER='ab000000-0000-0000-0000-000000000001';
const SESSION='ac000000-0000-0000-0000-000000000001';
const INPUT='ad000000-0000-0000-0000-000000000001';
const MEDIA='ae000000-0000-0000-0000-000000000001';
const VISION_JOB='af000000-0000-0000-0000-000000000001';
const VISION_WORKER='vision-worker-structural-01';
const METADATA_WORKER='metadata-worker-structural-01';
let db;
const literal=(value)=>value===null?'NULL':typeof value==='boolean'||typeof value==='number'
  ?String(value):typeof value==='object'
    ?`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`
    :`'${String(value).replaceAll("'","''")}'`;
const structuralSignatures={
  phase9_metadata_job_context:['p_job_id','p_worker','p_lease_token','p_attempt_count'],
  phase9_complete_structural_local_metadata_match:['p_job_id','p_worker','p_lease_token','p_attempt_count','p_candidate_id','p_candidate_version','p_query_identity','p_lookup_strategy','p_lookup_contract_version','p_normalizer_version','p_routing_policy_version','p_privacy_scope','p_schema_version','p_canonical_edition_id','p_snapshot_version','p_selection_policy_version','p_match_evidence'],
  phase9_metadata_cache_reuse_context:['p_job_id','p_worker','p_lease_token','p_attempt_count','p_candidate_id','p_candidate_version','p_provider_cache_identity'],
  phase9_metadata_coalescing_context:['p_job_id','p_worker','p_lease_token','p_attempt_count','p_candidate_id','p_candidate_version','p_query_identity','p_provider_cache_identity','p_adapter_key','p_adapter_version','p_capability_version','p_schema_version','p_lookup_strategy','p_lookup_contract_version','p_normalizer_version','p_routing_policy_version','p_privacy_scope','p_reuse_policy_version','p_cache_policy_version','p_cache_namespace','p_leader_lookup_id'],
  phase9_complete_metadata_cache_reuse:['p_job_id','p_worker','p_lease_token','p_attempt_count','p_candidate_id','p_candidate_version','p_query_identity','p_provider_cache_identity','p_adapter_key','p_adapter_version','p_capability_version','p_schema_version','p_lookup_strategy','p_lookup_contract_version','p_normalizer_version','p_routing_policy_version','p_privacy_scope','p_reuse_policy_version','p_cache_policy_version','p_cache_namespace','p_snapshot_version','p_selection_policy_version'],
  phase9_register_structural_metadata_lookup:['p_job_id','p_worker','p_lease_token','p_attempt_count','p_candidate_id','p_candidate_version','p_query_identity','p_provider_cache_identity','p_adapter_key','p_adapter_version','p_capability_version','p_schema_version','p_lookup_strategy','p_lookup_contract_version','p_normalizer_version','p_routing_policy_version','p_privacy_scope','p_reuse_policy_version','p_cache_policy_version','p_cache_namespace','p_leader_lookup_id'],
  phase9_reserve_metadata_usage:['p_job_id','p_worker','p_lease_token','p_attempt_count','p_lookup_id','p_adapter_key','p_adapter_version','p_policy_version'],
  phase9_register_structural_metadata_attempt:['p_lookup_id','p_job_id','p_worker','p_lease_token','p_attempt_count','p_candidate_id','p_candidate_version','p_provider_attempt_identity','p_provider_cache_identity','p_provider_role','p_attempt_sequence','p_adapter_key','p_adapter_version','p_capability_version','p_schema_version','p_normalizer_version','p_routing_policy_version','p_predecessor_outcome','p_usage_reservation_id'],
  phase9_register_metadata_provider_call:['p_attempt_id','p_job_id','p_worker','p_lease_token','p_attempt_count','p_physical_call_identity'],
  phase9_finalize_metadata_provider_call:['p_provider_call_id','p_job_id','p_worker','p_lease_token','p_attempt_count','p_status','p_normalized_outcome','p_logical_outcome','p_provider_request_id','p_retryable','p_normalized_candidate','p_match_evidence'],
  phase9_reconcile_metadata_provider_call:['p_provider_call_id','p_job_id','p_worker','p_lease_token','p_attempt_count'],
  phase9_finalize_structural_metadata_attempt:['p_attempt_id','p_job_id','p_worker','p_lease_token','p_attempt_count','p_candidate_id','p_candidate_version','p_disposition','p_normalized_outcome','p_provider_request_id','p_cache_status','p_latency_ms','p_pricing_policy_version','p_pricing_evidence','p_calculated_cost_units','p_normalized_candidate'],
  phase9_select_structural_metadata_snapshot:['p_lookup_id','p_job_id','p_worker','p_lease_token','p_attempt_count','p_candidate_id','p_candidate_version','p_selected_attempt_id','p_outcome_source_attempt_id','p_snapshot_version','p_selection_policy_version','p_coherent_edition','p_match_evidence','p_manual_outcome','p_canonical_edition_id'],
  phase9_store_metadata_cache:['p_lookup_id','p_worker','p_lease_token','p_attempt_count','p_outcome','p_normalized_snapshot','p_provider_record_id','p_source_fetched_at','p_expires_at'],
  phase9_fail_metadata_job:['p_job_id','p_worker','p_lease_token','p_attempt_count','p_candidate_id','p_candidate_version','p_query_identity','p_failure_kind','p_retryable'],
};
const serviceClientFor=(rpcErrors=[])=>({rpc:async(name,p)=>{try{
  if(name==='claim_phase9_metadata_jobs') return {data:(await db.query(
    `SELECT * FROM public.claim_phase9_metadata_jobs(${literal(p.p_batch_size)},${literal(p.p_worker)})`)).rows,error:null};
  const signature=structuralSignatures[name];
  if(signature) return {data:await scalar(db,
    `SELECT public.${name}(${signature.map((key)=>literal(p[key]??null)).join(',')})`),error:null};
  throw new Error(`unexpected RPC ${name}`);
}catch(error){rpcErrors.push({name,message:String(error)});return {data:null,error};}}});
const capability={role:'primary',adapterKey:'recorded_metadata',adapterVersion:'1.0.0',
  capabilityVersion:'cap-v1',enabled:true,maxAttempts:1,supportedStrategies:['bibliographic'],
  supportsIsbn10:true,supportsIsbn13:true,supportedLanguages:['en'],
  normalizedOutcomes:['coherent_match'],returnsCoherentEditions:true,reusePolicyVersion:'1'};

async function seedStructuralCandidate({candidate,observation,index,title,isbn=null}) {
  await resetActor(db);
  await db.exec(`INSERT INTO public.image_analysis_observations(id,analysis_result_id,store_id,input_id,
      observation_ordinal,disposition,observed_title,observed_authors,observed_isbn_clue,
      observed_language,confidence,observation_snapshot)
    SELECT '${observation}',analysis_result_id,store_id,input_id,${index},'candidate',
      '${title}',ARRAY['Fixture Author'],${literal(isbn)},'en',1,'{}'::jsonb
    FROM public.image_analysis_observations WHERE observation_ordinal=1 LIMIT 1;
    INSERT INTO public.image_extraction_candidates(id,session_id,input_id,store_id,
      candidate_index,observed_title,observed_authors,observed_isbn_clue,observed_language,
      state,vision_job_id,analysis_observation_id,analysis_schema_version)
    SELECT '${candidate}',session_id,input_id,store_id,${index},'${title}',
      ARRAY['Fixture Author'],${literal(isbn)},'en','processing',vision_job_id,
      '${observation}',analysis_schema_version
    FROM public.image_extraction_candidates WHERE candidate_index=1 LIMIT 1;
    INSERT INTO public.image_extraction_jobs(id,store_id,entity_type,entity_id,job_kind,
      dedupe_key,operation_version)
    SELECT gen_random_uuid(),'${STORE}','candidate','${candidate}','metadata_enrich',
      'metadata:${candidate}','p9-metadata-foundation-v1'
    WHERE NOT EXISTS(SELECT 1 FROM public.image_extraction_jobs
      WHERE entity_id='${candidate}' AND job_kind='metadata_enrich');`);
}

const fullEdition=({correlationId,attemptId,title,providerRecordId})=>({
  contractVersion:'p9-contract-v1',schemaVersion:'p9-metadata-v1',
  adapterKey:'recorded_metadata',adapterVersion:'1.0.0',
  normalizerVersion:'p9-bibliographic-normalizer-v1',correlationId,attemptId,
  providerRecordId,fetchedAt:'2026-08-07T00:00:00.000Z',title,subtitle:null,
  authors:['Fixture Author'],description:null,isbn10:null,isbn13:null,publisher:null,
  publishedDate:null,language:'en',script:null,editionStatement:null,series:null,
  volume:null,format:null,pageCount:null,categories:[],coverReference:null,
  matchRationale:'exact_original_title_author_language',confidence:1,
});

before(async()=>{
  db=await createPhase9Database({throughMigration:
    '20260810000035_marketplace_phase9_single_image_removal.sql'});
  await db.exec(fs.readFileSync(migrationPath(
    '20260810000037_marketplace_phase9_owner_discovery_scope_correction.sql'), 'utf8'));
  await db.exec(fs.readFileSync(migrationPath(
    '20260810000038_marketplace_phase9_metadata_retry_correction.sql'), 'utf8'));
  await db.exec(`INSERT INTO public.stores(id,display_name) VALUES('${STORE}','Structural Store');
    INSERT INTO public.store_administrators(store_id,user_id,role,status)
    VALUES('${STORE}','${OWNER}','owner','active');
    INSERT INTO public.phase9_provider_registry(adapter_key,provider_kind,adapter_version,
      enabled,matching_allowed,storage_allowed,revalidation_seconds,policy_version)
    VALUES('recorded_metadata','metadata','1.0.0',true,true,true,86400,1)
    ON CONFLICT(adapter_key) DO UPDATE SET enabled=true,matching_allowed=true,
      storage_allowed=true,revalidation_seconds=86400,policy_version=1;`);
});
after(async()=>db.close());

test('vision persistence auto-enqueues and runnable worker completes SAME-candidate Owner truth',async()=>{
  await setActor(db,OWNER,'service_role');
  await db.exec(`INSERT INTO public.image_extraction_sessions
    (id,store_id,created_by,selected_language,default_condition,default_location,
      orchestration_version,prompt_version)
    VALUES('${SESSION}','${STORE}','${OWNER}','en','good','A1','phase9-v1','fixture-prompt-v2');
    INSERT INTO public.media_assets
    (id,store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,sha256,
      detected_mime,bytes,width,height,validation_version,validated_at,reencode_version,
      exif_strip_version,session_id,retention_class,lifecycle_status)
    VALUES('${MEDIA}','${STORE}','${OWNER}','scan_input','private_scan','image-extraction-inputs',
      '${STORE}/scan/${INPUT}.webp','${'a'.repeat(64)}','image/webp',32,1,1,
      'phase9-media-v1',transaction_timestamp(),'fixture','fixture','${SESSION}',
      'phase9-private-scan','linked');
    INSERT INTO public.image_extraction_inputs
    (id,session_id,store_id,media_asset_id,source_kind,state,sha256,orchestration_version)
    VALUES('${INPUT}','${SESSION}','${STORE}','${MEDIA}','camera','queued',
      '${'a'.repeat(64)}','phase9-v1');
    INSERT INTO public.image_extraction_jobs
    (id,store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version,correlation_id)
    VALUES('${VISION_JOB}','${STORE}','input','${INPUT}','vision_extract','vision:${INPUT}',
      'phase9-v1','b0000000-0000-4000-8000-000000000001');`);
  const visionClaim=(await db.query(
    `SELECT * FROM marketplace_sec.claim_phase9_vision_jobs(1,'${VISION_WORKER}')`)).rows[0];
  await db.query(`SELECT marketplace_sec.phase9_vision_job_context('${VISION_JOB}',
    '${VISION_WORKER}','${visionClaim.lease_token}',1)`);
  const result={contract_version:'p9-contract-v1',schema_version:'p9-vision-v2',
    pipeline_version:'phase9-v1',prompt_version:'fixture-prompt-v2',
    adapter_key:'fixture_adapter',adapter_version:'1.0.0',
    job_reference:'job_b0000000000040008000000000000001',attempt_number:1,
    correlation_id:'b0000000-0000-4000-8000-000000000001',expected_language:'en',
    provider_key:'recorded_fixture',model_key:'fixture_multimodal',model_version:'2026-08-07',
    received_at:'2026-08-07T00:00:00.000Z',image_outcome:'analyzed',
    detected_visible_book_count:1,warning_codes:[],observations:[{ordinal:1,
      title_guess:'Structural Fixture Book',author_guesses:['Fixture Author'],
      publisher_clue:null,isbn_clue:null,detected_language:'en',confidence:0.9,
      geometry:null,warning_codes:[]}]};
  await db.query(`SELECT marketplace_sec.phase9_persist_vision_analysis('${VISION_JOB}',
    '${VISION_WORKER}','${visionClaim.lease_token}',1,
    '${JSON.stringify(result).replaceAll("'","''")}'::jsonb)`);
  const candidateId=await scalar(db,'SELECT id FROM public.image_extraction_candidates');
  await resetActor(db);
  const sqlIdentity=await scalar(db,`SELECT marketplace_sec.phase9_metadata_candidate_query_identity(c)
    FROM public.image_extraction_candidates c WHERE c.id='${candidateId}'`);
  assert.equal(sqlIdentity,buildMetadataQueryIdentity({
    strategy:'bibliographic',isbnClue:null,title:'Structural Fixture Book',
    authors:['Fixture Author'],language:'en',editionClues:[],
  }).key);
  await resetActor(db);
  assert.equal(await scalar(db,`SELECT count(*)::int FROM public.image_extraction_jobs
    WHERE job_kind='metadata_enrich' AND entity_id='${candidateId}'`),1);

  const literal=(value)=>value===null?'NULL':typeof value==='boolean'||typeof value==='number'
    ?String(value):typeof value==='object'
      ?`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`
      :`'${String(value).replaceAll("'","''")}'`;
  const signatures={
    phase9_metadata_job_context:['p_job_id','p_worker','p_lease_token','p_attempt_count'],
    phase9_complete_structural_local_metadata_match:['p_job_id','p_worker','p_lease_token','p_attempt_count','p_candidate_id','p_candidate_version','p_query_identity','p_lookup_strategy','p_lookup_contract_version','p_normalizer_version','p_routing_policy_version','p_privacy_scope','p_schema_version','p_canonical_edition_id','p_snapshot_version','p_selection_policy_version','p_match_evidence'],
    phase9_metadata_cache_reuse_context:['p_job_id','p_worker','p_lease_token','p_attempt_count','p_candidate_id','p_candidate_version','p_provider_cache_identity'],
    phase9_metadata_coalescing_context:['p_job_id','p_worker','p_lease_token','p_attempt_count','p_candidate_id','p_candidate_version','p_query_identity','p_provider_cache_identity','p_adapter_key','p_adapter_version','p_capability_version','p_schema_version','p_lookup_strategy','p_lookup_contract_version','p_normalizer_version','p_routing_policy_version','p_privacy_scope','p_reuse_policy_version','p_cache_policy_version','p_cache_namespace','p_leader_lookup_id'],
    phase9_complete_metadata_cache_reuse:['p_job_id','p_worker','p_lease_token','p_attempt_count','p_candidate_id','p_candidate_version','p_query_identity','p_provider_cache_identity','p_adapter_key','p_adapter_version','p_capability_version','p_schema_version','p_lookup_strategy','p_lookup_contract_version','p_normalizer_version','p_routing_policy_version','p_privacy_scope','p_reuse_policy_version','p_cache_policy_version','p_cache_namespace','p_snapshot_version','p_selection_policy_version'],
    phase9_register_structural_metadata_lookup:['p_job_id','p_worker','p_lease_token','p_attempt_count','p_candidate_id','p_candidate_version','p_query_identity','p_provider_cache_identity','p_adapter_key','p_adapter_version','p_capability_version','p_schema_version','p_lookup_strategy','p_lookup_contract_version','p_normalizer_version','p_routing_policy_version','p_privacy_scope','p_reuse_policy_version','p_cache_policy_version','p_cache_namespace','p_leader_lookup_id'],
    phase9_register_metadata_lookup:['p_job_id','p_worker','p_lease_token','p_attempt_count','p_query_identity','p_provider_cache_identity','p_adapter_key','p_adapter_version','p_capability_version','p_schema_version','p_lookup_strategy','p_lookup_contract_version','p_normalizer_version','p_routing_policy_version','p_privacy_scope','p_reuse_policy_version','p_cache_policy_version','p_cache_namespace','p_leader_lookup_id'],
    phase9_reserve_metadata_usage:['p_job_id','p_worker','p_lease_token','p_attempt_count','p_lookup_id','p_adapter_key','p_adapter_version','p_policy_version'],
    phase9_register_metadata_attempt:['p_lookup_id','p_job_id','p_worker','p_lease_token','p_attempt_count','p_provider_attempt_identity','p_provider_cache_identity','p_provider_role','p_attempt_sequence','p_adapter_key','p_adapter_version','p_capability_version','p_schema_version','p_normalizer_version','p_routing_policy_version','p_predecessor_outcome','p_usage_reservation_id'],
    phase9_register_structural_metadata_attempt:['p_lookup_id','p_job_id','p_worker','p_lease_token','p_attempt_count','p_candidate_id','p_candidate_version','p_provider_attempt_identity','p_provider_cache_identity','p_provider_role','p_attempt_sequence','p_adapter_key','p_adapter_version','p_capability_version','p_schema_version','p_normalizer_version','p_routing_policy_version','p_predecessor_outcome','p_usage_reservation_id'],
    phase9_register_metadata_provider_call:['p_attempt_id','p_job_id','p_worker','p_lease_token','p_attempt_count','p_physical_call_identity'],
    phase9_finalize_metadata_provider_call:['p_provider_call_id','p_job_id','p_worker','p_lease_token','p_attempt_count','p_status','p_normalized_outcome','p_logical_outcome','p_provider_request_id','p_retryable','p_normalized_candidate','p_match_evidence'],
    phase9_finalize_metadata_attempt:['p_attempt_id','p_job_id','p_worker','p_lease_token','p_attempt_count','p_disposition','p_normalized_outcome','p_provider_request_id','p_cache_status','p_latency_ms','p_pricing_policy_version','p_pricing_evidence','p_calculated_cost_units','p_normalized_candidate'],
    phase9_finalize_structural_metadata_attempt:['p_attempt_id','p_job_id','p_worker','p_lease_token','p_attempt_count','p_candidate_id','p_candidate_version','p_disposition','p_normalized_outcome','p_provider_request_id','p_cache_status','p_latency_ms','p_pricing_policy_version','p_pricing_evidence','p_calculated_cost_units','p_normalized_candidate'],
    phase9_select_metadata_snapshot:['p_lookup_id','p_job_id','p_worker','p_lease_token','p_attempt_count','p_selected_attempt_id','p_outcome_source_attempt_id','p_snapshot_version','p_selection_policy_version','p_coherent_edition','p_match_evidence','p_manual_outcome','p_canonical_edition_id'],
    phase9_select_structural_metadata_snapshot:['p_lookup_id','p_job_id','p_worker','p_lease_token','p_attempt_count','p_candidate_id','p_candidate_version','p_selected_attempt_id','p_outcome_source_attempt_id','p_snapshot_version','p_selection_policy_version','p_coherent_edition','p_match_evidence','p_manual_outcome','p_canonical_edition_id'],
    phase9_store_metadata_cache:['p_lookup_id','p_worker','p_lease_token','p_attempt_count','p_outcome','p_normalized_snapshot','p_provider_record_id','p_source_fetched_at','p_expires_at'],
    phase9_fail_metadata_job:['p_job_id','p_worker','p_lease_token','p_attempt_count','p_candidate_id','p_candidate_version','p_query_identity','p_failure_kind','p_retryable'],
  };
  const rpcErrors=[]; let cacheFailures=0;
  const serviceClient={rpc:async(name,p)=>{try{
    if(name==='claim_phase9_metadata_jobs') return {data:(await db.query(
      `SELECT * FROM public.claim_phase9_metadata_jobs(${literal(p.p_batch_size)},
      ${literal(p.p_worker)})`)).rows,error:null};
    if(name==='phase9_store_metadata_cache') {
      cacheFailures+=1;
      return {data:null,error:new Error('simulated derived cache write failure')};
    }
    if(signatures[name]) {
      const data=await scalar(db,
        `SELECT public.${name}(${signatures[name].map((key)=>literal(p[key]??null)).join(',')})`);
      return {data,error:null};
    }
    throw new Error(`unexpected RPC ${name}`);
  }catch(error){rpcErrors.push({name,message:String(error)});return {data:null,error};}}};
  let providerCalls=0;
  const primary={lookup:async({correlationId,attemptId})=>{
    providerCalls+=1;
    const selected={contractVersion:'p9-contract-v1',schemaVersion:'p9-metadata-v1',
      adapterKey:'recorded_metadata',adapterVersion:'1.0.0',normalizerVersion:'p9-bibliographic-normalizer-v1',
      correlationId,attemptId,providerRecordId:'fixture-volume-1',fetchedAt:'2026-08-07T00:00:00.000Z',
      title:'Structural Fixture Book',subtitle:null,authors:['Fixture Author'],description:null,
      isbn10:null,isbn13:null,publisher:null,publishedDate:null,language:'en',script:null,
      editionStatement:null,series:null,volume:null,format:null,pageCount:null,categories:[],
      coverReference:null,matchRationale:'exact_original_title_author_language',confidence:1};
    return {outcome:'coherent_match',candidates:[selected],selected,
      evidence:['exact_original_title_author_language'],retryable:false,
      secondaryEligible:false,providerRequestId:'fixture-request-1'};
  }};
  const primaryCapability={role:'primary',adapterKey:'recorded_metadata',adapterVersion:'1.0.0',
    capabilityVersion:'cap-v1',enabled:true,maxAttempts:1,supportedStrategies:['bibliographic'],
    supportsIsbn10:true,supportsIsbn13:true,supportedLanguages:['en'],
    normalizedOutcomes:['coherent_match'],returnsCoherentEditions:true,reusePolicyVersion:'1'};
  await setActor(db,OWNER,'service_role');
  const workerResult=await runMetadataWorkerBatch(1,{workerId:METADATA_WORKER,
    workerAuthToken:'unused',serviceClient,primary,primaryCapability});
  assert.deepEqual(workerResult,{claimed:1,results:[{outcome:'accepted_metadata_match'}]},
    JSON.stringify({rpcErrors,providerCalls}));
  assert.equal(providerCalls,1);
  assert.equal(cacheFailures,1);
  assert.equal(await scalar(db,`SELECT state FROM public.image_extraction_candidates
    WHERE id='${candidateId}'`),'ready');
  assert.equal(await scalar(db,`SELECT count(*)::int FROM public.phase9_selected_metadata_snapshots
    WHERE candidate_id='${candidateId}' AND manual_outcome='accepted_metadata_match'`),1);
  await setActor(db,OWNER,'authenticated');
  const owner=await scalar(db,`SELECT public.phase9_owner_candidate_detail_v2(
    '${SESSION}','${candidateId}')`);
  assert.equal(owner.candidateId,candidateId);
  assert.equal(owner.metadata.state,'selected');
  await resetActor(db);
  assert.equal(await scalar(db,'SELECT count(*)::int FROM public.store_inventory'),0);
  assert.equal(await scalar(db,'SELECT count(*)::int FROM public.marketplace_book_listings'),0);
});

test('database and runtime metadata identities are byte-equivalent across normalization vectors',async()=>{
  await setActor(db,OWNER,'service_role');
  const candidate='b1000000-0000-4000-8000-000000000001';
  await db.exec(`INSERT INTO public.image_extraction_candidates
    (id,session_id,input_id,store_id,candidate_index,observed_title,observed_authors,
      observed_isbn_clue,observed_language,observed_publisher_clue,state)
    VALUES('${candidate}','${SESSION}','${INPUT}','${STORE}',15,'placeholder',ARRAY['author'],
      NULL,'en',NULL,'needs_review')`);
  await resetActor(db);
  const vectors=[
    {isbnClue:'0-306-40615-2',title:'  Cafe\u0301   Book ',authors:[' Author  One ','AUTHOR TWO'],language:'EN-us',editionClues:[' Publisher  One ']},
    {isbnClue:'9780306406157',title:'Caf\u00e9 Book',authors:['author one','author two'],language:'en-US',editionClues:['publisher one']},
    {isbnClue:'9780306406158',title:'Title',authors:['Author'],language:'hi-deva-IN',editionClues:[]},
  ];
  for(const vector of vectors){
    await db.query(`UPDATE public.image_extraction_candidates SET observed_title=$1,
      observed_authors=$2,observed_isbn_clue=$3,observed_language=$4,
      observed_publisher_clue=$5 WHERE id='${candidate}'`,[
      vector.title,vector.authors,vector.isbnClue,vector.language,vector.editionClues[0]??null,
    ]);
    const sql=await scalar(db,`SELECT marketplace_sec.phase9_metadata_candidate_query_identity(c)
      FROM public.image_extraction_candidates c WHERE c.id='${candidate}'`);
    const strategy=vector.isbnClue==='9780306406158'?'bibliographic':'isbn';
    assert.equal(sql,buildMetadataQueryIdentity({...vector,strategy}).key);
  }
  await db.exec(`DELETE FROM public.image_extraction_candidates WHERE id='${candidate}'`);
  await resetActor(db);
});

test('storage-denied response loss recovers policy denial with one physical call',async()=>{
  const candidate='b2000000-0000-4000-8000-000000000001';
  await resetActor(db);
  await db.exec(`UPDATE public.phase9_provider_registry SET storage_allowed=false
    WHERE adapter_key='recorded_metadata';
    INSERT INTO public.image_analysis_observations(id,analysis_result_id,store_id,input_id,
      observation_ordinal,disposition,observed_title,observed_authors,observed_language,
      confidence,observation_snapshot)
    SELECT 'b2100000-0000-4000-8000-000000000001',analysis_result_id,store_id,input_id,
      2,'candidate','Storage Denied Book',ARRAY['Fixture Author'],'en',1,'{}'::jsonb
    FROM public.image_analysis_observations WHERE observation_ordinal=1 LIMIT 1;
    INSERT INTO public.image_extraction_candidates(id,session_id,input_id,store_id,
      candidate_index,observed_title,observed_authors,observed_language,state,vision_job_id,
      analysis_observation_id,analysis_schema_version)
    SELECT '${candidate}',session_id,input_id,store_id,2,'Storage Denied Book',
      ARRAY['Fixture Author'],'en','processing',vision_job_id,
      'b2100000-0000-4000-8000-000000000001',
      analysis_schema_version
    FROM public.image_extraction_candidates WHERE candidate_index=1 LIMIT 1;`);
  await setActor(db,OWNER,'service_role');
  let providerCalls=0; const rpcErrors=[];
  const primary={lookup:async({correlationId,attemptId})=>{
    providerCalls+=1; const selected=fullEdition({correlationId,attemptId,
      title:'Storage Denied Book',providerRecordId:'denied-volume'});
    return {outcome:'coherent_match',candidates:[selected],selected,
      evidence:['exact_original_title_author_language'],
      retryable:false,secondaryEligible:false,providerRequestId:'denied-request'};
  }};
  let loseLogicalResponse=true; const base=serviceClientFor(rpcErrors);
  const serviceClient={rpc:async(name,p)=>{
    if(name==='phase9_finalize_structural_metadata_attempt' && loseLogicalResponse){
      loseLogicalResponse=false; return {data:null,error:new Error('lost logical response')};
    }
    return base.rpc(name,p);
  }};
  const first=await runMetadataWorkerBatch(1,{workerId:METADATA_WORKER,
    workerAuthToken:'unused',serviceClient,primary,
    primaryCapability:capability});
  assert.deepEqual(first,{claimed:1,results:[{outcome:'retry_scheduled'}]},
    JSON.stringify(rpcErrors));
  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_jobs SET next_attempt_at=transaction_timestamp()
    WHERE entity_id='${candidate}' AND job_kind='metadata_enrich'`);
  await setActor(db,OWNER,'service_role');
  const second=await runMetadataWorkerBatch(1,{workerId:METADATA_WORKER,
    workerAuthToken:'unused',serviceClient,primary,primaryCapability:capability});
  assert.deepEqual(second,{claimed:1,results:[{outcome:'manual_metadata_required'}]},
    JSON.stringify(rpcErrors));
  assert.equal(providerCalls,1);
  await resetActor(db);
  assert.equal(await scalar(db,`SELECT normalized_candidate IS NULL
    FROM public.phase9_metadata_provider_calls WHERE candidate_id='${candidate}'`),true);
  assert.equal(await scalar(db,`SELECT normalized_outcome FROM public.metadata_enrichment_attempts
    WHERE candidate_id='${candidate}'`),'policy_denied');
  assert.equal(await scalar(db,`SELECT state FROM public.image_extraction_candidates
    WHERE id='${candidate}'`),'needs_review');
  assert.equal(await scalar(db,`SELECT status FROM public.image_extraction_jobs
    WHERE entity_id='${candidate}' AND job_kind='metadata_enrich'`),'resolved');
  assert.equal(await scalar(db,`SELECT count(*)::int FROM public.phase9_selected_metadata_snapshots
    WHERE candidate_id='${candidate}' AND manual_outcome='policy_denied'
      AND coherent_edition IS NULL AND selected_attempt_id IS NULL
      AND canonical_edition_id IS NULL`),1);
  assert.equal(await scalar(db,`SELECT count(*)::int FROM public.phase9_metadata_cache_entries e
    JOIN public.phase9_metadata_lookups l
      ON l.provider_cache_identity=e.provider_cache_identity
    WHERE l.candidate_id='${candidate}' AND e.outcome='positive'`),0);
  assert.equal(await scalar(db,`SELECT count(*)::int FROM public.phase9_metadata_cache_entries e
    JOIN public.phase9_metadata_lookups l
      ON l.provider_cache_identity=e.provider_cache_identity
    WHERE l.candidate_id='${candidate}' AND e.normalized_snapshot IS NOT NULL`),0);
  await setActor(db,OWNER,'authenticated');
  const owner=await scalar(db,`SELECT public.phase9_owner_candidate_detail_v2('${SESSION}','${candidate}')`);
  assert.equal(owner.metadata.state,'failed');
  await resetActor(db);
  await db.exec(`UPDATE public.phase9_provider_registry SET storage_allowed=true
    WHERE adapter_key='recorded_metadata'`);
  await resetActor(db);
});

test('reclaim reconstructs a finalized physical result without a second provider call',async()=>{
  const candidate='b3000000-0000-4000-8000-000000000001';
  await resetActor(db);
  await db.exec(`INSERT INTO public.image_analysis_observations(id,analysis_result_id,store_id,input_id,
      observation_ordinal,disposition,observed_title,observed_authors,observed_language,
      confidence,observation_snapshot)
    SELECT 'b3100000-0000-4000-8000-000000000001',analysis_result_id,store_id,input_id,
      3,'candidate','Response Loss Book',ARRAY['Fixture Author'],'en',1,'{}'::jsonb
    FROM public.image_analysis_observations WHERE observation_ordinal=1 LIMIT 1;
    INSERT INTO public.image_extraction_candidates(id,session_id,input_id,store_id,
      candidate_index,observed_title,observed_authors,observed_language,state,vision_job_id,
      analysis_observation_id,analysis_schema_version)
    SELECT '${candidate}',session_id,input_id,store_id,3,'Response Loss Book',
      ARRAY['Fixture Author'],'en','processing',vision_job_id,
      'b3100000-0000-4000-8000-000000000001',analysis_schema_version
    FROM public.image_extraction_candidates WHERE candidate_index=1 LIMIT 1;`);
  await setActor(db,OWNER,'service_role');
  let providerCalls=0; let losePhysicalResponse=true; let loseLogicalResponse=true;
  const rpcErrors=[];
  const base=serviceClientFor(rpcErrors);
  const serviceClient={rpc:async(name,p)=>{
    if(name==='phase9_finalize_metadata_provider_call' && losePhysicalResponse){
      losePhysicalResponse=false;
      const committed=await base.rpc(name,p);
      assert.equal(committed.error,null);
      return {data:null,error:new Error('simulated response loss after physical commit')};
    }
    if(name==='phase9_finalize_structural_metadata_attempt' && loseLogicalResponse){
      loseLogicalResponse=false;
      return {data:null,error:new Error('simulated response loss after physical commit')};
    }
    return base.rpc(name,p);
  }};
  const primary={lookup:async({correlationId,attemptId})=>{
    providerCalls+=1; const selected=fullEdition({correlationId,attemptId,
      title:'Response Loss Book',providerRecordId:'recovered-volume'});
    return {outcome:'coherent_match',candidates:[selected],selected,
      evidence:['exact_original_title_author_language'],
      retryable:false,secondaryEligible:false,providerRequestId:'recovered-request'};
  }};
  const first=await runMetadataWorkerBatch(1,{workerId:METADATA_WORKER,
    workerAuthToken:'unused',serviceClient,primary,primaryCapability:capability});
  assert.deepEqual(first,{claimed:1,results:[{outcome:'retry_scheduled'}]});
  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_jobs SET next_attempt_at=transaction_timestamp()
    WHERE entity_id='${candidate}' AND job_kind='metadata_enrich'`);
  await setActor(db,OWNER,'service_role');
  const second=await runMetadataWorkerBatch(1,{workerId:METADATA_WORKER,
    workerAuthToken:'unused',serviceClient,primary,primaryCapability:capability});
  assert.deepEqual(second,{claimed:1,results:[{outcome:'accepted_metadata_match'}]},
    JSON.stringify(rpcErrors));
  assert.equal(providerCalls,1);
  await resetActor(db);
  assert.equal(await scalar(db,`SELECT count(*)::int FROM public.phase9_metadata_provider_calls
    WHERE candidate_id='${candidate}'`),1);
  assert.equal(await scalar(db,`SELECT disposition FROM public.metadata_enrichment_attempts
    WHERE candidate_id='${candidate}'`),'accepted');
  assert.equal(await scalar(db,`SELECT count(*)::int FROM public.phase9_selected_metadata_snapshots
    WHERE candidate_id='${candidate}'`),1);
});

test('production coalescing materializes an identical follower with zero charge or egress',async()=>{
  const candidate='b4000000-0000-4000-8000-000000000001';
  await resetActor(db);
  await db.exec(`INSERT INTO public.image_analysis_observations(id,analysis_result_id,store_id,input_id,
      observation_ordinal,disposition,observed_title,observed_authors,observed_language,
      confidence,observation_snapshot)
    SELECT 'b4100000-0000-4000-8000-000000000001',analysis_result_id,store_id,input_id,
      4,'candidate','Structural Fixture Book',ARRAY['Fixture Author'],'en',1,'{}'::jsonb
    FROM public.image_analysis_observations WHERE observation_ordinal=1 LIMIT 1;
    INSERT INTO public.image_extraction_candidates(id,session_id,input_id,store_id,
      candidate_index,observed_title,observed_authors,observed_language,state,vision_job_id,
      analysis_observation_id,analysis_schema_version)
    SELECT '${candidate}',session_id,input_id,store_id,4,'Structural Fixture Book',
      ARRAY['Fixture Author'],'en','processing',vision_job_id,
      'b4100000-0000-4000-8000-000000000001',analysis_schema_version
    FROM public.image_extraction_candidates WHERE candidate_index=1 LIMIT 1;`);
  await setActor(db,OWNER,'service_role');
  let providerCalls=0; const rpcErrors=[];
  const primary={lookup:async()=>{providerCalls+=1;throw new Error('follower egress forbidden');}};
  const result=await runMetadataWorkerBatch(1,{workerId:METADATA_WORKER,
    workerAuthToken:'unused',serviceClient:serviceClientFor(rpcErrors),primary,
    primaryCapability:capability});
  assert.deepEqual(result,{claimed:1,results:[{outcome:'coalesced_follower'}]},
    JSON.stringify(rpcErrors));
  assert.equal(providerCalls,0);
  await resetActor(db);
  assert.equal(await scalar(db,`SELECT leader_lookup_id IS NOT NULL
    FROM public.phase9_metadata_lookups WHERE candidate_id='${candidate}'`),true);
  assert.equal(await scalar(db,`SELECT count(*)::int FROM public.phase9_usage_reservations
    WHERE job_id=(SELECT id FROM public.image_extraction_jobs WHERE entity_id='${candidate}'
      AND job_kind='metadata_enrich')`),0);
  assert.equal(await scalar(db,`SELECT state FROM public.image_extraction_candidates
    WHERE id='${candidate}'`),'ready');
});

test('concurrent identical cache misses atomically reserve one in-flight leader',async()=>{
  const leaderCandidate='b5000000-0000-4000-8000-000000000001';
  const followerCandidate='b6000000-0000-4000-8000-000000000001';
  await resetActor(db);
  await db.exec(`INSERT INTO public.image_analysis_observations(id,analysis_result_id,store_id,input_id,
      observation_ordinal,disposition,observed_title,observed_authors,observed_language,
      confidence,observation_snapshot)
    SELECT 'b5100000-0000-4000-8000-000000000001',analysis_result_id,store_id,input_id,
      5,'candidate','Concurrent Book',ARRAY['Fixture Author'],'en',1,'{}'::jsonb
    FROM public.image_analysis_observations WHERE observation_ordinal=1 LIMIT 1;
    INSERT INTO public.image_analysis_observations(id,analysis_result_id,store_id,input_id,
      observation_ordinal,disposition,observed_title,observed_authors,observed_language,
      confidence,observation_snapshot)
    SELECT 'b6100000-0000-4000-8000-000000000001',analysis_result_id,store_id,input_id,
      6,'candidate','Concurrent Book',ARRAY['Fixture Author'],'en',1,'{}'::jsonb
    FROM public.image_analysis_observations WHERE observation_ordinal=1 LIMIT 1;
    INSERT INTO public.image_extraction_candidates(id,session_id,input_id,store_id,
      candidate_index,observed_title,observed_authors,observed_language,state,vision_job_id,
      analysis_observation_id,analysis_schema_version)
    SELECT '${leaderCandidate}',session_id,input_id,store_id,5,'Concurrent Book',
      ARRAY['Fixture Author'],'en','processing',vision_job_id,
      'b5100000-0000-4000-8000-000000000001',analysis_schema_version
    FROM public.image_extraction_candidates WHERE candidate_index=1 LIMIT 1;
    INSERT INTO public.image_extraction_candidates(id,session_id,input_id,store_id,
      candidate_index,observed_title,observed_authors,observed_language,state,vision_job_id,
      analysis_observation_id,analysis_schema_version)
    SELECT '${followerCandidate}',session_id,input_id,store_id,6,'Concurrent Book',
      ARRAY['Fixture Author'],'en','processing',vision_job_id,
      'b6100000-0000-4000-8000-000000000001',analysis_schema_version
    FROM public.image_extraction_candidates WHERE candidate_index=1 LIMIT 1;`);
  await setActor(db,OWNER,'service_role');
  let releaseProvider; let announceProvider; let providerCalls=0;
  const providerStarted=new Promise((resolve)=>{announceProvider=resolve;});
  const providerRelease=new Promise((resolve)=>{releaseProvider=resolve;});
  const primary={lookup:async({correlationId,attemptId})=>{
    providerCalls+=1; announceProvider(); await providerRelease;
    const selected=fullEdition({correlationId,attemptId,title:'Concurrent Book',
      providerRecordId:'concurrent-volume'});
    return {outcome:'coherent_match',candidates:[selected],selected,
      evidence:['exact_original_title_author_language'],
      retryable:false,secondaryEligible:false,providerRequestId:'concurrent-request'};
  }};
  const coalescingBase=serviceClientFor([]);
  const coalescingClient={rpc:async(name,p)=>name==='phase9_store_metadata_cache'
    ? {data:null,error:new Error('cache disabled for coalescing proof')}
    : coalescingBase.rpc(name,p)};
  const dependencies={workerId:METADATA_WORKER,workerAuthToken:'unused',
    serviceClient:coalescingClient,primary,primaryCapability:capability};
  const leaderRun=runMetadataWorkerBatch(1,dependencies);
  await providerStarted;
  const pending=await runMetadataWorkerBatch(1,dependencies);
  assert.deepEqual(pending,{claimed:1,results:[{outcome:'manual_metadata_required'}]});
  releaseProvider();
  assert.deepEqual(await leaderRun,{claimed:1,results:[{outcome:'accepted_metadata_match'}]});
  await resetActor(db);
  const pendingCandidate=await scalar(db,`SELECT entity_id FROM public.image_extraction_jobs
    WHERE job_kind='metadata_enrich' AND status='retry_scheduled'
      AND entity_id IN ('${leaderCandidate}','${followerCandidate}')`);
  await db.exec(`UPDATE public.image_extraction_jobs SET next_attempt_at=transaction_timestamp()
    WHERE entity_id='${pendingCandidate}' AND job_kind='metadata_enrich'`);
  await setActor(db,OWNER,'service_role');
  assert.deepEqual(await runMetadataWorkerBatch(1,dependencies),
    {claimed:1,results:[{outcome:'coalesced_follower'}]});
  assert.equal(providerCalls,1);
  await resetActor(db);
  assert.equal(await scalar(db,`SELECT count(*)::int
    FROM public.phase9_metadata_coalescing_waiters w
    JOIN public.image_extraction_jobs j ON j.id=w.job_id
    WHERE j.entity_id='${pendingCandidate}' AND w.leader_lookup_id IS NOT NULL`),1);
  assert.equal(await scalar(db,`SELECT count(*)::int FROM public.phase9_usage_reservations
    WHERE job_id=(SELECT id FROM public.image_extraction_jobs WHERE entity_id='${pendingCandidate}'
      AND job_kind='metadata_enrich')`),0);
});

test('local resolution gives a validated ISBN match precedence over title equivalence',async()=>{
  const candidate='b7000000-0000-4000-8000-000000000001';
  const exactEdition='b7100000-0000-4000-8000-000000000001';
  const titleEdition='b7200000-0000-4000-8000-000000000001';
  await resetActor(db);
  await db.exec(`INSERT INTO public.canonical_editions(id,isbn_10,isbn_13,title,authors,language)
    VALUES('${exactEdition}','0306406152','9780306406157','Different Title',ARRAY['Other'],'en'),
      ('${titleEdition}',NULL,'9780804429573','Priority Book',ARRAY['Fixture Author'],'en');
    INSERT INTO public.image_analysis_observations(id,analysis_result_id,store_id,input_id,
      observation_ordinal,disposition,observed_title,observed_authors,observed_isbn_clue,
      observed_language,confidence,observation_snapshot)
    SELECT 'b7300000-0000-4000-8000-000000000001',analysis_result_id,store_id,input_id,
      7,'candidate','Priority Book',ARRAY['Fixture Author'],'0-306-40615-2','en',1,'{}'::jsonb
    FROM public.image_analysis_observations WHERE observation_ordinal=1 LIMIT 1;
    INSERT INTO public.image_extraction_candidates(id,session_id,input_id,store_id,
      candidate_index,observed_title,observed_authors,observed_isbn_clue,observed_language,
      state,vision_job_id,analysis_observation_id,analysis_schema_version)
    SELECT '${candidate}',session_id,input_id,store_id,7,'Priority Book',
      ARRAY['Fixture Author'],'0-306-40615-2','en','processing',vision_job_id,
      'b7300000-0000-4000-8000-000000000001',analysis_schema_version
    FROM public.image_extraction_candidates WHERE candidate_index=1 LIMIT 1;
    INSERT INTO public.image_extraction_jobs(id,store_id,entity_type,entity_id,job_kind,
      dedupe_key,operation_version)
    SELECT 'b7400000-0000-4000-8000-000000000001','${STORE}','candidate','${candidate}',
      'metadata_enrich','metadata:${candidate}','p9-metadata-foundation-v1'
    WHERE NOT EXISTS(SELECT 1 FROM public.image_extraction_jobs
      WHERE entity_id='${candidate}' AND job_kind='metadata_enrich');`);
  await setActor(db,OWNER,'service_role');
  const claim=(await db.query(`SELECT * FROM public.claim_phase9_metadata_jobs(1,
    '${METADATA_WORKER}')`)).rows[0];
  const context=await scalar(db,`SELECT public.phase9_metadata_job_context('${claim.id}',
    '${METADATA_WORKER}','${claim.lease_token}',${claim.attempt_count})`);
  assert.equal(context.localCanonicalEditionId,exactEdition);
});

test('physical-call finalization rejects a newly non-authoritative vision result without mutation',async()=>{
  const candidate='b8000000-0000-4000-8000-000000000001';
  await resetActor(db);
  await db.exec(`INSERT INTO public.image_analysis_observations(id,analysis_result_id,store_id,input_id,
      observation_ordinal,disposition,observed_title,observed_authors,observed_language,
      confidence,observation_snapshot)
    SELECT 'b8100000-0000-4000-8000-000000000001',analysis_result_id,store_id,input_id,
      8,'candidate','Rejected Authority Book',ARRAY['Fixture Author'],'en',1,'{}'::jsonb
    FROM public.image_analysis_observations WHERE observation_ordinal=1 LIMIT 1;
    INSERT INTO public.image_extraction_candidates(id,session_id,input_id,store_id,
      candidate_index,observed_title,observed_authors,observed_language,state,vision_job_id,
      analysis_observation_id,analysis_schema_version)
    SELECT '${candidate}',session_id,input_id,store_id,8,'Rejected Authority Book',
      ARRAY['Fixture Author'],'en','processing',vision_job_id,
      'b8100000-0000-4000-8000-000000000001',analysis_schema_version
    FROM public.image_extraction_candidates WHERE candidate_index=1 LIMIT 1;
    INSERT INTO public.image_extraction_jobs(id,store_id,entity_type,entity_id,job_kind,
      dedupe_key,operation_version)
    SELECT 'b8200000-0000-4000-8000-000000000001','${STORE}','candidate','${candidate}',
      'metadata_enrich','metadata:${candidate}','p9-metadata-foundation-v1'
    WHERE NOT EXISTS(SELECT 1 FROM public.image_extraction_jobs
      WHERE entity_id='${candidate}' AND job_kind='metadata_enrich');`);
  await setActor(db,OWNER,'service_role');
  let providerCalls=0; let invalidateBeforeFinalize=true; const rpcErrors=[];
  const base=serviceClientFor(rpcErrors);
  const serviceClient={rpc:async(name,p)=>{
    if(name==='phase9_finalize_metadata_provider_call' && invalidateBeforeFinalize){
      invalidateBeforeFinalize=false;
      await resetActor(db);
      await db.exec(`ALTER TABLE public.image_analysis_results DISABLE TRIGGER image_analysis_results_immutable;
        UPDATE public.image_analysis_results SET authoritative_outcome='quality_rejected'
          WHERE id=(SELECT analysis_result_id FROM public.image_analysis_observations
            WHERE id='b8100000-0000-4000-8000-000000000001');
        ALTER TABLE public.image_analysis_results ENABLE TRIGGER image_analysis_results_immutable;`);
      await setActor(db,OWNER,'service_role');
    }
    return base.rpc(name,p);
  }};
  const primary={lookup:async({correlationId,attemptId})=>{
    providerCalls+=1;
    const selected={contractVersion:'p9-contract-v1',schemaVersion:'p9-metadata-v1',
      adapterKey:'recorded_metadata',adapterVersion:'1.0.0',
      normalizerVersion:'p9-bibliographic-normalizer-v1',correlationId,attemptId,
      providerRecordId:'authority-volume',fetchedAt:'2026-08-07T00:00:00.000Z',
      title:'Rejected Authority Book',subtitle:null,authors:['Fixture Author'],description:null,
      isbn10:null,isbn13:null,publisher:null,publishedDate:null,language:'en',script:null,
      editionStatement:null,series:null,volume:null,format:null,pageCount:null,categories:[],
      coverReference:null,matchRationale:'exact_original_title_author_language',confidence:1};
    return {outcome:'coherent_match',candidates:[selected],selected,
      evidence:['exact_original_title_author_language'],retryable:false,
      secondaryEligible:false,providerRequestId:'authority-request'};
  }};
  const result=await runMetadataWorkerBatch(1,{workerId:METADATA_WORKER,
    workerAuthToken:'unused',serviceClient,primary,primaryCapability:capability});
  assert.deepEqual(result,{claimed:1,results:[{outcome:'stale_claim'}]});
  assert.equal(providerCalls,1);
  assert.equal(rpcErrors.some((entry)=>entry.name==='phase9_finalize_metadata_provider_call'
    && entry.message.includes('P9_STATE_CONFLICT')),true,JSON.stringify(rpcErrors));
  await resetActor(db);
  assert.equal(await scalar(db,`SELECT status FROM public.phase9_metadata_provider_calls
    WHERE candidate_id='${candidate}'`),'registered');
  assert.equal(await scalar(db,`SELECT normalized_candidate IS NULL
    FROM public.phase9_metadata_provider_calls WHERE candidate_id='${candidate}'`),true);
  assert.equal(await scalar(db,`SELECT disposition FROM public.metadata_enrichment_attempts
    WHERE candidate_id='${candidate}'`),'unresolved');
  assert.equal(await scalar(db,`SELECT state FROM public.image_extraction_candidates
    WHERE id='${candidate}'`),'processing');
  assert.equal(await scalar(db,`SELECT status FROM public.image_extraction_jobs
    WHERE entity_id='${candidate}' AND job_kind='metadata_enrich'`),'in_progress');
  assert.equal(await scalar(db,`SELECT count(*)::int FROM public.phase9_selected_metadata_snapshots
    WHERE candidate_id='${candidate}'`),0);
  await resetActor(db);
  await db.exec(`ALTER TABLE public.image_analysis_results DISABLE TRIGGER image_analysis_results_immutable;
    UPDATE public.image_analysis_results SET authoritative_outcome='accepted'
      WHERE id=(SELECT analysis_result_id FROM public.image_analysis_observations
        WHERE id='b8100000-0000-4000-8000-000000000001');
    ALTER TABLE public.image_analysis_results ENABLE TRIGGER image_analysis_results_immutable;`);
});

test('authorized Owner review cannot version a processing candidate during physical egress',async()=>{
  const candidate='b8500000-0000-4000-8000-000000000001';
  await seedStructuralCandidate({
    candidate,observation:'b8510000-0000-4000-8000-000000000001',index:14,
    title:'Owner Fence Book',
  });
  const versionBefore=await scalar(db,`SELECT version FROM public.image_extraction_candidates
    WHERE id='${candidate}'`);
  await setActor(db,OWNER,'service_role');
  const review={originalTitle:'Owner Fence Book',authors:['Fixture Author'],originalLanguage:'en',
    script:'Latn',metadataChoice:{mode:'manual',selectionId:null},quantity:1,priceMinor:0,
    baseCondition:'good',damageDisclosure:{hasDamage:false,damageTypes:[],damageNote:null,
      isSellable:true,completeReadableSafe:true},shelfLocation:'A1',
    notes:{publicNote:null,internalNote:null},publicationIntent:'private',duplicateIntent:null,
    originalFieldConfirmation:{title:true,authors:[true]},candidateDisposition:'reviewed'};
  let ownerTransitionAttempted=false; let ownerTransitionError=null;
  let ownerVersionAfterAttempt=null; let ownerStateAfterAttempt=null;
  const rpcErrors=[]; const base=serviceClientFor(rpcErrors);
  const serviceClient={rpc:async(name,p)=>{
    if(name==='phase9_register_metadata_provider_call'&&!ownerTransitionAttempted){
      ownerTransitionAttempted=true;
      await setActor(db,OWNER,'authenticated');
      try {
        await db.query(`SELECT public.phase9_update_candidate_review_v2(
          '${SESSION}','${candidate}',${versionBefore},1,
          '${JSON.stringify(review).replaceAll("'","''")}'::jsonb,
          'h1-owner-fence-0001',gen_random_uuid())`);
      } catch(error) { ownerTransitionError=String(error); }
      await setActor(db,OWNER,'service_role');
      ownerVersionAfterAttempt=await scalar(db,`SELECT version FROM public.image_extraction_candidates
        WHERE id='${candidate}'`);
      ownerStateAfterAttempt=await scalar(db,`SELECT state FROM public.image_extraction_candidates
        WHERE id='${candidate}'`);
    }
    return base.rpc(name,p);
  }};
  const primary={lookup:async({correlationId,attemptId})=>{
    const selected=fullEdition({correlationId,attemptId,title:'Owner Fence Book',providerRecordId:'owner-fence-volume'});
    return {outcome:'coherent_match',candidates:[selected],selected,
      evidence:['exact_original_title_author_language'],retryable:false,
      secondaryEligible:false,providerRequestId:'owner-fence-request'};
  }};
  const result=await runMetadataWorkerBatch(1,{workerId:METADATA_WORKER,
    workerAuthToken:'unused',serviceClient,primary,primaryCapability:capability});
  assert.deepEqual(result,{claimed:1,results:[{outcome:'accepted_metadata_match'}]},
    JSON.stringify({rpcErrors,ownerTransitionError}));
  assert.equal(ownerTransitionAttempted,true);
  assert.match(ownerTransitionError,/P9_(?:STATE|VERSION)_CONFLICT/);
  assert.equal(ownerVersionAfterAttempt,versionBefore);
  assert.equal(ownerStateAfterAttempt,'processing');
  await resetActor(db);
  assert.equal(await scalar(db,`SELECT state FROM public.image_extraction_candidates
    WHERE id='${candidate}'`),'ready');
  assert.equal(await scalar(db,`SELECT count(*)::int FROM public.phase9_selected_metadata_snapshots
    WHERE candidate_id='${candidate}'`),1);
});

test('registered physical call survives reclaim and stale worker cannot overwrite newer evidence',async()=>{
  const candidate='b8600000-0000-4000-8000-000000000001';
  await seedStructuralCandidate({
    candidate,observation:'b8610000-0000-4000-8000-000000000001',index:15,
    title:'Registered Reclaim Book',
  });
  await setActor(db,OWNER,'service_role');
  const reclaimedWorker='metadata-worker-reclaim-01';
  let registeredCallId=null; let oldClaim=null; let forceReclaim=false;
  let reclaimInjected=false; let providerCalls=0;
  const rpcErrors=[]; const base=serviceClientFor(rpcErrors);
  const serviceClient={rpc:async(name,p)=>{
    const result=await base.rpc(name,p);
    if(name==='claim_phase9_metadata_jobs' && p.p_worker===METADATA_WORKER
      && result.error===null && Array.isArray(result.data) && result.data.length===1
      && oldClaim===null) {
      oldClaim=result.data[0];
    }
    if(name==='phase9_register_metadata_provider_call'&&result.error===null&&!reclaimInjected){
      registeredCallId=result.data.provider_call_id;
      forceReclaim=true;
      reclaimInjected=true;
    } else if(name==='claim_phase9_metadata_jobs' && p.p_worker===reclaimedWorker
      && result.error===null && Array.isArray(result.data) && result.data.length===1) {
      await resetActor(db);
      await db.exec(`UPDATE public.image_extraction_jobs SET
        lease_expires_at=clock_timestamp()+interval '5 minutes',
        next_attempt_at=clock_timestamp()
        WHERE id='${result.data[0].id}'`);
      await setActor(db,OWNER,'service_role');
    } else if(name==='phase9_metadata_job_context'&&forceReclaim&&result.error===null){
      forceReclaim=false;
      await resetActor(db);
      await db.exec(`UPDATE public.image_extraction_jobs SET
        lease_expires_at=transaction_timestamp()-interval '1 second',
        next_attempt_at=transaction_timestamp()
        WHERE entity_id='${candidate}' AND job_kind='metadata_enrich'`);
      await setActor(db,OWNER,'service_role');
    }
    return result;
  }};
  const primary={lookup:async({correlationId,attemptId})=>{
    providerCalls+=1;
    const selected=fullEdition({correlationId,attemptId,title:'Registered Reclaim Book',
      providerRecordId:`reclaim-volume-${providerCalls}`});
    return {outcome:'coherent_match',candidates:[selected],selected,
      evidence:['exact_original_title_author_language'],retryable:false,
      secondaryEligible:false,providerRequestId:`reclaim-request-${providerCalls}`};
  }};
  const first=await runMetadataWorkerBatch(1,{workerId:METADATA_WORKER,
    workerAuthToken:'unused',serviceClient,primary,primaryCapability:capability});
  assert.deepEqual(first,{claimed:1,results:[{outcome:'stale_claim'}]},
    JSON.stringify({rpcErrors,registeredCallId,providerCalls}));
  assert.ok(registeredCallId);
  assert.equal(providerCalls,1);
  await resetActor(db);
  assert.equal(await scalar(db,`SELECT status FROM public.phase9_metadata_provider_calls
    WHERE id='${registeredCallId}'`),'registered');
  assert.equal(await scalar(db,`SELECT normalized_candidate IS NULL
    FROM public.phase9_metadata_provider_calls WHERE id='${registeredCallId}'`),true);
  assert.equal(await scalar(db,`SELECT state FROM public.image_extraction_candidates
    WHERE id='${candidate}'`),'processing');
  assert.equal(await scalar(db,`SELECT count(*)::int FROM public.phase9_selected_metadata_snapshots
    WHERE candidate_id='${candidate}'`),0);

  await setActor(db,OWNER,'service_role');
  const second=await runMetadataWorkerBatch(1,{workerId:reclaimedWorker,
    workerAuthToken:'unused',serviceClient,primary,primaryCapability:capability});
  assert.deepEqual(second,{claimed:1,results:[{outcome:'accepted_metadata_match'}]},
    JSON.stringify({rpcErrors,registeredCallId,providerCalls}));
  assert.equal(providerCalls,2);
  assert.ok(oldClaim);
  const staleFinalize=await serviceClient.rpc('phase9_finalize_metadata_provider_call',{
    p_provider_call_id:registeredCallId,p_job_id:oldClaim.id,p_worker:METADATA_WORKER,
    p_lease_token:oldClaim.lease_token,p_attempt_count:oldClaim.attempt_count,
    p_status:'finalized',p_normalized_outcome:'coherent_match',
    p_logical_outcome:'coherent_match',p_provider_request_id:'stale-overwrite-attempt',
    p_retryable:false,p_normalized_candidate:fullEdition({
      correlationId:'stale-correlation',attemptId:'stale-attempt',
      title:'Registered Reclaim Book',providerRecordId:'stale-overwrite-volume'}),
    p_match_evidence:['stale-overwrite-attempt'],
  });
  assert.notEqual(staleFinalize.error,null);
  await resetActor(db);
  assert.deepEqual((await db.query(`SELECT status FROM public.phase9_metadata_provider_calls
    WHERE candidate_id='${candidate}' ORDER BY created_at,id`)).rows.map((row)=>row.status),
  ['registered','finalized']);
  assert.equal(await scalar(db,`SELECT count(*)::int FROM public.metadata_enrichment_attempts
    WHERE candidate_id='${candidate}'`),1);
  assert.equal(await scalar(db,`SELECT count(*)::int FROM public.phase9_selected_metadata_snapshots
    WHERE candidate_id='${candidate}'`),1);
  assert.equal(await scalar(db,`SELECT state FROM public.image_extraction_candidates
    WHERE id='${candidate}'`),'ready');
});

test('physical finalization failure before commit durably records outcome_unknown',async()=>{
  const candidate='b9000000-0000-4000-8000-000000000001';
  await seedStructuralCandidate({
    candidate,observation:'b9100000-0000-4000-8000-000000000001',index:9,
    title:'Unknown Egress Book',
  });
  await setActor(db,OWNER,'service_role');
  let providerCalls=0; let failBeforeCommit=true; let reconcileReplay=null; const rpcErrors=[];
  const base=serviceClientFor(rpcErrors);
  const serviceClient={rpc:async(name,p)=>{
    if(name==='phase9_finalize_metadata_provider_call' && failBeforeCommit){
      failBeforeCommit=false;
      return {data:null,error:new Error('simulated failure before physical commit')};
    }
    const result=await base.rpc(name,p);
    if(name==='phase9_reconcile_metadata_provider_call' && result.error===null
      && reconcileReplay===null){
      reconcileReplay=await base.rpc(name,p);
      assert.deepEqual(reconcileReplay,result);
    }
    return result;
  }};
  const primary={lookup:async({correlationId,attemptId})=>{
    providerCalls+=1;
    const selected=fullEdition({correlationId,attemptId,title:'Unknown Egress Book',
      providerRecordId:'unknown-egress-volume'});
    return {outcome:'coherent_match',candidates:[selected],selected,
      evidence:['exact_original_title_author_language'],retryable:false,
      secondaryEligible:false,providerRequestId:'unknown-egress-request'};
  }};
  const result=await runMetadataWorkerBatch(1,{workerId:METADATA_WORKER,
    workerAuthToken:'unused',serviceClient,primary,primaryCapability:capability});
  assert.deepEqual(result,{claimed:1,results:[{outcome:'retry_scheduled'}]},
    JSON.stringify({rpcErrors,reconcileReplay}));
  assert.equal(providerCalls,1);
  await resetActor(db);
  assert.equal(await scalar(db,`SELECT status FROM public.phase9_metadata_provider_calls
    WHERE candidate_id='${candidate}'`),'outcome_unknown');
  assert.equal(await scalar(db,`SELECT normalized_outcome FROM public.phase9_metadata_provider_calls
    WHERE candidate_id='${candidate}'`),'provider_unavailable');
  assert.equal(await scalar(db,`SELECT retryable FROM public.phase9_metadata_provider_calls
    WHERE candidate_id='${candidate}'`),true);
  assert.equal(await scalar(db,`SELECT normalized_candidate IS NULL
    FROM public.phase9_metadata_provider_calls WHERE candidate_id='${candidate}'`),true);
  assert.ok(reconcileReplay);
  await db.exec(`UPDATE public.image_extraction_jobs SET next_attempt_at=transaction_timestamp()
    WHERE entity_id='${candidate}' AND job_kind='metadata_enrich'`);
  await setActor(db,OWNER,'service_role');
  const reclaimed=await runMetadataWorkerBatch(1,{workerId:METADATA_WORKER,
    workerAuthToken:'unused',serviceClient,primary,primaryCapability:capability});
  assert.deepEqual(reclaimed,{claimed:1,results:[{outcome:'accepted_metadata_match'}]},
    JSON.stringify(rpcErrors));
  assert.equal(providerCalls,2);
  await resetActor(db);
  assert.deepEqual((await db.query(`SELECT status FROM public.phase9_metadata_provider_calls
    WHERE candidate_id='${candidate}' ORDER BY created_at,id`)).rows.map((row)=>row.status),
  ['outcome_unknown','finalized']);
});

test('later claim retries provider after finalized transient result and completes',async()=>{
  const candidate='ba000000-0000-4000-8000-000000000001';
  await seedStructuralCandidate({
    candidate,observation:'ba100000-0000-4000-8000-000000000001',index:10,
    title:'Retryable Replay Book',
  });
  await setActor(db,OWNER,'service_role');
  let fetchCalls=0; const claimAttempts=[]; const rpcErrors=[];
  const base=serviceClientFor(rpcErrors);
  const serviceClient={rpc:async(name,p)=>{
    const result=await base.rpc(name,p);
    if(name==='claim_phase9_metadata_jobs' && result.error===null
      && Array.isArray(result.data) && result.data.length===1) {
      claimAttempts.push(result.data[0].attempt_count);
    }
    return result;
  }};
  await resetActor(db);
  await db.exec(`INSERT INTO public.phase9_provider_registry(adapter_key,provider_kind,
    adapter_version,enabled,matching_allowed,storage_allowed,revalidation_seconds,policy_version)
    VALUES('google_books','metadata','1.0.0',true,true,true,86400,1)
    ON CONFLICT(adapter_key) DO UPDATE SET enabled=true,matching_allowed=true,
      storage_allowed=true,revalidation_seconds=86400,policy_version=1`);
  await setActor(db,OWNER,'service_role');
  const primary=new GoogleBooksAdapter({mode:'real',apiKey:'test-only-key',
    timeoutMs:1000,maxResponseBytes:64000,fetcher:async()=>{
      fetchCalls+=1;
      if(fetchCalls===1) return new Response('',{status:503,
        headers:{'content-type':'application/json','x-request-id':'retry-503'}});
      return new Response(JSON.stringify({totalItems:1,items:[{id:'retry-success-volume',
        volumeInfo:{title:'Retryable Replay Book',authors:['Fixture Author'],language:'en'}}]}),
      {status:200,headers:{'content-type':'application/json','x-request-id':'retry-200'}});
    }});
  const first=await runMetadataWorkerBatch(1,{workerId:METADATA_WORKER,
    workerAuthToken:'unused',serviceClient,primary,primaryCapability:GOOGLE_BOOKS_CAPABILITY});
  assert.deepEqual(first,{claimed:1,results:[{outcome:'manual_metadata_required'}]});
  await resetActor(db);
  assert.equal(await scalar(db,`SELECT status FROM public.phase9_metadata_provider_calls
    WHERE candidate_id='${candidate}'`),'finalized');
  assert.equal(await scalar(db,`SELECT normalized_outcome FROM public.phase9_metadata_provider_calls
    WHERE candidate_id='${candidate}'`),'provider_unavailable');
  await db.exec(`UPDATE public.image_extraction_jobs SET next_attempt_at=transaction_timestamp()
    WHERE entity_id='${candidate}' AND job_kind='metadata_enrich'`);
  await setActor(db,OWNER,'service_role');
  const reclaimed=await runMetadataWorkerBatch(1,{workerId:METADATA_WORKER,
    workerAuthToken:'unused',serviceClient,primary,primaryCapability:GOOGLE_BOOKS_CAPABILITY});
  assert.deepEqual(reclaimed,{claimed:1,results:[{outcome:'accepted_metadata_match'}]},
    JSON.stringify(rpcErrors));
  assert.equal(fetchCalls,2);
  assert.deepEqual(claimAttempts,[1,2]);
  await resetActor(db);
  assert.equal(await scalar(db,`SELECT count(*)::int FROM public.phase9_metadata_provider_calls
    WHERE candidate_id='${candidate}'`),2);
  assert.deepEqual((await db.query(`SELECT claim_attempt_number,status
    FROM public.phase9_metadata_provider_calls WHERE candidate_id='${candidate}'
    ORDER BY claim_attempt_number,id`)).rows,[
    {claim_attempt_number:1,status:'finalized'},
    {claim_attempt_number:2,status:'finalized'},
  ]);
  assert.equal(await scalar(db,`SELECT count(*)::int FROM public.metadata_enrichment_attempts
    WHERE candidate_id='${candidate}'`),1);
  assert.equal(await scalar(db,`SELECT status FROM public.image_extraction_jobs
    WHERE entity_id='${candidate}' AND job_kind='metadata_enrich'`),'resolved');
  assert.equal(await scalar(db,`SELECT attempt_count FROM public.image_extraction_jobs
    WHERE entity_id='${candidate}' AND job_kind='metadata_enrich'`),2);
  assert.equal(await scalar(db,`SELECT status<>'dead_letter'
    AND attempt_count<max_attempts
    AND last_safe_error_code IS DISTINCT FROM 'P9_METADATA_ATTEMPTS_EXHAUSTED'
    FROM public.image_extraction_jobs
    WHERE entity_id='${candidate}' AND job_kind='metadata_enrich'`),true);
  assert.equal(await scalar(db,`SELECT state FROM public.image_extraction_candidates
    WHERE id='${candidate}'`),'ready');
  assert.equal(await scalar(db,`SELECT count(*)::int FROM public.phase9_selected_metadata_snapshots
    WHERE candidate_id='${candidate}'`),1);
});

test('one failed sibling completion cannot abort another candidate durable success',async()=>{
  const failedCandidate='bb000000-0000-4000-8000-000000000001';
  const successfulCandidate='bc000000-0000-4000-8000-000000000001';
  await seedStructuralCandidate({candidate:failedCandidate,
    observation:'bb100000-0000-4000-8000-000000000001',index:11,
    title:'Batch Failure Book'});
  await seedStructuralCandidate({candidate:successfulCandidate,
    observation:'bc100000-0000-4000-8000-000000000001',index:12,
    title:'Batch Success Book'});
  await setActor(db,OWNER,'service_role');
  const rpcErrors=[]; const base=serviceClientFor(rpcErrors);
  const serviceClient={rpc:async(name,p)=>{
    if(name==='phase9_fail_metadata_job' && p.p_candidate_id===failedCandidate){
      return {data:null,error:new Error('simulated failure-completion rejection')};
    }
    return base.rpc(name,p);
  }};
  const primary={lookup:async({query,correlationId,attemptId})=>{
    if(query.normalizedTitle==='batch failure book') {
      throw new Error('simulated candidate processing failure');
    }
    const selected=fullEdition({correlationId,attemptId,title:'Batch Success Book',
      providerRecordId:'batch-success-volume'});
    return {outcome:'coherent_match',candidates:[selected],selected,
      evidence:['exact_original_title_author_language'],retryable:false,
      secondaryEligible:false,providerRequestId:'batch-success-request'};
  }};
  const batch=await runMetadataWorkerBatch(2,{workerId:METADATA_WORKER,
    workerAuthToken:'unused',serviceClient,primary,primaryCapability:capability});
  assert.equal(batch.claimed,2);
  assert.deepEqual(batch.results.map((item)=>item.outcome).sort(),
    ['accepted_metadata_match','stale_claim']);
  await resetActor(db);
  assert.equal(await scalar(db,`SELECT status FROM public.image_extraction_jobs
    WHERE entity_id='${failedCandidate}' AND job_kind='metadata_enrich'`),'in_progress');
  assert.equal(await scalar(db,`SELECT state FROM public.image_extraction_candidates
    WHERE id='${failedCandidate}'`),'processing');
  assert.equal(await scalar(db,`SELECT status FROM public.image_extraction_jobs
    WHERE entity_id='${successfulCandidate}' AND job_kind='metadata_enrich'`),'resolved');
  assert.equal(await scalar(db,`SELECT state FROM public.image_extraction_candidates
    WHERE id='${successfulCandidate}'`),'ready');
  assert.equal(await scalar(db,`SELECT count(*)::int FROM public.phase9_selected_metadata_snapshots
    WHERE candidate_id='${successfulCandidate}' AND manual_outcome='accepted_metadata_match'`),1);
});

test('invalid non-null ISBN uses bibliographic identity through the worker path',async()=>{
  const candidate='bd000000-0000-4000-8000-000000000001';
  await seedStructuralCandidate({
    candidate,observation:'bd100000-0000-4000-8000-000000000001',index:13,
    title:'Invalid Isbn Worker Book',isbn:'9780306406158',
  });
  await setActor(db,OWNER,'service_role');
  let providerCalls=0; let observedQuery=null; const rpcErrors=[];
  const primary={lookup:async({query})=>{
    providerCalls+=1; observedQuery=query;
    return {outcome:'no_acceptable_match',candidates:[],selected:null,evidence:[],
      retryable:false,secondaryEligible:true,providerRequestId:null};
  }};
  const result=await runMetadataWorkerBatch(1,{workerId:METADATA_WORKER,
    workerAuthToken:'unused',serviceClient:serviceClientFor(rpcErrors),primary,
    primaryCapability:capability});
  assert.deepEqual(result,{claimed:1,results:[{outcome:'manual_metadata_required'}]},
    JSON.stringify(rpcErrors));
  assert.equal(providerCalls,1);
  assert.equal(observedQuery.strategy,'bibliographic');
  assert.equal(observedQuery.normalizedIsbn13,null);
  assert.equal(rpcErrors.some((entry)=>entry.message.includes(
    'P9_METADATA_QUERY_IDENTITY_MISMATCH')),false,JSON.stringify(rpcErrors));
  await resetActor(db);
  assert.equal(await scalar(db,`SELECT lookup_strategy FROM public.phase9_metadata_lookups
    WHERE candidate_id='${candidate}'`),'bibliographic');
  assert.equal(await scalar(db,`SELECT state FROM public.image_extraction_candidates
    WHERE id='${candidate}'`),'needs_review');
  assert.equal(await scalar(db,`SELECT status FROM public.image_extraction_jobs
    WHERE entity_id='${candidate}' AND job_kind='metadata_enrich'`),'resolved');
});
