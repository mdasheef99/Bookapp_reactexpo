// Picker SDD §§4.1-4.3/5/8-9: real disposable SQL boundary; synthetic provider evidence.
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { migrationPath } from './databaseHarness.mjs';
import { claimJob, createEditionPickerDatabase, lookupSql, metadata, resetActor, scalar,
  seedCard, setActor } from './editionPickerFixture.mjs';
export { readSql, resetActor, scalar, selectSql, setActor } from './editionPickerFixture.mjs';
export const migration = '20261007000068_marketplace_phase9_edition_picker_worker_completion.sql';
export const worker = 'picker-worker-0001', token = 'a'.repeat(64);
export async function createCompletionDatabase() {
  const db = await createEditionPickerDatabase();
  if (fs.existsSync(migrationPath(migration))) {
    const sql=fs.readFileSync(migrationPath(migration), 'utf8');
    try { await db.exec(sql); }
    catch(error) {
      console.error('M68 bootstrap:', { message:error.message, position:error.position,
        internalPosition:error.internalPosition, where:error.where, internalQuery:error.internalQuery });
      await db.close(); throw error;
    }
  }
  return db;
}
export async function rpc(db, name, values) {
  const result = await db.query('SELECT public.' + name + '(' + values.map((_, i) => '$' + (i + 1)).join(',') + ')', values);
  return Object.values(result.rows[0])[0];
}
export async function seedOperation(db, options = {}) {
  const f = await seedCard(db, { isbn: null, ...options });
  const receipt = await scalar(db, lookupSql(f));
  await resetActor(db);
  await db.exec("INSERT INTO public.phase9_provider_registry(adapter_key,provider_kind,adapter_version,enabled,"
    + "matching_allowed,storage_allowed,revalidation_seconds,policy_version) VALUES('google_books','metadata',"
    + "'1.0.0',true,true,true,86400,1) ON CONFLICT(adapter_key) DO UPDATE SET enabled=true,"
    + "matching_allowed=true,storage_allowed=true,adapter_version='1.0.0';");
  const context = await scalar(db, await claimJob(db, f, receipt.operationId));
  return { ...f, jobId: receipt.operationId, context, attempt: 1 };
}
export const fence = f => [f.jobId, worker, token, f.attempt, f.candidateId, f.storeId,
  f.sessionId, f.jobId, f.context.requestGeneration, f.context.queryIdentity];
export async function prepareCall(db, f) {
  const q = f.context.queryIdentity;
  const lookup = await rpc(db, 'phase9_register_structural_metadata_lookup', [
    f.jobId, worker, token, f.attempt, f.candidateId, f.context.candidateVersion, q,
    'edition-options:' + f.jobId, 'google_books', '1.0.0', 'cap-v1', 'p9-metadata-foundation-v1',
    'bibliographic', 'p9-metadata-lookup-v1', 'p9-bibliographic-normalizer-v1', 'p9-metadata-routing-v1',
    'store_private', '1', 'p9-metadata-cache-v1', 'metadata-v1', null,
  ]);
  const usage = await rpc(db, 'phase9_reserve_metadata_usage',
    [f.jobId, worker, token, f.attempt, lookup.lookup_id, 'google_books', '1.0.0', 1]);
  const attempt = await rpc(db, 'phase9_register_structural_metadata_attempt', [
    lookup.lookup_id, f.jobId, worker, token, f.attempt, f.candidateId, f.context.candidateVersion,
    randomUUID(), 'edition-options:' + f.jobId, 'primary', 1, 'google_books', '1.0.0', 'cap-v1',
    'p9-metadata-foundation-v1', 'p9-bibliographic-normalizer-v1', 'p9-metadata-routing-v1',
    'local_insufficient', usage.reservation_id,
  ]);
  const physical = await rpc(db, 'phase9_register_metadata_provider_call',
    [attempt.attempt_id, f.jobId, worker, token, f.attempt, randomUUID()]);
  Object.assign(f, { lookupId: lookup.lookup_id, attemptId: attempt.attempt_id,
    reservationId: usage.reservation_id, callId: physical.provider_call_id });
  return f;
}
export async function finalize(db, f, outcome = 'coherent_match', retryable = false) {
  return rpc(db, 'phase9_finalize_metadata_provider_call', [f.callId, f.jobId, worker, token, f.attempt,
    'finalized', outcome, outcome, 'fixture-request-' + f.attempt, retryable, null, []]);
}
export function resultRows(f, count = 1) {
  const fetched = new Date().toISOString();
  const rows = Array.from({ length: count }, (_, ordinal) => ({
    optionId: randomUUID(), ordinal, eligibility: ordinal === 2 ? 'unavailable' : ordinal === 3 ? 'ineligible' : 'eligible',
    googleBooksUrl: ordinal === 2 ? null : 'https://books.google.com/books?id=same-record',
    metadata: ordinal === 2 ? null : { ...metadata, title: f.context.title, correlationId: f.lookupId, attemptId: f.attemptId,
      providerRecordId: 'same-record', fetchedAt: fetched,
      coverReference:'https://books.google.com/books/content?id=same-record' },
  }));
  return { rows, fetched, deadline: new Date(Date.parse(fetched) + 3600000).toISOString() };
}
export function complete(db, f, result = resultRows(f), permission = true) {
  return rpc(db, 'phase9_complete_candidate_edition_options_v1', [...fence(f), f.lookupId,
    f.attemptId, result.fetched, result.deadline, permission, result.rows]);
}
export const recover = (db, f) => rpc(db, 'phase9_recover_candidate_edition_options_v1', fence(f));
export const fail = (db, f, outcome = 'provider_unavailable', retryable = true) =>
  rpc(db, 'phase9_fail_candidate_edition_options_v1', [...fence(f), outcome, retryable]);
export async function candidateTruth(db, f) {
  await resetActor(db);
  return scalar(db, "SELECT jsonb_build_object('state',state,'version',version,'metadata',metadata_revision,"
    + "'reviewVersion',review_version,'review',owner_review_snapshot,'selection',selected_metadata_snapshot_id)"
    + " FROM public.image_extraction_candidates WHERE id='" + f.candidateId + "'");
}
export async function asService(db, f) { await setActor(db, f.ownerId, 'service_role'); }

const signatures={
  "phase9_register_structural_metadata_lookup": [
    "p_job_id",
    "p_worker",
    "p_lease_token",
    "p_attempt_count",
    "p_candidate_id",
    "p_candidate_version",
    "p_query_identity",
    "p_provider_cache_identity",
    "p_adapter_key",
    "p_adapter_version",
    "p_capability_version",
    "p_schema_version",
    "p_lookup_strategy",
    "p_lookup_contract_version",
    "p_normalizer_version",
    "p_routing_policy_version",
    "p_privacy_scope",
    "p_reuse_policy_version",
    "p_cache_policy_version",
    "p_cache_namespace",
    "p_leader_lookup_id"
  ],
  "phase9_register_structural_metadata_attempt": [
    "p_lookup_id",
    "p_job_id",
    "p_worker",
    "p_lease_token",
    "p_attempt_count",
    "p_candidate_id",
    "p_candidate_version",
    "p_provider_attempt_identity",
    "p_provider_cache_identity",
    "p_provider_role",
    "p_attempt_sequence",
    "p_adapter_key",
    "p_adapter_version",
    "p_capability_version",
    "p_schema_version",
    "p_normalizer_version",
    "p_routing_policy_version",
    "p_predecessor_outcome",
    "p_usage_reservation_id"
  ],
  "phase9_reserve_metadata_usage": [
    "p_job_id",
    "p_worker",
    "p_lease_token",
    "p_attempt_count",
    "p_lookup_id",
    "p_adapter_key",
    "p_adapter_version",
    "p_policy_version"
  ],
  "phase9_register_metadata_provider_call": [
    "p_attempt_id",
    "p_job_id",
    "p_worker",
    "p_lease_token",
    "p_attempt_count",
    "p_physical_call_identity"
  ],
  "phase9_finalize_metadata_provider_call": [
    "p_provider_call_id",
    "p_job_id",
    "p_worker",
    "p_lease_token",
    "p_attempt_count",
    "p_status",
    "p_normalized_outcome",
    "p_logical_outcome",
    "p_provider_request_id",
    "p_retryable",
    "p_normalized_candidate",
    "p_match_evidence"
  ],
  "phase9_reconcile_metadata_provider_call": [
    "p_provider_call_id",
    "p_job_id",
    "p_worker",
    "p_lease_token",
    "p_attempt_count"
  ],
  "phase9_fail_metadata_job": [
    "p_job_id",
    "p_worker",
    "p_lease_token",
    "p_attempt_count",
    "p_candidate_id",
    "p_candidate_version",
    "p_query_identity",
    "p_failure_kind",
    "p_retryable"
  ],
  "phase9_metadata_job_context": [
    "p_job_id",
    "p_worker",
    "p_lease_token",
    "p_attempt_count"
  ],
  "phase9_recover_candidate_edition_options_v1": [
    "p_job_id",
    "p_worker",
    "p_lease_token",
    "p_attempt_count",
    "p_candidate_id",
    "p_store_id",
    "p_session_id",
    "p_request_id",
    "p_request_generation",
    "p_query_identity"
  ],
  "phase9_complete_candidate_edition_options_v1": [
    "p_job_id",
    "p_worker",
    "p_lease_token",
    "p_attempt_count",
    "p_candidate_id",
    "p_store_id",
    "p_session_id",
    "p_request_id",
    "p_request_generation",
    "p_query_identity",
    "p_lookup_id",
    "p_attempt_id",
    "p_source_fetched_at",
    "p_options_expires_at",
    "p_storage_permission_verified",
    "p_rows"
  ],
  "phase9_fail_candidate_edition_options_v1": [
    "p_job_id",
    "p_worker",
    "p_lease_token",
    "p_attempt_count",
    "p_candidate_id",
    "p_store_id",
    "p_session_id",
    "p_request_id",
    "p_request_generation",
    "p_query_identity",
    "p_failure_kind",
    "p_retryable"
  ]
};
export function completionServiceClient(db) {
  return { rpc: async (name, parameters) => {
    try {
      if(name==='claim_phase9_metadata_jobs') return {data:(await db.query(
        'SELECT * FROM public.claim_phase9_metadata_jobs($1,$2)',
        [parameters.p_batch_size,parameters.p_worker])).rows,error:null};
      const keys=signatures[name]; if(!keys) throw new Error('unexpected RPC '+name);
      return {data:await rpc(db,name,keys.map(k=>parameters[k]??null)),error:null};
    } catch(error) { return {data:null,error}; }
  }};
}
