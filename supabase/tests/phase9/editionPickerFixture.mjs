// Picker SDD §§4.3/5–6/8–9/11: synthetic local database fixtures; no provider or live application.
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { migrationPath, resetActor, scalar, setActor } from './databaseHarness.mjs';
import { createUnit7aDatabase, seedReviewedCandidate } from './unit7aFixture.mjs';

export { resetActor, scalar, setActor };
export const json = value => JSON.stringify(value).replaceAll("'", "''");
export const pickerMigrations = [
  '20261007000065_marketplace_phase9_edition_picker_state.sql',
  '20261007000066_marketplace_phase9_edition_picker_commands.sql',
  '20261007000067_marketplace_phase9_edition_picker_operation_fences.sql',
];
const baseline = [
  '20260817000047_marketplace_phase9_legacy_rpc_security_remediation.sql',
  '20260817000048_marketplace_phase9_legacy_rpc_service_role_compatibility.sql',
  '20260821000052_marketplace_phase9_unit6g_contract_persistence_foundation.sql',
  '20260827000053_marketplace_phase9_unit6g_field_authority_correction.sql',
  '20260829000054_marketplace_phase9_unit6g_session_lifecycle_fence.sql',
  '20260830000055_marketplace_phase9_unit6g_metadata_add_authority_correction.sql',
  '20260830000056_marketplace_phase9_metadata_throughput.sql',
  '20260906000057_marketplace_phase9_media_output_intents.sql',
  '20260906000058_marketplace_phase9_media_completion_receipts.sql',
  '20260906000059_marketplace_phase9_media_output_cleanup.sql',
  '20260911000060_marketplace_phase9_duplicate_confirmation.sql',
  '20260913000061_marketplace_phase9_representative_edition_cover.sql',
  '20260913000062_marketplace_phase9_representative_cover_detail_projection.sql',
];
export async function createEditionPickerDatabase() {
  const db = await createUnit7aDatabase();
  await db.exec("CREATE TABLE IF NOT EXISTS public.marketplace_event_schema_registry("
    + "event_type text NOT NULL,schema_version integer NOT NULL,entity_type text NOT NULL,"
    + "is_transition boolean NOT NULL,privacy_classification text NOT NULL,PRIMARY KEY(event_type,schema_version));"
    + "ALTER TABLE public.marketplace_events ADD COLUMN IF NOT EXISTS actor_role text,"
    + "ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'system_job',"
    + "ADD COLUMN IF NOT EXISTS idempotency_key text,ADD COLUMN IF NOT EXISTS command_id uuid,"
    + "ADD COLUMN IF NOT EXISTS correlation_id uuid,ADD COLUMN IF NOT EXISTS causation_event_id uuid,"
    + "ADD COLUMN IF NOT EXISTS privacy_classification text NOT NULL DEFAULT 'internal',"
    + "ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1;"
    + "CREATE FUNCTION public.phase9_complete_media_validation_v2("
    + "uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer)"
    + "RETURNS jsonb LANGUAGE sql SET search_path='' AS $$"
    + "SELECT marketplace_sec.phase9_complete_media_validation($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)$$;"
    + "CREATE FUNCTION public.phase9_bind_media_validation_snapshot_v2("
    + "uuid,text,text,integer,text,text,bigint,text) RETURNS boolean LANGUAGE sql SET search_path='' AS $$"
    + "SELECT marketplace_sec.phase9_bind_media_validation_snapshot($1,$2,$3,$4,$5,$6,$7,$8)$$;");
  for (const name of baseline) await db.exec(fs.readFileSync(migrationPath(name), 'utf8'));
  // Before implementation, use the complete baseline so RED is semantic, not a missing-file hook.
  for (const name of pickerMigrations) {
    if (fs.existsSync(migrationPath(name))) await db.exec(fs.readFileSync(migrationPath(name), 'utf8'));
  }
  return db;
}
export const metadata = {
  title: 'The Fixture Book', subtitle: null, authors: ['Fixture Author', 'Second Author'],
  language: 'en', script: 'Latn', description: null, isbn10: '0306406152', isbn13: '9780306406157',
  publisher: 'Fixture Press', publishedDate: '2020', editionStatement: 'Second edition',
  series: null, volume: null, format: null, pageCount: 240, categories: ['Fiction'],
  coverReference: 'https://books.google.com/books/content?id=fixture',
  contractVersion: 'p9-contract-v1', schemaVersion: 'p9-metadata-v1',
  adapterKey: 'google_books', adapterVersion: '1.0.0', normalizerVersion: 'p9-bibliographic-normalizer-v1',
  correlationId: 'fixture-correlation', attemptId: 'fixture-attempt', providerRecordId: 'fixture',
  fetchedAt: '2026-10-07T00:00:00Z', matchRationale: 'Fixture only', confidence: 0.8,
};
export const row = (ordinal = 0, overrides = {}) => ({
  optionId: randomUUID(), ordinal, eligibility: 'eligible',
  googleBooksUrl: 'https://books.google.com/books?id=fixture', metadata, ...overrides,
});
export async function seedCard(db, options = {}) {
  const f = await seedReviewedCandidate(db, { ...options, review: {
    originalTitle: metadata.title, authors: ['Fixture Author'], originalLanguage: options.language ?? 'en', ...options.review,
  } });
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_candidates SET observed_title=$1,"
    + "observed_authors=$2,observed_isbn_clue=$3,observed_language=$4 WHERE id=$5",
  [metadata.title, ['Fixture Author'], options.isbn === undefined ? metadata.isbn13 : options.isbn, options.language ?? 'en', f.candidateId]);
  await setActor(db, f.ownerId);
  return f;
}
export function readSql(f) {
  return "SELECT public.phase9_owner_candidate_edition_choices_v1('" + f.sessionId + "','" + f.candidateId + "')";
}
export function lookupSql(f, generation = 0, key = randomUUID(), command = randomUUID()) {
  return "SELECT public.phase9_request_candidate_edition_options_v1('" + f.sessionId + "','" + f.candidateId
    + "'," + generation + ",'" + key + "','" + command + "')";
}
export function selectSql(f, choices, optionId, overrides = {}) {
  const source = overrides.source ?? 'edition_option';
  return "SELECT public.phase9_select_candidate_edition_v1('" + f.sessionId + "','" + f.candidateId
    + "'," + (overrides.candidateVersion ?? choices.candidateVersion)
    + "," + (overrides.metadataRevision ?? choices.metadataRevision)
    + "," + (choices.reviewVersion ?? 'NULL') + ",'" + source + "',"
    + (source === 'edition_option' ? choices.optionsVersion : 'NULL') + ","
    + (source === 'edition_option' ? "'" + optionId + "'" : 'NULL') + ","
    + (source === 'current_suggestion' ? "'" + optionId + "'" : 'NULL')
    + ",'" + (overrides.key ?? randomUUID()) + "','" + (overrides.command ?? randomUUID()) + "')";
}
export async function seedOptions(db, f, rows = [row()], lifetime = '1 hour', automatic = false) {
  let receipt;
  if (automatic) {
    await resetActor(db);
    receipt = { operationId: randomUUID() };
    await db.query("INSERT INTO public.image_extraction_jobs(id,store_id,entity_type,entity_id,job_kind,dedupe_key)"
      + "VALUES($1,$2,'candidate',$3,'metadata_enrich',$1::uuid::text)", [receipt.operationId, f.storeId, f.candidateId]);
  } else receipt = await scalar(db, lookupSql(f));
  await resetActor(db);
  const lookupId = randomUUID(), attemptId = randomUUID();
  await db.exec("INSERT INTO public.phase9_provider_registry(adapter_key,provider_kind,adapter_version,enabled,"
    + "matching_allowed,storage_allowed,revalidation_seconds,policy_version) VALUES('google_books','metadata',"
    + "'1.0.0',true,true,true,86400,1) ON CONFLICT(adapter_key) DO UPDATE SET enabled=true,storage_allowed=true;");
  const queryIdentity = await scalar(db, automatic
    ? "SELECT marketplace_sec.phase9_metadata_candidate_query_identity(c) FROM public.image_extraction_candidates c WHERE id='" + f.candidateId + "'"
    : "SELECT query_identity FROM public.phase9_candidate_edition_state WHERE candidate_id='" + f.candidateId + "'");
  await db.query("INSERT INTO public.phase9_metadata_lookups(id,candidate_id,store_id,job_id,query_identity,"
    + "execution_mode,provider_cache_identity,adapter_key,adapter_version,capability_version,schema_version,"
    + "lookup_strategy,lookup_contract_version,normalizer_version,routing_policy_version,privacy_scope,"
    + "reuse_policy_version,cache_policy_version,cache_namespace,claim_attempt_number,claim_worker,"
    + "claim_lease_token_hash,normalized_outcome,completed_at) VALUES($1,$2,$3,$4,$5,'external',$1::uuid::text,"
    + "'google_books','1.0.0','cap-v1','p9-metadata-v1','bibliographic','lookup-v1','normalizer-v1',"
    + "'routing-v1','store_private','1','cache-v1','picker-fixture',1,'picker-fixture-worker',"
    + "repeat('a',64),'accepted_metadata_match',transaction_timestamp())",
  [lookupId, f.candidateId, f.storeId, receipt.operationId, queryIdentity]);
  await db.query("INSERT INTO public.metadata_enrichment_attempts(id,candidate_id,store_id,adapter_key,"
    + "attempt_sequence,query_kind,status,adapter_version,schema_version,normalizer_version,reuse_policy_version,"
    + "lookup_id,provider_role,query_identity,normalized_outcome,disposition,normalized_payload,provider_attempt_identity)"
    + "VALUES($1,$2,$3,'google_books',1,'bibliographic','completed','1.0.0','p9-metadata-v1','normalizer-v1',1,"
    + "$4,'primary',$5,'accepted_metadata_match','accepted',$6,$7)",
  [attemptId, f.candidateId, f.storeId, lookupId, queryIdentity, metadata, randomUUID()]);
  if (!automatic) await db.query("UPDATE public.phase9_candidate_edition_state SET options=$1,options_version=options_version+1,"
    + "source_lookup_id=$2,source_attempt_id=$3,source_fetched_at=transaction_timestamp(),"
    + "options_expires_at=transaction_timestamp()+$4::interval WHERE candidate_id=$5",
  [rows, lookupId, attemptId, lifetime, f.candidateId]);
  await db.query("UPDATE public.image_extraction_jobs SET status='resolved',completed_at=transaction_timestamp() WHERE id=$1", [receipt.operationId]);
  await setActor(db, f.ownerId);
  return { receipt, lookupId, attemptId, choices: await scalar(db, readSql(f)), rows };
}
export async function seedCanonical(db, f, overrides = {}) {
  await resetActor(db);
  const workId = randomUUID(), editionId = randomUUID();
  await db.query("INSERT INTO public.canonical_works(id,title_normalized,primary_title,primary_authors) VALUES($1,$2,$3,$4)",
    [workId, 'fixture ' + workId, metadata.title, ['Fixture Author']]);
  await db.query("INSERT INTO public.canonical_editions(id,work_id,title,authors,language,isbn_13,isbn_10,volume)"
    + "VALUES($1,$2,$3,$4,$5,$6,$7,$8)", [editionId, workId, overrides.title ?? metadata.title,
    overrides.authors ?? ['Fixture Author'], overrides.language ?? 'en',
    overrides.isbn13 === undefined ? metadata.isbn13 : overrides.isbn13, overrides.isbn10 ?? null, overrides.volume ?? null]);
  return editionId;
}

export async function claimJob(db, f, jobId, token = 'a'.repeat(64)) {
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_jobs SET status='in_progress',attempt_count=1,lease_owner='picker-worker-0001',"
    + "lease_expires_at=transaction_timestamp()+interval '5 minutes',lease_token_hash=encode(extensions.digest($1,'sha256'),'hex') WHERE id=$2",
  [token, jobId]);
  await setActor(db, f.ownerId, 'service_role');
  return "SELECT public.phase9_metadata_job_context('" + jobId + "','picker-worker-0001','" + token + "',1)";
}
export async function seedAutomaticLineage(db, f, authority = 'accepted') {
  await resetActor(db);
  const inputId = randomUUID(), visionJobId = randomUUID(), resultId = randomUUID(), observationId = randomUUID();
  const jobId = randomUUID(), mediaId = randomUUID();
  await db.query("INSERT INTO public.media_assets(id,store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,"
    + "sha256,detected_mime,bytes,width,height,session_id,retention_class,lifecycle_status)"
    + "VALUES($1,$2,$3,'scan_input','private_scan','scan-private',$1::uuid::text,repeat('a',64),'image/jpeg',1024,100,100,$4,'scan_source','validated')",
  [mediaId, f.storeId, f.ownerId, f.sessionId]);
  await db.query("INSERT INTO public.image_extraction_inputs(id,session_id,store_id,source_kind,sha256,orchestration_version,state,media_asset_id)"
    + "VALUES($1,$2,$3,'gallery',repeat('a',64),'fixture-v1','ready',$4)", [inputId, f.sessionId, f.storeId, mediaId]);
  await db.query("INSERT INTO public.image_extraction_jobs(id,store_id,entity_type,entity_id,job_kind,dedupe_key,status)"
    + "VALUES($1,$2,'input',$3,'vision_extract',$1::uuid::text,'resolved')", [visionJobId, f.storeId, inputId]);
  await db.query("INSERT INTO public.image_analysis_results(id,store_id,session_id,input_id,vision_job_id,contract_version,"
    + "analysis_schema_version,pipeline_version,prompt_version,adapter_key,adapter_version,provider_key,model_key,model_version,"
    + "image_outcome,authoritative_outcome,detected_visible_book_count,accepted_candidate_count,canonical_result_snapshot,"
    + "canonical_result_sha256,completing_attempt,completing_worker,completing_lease_token_hash,completion_summary,received_at)"
    + "VALUES($1,$2,$3,$4,$5,'p9-contract-v1','p9-vision-v2','fixture','fixture','fixture','1','fixture','fixture','1',"
    + "'analyzed',$6,1,1,'{}',repeat('a',64),1,'picker-worker-0001',repeat('a',64),'{}',transaction_timestamp())",
  [resultId, f.storeId, f.sessionId, inputId, visionJobId, authority]);
  await db.query("INSERT INTO public.image_analysis_observations(id,analysis_result_id,store_id,input_id,observation_ordinal,"
    + "disposition,observed_title,observed_authors,observed_isbn_clue,observed_language,confidence,observation_snapshot)"
    + "SELECT $1,$2,store_id,$3,1,'candidate',observed_title,observed_authors,observed_isbn_clue,observed_language,1,'{}'"
    + "FROM public.image_extraction_candidates WHERE id=$4", [observationId, resultId, inputId, f.candidateId]);
  await db.query("UPDATE public.image_extraction_candidates SET input_id=$1,vision_job_id=$2,analysis_observation_id=$3,"
    + "analysis_schema_version='p9-vision-v2',state='processing' WHERE id=$4", [inputId, visionJobId, observationId, f.candidateId]);
  await db.query("INSERT INTO public.image_extraction_jobs(id,store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version)"
    + "VALUES($1,$2,'candidate',$3,'metadata_enrich',$1::uuid::text,'p9-metadata-foundation-v1')", [jobId, f.storeId, f.candidateId]);
  return { jobId, resultId };
}
