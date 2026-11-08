// 02c §§4.3/5.1/9: disposable RPC receipts, not a transaction/retry implementation.
// M92 completed receipts always name a snapshot. Failures can be overridden at
// the RPC boundary to exercise the actual worker's fail-closed behaviour.
import { automaticContext, editionWorkerFixture } from '../fixtures/phase9/editionOptionsWorker';
import { googleBooksMultipleVolumes } from '../fixtures/phase9/googleBooksResponses';
import { GOLDEN_CLOCK, GOLDEN_LOOKUP_ID, GOLDEN_ATTEMPT_ID } from '../fixtures/phase9/providerReplacementGoldens';
import { providerConfigurationRow, providerConfigurationSnapshot } from '../fixtures/phase9/providerConfiguration';
import { bootstrapGoogle } from './providerModules';
import { TEST_ONLY_PROTECTION_POLICY } from './providerProtection';
import { runMetadataWorkerBatch } from '../../../../workers/phase9-metadata-worker';

export const JOB_ID = '00000000-0000-4000-8000-000000000001';
export const CANDIDATE_ID = '00000000-0000-4000-8000-000000000002';
export const STORE_ID = '00000000-0000-4000-8000-000000000003';
export const SESSION_ID = '00000000-0000-4000-8000-000000000004';
export const SNAPSHOT_ID = '00000000-0000-4000-8000-000000000005';
export const CACHE_ID = '00000000-0000-4000-8000-000000000006';
export const CALL_ID = '00000000-0000-4000-8000-000000000007';
export const RESERVATION_ID = '00000000-0000-4000-8000-000000000008';

// M93 receipt shapes (20261101000093_marketplace_phase9_provider_queue_protection.sql).
// Shared with the explicit fixture so both worker paths agree on the contract.
export const m93ClaimReceipt = (claims: ReadonlyArray<{
  id: string; attemptCount: number; leaseToken: string;
}>) => claims.map(claim => ({
  id: claim.id, attempt_count: claim.attemptCount, lease_token: claim.leaseToken,
}));
export const m93BeginReceipt = () => ({ status: 'started', round: 0 });
export const m93ReserveReceipt = (slots: 1 | 6 = 1) => ({
  status: 'reserved', slots,
});
export const m93FinishReceipt = () => ({ status: 'finalized', round: 0 });
export const m93ReleaseReceipt = () => ({ status: 'released' });
export const m93DeferReceipt = (blockedEpoch: number | null | undefined) => ({
  status: 'deferred', blockedEpoch: blockedEpoch ?? 0,
});
export const m93ScheduleRecheckReceipt = (input: {
  status?: 'finalized' | 'retry_scheduled'; round?: number; dueAt?: string;
} = {}) => {
  const status = input.status ?? 'finalized';
  const round = input.round ?? 0;
  if (status === 'retry_scheduled') {
    if (input.dueAt === undefined) throw new Error('P9_SCHEDULE_RECHECK_DUEAT_REQUIRED');
    return { status, round, dueAt: input.dueAt };
  }
  return input.dueAt === undefined ? { status, round } : { status, round, dueAt: input.dueAt };
};

export const workerEnvironment = {
  SUPABASE_URL: 'https://ahntbtktjjmvfosgkmgn.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret-that-is-long-enough-0001',
  PHASE9_WORKER_HOST: '0.0.0.0', PHASE9_WORKER_PORT: '8080',
  PHASE9_WORKER_CONCURRENCY: '1',
  PHASE9_METADATA_WORKER_ID: 'metadata-worker-fixture-0001',
  PHASE9_METADATA_WORKER_INGRESS_TOKEN: 'metadata-ingress-secret-A7z.49_xYp-001',
  // Unit B: fake server-side contact map for the fixture contactId. Fake
  // values only; never a real email.
  PHASE9_PROVIDER_CONTACTS: '{"fixture-contact":"ops@example.invalid"}',
};
const summaryFor = (outcome: string): string => {
  if (outcome === 'coherent_match') return 'accepted_metadata_match';
  if (outcome === 'ambiguous_match') return 'ambiguous';
  if (outcome === 'material_conflict') return 'material_conflict';
  if (outcome === 'no_acceptable_match') return 'no_match';
  if (outcome === 'insufficient_query') return 'manual_metadata_required';
  if (['cost_quota_denied', 'policy_denied', 'provider_disabled',
    'legal_launch_denied', 'cancelled', 'authentication_configuration_failure'].includes(outcome)) {
    return 'policy_denied';
  }
  return 'technical_failure';
};

// M92 derives the receipt from the submitted command. A retained-list winner
// echoes its selected option UUID; a list-less Google result keeps null.
export function completedReceipt(command: Record<string, any>) {
  return {
    version: 'p9-auto-completion-v1', status: 'completed',
    lookupId: command.lookupId, snapshotId: SNAPSHOT_ID,
    outcome: summaryFor(String(command.result?.outcome?.outcome ?? '')),
    selectedOptionId: command.selectedOptionId ?? null,
    prefill: { status: 'skipped', reason: 'not_installed' },
  } as const;
}
type RpcResult = { data: any; error: any };
type Override = (name: string, parameters: Record<string, any>) => Promise<RpcResult | undefined>;

export function automaticDependencies(options: {
  fetcher?: typeof fetch; rpc?: Override; context?: Record<string, unknown>;
  production?: Record<string, any>;
} = {}) {
  const fixture = editionWorkerFixture();
  Object.keys(fixture.current()).forEach(key => { delete fixture.current()[key]; });
  Object.assign(fixture.current(), automaticContext, {
    jobId: JOB_ID, candidateId: CANDIDATE_ID, storeId: STORE_ID, sessionId: SESSION_ID,
    inputId: '00000000-0000-4000-8000-000000000009',
    observationId: '00000000-0000-4000-8000-000000000010',
    claimExpiresAt: new Date(Date.parse(GOLDEN_CLOCK) + 3600000).toISOString(),
    ...options.context,
  });
  let command: Record<string, any> | null = null;
  let gets = 0;
  let physicalCalls = 0;
  let run: { lookupId: string | null; attemptId: string | null } | null = null;
  let lineage: Record<string, any> | null = null;
  let lookupSpec: Record<string, any> | null = null;
  const baseRpc = fixture.dependencies.serviceClient.rpc;
  const rpc = async (name: string, parameters: Record<string, any>): Promise<RpcResult> => {
    fixture.calls.push({ name, parameters });
    if (name === 'phase9_complete_automatic_metadata_v1') command = parameters.p_command;
    const overridden = await options.rpc?.(name, parameters);
    if (overridden) return overridden;
    const ok = (data: any) => ({ data, error: null });
    if (name === 'claim_phase9_metadata_jobs' || name === 'phase9_claim_metadata_jobs_v2') return ok(
      m93ClaimReceipt([{ id: JOB_ID, attemptCount: fixture.current().attempt,
        leaseToken: fixture.current().claimToken }]),
    );
    if (name === 'phase9_metadata_job_context') return ok(fixture.current());
    if (name === 'phase9_automatic_edition_fence_v1') return ok({
      candidateVersion: fixture.current().candidateVersion, requestGeneration: 0,
      capturedRequestId: null, lineage: run?.lookupId == null ? null : lineage,
    });
    if (name === 'phase9_prepare_automatic_metadata_v1') {
      lookupSpec = parameters.p_lookup;
      // M94 creates the run; M32 elects the leader lookup before the grant.
      run = run ?? { lookupId: null, attemptId: null };
      if (lineage !== null) lineage.claimAttempt = fixture.current().attempt;
      Object.assign(fixture.current(), {
        currentLookupId: GOLDEN_LOOKUP_ID,
        currentLookupAdapterKey: lookupSpec.adapter_key,
        currentLookupAdapterVersion: lookupSpec.adapter_version,
      });
      return ok({ admission: m93BeginReceipt(), coalescing: { mode: 'leader', lookupId: GOLDEN_LOOKUP_ID } });
    }
    if (name === 'phase9_provider_configuration_v1') return ok(providerConfigurationSnapshot([
      providerConfigurationRow('google_books', '1.0.0', { protectionPolicy: TEST_ONLY_PROTECTION_POLICY }),
      providerConfigurationRow('open_library', '1.0.0'),
    ]));
    if (name === 'phase9_complete_automatic_metadata_v1') {
      return ok(completedReceipt(command ?? {
        lookupId: GOLDEN_LOOKUP_ID, attemptId: GOLDEN_ATTEMPT_ID, selectedOptionId: null,
        result: { outcome: { outcome: 'schema_invalid' } },
      }));
    }
    if (name === 'phase9_recover_automatic_metadata_v1') return ok({ status: 'missing' });
    if (name === 'phase9_begin_automatic_provider_run_v1') {
      run = run ?? { lookupId: null, attemptId: null };
      if (lineage !== null) lineage.claimAttempt = fixture.current().attempt;
      return ok(m93BeginReceipt());
    }
    if (name === 'phase9_finish_automatic_provider_run_v1') return ok(m93FinishReceipt());
    if (name === 'phase9_reserve_metadata_provider_round_v1') return ok(m93ReserveReceipt());
    if (name === 'phase9_release_metadata_provider_round_v1') return ok(m93ReleaseReceipt());
    if (name === 'phase9_defer_metadata_admission_v1') {
      return ok(m93DeferReceipt(parameters.p_epoch));
    }
    if (name === 'phase9_schedule_automatic_provider_recheck_v1') return ok(m93ScheduleRecheckReceipt());
    if (name === 'phase9_metadata_cache_reuse_context') return ok({ leaderLookupId: null, normalizedOutcome: null });
    if (name === 'phase9_metadata_coalescing_context') {
      Object.assign(fixture.current(), { currentLookupId: GOLDEN_LOOKUP_ID,
        currentLookupAdapterKey: parameters.p_adapter_key,
        currentLookupAdapterVersion: parameters.p_adapter_version });
      return ok({ mode: 'leader', lookupId: GOLDEN_LOOKUP_ID });
    }
    if (name === 'phase9_register_structural_metadata_lookup') {
      Object.assign(fixture.current(), { currentLookupId: GOLDEN_LOOKUP_ID,
        currentLookupAdapterKey: parameters.p_adapter_key,
        currentLookupAdapterVersion: parameters.p_adapter_version });
      return ok({ lookup_id: GOLDEN_LOOKUP_ID });
    }
    if (name === 'phase9_reserve_metadata_usage') return ok({ reservation_id: RESERVATION_ID });
    if (name === 'phase9_register_structural_metadata_attempt') {
      Object.assign(fixture.current(), { currentAttemptId: GOLDEN_ATTEMPT_ID,
        currentAttemptAdapterKey: parameters.p_adapter_key,
        currentAttemptDisposition: 'unresolved' });
      return ok({ attempt_id: GOLDEN_ATTEMPT_ID });
    }
    if (name === 'phase9_register_metadata_provider_call'
      || name === 'phase9_register_edition_options_provider_call_v1') {
      run = run ?? { lookupId: null, attemptId: null };
      run.lookupId = GOLDEN_LOOKUP_ID;
      run.attemptId = GOLDEN_ATTEMPT_ID;
      lineage = { adapterKey: lookupSpec?.adapter_key ?? parameters.p_adapter_key ?? 'google_books',
        adapterVersion: lookupSpec?.adapter_version ?? parameters.p_adapter_version ?? '1.0.0',
        purpose: 'automatic', role: 'primary', sequence: 1,
        lookupId: GOLDEN_LOOKUP_ID, attemptId: GOLDEN_ATTEMPT_ID, claimAttempt: parameters.p_attempt_count,
        policyVersion: Number(lookupSpec?.reuse_policy_version ?? 1) };
      Object.assign(fixture.current(), { currentLookupId: GOLDEN_LOOKUP_ID,
        currentAttemptId: GOLDEN_ATTEMPT_ID, currentAttemptDisposition: 'unresolved' });
      physicalCalls += 1;
      return ok({ status: 'registered', provider_call_id: physicalCalls === 1 ? CALL_ID
        : `00000000-0000-4000-8000-${String(physicalCalls + 100).padStart(12, '0')}`, grant_epoch: 1 });
    }
    if (name === 'phase9_finalize_metadata_provider_call'
      || name === 'phase9_finalize_edition_options_provider_call_v1') {
      // Preserve the durable receipt identity; CONSTRUCTION does not invent a new id.
      return ok({ status: parameters.p_status ?? 'finalized',
        provider_call_id: parameters.p_provider_call_id });
    }
    if (name === 'phase9_select_structural_metadata_snapshot') return ok({ snapshot_id: SNAPSHOT_ID });
    if (name === 'phase9_store_metadata_cache') return ok({ cache_id: CACHE_ID });
    if (name === 'phase9_store_metadata_representative_cover_v1') return ok({ status: 'stored' });
    // Base fixture records its own calls; avoid duplicate observations.
    fixture.calls.pop();
    return baseRpc(name, parameters);
  };
  const production = options.production ?? bootstrapGoogle(workerEnvironment, async (...args) => {
    gets += 1;
    if (options.fetcher) return options.fetcher(...args);
    return new Response(JSON.stringify(googleBooksMultipleVolumes), {
      headers: { 'content-type': 'application/json', 'x-request-id': 'golden-google-automatic-request' },
    });
  });
  const dependencies = { ...fixture.dependencies, ...production, serviceClient: { rpc: fixture.admissions.wrap(rpc) } };
  return { fixture, dependencies, command: () => command, receipt: () => command === null ? null : completedReceipt(command),
    gets: () => gets, run: () => runMetadataWorkerBatch(1, dependencies) };
}
