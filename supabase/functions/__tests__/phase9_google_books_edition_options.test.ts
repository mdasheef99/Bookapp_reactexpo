import { GoogleBooksAdapter } from '../_shared/imageInventory/metadata/googleBooks/adapter';
import { decodeGoogleBooksItem } from '../_shared/imageInventory/metadata/googleBooks/decoder';
import { buildMetadataQueryIdentity, METADATA_NORMALIZER_VERSION } from '../_shared/imageInventory/metadata/queryIdentity';
import { projectStoredEditionRow, StoredEditionRow } from '../_shared/imageInventory/contracts/ownerEditionPicker';
import { googleBooksEditionPickerFixtures as fixtures, googleBooksEditionRetentionFixtures as retention } from './fixtures/phase9/googleBooksResponses';
import { editionUuid } from './fixtures/phase9/editionPickerContracts';

import * as options from '../_shared/imageInventory/metadata/googleBooks/editionOptions';
const fetchedAt = '2026-10-07T00:00:00.000Z';
const query = (overrides = {}) => buildMetadataQueryIdentity({
  strategy: 'bibliographic', isbnClue: '0306406152', title: 'The Fixture Book',
  authors: ['Fixture Author'], language: 'en', editionClues: [], ...overrides,
});
function rows(raw: unknown, identity = query()): readonly StoredEditionRow[] {
  expect(typeof options.normalizeGoogleEditionRows).toBe('function');
  let next = 10;
  return options.normalizeGoogleEditionRows(raw, {
    correlationId: 'edition-correlation', attemptId: 'edition-attempt', fetchedAt,
    createOptionId: () => editionUuid(next++),
  }, identity);
}
const original = fixtures.exactIsbn.items[0];
function volume(fields = {}, id = 'test-volume') {
  return { id, volumeInfo: { ...original.volumeInfo, infoLink: 'https://books.google.com/books?id=' + id,
    imageLinks: { thumbnail: 'http://books.google.com/books/content?id=' + id }, ...fields } };
}
function adapter(fetcher: typeof fetch, extra = {}) {
  return new GoogleBooksAdapter({ mode: 'real', apiKey: 'synthetic-server-key', fetcher,
    timeoutMs: 30, maxResponseBytes: 64_000, ...extra });
}
const input = () => ({ query: query(), correlationId: 'edition-correlation',
  attemptId: 'edition-attempt', signal: new AbortController().signal });
async function lookup(subject: GoogleBooksAdapter, request = input()) {
  expect(typeof subject.lookupEditionOptions).toBe('function');
  return subject.lookupEditionOptions(request);
}
const response = (body: unknown, headers = {}) => new Response(JSON.stringify(body), {
  headers: { 'content-type': 'application/json', ...headers },
});

beforeAll(() => {
  if (!globalThis.crypto?.randomUUID) Object.defineProperty(globalThis, 'crypto', {
    configurable: true, value: require('node:crypto').webcrypto,
  });
});
afterEach(() => jest.useRealTimers());

// 02b sections 4.5/7.1: completion v2 requires row/lookup/attempt normalizer parity.
describe('Google normalizer version parity', () => {
  it.each(Object.entries(fixtures).filter(([, raw]) => 'items' in raw))('uses the shared normalizer for every available %s edition row', (_name, raw) => {
    for (const row of rows(raw)) {
      if (row.metadata !== null) expect(row.metadata.normalizerVersion).toBe(METADATA_NORMALIZER_VERSION);
    }
  });
  it('uses the shared normalizer for the legacy single-record decoder', () => {
    const decoded = decodeGoogleBooksItem(original, { correlationId: 'edition-correlation',
      attemptId: 'edition-attempt', fetchedAt });
    expect(decoded).not.toBeNull();
    expect(decoded!.normalizerVersion).toBe(METADATA_NORMALIZER_VERSION);
  });
});

describe('Task 3 original Google result positions (picker §§3/5/13.2)', () => {
  it('keeps ten positions and duplicate provider IDs with distinct opaque selection IDs', () => {
    const result = rows({ items: Array.from({ length: 10 }, (_, index) =>
      volume({ publishedDate: String(2000 + index) }, 'duplicate')) });
    expect(result.map(row => row.ordinal)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(result.map(row => row.metadata?.providerRecordId)).toEqual(Array(10).fill('duplicate'));
    expect(new Set(result.map(row => row.optionId)).size).toBe(10);
    expect(result.map(row => row.metadata?.publishedDate)).toEqual(['2000','2001','2002','2003','2004','2005','2006','2007','2008','2009']);
    expect(result.map(projectStoredEditionRow).map(row => row.ordinal)).toEqual([0,1,2,3,4,5,6,7,8,9]);
  });
  it('represents a null middle position without shifting the next result', () => {
    const result = rows(fixtures.unavailableMiddlePosition);
    expect(result.map(row => row.eligibility)).toEqual(['eligible', 'unavailable', 'eligible']);
    expect(result[1]).toEqual({ optionId: editionUuid(11), ordinal: 1,
      googleBooksUrl: null, eligibility: 'unavailable', metadata: null });
    expect(result[2].metadata?.providerRecordId).toBe('third-position');
    expect(result[2].ordinal).toBe(2);
  });
  it.each(['unrelatedAuthor', 'unrelatedTitle', 'incompatibleLanguage', 'incompatibleVolume'] as const)(
    'retains safe %s metadata with selection disabled', name => {
      const result = rows(fixtures[name]);
      expect(result[0].eligibility).toBe('ineligible');
      expect(result[0].metadata?.providerRecordId).toBe(fixtures[name].items[0].id);
      expect(result[0].googleBooksUrl).toContain('books.google.com/books?id=');
      expect(projectStoredEditionRow(result[0]).eligibility).toBe('ineligible');
    });
  it.each(['missingRequiredFields', 'conflictingIsbnPair'] as const)(
    'makes %s unavailable instead of silently repairing conflicting evidence', name => {
      expect(rows(fixtures[name])[0]).toMatchObject({ eligibility: 'unavailable', metadata: null, googleBooksUrl: null });
    });
  it('denies eleven rows and malformed envelopes instead of truncating or filtering', () => {
    expect(() => rows({ items: Array(11).fill(original) })).toThrow('P9_METADATA_MALFORMED_RESPONSE');
    expect(() => rows({ items: 'invalid' })).toThrow('P9_METADATA_MALFORMED_RESPONSE');
    expect(rows(fixtures.empty)).toEqual([]);
    expect(rows({ items: [] })).toEqual([]);
  });
  it('retains all authors and date precision without borrowing optional metadata', () => {
    const result = rows({ items: [volume({ authors: ['Fixture Author', 'Second Author'], publishedDate: '2024-03' }),
      ...fixtures.sparseOptionalFields.items] });
    expect(result[0].metadata).toMatchObject({ authors: ['Fixture Author', 'Second Author'], publishedDate: '2024-03',
      publisher: 'Fixture Press', isbn13: '9780306406157', description: 'Synthetic edition description.' });
    expect(result[1].metadata).toMatchObject({ coverReference: null, publishedDate: null, publisher: null,
      description: null, pageCount: null, editionStatement: null, format: null });
    expect(rows(fixtures.partialPublicationDate)[0].metadata?.publishedDate).toBe('2024');
    expect(rows(fixtures.exactIsbn)[0].metadata).toMatchObject({ format: null, editionStatement: null });
  });
  it('preserves all twenty authors supported by the shared metadata schema', () => {
    const authors = ['Fixture Author', ...Array.from({ length: 19 }, (_, index) => 'Author ' + index)];
    expect(rows({ items: [volume({ authors })] })[0].metadata?.authors).toEqual(authors);
  });
  it('preserves safe structured volume evidence without deriving an edition number', () => {
    expect(rows({ items: [volume({ seriesInfo: { volumeSeries: [{ orderNumber: 2 }] } })] })[0].metadata)
      .toMatchObject({ volume: '2', editionStatement: null, series: null, format: null });
  });
});

describe('Task 3 selection evidence (picker §4.1; DOC-3 §5.1)', () => {
  it.each(['exactIsbn', 'textOnlyMedium', 'alternateIsbn'] as const)('permits the coherent %s suggestion', name => {
    const row = rows(fixtures[name])[0];
    expect(row.eligibility).toBe('eligible');
    expect(options.evaluateEditionOption(query(), row.metadata!)).toBe('eligible');
    expect(row.metadata?.matchRationale).toContain(name === 'exactIsbn' ? 'exact_validated_isbn' : 'confirmation_required');
  });
  it('allows validated ISBN-only evidence but rejects contradictions in any supplied clue', () => {
    expect(rows(fixtures.exactIsbn, query({ title: '', authors: [] }))[0].eligibility).toBe('eligible');
    for (const overrides of [{ title: 'Another Book' }, { authors: ['Wrong Author'] }, { language: 'fr' }]) {
      expect(rows(fixtures.exactIsbn, query(overrides))[0].eligibility).toBe('ineligible');
    }
    expect(rows(fixtures.exactIsbn, query({ title: '', authors: [], isbnClue: null }))[0].eligibility).toBe('ineligible');
  });
  it('requires all supplied authors, normalized exact title and compatible primary language', () => {
    expect(rows({ items: [volume({ title: 'Ｔｈｅ Ｆｉｘｔｕｒｅ Ｂｏｏｋ', authors: ['Second Author', 'Fixture Author'], language: 'en-US' })] },
      query({ authors: ['Fixture Author', 'Second Author'], language: 'en-GB' }))[0].eligibility).toBe('eligible');
    expect(rows(fixtures.exactIsbn, query({ authors: ['Fixture Author', 'Missing Author'] }))[0].eligibility).toBe('ineligible');
    expect(rows(fixtures.exactIsbn, query({ authors: [], isbnClue: null }))[0].eligibility).toBe('ineligible');
  });
  it('does not promote text-only evidence or invalid observed ISBN to strong certainty', () => {
    expect(rows(fixtures.exactIsbn, query({ isbnClue: '9780306406158' }))[0].metadata?.matchRationale).toContain('confirmation_required');
    expect(rows(fixtures.textOnlyMedium)[0].metadata?.isbn13).toBeNull();
  });
  it('requires confirmation when the same validated ISBN has materially different returned records', () => {
    const result = rows(fixtures.duplicateProviderId);
    expect(result.map(row => row.metadata?.matchRationale)).toEqual([
      'confirmation_required_conflicting_isbn_records', 'confirmation_required_conflicting_isbn_records',
    ]);
  });
  it('does not treat publisher/year free-text clues as structured volume or edition evidence', () => {
    expect(rows(fixtures.exactIsbn, query({ editionClues: ['Fixture Press', '2020', 'Second edition'] }))[0].eligibility).toBe('eligible');
  });
  it('rejects a reliably different structured volume against the coherent observed-ISBN record', () => {
    const alternative = fixtures.alternateIsbn.items[0];
    const result = rows({ items: [volume({ seriesInfo: { bookDisplayNumber: '1' } }),
      { ...alternative, volumeInfo: { ...alternative.volumeInfo, seriesInfo: { bookDisplayNumber: '2' } } }] });
    expect(result.map(row => row.eligibility)).toEqual(['eligible', 'ineligible']);
    expect(result[1].metadata?.volume).toBe('2');
  });
  it('does not silently discard multiple valid ISBNs of one type', () => {
    expect(rows({ items: [volume({ industryIdentifiers: [
      { type: 'ISBN_13', identifier: '9780306406157' }, { type: 'ISBN_13', identifier: '9781861972712' },
    ] })] })[0]).toMatchObject({ metadata: null, eligibility: 'unavailable' });
  });
});

describe('Task 3 own-result identity and URL safety (picker §§5/13.2)', () => {
  it('upgrades same-result HTTP links and builds a missing book link from a bounded ID', () => {
    expect(rows({ items: [volume({ infoLink: 'http://books.google.com/books?id=test-volume' })] })[0])
      .toMatchObject({ googleBooksUrl: 'https://books.google.com/books?id=test-volume',
        metadata: { coverReference: 'https://books.google.com/books/content?id=test-volume' } });
    expect(rows({ items: [volume({ infoLink: undefined }, 'missing-link')] })[0].googleBooksUrl)
      .toBe('https://books.google.com/books?id=missing-link');
  });
  it.each(['https://evil.test/books?id=test-volume', 'javascript:alert(1)',
    'https://user:pass@books.google.com/books?id=test-volume', 'https://books.google.com:444/books?id=test-volume',
    'https://books.google.com/books?id=other-result', 'https://books.google.com.evil.test/books?id=test-volume'])(
    'does not retain unsafe/foreign book link %s', infoLink => {
      expect(rows({ items: [volume({ infoLink })] })[0]).toMatchObject({ metadata: null, eligibility: 'unavailable', googleBooksUrl: null });
    });
  it.each(['https://evil.test/cover', 'javascript:alert(1)', 'https://user:pass@books.google.com/books/content?id=test-volume',
    'https://books.google.com:444/books/content?id=test-volume', 'https://books.google.com/books/content?id=another-volume'])(
    'uses a missing-cover placeholder for unsafe/foreign cover %s', thumbnail => {
      expect(rows({ items: [volume({ imageLinks: { thumbnail } })] })[0])
        .toMatchObject({ eligibility: 'eligible', metadata: { coverReference: null } });
    });
  it.each(['bad id', '../other', 'x'.repeat(257), 'https://evil.test'])('rejects unsafe result identity %s', id => {
    expect(rows({ items: [volume({}, id)] })[0]).toMatchObject({ metadata: null, eligibility: 'unavailable' });
  });
  it('rejects unsafe required/optional metadata instead of mixing fields with a sibling', () => {
    expect(rows({ items: [volume({ title: '<script>bad</script>' }), volume({ pageCount: -1 })] })
      .map(row => row.metadata)).toEqual([null, null]);
  });
});

describe('Task 3 explicit adapter boundary (picker §§4.1/8/13.2)', () => {
  it('makes one original ten-result relevance request and preserves unavailable positions', async () => {
    const fetcher = jest.fn(async (_url: string | URL | Request) => response(fixtures.unavailableMiddlePosition, { 'x-request-id': 'synthetic-request' }));
    const result = await lookup(adapter(fetcher));
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.searchParams.get('maxResults')).toBe('10');
    expect(url.searchParams.get('orderBy')).toBe('relevance');
    expect(url.searchParams.get('startIndex')).toBe('0');
    expect(url.searchParams.get('projection')).toBe('full');
    expect(url.searchParams.get('q')).toBe('intitle:the fixture book inauthor:fixture author');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.rows.map(row => row.ordinal)).toEqual([0, 1, 2]);
    expect(result.rows[1].metadata).toBeNull();
    expect(result.providerRequestId).toBe('synthetic-request');
  });
  it.each([['exactIsbn', 'coherent_match'], ['textOnlyMedium', 'ambiguous_match'], ['duplicateProviderId', 'ambiguous_match']] as const)(
    'keeps %s certainty distinct from relevance order', async (name, expected) => {
      expect((await lookup(adapter(async () => response(fixtures[name])))).outcome).toBe(expected);
    });
  it('does not invoke an installed retention verifier on automatic winner lookup', async () => {
    const verifyOptionsRetention = jest.fn(() => retention.shorterDeadline);
    const automatic = await adapter(async () => response(fixtures.exactIsbn), { verifyOptionsRetention }).lookup(input());
    expect(automatic.selected?.providerRecordId).toBe('volume-exact-isbn');
    expect(automatic).not.toHaveProperty('rows');
    expect(automatic).not.toHaveProperty('retentionEvidence');
    expect(verifyOptionsRetention).not.toHaveBeenCalled();
  });
  it.each([['fixture', 'key'], ['real', null]] as const)('denies %s mode/missing credentials before any request', async (mode, apiKey) => {
    const fetcher = jest.fn();
    expect(await lookup(adapter(fetcher, { mode, apiKey }))).toMatchObject({ outcome: 'authentication_configuration_failure', rows: [], retentionEvidence: null });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([[429, 'rate_limited', true], [503, 'provider_unavailable', true], [401, 'authentication_configuration_failure', false],
    [403, 'authentication_configuration_failure', false], [404, 'malformed_response', false]] as const)(
    'maps HTTP %i without retaining its body', async (status, outcome, retryable) => {
      const result = await lookup(adapter(async () => new Response('private error body', { status })));
      expect(result).toMatchObject({ outcome, retryable, rows: [], fetchedAt: null, retentionEvidence: null });
      expect(JSON.stringify(result)).not.toContain('private error body');
    });
  it.each([['plain', { 'content-type': 'text/plain' }, 'unsupported_content_type'], ['{bad', { 'content-type': 'application/json' }, 'malformed_response'],
    ['{}', { 'content-type': 'application/json', 'content-length': '64001' }, 'response_too_large'],
    ['x'.repeat(64001), { 'content-type': 'application/json' }, 'response_too_large']] as const)(
    'rejects bounded/type/JSON failure case %#', async (body, headers, outcome) => {
      expect(await lookup(adapter(async () => new Response(body, { headers })))).toMatchObject({ outcome, rows: [] });
    });
  it('maps network failure and distinguishes timeout from in-flight/pre-call cancellation', async () => {
    expect(await lookup(adapter(async () => { throw new Error('private network detail'); }))).toMatchObject({ outcome: 'network_failure', retryable: true });
    const fetcher: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('abort')), { once: true });
    });
    expect(await lookup(adapter(fetcher))).toMatchObject({ outcome: 'timeout', retryable: true });
    const controller = new AbortController();
    const pending = lookup(adapter(fetcher), { ...input(), signal: controller.signal });
    controller.abort();
    expect(await pending).toMatchObject({ outcome: 'cancelled', retryable: false });
    const noCall = jest.fn();
    expect(await lookup(adapter(noCall), { ...input(), signal: controller.signal })).toMatchObject({ outcome: 'cancelled', rows: [] });
    expect(noCall).not.toHaveBeenCalled();
  });
  it('denies retention by default even with positive cache headers and client-shaped permission', async () => {
    jest.useFakeTimers(); jest.setSystemTime(new Date(fetchedAt));
    const result = await lookup(adapter(async () => response(fixtures.exactIsbn, { 'cache-control': 'public, max-age=3600' })),
      { ...input(), retentionEvidence: retention.shorterDeadline } as ReturnType<typeof input>);
    expect(result.retentionEvidence).toEqual(retention.unknownPermission);
    expect(options.resolveOptionsDeadline(result.fetchedAt!, result.retentionEvidence!)).toBeNull();
  });
  it('passes only actual allowlisted response evidence to a server verifier using original server UTC fetch time', async () => {
    jest.useFakeTimers(); jest.setSystemTime(new Date(fetchedAt));
    const verifyOptionsRetention = jest.fn(() => retention.shorterDeadline);
    const providerResponse = response(fixtures.exactIsbn, { 'cache-control': 'private, max-age=21600', expires: 'Wed, 07 Oct 2026 06:00:00 GMT',
      'x-private-debug': 'do not retain', 'x-request-id': 'synthetic-request' });
    const read = providerResponse.arrayBuffer.bind(providerResponse);
    providerResponse.arrayBuffer = async () => { jest.setSystemTime(new Date('2026-10-07T01:00:00.000Z')); return read(); };
    const result = await lookup(adapter(async () => providerResponse, { verifyOptionsRetention }));
    expect(verifyOptionsRetention).toHaveBeenCalledWith({ fetchedAt,
      cacheControl: 'private, max-age=21600', expires: 'Wed, 07 Oct 2026 06:00:00 GMT', responseDate: null, age: null });
    expect(result.fetchedAt).toBe(fetchedAt);
    expect(result.rows[0].metadata?.fetchedAt).toBe(fetchedAt);
    expect(result.retentionEvidence).toEqual(retention.shorterDeadline);
    expect(JSON.stringify(result)).not.toContain('do not retain');
  });
  it.each(['no-store', 'NO-CACHE', 'public, max-age=0'])('denies provider cache prohibition %s despite a permissive verifier', async cacheControl => {
    jest.useFakeTimers(); jest.setSystemTime(new Date(fetchedAt));
    const result = await lookup(adapter(async () => response(fixtures.exactIsbn, { 'cache-control': cacheControl }),
      { verifyOptionsRetention: () => retention.productCap }));
    expect(result.retentionEvidence).toEqual(retention.unknownPermission);
  });
  it.each(['max-age="3600', 'max-age=invalid', 'max-age=1, max-age=2'])(
    'denies malformed/ambiguous lifetime evidence %s', async cacheControl => {
    jest.useFakeTimers(); jest.setSystemTime(new Date(fetchedAt));
      const result = await lookup(adapter(async () => response(fixtures.exactIsbn, { 'cache-control': cacheControl }),
        { verifyOptionsRetention: () => retention.productCap }));
      expect(result.retentionEvidence).toEqual(retention.unknownPermission);
    });
  it('shortens a verified deadline by actual cache age and Expires evidence', async () => {
    jest.useFakeTimers(); jest.setSystemTime(new Date(fetchedAt));
    const result = await lookup(adapter(async () => response(fixtures.exactIsbn, {
      'cache-control': 'private, max-age=3600', age: '600', expires: 'Wed, 07 Oct 2026 00:45:00 GMT',
    }), { verifyOptionsRetention: () => retention.productCap }));
    expect(result.retentionEvidence).toEqual({ storagePermissionVerified: true, permittedDeadlineAt: '2026-10-07T00:45:00.000Z' });
  });
  it('fails closed when the server verifier throws or supplies an unknown deadline', async () => {
    for (const verifyOptionsRetention of [() => { throw new Error('private verification failure'); }, () => retention.unknownDeadline]) {
      const result = await lookup(adapter(async () => response(fixtures.exactIsbn), { verifyOptionsRetention }));
      expect(result.rows).toHaveLength(1);
      expect(options.resolveOptionsDeadline(result.fetchedAt!, result.retentionEvidence!)).toBeNull();
    }
  });
});

describe('Task 3 retention deadline (picker §§8/13.2)', () => {
  it.each([[retention.shorterDeadline, '2026-10-07T06:00:00.000Z'], [retention.productCap, '2026-10-08T00:00:00.000Z'],
    [retention.unknownPermission, null], [retention.unknownDeadline, null],
    [{ storagePermissionVerified: false, permittedDeadlineAt: '2026-10-10T00:00:00Z' }, null],
    [{ storagePermissionVerified: true, permittedDeadlineAt: '2026-10-07T00:00:00Z' }, null],
    [{ storagePermissionVerified: true, permittedDeadlineAt: '2026-10-06T23:59:59Z' }, null],
    [{ storagePermissionVerified: true, permittedDeadlineAt: 'invalid' }, null],
    [{ storagePermissionVerified: true, permittedDeadlineAt: '2026-10-07T06:00:00' }, null],
    [{ storagePermissionVerified: true, permittedDeadlineAt: '2026-10-07T06:30:00+05:30' }, '2026-10-07T01:00:00.000Z']] as const)(
    'uses verified evidence %j -> %s', (evidence, deadline) => {
      expect(typeof options.resolveOptionsDeadline).toBe('function');
      expect(options.resolveOptionsDeadline(fetchedAt, evidence)).toBe(deadline);
    });
  it('rejects an invalid or timezone-free original fetch timestamp', () => {
    expect(typeof options.resolveOptionsDeadline).toBe('function');
    expect(options.resolveOptionsDeadline('invalid', retention.productCap)).toBeNull();
    expect(options.resolveOptionsDeadline('2026-10-07T00:00:00', retention.productCap)).toBeNull();
  });
});
