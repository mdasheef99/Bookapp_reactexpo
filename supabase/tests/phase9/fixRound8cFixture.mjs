// M99 approved plan / pipeline sections 10-11/15, 02c sections 4.3/8/9. Disposable SQL only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {database as baseDatabase,clean,resetActor,value,nativeConnection} from './finalAttemptSweep8cFixture.mjs';
import {migrationPath,setActor} from './databaseHarness.mjs';
import {seedCard,seedAutomaticLineage,claimJob,lookupSql} from './editionPickerFixture.mjs';
import {rpc,worker,token,fence,prepareCall,finalize,complete} from './editionOptionsCompletionFixture.mjs';
export {clean,resetActor,value,nativeConnection,setActor,seedCard,rpc,worker,token};
export const M99='20261106000099_marketplace_phase9_8c_fix_round.sql';
export const helper='marketplace_sec.phase9_settle_terminal_usage_v1(uuid,uuid,text)';
export const counts='phase9_owner_dashboard_inventory_counts_v1';
export const baseline=process.env.PHASE9_M99_BASELINE==='1';
export const replaced=['public.phase9_owner_candidate_edition_choices_v1',
 'marketplace_sec.phase9_fail_metadata_job_automatic','marketplace_sec.phase9_fail_candidate_edition_options_v1',
 'marketplace_sec.phase9_fail_vision_job','marketplace_sec.phase9_mark_vision_provider_attempt'];
const untouched=['marketplace_sec.phase9_edition_assert_owner_candidate','marketplace_sec.phase9_edition_choices',
 'marketplace_sec.phase9_fail_metadata_job','public.phase9_fail_metadata_job','public.phase9_fail_vision_job',
 'public.phase9_mark_vision_provider_attempt','public.phase9_fail_candidate_edition_options_v1'];
export async function definitions(db) {
 await resetActor(db);
 return (await db.query(`SELECT n.nspname||'.'||p.proname name,p.oid,
  pg_get_function_identity_arguments(p.oid) args,pg_get_function_result(p.oid) result,
  pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef,p.provolatile,p.proconfig,
  p.pronargdefaults,pg_get_expr(p.proargdefaults,0) defaults,pg_get_functiondef(p.oid) body
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname||'.'||p.proname=ANY($1::text[]) ORDER BY 1`,[replaced.concat(untouched)])).rows;
}
export async function database() {
 assert.notEqual(process.env.PHASE9_8C1B_BASELINE,'1','M96 is a required prerequisite');
 const db=await baseDatabase();
 try {
  for(const file of ['20261105000097_marketplace_phase9_8c_sweep_recovery.sql',
   '20261105000098_marketplace_phase9_8c_pause_defer_and_retry_bound.sql'])
   await db.exec(fs.readFileSync(migrationPath(file),'utf8'));
  db.beforeM99=await definitions(db);
  const stranded=await fresh(db,'automatic');await metadataAttempt(db,stranded,'registered');
  db.dataBeforeM99=await snapshot(db);
  if(!baseline)await db.exec(fs.readFileSync(migrationPath(M99),'utf8'));
  db.dataAfterM99=await snapshot(db);
  db.afterM99=await definitions(db);
  return db;
 }catch(error){await db.close();throw error;}
}
export async function reservation(db,f) {
 await resetActor(db);
 return value(db,'SELECT to_jsonb(r) FROM public.phase9_usage_reservations r WHERE id=$1',[f.reservationId]);
}
export async function snapshot(db) {
 await resetActor(db);const result={};
 for(const name of ['image_extraction_jobs','image_extraction_inputs','image_extraction_candidates',
  'phase9_metadata_lookups','metadata_enrichment_attempts','phase9_selected_metadata_snapshots',
  'phase9_metadata_provider_calls','phase9_candidate_edition_state','vision_provider_attempts','phase9_usage_reservations'])
  result[name]=await value(db,`SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]') FROM public.${name} x`);
 return result;
}
export async function fresh(db,path,attempt=1) {
 const f=await seedCard(db);f.path=path;f.attempt=attempt;
 if(path==='vision') {
  await resetActor(db);Object.assign(f,{jobId:randomUUID(),inputId:randomUUID(),mediaId:randomUUID(),correlation:randomUUID()});
  await db.query(`INSERT INTO public.media_assets(id,store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,
   sha256,detected_mime,bytes,width,height,validated_at,reencode_version,exif_strip_version,session_id,retention_class,lifecycle_status)
   VALUES($1,$2,$3,'scan_input','private_scan','image-extraction-inputs',$1::uuid::text,repeat('a',64),
   'image/webp',32,1,1,transaction_timestamp(),'fixture','fixture',$4,'phase9-private-scan','linked')`,
  [f.mediaId,f.storeId,f.ownerId,f.sessionId]);
  await db.query(`INSERT INTO public.image_extraction_inputs(id,session_id,store_id,media_asset_id,source_kind,state,sha256,orchestration_version)
   VALUES($1,$2,$3,$4,'camera','processing',repeat('a',64),'phase9-v1')`,[f.inputId,f.sessionId,f.storeId,f.mediaId]);
  await db.query(`INSERT INTO public.image_extraction_jobs(id,store_id,entity_type,entity_id,job_kind,dedupe_key,
   status,attempt_count,max_attempts,lease_owner,lease_token_hash,lease_expires_at,correlation_id)
   VALUES($1,$2,'input',$3,'vision_extract','vision:'||$3::uuid::text,'in_progress',$4,5,$5,
   encode(extensions.digest($6,'sha256'),'hex'),transaction_timestamp()+interval '5 minutes',$7)`,
  [f.jobId,f.storeId,f.inputId,attempt,worker,token,f.correlation]);
 }else {
  f.jobId=path==='automatic'?(await seedAutomaticLineage(db,f)).jobId:(await value(db,lookupSql(f))).operationId;
  f.context=await value(db,await claimJob(db,f,f.jobId));
  await resetActor(db);await db.query('UPDATE public.image_extraction_jobs SET attempt_count=$1 WHERE id=$2',[attempt,f.jobId]);
 }
 await resetActor(db);
 f.reservationId=await value(db,`INSERT INTO public.phase9_usage_reservations(store_id,job_id,cost_kind,policy_version,
  operation,idempotency_identity,reserved_cost_units) VALUES($1,$2,$3,1,$4,$5,1) RETURNING id`,
 [f.storeId,f.jobId,path==='vision'?'vision':'metadata',path==='vision'?'extract':'metadata_lookup',path==='vision'?'vision:'+f.inputId:f.jobId]);
 return f;
}
// The full provider stack enforces M68/M85's automatic-payload guard. Seed
// options through the real register/finalize/complete RPC path (as the
// edition-picker commit suite does), never a direct normalized payload insert.
export async function seedOptions(db,f,rows) {
 const receipt=await value(db,lookupSql(f));
 await resetActor(db);
 await db.exec(`INSERT INTO public.phase9_provider_registry(adapter_key,provider_kind,adapter_version,enabled,
  matching_allowed,storage_allowed,revalidation_seconds,policy_version) VALUES('google_books','metadata',
  '1.0.0',true,true,true,86400,1) ON CONFLICT(adapter_key) DO UPDATE SET enabled=true,matching_allowed=true,
  storage_allowed=true,adapter_version='1.0.0';`);
 const context=await value(db,await claimJob(db,f,receipt.operationId));
 const operation={...f,jobId:receipt.operationId,context,attempt:1};
 await prepareCall(db,operation);await finalize(db,operation);
 const fetched=new Date().toISOString();
 const deadline=new Date(Date.parse(fetched)+3600000).toISOString();
 const options=rows.map(r=>({...r,metadata:r.metadata&&{...r.metadata,fetchedAt:fetched,
  correlationId:operation.lookupId,attemptId:operation.attemptId}}));
 await complete(db,operation,{rows:options,fetched,deadline});
 await setActor(db,f.ownerId);
 return {receipt,lookupId:operation.lookupId,attemptId:operation.attemptId,rows:options};
}
export async function fail(db,f,kind='schema_invalid',retry=false) {
 await setActor(db,'','service_role');
 if(f.path==='vision')return rpc(db,'phase9_fail_vision_job',[f.jobId,worker,token,f.attempt,
  retry?'P9_VISION_ANALYZER_UNAVAILABLE':'P9_VISION_MEDIA_UNAVAILABLE']);
 if(f.path==='explicit')return rpc(db,'phase9_fail_candidate_edition_options_v1',[...fence(f),kind,retry]);
 return rpc(db,'phase9_fail_metadata_job',[f.jobId,worker,token,f.attempt,null,null,null,kind,retry]);
}
// Persist SQL evidence directly: nonzero/unknown receipts are recorded fixtures, never HTTP.
export async function metadataAttempt(db,f,shape='unsent',cost=null,{calls=1,claim=f.attempt}={}) {
 await resetActor(db);const lookupId=randomUUID(),attemptId=randomUUID();
 const query=f.context.queryIdentity;
 await db.query(`INSERT INTO public.phase9_metadata_lookups(id,candidate_id,store_id,job_id,query_identity,execution_mode,
  schema_version,lookup_strategy,lookup_contract_version,normalizer_version,routing_policy_version,privacy_scope,
  provider_cache_identity,adapter_key,adapter_version,capability_version,reuse_policy_version,cache_policy_version,cache_namespace,
  claim_attempt_number,claim_worker,claim_lease_token_hash)
  VALUES($1,$2,$3,$4,$5,'external','p9-metadata-foundation-v1','bibliographic','p9-metadata-lookup-v1',
  'p9-bibliographic-normalizer-v1','m99-fixture:'||$1::uuid::text,'store_private',
  $1::uuid::text,'google_books','1.0.0','cap-v1','1','cache-v1','m99-fixture',$6,$7,encode(extensions.digest($8,'sha256'),'hex'))`,
 [lookupId,f.candidateId,f.storeId,f.jobId,query,claim,worker,token]);
 await db.query(`INSERT INTO public.metadata_enrichment_attempts(id,candidate_id,store_id,adapter_key,attempt_sequence,
  query_kind,status,adapter_version,schema_version,normalizer_version,reuse_policy_version,lookup_id,provider_role,
  query_identity,usage_reservation_id,calculated_cost_units,disposition,completed_at,provider_attempt_identity)
  VALUES($1,$2,$3,'google_books',1,'bibliographic','completed','1.0.0','p9-metadata-foundation-v1',
  'p9-bibliographic-normalizer-v1',1,$4,'primary',$5,$6,$7,'failed',transaction_timestamp(),$8)`,
 [attemptId,f.candidateId,f.storeId,lookupId,query,f.reservationId,cost,randomUUID()]);
 const ids=[];
 for(let i=0;i<calls;i++) {
  const unsent=shape==='unsent',legacy=shape==='legacy',registered=shape==='registered';
  ids.push(await value(db,`INSERT INTO public.phase9_metadata_provider_calls(logical_attempt_id,job_id,candidate_id,store_id,
   physical_call_identity,claim_attempt_number,claim_worker,claim_lease_token_hash,status,normalized_outcome,logical_outcome,
   retryable,completed_at,edition_call_sequence,edition_call_stage,edition_egress_started,match_evidence)
   VALUES($1,$2,$3,$4,$5,$6,$7,encode(extensions.digest($8,'sha256'),'hex'),$9,$10,$10,
   CASE WHEN $9='registered' THEN NULL ELSE false END,
   CASE WHEN $9='registered' THEN NULL ELSE transaction_timestamp() END,$11,$12,$13,
   CASE WHEN $9='registered' THEN NULL ELSE '[]'::jsonb END) RETURNING id`,
  [attemptId,f.jobId,f.candidateId,f.storeId,randomUUID(),claim,worker,token,
   registered?'registered':unsent?'stale_rejected':shape==='unknown'?'outcome_unknown':'finalized',
   registered?null:unsent?'cancelled':'schema_invalid',legacy?null:i,legacy?null:i===0?'search':i===1?'edition':'author:OL1A',
   unsent?false:shape==='null-egress'||registered||legacy?null:true]));
 }
 return {attemptId,lookupId,callIds:ids};
}
export async function visionAttempt(db,f,shape='unsent',cost=null,claim=f.attempt) {
 await resetActor(db);
 const id=await value(db,`INSERT INTO public.vision_provider_attempts(provider_attempt_identity,store_id,job_id,correlation_id,
  claim_attempt_number,claim_worker,claim_lease_token_hash,usage_reservation_id,provider_role,provider_key,adapter_key,
  adapter_version,model_key,model_version,prompt_version,schema_version,spend_identity)
  VALUES($1,$2,$3,$4,$5,$6,encode(extensions.digest($7,'sha256'),'hex'),$8,'primary','google_gemini','gemini_vision',
  '1.0.0','fixture','fixture','fixture','p9-vision-v2',repeat('a',64)) RETURNING id`,
 [randomUUID(),f.storeId,f.jobId,f.correlation,claim,worker,token,f.reservationId]);
 if(shape==='unsent')await mark(db,f,id,'failed','media_unavailable');
 else if(shape==='sent')await db.query(`UPDATE public.vision_provider_attempts SET disposition='failed',normalized_outcome='schema_invalid',
  completed_at=transaction_timestamp(),prompt_tokens=1,output_tokens=1,total_tokens=2,cached_tokens=0,thinking_tokens=0,
  pricing_policy_version=CASE WHEN $2::numeric IS NULL THEN NULL ELSE 'fixture' END,
  pricing_input=CASE WHEN $2::numeric IS NULL THEN NULL ELSE '{"currency":"USD"}'::jsonb END,
  calculated_cost_units=$2 WHERE id=$1`,[id,cost]);
 else if(shape!=='registered')await mark(db,f,id,shape==='unknown'?'outcome_unknown':'failed',shape==='unknown'?'timeout':shape);
 return id;
}
export async function mark(db,f,id,disposition,outcome) {
 await setActor(db,'','service_role');
 return rpc(db,'phase9_mark_vision_provider_attempt',[id,f.jobId,disposition,outcome]);
}
export async function evidence(db,f,shape,cost=null,options={}) {
 if(f.path==='vision') {
  // Current unsent marker gates terminal settlement; historical evidence remains independent.
  if(shape!=='unsent')await visionAttempt(db,f,shape,cost,Math.max(1,f.attempt-1));
  return visionAttempt(db,f,'unsent');
 }
 return metadataAttempt(db,f,shape,cost,options);
}
