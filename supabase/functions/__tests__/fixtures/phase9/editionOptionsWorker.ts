import { GoogleBooksAdapter } from '../../../_shared/imageInventory/metadata/googleBooks/adapter';
import { GOOGLE_BOOKS_CAPABILITY } from '../../../_shared/imageInventory/metadata/googleBooks';
import { buildMetadataQueryIdentity } from '../../../_shared/imageInventory/metadata';
import { decodeMetadataJobContext } from '../../../_shared/imageInventory/runtime/metadataJobContext';
import { SupabaseMetadataProductionGateway, requestFromMetadataContext }
  from '../../../_shared/imageInventory/runtime/metadataProductionGateway';
import { getWorkerProtectionState, runMetadataWorkerBatch } from '../../../../../workers/phase9-metadata-worker';
import { createProtectionState } from '../../../_shared/imageInventory/runtime/providerProtection';
import type { MetadataEditionOptionsBoundary, EditionOptionsCompletionInput }
  from '../../../_shared/imageInventory/runtime/metadataEditionOptionsBoundary';
import { googleBooksMultipleVolumes } from './googleBooksResponses';
import { TEST_ONLY_PROVIDER_CONTACTS } from '../../support/providerProtection';
import { metadataAdmissionFake } from '../../support/metadataAdmissionFake';
import { providerConfigurationRow, providerConfigurationSnapshot } from './providerConfiguration';
import { completedReceipt, m93BeginReceipt, m93ClaimReceipt, m93DeferReceipt, m93FinishReceipt,
  m93ReleaseReceipt, m93ReserveReceipt } from '../../support/automaticWorker';

// Picker §§4.1-4.3/5/9: recorded transport + disposable in-memory boundary.
// This models the required SQL port; it is not database/concurrency acceptance proof.
export const worker = 'metadata-worker-fixture-0001';
export const query = buildMetadataQueryIdentity({
  strategy: 'bibliographic', title: 'The Fixture Book', authors: ['Fixture Author'],
  isbnClue: '9780306406157', language: 'en', editionClues: [],
});
const epoch = Date.now();
const future = new Date(epoch + 3600000).toISOString();
// Legacy fixture lineage (pre-8b tests rely on these labels). New 8b paths
// opt into UUID_LINEAGE through useUuidLineage so the SQL boundary is legal.
export const JOB_ID = 'job-1';
export const CANDIDATE_ID = 'candidate-1';
export const idAt = (ordinal: number) =>
  `00000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`;
export const UUID_LINEAGE = Object.freeze({
  jobId: idAt(11), candidateId: idAt(12), storeId: idAt(13),
  sessionId: idAt(14), inputId: idAt(15), observationId: idAt(16),
});
export const UUID_CANDIDATE_ID = UUID_LINEAGE.candidateId;
export function useUuidLineage(fixture: { current: () => Record<string, any> }) {
  Object.assign(fixture.current(), UUID_LINEAGE);
  return UUID_LINEAGE;
}
export const automaticContext = {
  contractVersion: 'p9-metadata-job-context-v2', jobId: JOB_ID, attempt: 1,
  claimToken: 'a'.repeat(64), claimExpiresAt: future,
  candidateId: CANDIDATE_ID, candidateState: 'processing', candidateVersion: 1,
  storeId: 'store-1', sessionId: 'session-1', inputId: 'input-1', observationId: 'observation-1',
  title: 'The Fixture Book', authors: ['Fixture Author'], isbnClue: '9780306406157',
  publisherClue: null, language: 'en', script: null, queryIdentity: query.key,
  localCanonicalEditionId: null, reusableLookupId: null, reusableOutcome: null,
  currentLookupId: null, currentOutcome: null, currentAttemptId: null, currentAttemptOutcome: null,
  currentAttemptDisposition: null, currentAttemptCandidate: null, currentAttemptProviderRequestId: null,
  currentPhysicalStatus: null, currentPhysicalClaimAttempt: null,
  providerPolicies: [{
    adapterKey: 'google_books', adapterVersion: '1.0.0', enabled: true,
    matchingAllowed: true, storageAllowed: true, reuseAllowed: true, policyVersion: 1,
  }],
};
export const explicitContext = {
  ...automaticContext, purpose: 'edition_options', candidateState: 'ready',
  requestGeneration: 0, optionsVersion: 0, optionsAvailable: false, optionsExpiresAt: null,
};
export const tenPositions = {
  kind: 'books#volumes', totalItems: 10,
  items: Array.from({ length: 10 }, (_, ordinal) => ordinal === 1 ? null
    : ordinal === 3 ? googleBooksMultipleVolumes.items[2] : googleBooksMultipleVolumes.items[0]),
};
type RawContext = Record<string, unknown>;
type Call = { name: string; parameters: Record<string, any> };
// Worker/explicit tests drain this after each test and assert unknown-binding count 0.
export const createdFixtures: any[] = [];
export function editionWorkerFixture(count = 1) {
  // Isolate process-local observations between tests, retaining sharing within each worker batch.
  for (const key of ['google_books', 'open_library']) Object.assign(getWorkerProtectionState(key), createProtectionState());
  const contexts = new Map<string, RawContext>();
  const queue: string[] = [];
  for (let index = 1; index <= count; index += 1) {
    const id = 'job-' + index;
    contexts.set(id, { ...explicitContext, jobId: id, candidateId: 'candidate-' + index,
      claimToken: index.toString(16).padStart(64, '0') });
    queue.push(id);
  }
  const ordinalFor = (jobId: string) => {
    const ordinal = Array.from(contexts.keys()).indexOf(String(jobId));
    return ordinal < 0 ? contexts.size : ordinal + 1;
  };
  const lookupIdFor = (jobId: string) => idAt(100 + ordinalFor(jobId));
  const attemptIdFor = (jobId: string) => idAt(200 + ordinalFor(jobId));
  const calls: Call[] = [];
  const admissions = metadataAdmissionFake(jobId => [...contexts.values()]
    .find(context => context.jobId === jobId), (name, parameters) => calls.push({ name, parameters }));
  admissions.registry(providerConfigurationSnapshot([
    providerConfigurationRow('google_books', '1.0.0'), providerConfigurationRow('open_library', '1.0.0'),
  ]));
  const physicalCalls: Array<{ jobId: string; attempt: number; finalized: boolean;
    sequence?: number; stage?: string }> = [];
  // SQL provider_call_id is uuid; the port's beforeRequest returns the same UUID.
  const physicalCallIds = new Map<string, number>();
  const registerPhysicalCall = (call: (typeof physicalCalls)[number]) => {
    const providerCallId = `00000000-0000-4000-8000-${String(physicalCalls.length + 1).padStart(12, '0')}`;
    physicalCalls.push(call);
    physicalCallIds.set(providerCallId, physicalCalls.length - 1);
    return providerCallId;
  };
  const saved = new Map<string, EditionOptionsCompletionInput>();
  const selections = new Map([[CANDIDATE_ID, { selectionId: 'owner-choice', price: 450, quantity: 2, notes: 'keep' }]]);
  let providerRequests = 0;
  let maximumActive = 0;
  let active = 0;
  const controls = {
    automaticLineage: null as null | Record<string, unknown>,
    payload: tenPositions as unknown, status: 200, ownerActive: true, uncommitted: true,
    loseCompletionResponse: false, failPersistence: false, rejectPhysical: false,
    denyPhysicalRegistration: false,
    permission: true, deadline: future as string | null,
    beforeFetch: null as null | (() => Promise<void>),
    beforeComplete: null as null | (() => Promise<void>),
    beforeContextRead: null as null | (() => void),
  };
  let activeKey = 'job-1';
  const current = () => contexts.get(activeKey)!;
  const valid = (fence: Record<string, any>) => {
    const value = contexts.get(fence.jobId);
    return !!value && controls.ownerActive && controls.uncommitted
      && value.purpose === 'edition_options' && value.candidateState !== 'committed'
      && value.requestGeneration === fence.requestGeneration && value.queryIdentity === fence.queryIdentity
      && value.claimToken === fence.claimLeaseToken && value.attempt === fence.claimAttempt
      && value.candidateId === fence.candidateId && value.storeId === fence.storeId
      && value.sessionId === fence.sessionId;
  };
  const receipt = (input: EditionOptionsCompletionInput, status: 'completed' | 'replayed') => ({
    status, requestId: input.requestId, requestGeneration: input.requestGeneration,
    optionsVersion: 1, optionsExpiresAt: input.optionsExpiresAt,
  });
  const boundary: MetadataEditionOptionsBoundary = {
    // 02b section 8.2: existing provider-path cases explicitly model a cache miss.
    async reuseCache() { return { status: 'miss' }; },
    async recover(fence) {
      if (!valid(fence)) return { status: 'stale_rejected' };
      const prior = saved.get(fence.candidateId);
      return prior && prior.requestId === fence.requestId
        && prior.requestGeneration === fence.requestGeneration
        && Date.parse(prior.optionsExpiresAt) > Date.now() ? receipt(prior, 'replayed')
        : { status: 'missing' };
    },
    async complete(input) {
      if (controls.beforeComplete) await controls.beforeComplete();
      if (!valid(input)) return { status: 'stale_rejected' };
      if (controls.failPersistence) throw new Error('fixture persistence failure');
      saved.set(input.candidateId, input);
      if (controls.loseCompletionResponse) {
        controls.loseCompletionResponse = false;
        throw new Error('fixture lost response after durable completion');
      }
      return receipt(input, 'completed');
    },
    async fail(input) {
      if (!valid(input)) return { status: 'resolved' };
      return { status: input.retryable && input.claimAttempt < 5 ? 'retry_scheduled' : 'resolved' };
    },
  };
  const rpc = async (name: string, parameters: Record<string, any>) => {
    calls.push({ name, parameters });
    if (name === 'phase9_provider_configuration_v1') return { data: providerConfigurationSnapshot(
      (current().providerPolicies as Array<Record<string, any>>).map(policy => providerConfigurationRow(
        policy.adapterKey, policy.adapterVersion, { enabled: policy.enabled,
          matchingAllowed: policy.matchingAllowed, storageAllowed: policy.storageAllowed,
          explicitSearchAllowed: true, explicitRole: policy.adapterKey === 'google_books' ? 'primary' : 'secondary',
          explicitOrder: policy.adapterKey === 'google_books' ? 1 : 2 }))), error: null };
    if (name === 'phase9_metadata_cache_reuse_context') return { data: { leaderLookupId: null, normalizedOutcome: null }, error: null };
    if (name === 'phase9_store_metadata_cache') return { data: { cache_id: idAt(400) }, error: null };
    if (name === 'phase9_automatic_edition_fence_v1') return { data: {
      candidateVersion: current().candidateVersion, requestGeneration: 0, capturedRequestId: null,
      lineage: controls.automaticLineage,
    }, error: null };
    if (name === 'phase9_prepare_automatic_metadata_v1') return { data: {
      admission: m93BeginReceipt(), coalescing: { mode: 'leader', lookupId: lookupIdFor(current().jobId as string) },
    }, error: null };
    if (name === 'phase9_complete_automatic_metadata_v1') return {
      data: completedReceipt(parameters.p_command), error: null };
    if (name === 'phase9_recover_automatic_metadata_v1') return { data: { status: 'missing' }, error: null };
    if (name === 'phase9_reuse_candidate_edition_cache_v1') {
      return { data: { status: 'miss' }, error: null };
    }
    if (name === 'claim_phase9_metadata_jobs') {
      const ids = queue.splice(0, parameters.p_batch_size);
      return { data: ids.map(id => ({ id, attempt_count: contexts.get(id)!.attempt,
        lease_token: contexts.get(id)!.claimToken })), error: null };
    }
    // M93 queue receipts for the 8b explicit path; legacy claim stays above.
    if (name === 'phase9_claim_metadata_jobs_v2') {
      const ids = queue.splice(0, parameters.p_batch_size);
      return { data: m93ClaimReceipt(ids.map(id => ({ id, attemptCount: contexts.get(id)!.attempt,
        leaseToken: contexts.get(id)!.claimToken }))), error: null };
    }
    if (name === 'phase9_begin_automatic_provider_run_v1') {
      return { data: m93BeginReceipt(), error: null };
    }
    if (name === 'phase9_reserve_metadata_provider_round_v1') {
      return admissions.reserve(parameters);
    }
    if (name === 'phase9_finish_automatic_provider_run_v1') {
      return { data: m93FinishReceipt(), error: null };
    }
    if (name === 'phase9_release_metadata_provider_round_v1') {
      return admissions.release(parameters);
    }
    if (name === 'phase9_defer_metadata_admission_v1') {
      return { data: m93DeferReceipt(parameters.p_epoch), error: null };
    }
    if (name === 'phase9_metadata_job_context') {
      if (controls.beforeContextRead) controls.beforeContextRead();
      return { data: contexts.get(parameters.p_job_id), error: null };
    }
    if (name === 'phase9_register_structural_metadata_lookup') {
      return { data: { lookup_id: lookupIdFor(parameters.p_job_id) }, error: null };
    }
    if (name === 'phase9_reserve_metadata_usage') {
      return { data: { reservation_id: idAt(300 + ordinalFor(parameters.p_job_id)) }, error: null };
    }
    if (name === 'phase9_register_structural_metadata_attempt') {
      return { data: { attempt_id: parameters.p_provider_role === 'secondary'
        ? idAt(220 + ordinalFor(parameters.p_job_id)) : attemptIdFor(parameters.p_job_id) }, error: null };
    }
    if (name === 'phase9_register_metadata_provider_call') {
      const providerCallId = registerPhysicalCall({
        jobId: parameters.p_job_id, attempt: parameters.p_attempt_count, finalized: false,
      });
      return { data: { status: 'registered', provider_call_id: providerCallId, grant_epoch: 1 }, error: null };
    }
    if (name === 'phase9_register_edition_options_provider_call_v1') {
      if (controls.denyPhysicalRegistration) throw new Error('P9_EXTERNAL_ADMISSION_PAUSED');
      const providerCallId = registerPhysicalCall({
        jobId: parameters.p_job_id ?? current().jobId,
        attempt: parameters.p_attempt_count ?? current().attempt,
        finalized: false,
        sequence: parameters.p_call_sequence,
        stage: parameters.p_call_stage,
      });
      return { data: { status: 'registered', provider_call_id: providerCallId, grant_epoch: 1 }, error: null };
    }
    if (name === 'phase9_finalize_edition_options_provider_call_v1') {
      const index = physicalCallIds.get(String(parameters.p_provider_call_id));
      if (index !== undefined) physicalCalls[index].finalized = true;
      return { data: { status: controls.rejectPhysical ? 'stale_rejected' : parameters.p_status,
        provider_call_id: parameters.p_provider_call_id }, error: null };
    }
    if (name === 'phase9_finalize_metadata_provider_call') {
      const index = physicalCallIds.get(String(parameters.p_provider_call_id));
      if (index !== undefined) physicalCalls[index].finalized = true;
      return { data: { status: controls.rejectPhysical ? 'stale_rejected' : parameters.p_status,
        provider_call_id: parameters.p_provider_call_id }, error: null };
    }
    if (name === 'phase9_finalize_structural_metadata_attempt'
      || name === 'phase9_complete_structural_local_metadata_match') return { data: {}, error: null };
    if (name === 'phase9_fail_metadata_job') return { data: { status: 'resolved' }, error: null };
    throw new Error('unexpected fixture RPC ' + name);
  };
  const adapter = new GoogleBooksAdapter({
    mode: 'real', apiKey: 'fixture-only-no-network', timeoutMs: 10000, maxResponseBytes: 100000,
    verifyOptionsRetention: ({ fetchedAt }) => ({
      storagePermissionVerified: controls.permission,
      permittedDeadlineAt: controls.deadline === future
        ? new Date(Date.parse(fetchedAt) + 3600000).toISOString() : controls.deadline,
    }),
    fetcher: async () => {
      providerRequests += 1; active += 1; maximumActive = Math.max(maximumActive, active);
      try {
        if (controls.beforeFetch) await controls.beforeFetch();
        return new Response(JSON.stringify(controls.payload), {
          status: controls.status, headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' },
        });
      } finally { active -= 1; }
    },
  });
  let activeRpc = admissions.wrap(rpc);
  const serviceClient = { get rpc() { return activeRpc; }, set rpc(value) { activeRpc = admissions.wrap(value); } };
  const dependencies = {
    workerId: worker, workerAuthToken: 'fixture-worker-ingress', serviceClient,
    primary: adapter, primaryCapability: GOOGLE_BOOKS_CAPABILITY, editionOptionsBoundary: boundary,
    // Unit B: fake server-side contact map for the fixture contactId. Fake
    // values only; never a real email.
    providerContacts: TEST_ONLY_PROVIDER_CONTACTS,
  };
  const direct = (configurationOverrides: Record<string, unknown> = {}) => {
    const context = decodeMetadataJobContext(current());
    const request = { ...requestFromMetadataContext(context), claimWorker: worker };
    const gateway = new SupabaseMetadataProductionGateway(dependencies.serviceClient, {
      worker, context, primary: adapter, adapterKey: 'google_books', adapterVersion: '1.0.0',
      capabilityVersion: 'cap-v1', schemaVersion: 'p9-metadata-foundation-v1',
      lookupContractVersion: 'p9-metadata-lookup-v1', normalizerVersion: 'p9-bibliographic-normalizer-v1',
      routingPolicyVersion: 'p9-metadata-routing-v1', selectionPolicyVersion: 'p9-metadata-selection-v1',
      snapshotVersion: 'p9-selected-metadata-v1', cachePolicyVersion: 'p9-metadata-cache-v1',
      cacheNamespace: 'metadata-v1', pricingPolicyVersion: 'metadata-zero-cost-v1', revalidationSeconds: 86400,
      editionOptions: { boundary, request },
      ...configurationOverrides,
    });
    return { context, gateway };
  };
  const promoteLineage = () => {
    const legacyId = activeKey;
    const context = contexts.get(legacyId)!;
    contexts.delete(legacyId);
    Object.assign(context, UUID_LINEAGE);
    contexts.set(UUID_LINEAGE.jobId, context);
    activeKey = UUID_LINEAGE.jobId;
    for (let index = 0; index < queue.length; index += 1) {
      if (queue[index] === legacyId) queue[index] = UUID_LINEAGE.jobId;
    }
    return UUID_LINEAGE;
  };
  const requeue = (updates: RawContext = {}) => {
    Object.assign(current(), { attempt: Number(current().attempt) + 1,
      claimToken: 'f'.repeat(64), ...updates });
    queue.push(activeKey);
  };
  const newRequest = () => {
    const id = 'job-' + (contexts.size + 1);
    contexts.set(id, { ...explicitContext, jobId: id, candidateId: 'candidate-1',
      claimToken: (contexts.size + 1).toString(16).padStart(64, '0') });
    queue.push(id);
    activeKey = id;
    return id;
  };
  const api = { newRequest, adapter, boundary, dependencies, contexts, current, calls, controls, saved, selections, admissions,
    physicalCalls, direct, requeue, lookupIdFor, attemptIdFor, useUuidLineage: promoteLineage,
    run: (budget = count) => runMetadataWorkerBatch(budget, dependencies),
    stats: () => ({ providerRequests, maximumActive, active }) };
  createdFixtures.push(api);
  return api;
}
