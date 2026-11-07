import type { MetadataRpcClient } from '../../supabase/functions/_shared/imageInventory/runtime/metadataJobContext';

// D6: the JSON logger only serializes. This boundary constructs the entire safe event.
const stages = {
  claim_phase9_metadata_jobs: 'claim', phase9_claim_metadata_jobs_v2: 'claim',
  phase9_metadata_job_context: 'context', phase9_automatic_edition_fence_v1: 'context',
  phase9_provider_configuration_v1: 'configuration',
  phase9_reserve_metadata_provider_round_v1: 'admission', phase9_release_metadata_provider_round_v1: 'release',
  phase9_prepare_automatic_metadata_v1: 'admission', phase9_begin_automatic_provider_run_v1: 'admission',
  phase9_defer_metadata_admission_v1: 'admission', phase9_defer_paused_metadata_admission_v1: 'admission',
  phase9_schedule_automatic_provider_recheck_v1: 'admission',
  phase9_register_structural_metadata_lookup: 'lookup', phase9_reserve_metadata_usage: 'reservation',
  phase9_register_structural_metadata_attempt: 'attempt',
  phase9_register_metadata_provider_call: 'registration', phase9_register_edition_options_provider_call_v1: 'registration',
  phase9_finalize_metadata_provider_call: 'finalization', phase9_finalize_edition_options_provider_call_v1: 'finalization',
  phase9_finalize_structural_metadata_attempt: 'finalization', phase9_finish_automatic_provider_run_v1: 'finalization',
  phase9_finish_edition_primary_for_fallback_v1: 'finalization',
  phase9_reconcile_metadata_provider_call: 'recovery', phase9_recover_automatic_metadata_v1: 'recovery',
  phase9_recover_candidate_edition_options_v1: 'recovery',
  phase9_complete_automatic_metadata_v1: 'completion', phase9_complete_candidate_edition_options_v2: 'completion',
  phase9_complete_metadata_cache_reuse: 'completion', phase9_complete_structural_local_metadata_match: 'completion',
  phase9_select_structural_metadata_snapshot: 'completion',
  phase9_fail_candidate_edition_options_v1: 'failure', phase9_fail_metadata_job: 'failure',
  phase9_resolve_superseded_edition_job_v1: 'cleanup',
  phase9_metadata_cache_reuse_context: 'cache', phase9_metadata_coalescing_context: 'cache',
  phase9_reuse_candidate_edition_cache_v1: 'cache', phase9_store_metadata_cache: 'cache',
  phase9_store_metadata_representative_cover_v1: 'cache',
} as const;
// Exact M93/M94 refusal identifiers, matching metadataAutomaticEditionFence's classifications.
const refusals = new Set(['P9_STATE_CONFLICT', 'P9_REQUEST_INVALID', 'P9_OWNER_NOT_AUTHORIZED',
  'P9_EXTERNAL_ADMISSION_PAUSED', 'P9_PROVIDER_CONFIGURATION_INVALID', 'P9_PROVIDER_RUN_NOT_ADMITTED',
  'P9_PROVIDER_CAPACITY_WAIT', 'P9_METADATA_PROVIDER_DISABLED',
  'P9_METADATA_SECONDARY_NOT_ELIGIBLE', 'P9_METADATA_USAGE_RESERVATION_REQUIRED',
  'P9_AUTO_COMMAND_INVALID', 'P9_EDITION_ROWS_INVALID', 'P9_CATALOGUE_COMPANION_INVALID',
  'P9_AUTO_SOURCE_INVALID', 'P9_IDEMPOTENCY_MISMATCH']);
export type MetadataRpcFailureEvent = Readonly<{
  event: 'metadata_rpc_failed'; service: 'phase9-metadata-worker'; rpc: string;
  sqlstate: string | null; safeErrorCode: string | null; jobId: string | null; attempt: number | null;
  stage: string; durationMs: number; uncertainty: 'known_refusal' | 'uncertain';
  submissionKind: 'returned' | 'thrown';
}>;
export type MetadataRpcLog = (event: MetadataRpcFailureEvent) => void;
export type MetadataRpcCorrelation = Readonly<{ jobId: string | null; attempt: number | null }>;

export function observeMetadataRpc<T extends MetadataRpcClient>(client: T,
  correlation: MetadataRpcCorrelation, log?: MetadataRpcLog): T {
  if (!log) return client;
  // Immutable per-claim values; the batch can execute three jobs concurrently.
  const jobId = typeof correlation.jobId === 'string'
    && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(correlation.jobId)
    ? correlation.jobId : null;
  const attempt = typeof correlation.attempt === 'number' && Number.isInteger(correlation.attempt)
    && correlation.attempt >= 1 && correlation.attempt <= 5 ? correlation.attempt : null;
  function failed(name: string, error: unknown, started: number, submissionKind: 'returned' | 'thrown') {
    try {
      const row = error !== null && typeof error === 'object' ? error as Record<string, unknown> : {};
      const sqlstate = typeof row.code === 'string' && /^[A-Z0-9]{5}$/u.test(row.code) ? row.code : null;
      const safeErrorCode = typeof row.message === 'string' && refusals.has(row.message) ? row.message : null;
      const duration = Math.round(performance.now() - started);
      const rpc = Object.hasOwn(stages, name) ? name : 'unknown_rpc';
      log!({ event: 'metadata_rpc_failed', service: 'phase9-metadata-worker', rpc, sqlstate, safeErrorCode,
        jobId, attempt, stage: rpc === 'unknown_rpc' ? 'unknown' : stages[rpc as keyof typeof stages],
        durationMs: Number.isFinite(duration) ? Math.max(0, duration) : 0,
        uncertainty: sqlstate === 'P0001' && safeErrorCode !== null ? 'known_refusal' : 'uncertain', submissionKind });
    } catch { /* Logging, including hostile error getters, cannot change recovery decisions. */ }
  }
  const rpc = async (name: string, parameters?: Readonly<Record<string, unknown>>) => {
    const started = performance.now();
    let result;
    try {
      result = await Reflect.apply(client.rpc, client, parameters === undefined ? [name] : [name, parameters]);
    } catch (error) {
      failed(name, error, started, 'thrown');
      throw error; // Preserve the original rejection identity and all existing classifiers.
    }
    if (result?.error !== null && result?.error !== undefined) failed(name, result.error, started, 'returned');
    return result; // Preserve the exact response object, including errors.
  };
  // Preserve .from and every other Supabase client member, including prototype methods.
  return new Proxy(client, { get(target, key, receiver) {
    return key === 'rpc' ? rpc : Reflect.get(target, key, receiver);
  } });
}
