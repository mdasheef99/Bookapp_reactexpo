// 02b sections 7.1/8/12: shared in-process cache fixtures; no HTTP.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { catalogueBatch, completeCatalogueV2, providerOnlyFacts, requireM87 } from './leanCatalogueFixture.mjs';
import { readSql, resetActor, rpc, scalar, setActor } from './catalogueLinkFixture.mjs';
import { claimJob, lookupSql, seedCard } from './editionPickerFixture.mjs';
import { fence, token, worker } from './editionOptionsCompletionFixture.mjs';

// 02b section 8.1/AC7-26: actual vision persistence establishes the immutable
// observation/result/input chain. The fixture never sets a scope or cache key.
export async function scanCacheCard(db, overrides={}) {
  const base = await seedCard(db,{isbn:null}); await resetActor(db);
  await db.query('DELETE FROM public.image_extraction_candidates WHERE id=$1',[base.candidateId]);
  const input=randomUUID(), media=randomUUID(), job=randomUUID(), correlation=randomUUID();
  await db.query(`INSERT INTO public.media_assets(id,store_id,uploaded_by,purpose,privacy_class,bucket_id,
    object_path,sha256,detected_mime,bytes,width,height,validation_version,validated_at,reencode_version,
    exif_strip_version,session_id,retention_class,lifecycle_status) VALUES($1,$2,$3,'scan_input','private_scan',
    'image-extraction-inputs',$1::uuid::text,repeat('a',64),'image/webp',32,1,1,'phase9-media-v1',
    transaction_timestamp(),'fixture','fixture',$4,'phase9-private-scan','linked')`,[media,base.storeId,base.ownerId,base.sessionId]);
  await db.query(`INSERT INTO public.image_extraction_inputs(id,session_id,store_id,media_asset_id,source_kind,
    state,sha256,orchestration_version) VALUES($1,$2,$3,$4,'camera','queued',repeat('a',64),'phase9-v1')`,
    [input,base.sessionId,base.storeId,media]);
  await db.query(`UPDATE public.image_extraction_sessions SET orchestration_version='phase9-v1',
    prompt_version='fixture-prompt-v2' WHERE id=$1`,[base.sessionId]);
  await db.query(`INSERT INTO public.image_extraction_jobs(id,store_id,entity_type,entity_id,job_kind,dedupe_key,
    operation_version,correlation_id,status,attempt_count,lease_owner,lease_token_hash,lease_expires_at)
    VALUES($1,$2,'input',$3,'vision_extract',$1::uuid::text,'phase9-v1',$4,'in_progress',1,$5,
    encode(extensions.digest($6,'sha256'),'hex'),transaction_timestamp()+interval '5 minutes')`,
    [job,base.storeId,input,correlation,worker,token]);
  const m=providerOnlyFacts(overrides), observation={ordinal:1,title_guess:m.title,author_guesses:m.authors,
    publisher_clue:null,isbn_clue:null,detected_language:m.language,confidence:0.9,geometry:null,warning_codes:[]};
  const result={contract_version:'p9-contract-v1',schema_version:'p9-vision-v2',pipeline_version:'phase9-v1',
    prompt_version:'fixture-prompt-v2',adapter_key:'fixture_adapter',adapter_version:'1.0.0',
    job_reference:'job_'+correlation.replaceAll('-',''),attempt_number:1,correlation_id:correlation,
    expected_language:'en',provider_key:'recorded_fixture',model_key:'fixture_multimodal',model_version:'2026-07-26',
    received_at:new Date().toISOString(),image_outcome:'analyzed',detected_visible_book_count:1,
    observations:[observation],warning_codes:[]};
  await setActor(db,base.ownerId,'service_role');
  await db.query('SELECT marketplace_sec.phase9_vision_job_context($1,$2,$3,1)',[job,worker,token]);
  const persisted=await db.query('SELECT marketplace_sec.phase9_persist_vision_analysis($1,$2,$3,1,$4)',[job,worker,token,result]);
  await resetActor(db);
  const c=(await db.query(`SELECT c.id FROM public.image_extraction_candidates c JOIN public.image_analysis_observations o
    ON o.id=c.analysis_observation_id JOIN public.image_analysis_results r ON r.id=o.analysis_result_id
    WHERE c.session_id=$1 AND r.vision_job_id=$2 AND r.canonical_result_snapshot=$3::jsonb
      AND o.observation_snapshot=$4::jsonb`,[base.sessionId,job,result,observation])).rows;
  assert.equal(c.length,1,'real vision completion must persist the exact immutable source snapshots: '+JSON.stringify(persisted.rows));
  // Retire the automatically queued job before an explicit Search Books request.
  await db.query(`UPDATE public.image_extraction_jobs SET status='resolved',completed_at=transaction_timestamp()
    WHERE entity_type='candidate' AND entity_id=$1`,[c[0].id]);
  await db.query("UPDATE public.image_extraction_candidates SET state='needs_review' WHERE id=$1",[c[0].id]);
  return {...base,candidateId:c[0].id,facts:m};
}
export async function cacheRequest(db, card) {
  await setActor(db,card.ownerId);
  const choices=await scalar(db,readSql(card));
  const request=await scalar(db,lookupSql(card,choices.requestGeneration));
  const context=await scalar(db,await claimJob(db,card,request.operationId));
  return {...card,jobId:request.operationId,context,attempt:1};
}
export const cacheVersions = overrides => ({ adapterKey:'open_library',adapterVersion:'1.0.0',
  capabilityVersion:'open-library-capability-v1',normalizerVersion:'p9-bibliographic-normalizer-v1',
  schemaVersion:'p9-metadata-foundation-v1',routingPolicyVersion:'p9-metadata-routing-v1',
  cachePolicyVersion:'p9-metadata-cache-v1',reusePolicyVersion:'1',companionVersion:'psr-catalogue-write-v1',...overrides });
export async function reuseCatalogueCache(db,f,versions=cacheVersions()) {
  await requireM87(db,'public.phase9_reuse_candidate_edition_cache_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,jsonb)');
  await setActor(db,f.ownerId,'service_role');
  return rpc(db,'phase9_reuse_candidate_edition_cache_v1',[...fence(f),versions]);
}
