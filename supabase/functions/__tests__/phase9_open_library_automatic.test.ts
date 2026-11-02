// RED for AC8-2/AC8-4/AC8-16: OL v2 automatic lookup does not exist yet.
// V2 is exercised through the SDD §5.1 descriptor.invoke(ProviderHttpPort)
// interface; the v1 adapter guard stays an explicit control.
import { buildMetadataQueryIdentity } from '../_shared/imageInventory/metadata/queryIdentity';
import { OpenLibraryEditionOptionsAdapter } from '../_shared/imageInventory/metadata/openLibrary/adapter';
import {
  GOLDEN_ATTEMPT_ID, GOLDEN_LOOKUP_ID, GOLDEN_CLOCK, PUBLISHER_CASES,
} from './fixtures/phase9/providerReplacementGoldens';
import { installedDescriptor } from './support/providerModules';
import { withUuidSequence } from './support/captureProviderGoldens';
import { OL_V2_EXPLICIT_FROZEN } from './fixtures/phase9/providerReplacementTargets';

const queryWithClue = (publisherClue: string | null) => buildMetadataQueryIdentity({
  strategy: 'bibliographic',
  title: 'The Fixture Book',
  authors: ['Fixture Author'],
  isbnClue: '9780306406157',
  language: 'en',
  editionClues: publisherClue === null ? [] : [publisherClue],
});

const response = (body: unknown) => new Response(JSON.stringify(body), {
  headers: { 'content-type': 'application/json' },
});

type EditionSpec = Readonly<{
  publisher: string | null;
  isbn13?: string | null;
  authorKey?: string;
  authorName?: string;
  title?: string;
}>;

const edition = (index: number, spec: EditionSpec) => {
  const authorKey = spec.authorKey ?? 'OL1A';
  const record: Record<string, unknown> = {
    key: `/books/OL${100 + index}M`,
    title: spec.title ?? 'The Fixture Book',
    authors: [{ key: `/authors/${authorKey}` }],
    languages: [{ key: '/languages/eng' }],
    publishers: spec.publisher === null ? [] : [spec.publisher],
    covers: [123],
    publish_date: '2024-03',
  };
  const isbn13 = spec.isbn13 === undefined ? '9780306406157' : spec.isbn13;
  if (isbn13 !== null) record.isbn_13 = [isbn13];
  if (isbn13 === '9780306406157') record.isbn_10 = ['0306406152'];
  return record;
};

function subject(specs: readonly EditionSpec[], responseHeaders: (stage: string) => Record<string, string>) {
  const entries = specs.map((spec, index) => edition(index, spec));
  const authorNames = new Map<string, string>();
  for (const spec of specs) {
    authorNames.set(spec.authorKey ?? 'OL1A', spec.authorName ?? 'Fixture Author');
  }
  const jsonFor = (url: URL): unknown => {
    if (url.pathname === '/search.json') return { docs: [{ key: '/works/OL1W' }] };
    if (url.pathname === '/works/OL1W/editions.json') return { entries };
    const author = /^\/authors\/(OL[1-9][0-9]*A)\.json$/u.exec(url.pathname);
    if (author) return { key: `/authors/${author[1]}`, name: authorNames.get(author[1]) ?? 'Fixture Author' };
    return {};
  };
  const calls: Array<{ url: URL; stage: string; sequence: number }> = [];
  const http = {
    async get(input: Readonly<{ url: URL; stage: string; sequence: number }>) {
      calls.push({ url: new URL(input.url), stage: input.stage, sequence: input.sequence });
      return {
        json: jsonFor(input.url),
        headers: new Headers(responseHeaders(input.stage)),
        receiptId: `00000000-0000-4000-8000-${String(calls.length).padStart(12, '0')}`,
      };
    },
  };
  return { entries, http, calls };
}

async function invoke(specs: readonly EditionSpec[], publisherClue: string | null = null,
  purpose: 'automatic' | 'edition_options' = 'automatic',
  responseHeaders = (_stage: string): Record<string, string> => ({ 'cache-control': 'max-age=86400' })) {
  const descriptor = installedDescriptor('open_library', '2.0.0');
  expect(descriptor).toBeDefined();
  expect(descriptor?.invoke).toEqual(expect.any(Function));
  const { entries, http, calls } = subject(specs, responseHeaders);
  const result = await withUuidSequence(Array.from({ length: 10 }, (_, i) =>
    `44444444-4444-4444-8333-${String(i + 1).padStart(12, '0')}`), () => descriptor!.invoke({
    query: queryWithClue(publisherClue),
    correlationId: GOLDEN_LOOKUP_ID,
    attemptId: GOLDEN_ATTEMPT_ID,
    signal: new AbortController().signal,
    purpose,
    http,
  }));
  return { result, entries, calls };
}

const expectExplicitSummary = (result: { rows: readonly any[]; outcome: any }) => {
  expect(result.outcome.outcome).toBe('coherent_match');
  expect(result.outcome.retryable).toBe(false);
  expect(Array.isArray(result.outcome.evidence)).toBe(true);
  expect(result.outcome.selected).not.toBeNull();
  expect(result.outcome.candidates).toEqual(expect.arrayContaining([result.outcome.selected]));
  expect(result.rows.some((row: any) => row.eligibility === 'eligible'
    && JSON.stringify(row.metadata) === JSON.stringify(result.outcome.selected))).toBe(true);
};

describe('Phase 9 Open Library v2 automatic lookup', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(Date.parse(GOLDEN_CLOCK)); });
  afterEach(() => jest.useRealTimers());
  it('keeps the v1 automatic guard even though the v2 descriptor is installed', async () => {
    const adapter = new OpenLibraryEditionOptionsAdapter({
      timeoutMs: 1000,
      maxResponseBytes: 64_000,
      fetcher: async () => response({}),
    });
    await expect(adapter.lookup()).rejects.toThrow(
      'P9_OPEN_LIBRARY_AUTOMATIC_LOOKUP_FORBIDDEN',
    );
  });

  it('returns a coherent ranked outcome instead of the v1 forbidden error', async () => {
    const { result } = await invoke([
      { publisher: 'Faber' },
      { publisher: 'HarperCollins' },
    ], 'Faber & Faber');
    expect(result.outcome.outcome).toBe('coherent_match');
    expect(result.outcome.selected?.publisher).toBe('Faber');
    expect(result.outcome.selected?.adapterVersion).toBe('2.0.0');
  });

  it('returns the v2 list, companions and retention packet for automatic use', async () => {
    const { result, calls } = await invoke([
      { publisher: 'Faber' },
      { publisher: 'HarperCollins' },
    ], 'Faber & Faber');
    expect(result).toMatchObject({
      version: 'p9-metadata-result-v2',
      purpose: 'automatic',
      rows: expect.any(Array),
      catalogueCompanions: expect.any(Array),
    });
    expect(result.rows).toHaveLength(2);
    expect(result.catalogueCompanions).toHaveLength(2);
    expect(result.retention).toMatchObject({
      retentionContract: 'open-library-options-v1',
      storagePermissionVerified: true,
    });
    expect(calls.map(call => call.stage)).not.toContain('isbn');
    expect(calls.filter(call => call.stage.startsWith('author:'))).toHaveLength(1);
    expect(calls.length).toBeLessThanOrEqual(6);
  });

  it('preserves the frozen v2 explicit rows, companions and lineage through the descriptor port', async () => {
    const { result, calls } = await invoke([{ publisher: 'Fixture Press' }], null, 'edition_options');
    // The runbook freezes ordered rows, companions, facts, deadlines and the
    // approved tuple change; the separate explicit summary is checked only for
    // its documented invariants.
    expect({
      version: result.version, purpose: result.purpose,
      rows: result.rows, catalogueCompanions: result.catalogueCompanions,
      retention: result.retention,
    }).toEqual(OL_V2_EXPLICIT_FROZEN);
    expectExplicitSummary(result);
    expect(calls.map(call => [call.url.origin, call.stage, call.sequence])).toEqual([
      ['https://openlibrary.org', 'search', 0],
      ['https://openlibrary.org', 'editions', 1],
      ['https://openlibrary.org', 'author:OL1A', 2],
    ]);
  });

  it.each(['search', 'editions', 'author:OL1A'])('denies retained lists when actual %s headers say no-store', async deniedStage => {
    const { result } = await invoke([{ publisher: 'Fixture Press' }], null, 'edition_options', stage => ({
      'cache-control': stage === deniedStage ? 'no-store' : 'max-age=86400',
    }));
    expect(result.rows).toBeNull(); expect(result.catalogueCompanions).toBeNull(); expect(result.retention).toBeNull();
  });

  it.each(['search', 'editions', 'author:OL1A'])('bounds the complete packet by the earliest actual %s deadline', async earlyStage => {
    const { result } = await invoke([{ publisher: 'Fixture Press' }], null, 'edition_options', stage => ({
      'cache-control': stage === earlyStage ? 'max-age=30' : 'max-age=120',
    }));
    expect({
      version: result.version, purpose: result.purpose,
      rows: result.rows, catalogueCompanions: result.catalogueCompanions,
      retention: result.retention,
    }).toEqual({ ...OL_V2_EXPLICIT_FROZEN, retention: {
      ...OL_V2_EXPLICIT_FROZEN.retention,
      permittedDeadlineAt: new Date(Date.parse(GOLDEN_CLOCK) + 30000).toISOString(),
    } });
    expectExplicitSummary(result);
  });

  it.each(PUBLISHER_CASES.filter((entry) => !('tie' in entry)))(
    'publisher signal resolves %j only when the bounded token overlap matches',
    async (entry) => {
      const { result } = await invoke([
        { publisher: entry.publisher },
        { publisher: 'Unrelated Press' },
      ], entry.clue);
      if (entry.signal === 1) {
        expect(result.outcome.outcome).toBe('coherent_match');
        expect(result.outcome.selected?.publisher).toBe(entry.publisher);
      } else {
        expect(result.outcome.outcome).toBe('ambiguous_match');
        expect(result.outcome.selected).toBeNull();
      }
    },
  );

  it('treats equal secondary scores and equal publisher signal as ambiguous', async () => {
    const { result } = await invoke([
      { publisher: 'Penguin' },
      { publisher: 'Penguin Random House' },
    ], 'Penguin');
    expect(result.outcome.outcome).toBe('ambiguous_match');
    expect(result.outcome.selected).toBeNull();
  });

  it('never lets publisher evidence beat stronger secondary evidence among two eligible identities', async () => {
    const { result } = await invoke([
      { publisher: 'Penguin', isbn13: null },
      { publisher: 'HarperCollins', isbn13: '9780306406157' },
    ], 'Penguin');
    expect(result.outcome.outcome).toBe('coherent_match');
    expect(result.outcome.selected?.publisher).toBe('HarperCollins');
    expect(result.outcome.selected?.isbn13).toBe('9780306406157');
    expect(result.rows.map((row: { eligibility: string }) => row.eligibility)).toEqual(['eligible', 'eligible']);
  });

  it('never promotes an ISBN match whose supplied title conflicts with the query', async () => {
    const { result } = await invoke([
      { publisher: 'Penguin', title: 'A Different Book' },
      { publisher: 'Unrelated Press', isbn13: null },
    ], 'Penguin');
    expect(result.rows.map((row: { eligibility: string }) => row.eligibility)).toEqual(['ineligible', 'eligible']);
    expect(result.outcome.selected?.providerRecordId).toBe('OL101M');
  });

  it('does not change eligible candidates when publisher facts are missing or noisy', async () => {
    const { result } = await invoke([
      { publisher: null },
      { publisher: 'Noisy !!! Publisher ???' },
    ], 'Penguin');
    expect(result.rows).toHaveLength(2);
    expect(result.outcome.outcome).toBe('ambiguous_match');
  });

  it('caps the round at four author GETs and six total GETs without an isbn stage', async () => {
    const specs = Array.from({ length: 6 }, (_, index) => ({
      publisher: 'Fixture Press',
      authorKey: `OL${index + 1}A`,
      authorName: `Fixture Author ${index + 1}`,
    }));
    const { calls } = await invoke(specs);
    expect(calls.map(call => call.stage).filter(stage => stage.startsWith('author:')))
      .toHaveLength(4);
    expect(calls).toHaveLength(6);
    expect(calls.map(call => call.stage)).not.toContain('isbn');
    expect(calls.map(call => call.sequence)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
