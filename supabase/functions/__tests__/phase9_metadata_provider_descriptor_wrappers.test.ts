// U1 fix pass 1: descriptor wrappers and the strict result boundary.
// The Google cases use the real adapter with fixture-only HTTP; the verifier
// spy proves the wrapper consumes actual response headers rather than a
// prebuilt adapter result.
import {
  GOOGLE_AUTOMATIC_V1,
  GOOGLE_EXPLICIT_V1,
  GOLDEN_ATTEMPT_ID,
  GOLDEN_CLOCK,
  GOLDEN_LOOKUP_ID,
  OL_V1_EXPLICIT_V1,
} from './fixtures/phase9/providerReplacementGoldens';
import { tenPositions } from './fixtures/phase9/editionOptionsWorker';
import { googleBooksMultipleVolumes } from './fixtures/phase9/googleBooksResponses';
import { withUuidSequence } from './support/captureProviderGoldens';
import { buildMetadataQueryIdentity } from '../_shared/imageInventory/metadata/queryIdentity';
import { GoogleBooksAdapter } from '../_shared/imageInventory/metadata/googleBooks/adapter';
import { createGoogleBooksDescriptor } from '../_shared/imageInventory/metadata/googleBooks/descriptor';
import { OpenLibraryEditionOptionsAdapter } from '../_shared/imageInventory/metadata/openLibrary/adapter';
import { createOpenLibraryV1Descriptor } from '../_shared/imageInventory/metadata/openLibrary/descriptor';
import {
  PROVIDER_RESULT_VERSION,
  providerManifestKey,
} from '../_shared/imageInventory/metadata/providerDescriptor';
import { validateMetadataResultV2 } from '../_shared/imageInventory/metadata/providerResult';

type AnyModule = Record<string, any>;
type Context = Record<string, unknown>;

function loadOptional(path: string): AnyModule | null {
  try {
    return require(path) as AnyModule;
  } catch (error) {
    if ((error as { code?: string })?.code === 'MODULE_NOT_FOUND') return null;
    throw error;
  }
}

const providerValidationModule = loadOptional(
  '../_shared/imageInventory/metadata/providerValidation',
);

function installedValidationFor(descriptor: any): any {
  const lookup = providerValidationModule?.installedProviderValidation;
  if (typeof lookup !== 'function') {
    throw new Error('P9_PROVIDER_VALIDATION_MODULE_MISSING');
  }
  const validation = lookup(
    descriptor.adapterKey,
    descriptor.adapterVersion,
    descriptor.validationContract,
    descriptor.hostPolicyVersion,
  );
  if (!validation) throw new Error('P9_PROVIDER_VALIDATION_MISSING');
  return validation;
}

function installedMap(descriptor: any): ReadonlyMap<string, any> {
  return new Map([[
    providerManifestKey(descriptor.adapterKey, descriptor.adapterVersion),
    descriptor,
  ]]);
}

// The historical adapterKey/adapterVersion/retentionContract fields are
// deliberately present so the pre-fix validator can execute; the fixed
// validator never reads them.
function contextFor(descriptor: any, overrides: Record<string, unknown> = {}): Context {
  return {
    purpose: overrides.purpose ?? descriptor.purposes[0],
    descriptor,
    installed: installedMap(descriptor),
    providerValidation: installedValidationFor(descriptor),
    lookupId: overrides.lookupId ?? GOLDEN_LOOKUP_ID,
    attemptId: overrides.attemptId ?? GOLDEN_ATTEMPT_ID,
    now: overrides.now ?? GOLDEN_CLOCK,
    retentionEvidence: overrides.retentionEvidence ?? null,
    adapterKey: descriptor.adapterKey,
    adapterVersion: descriptor.adapterVersion,
    retentionContract: descriptor.retentionContract,
  };
}

const query = buildMetadataQueryIdentity({
  strategy: 'bibliographic',
  isbnClue: '9780306406157',
  title: 'The Fixture Book',
  authors: ['Fixture Author'],
  language: 'en',
  editionClues: [],
});

const jsonResponse = (body: unknown, headers: Record<string, string> = {}) => new Response(
  JSON.stringify(body),
  { headers: { 'content-type': 'application/json', ...headers } },
);

const googleOptionIds = Array.from({ length: 10 }, (_, index) =>
  `33333333-3333-4333-8333-${String(index + 1).padStart(12, '0')}`);
const openLibraryOptionIds = Array.from({ length: 10 }, (_, index) =>
  `44444444-4444-4444-8333-${String(index + 1).padStart(12, '0')}`);

const explicitGoogleEnvelope = (retentionPolicyVersion = 1) => ({
  version: PROVIDER_RESULT_VERSION,
  purpose: 'edition_options',
  outcome: {
    outcome: 'coherent_match',
    candidates: [GOOGLE_EXPLICIT_V1.rows[0].metadata],
    selected: GOOGLE_EXPLICIT_V1.rows[0].metadata,
    evidence: ['exact_validated_isbn'],
    retryable: false,
    secondaryEligible: false,
    providerRequestId: 'golden-google-explicit-request',
    representativeCover: null,
  },
  rows: GOOGLE_EXPLICIT_V1.rows,
  catalogueCompanions: [],
  retention: {
    sourceFetchedAt: GOOGLE_EXPLICIT_V1.fetchedAt,
    permittedDeadlineAt: GOOGLE_EXPLICIT_V1.retentionEvidence.permittedDeadlineAt,
    policyVersion: retentionPolicyVersion,
    storagePermissionVerified: true,
    retentionContract: 'google-books-options-v1',
  },
});

const explicitOpenLibraryEnvelope = () => ({
  version: PROVIDER_RESULT_VERSION,
  purpose: 'edition_options',
  outcome: {
    outcome: 'coherent_match',
    candidates: [OL_V1_EXPLICIT_V1.rows[0].metadata],
    selected: OL_V1_EXPLICIT_V1.rows[0].metadata,
    evidence: ['exact_validated_isbn'],
    retryable: false,
    secondaryEligible: false,
    providerRequestId: null,
    representativeCover: null,
  },
  rows: OL_V1_EXPLICIT_V1.rows,
  catalogueCompanions: OL_V1_EXPLICIT_V1.catalogueCompanions,
  retention: {
    sourceFetchedAt: OL_V1_EXPLICIT_V1.fetchedAt,
    permittedDeadlineAt: OL_V1_EXPLICIT_V1.retentionEvidence.permittedDeadlineAt,
    policyVersion: 1,
    storagePermissionVerified: true,
    retentionContract: 'open-library-options-v1',
  },
});

const evidenceFrom = (retention: Record<string, any>) => ({
  sourceFetchedAt: retention.sourceFetchedAt,
  permittedDeadlineAt: retention.permittedDeadlineAt,
  policyVersion: retention.policyVersion,
  retentionContract: retention.retentionContract,
});

const openLibraryFixtureFetcher = async (address: string | URL | Request) => {
  const url = new URL(address instanceof Request ? address.url : String(address));
  if (url.pathname === '/search.json') return jsonResponse({ docs: [{ key: '/works/OL1W' }] });
  if (url.pathname === '/works/OL1W/editions.json') return jsonResponse({
    entries: [{
      key: '/books/OL100M',
      title: 'The Fixture Book',
      authors: [{ key: '/authors/OL1A' }],
      languages: [{ key: '/languages/eng' }],
      isbn_10: ['0306406152'],
      isbn_13: ['9780306406157'],
      publish_date: '2024-03',
      publishers: ['Fixture Press'],
      covers: [123],
    }],
  });
  if (url.pathname === '/authors/OL1A.json') return jsonResponse({
    key: '/authors/OL1A', name: 'Fixture Author',
  });
  return jsonResponse({});
};

describe('Phase 9 U1 Google descriptor automatic wrapper', () => {
  it('calls lookup exactly once and keeps the captured parsed outcome', async () => {
    jest.useFakeTimers(); jest.setSystemTime(Date.parse(GOLDEN_CLOCK));
    try {
      const adapter = new GoogleBooksAdapter({
        mode: 'real', apiKey: 'fixture-only-no-network', timeoutMs: 1_000,
        maxResponseBytes: 64_000,
        fetcher: async () => jsonResponse(googleBooksMultipleVolumes, {
          'x-request-id': 'golden-google-automatic-request',
        }),
      });
      const lookup = jest.spyOn(adapter, 'lookup');
      const descriptor = createGoogleBooksDescriptor({ adapter });
      const result = await descriptor.invoke({
        query, correlationId: GOLDEN_LOOKUP_ID, attemptId: GOLDEN_ATTEMPT_ID,
        signal: new AbortController().signal, purpose: 'automatic',
        http: { get: async () => { throw new Error('unexpected port call'); } },
      });
      expect(lookup).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        version: PROVIDER_RESULT_VERSION,
        purpose: 'automatic',
        outcome: GOOGLE_AUTOMATIC_V1,
        rows: null,
        catalogueCompanions: null,
        retention: null,
      });
    } finally { jest.useRealTimers(); }
  });

  it('preserves schema_invalid when the legacy parser rejects the adapter request id', async () => {
    jest.useFakeTimers(); jest.setSystemTime(Date.parse(GOLDEN_CLOCK));
    try {
      const adapter = new GoogleBooksAdapter({
        mode: 'real', apiKey: 'fixture-only-no-network', timeoutMs: 1_000,
        maxResponseBytes: 64_000,
        fetcher: async () => jsonResponse(googleBooksMultipleVolumes, {
          'x-request-id': 'not a legal request id!',
        }),
      });
      const lookup = jest.spyOn(adapter, 'lookup');
      const descriptor = createGoogleBooksDescriptor({ adapter });
      const result = await descriptor.invoke({
        query, correlationId: GOLDEN_LOOKUP_ID, attemptId: GOLDEN_ATTEMPT_ID,
        signal: new AbortController().signal, purpose: 'automatic',
        http: { get: async () => { throw new Error('unexpected port call'); } },
      });
      expect(lookup).toHaveBeenCalledTimes(1);
      expect(result.outcome).toEqual({
        outcome: 'schema_invalid', candidates: [], selected: null, evidence: [],
        retryable: false, secondaryEligible: true, providerRequestId: null,
        representativeCover: null,
      });
      expect(result.rows).toBeNull();
      expect(result.retention).toBeNull();
      expect(() => validateMetadataResultV2(result, contextFor(descriptor, {
        purpose: 'automatic',
      }))).not.toThrow();
    } finally { jest.useRealTimers(); }
  });
});

describe('Phase 9 U1 Google descriptor explicit wrapper', () => {
  it('preserves the verified golden and calls the verifier with real response headers', async () => {
    jest.useFakeTimers(); jest.setSystemTime(Date.parse(GOLDEN_CLOCK));
    try {
      const verifier = jest.fn(({ fetchedAt }: { fetchedAt: string }) => ({
        storagePermissionVerified: true as const,
        permittedDeadlineAt: new Date(Date.parse(fetchedAt) + 3_600_000).toISOString(),
      }));
      const adapter = new GoogleBooksAdapter({
        mode: 'real', apiKey: 'fixture-only-no-network', timeoutMs: 1_000,
        maxResponseBytes: 64_000, verifyOptionsRetention: verifier,
        fetcher: async () => jsonResponse(tenPositions, {
          'cache-control': 'private, max-age=3600',
          'x-request-id': 'golden-google-explicit-request',
        }),
      });
      const descriptor = createGoogleBooksDescriptor({
        adapter, retentionPolicyVersion: 1,
      });
      const result = await withUuidSequence(googleOptionIds, () => descriptor.invoke({
        query, correlationId: GOLDEN_LOOKUP_ID, attemptId: GOLDEN_ATTEMPT_ID,
        signal: new AbortController().signal, purpose: 'edition_options',
        http: { get: async () => { throw new Error('unexpected port call'); } },
      }));
      expect(verifier).toHaveBeenCalledTimes(1);
      expect(verifier.mock.calls[0][0]).toEqual({
        fetchedAt: GOLDEN_CLOCK,
        cacheControl: 'private, max-age=3600',
        expires: null,
        responseDate: null,
        age: null,
      });
      expect(result.outcome).toEqual({
        outcome: 'coherent_match',
        candidates: GOOGLE_EXPLICIT_V1.rows.flatMap((row) =>
          row.metadata === null ? [] : [row.metadata]),
        selected: GOOGLE_EXPLICIT_V1.rows[0].metadata,
        evidence: ['exact_validated_isbn'],
        retryable: false,
        secondaryEligible: false,
        providerRequestId: 'golden-google-explicit-request',
        representativeCover: null,
      });
      expect(result.rows).toEqual(GOOGLE_EXPLICIT_V1.rows);
      expect(result.catalogueCompanions).toEqual([]);
      expect(result.retention).toEqual({
        sourceFetchedAt: GOLDEN_CLOCK,
        permittedDeadlineAt: '2026-11-02T13:00:00.000Z',
        policyVersion: 1,
        storagePermissionVerified: true,
        retentionContract: 'google-books-options-v1',
      });
      expect(() => validateMetadataResultV2(result, contextFor(descriptor, {
        purpose: 'edition_options',
        retentionEvidence: evidenceFrom(result.retention!),
      }))).not.toThrow();
    } finally { jest.useRealTimers(); }
  });

  it('denies retention when no verifier is installed', async () => {
    jest.useFakeTimers(); jest.setSystemTime(Date.parse(GOLDEN_CLOCK));
    try {
      const adapter = new GoogleBooksAdapter({
        mode: 'real', apiKey: 'fixture-only-no-network', timeoutMs: 1_000,
        maxResponseBytes: 64_000,
        fetcher: async () => jsonResponse(tenPositions, {
          'x-request-id': 'golden-google-explicit-request',
        }),
      });
      const descriptor = createGoogleBooksDescriptor({
        adapter, retentionPolicyVersion: 1,
      });
      const result = await withUuidSequence(googleOptionIds, () => descriptor.invoke({
        query, correlationId: GOLDEN_LOOKUP_ID, attemptId: GOLDEN_ATTEMPT_ID,
        signal: new AbortController().signal, purpose: 'edition_options',
        http: { get: async () => { throw new Error('unexpected port call'); } },
      }));
      expect(result.retention).toBeNull();
      expect(result.rows).toBeNull();
      expect(result.catalogueCompanions).toBeNull();
      expect(result.outcome.outcome).toBe('coherent_match');
      expect(descriptor.retentionContract).toBeNull();
      expect(descriptor.retentionReady('edition_options')).toBe(false);
    } finally { jest.useRealTimers(); }
  });

  it('denies a list whose actual headers say no-store', async () => {
    jest.useFakeTimers(); jest.setSystemTime(Date.parse(GOLDEN_CLOCK));
    try {
      const adapter = new GoogleBooksAdapter({
        mode: 'real', apiKey: 'fixture-only-no-network', timeoutMs: 1_000,
        maxResponseBytes: 64_000,
        verifyOptionsRetention: ({ fetchedAt }) => ({
          storagePermissionVerified: true,
          permittedDeadlineAt: new Date(Date.parse(fetchedAt) + 3_600_000).toISOString(),
        }),
        fetcher: async () => jsonResponse(tenPositions, {
          'cache-control': 'no-store',
          'x-request-id': 'golden-google-explicit-request',
        }),
      });
      const descriptor = createGoogleBooksDescriptor({
        adapter, retentionPolicyVersion: 1,
      });
      const result = await withUuidSequence(googleOptionIds, () => descriptor.invoke({
        query, correlationId: GOLDEN_LOOKUP_ID, attemptId: GOLDEN_ATTEMPT_ID,
        signal: new AbortController().signal, purpose: 'edition_options',
        http: { get: async () => { throw new Error('unexpected port call'); } },
      }));
      expect(result.retention).toBeNull();
      expect(result.rows).toBeNull();
      expect(result.catalogueCompanions).toBeNull();
    } finally { jest.useRealTimers(); }
  });

  it('shortens the deadline from the actual response max-age and age', async () => {
    jest.useFakeTimers(); jest.setSystemTime(Date.parse(GOLDEN_CLOCK));
    try {
      const adapter = new GoogleBooksAdapter({
        mode: 'real', apiKey: 'fixture-only-no-network', timeoutMs: 1_000,
        maxResponseBytes: 64_000,
        verifyOptionsRetention: ({ fetchedAt }) => ({
          storagePermissionVerified: true,
          permittedDeadlineAt: new Date(Date.parse(fetchedAt) + 86_400_000).toISOString(),
        }),
        fetcher: async () => jsonResponse(tenPositions, {
          'cache-control': 'private, max-age=60',
          'date': GOLDEN_CLOCK,
          'age': '30',
          'x-request-id': 'golden-google-explicit-request',
        }),
      });
      const descriptor = createGoogleBooksDescriptor({
        adapter, retentionPolicyVersion: 1,
      });
      const result = await withUuidSequence(googleOptionIds, () => descriptor.invoke({
        query, correlationId: GOLDEN_LOOKUP_ID, attemptId: GOLDEN_ATTEMPT_ID,
        signal: new AbortController().signal, purpose: 'edition_options',
        http: { get: async () => { throw new Error('unexpected port call'); } },
      }));
      expect(result.retention?.permittedDeadlineAt).toBe('2026-11-02T12:00:30.000Z');
      expect(result.rows).toEqual(GOOGLE_EXPLICIT_V1.rows);
    } finally { jest.useRealTimers(); }
  });

  it('fails closed instead of labelling a non-exact row as exact ISBN evidence', async () => {
    const lookupEditionOptions = jest.fn(async () => ({
      outcome: 'coherent_match' as const,
      rows: [{
        ...GOOGLE_EXPLICIT_V1.rows[0],
        metadata: {
          ...GOOGLE_EXPLICIT_V1.rows[0].metadata,
          matchRationale: 'confirmation_required_text_evidence',
        },
      }],
      fetchedAt: GOLDEN_CLOCK,
      retentionEvidence: {
        storagePermissionVerified: true as const,
        permittedDeadlineAt: '2026-11-02T13:00:00.000Z',
      },
      retryable: false,
      providerRequestId: 'fixture-explicit-request',
    }));
    const adapter = {
      optionsRetentionConfigured: true,
      lookup: jest.fn(),
      lookupEditionOptions,
    } as unknown as GoogleBooksAdapter;
    const descriptor = createGoogleBooksDescriptor({
      adapter, retentionPolicyVersion: 1,
    });
    const result = await descriptor.invoke({
      query, correlationId: GOLDEN_LOOKUP_ID, attemptId: GOLDEN_ATTEMPT_ID,
      signal: new AbortController().signal, purpose: 'edition_options',
      http: { get: async () => { throw new Error('unexpected port call'); } },
    });
    expect(lookupEditionOptions).toHaveBeenCalledTimes(1);
    expect(result.outcome).toMatchObject({
      outcome: 'schema_invalid', candidates: [], selected: null, evidence: [],
    });
  });
});

describe('Phase 9 U1 Open Library v1 explicit descriptor', () => {
  it('retains the captured v1 explicit golden through the real adapter', async () => {
    jest.useFakeTimers(); jest.setSystemTime(Date.parse(GOLDEN_CLOCK));
    try {
      const adapter = new OpenLibraryEditionOptionsAdapter({
        timeoutMs: 1_000, maxResponseBytes: 64_000,
        fetcher: openLibraryFixtureFetcher,
      });
      const descriptor = createOpenLibraryV1Descriptor({
        adapter, policyVersion: 1,
      });
      const result = await withUuidSequence(openLibraryOptionIds, () => descriptor.invoke({
        query, correlationId: GOLDEN_LOOKUP_ID, attemptId: GOLDEN_ATTEMPT_ID,
        signal: new AbortController().signal, purpose: 'edition_options',
        http: { get: async () => { throw new Error('unexpected port call'); } },
      }));
      expect(result.outcome).toEqual(explicitOpenLibraryEnvelope().outcome);
      expect(result.rows).toEqual(OL_V1_EXPLICIT_V1.rows);
      expect(result.catalogueCompanions).toEqual(OL_V1_EXPLICIT_V1.catalogueCompanions);
      expect(result.retention).toEqual({
        sourceFetchedAt: GOLDEN_CLOCK,
        permittedDeadlineAt: '2026-11-03T12:00:00.000Z',
        policyVersion: 1,
        storagePermissionVerified: true,
        retentionContract: 'open-library-options-v1',
      });
      expect(() => validateMetadataResultV2(result, contextFor(descriptor, {
        retentionEvidence: evidenceFrom(result.retention!),
      }))).not.toThrow();
    } finally { jest.useRealTimers(); }
  });

  it('does not advertise retention readiness without a positive bound policy version', () => {
    const adapter = {
      optionsRetentionConfigured: true,
      lookup: jest.fn(),
      lookupEditionOptions: jest.fn(),
    } as unknown as OpenLibraryEditionOptionsAdapter;
    const descriptor = createOpenLibraryV1Descriptor({ adapter });
    expect(descriptor.credentialsReady()).toBe(true);
    expect(descriptor.retentionReady('edition_options')).toBe(false);
  });

  it('fails closed instead of labelling a non-exact row as exact ISBN evidence', async () => {
    const lookupEditionOptions = jest.fn(async () => ({
      outcome: 'coherent_match' as const,
      rows: [{
        ...OL_V1_EXPLICIT_V1.rows[0],
        metadata: {
          ...OL_V1_EXPLICIT_V1.rows[0].metadata,
          matchRationale: 'confirmation_required_text_evidence',
        },
      }],
      fetchedAt: GOLDEN_CLOCK,
      retentionEvidence: {
        storagePermissionVerified: true as const,
        permittedDeadlineAt: '2026-11-03T12:00:00.000Z',
      },
      retryable: false,
      providerRequestId: null,
    }));
    const adapter = {
      optionsRetentionConfigured: true,
      lookup: jest.fn(),
      lookupEditionOptions,
    } as unknown as OpenLibraryEditionOptionsAdapter;
    const descriptor = createOpenLibraryV1Descriptor({
      adapter, policyVersion: 1,
    });
    const result = await descriptor.invoke({
      query, correlationId: GOLDEN_LOOKUP_ID, attemptId: GOLDEN_ATTEMPT_ID,
      signal: new AbortController().signal, purpose: 'edition_options',
      http: { get: async () => { throw new Error('unexpected port call'); } },
    });
    expect(lookupEditionOptions).toHaveBeenCalledTimes(1);
    expect(result.outcome).toMatchObject({
      outcome: 'schema_invalid', candidates: [], selected: null, evidence: [],
    });
  });
});

describe('Phase 9 U1 strict result boundary', () => {
  const googleAdapter = {
    optionsRetentionConfigured: true,
    lookup: jest.fn(),
    lookupEditionOptions: jest.fn(),
  } as unknown as GoogleBooksAdapter;
  const openLibraryAdapter = {
    optionsRetentionConfigured: true,
    lookup: jest.fn(),
    lookupEditionOptions: jest.fn(),
  } as unknown as OpenLibraryEditionOptionsAdapter;
  const googleDescriptor = createGoogleBooksDescriptor({ adapter: null });
  const googleRetentionDescriptor = createGoogleBooksDescriptor({
    adapter: googleAdapter, retentionPolicyVersion: 1,
  });
  const openLibraryDescriptor = createOpenLibraryV1Descriptor({
    adapter: openLibraryAdapter, policyVersion: 1,
  });

  it('accepts a well-formed schema_invalid outcome and rejects a malformed one', () => {
    const schemaInvalid = {
      version: PROVIDER_RESULT_VERSION,
      purpose: 'automatic',
      outcome: {
        outcome: 'schema_invalid', candidates: [], selected: null, evidence: [],
        retryable: false, secondaryEligible: true, providerRequestId: null,
        representativeCover: null,
      },
      rows: null,
      catalogueCompanions: null,
      retention: null,
    };
    expect(() => validateMetadataResultV2(
      schemaInvalid, contextFor(googleDescriptor, { purpose: 'automatic' }),
    )).not.toThrow();
    expect(() => validateMetadataResultV2({
      ...schemaInvalid,
      outcome: {
        ...schemaInvalid.outcome,
        candidates: [GOOGLE_AUTOMATIC_V1.selected],
        selected: GOOGLE_AUTOMATIC_V1.selected,
        evidence: ['exact_validated_isbn'],
        unexpected: true,
      },
    }, contextFor(googleDescriptor, { purpose: 'automatic' }))).toThrow(
      'P9_PROVIDER_RESULT_INVALID',
    );
  });

  it('rejects lineage that differs from the trusted invocation', () => {
    const envelope = {
      version: PROVIDER_RESULT_VERSION,
      purpose: 'automatic',
      outcome: GOOGLE_AUTOMATIC_V1,
      rows: null,
      catalogueCompanions: null,
      retention: null,
    };
    expect(() => validateMetadataResultV2(envelope, contextFor(googleDescriptor, {
      purpose: 'automatic',
      lookupId: '99999999-9999-4999-8999-999999999999',
    }))).toThrow('P9_PROVIDER_RESULT_INVALID');
    expect(() => validateMetadataResultV2(envelope, contextFor(googleDescriptor, {
      purpose: 'automatic', lookupId: 'not-a-uuid',
    }))).toThrow('P9_PROVIDER_RESULT_INVALID');
  });

  it('rejects retention without trusted verifier evidence and on evidence mismatch', () => {
    const envelope = explicitGoogleEnvelope();
    expect(() => validateMetadataResultV2(
      envelope, contextFor(googleRetentionDescriptor),
    )).toThrow('P9_PROVIDER_RESULT_INVALID');
    expect(() => validateMetadataResultV2(envelope, contextFor(googleRetentionDescriptor, {
      retentionEvidence: {
        ...evidenceFrom(envelope.retention),
        permittedDeadlineAt: '2026-11-02T13:30:00.000Z',
      },
    }))).toThrow('P9_PROVIDER_RESULT_INVALID');
  });

  it('rejects a retention deadline that is not after the trusted now', () => {
    const envelope = explicitGoogleEnvelope();
    expect(() => validateMetadataResultV2(envelope, contextFor(googleRetentionDescriptor, {
      now: '2026-11-02T14:00:00.000Z',
      retentionEvidence: evidenceFrom(envelope.retention),
    }))).toThrow('P9_PROVIDER_RESULT_INVALID');
  });

  it('rejects provider-owned record, book URL and cover violations', () => {
    const olEnvelope = explicitOpenLibraryEnvelope();
    const broken = {
      ...olEnvelope,
      rows: [{
        ...olEnvelope.rows[0],
        googleBooksUrl: 'https://openlibrary.org/books/not-an-ol-id',
        metadata: { ...olEnvelope.rows[0].metadata, providerRecordId: 'not-an-ol-id' },
      }],
    };
    expect(() => validateMetadataResultV2(broken, contextFor(openLibraryDescriptor, {
      retentionEvidence: evidenceFrom(broken.retention),
    }))).toThrow('P9_PROVIDER_RESULT_INVALID');

    const googleEnvelope = explicitGoogleEnvelope();
    const badCover = {
      ...googleEnvelope,
      rows: [{
        ...googleEnvelope.rows[0],
        metadata: {
          ...googleEnvelope.rows[0].metadata,
          coverReference: 'https://books.google.com/books/content?id=someone-else',
        },
      }],
    };
    expect(() => validateMetadataResultV2(badCover, contextFor(googleRetentionDescriptor, {
      retentionEvidence: evidenceFrom(badCover.retention),
    }))).toThrow('P9_PROVIDER_RESULT_INVALID');
  });

  it('rejects duplicate option ids even when both rows are unavailable', () => {
    const envelope = explicitOpenLibraryEnvelope();
    const duplicate = {
      ...envelope,
      outcome: {
        outcome: 'no_acceptable_match', candidates: [], selected: null,
        evidence: [], retryable: false, secondaryEligible: true,
        providerRequestId: null, representativeCover: null,
      },
      rows: [
        { ...envelope.rows[0], eligibility: 'unavailable', googleBooksUrl: null, metadata: null },
        { ...envelope.rows[0], eligibility: 'unavailable', googleBooksUrl: null, metadata: null },
      ],
      catalogueCompanions: [],
    };
    expect(() => validateMetadataResultV2(duplicate, contextFor(openLibraryDescriptor, {
      retentionEvidence: evidenceFrom(duplicate.retention),
    }))).toThrow('P9_PROVIDER_RESULT_INVALID');
  });

  it('accepts a positive safe-integer policy version', () => {
    const envelope = explicitOpenLibraryEnvelope();
    const policyVersion = 2_147_483_648;
    const bounded = {
      ...envelope,
      retention: { ...envelope.retention, policyVersion },
    };
    const descriptor = createOpenLibraryV1Descriptor({
      adapter: openLibraryAdapter, policyVersion,
    });
    expect(() => validateMetadataResultV2(bounded, contextFor(descriptor, {
      retentionEvidence: { ...evidenceFrom(envelope.retention), policyVersion },
    }))).not.toThrow();
  });

  it('dispatches installed provider-owned validation without a generic provider branch', () => {
    const metadata = {
      ...OL_V1_EXPLICIT_V1.rows[0].metadata,
      adapterKey: 'synthetic',
      providerRecordId: 'SYN1',
      coverReference: null,
    };
    const providerValidation = {
      adapterKey: 'synthetic', adapterVersion: '1.0.0',
      validationContract: 'synthetic-options-v1',
      hostPolicyVersion: 'synthetic-hosts-v1',
      hostPolicy: {
        adapterKey: 'synthetic', policyVersion: 'synthetic-hosts-v1',
        approvedCoverHosts: ['covers.synthetic.test'],
      },
      validProviderRecordId: (value: string) => /^SYN[0-9]+$/u.test(value),
      validBookUrl: (value: string, record: string) =>
        value === `https://books.synthetic.test/editions/${record}`,
      validCoverReference: () => true,
      validCompanionRecord: (record: string, work: string | null) =>
        /^SYN[0-9]+$/u.test(record) && work === null,
    };
    const descriptor = {
      adapterKey: 'synthetic', adapterVersion: '1.0.0',
      capabilityVersion: 'synthetic-capability-v1',
      normalizerVersion: 'p9-bibliographic-normalizer-v1',
      payloadSchemaVersion: 'p9-metadata-v1',
      lookupSchemaVersion: 'p9-metadata-foundation-v1',
      validationContract: 'synthetic-options-v1',
      hostPolicyVersion: 'synthetic-hosts-v1',
      retentionContract: 'synthetic-options-v1',
      protocol: { kind: 'fanout', maxGets: 6 },
      purposes: ['edition_options'],
      credentialsReady: () => true,
      retentionReady: () => true,
      invoke: async () => { throw new Error('not invoked'); },
    };
    const retention = {
      sourceFetchedAt: GOLDEN_CLOCK,
      permittedDeadlineAt: '2026-11-03T12:00:00.000Z',
      policyVersion: 1,
      storagePermissionVerified: true,
      retentionContract: 'synthetic-options-v1',
    };
    const envelope = {
      version: PROVIDER_RESULT_VERSION,
      purpose: 'edition_options',
      outcome: {
        outcome: 'coherent_match', candidates: [metadata], selected: metadata,
        evidence: ['exact_validated_isbn'], retryable: false,
        secondaryEligible: false, providerRequestId: null,
        representativeCover: null,
      },
      rows: [{
        optionId: '55555555-5555-4555-8555-000000000001', ordinal: 0,
        googleBooksUrl: 'https://books.synthetic.test/editions/SYN1',
        eligibility: 'eligible', metadata,
      }],
      catalogueCompanions: [],
      retention,
    };
    expect(() => validateMetadataResultV2(envelope, {
      purpose: 'edition_options',
      descriptor,
      installed: new Map([[providerManifestKey('synthetic', '1.0.0'), descriptor]]),
      providerValidation,
      lookupId: GOLDEN_LOOKUP_ID,
      attemptId: GOLDEN_ATTEMPT_ID,
      now: GOLDEN_CLOCK,
      retentionEvidence: evidenceFrom(retention),
      adapterKey: 'synthetic',
      adapterVersion: '1.0.0',
      retentionContract: 'synthetic-options-v1',
    })).not.toThrow();
  });

  it('accepts the captured Google transition packet with trusted invocation state', () => {
    const envelope = {
      version: PROVIDER_RESULT_VERSION,
      purpose: 'automatic',
      outcome: GOOGLE_AUTOMATIC_V1,
      rows: null,
      catalogueCompanions: null,
      retention: null,
    };
    expect(() => validateMetadataResultV2(envelope, contextFor(googleDescriptor, {
      purpose: 'automatic',
    }))).not.toThrow();
  });
});
