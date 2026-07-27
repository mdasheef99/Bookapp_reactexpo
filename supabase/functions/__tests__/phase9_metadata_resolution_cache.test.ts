import {
  createMetadataCacheEntry,
  evaluateMetadataCache,
  localCanonicalResolution,
  planMetadataFoundation,
  planIdenticalQueryReuse,
} from '../_shared/imageInventory/contracts';

const edition = {
  id: 'edition-1',
  isbn10: '0306406152',
  isbn13: '9780306406157',
  originalTitle: 'The Fixture Book',
  originalAuthors: ['Fixture Author'],
  language: 'en',
};
const expectedCacheIdentity = {
  key: 'cache-key',
  queryKey: 'query-key',
  adapterKey: 'recorded_metadata',
  adapterVersion: '1.0.0',
  capabilityVersion: 'cap-v1',
  normalizerVersion: 'normalizer-v1',
  schemaVersion: 'p9-metadata-v1',
  cachePolicyVersion: 'cache-v1',
  reusePolicyVersion: 'reuse-v1',
  privacyScope: 'public_bibliographic' as const,
  storeId: null,
};

describe('Phase 9 Unit 5A local resolution, cache, and coalescing', () => {
  it('resolves validated ISBN locally without provider reservation', () => {
    expect(localCanonicalResolution({
      isbnClue: '978-0-306-40615-7',
      title: 'Wrong OCR title',
      authors: [],
      language: 'en',
    }, [edition])).toEqual({
      outcome: 'local_canonical_match',
      canonicalEditionId: 'edition-1',
      evidence: 'validated_isbn',
      externalAttemptRequired: false,
      providerReservationRequired: false,
    });
  });

  it('uses exact normalized original title, author, and language only', () => {
    expect(localCanonicalResolution({
      isbnClue: null,
      title: ' the  fixture book ',
      authors: ['fixture author'],
      language: 'EN',
    }, [edition]).canonicalEditionId).toBe('edition-1');
    expect(localCanonicalResolution({
      isbnClue: null,
      title: 'Fixture',
      authors: ['Fixture Author'],
      language: 'en',
      aliasMatches: ['edition-1'],
      fuzzyMatches: ['edition-1'],
    }, [edition])).toMatchObject({
      outcome: 'external_lookup_required',
      canonicalEditionId: null,
    });
  });

  it('does not let an invalid ISBN establish identity', () => {
    expect(localCanonicalResolution({
      isbnClue: '9780306406158',
      title: 'Different',
      authors: ['Different'],
      language: 'en',
    }, [edition])).toMatchObject({
      outcome: 'external_lookup_required',
      canonicalEditionId: null,
    });
  });

  it('short-circuits local authority before cache and provider cost', () => {
    expect(planMetadataFoundation({
      isbnClue: '9780306406157',
      title: 'ignored',
      authors: [],
      language: 'en',
    }, [edition], null, '2026-07-28T00:00:00.000Z', expectedCacheIdentity)).toMatchObject({
      outcome: 'local_canonical_match',
      cacheStatus: 'not_checked',
      reserveProviderUsage: false,
    });
  });

  test.each(['positive', 'negative', 'ambiguous'] as const)(
    'returns a valid %s cache hit',
    (outcome) => {
      const entry = createMetadataCacheEntry({
        key: 'cache-key',
        queryKey: 'query-key',
        adapterKey: 'recorded_metadata',
        adapterVersion: '1.0.0',
        capabilityVersion: 'cap-v1',
        normalizerVersion: 'normalizer-v1',
        schemaVersion: 'p9-metadata-v1',
        cachePolicyVersion: 'cache-v1',
        reusePolicyVersion: 'reuse-v1',
        privacyScope: 'public_bibliographic',
        storeId: null,
        outcome,
        normalizedSnapshot: outcome === 'positive' ? { title: 'Fixture' } : null,
        provenance: { attemptId: 'attempt-1' },
        createdAt: '2026-07-28T00:00:00.000Z',
        expiresAt: '2026-07-29T00:00:00.000Z',
        invalidatedAt: null,
      });
      expect(evaluateMetadataCache(
        entry,
        '2026-07-28T12:00:00.000Z',
        expectedCacheIdentity,
      )).toEqual({
        status: 'hit',
        outcome,
        entry,
      });
    },
  );

  it('misses expired or invalidated cache entries', () => {
    const entry = createMetadataCacheEntry({
      key: 'cache-key',
      queryKey: 'query-key',
      adapterKey: 'recorded_metadata',
      adapterVersion: '1.0.0',
      capabilityVersion: 'cap-v1',
      normalizerVersion: 'normalizer-v1',
      schemaVersion: 'p9-metadata-v1',
      cachePolicyVersion: 'cache-v1',
      reusePolicyVersion: 'reuse-v1',
      privacyScope: 'public_bibliographic',
      storeId: null,
      outcome: 'negative',
      normalizedSnapshot: null,
      provenance: { attemptId: 'attempt-1' },
      createdAt: '2026-07-27T00:00:00.000Z',
      expiresAt: '2026-07-28T00:00:00.000Z',
      invalidatedAt: null,
    });
    expect(evaluateMetadataCache(
      entry,
      '2026-07-28T00:00:00.001Z',
      expectedCacheIdentity,
    ).status).toBe('expired');
    expect(evaluateMetadataCache(
      { ...entry, expiresAt: '2026-07-29T00:00:00.000Z', invalidatedAt: '2026-07-28T00:00:00.000Z' },
      '2026-07-28T00:00:00.001Z',
      expectedCacheIdentity,
    ).status).toBe('invalidated');
  });

  it('rejects an incompatible cache identity instead of returning a hit', () => {
    const entry = createMetadataCacheEntry({
      key: 'cache-key', queryKey: 'query-key', adapterKey: 'recorded_metadata',
      adapterVersion: '1.0.0', capabilityVersion: 'cap-v1',
      normalizerVersion: 'normalizer-v1', schemaVersion: 'p9-metadata-v1',
      cachePolicyVersion: 'cache-v1', reusePolicyVersion: 'reuse-v1',
      privacyScope: 'store_private', storeId: 'store-a', outcome: 'negative',
      normalizedSnapshot: null, provenance: { attemptId: 'attempt-1' },
      createdAt: '2026-07-27T00:00:00.000Z',
      expiresAt: '2026-07-29T00:00:00.000Z', invalidatedAt: null,
    });
    expect(evaluateMetadataCache(entry, '2026-07-28T00:00:00.000Z', {
      key: 'cache-key', queryKey: 'query-key', adapterKey: 'recorded_metadata',
      adapterVersion: '2.0.0', capabilityVersion: 'cap-v1',
      normalizerVersion: 'normalizer-v1', schemaVersion: 'p9-metadata-v1',
      cachePolicyVersion: 'cache-v1', reusePolicyVersion: 'reuse-v1',
      privacyScope: 'store_private', storeId: 'store-a',
    }).status).toBe('incompatible');
  });

  it('coalesces only an identical safe namespace and gives followers zero charge', () => {
    const leader = {
      lookupId: 'lookup-1',
      queryKey: 'query-1',
      providerCacheKey: 'provider-cache-1',
      routingPolicyVersion: 'routing-v1',
      privacyScope: 'public_bibliographic' as const,
      reusePolicyVersion: 'reuse-v1',
      cacheNamespace: 'metadata-v1',
      storeId: 'store-a',
    };
    expect(planIdenticalQueryReuse(leader, { ...leader, lookupId: 'lookup-2', storeId: 'store-b' }))
      .toEqual({
        mode: 'follower',
        leaderLookupId: 'lookup-1',
        createsProviderCharge: false,
      });
    expect(planIdenticalQueryReuse(leader, {
      ...leader,
      lookupId: 'lookup-3',
      privacyScope: 'store_private',
      storeId: 'store-b',
    })).toEqual({
      mode: 'leader',
      leaderLookupId: null,
      createsProviderCharge: true,
    });
  });
});
