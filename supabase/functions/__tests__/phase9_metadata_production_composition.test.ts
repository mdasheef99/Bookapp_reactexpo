import {
  decideMetadataProductionPolicy,
  runMetadataProductionComposition,
} from '../_shared/imageInventory/runtime/metadataProductionComposition';
import {
  metadataGateway as gateway,
  metadataRequest as request,
} from './support/phase9MetadataComposition';

describe('Phase 9 Unit 5B production metadata composition', () => {
  it('derives independent matching, reuse, storage, and cache-write decisions', () => {
    expect(decideMetadataProductionPolicy({
      ...request.providerPolicy,
      reuseAllowed: false,
    })).toEqual({
      allowCacheRead: false,
      allowFollowerReuse: false,
      allowFreshProviderCall: true,
      allowPositiveRetention: true,
      allowCacheWrite: false,
      requiredDegradationOutcome: 'policy_denied',
    });
    expect(decideMetadataProductionPolicy({
      ...request.providerPolicy,
      matchingAllowed: false,
    })).toEqual(expect.objectContaining({
      allowCacheRead: true,
      allowFollowerReuse: true,
      allowFreshProviderCall: false,
      allowPositiveRetention: true,
      allowCacheWrite: true,
    }));
    expect(decideMetadataProductionPolicy({
      ...request.providerPolicy,
      storageAllowed: false,
    })).toEqual(expect.objectContaining({
      allowCacheRead: true,
      allowFollowerReuse: true,
      allowFreshProviderCall: true,
      allowPositiveRetention: false,
      allowCacheWrite: true,
    }));
  });

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
      expect.objectContaining({
        allowFollowerReuse: true,
        allowPositiveRetention: true,
      }),
    );
    expect(follower.value.reserveUsage).not.toHaveBeenCalled();
    expect(follower.value.invokePrimary).not.toHaveBeenCalled();

    const positiveFollower = gateway({
      decideCoalescing: jest.fn(async () => (
        { mode: 'follower' as const, leaderLookupId: 'leader-2' }
      )),
      registerFollower: jest.fn(async () => ({
        status: 'completed' as const,
        normalizedOutcome: 'coherent_match',
      })),
    });
    await expect(runMetadataProductionComposition(request, positiveFollower.value))
      .resolves.toEqual({ outcome: 'accepted_metadata_match' });
    expect(positiveFollower.value.invokePrimary).not.toHaveBeenCalled();
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

  it('skips reuse but preserves fresh matching, fencing, and snapshot retention', async () => {
    const selected: any = { providerRecordId: 'volume-1', attemptId: 'attempt-1' };
    const fixture = gateway({
      invokePrimary: jest.fn(async () => (fixture.calls.push('provider'), {
        outcome: 'coherent_match' as const,
        candidates: [selected],
        selected,
        evidence: ['exact_validated_isbn'],
        retryable: false,
        providerRequestId: 'safe-request-id',
      })),
    });
    await expect(runMetadataProductionComposition({
      ...request,
      providerPolicy: { ...request.providerPolicy, reuseAllowed: false },
    }, fixture.value)).resolves.toEqual({ outcome: 'accepted_metadata_match' });
    expect(fixture.value.readCache).not.toHaveBeenCalled();
    expect(fixture.value.decideCoalescing).not.toHaveBeenCalled();
    expect(fixture.calls).toEqual([
      'local', 'lookup', 'reserve', 'attempt', 'fence', 'provider',
      'finalize', 'selection',
    ]);
    expect(fixture.value.persistCache).not.toHaveBeenCalled();
    expect(fixture.value.persistSelection).toHaveBeenCalledWith(expect.objectContaining({
      selected,
    }));
  });

  it('permits compatible cache reuse under matching denial but makes zero fresh calls', async () => {
    const fixture = gateway({
      readCache: jest.fn(async () => ({
        outcome: 'hit' as const,
        normalizedOutcome: 'coherent_match',
      })),
    });
    await expect(runMetadataProductionComposition({
      ...request,
      providerPolicy: { ...request.providerPolicy, matchingAllowed: false },
    }, fixture.value)).resolves.toEqual({ outcome: 'accepted_metadata_match' });
    expect(fixture.calls).toEqual(['local', 'complete-cache']);
    expect(fixture.value.registerLookup).not.toHaveBeenCalled();
    expect(fixture.value.invokePrimary).not.toHaveBeenCalled();
  });

  it('denies a fresh call after a cache miss when matching is denied', async () => {
    const fixture = gateway();
    await expect(runMetadataProductionComposition({
      ...request,
      providerPolicy: { ...request.providerPolicy, matchingAllowed: false },
    }, fixture.value)).resolves.toEqual({ outcome: 'manual_metadata_required' });
    expect(fixture.calls).toEqual(['local', 'cache', 'coalescing', 'manual']);
    expect(fixture.value.registerLookup).not.toHaveBeenCalled();
    expect(fixture.value.invokePrimary).not.toHaveBeenCalled();

    const noReuse = gateway();
    await runMetadataProductionComposition({
      ...request,
      providerPolicy: {
        ...request.providerPolicy,
        matchingAllowed: false,
        reuseAllowed: false,
        storageAllowed: false,
      },
    }, noReuse.value);
    expect(noReuse.calls).toEqual(['local', 'manual']);
    expect(noReuse.value.invokePrimary).not.toHaveBeenCalled();
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

  it('does not consume a positive cache hit when storage is denied and still permits fresh matching', async () => {
    const selected: any = { providerRecordId: 'volume-1', attemptId: 'attempt-1' };
    const fixture = gateway({
      readCache: jest.fn(async () => (fixture.calls.push('cache'), {
        outcome: 'hit' as const,
        normalizedOutcome: 'coherent_match',
      })),
      invokePrimary: jest.fn(async () => (fixture.calls.push('provider'), {
        outcome: 'coherent_match' as const,
        candidates: [selected],
        selected,
        evidence: ['exact_validated_isbn'],
        retryable: false,
        providerRequestId: 'safe-request-id',
      })),
    });
    await expect(runMetadataProductionComposition({
      ...request,
      providerPolicy: { ...request.providerPolicy, storageAllowed: false },
    }, fixture.value)).resolves.toEqual({ outcome: 'manual_metadata_required' });
    expect(fixture.value.completeCacheHit).not.toHaveBeenCalled();
    expect(fixture.calls).toEqual([
      'local', 'cache', 'coalescing', 'lookup', 'reserve', 'attempt',
      'fence', 'provider', 'finalize', 'manual',
    ]);
    expect(fixture.value.persistSelection).not.toHaveBeenCalled();
    expect(fixture.value.persistCache).not.toHaveBeenCalled();
  });

  it('degrades a positive follower completion when storage is denied', async () => {
    const fixture = gateway({
      decideCoalescing: jest.fn(async () => (
        fixture.calls.push('coalescing'),
        { mode: 'follower' as const, leaderLookupId: 'leader-1' }
      )),
      registerFollower: jest.fn(async () => {
        fixture.calls.push('follower');
        return {
          status: 'manual_degradation' as const,
          normalizedOutcome: 'coherent_match',
        };
      }),
    });
    await expect(runMetadataProductionComposition({
      ...request,
      providerPolicy: { ...request.providerPolicy, storageAllowed: false },
    }, fixture.value)).resolves.toEqual({ outcome: 'manual_metadata_required' });
    expect(fixture.calls).toEqual(['local', 'cache', 'coalescing', 'follower']);
    expect(fixture.value.persistSelection).not.toHaveBeenCalled();
    expect(fixture.value.invokePrimary).not.toHaveBeenCalled();
  });

  it('preserves non-positive cache completion when storage is denied', async () => {
    const fixture = gateway({
      readCache: jest.fn(async () => ({
        outcome: 'hit' as const,
        normalizedOutcome: 'ambiguous_match',
      })),
      completeCacheHit: jest.fn(async () => {
        fixture.calls.push('complete-cache');
        return {
          status: 'manual_degradation' as const,
          normalizedOutcome: 'ambiguous_match',
        };
      }),
    });
    await expect(runMetadataProductionComposition({
      ...request,
      providerPolicy: { ...request.providerPolicy, storageAllowed: false },
    }, fixture.value)).resolves.toEqual({ outcome: 'manual_metadata_required' });
    expect(fixture.value.completeCacheHit).toHaveBeenCalled();
    expect(fixture.value.invokePrimary).not.toHaveBeenCalled();
  });

  it('allows a fresh call without reuse or storage but retains no positive output', async () => {
    const selected: any = { providerRecordId: 'volume-1', attemptId: 'attempt-1' };
    const fixture = gateway({
      invokePrimary: jest.fn(async () => (fixture.calls.push('provider'), {
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
      providerPolicy: {
        ...request.providerPolicy,
        reuseAllowed: false,
        storageAllowed: false,
      },
    }, fixture.value)).resolves.toEqual({ outcome: 'manual_metadata_required' });
    expect(fixture.calls).toEqual([
      'local', 'lookup', 'reserve', 'attempt', 'fence', 'provider',
      'finalize', 'manual',
    ]);
    expect(fixture.value.persistCache).not.toHaveBeenCalled();
    expect(fixture.value.persistSelection).not.toHaveBeenCalled();
  });

  it('maps rejected reuse completion to a stale claim without provider egress', async () => {
    const fixture = gateway({
      completeCacheHit: jest.fn(async () => {
        fixture.calls.push('complete-cache');
        return {
          status: 'stale_rejected' as const,
          normalizedOutcome: 'coherent_match',
        };
      }),
      readCache: jest.fn(async () => ({
        outcome: 'hit' as const,
        normalizedOutcome: 'coherent_match',
      })),
    });
    await expect(runMetadataProductionComposition(request, fixture.value))
      .resolves.toEqual({ outcome: 'stale_claim' });
    expect(fixture.value.invokePrimary).not.toHaveBeenCalled();
  });
});
