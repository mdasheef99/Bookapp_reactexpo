import { GoogleBooksAdapter } from '../../../_shared/imageInventory/metadata/googleBooks/adapter';
import { GOOGLE_BOOKS_CAPABILITY } from '../../../_shared/imageInventory/metadata/googleBooks';
import { buildMetadataQueryIdentity } from '../../../_shared/imageInventory/metadata';
import { decodeMetadataJobContext } from '../../../_shared/imageInventory/runtime/metadataJobContext';
import { SupabaseMetadataProductionGateway, requestFromMetadataContext }
  from '../../../_shared/imageInventory/runtime/metadataProductionGateway';
import { runMetadataWorkerBatch } from '../../../../../workers/phase9-metadata-worker';
import type { MetadataEditionOptionsBoundary, EditionOptionsCompletionInput }
  from '../../../_shared/imageInventory/runtime/metadataEditionOptionsBoundary';
import { googleBooksMultipleVolumes } from './googleBooksResponses';

// Picker §§4.1-4.3/5/9: recorded transport + disposable in-memory boundary.
// This models the required SQL port; it is not database/concurrency acceptance proof.
export const worker = 'metadata-worker-fixture-0001';
export const query = buildMetadataQueryIdentity({
  strategy: 'bibliographic', title: 'The Fixture Book', authors: ['Fixture Author'],
  isbnClue: '9780306406157', language: 'en', editionClues: [],
});
const epoch = Date.now();
const future = new Date(epoch + 3600000).toISOString();
export const automaticContext = {
  contractVersion: 'p9-metadata-job-context-v2', jobId: 'job-1', attempt: 1,
  claimToken: 'a'.repeat(64), claimExpiresAt: future,
  candidateId: 'candidate-1', candidateState: 'processing', candidateVersion: 1,
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
export function editionWorkerFixture(count = 1) {
  const contexts = new Map<string, RawContext>();
  const queue: string[] = [];
  for (let index = 1; index <= count; index += 1) {
    const id = 'job-' + index;
    contexts.set(id, { ...explicitContext, jobId: id, candidateId: 'candidate-' + index,
      claimToken: index.toString(16).padStart(64, '0') });
    queue.push(id);
  }
  const calls: Call[] = [];
  const physicalCalls: Array<{ jobId: string; attempt: number; finalized: boolean }> = [];
  const saved = new Map<string, EditionOptionsCompletionInput>();
  const selections = new Map([['candidate-1', { selectionId: 'owner-choice', price: 450, quantity: 2, notes: 'keep' }]]);
  let providerRequests = 0;
  let maximumActive = 0;
  let active = 0;
  const controls = {
    payload: tenPositions as unknown, status: 200, ownerActive: true, uncommitted: true,
    loseCompletionResponse: false, failPersistence: false, rejectPhysical: false,
    permission: true, deadline: future as string | null,
    beforeFetch: null as null | (() => Promise<void>),
    beforeComplete: null as null | (() => Promise<void>),
    beforeContextRead: null as null | (() => void),
  };
  const current = () => contexts.get('job-1')!;
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
    if (name === 'claim_phase9_metadata_jobs') {
      const ids = queue.splice(0, parameters.p_batch_size);
      return { data: ids.map(id => ({ id, attempt_count: contexts.get(id)!.attempt,
        lease_token: contexts.get(id)!.claimToken })), error: null };
    }
    if (name === 'phase9_metadata_job_context') {
      if (controls.beforeContextRead) controls.beforeContextRead();
      return { data: contexts.get(parameters.p_job_id), error: null };
    }
    if (name === 'phase9_register_structural_metadata_lookup') {
      return { data: { lookup_id: 'lookup-' + parameters.p_job_id }, error: null };
    }
    if (name === 'phase9_reserve_metadata_usage') {
      return { data: { reservation_id: 'reservation-' + parameters.p_job_id }, error: null };
    }
    if (name === 'phase9_register_structural_metadata_attempt') {
      return { data: { attempt_id: 'attempt-' + parameters.p_job_id }, error: null };
    }
    if (name === 'phase9_register_metadata_provider_call') {
      physicalCalls.push({ jobId: parameters.p_job_id, attempt: parameters.p_attempt_count, finalized: false });
      return { data: { provider_call_id: 'call-' + physicalCalls.length }, error: null };
    }
    if (name === 'phase9_finalize_metadata_provider_call') {
      physicalCalls[Number(parameters.p_provider_call_id.split('-')[1]) - 1].finalized = true;
      return { data: { status: controls.rejectPhysical ? 'stale_rejected' : 'finalized' }, error: null };
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
  const dependencies = {
    workerId: worker, workerAuthToken: 'fixture-worker-ingress', serviceClient: { rpc },
    primary: adapter, primaryCapability: GOOGLE_BOOKS_CAPABILITY, editionOptionsBoundary: boundary,
  };
  const direct = () => {
    const context = decodeMetadataJobContext(current());
    const request = { ...requestFromMetadataContext(context), claimWorker: worker };
    const gateway = new SupabaseMetadataProductionGateway({ rpc }, {
      worker, context, primary: adapter, adapterKey: 'google_books', adapterVersion: '1.0.0',
      capabilityVersion: 'cap-v1', schemaVersion: 'p9-metadata-foundation-v1',
      lookupContractVersion: 'p9-metadata-lookup-v1', normalizerVersion: 'p9-bibliographic-normalizer-v1',
      routingPolicyVersion: 'p9-metadata-routing-v1', selectionPolicyVersion: 'p9-metadata-selection-v1',
      snapshotVersion: 'p9-selected-metadata-v1', cachePolicyVersion: 'p9-metadata-cache-v1',
      cacheNamespace: 'metadata-v1', pricingPolicyVersion: 'metadata-zero-cost-v1', revalidationSeconds: 86400,
      editionOptions: { boundary, request },
    });
    return { context, gateway };
  };
  const requeue = (updates: RawContext = {}) => {
    Object.assign(current(), { attempt: Number(current().attempt) + 1,
      claimToken: 'f'.repeat(64), ...updates });
    queue.push('job-1');
  };
  const newRequest = () => {
    const id = 'job-' + (contexts.size + 1);
    contexts.set(id, { ...explicitContext, jobId: id, candidateId: 'candidate-1',
      claimToken: (contexts.size + 1).toString(16).padStart(64, '0') });
    queue.push(id);
    return id;
  };
  return { newRequest, adapter, boundary, dependencies, contexts, current, calls, controls, saved, selections,
    physicalCalls, direct, requeue, run: (budget = count) => runMetadataWorkerBatch(budget, dependencies),
    stats: () => ({ providerRequests, maximumActive, active }) };
}
