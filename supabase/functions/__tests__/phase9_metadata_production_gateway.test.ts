import {
  decodeMetadataJobContext,
  loadMetadataJobContext,
  requestFromMetadataContext,
  SupabaseMetadataProductionGateway,
} from '../_shared/imageInventory/runtime/metadataProductionGateway';
import { canonicalizeMetadataOutcome } from '../_shared/imageInventory/metadata/providerAdapter';

const context = {
  contractVersion: 'p9-metadata-job-context-v2',
  jobId: 'job-1', attempt: 1, claimToken: 'a'.repeat(64),
  candidateId: 'candidate-1', candidateState: 'processing', candidateVersion: 1,
  storeId: 'store-1', sessionId: 'session-1', inputId: 'input-1',
  observationId: 'observation-1', title: 'Fixture Book', authors: ['Fixture Author'],
  isbnClue: '9780306406157', publisherClue: null, language: 'en', script: null,
  queryIdentity: '{"providerIndependent":"fixture"}',
  localCanonicalEditionId: null, reusableLookupId: null, reusableOutcome: null,
  currentLookupId: null, currentOutcome: null,
  currentAttemptId: null, currentAttemptOutcome: null,
  currentAttemptDisposition: null, currentAttemptCandidate: null,
  currentAttemptProviderRequestId: null,
  currentPhysicalStatus: null,currentPhysicalClaimAttempt: null,
  providerPolicies: [{
    adapterKey: 'google_books', adapterVersion: '1.0.0', enabled: true,
    matchingAllowed: true, storageAllowed: true, reuseAllowed: true, policyVersion: 1,
  }],
};

describe('Phase 9 production metadata gateway boundary', () => {
  it('maps provider-neutral adapter outcomes to the canonical M15 vocabulary', () => {
    expect(canonicalizeMetadataOutcome('coherent_match')).toBe('accepted_metadata_match');
    expect(canonicalizeMetadataOutcome('no_acceptable_match')).toBe('no_match');
    expect(canonicalizeMetadataOutcome('ambiguous_match')).toBe('ambiguous');
    expect(canonicalizeMetadataOutcome('material_conflict')).toBe('material_conflict');
    expect(canonicalizeMetadataOutcome('cost_quota_denied')).toBe('cost_quota_denied');
    expect(canonicalizeMetadataOutcome('authentication_configuration_failure')).toBe('policy_denied');
    expect(canonicalizeMetadataOutcome('timeout')).toBe('technical_failure');
  });
  it('strictly decodes minimum fenced context and rejects divergent query identity', () => {
    const decoded = decodeMetadataJobContext(context);
    expect(() => requestFromMetadataContext(decoded))
      .toThrow('P9_METADATA_QUERY_IDENTITY_MISMATCH');
    const canonical = requestFromMetadataContext(decodeMetadataJobContext({
      ...context,
      queryIdentity: '["p9-metadata-lookup-v1", "p9-bibliographic-normalizer-v1", "bibliographic", "9780306406157", "fixture book", ["fixture author"], "en", []]',
    }));
    expect(canonical).toMatchObject({
      candidateId: 'candidate-1', jobId: 'job-1',
      query: { normalizedIsbn13: '9780306406157' },
    });
    expect(() => decodeMetadataJobContext({ ...context, rawProviderPayload: {} }))
      .toThrow('P9_METADATA_CONTEXT_INVALID');
    expect(() => decodeMetadataJobContext({ ...context, candidateState: 'ready' }))
      .toThrow('P9_METADATA_CONTEXT_INVALID');
  });

  it('uses bibliographic identity when an ISBN clue is present but invalid', () => {
    const canonical = requestFromMetadataContext(decodeMetadataJobContext({
      ...context,
      isbnClue: '9780306406158',
      queryIdentity: '["p9-metadata-lookup-v1", "p9-bibliographic-normalizer-v1", "bibliographic", null, "fixture book", ["fixture author"], "en", []]',
    }));
    expect(canonical.query).toMatchObject({
      strategy: 'bibliographic', normalizedIsbn13: null,
    });
  });

  it('loads context only through the fenced service RPC mapping', async () => {
    const rpc = jest.fn(async () => ({ data: context, error: null }));
    await expect(loadMetadataJobContext({ rpc }, {
      jobId: 'job-1', worker: 'metadata-worker-0001',
      leaseToken: 'a'.repeat(64), attempt: 1,
    })).resolves.toMatchObject({ candidateId: 'candidate-1' });
    expect(rpc).toHaveBeenCalledWith('phase9_metadata_job_context', {
      p_job_id: 'job-1', p_worker: 'metadata-worker-0001',
      p_lease_token: 'a'.repeat(64), p_attempt_count: 1,
    });
  });

  it('reconstructs a finalized physical result after logical response loss without provider egress', async () => {
    const selected = { providerRecordId: 'volume-1', attemptId: 'attempt-1',
      title: 'Fixture Book', authors: ['Fixture Author'] };
    const recovered = decodeMetadataJobContext({
      ...context,currentLookupId: 'lookup-1',currentAttemptId: 'attempt-1',
      queryIdentity: '["p9-metadata-lookup-v1", "p9-bibliographic-normalizer-v1", "bibliographic", "9780306406157", "fixture book", ["fixture author"], "en", []]',
      currentAttemptDisposition: 'unresolved',currentPhysicalStatus: 'finalized',
      currentPhysicalClaimAttempt: 1,
      currentPhysicalOutcome: 'coherent_match',currentPhysicalProviderRequestId: 'request-1',
      currentPhysicalRetryable: false,currentPhysicalCandidate: selected,
      currentPhysicalEvidence: ['exact_validated_isbn'],
    });
    const rpc = jest.fn(async () => ({ data: {}, error: null }));
    const primary = { lookup: jest.fn() } as any;
    const gateway = new SupabaseMetadataProductionGateway({ rpc }, {
      worker: 'metadata-worker-0001',context: recovered,primary,
      adapterKey: 'google_books',adapterVersion: '1.0.0',capabilityVersion: 'cap-v1',
      schemaVersion: 'p9-metadata-foundation-v1',lookupContractVersion: 'p9-metadata-lookup-v1',
      normalizerVersion: 'p9-bibliographic-normalizer-v1',routingPolicyVersion: 'p9-metadata-routing-v1',
      selectionPolicyVersion: 'p9-metadata-selection-v1',snapshotVersion: 'p9-selected-metadata-v1',
      cachePolicyVersion: 'p9-metadata-cache-v1',cacheNamespace: 'metadata-v1',
      pricingPolicyVersion: 'metadata-zero-cost-v1',revalidationSeconds: 86400,
    });
    await expect(gateway.resumeFinalizedAttempt({
      ...requestFromMetadataContext(recovered),claimWorker: 'metadata-worker-0001',
      lookupId: 'lookup-1',attemptId: 'attempt-1',
    })).resolves.toEqual({ outcome: 'accepted_metadata_match' });
    expect(primary.lookup).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('phase9_finalize_structural_metadata_attempt',
      expect.objectContaining({ p_normalized_candidate: selected }));
    expect(rpc).toHaveBeenCalledWith('phase9_select_structural_metadata_snapshot',
      expect.objectContaining({ p_coherent_edition: selected }));
  });

  it('reconciles a known finalized retryable result without authorizing another egress', async () => {
    const recovered = decodeMetadataJobContext({
      ...context,currentLookupId: 'lookup-1',currentAttemptId: 'attempt-1',
      queryIdentity: '["p9-metadata-lookup-v1", "p9-bibliographic-normalizer-v1", "bibliographic", "9780306406157", "fixture book", ["fixture author"], "en", []]',
      currentAttemptDisposition: 'unresolved',currentPhysicalStatus: 'finalized',
      currentPhysicalClaimAttempt: 1,
      currentPhysicalOutcome: 'timeout',currentPhysicalLogicalOutcome: 'timeout',
      currentPhysicalProviderRequestId: null,currentPhysicalRetryable: true,
      currentPhysicalCandidate: null,currentPhysicalEvidence: [],
    });
    const rpc = jest.fn(async () => ({ data: { status: 'retry_scheduled' }, error: null }));
    const primary = { lookup: jest.fn() } as any;
    const gateway = new SupabaseMetadataProductionGateway({ rpc }, {
      worker: 'metadata-worker-0001',context: recovered,primary,
      adapterKey: 'google_books',adapterVersion: '1.0.0',capabilityVersion: 'cap-v1',
      schemaVersion: 'p9-metadata-foundation-v1',lookupContractVersion: 'p9-metadata-lookup-v1',
      normalizerVersion: 'p9-bibliographic-normalizer-v1',routingPolicyVersion: 'p9-metadata-routing-v1',
      selectionPolicyVersion: 'p9-metadata-selection-v1',snapshotVersion: 'p9-selected-metadata-v1',
      cachePolicyVersion: 'p9-metadata-cache-v1',cacheNamespace: 'metadata-v1',
      pricingPolicyVersion: 'metadata-zero-cost-v1',revalidationSeconds: 1,
    });
    await expect(gateway.resumeFinalizedAttempt({
      ...requestFromMetadataContext(recovered),claimWorker: 'metadata-worker-0001',
      lookupId: 'lookup-1',attemptId: 'attempt-1',
    })).resolves.toEqual({ outcome: 'retry_scheduled' });
    expect(primary.lookup).not.toHaveBeenCalled();
  });

  it('does not replay older-claim finalized transients on second or third claims', async () => {
    for (const [attempt, physicalAttempt] of [[2, 1], [3, 2]] as const) {
      const recovered = decodeMetadataJobContext({
        ...context,attempt,currentLookupId: 'lookup-1',currentAttemptId: 'attempt-1',
        queryIdentity: '["p9-metadata-lookup-v1", "p9-bibliographic-normalizer-v1", "bibliographic", "9780306406157", "fixture book", ["fixture author"], "en", []]',
        currentAttemptDisposition: 'unresolved',currentPhysicalStatus: 'finalized',
        currentPhysicalClaimAttempt: physicalAttempt,currentPhysicalOutcome: 'provider_unavailable',
        currentPhysicalLogicalOutcome: 'provider_unavailable',currentPhysicalProviderRequestId: null,
        currentPhysicalRetryable: true,currentPhysicalCandidate: null,currentPhysicalEvidence: [],
      });
      const rpc = jest.fn(async () => ({ data: {}, error: null }));
      const primary = { lookup: jest.fn() } as any;
      const gateway = new SupabaseMetadataProductionGateway({ rpc }, {
        worker: 'metadata-worker-0001',context: recovered,primary,
        adapterKey: 'google_books',adapterVersion: '1.0.0',capabilityVersion: 'cap-v1',
        schemaVersion: 'p9-metadata-foundation-v1',lookupContractVersion: 'p9-metadata-lookup-v1',
        normalizerVersion: 'p9-bibliographic-normalizer-v1',routingPolicyVersion: 'p9-metadata-routing-v1',
        selectionPolicyVersion: 'p9-metadata-selection-v1',snapshotVersion: 'p9-selected-metadata-v1',
        cachePolicyVersion: 'p9-metadata-cache-v1',cacheNamespace: 'metadata-v1',
        pricingPolicyVersion: 'metadata-zero-cost-v1',revalidationSeconds: 1,
      });
      await expect(gateway.resumeFinalizedAttempt({
        ...requestFromMetadataContext(recovered),claimWorker: 'metadata-worker-0001',
        lookupId: 'lookup-1',attemptId: 'attempt-1',
      })).resolves.toBeNull();
      expect(rpc).not.toHaveBeenCalled();
    }
  });

  it('rejects malformed or failed context responses without leaking provider details', async () => {
    const rpc = jest.fn(async () => ({ data: null, error: { message: 'private detail' } }));
    await expect(loadMetadataJobContext({ rpc }, {
      jobId: 'job-1', worker: 'metadata-worker-0001',
      leaseToken: 'a'.repeat(64), attempt: 1,
    })).rejects.toThrow('P9_METADATA_RPC_FAILED:phase9_metadata_job_context');
  });
});
