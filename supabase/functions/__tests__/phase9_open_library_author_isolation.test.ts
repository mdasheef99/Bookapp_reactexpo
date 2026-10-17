// DOC-3 §5.2.1; picker §§5/13.14: safe author allocation and independent-row failure isolation.
import { buildMetadataQueryIdentity } from '../_shared/imageInventory/metadata/queryIdentity';
import { OpenLibraryEditionOptionsAdapter } from '../_shared/imageInventory/metadata/openLibrary/adapter';
import type { EditionHttpHooks } from '../_shared/imageInventory/metadata/openLibrary/transport';

const identity = buildMetadataQueryIdentity({
  strategy: 'bibliographic', title: 'The Fixture Book', authors: ['Fixture Author'],
  isbnClue: null, language: 'en', editionClues: [],
});
const edition = (extra: Record<string, unknown> = {}) => ({
  key: '/books/OL100M', title: 'The Fixture Book', authors: [{ key: '/authors/OL1A' }],
  languages: [{ key: '/languages/eng' }], publish_date: '2024', publishers: ['Fixture Press'], ...extra,
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
});
async function lookup(entries: unknown[], badAuthor?: () => Response, query = identity,
  searchDoc: Record<string, unknown> = { key: '/works/OL1W' }) {
  const requests: string[] = [];
  const receipts: Array<Parameters<EditionHttpHooks['afterRequest']>[0]> = [];
  const adapter = new OpenLibraryEditionOptionsAdapter({
    timeoutMs: 1000, maxResponseBytes: 64_000,
    fetcher: async address => {
      const path = new URL(address instanceof Request ? address.url : String(address)).pathname;
      requests.push(path);
      if (path === '/search.json') return json({ docs: [searchDoc] });
      if (path === '/works/OL1W/editions.json') return json({ entries });
      if (path === '/authors/OL2A.json' && badAuthor) return badAuthor();
      return json({ key: path.replace(/\.json$/u, ''), name: 'Fixture Author' });
    },
  });
  const result = await adapter.lookupEditionOptions({
    query, correlationId: 'author-isolation-lookup', attemptId: 'author-isolation-attempt',
    signal: new AbortController().signal,
    httpHooks: { beforeRequest: async () => {}, afterRequest: async call => { receipts.push(call); } },
  });
  return { result, requests, receipts };
}
beforeAll(() => {
  if (!globalThis.crypto?.randomUUID) Object.defineProperty(globalThis, 'crypto', {
    configurable: true, value: require('node:crypto').webcrypto,
  });
});

it.each([
  ['publisher shape', { publishers: 'invalid' }],
  ['publisher entry', { publishers: [7] }],
  ['publisher bound', { publishers: ['x'.repeat(257)] }],
  ['subtitle type', { subtitle: 7 }],
  ['subtitle bound', { subtitle: 'x'.repeat(513) }],
  ['publication date type', { publish_date: ['2024'] }],
  ['publication date bound', { publish_date: 'x'.repeat(33) }],
  ['edition statement', { edition_name: { value: 'Second' } }],
  ['format', { physical_format: ['Hardcover'] }],
  ['page count', { number_of_pages: 0 }],
] as const)('does not spend author slots on invalid %s facts', async (_field, invalid) => {
  const { result, requests } = await lookup([
    edition({ authors: [1,2,3,4].map(id => ({ key: '/authors/OL' + id + 'A' })), ...invalid }),
    edition({ key: '/books/OL101M', authors: [{ key: '/authors/OL5A' }] }),
  ]);
  expect(result.rows.map(row => row.ordinal)).toEqual([0, 1]);
  expect(result.rows[0]).toMatchObject({ eligibility: 'unavailable', metadata: null });
  expect(result.rows[1]).toMatchObject({ eligibility: 'eligible', metadata: { authors: ['Fixture Author'] } });
  expect(requests).toEqual(['/search.json', '/works/OL1W/editions.json', '/authors/OL5A.json']);
});

const authorFailures = [
  ['malformed_response', () => new Response('{', { headers: { 'content-type': 'application/json' } })],
  ['unsupported_content_type', () => new Response('invalid', { headers: { 'content-type': 'text/html' } })],
  ['response_too_large', () => new Response('{}', {
    headers: { 'content-type': 'application/json', 'content-length': '64001' },
  })],
] as const;
for (const [outcome, failure] of authorFailures) {
  it.each([false, true])('isolates ' + outcome + ' with failed author first=%s', async failedFirst => {
    const broken = edition({ authors: [{ key: '/authors/OL2A' }] });
    const good = edition({ key: '/books/OL101M' });
    const { result, requests, receipts } = await lookup(failedFirst ? [broken, good] : [good, broken], failure);
    expect(result.outcome).toBe('ambiguous_match');
    expect(result.rows.map(row => row.ordinal)).toEqual([0, 1]);
    expect(result.rows[failedFirst ? 0 : 1]).toMatchObject({ eligibility: 'unavailable', metadata: null });
    expect(result.rows[failedFirst ? 1 : 0]).toMatchObject({
      eligibility: 'eligible', metadata: { providerRecordId: 'OL101M', authors: ['Fixture Author'] },
    });
    expect(requests).toHaveLength(4);
    expect(receipts.find(call => call.stage === 'author:OL2A')).toMatchObject({
      outcome, retryable: false, physicalStatus: 'finalized', egressStarted: true,
    });
  });
}
it.each([
  [401, 'authentication_configuration_failure', false],
  [429, 'rate_limited', true],
  [503, 'provider_unavailable', true],
] as const)('keeps author HTTP %s as a whole-lookup failure', async (status, outcome, retryable) => {
  const { result, receipts } = await lookup([
    edition(), edition({ key: '/books/OL101M', authors: [{ key: '/authors/OL2A' }] }),
  ], () => json({}, status));
  expect(result).toMatchObject({ outcome, retryable, rows: [], retentionEvidence: null });
  expect(receipts.find(call => call.stage === 'author:OL2A')).toMatchObject({ outcome, retryable });
});

it('skips a whole preferred row that cannot fit the remaining author budget', async () => {
  const withAuthors = (id: number, authors: number[]) => edition({
    key: '/books/OL' + id + 'M', authors: authors.map(author => ({ key: '/authors/OL' + author + 'A' })),
  });
  const { result, requests } = await lookup([
    withAuthors(100, [1,2,3]), withAuthors(101, [4,5]), withAuthors(102, [6]),
  ]);
  expect(result.rows.map(row => row.ordinal)).toEqual([0,1,2]);
  expect(result.rows.map(row => row.eligibility)).toEqual(['eligible','unavailable','eligible']);
  expect(result.rows[2].metadata!.authors).toEqual(['Fixture Author']);
  expect(requests).toEqual(['/search.json','/works/OL1W/editions.json',
    '/authors/OL1A.json','/authors/OL2A.json','/authors/OL3A.json','/authors/OL6A.json']);
});
const unknownLanguageIsbn = buildMetadataQueryIdentity({
  strategy: 'bibliographic', title: 'The Fixture Book', authors: ['Fixture Author'],
  isbnClue: '9780306406157', language: 'und', editionClues: [],
});
it.each([
  ['nonstring key', [{ key: 7 }]],
  ['null reference', [null]],
  ['wrong path', [{ key: '/language/eng' }]],
] as const)('rejects a malformed %s language reference before author allocation', async (_shape, languages) => {
  const { result, requests } = await lookup([
    edition({ isbn_13: ['9780306406157'], languages,
      authors: [1,2,3,4].map(id => ({ key: '/authors/OL' + id + 'A' })) }),
    edition({ key: '/books/OL101M', isbn_13: ['9780306406157'], authors: [{ key: '/authors/OL5A' }] }),
  ], undefined, unknownLanguageIsbn);
  expect(result.rows[0]).toMatchObject({ eligibility: 'unavailable', metadata: null });
  expect(result.rows[1]).toMatchObject({ eligibility: 'eligible', metadata: { language: 'en' } });
  expect(requests).toEqual(['/search.json','/works/OL1W/editions.json','/authors/OL5A.json']);
});
it.each([
  ['missing', undefined],
  ['empty', []],
  ['valid-shaped unmapped', [{ key: '/languages/swe' }]],
] as const)('preserves %s language as und with exact ISBN evidence', async (_shape, languages) => {
  const { result } = await lookup([edition({ isbn_13: ['9780306406157'], languages })],
    undefined, unknownLanguageIsbn);
  expect(result.rows[0]).toMatchObject({ eligibility: 'eligible', metadata: {
    language: 'und', matchRationale: 'exact_validated_isbn',
  } });
});

// Owner decision 2026-10-17 / picker §13.14 amendment: work-level authors only for author-less editions.
describe('work-level authors', () => {
  const work = { key: '/works/OL1W', author_key: ['OL7A'] };
  it('lets an edition without author references use its work authors', async () => {
    const { result, requests } = await lookup([edition({ authors: undefined })], undefined, identity, work);
    expect(result.rows[0]).toMatchObject({ eligibility: 'eligible', metadata: { authors: ['Fixture Author'] } });
    expect(requests).toEqual(['/search.json', '/works/OL1W/editions.json', '/authors/OL7A.json']);
  });
  it('treats an empty author list like a missing one', async () => {
    const { result } = await lookup([edition({ authors: [] })], undefined, identity, work);
    expect(result.rows[0]).toMatchObject({ eligibility: 'eligible' });
  });
  it('never replaces the edition own authors with the work authors', async () => {
    const { result, requests } = await lookup([edition()], undefined, identity, work);
    expect(result.rows[0]).toMatchObject({ eligibility: 'eligible' });
    expect(requests).toEqual(['/search.json', '/works/OL1W/editions.json', '/authors/OL1A.json']);
  });
  it.each([
    ['missing', { key: '/works/OL1W' }], ['malformed', { key: '/works/OL1W', author_key: ['/authors/OL7A'] }],
    ['not a list', { key: '/works/OL1W', author_key: 'OL7A' }],
    ['too many', { key: '/works/OL1W', author_key: Array.from({ length: 21 }, (_, i) => 'OL' + (i + 1) + 'A') }],
  ] as const)('keeps an author-less edition unavailable when work authors are %s', async (_label, doc) => {
    const { result, requests } = await lookup([edition({ authors: undefined })], undefined, identity, doc);
    expect(result.rows[0]).toMatchObject({ eligibility: 'unavailable', metadata: null });
    expect(requests).toEqual(['/search.json', '/works/OL1W/editions.json']);
  });
});
