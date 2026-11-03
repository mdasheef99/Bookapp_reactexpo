// U4 v2-only coverage (append-only; no existing test/fixture/support line
// changed here). Every negative has a positive control differing only in
// the defect. The v2 factory is lazy-required: openLibrary/descriptor and
// providerDescriptor form a load cycle that resolves only when entered via
// providerDescriptor (see phase9_open_library_automatic.test.ts helper).
import { buildMetadataQueryIdentity } from '../_shared/imageInventory/metadata/queryIdentity';
import type { MetadataQueryIdentity } from '../_shared/imageInventory/metadata/queryIdentity';
import {
  normalizePublisherTokenSet, publisherClueOf, publisherSignal, scoringEditionClues, secondaryScoreOf,
} from '../_shared/imageInventory/metadata/openLibrary/publisher';
import { failureOutcome } from '../_shared/imageInventory/metadata/openLibrary/automatic';
import { OpenLibraryEditionOptionsAdapter } from '../_shared/imageInventory/metadata/openLibrary/adapter';
import { OpenLibraryFailure } from '../_shared/imageInventory/metadata/openLibrary/transport';
import { failClosedMetadataProviderOutcome } from '../_shared/imageInventory/metadata/providerAdapter';
import {
  installedProviderValidation,
  PHASE9_PROVIDER_VALIDATIONS,
} from '../_shared/imageInventory/metadata/providerValidation';
import {
  GOLDEN_ATTEMPT_ID, GOLDEN_CLOCK, GOLDEN_LOOKUP_ID,
} from './fixtures/phase9/providerReplacementGoldens';
import {
  providerConfigurationRow, providerConfigurationSnapshot,
} from './fixtures/phase9/providerConfiguration';
import { installedManifest } from './support/providerModules';
import { withUuidSequence } from './support/captureProviderGoldens';

const boundV2 = (policyVersion: number | null) => {
  const { createOpenLibraryV2Descriptor } =
    require('../_shared/imageInventory/metadata/openLibrary/descriptor');
  return createOpenLibraryV2Descriptor({ policyVersion });
};

const routeOf = () => {
  const { resolveProviderRoute } =
    require('../_shared/imageInventory/metadata/providerDescriptor');
  return resolveProviderRoute;
};

type EditionSpec = Readonly<{
  publisher: string | null;
  isbn13?: string | null;
  authorKey?: string;
  authorName?: string | null;
  editionStatement?: string | null;
  title?: string;
  // undefined preserves the default 'eng' language; null omits the language
  // key entirely (unknown 'und' language); a string sets the language code.
  language?: string | null;
}>;

const edition = (index: number, spec: EditionSpec) => {
  const authorKey = spec.authorKey ?? 'OL1A';
  const record: Record<string, unknown> = {
    key: `/books/OL${100 + index}M`,
    title: spec.title ?? 'The Fixture Book',
    authors: [{ key: `/authors/${authorKey}` }],
    publishers: spec.publisher === null ? [] : [spec.publisher],
    covers: [123],
    publish_date: '2024-03',
  };
  if (spec.language !== null) {
    record.languages = [{ key: `/languages/${spec.language ?? 'eng'}` }];
  }
  if (spec.editionStatement !== undefined && spec.editionStatement !== null) {
    record.edition_name = spec.editionStatement;
  }
  const isbn13 = spec.isbn13 === undefined ? '9780306406157' : spec.isbn13;
  if (isbn13 !== null) record.isbn_13 = [isbn13];
  if (isbn13 === '9780306406157') record.isbn_10 = ['0306406152'];
  return record;
};

function serveJson(
  specs: readonly EditionSpec[],
  searchDocs: unknown,
  authorNameFor: (authorKey: string) => string | null,
) {
  const entries = specs.map((spec, index) => edition(index, spec));
  return (url: URL): unknown => {
    if (url.pathname === '/search.json') return { docs: searchDocs };
    if (url.pathname === '/works/OL1W/editions.json') return { entries };
    // ISBN-mode editions are fetched as individual book records.
    const book = /^\/books\/(OL[1-9][0-9]*M)\.json$/u.exec(url.pathname);
    if (book) return entries.find((entry) => entry.key === `/books/${book[1]}`) ?? {};
    const author = /^\/authors\/(OL[1-9][0-9]*A)\.json$/u.exec(url.pathname);
    if (author) {
      const name = authorNameFor(author[1]);
      return name === null ? {} : { key: `/authors/${author[1]}`, name };
    }
    return {};
  };
}

function subject(
  specs: readonly EditionSpec[],
  searchDocs: unknown = [{ key: '/works/OL1W' }],
  authorNameFor: (authorKey: string) => string | null = () => 'Fixture Author',
  responseHeaders: (stage: string) => Record<string, string> = () => ({ 'cache-control': 'max-age=86400' }),
  throwOn?: (stage: string) => Error | null,
) {
  const jsonFor = serveJson(specs, searchDocs, authorNameFor);
  const calls: Array<{ url: URL; stage: string; sequence: number }> = [];
  const http = {
    async get(input: Readonly<{ url: URL; stage: string; sequence: number; signal: AbortSignal }>) {
      calls.push({ url: new URL(input.url), stage: input.stage, sequence: input.sequence });
      const failure = throwOn?.(input.stage) ?? null;
      if (failure !== null) throw failure;
      return {
        json: jsonFor(input.url),
        headers: new Headers(responseHeaders(input.stage)),
        receiptId: `00000000-0000-4000-8000-${String(calls.length).padStart(12, '0')}`,
      };
    },
  };
  return { http, calls };
}

const queryWithClue = (publisherClue: string | null) => buildMetadataQueryIdentity({
  strategy: 'bibliographic',
  title: 'The Fixture Book',
  authors: ['Fixture Author'],
  isbnClue: '9780306406157',
  language: 'en',
  editionClues: publisherClue === null ? [] : [publisherClue],
});

async function invoke(
  specs: readonly EditionSpec[],
  options: Readonly<{
    publisherClue?: string | null;
    query?: MetadataQueryIdentity;
    purpose?: 'automatic' | 'edition_options';
    policyVersion?: number | null;
    signal?: AbortSignal;
    searchDocs?: unknown;
    authorNameFor?: (authorKey: string) => string | null;
    responseHeaders?: (stage: string) => Record<string, string>;
    throwOn?: (stage: string) => Error | null;
  }> = {},
) {
  const descriptor = boundV2(options.policyVersion === undefined ? 1 : options.policyVersion);
  const { http, calls } = subject(
    specs, options.searchDocs, options.authorNameFor, options.responseHeaders, options.throwOn);
  const result = await withUuidSequence(Array.from({ length: 10 }, (_, i) =>
    `44444444-4444-4444-8333-${String(i + 1).padStart(12, '0')}`), () => descriptor.invoke({
    query: options.query ?? queryWithClue(options.publisherClue ?? null),
    correlationId: GOLDEN_LOOKUP_ID,
    attemptId: GOLDEN_ATTEMPT_ID,
    signal: options.signal ?? new AbortController().signal,
    purpose: options.purpose ?? 'automatic',
    http,
  }));
  return { result, calls, descriptor };
}

const resultBoundaryOf = () => {
  const providerResult =
    require('../_shared/imageInventory/metadata/providerResult');
  const providerDescriptor =
    require('../_shared/imageInventory/metadata/providerDescriptor');
  return {
    validateMetadataResultV2: providerResult.validateMetadataResultV2,
    providerManifestKey: providerDescriptor.providerManifestKey,
  };
};

const independentEvidence = (policyVersion: number) => ({
  sourceFetchedAt: GOLDEN_CLOCK,
  permittedDeadlineAt: new Date(Date.parse(GOLDEN_CLOCK) + 86_400_000).toISOString(),
  policyVersion,
  retentionContract: 'open-library-options-v1',
});

function validatePacket(
  result: unknown,
  descriptor: { adapterKey: string; adapterVersion: string },
  options: Readonly<{
    purpose: 'automatic' | 'edition_options';
    policyVersion: number;
    evidence: unknown;
  }>,
) {
  const { validateMetadataResultV2, providerManifestKey } = resultBoundaryOf();
  const installed = new Map(installedManifest() as Map<string, unknown>);
  installed.set(
    providerManifestKey(descriptor.adapterKey, descriptor.adapterVersion), descriptor);
  return validateMetadataResultV2(result, {
    purpose: options.purpose,
    descriptor,
    installed,
    providerValidation: installedProviderValidation(
      'open_library', '2.0.0', 'open-library-v2', 'open-library-hosts-v1'),
    lookupId: GOLDEN_LOOKUP_ID,
    attemptId: GOLDEN_ATTEMPT_ID,
    now: GOLDEN_CLOCK,
    retentionEvidence: options.evidence,
  });
}

const zeroIsbnQuery = (isbnClue: string | null) => buildMetadataQueryIdentity({
  strategy: 'bibliographic',
  title: '',
  authors: [],
  isbnClue,
  language: 'en',
  editionClues: [],
});

describe('Phase 9 Open Library v2 descriptor boundary', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(Date.parse(GOLDEN_CLOCK)); });
  afterEach(() => jest.useRealTimers());

  it('(a) v2 rows and companions pass the REAL installed v2 provider validation', async () => {
    const { result } = await invoke([{ publisher: 'Fixture Press' }]);
    const validation = installedProviderValidation(
      'open_library', '2.0.0', 'open-library-v2', 'open-library-hosts-v1');
    expect(validation).toBeDefined();
    expect(PHASE9_PROVIDER_VALIDATIONS).toContain(validation);
    expect(result.rows).not.toBeNull();
    expect(result.catalogueCompanions).not.toBeNull();
    for (const row of result.rows!) {
      expect(row.metadata).not.toBeNull();
      expect(validation!.validProviderRecordId(row.metadata!.providerRecordId)).toBe(true);
      expect(validation!.validBookUrl(row.googleBooksUrl!, row.metadata!.providerRecordId)).toBe(true);
      expect(validation!.validCoverReference(row.metadata!.coverReference, row.metadata!.providerRecordId)).toBe(true);
    }
    for (const companion of result.catalogueCompanions!) {
      const row = result.rows!.find((candidate) => candidate.optionId === companion.optionId);
      expect(row).toBeDefined();
      expect(validation!.validCompanionRecord(companion.providerRecordId, companion.workExternalId)).toBe(true);
      expect(companion.adapterVersion).toBe('2.0.0');
    }
  });

  it('(a-control) a mismatched validation contract has no installed validator', async () => {
    expect(installedProviderValidation(
      'open_library', '2.0.0', 'open-library-v1', 'open-library-hosts-v1')).toBeUndefined();
    expect(installedProviderValidation(
      'open_library', '1.0.0', 'open-library-v2', 'open-library-hosts-v1')).toBeUndefined();
  });

  it('(b) v2 rows and companions echo the invoking lookup lineage', async () => {
    const { result } = await invoke([{ publisher: 'Fixture Press' }]);
    expect(result.rows).toHaveLength(1);
    for (const row of result.rows!) {
      expect(row.metadata!.correlationId).toBe(GOLDEN_LOOKUP_ID);
      expect(row.metadata!.attemptId).toBe(GOLDEN_ATTEMPT_ID);
      expect(row.metadata!.fetchedAt).toBe(GOLDEN_CLOCK);
      expect(row.metadata!.adapterVersion).toBe('2.0.0');
    }
    const optionIds = new Set(result.rows!.map((row) => row.optionId));
    expect(optionIds.size).toBe(result.rows!.length);
    for (const companion of result.catalogueCompanions!) {
      expect(optionIds.has(companion.optionId)).toBe(true);
      expect(companion.lookupId).toBe(GOLDEN_LOOKUP_ID);
      expect(companion.attemptId).toBe(GOLDEN_ATTEMPT_ID);
      expect(companion.fetchedAt).toBe(GOLDEN_CLOCK);
    }
    expect(result.retention!.sourceFetchedAt).toBe(GOLDEN_CLOCK);
  });

  it('(b-control) lineage follows the invoking identity, never a fixed constant', async () => {
    const otherLookup = '33333333-3333-4333-8333-000000000001';
    const otherAttempt = '33333333-3333-4333-8333-000000000002';
    const descriptor = boundV2(1);
    const { http } = subject([{ publisher: 'Fixture Press' }]);
    const result = await withUuidSequence(['44444444-4444-4444-8333-000000000001'], () => descriptor.invoke({
      query: queryWithClue(null),
      correlationId: otherLookup,
      attemptId: otherAttempt,
      signal: new AbortController().signal,
      purpose: 'automatic',
      http,
    }));
    expect(result.rows![0].metadata!.correlationId).toBe(otherLookup);
    expect(result.rows![0].metadata!.attemptId).toBe(otherAttempt);
    expect(result.catalogueCompanions![0].lookupId).toBe(otherLookup);
    expect(result.catalogueCompanions![0].attemptId).toBe(otherAttempt);
  });

  it('(c) malformed search responses fail closed without rows or retention', async () => {
    const { result, calls } = await invoke(
      [{ publisher: 'Fixture Press' }], { searchDocs: [{ key: '/works/OL1W' }, { key: '/works/OL2W' }] });
    expect(result.outcome.outcome).toBe('malformed_response');
    expect(result.rows).toBeNull();
    expect(result.catalogueCompanions).toBeNull();
    expect(result.retention).toBeNull();
    expect(calls.map((call) => call.stage)).toEqual(['search']);
  });

  it('(c-control) a well-formed single-work search succeeds', async () => {
    const { result } = await invoke([{ publisher: 'Fixture Press' }]);
    expect(result.outcome.outcome).toBe('coherent_match');
    expect(result.rows).toHaveLength(1);
  });

  it('(c2) over-limit edition lists fail closed', async () => {
    const specs = Array.from({ length: 11 }, () => ({ publisher: 'Fixture Press' as string | null }));
    const { result } = await invoke(specs);
    expect(result.outcome.outcome).toBe('malformed_response');
    expect(result.rows).toBeNull();
    expect(result.retention).toBeNull();
  });

  it('(c3) editions with unresolvable author references stay unavailable, never crash', async () => {
    const { result } = await invoke([{ publisher: 'Fixture Press', authorKey: 'OL9A' }], {
      authorNameFor: () => null,
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows![0].eligibility).toBe('unavailable');
    expect(result.rows![0].metadata).toBeNull();
    expect(result.catalogueCompanions).toEqual([]);
    expect(result.outcome.outcome).toBe('no_acceptable_match');
  });

  it('(c3-control) the same edition with a resolved author is eligible', async () => {
    const { result } = await invoke([{ publisher: 'Fixture Press', authorKey: 'OL9A' }]);
    expect(result.rows![0].eligibility).toBe('eligible');
    expect(result.outcome.outcome).toBe('coherent_match');
  });

  it('(d) a failed author read isolates only its dependent rows', async () => {
    const { result } = await invoke([
      { publisher: 'First Press', authorKey: 'OL1A' },
      { publisher: 'Second Press', authorKey: 'OL2A' },
    ], { authorNameFor: (key) => (key === 'OL2A' ? null : 'Fixture Author') });
    expect(result.rows!.map((row) => row.eligibility)).toEqual(['eligible', 'unavailable']);
    expect(result.catalogueCompanions).toHaveLength(1);
    expect(result.outcome.outcome).toBe('coherent_match');
    expect(result.outcome.selected?.publisher).toBe('First Press');
  });

  it('(d-control) both rows are eligible when both authors resolve', async () => {
    const { result } = await invoke([
      { publisher: 'First Press', authorKey: 'OL1A' },
      { publisher: 'Second Press', authorKey: 'OL2A' },
    ]);
    expect(result.rows!.map((row) => row.eligibility)).toEqual(['eligible', 'eligible']);
    expect(result.catalogueCompanions).toHaveLength(2);
  });

  it('(e) an aborted signal cancels without rows, companions or retention', async () => {
    const controller = new AbortController();
    controller.abort();
    const { result, calls } = await invoke(
      [{ publisher: 'Fixture Press' }], { signal: controller.signal });
    expect(result.outcome.outcome).toBe('cancelled');
    expect(result.rows).toBeNull();
    expect(result.catalogueCompanions).toBeNull();
    expect(result.retention).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('(e-control) a live signal performs the full round', async () => {
    const { result, calls } = await invoke([{ publisher: 'Fixture Press' }]);
    expect(result.outcome.outcome).toBe('coherent_match');
    expect(calls.map((call) => call.stage)).toEqual(['search', 'editions', 'author:OL1A']);
  });

  it('(f) v2 performs no global fetch; all egress goes through input.http', async () => {
    const globalFetch = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('must not be called'));
    try {
      const { result, calls } = await invoke([{ publisher: 'Fixture Press' }]);
      expect(globalFetch).not.toHaveBeenCalled();
      expect(calls).toHaveLength(3);
      expect(result.outcome.outcome).toBe('coherent_match');
    } finally { globalFetch.mockRestore(); }
  });

  it('(f-control) the spy observes v2 egress when the port delegates to fetch', async () => {
    const seen: string[] = [];
    const globalFetch = jest.spyOn(globalThis, 'fetch').mockImplementation(async (address: unknown) => {
      const url = new URL(String(address));
      seen.push(url.pathname);
      const serve = serveJson([{ publisher: 'Fixture Press' }], [{ key: '/works/OL1W' }], () => 'Fixture Author');
      return new Response(JSON.stringify(serve(url)), {
        headers: { 'content-type': 'application/json', 'cache-control': 'max-age=86400' },
      });
    });
    try {
      const descriptor = boundV2(1);
      const calls: string[] = [];
      const http = {
        async get(input: Readonly<{ url: URL; stage: string; sequence: number; signal: AbortSignal }>) {
          calls.push(input.stage);
          const response = await globalThis.fetch(String(input.url), { signal: input.signal });
          return {
            json: await response.json(),
            headers: response.headers,
            receiptId: `00000000-0000-4000-8000-${String(calls.length).padStart(12, '0')}`,
          };
        },
      };
      const result = await withUuidSequence(Array.from({ length: 10 }, (_, i) =>
        `44444444-4444-4444-8333-${String(i + 1).padStart(12, '0')}`), () => descriptor.invoke({
        query: queryWithClue(null),
        correlationId: GOLDEN_LOOKUP_ID,
        attemptId: GOLDEN_ATTEMPT_ID,
        signal: new AbortController().signal,
        purpose: 'automatic',
        http,
      }));
      expect(seen).toEqual(['/search.json', '/works/OL1W/editions.json', '/authors/OL1A.json']);
      expect(calls).toEqual(['search', 'editions', 'author:OL1A']);
      expect(result.outcome.outcome).toBe('coherent_match');
    } finally { globalFetch.mockRestore(); }
  });

  it('(g) an explicitly bound policyVersion is echoed in retention', async () => {
    const { result } = await invoke([{ publisher: 'Fixture Press' }], { policyVersion: 7 });
    expect(result.retention!.policyVersion).toBe(7);
    expect(result.rows).toHaveLength(1);
  });

  it('(g-control) policyVersion 1 yields 1 and null stays unbound', async () => {
    const bound = await invoke([{ publisher: 'Fixture Press' }], { policyVersion: 1 });
    expect(bound.result.retention!.policyVersion).toBe(1);
    const unbound = await invoke([{ publisher: 'Fixture Press' }], { policyVersion: null });
    expect(unbound.result.retention).toBeNull();
    expect(unbound.result.rows).toBeNull();
    expect(unbound.result.catalogueCompanions).toBeNull();
    expect(unbound.result.outcome.outcome).toBe('coherent_match');
  });

  it('(h) a publisher clue never changes the eligible set or list size', async () => {
    const specs = [{ publisher: 'Noisy !!! Publisher ???' }, { publisher: null }] as const;
    const withClue = await invoke([...specs], { publisherClue: 'Penguin' });
    const withoutClue = await invoke([...specs], { publisherClue: null });
    expect(withClue.result.rows!.map((row) => [row.ordinal, row.eligibility, row.metadata]))
      .toEqual(withoutClue.result.rows!.map((row) => [row.ordinal, row.eligibility, row.metadata]));
    expect(secondaryScoreOf(queryWithClue('Penguin'), withClue.result.rows![0].metadata!))
      .toBe(secondaryScoreOf(queryWithClue(null), withoutClue.result.rows![0].metadata!));
  });

  it('(h-control) a publisher-clue tie goes to the publisher match, never the statement match', async () => {
    // D1 Owner decision ("tie-break only"): the singleton publisher clue is
    // excluded from editionClueOverlap, so both rows tie 2-2 on secondary
    // and the signal (B=1, A=0) decides for the actual publisher.
    expect(publisherSignal('Penguin', 'Penguin Press')).toBe(1);
    const { result } = await invoke([
      { publisher: 'Unrelated Press', editionStatement: 'Penguin' },
      { publisher: 'Penguin Press' },
    ], { publisherClue: 'Penguin' });
    expect(result.rows!.map((row) => row.eligibility)).toEqual(['eligible', 'eligible']);
    expect(result.outcome.outcome).toBe('coherent_match');
    expect(result.outcome.selected?.publisher).toBe('Penguin Press');
  });

  it('(h-tie) a statement-only clue match with equal publisher signals stays ambiguous', async () => {
    const { result } = await invoke([
      { publisher: 'Unrelated Press', editionStatement: 'Penguin' },
      { publisher: 'Unrelated Press' },
    ], { publisherClue: 'Penguin' });
    expect(result.rows!.map((row) => row.eligibility)).toEqual(['eligible', 'eligible']);
    expect(result.outcome.outcome).toBe('ambiguous_match');
    expect(result.outcome.selected).toBeNull();
  });

  it('(i-8b) the 8b registry snapshot never elects open_library@2.0.0 for automatic', async () => {
    const resolveProviderRoute = routeOf();
    const registry = providerConfigurationSnapshot([
      providerConfigurationRow('google_books', '1.0.0'),
      providerConfigurationRow('open_library', '1.0.0'),
    ]);
    const route = resolveProviderRoute({
      purpose: 'automatic',
      registry,
      installed: installedManifest(),
      resumed: null,
    });
    expect('manual' in route).toBe(true);
  });

  // F1: ONE installed map holding BOTH ready descriptors (v1 with a real
  // adapter + explicit policyVersion, v2 bound likewise), purpose
  // edition_options served by both. Lazy requires: the v1 factory lives in
  // the cycled descriptor module (see file header).
  const readyBoth = () => {
    const { createOpenLibraryV1Descriptor } =
      require('../_shared/imageInventory/metadata/openLibrary/descriptor');
    const v1 = createOpenLibraryV1Descriptor({
      adapter: new OpenLibraryEditionOptionsAdapter({
        timeoutMs: 1000,
        maxResponseBytes: 64_000,
        fetcher: async () => new Response('{}', { headers: { 'content-type': 'application/json' } }),
      }),
      policyVersion: 1,
    });
    const v2 = boundV2(1);
    return new Map([[`${v1.adapterKey}@${v1.adapterVersion}`, v1], [`${v2.adapterKey}@${v2.adapterVersion}`, v2]]);
  };

  const parseSnapshotOf = (rows: readonly unknown[]) => {
    const { parseProviderConfigurationSnapshot } =
      require('../_shared/imageInventory/runtime/providerConfiguration');
    return parseProviderConfigurationSnapshot({ version: 'p9-provider-configuration-v1', providers: rows });
  };

  it('(i-v1) an accepted-1.0.0 explicit row elects exactly the ready v1 descriptor', async () => {
    const resolveProviderRoute = routeOf();
    const installed = readyBoth();
    const registry = parseSnapshotOf([
      providerConfigurationRow('open_library', '1.0.0'),
    ]);
    const route = resolveProviderRoute({
      purpose: 'edition_options',
      registry,
      installed,
      resumed: null,
    });
    expect(route).toEqual({
      primary: installed.get('open_library@1.0.0'),
      secondary: null,
      policyVersions: { 'open_library@1.0.0': 1 },
    });
  });

  it('(i-v2) an accepted-2.0.0 explicit row elects exactly the ready v2 descriptor', async () => {
    const resolveProviderRoute = routeOf();
    const installed = readyBoth();
    const registry = parseSnapshotOf([
      providerConfigurationRow('open_library', '2.0.0', {
        automaticLookupAllowed: false,
        automaticRole: null,
        automaticOrder: null,
      }),
    ]);
    const route = resolveProviderRoute({
      purpose: 'edition_options',
      registry,
      installed,
      resumed: null,
    });
    expect(route).toEqual({
      primary: installed.get('open_library@2.0.0'),
      secondary: null,
      policyVersions: { 'open_library@2.0.0': 1 },
    });
  });

  it('(i-reject) a 2.0.0 row with only v1 installed routes manual, never v1', async () => {
    const resolveProviderRoute = routeOf();
    const installed = readyBoth();
    installed.delete('open_library@2.0.0');
    const registry = parseSnapshotOf([
      providerConfigurationRow('open_library', '2.0.0', {
        automaticLookupAllowed: false,
        automaticRole: null,
        automaticOrder: null,
      }),
    ]);
    const route = resolveProviderRoute({
      purpose: 'edition_options',
      registry,
      installed,
      resumed: null,
    });
    // Mutation caught: a missing-version lookup substituting installed v1
    // for requested v2 would route v1 here instead of manual.
    expect(route).toEqual({ manual: true });
  });

  // C2: every MetadataNormalizedOutcome (providerAdapter.ts:10-30) agrees
  // between automatic.ts failureOutcome and the canonical parser. Retryable
  // flags mirror providerAdapter.ts:77-79.
  const CANONICAL_RETRYABLE = new Set([
    'provider_unavailable', 'timeout', 'network_failure', 'rate_limited', 'circuit_breaker_open',
  ]);
  const NON_COHERENT_OUTCOMES = [
    'no_acceptable_match', 'ambiguous_match', 'material_conflict',
    'provider_unavailable', 'timeout', 'network_failure', 'rate_limited', 'circuit_breaker_open',
    'malformed_response', 'schema_invalid', 'response_too_large', 'unsupported_content_type',
    'authentication_configuration_failure', 'insufficient_query', 'policy_denied',
    'legal_launch_denied', 'cost_quota_denied', 'provider_disabled', 'cancelled',
  ] as const;
  it('(c2-coherent) coherent_match through the failure mapper is rejected', () => {
    const mapped = failureOutcome('coherent_match', false);
    expect(mapped.secondaryEligible).toBe(false);
    const parsed = failClosedMetadataProviderOutcome(mapped, {
      correlationId: GOLDEN_LOOKUP_ID, attemptId: GOLDEN_ATTEMPT_ID,
    });
    expect(parsed.outcome).toBe('schema_invalid');
  });
  for (const outcome of NON_COHERENT_OUTCOMES) {
    it(`(c2) failureOutcome agrees with the canonical parser for ${outcome}`, () => {
      const mapped = failureOutcome(outcome, CANONICAL_RETRYABLE.has(outcome));
      const parsed = failClosedMetadataProviderOutcome(mapped, {
        correlationId: GOLDEN_LOOKUP_ID, attemptId: GOLDEN_ATTEMPT_ID,
      });
      // Deep equality closes the schema_invalid-fallback loophole: a parser
      // rejection returns the identical fallback shape
      // (providerAdapter.ts:176-183), so outcome/retryable checks alone
      // cannot tell rejection from acceptance.
      expect(parsed).toEqual(mapped);
      expect(parsed.outcome).toBe(outcome);
      expect(parsed.retryable).toBe(CANONICAL_RETRYABLE.has(outcome));
    });
  }

  it('(c3) a coherent winner without an exact ISBN carries textual evidence', async () => {
    const query = buildMetadataQueryIdentity({
      strategy: 'bibliographic',
      title: 'The Fixture Book',
      authors: ['Fixture Author'],
      isbnClue: null,
      language: 'en',
      editionClues: [],
    });
    const { result } = await invoke(
      [{ publisher: 'Fixture Press', isbn13: null }], { query });
    expect(result.outcome.outcome).toBe('coherent_match');
    expect(result.outcome.selected).not.toBeNull();
    expect(result.outcome.evidence).toEqual(
      ['exact_original_title', 'author_overlap', 'language_compatible']);
  });

  it('(c4) combining marks surviving NFKC are stripped to letters/numbers', async () => {
    // 'q' + U+0301 COMBINING ACUTE ACCENT: no precomposed form exists, so
    // NFKC keeps the mark (length 2); SDD §5.2 admits letters/numbers only.
    const acuteQ = `q${String.fromCharCode(0x0301)}`;
    expect(acuteQ.normalize('NFKC')).toHaveLength(2);
    expect(normalizePublisherTokenSet(acuteQ)).toEqual(['q']);
    expect(publisherSignal(acuteQ, 'q')).toBe(1);
  });

  it('(c4-control) plain tokens are unaffected by mark stripping', async () => {
    expect(normalizePublisherTokenSet('q')).toEqual(['q']);
    expect(publisherSignal('q', 'q')).toBe(1);
    expect(publisherSignal('Faber & Faber', 'Faber')).toBe(1);
  });

  it('(c5) normalized clue cardinality governs provenance', async () => {
    const base = {
      strategy: 'bibliographic', title: 'The Fixture Book', authors: ['Fixture Author'],
      isbnClue: '9780306406157', language: 'en',
    } as const;
    const singleton = buildMetadataQueryIdentity({ ...base, editionClues: ['Special'] });
    const multiple = buildMetadataQueryIdentity({ ...base, editionClues: ['Special', 'Other'] });
    const none = buildMetadataQueryIdentity({ ...base, editionClues: [] });
    expect(singleton.normalizedEditionClues).toEqual(['special']);
    expect(multiple.normalizedEditionClues).toEqual(['other', 'special']);
    expect(scoringEditionClues(singleton)).toEqual([]);
    expect(scoringEditionClues(multiple)).toEqual(['other', 'special']);
    expect(scoringEditionClues(none)).toEqual([]);
    const specs = [
      { publisher: null, editionStatement: 'Special' },
      { publisher: null },
    ];
    const singletonResult = await invoke(specs, { query: singleton });
    expect(singletonResult.result.outcome.outcome).toBe('ambiguous_match');
    expect(singletonResult.result.outcome.selected).toBeNull();
    const multipleResult = await invoke(specs, { query: multiple });
    expect(multipleResult.result.outcome.outcome).toBe('coherent_match');
    expect(multipleResult.result.outcome.selected?.editionStatement).toBe('Special');
  });

  it('(c5-signal-zero) multi-clue and clueless rounds give no publisher signal', async () => {
    const base = {
      strategy: 'bibliographic', title: 'The Fixture Book', authors: ['Fixture Author'],
      isbnClue: '9780306406157', language: 'en',
    } as const;
    const multiple = buildMetadataQueryIdentity({ ...base, editionClues: ['Penguin', 'Vintage'] });
    const none = buildMetadataQueryIdentity({ ...base, editionClues: [] });
    expect(multiple.normalizedEditionClues).toEqual(['penguin', 'vintage']);
    expect(publisherClueOf(multiple)).toBeNull();
    expect(publisherClueOf(none)).toBeNull();
    const specs = [
      { publisher: 'Penguin' },
      { publisher: 'Unrelated Press' },
    ];
    for (const query of [multiple, none]) {
      const { result } = await invoke(specs, { query });
      expect(result.rows!.map((row) => row.eligibility)).toEqual(['eligible', 'eligible']);
      // Secondary tie (exact ISBN + language each, no statements) with
      // signals 0/0: a first-sorted-clue signal would wrongly select A.
      expect(result.outcome.outcome).toBe('ambiguous_match');
      expect(result.outcome.selected).toBeNull();
    }
  });

  it('(c5-signal-zero-control) the singleton clue selects the publisher match', async () => {
    const query = buildMetadataQueryIdentity({
      strategy: 'bibliographic', title: 'The Fixture Book', authors: ['Fixture Author'],
      isbnClue: '9780306406157', language: 'en', editionClues: ['Penguin'],
    });
    expect(publisherClueOf(query)).toBe('penguin');
    const { result } = await invoke(
      [{ publisher: 'Penguin' }, { publisher: 'Unrelated Press' }], { query });
    expect(result.outcome.outcome).toBe('coherent_match');
    expect(result.outcome.selected?.publisher).toBe('Penguin');
  });

  it('(c5-evidence) clue cardinality governs edition_clue_overlap evidence', async () => {
    const base = {
      strategy: 'bibliographic', title: 'The Fixture Book', authors: ['Fixture Author'],
      isbnClue: '9780306406157', language: 'en',
    } as const;
    const singleton = buildMetadataQueryIdentity({ ...base, editionClues: ['Penguin'] });
    const multiple = buildMetadataQueryIdentity({ ...base, editionClues: ['Penguin', 'Vintage'] });
    const specs = [{ publisher: 'Penguin', editionStatement: 'Penguin' }];
    const singletonResult = await invoke(specs, { query: singleton });
    expect(singletonResult.result.outcome.outcome).toBe('coherent_match');
    expect(singletonResult.result.outcome.evidence).not.toContain('edition_clue_overlap');
    const multipleResult = await invoke(specs, { query: multiple });
    expect(multipleResult.result.outcome.outcome).toBe('coherent_match');
    expect(multipleResult.result.outcome.evidence).toContain('edition_clue_overlap');
  });

  it('(f4-fuzzy-und) a fuzzy-only unknown-language winner stays ambiguous with rows retained', async () => {
    const query = buildMetadataQueryIdentity({
      strategy: 'bibliographic',
      title: 'Antifragile',
      authors: ['Nassim Nicholas Taleb'],
      isbnClue: null,
      language: 'en',
      editionClues: [],
    });
    const { result, calls, descriptor } = await invoke(
      [{
        publisher: 'Fixture Press', isbn13: null, authorKey: 'OL1A',
        title: 'Anti-Fragile', language: null,
      }],
      {
        query,
        authorNameFor: (key) => (key === 'OL1A' ? 'Nassim N Taleb' : 'Fixture Author'),
      });
    expect(result.rows).toHaveLength(1);
    expect(result.rows![0].eligibility).toBe('eligible');
    const { automaticEvidence } = require('../_shared/imageInventory/metadata/openLibrary/publisher');
    expect(automaticEvidence(query, result.rows![0].metadata!)).toEqual([]);
    // Empty truthful evidence would fail validation as coherent
    // (providerAdapter.ts:129); the guard returns the tie shape instead.
    expect(result.outcome.outcome).toBe('ambiguous_match');
    expect(result.outcome.selected).toBeNull();
    expect(result.outcome.evidence).toEqual([]);
    expect(result.outcome.secondaryEligible).toBe(true);
    expect(result.catalogueCompanions).toHaveLength(1);
    expect(result.retention).not.toBeNull();
    expect(calls.map((call) => call.stage)).toEqual(['search', 'editions', 'author:OL1A']);
    const validated = validatePacket(result, descriptor,
      { purpose: 'automatic', policyVersion: 1, evidence: independentEvidence(1) });
    expect(validated.outcome.outcome).toBe('ambiguous_match');
  });

  it('(f4-control-exact) exact title/author with unknown language stays coherent', async () => {
    const query = buildMetadataQueryIdentity({
      strategy: 'bibliographic',
      title: 'The Fixture Book',
      authors: ['Fixture Author'],
      isbnClue: null,
      language: 'en',
      editionClues: [],
    });
    const { result, descriptor } = await invoke(
      [{ publisher: 'Fixture Press', isbn13: null, language: null }], { query });
    expect(result.outcome.outcome).toBe('coherent_match');
    expect(result.outcome.evidence).toEqual(['exact_original_title', 'author_overlap']);
    const validated = validatePacket(result, descriptor,
      { purpose: 'automatic', policyVersion: 1, evidence: independentEvidence(1) });
    expect(validated.outcome.outcome).toBe('coherent_match');
  });

  it('(f4-control-language) fuzzy text with a known edition language stays coherent', async () => {
    const query = buildMetadataQueryIdentity({
      strategy: 'bibliographic',
      title: 'Antifragile',
      authors: ['Nassim Nicholas Taleb'],
      isbnClue: null,
      language: 'en',
      editionClues: [],
    });
    const { result, descriptor } = await invoke(
      [{
        publisher: 'Fixture Press', isbn13: null, authorKey: 'OL1A',
        title: 'Anti-Fragile',
      }],
      {
        query,
        authorNameFor: (key) => (key === 'OL1A' ? 'Nassim N Taleb' : 'Fixture Author'),
      });
    expect(result.rows![0].eligibility).toBe('eligible');
    expect(result.outcome.outcome).toBe('coherent_match');
    expect(result.outcome.evidence).toEqual(['language_compatible']);
    const validated = validatePacket(result, descriptor,
      { purpose: 'automatic', policyVersion: 1, evidence: independentEvidence(1) });
    expect(validated.outcome.outcome).toBe('coherent_match');
  });

  it('(t1-auto-isbn) REAL validator accepts the actual coherent automatic packet', async () => {
    const { result, descriptor } = await invoke([{ publisher: 'Fixture Press' }]);
    const validated = validatePacket(result, descriptor,
      { purpose: 'automatic', policyVersion: 1, evidence: independentEvidence(1) });
    expect(validated.outcome.outcome).toBe('coherent_match');
  });

  it('(t1-auto-noisbn) REAL validator accepts the actual no-ISBN coherent packet', async () => {
    const query = buildMetadataQueryIdentity({
      strategy: 'bibliographic',
      title: 'The Fixture Book',
      authors: ['Fixture Author'],
      isbnClue: null,
      language: 'en',
      editionClues: [],
    });
    const { result, descriptor } = await invoke(
      [{ publisher: 'Fixture Press', isbn13: null }], { query });
    const validated = validatePacket(result, descriptor,
      { purpose: 'automatic', policyVersion: 1, evidence: independentEvidence(1) });
    expect(validated.outcome.outcome).toBe('coherent_match');
    expect(validated.outcome.evidence).toEqual(
      ['exact_original_title', 'author_overlap', 'language_compatible']);
  });

  it('(t1-explicit) REAL validator accepts the actual edition_options packet', async () => {
    const { result, descriptor } = await invoke(
      [{ publisher: 'Fixture Press' }], { purpose: 'edition_options' });
    const validated = validatePacket(result, descriptor,
      { purpose: 'edition_options', policyVersion: 1, evidence: independentEvidence(1) });
    expect(validated.outcome.outcome).toBe('coherent_match');
  });

  it('(t1-cancelled) REAL validator accepts the actual cancellation packet', async () => {
    const controller = new AbortController();
    controller.abort();
    const { result, descriptor } = await invoke(
      [{ publisher: 'Fixture Press' }], { signal: controller.signal });
    expect(result.outcome.outcome).toBe('cancelled');
    const validated = validatePacket(result, descriptor,
      { purpose: 'automatic', policyVersion: 1, evidence: null });
    expect(validated.outcome.outcome).toBe('cancelled');
  });

  it('(t1-policy) REAL validator accepts an actual policy-denial packet', async () => {
    const { result, descriptor } = await invoke([{ publisher: 'Fixture Press' }], {
      throwOn: (stage) => stage === 'search'
        ? new OpenLibraryFailure('policy_denied', false) : null,
    });
    expect(result.outcome.outcome).toBe('policy_denied');
    const validated = validatePacket(result, descriptor,
      { purpose: 'automatic', policyVersion: 1, evidence: null });
    expect(validated.outcome.outcome).toBe('policy_denied');
  });

  it('(t1-zeroget) REAL validator accepts the actual zero-GET no-list packet', async () => {
    const query = zeroIsbnQuery('not-an-isbn');
    expect(query.strategy).toBe('isbn');
    expect(query.normalizedIsbn13).toBeNull();
    const { result, calls, descriptor } = await invoke(
      [{ publisher: 'Fixture Press' }], { query });
    expect(calls).toHaveLength(0);
    const validated = validatePacket(result, descriptor,
      { purpose: 'automatic', policyVersion: 1, evidence: null });
    expect(validated.outcome.outcome).toBe('no_acceptable_match');
  });

  it('(t1-negative) REAL validator rejects a tampered secondaryEligible flag', async () => {
    const { result, descriptor } = await invoke([{ publisher: 'Fixture Press' }]);
    expect(result.outcome.outcome).toBe('coherent_match');
    const tampered = {
      ...result,
      outcome: { ...result.outcome, secondaryEligible: true },
    };
    expect(() => validatePacket(tampered, descriptor,
      { purpose: 'automatic', policyVersion: 1, evidence: independentEvidence(1) }))
      .toThrow('P9_PROVIDER_RESULT_INVALID');
  });

  it('(t2-v1) v1 returns the HEAD zero-GET packet with zero fetches', async () => {
    const query = zeroIsbnQuery(null);
    expect(query.strategy).toBe('isbn');
    expect(query.normalizedIsbn13).toBeNull();
    let fetches = 0;
    const adapter = new OpenLibraryEditionOptionsAdapter({
      timeoutMs: 1000,
      maxResponseBytes: 64_000,
      fetcher: async () => {
        fetches += 1;
        return new Response('{}', { headers: { 'content-type': 'application/json' } });
      },
    });
    const packet = await adapter.lookupEditionOptions({
      query,
      correlationId: GOLDEN_LOOKUP_ID,
      attemptId: GOLDEN_ATTEMPT_ID,
      signal: new AbortController().signal,
    });
    expect(packet).toEqual({
      outcome: 'no_acceptable_match',
      retryable: false,
      rows: [],
      fetchedAt: null,
      retentionEvidence: null,
      providerRequestId: null,
    });
    expect('catalogueCompanions' in packet).toBe(false);
    expect(fetches).toBe(0);
  });

  it('(t2-v1-control) a valid ISBN performs requests', async () => {
    const query = zeroIsbnQuery('9780306406157');
    expect(query.strategy).toBe('isbn');
    expect(query.normalizedIsbn13).toBe('9780306406157');
    const fetched: string[] = [];
    const json = (body: unknown) => new Response(JSON.stringify(body), {
      headers: { 'content-type': 'application/json' },
    });
    const adapter = new OpenLibraryEditionOptionsAdapter({
      timeoutMs: 1000,
      maxResponseBytes: 64_000,
      fetcher: async (address: string | URL | Request) => {
        const url = new URL(address instanceof Request ? address.url : String(address));
        fetched.push(url.pathname);
        if (url.pathname === '/search.json') {
          return json({ docs: [{ key: '/works/OL1W', editions: { docs: [
            { key: '/books/OL100M', isbn: ['9780306406157'] },
          ] } }] });
        }
        if (url.pathname === '/books/OL100M.json') {
          return json({
            key: '/books/OL100M',
            title: 'The Fixture Book',
            authors: [{ key: '/authors/OL1A' }],
            languages: [{ key: '/languages/eng' }],
            isbn_13: ['9780306406157'],
            isbn_10: ['0306406152'],
            publish_date: '2024-03',
            publishers: ['Fixture Press'],
            covers: [123],
          });
        }
        if (url.pathname === '/authors/OL1A.json') {
          return json({ key: '/authors/OL1A', name: 'Fixture Author' });
        }
        return json({});
      },
    });
    const packet = await adapter.lookupEditionOptions({
      query,
      correlationId: GOLDEN_LOOKUP_ID,
      attemptId: GOLDEN_ATTEMPT_ID,
      signal: new AbortController().signal,
    });
    expect(fetched.length).toBeGreaterThan(0);
    expect(packet.rows).toHaveLength(1);
  });

  it('(t2-v2) v2 returns nulls with zero port GETs for an ISBN-less ISBN strategy', async () => {
    const query = zeroIsbnQuery('not-an-isbn');
    expect(query.strategy).toBe('isbn');
    expect(query.normalizedIsbn13).toBeNull();
    const { result, calls } = await invoke([{ publisher: 'Fixture Press' }], { query });
    expect(result.outcome.outcome).toBe('no_acceptable_match');
    expect(result.rows).toBeNull();
    expect(result.catalogueCompanions).toBeNull();
    expect(result.retention).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('(t2-v2-control) the same harness with a valid ISBN performs port GETs', async () => {
    const query = zeroIsbnQuery('9780306406157');
    expect(query.strategy).toBe('isbn');
    expect(query.normalizedIsbn13).toBe('9780306406157');
    const { result, calls } = await invoke([{ publisher: 'Fixture Press' }], {
      query,
      searchDocs: [{ key: '/works/OL1W', editions: { docs: [
        { key: '/books/OL100M', isbn: ['9780306406157'] },
      ] } }],
    });
    expect(calls.length).toBeGreaterThan(0);
    expect(result.rows).toHaveLength(1);
  });

  it('(d-404) a 404 author GET isolates only its dependent rows', async () => {
    const specs = [
      { publisher: 'First Press', authorKey: 'OL1A' },
      { publisher: 'Second Press', authorKey: 'OL2A' },
    ];
    const { result, calls } = await invoke(specs, {
      throwOn: (stage) => stage === 'author:OL2A'
        ? new OpenLibraryFailure('no_acceptable_match', false) : null,
    });
    expect(calls.map((call) => call.stage)).toEqual(
      ['search', 'editions', 'author:OL1A', 'author:OL2A']);
    expect(result.rows!.map((row) => row.eligibility)).toEqual(['eligible', 'unavailable']);
    expect(result.outcome.outcome).toBe('coherent_match');
    expect(result.outcome.selected?.publisher).toBe('First Press');
  });

  it('(d-abort) a network author failure aborts the round without rows or retention', async () => {
    const specs = [
      { publisher: 'First Press', authorKey: 'OL1A' },
      { publisher: 'Second Press', authorKey: 'OL2A' },
    ];
    const { result } = await invoke(specs, {
      throwOn: (stage) => stage === 'author:OL1A'
        ? new OpenLibraryFailure('network_failure', true) : null,
    });
    expect(result.outcome.outcome).toBe('network_failure');
    expect(result.outcome.retryable).toBe(true);
    expect(result.rows).toBeNull();
    expect(result.catalogueCompanions).toBeNull();
    expect(result.retention).toBeNull();
  });
});
