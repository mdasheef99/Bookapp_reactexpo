import {
  runMetadataProductionComposition,
  MetadataProductionGateway,
} from '../_shared/imageInventory/runtime/metadataProductionComposition';
import { buildMetadataQueryIdentity } from '../_shared/imageInventory/metadata';

const query = buildMetadataQueryIdentity({
  strategy: 'isbn',
  isbnClue: '9780306406157',
  title: 'The Fixture Book',
  authors: ['Fixture Author'],
  language: 'en',
  editionClues: [],
});

function gateway(overrides: Partial<MetadataProductionGateway> = {}) {
  const calls: string[] = [];
  const base: MetadataProductionGateway = {
    resolveLocal: jest.fn(async () => (calls.push('local'), { outcome: 'insufficient' as const })),
    readCache: jest.fn(async () => (calls.push('cache'), { outcome: 'miss' as const })),
    completeCacheHit: jest.fn(async () => { calls.push('complete-cache'); }),
    decideCoalescing: jest.fn(async () => (calls.push('coalescing'), { mode: 'leader' as const })),
    registerFollower: jest.fn(async () => { calls.push('follower'); }),
    registerLookup: jest.fn(async () => (calls.push('lookup'), { lookupId: 'lookup-1' })),
    reserveUsage: jest.fn(async () => (calls.push('reserve'), { reservationId: 'reservation-1' })),
    registerAttempt: jest.fn(async () => (calls.push('attempt'), { attemptId: 'attempt-1' })),
    validateEgress: jest.fn(async () => { calls.push('fence'); return true; }),
    invokePrimary: jest.fn(async () => (calls.push('provider'), {
      outcome: 'no_acceptable_match' as const,
      candidates: [],
      selected: null,
      evidence: [],
      retryable: false,
      providerRequestId: null,
    })),
    finalizeAttempt: jest.fn(async () => { calls.push('finalize'); }),
    persistCache: jest.fn(async () => { calls.push('persist-cache'); }),
    persistSelection: jest.fn(async () => { calls.push('selection'); }),
    completeManual: jest.fn(async () => { calls.push('manual'); }),
  };
  return { calls, value: Object.assign(base, overrides) };
}

const request = {
  candidateId: 'candidate-1',
  storeId: 'store-1',
  jobId: 'job-1',
  claimAttempt: 1,
  claimWorker: 'metadata-worker-0001',
  claimLeaseToken: 'lease-token',
  query,
  providerPolicy: {
    enabled: true,
    adapterVersionCompatible: true,
    capabilityVersionCompatible: true,
    matchingAllowed: true,
    storageAllowed: true,
    reuseAllowed: true,
    pricingPolicyCompatible: true,
  },
};

describe('Phase 9 Unit 5B production metadata composition', () => {
  it('stops at a strong local match with zero provider/cost/attempt effects', async () => {
    const fixture = gateway({
      resolveLocal: jest.fn(async () => ({
        outcome: 'matched' as const,
        canonicalEditionId: 'edition-1',
      })),
    });
    await expect(runMetadataProductionComposition(request, fixture.value))
      .resolves.toEqual({ outcome: 'local_canonical_match' });
    expect(fixture.value.readCache).not.toHaveBeenCalled();
    expect(fixture.value.registerAttempt).not.toHaveBeenCalled();
    expect(fixture.value.reserveUsage).not.toHaveBeenCalled();
    expect(fixture.value.invokePrimary).not.toHaveBeenCalled();
  });

  it('stops at a compatible cache hit and a coalesced follower without duplicate charge', async () => {
    const cache = gateway({
      readCache: jest.fn(async () => ({ outcome: 'hit' as const, normalizedOutcome: 'no_acceptable_match' as const })),
    });
    await expect(runMetadataProductionComposition(request, cache.value))
      .resolves.toEqual({ outcome: 'manual_metadata_required' });
    expect(cache.value.completeCacheHit).toHaveBeenCalled();
    expect(cache.value.reserveUsage).not.toHaveBeenCalled();
    expect(cache.value.invokePrimary).not.toHaveBeenCalled();

    const follower = gateway({
      decideCoalescing: jest.fn(async () => ({ mode: 'follower' as const, leaderLookupId: 'leader-1' })),
    });
    await expect(runMetadataProductionComposition(request, follower.value))
      .resolves.toEqual({ outcome: 'coalesced_follower' });
    expect(follower.value.registerFollower).toHaveBeenCalledWith(
      request,
      'leader-1',
    );
    expect(follower.value.reserveUsage).not.toHaveBeenCalled();
    expect(follower.value.invokePrimary).not.toHaveBeenCalled();
  });

  it('completes a positive cache hit durably without provider work', async () => {
    const cache = gateway({
      readCache: jest.fn(async () => ({
        outcome: 'hit' as const,
        normalizedOutcome: 'coherent_match' as const,
      })),
    });
    await expect(runMetadataProductionComposition(request, cache.value))
      .resolves.toEqual({ outcome: 'accepted_metadata_match' });
    expect(cache.value.completeCacheHit).toHaveBeenCalled();
    expect(cache.value.invokePrimary).not.toHaveBeenCalled();
  });

  it('does not read provider cache when reuse policy is denied', async () => {
    const fixture = gateway();
    await expect(runMetadataProductionComposition({
      ...request,
      providerPolicy: { ...request.providerPolicy, reuseAllowed: false },
    }, fixture.value)).resolves.toEqual({ outcome: 'manual_metadata_required' });
    expect(fixture.value.readCache).not.toHaveBeenCalled();
    expect(fixture.value.invokePrimary).not.toHaveBeenCalled();
  });

  it('registers durable lineage and revalidates the fence before provider egress', async () => {
    const fixture = gateway();
    await runMetadataProductionComposition(request, fixture.value);
    expect(fixture.calls).toEqual([
      'local', 'cache', 'coalescing', 'lookup', 'reserve', 'attempt',
      'fence', 'provider', 'finalize', 'persist-cache', 'manual',
    ]);
  });

  it('makes zero provider calls after stale claim rejection', async () => {
    const fixture = gateway({
      validateEgress: jest.fn(async () => false),
    });
    await expect(runMetadataProductionComposition(request, fixture.value))
      .resolves.toEqual({ outcome: 'stale_claim' });
    expect(fixture.value.invokePrimary).not.toHaveBeenCalled();
    expect(fixture.value.finalizeAttempt).toHaveBeenCalledWith(expect.objectContaining({
      normalizedOutcome: 'policy_denied',
      disposition: 'stale_rejected',
    }));
  });

  it('persists one coherent accepted snapshot and never invokes a secondary', async () => {
    const selected: any = { providerRecordId: 'volume-1', attemptId: 'attempt-1' };
    const fixture = gateway({
      invokePrimary: jest.fn(async () => ({
        outcome: 'coherent_match' as const,
        candidates: [selected],
        selected,
        evidence: ['exact_validated_isbn'],
        retryable: false,
        providerRequestId: 'safe-request-id',
      })),
    });
    await expect(runMetadataProductionComposition(request, fixture.value))
      .resolves.toEqual({ outcome: 'accepted_metadata_match' });
    expect(fixture.value.persistSelection).toHaveBeenCalledWith(expect.objectContaining({
      selected,
      evidence: ['exact_validated_isbn'],
    }));
    expect(fixture.value.completeManual).not.toHaveBeenCalled();
  });

  it('fails closed when storage permission is absent', async () => {
    const selected: any = { providerRecordId: 'volume-1', attemptId: 'attempt-1' };
    const fixture = gateway({
      invokePrimary: jest.fn(async () => ({
        outcome: 'coherent_match' as const,
        candidates: [selected],
        selected,
        evidence: ['exact_validated_isbn'],
        retryable: false,
        providerRequestId: null,
      })),
    });
    await expect(runMetadataProductionComposition({
      ...request,
      providerPolicy: { ...request.providerPolicy, storageAllowed: false },
    }, fixture.value)).resolves.toEqual({ outcome: 'manual_metadata_required' });
    expect(fixture.value.persistCache).not.toHaveBeenCalled();
    expect(fixture.value.persistSelection).not.toHaveBeenCalled();
    expect(fixture.value.completeManual).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'policy_denied',
    }));
  });
});
