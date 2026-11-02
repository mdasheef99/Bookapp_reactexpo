// Captures the pre-refactor provider packets with a fixed clock and fixed UUIDs.
// Test-only helper: used by providerReplacementGoldens.capture.test.ts so the
// golden fixture is never hand-written. Run with:
//   node node_modules/jest/bin/jest.js --runInBand --runTestsByPath supabase/functions/__tests__/providerReplacementGoldens.capture.test.ts
import { GoogleBooksAdapter } from '../../_shared/imageInventory/metadata/googleBooks/adapter';
import { OpenLibraryEditionOptionsAdapter } from '../../_shared/imageInventory/metadata/openLibrary/adapter';
import { buildMetadataQueryIdentity } from '../../_shared/imageInventory/metadata/queryIdentity';
import { googleBooksMultipleVolumes } from '../fixtures/phase9/googleBooksResponses';
import { tenPositions } from '../fixtures/phase9/editionOptionsWorker';

export const GOLDEN_CLOCK = '2026-11-02T12:00:00.000Z';
export const GOLDEN_LOOKUP_ID = '11111111-1111-4111-8111-111111111111';
export const GOLDEN_ATTEMPT_ID = '22222222-2222-4222-8222-222222222222';

export type GoldenUuidSequences = Readonly<{
  googleExplicitOptionIds: readonly string[];
  openLibraryOptionIds: readonly string[];
}>;

export type CapturedProviderGoldens = Readonly<{
  GOOGLE_AUTOMATIC_V1: unknown;
  GOOGLE_EXPLICIT_V1: unknown;
  OL_V1_EXPLICIT_V1: unknown;
}>;

const query = buildMetadataQueryIdentity({
  strategy: 'bibliographic',
  isbnClue: '9780306406157',
  title: 'The Fixture Book',
  authors: ['Fixture Author'],
  language: 'en',
  editionClues: [],
});

const olQuery = buildMetadataQueryIdentity({
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

const asJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function sequence(ids: readonly string[]): () => string {
  let index = 0;
  return () => {
    const value = ids[index];
    index += 1;
    if (!value) throw new Error('P9_GOLDEN_UUID_SEQUENCE_EXHAUSTED');
    return value;
  };
}

export async function withUuidSequence<T>(ids: readonly string[], run: () => Promise<T>): Promise<T> {
  if (!globalThis.crypto?.randomUUID) {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: require('node:crypto').webcrypto,
    });
  }
  const original = globalThis.crypto.randomUUID;
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    configurable: true,
    value: sequence(ids),
  });
  try {
    return await run();
  } finally {
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: original,
    });
  }
}

export async function captureProviderGoldens(
  ids: GoldenUuidSequences,
): Promise<CapturedProviderGoldens> {
  const googleAutomatic = await new GoogleBooksAdapter({
    mode: 'real',
    apiKey: 'fixture-only-no-network',
    timeoutMs: 1000,
    maxResponseBytes: 64_000,
    fetcher: async () => jsonResponse(googleBooksMultipleVolumes, {
      'x-request-id': 'golden-google-automatic-request',
    }),
  }).lookup({
    query,
    correlationId: GOLDEN_LOOKUP_ID,
    attemptId: GOLDEN_ATTEMPT_ID,
    signal: new AbortController().signal,
  });

  const googleExplicit = await withUuidSequence(ids.googleExplicitOptionIds, () => (
    new GoogleBooksAdapter({
      mode: 'real',
      apiKey: 'fixture-only-no-network',
      timeoutMs: 1000,
      maxResponseBytes: 64_000,
      verifyOptionsRetention: ({ fetchedAt }) => ({
        storagePermissionVerified: true,
        permittedDeadlineAt: new Date(Date.parse(fetchedAt) + 3_600_000).toISOString(),
      }),
      fetcher: async () => jsonResponse(tenPositions, {
        'cache-control': 'private, max-age=3600',
        'x-request-id': 'golden-google-explicit-request',
      }),
    }).lookupEditionOptions({
      query,
      correlationId: GOLDEN_LOOKUP_ID,
      attemptId: GOLDEN_ATTEMPT_ID,
      signal: new AbortController().signal,
    })
  ));

  const openLibraryExplicit = await withUuidSequence(ids.openLibraryOptionIds, () => (
    new OpenLibraryEditionOptionsAdapter({
      timeoutMs: 1000,
      maxResponseBytes: 64_000,
      fetcher: async (address: string | URL | Request) => {
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
          key: '/authors/OL1A',
          name: 'Fixture Author',
        });
        return jsonResponse({}, { });
      },
    }).lookupEditionOptions({
      query: olQuery,
      correlationId: GOLDEN_LOOKUP_ID,
      attemptId: GOLDEN_ATTEMPT_ID,
      signal: new AbortController().signal,
    })
  ));

  return {
    GOOGLE_AUTOMATIC_V1: asJson(googleAutomatic),
    GOOGLE_EXPLICIT_V1: asJson(googleExplicit),
    OL_V1_EXPLICIT_V1: asJson(openLibraryExplicit),
  };
}
