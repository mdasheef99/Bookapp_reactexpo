import {
  decideMetadataProductionPolicy,
} from '../_shared/imageInventory/runtime/metadataProductionComposition';
import { runLegacyMetadataComposition as runMetadataProductionComposition, legacyMetadataCompositionStatus } from './support/providerModules';
import { automaticDependencies } from './support/automaticWorker';
import { GOOGLE_AUTOMATIC_V1, GOLDEN_CLOCK } from './fixtures/phase9/providerReplacementGoldens';
import { failClosedMetadataProviderOutcome } from '../_shared/imageInventory/metadata/providerAdapter';
import { GOOGLE_BOOKS_PROVIDER_VALIDATION } from '../_shared/imageInventory/metadata/googleBooks/validation';
import { metadataEdition, metadataGateway as gateway, metadataRequest as request }
  from './support/phase9MetadataComposition';

// The pure policy matrix always runs: it does not depend on the legacy worker
// entry, only on the policy export imported above.
describe('Phase 9 metadata production policy', () => {
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
});

// Legacy compatibility controls for the old worker shape. These cases keep the
// pre-8b observable selection/cache/cover outcomes green; they are not a
// fallback contract for the 8b automatic transaction, whose equivalent effects
// are asserted in the separate target describe below.
const legacyStatus = legacyMetadataCompositionStatus();
if (!legacyStatus.available) {
  it(`legacy metadata composition compatibility entry is unavailable: ${legacyStatus.reason}`, () => {
    expect(legacyStatus.available).toBe(false);
  });
} else {
describe('Phase 9 pre-8b production metadata composition controls (legacy worker shape)', () => {
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
    const selected = metadataEdition();
    const fixture = gateway({
      invokePrimary: jest.fn(async () => (fixture.calls.push('provider'), {
        outcome: 'coherent_match' as const,
        candidates: [selected],
        selected,
        evidence: ['exact_validated_isbn'],
        retryable: false,
        secondaryEligible: false,
        providerRequestId: 'safe-request-id',
      })),
    });
    await expect(runMetadataProductionComposition({
      ...request,
      providerPolicy: { ...request.providerPolicy, reuseAllowed: false },
    }, fixture.value)).resolves.toEqual({ outcome: 'accepted_metadata_match' });
    expect(fixture.value.readCache).not.toHaveBeenCalled();
    expect(fixture.value.decideCoalescing).not.toHaveBeenCalled();
    expect(fixture.value.invokePrimary).toHaveBeenCalledTimes(1);
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
    expect(fixture.value.readCache).toHaveBeenCalled();
    expect(fixture.value.completeCacheHit).toHaveBeenCalled();
    expect(fixture.value.registerLookup).not.toHaveBeenCalled();
    expect(fixture.value.invokePrimary).not.toHaveBeenCalled();
  });

  it('denies a fresh call after a cache miss when matching is denied', async () => {
    const fixture = gateway();
    await expect(runMetadataProductionComposition({
      ...request,
      providerPolicy: { ...request.providerPolicy, matchingAllowed: false },
    }, fixture.value)).resolves.toEqual({ outcome: 'manual_metadata_required' });
    expect(fixture.value.completeManual).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'policy_denied', retryable: false,
    }));
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
    expect(noReuse.value.completeManual).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'policy_denied', retryable: false,
    }));
    expect(noReuse.value.invokePrimary).not.toHaveBeenCalled();
  });

  it('registers durable lineage and revalidates the fence before provider egress', async () => {
    const fixture = gateway();
    await runMetadataProductionComposition(request, fixture.value);
    expect(fixture.value.registerLookup).toHaveBeenCalledTimes(1);
    expect(fixture.value.reserveUsage).toHaveBeenCalledTimes(1);
    expect(fixture.value.registerAttempt).toHaveBeenCalledTimes(1);
    expect(fixture.value.validateEgress).toHaveBeenCalledTimes(1);
    expect(fixture.value.invokePrimary).toHaveBeenCalledTimes(1);
    expect(fixture.value.finalizeAttempt).toHaveBeenCalledTimes(1);
    expect(fixture.value.completeManual).toHaveBeenCalledTimes(1);
    expect(fixture.value.persistCache).toHaveBeenCalledTimes(1);
  });

  it('reports a retry when the durable completion schedules one', async () => {
    const fixture = gateway({
      invokePrimary: jest.fn(async () => {
        throw new Error('controlled provider failure');
      }),
      completeManual: jest.fn(async () => ({
        status: 'retry_scheduled' as const,
      })) as any,
    });

    await expect(runMetadataProductionComposition(request, fixture.value))
      .resolves.toEqual({ outcome: 'retry_scheduled' });
    expect(fixture.value.completeManual).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'provider_unavailable', retryable: true,
    }));
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
    const selected = metadataEdition();
    const fixture = gateway({
      invokePrimary: jest.fn(async () => {
        fixture.calls.push('provider');
        return {
          outcome: 'coherent_match' as const,
          candidates: [selected],
          selected,
          evidence: ['exact_validated_isbn'],
          retryable: false,
          secondaryEligible: false,
          providerRequestId: 'safe-request-id',
        };
      }),
    });
    await expect(runMetadataProductionComposition(request, fixture.value))
      .resolves.toEqual({ outcome: 'accepted_metadata_match' });
    expect(fixture.value.persistSelection).toHaveBeenCalledWith(expect.objectContaining({
      selected,
      evidence: ['exact_validated_isbn'],
    }));
    expect(fixture.value.completeManual).not.toHaveBeenCalled();
    expect(fixture.value.invokePrimary).toHaveBeenCalledTimes(1);
    expect(fixture.value.persistCache).toHaveBeenCalledTimes(1);
  });

  it('persists a representative cover before selection and degrades safely if that optional write fails', async () => {
    const selected = metadataEdition({ providerRecordId: 'selected', coverReference: null });
    const representativeCover = {
      coverReference: 'https://books.google.com/books/content?id=alternate',
      sourceRelation: 'representative_edition' as const,
      sourceProviderRecordId: 'alternate',
      selectionPolicyVersion: 'p9-representative-cover-v1' as const,
      matchEvidence: ['exact_title', 'exact_author_set', 'language_compatible'],
    };
    const fixture = gateway({
      providerValidation: {
        adapterKey: 'recorded_metadata', adapterVersion: '1.0.0',
        hostPolicy: {
          adapterKey: 'recorded_metadata', policyVersion: 'recorded-hosts-v1',
          approvedCoverHosts: ['books.google.com'],
        },
      },
      invokePrimary: jest.fn(async () => ({
        outcome: 'coherent_match' as const,
        candidates: [selected, metadataEdition({
          providerRecordId: 'alternate', isbn10: null, isbn13: null,
          coverReference: representativeCover.coverReference,
        })],
        selected, representativeCover, evidence: ['exact_validated_isbn'],
        retryable: false, secondaryEligible: false, providerRequestId: 'safe-request-id',
      })),
      persistRepresentativeCover: jest.fn(async () => {
        fixture.calls.push('representative-cover');
        throw new Error('https://token:secret@example.invalid/private-cover?signature=redact-me');
      }),
    });
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await expect(runMetadataProductionComposition(request, fixture.value))
        .resolves.toEqual({ outcome: 'accepted_metadata_match' });
      expect(fixture.value.persistRepresentativeCover).toHaveBeenCalledWith({
        lookupId: 'lookup-1', attemptId: 'attempt-1', representativeCover,
      });
      expect(fixture.value.persistSelection).toHaveBeenCalledTimes(1);
      expect(warning).toHaveBeenCalledWith(
        '[phase9] representative-cover persistence failed',
        {
          lookupId: 'lookup-1', attemptId: 'attempt-1',
          errorCode: 'P9_REPRESENTATIVE_COVER_PERSISTENCE_FAILED',
        },
      );
      expect(JSON.stringify(warning.mock.calls[0])).not.toContain('redact-me');
    } finally {
      warning.mockRestore();
    }
  });

  it('resumes a durably finalized logical attempt without another physical call', async () => {
    const fixture = gateway({
      resumeFinalizedAttempt: jest.fn(async () => ({ outcome: 'accepted_metadata_match' })),
    });
    await expect(runMetadataProductionComposition(request, fixture.value))
      .resolves.toEqual({ outcome: 'accepted_metadata_match' });
    expect(fixture.value.resumeFinalizedAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ lookupId: 'lookup-1', attemptId: 'attempt-1' }),
    );
    expect(fixture.value.validateEgress).not.toHaveBeenCalled();
    expect(fixture.value.invokePrimary).not.toHaveBeenCalled();
    expect(fixture.value.finalizeAttempt).not.toHaveBeenCalled();
  });

  it('does not strand a terminal accepted match when cache persistence fails', async () => {
    const selected = metadataEdition();
    const fixture = gateway({
      invokePrimary: jest.fn(async () => ({
        outcome: 'coherent_match' as const,
        candidates: [selected], selected,
        evidence: ['exact_validated_isbn'], retryable: false,
        secondaryEligible: false,
        providerRequestId: 'safe-request-id',
      })),
      persistCache: jest.fn(async () => {
        fixture.calls.push('persist-cache');
        throw new Error('cache unavailable');
      }),
    });
    await expect(runMetadataProductionComposition(request, fixture.value))
      .resolves.toEqual({ outcome: 'accepted_metadata_match' });
    expect(fixture.value.persistSelection).toHaveBeenCalledTimes(1);
    expect(fixture.value.persistCache).toHaveBeenCalledTimes(1);
  });

  it('fails closed when storage permission is absent', async () => {
    const selected = metadataEdition();
    const fixture = gateway({
      invokePrimary: jest.fn(async () => ({
        outcome: 'coherent_match' as const,
        candidates: [selected],
        selected,
        evidence: ['exact_validated_isbn'],
        retryable: false,
        secondaryEligible: false,
        providerRequestId: null,
      })),
    });
    await expect(runMetadataProductionComposition({
      ...request,
      providerPolicy: { ...request.providerPolicy, storageAllowed: false },
    }, fixture.value)).resolves.toEqual({ outcome: 'manual_metadata_required' });
    expect(fixture.value.persistCache).not.toHaveBeenCalled();
    expect(fixture.value.persistSelection).not.toHaveBeenCalled();
    expect(fixture.value.finalizeAttempt).toHaveBeenCalledWith(expect.objectContaining({
      normalizedOutcome: 'coherent_match',
      logicalOutcome: 'policy_denied',
      disposition: 'rejected',
      normalizedCandidate: null,
      retryable: false,
    }));
    expect(fixture.value.completeManual).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'policy_denied',
    }));
  });

  it.each([
    { outcome: 'coherent_match', selected: null, candidates: [] },
    { outcome: 'no_acceptable_match', selected: { providerRecordId: 'bad', attemptId: 'attempt-1' }, candidates: [] },
    { outcome: 'coherent_match', selected: {}, candidates: [{}] },
  ])('fails malformed provider outcome combinations closed as schema_invalid', async (malformed) => {
    const fixture = gateway({
      invokePrimary: jest.fn(async () => ({
        ...malformed,
        evidence: [], retryable: false, secondaryEligible: true, providerRequestId: null,
      } as any)),
    });
    await expect(runMetadataProductionComposition(request, fixture.value))
      .resolves.toEqual({ outcome: 'manual_metadata_required' });
    expect(fixture.value.finalizeAttempt).toHaveBeenCalledWith(expect.objectContaining({
      normalizedOutcome: 'schema_invalid', disposition: 'rejected',
      normalizedCandidate: null, retryable: false,
    }));
    expect(fixture.value.persistSelection).not.toHaveBeenCalled();
  });

  it.each([null, {}, { outcome: 'unknown', candidates: [], selected: null,
    evidence: [], retryable: false, secondaryEligible: false, providerRequestId: null },
  { outcome: 'coherent_match', candidates: [{ providerRecordId: 'v', attemptId: 'a' }],
    selected: { providerRecordId: 'v', attemptId: 'a' }, evidence: [], retryable: true,
    secondaryEligible: false, providerRequestId: null },
  { outcome: 'timeout', candidates: [], selected: null, evidence: [], retryable: true,
    secondaryEligible: false, providerRequestId: 'unsafe request id' }])(
    'normalizes hostile provider value %p to non-retryable schema_invalid', async (value) => {
      const fixture = gateway({ invokePrimary: jest.fn(async () => value as any) });
      await runMetadataProductionComposition(request, fixture.value);
      expect(fixture.value.finalizeAttempt).toHaveBeenCalledWith(expect.objectContaining({
        normalizedOutcome: 'schema_invalid',retryable: false,normalizedCandidate: null,
      }));
    },
  );

  it('does not consume a positive cache hit when storage is denied and still permits fresh matching', async () => {
    const selected = metadataEdition();
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
        secondaryEligible: false,
        providerRequestId: 'safe-request-id',
      })),
    });
    await expect(runMetadataProductionComposition({
      ...request,
      providerPolicy: { ...request.providerPolicy, storageAllowed: false },
    }, fixture.value)).resolves.toEqual({ outcome: 'manual_metadata_required' });
    expect(fixture.value.completeCacheHit).not.toHaveBeenCalled();
    expect(fixture.value.invokePrimary).toHaveBeenCalledTimes(1);
    expect(fixture.value.completeManual).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'policy_denied', retryable: false,
    }));
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
    expect(fixture.value.registerFollower).toHaveBeenCalledWith(
      expect.objectContaining({ providerPolicy: expect.objectContaining({ storageAllowed: false }) }),
      'leader-1', expect.objectContaining({ allowFollowerReuse: true }),
    );
    expect(fixture.value.persistSelection).not.toHaveBeenCalled();
    expect(fixture.value.invokePrimary).not.toHaveBeenCalled();
  });

  it.each(['ambiguous_match', 'timeout'])(
    'degrades completed non-positive cache outcome %s when storage is denied',
    async (normalizedOutcome) => {
    const fixture = gateway({
      readCache: jest.fn(async () => ({
        outcome: 'hit' as const,
        normalizedOutcome,
      })),
      completeCacheHit: jest.fn(async () => {
        fixture.calls.push('complete-cache');
        return {
          status: 'completed' as const,
          normalizedOutcome,
        };
      }),
    });
    await expect(runMetadataProductionComposition({
      ...request,
      providerPolicy: { ...request.providerPolicy, storageAllowed: false },
    }, fixture.value)).resolves.toEqual({ outcome: 'manual_metadata_required' });
    expect(fixture.value.completeCacheHit).toHaveBeenCalled();
    expect(fixture.value.invokePrimary).not.toHaveBeenCalled();
    },
  );

  it('allows a fresh call without reuse or storage but retains no positive output', async () => {
    const selected = metadataEdition();
    const fixture = gateway({
      invokePrimary: jest.fn(async () => (fixture.calls.push('provider'), {
        outcome: 'coherent_match' as const,
        candidates: [selected],
        selected,
        evidence: ['exact_validated_isbn'],
        retryable: false,
        secondaryEligible: false,
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
    expect(fixture.value.invokePrimary).toHaveBeenCalledTimes(1);
    expect(fixture.value.completeManual).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'policy_denied', retryable: false,
    }));
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
}

// The new automatic entry is the runnable worker + M92 RPC. Legacy unit
// composition above retains its own port; no optional transaction fallback is
// required to satisfy both contracts (02c ??4.3/5.1, runbook ?2).
describe('Phase 9 8b automatic completion transaction through the worker', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(Date.parse(GOLDEN_CLOCK)); });
  afterEach(() => jest.useRealTimers());

  it('commits a valid external automatic success through the transaction RPC', async () => {
    const subject = automaticDependencies();
    await expect(subject.run()).resolves.toMatchObject({ results: [{ outcome: 'accepted_metadata_match' }] });
    expect(subject.command()?.result).toEqual({
      version: 'p9-metadata-result-v2', purpose: 'automatic',
      outcome: GOOGLE_AUTOMATIC_V1, rows: null, catalogueCompanions: null, retention: null,
    });
    expect(subject.fixture.calls.filter(call => call.name === 'phase9_select_structural_metadata_snapshot'))
      .toEqual([]);
  });

  it('carries a valid representative cover and its alternate source inside the transaction', async () => {
    // Use the real Google decoder/ranker. The ISBN winner has no cover; its
    // same-identity alternate has a cover and weaker secondary evidence.
    const subject = automaticDependencies({ fetcher: async () => new Response(JSON.stringify({
      kind: 'books#volumes', totalItems: 2, items: [
        { id: 'winner', volumeInfo: { title: 'The Fixture Book', authors: ['Fixture Author'],
          language: 'en', industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780306406157' }] } },
        { id: 'alternate', volumeInfo: { title: 'The Fixture Book', authors: ['Fixture Author'],
          language: 'en', imageLinks: { thumbnail: 'https://books.google.com/books/content?id=alternate' } } },
      ],
    }), { headers: { 'content-type': 'application/json' } }) });
    await expect(subject.run()).resolves.toMatchObject({ results: [{ outcome: 'accepted_metadata_match' }] });
    const outcome = subject.command()?.result.outcome;
    expect(outcome).toBeDefined();
    expect(outcome.representativeCover).toMatchObject({ sourceProviderRecordId: 'alternate' });
    expect(outcome.candidates).toEqual(expect.arrayContaining([expect.objectContaining({
      providerRecordId: 'alternate', coverReference: outcome.representativeCover.coverReference,
    })]));
    expect(failClosedMetadataProviderOutcome(outcome, {
      correlationId: subject.command()!.lookupId, attemptId: subject.command()!.attemptId,
      adapterKey: 'google_books', adapterVersion: '1.0.0',
      hostPolicy: GOOGLE_BOOKS_PROVIDER_VALIDATION.hostPolicy,
    })).toEqual(outcome);
    expect(subject.fixture.calls.map(call => call.name)).not.toContain('phase9_store_metadata_representative_cover_v1');
    expect(subject.fixture.calls.map(call => call.name)).not.toContain('phase9_select_structural_metadata_snapshot');
  });

  it('fails closed when the transaction RPC is unavailable after a valid provider result', async () => {
    const subject = automaticDependencies({ rpc: async name => name === 'phase9_complete_automatic_metadata_v1'
      ? { data: null, error: { message: 'fixture transaction unavailable' } } : undefined });
    const result = await subject.run();
    // This positive assertion prevents a legacy-parser schema rejection from
    // masquerading as transaction refusal.
    expect(subject.command()?.result.outcome).toEqual(GOOGLE_AUTOMATIC_V1);
    expect(result.results[0].outcome).not.toBe('accepted_metadata_match');
    const names = subject.fixture.calls.map(call => call.name);
    expect(names).not.toContain('phase9_select_structural_metadata_snapshot');
    expect(names).not.toContain('phase9_store_metadata_cache');
    expect(names).not.toContain('phase9_store_metadata_representative_cover_v1');
  });
});
