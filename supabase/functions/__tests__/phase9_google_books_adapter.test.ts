import {
  GOOGLE_BOOKS_CAPABILITY,
  GoogleBooksAdapter,
  buildGoogleBooksRequest,
  decodeGoogleBooksResponse,
  rankGoogleBooksEditions,
} from '../_shared/imageInventory/metadata/googleBooks';
import {
  googleBooksEmptyResponse,
  googleBooksMalformedSibling,
  googleBooksMultipleVolumes,
} from './fixtures/phase9/googleBooksResponses';
import { buildMetadataQueryIdentity } from '../_shared/imageInventory/metadata';

const isbnQuery = buildMetadataQueryIdentity({
  strategy: 'isbn',
  isbnClue: '0-306-40615-2',
  title: 'The Fixture Book',
  authors: ['Fixture Author'],
  language: 'en',
  editionClues: [],
});

describe('Phase 9 Unit 5B Google Books adapter', () => {
  it('declares one bounded versioned primary capability', () => {
    expect(GOOGLE_BOOKS_CAPABILITY).toMatchObject({
      role: 'primary',
      adapterKey: 'google_books',
      enabled: true,
      maxAttempts: 1,
      supportsIsbn10: true,
      supportsIsbn13: true,
      returnsCoherentEditions: true,
    });
    expect(GOOGLE_BOOKS_CAPABILITY.supportedStrategies).toEqual(['isbn', 'bibliographic']);
  });

  it('constructs a deterministic bounded title/author-first request without private data', () => {
    const request = buildGoogleBooksRequest(isbnQuery, 'server-only-key');
    expect(request.url.origin + request.url.pathname)
      .toBe('https://www.googleapis.com/books/v1/volumes');
    expect(request.url.searchParams.get('q')).toBe('intitle:the fixture book inauthor:fixture author');
    expect(request.url.searchParams.get('q')).not.toContain('isbn:');
    expect(request.url.searchParams.get('langRestrict')).toBeNull();
    expect(request.url.searchParams.get('maxResults')).toBe('10');
    expect(request.url.searchParams.get('startIndex')).toBe('0');
    expect(request.url.searchParams.get('printType')).toBe('books');
    expect(request.url.searchParams.get('projection')).toBe('full');
    expect(request.url.searchParams.get('key')).toBe('server-only-key');
    expect(request.safeUrl).not.toContain('server-only-key');
    expect(request.url.toString()).not.toContain('store');
  });

  it('constructs encoded title/author and language queries and never exact-queries invalid ISBN', () => {
    const query = buildMetadataQueryIdentity({
      strategy: 'bibliographic',
      isbnClue: '9780306406158',
      title: 'गोदान',
      authors: ['प्रेमचंद'],
      language: 'hi-Deva',
      editionClues: [],
    });
    const request = buildGoogleBooksRequest(query, 'server-only-key');
    expect(request.url.searchParams.get('q')).toBe('intitle:गोदान inauthor:प्रेमचंद');
    expect(request.url.searchParams.get('langRestrict')).toBeNull();
    expect(request.url.searchParams.get('q')).not.toContain('isbn:');
  });

  it('uses ISBN only when no title or author evidence exists', () => {
    const query = buildMetadataQueryIdentity({
      strategy: 'isbn', isbnClue: '0-306-40615-2', title: '', authors: [],
      language: 'en', editionClues: [],
    });
    const request = buildGoogleBooksRequest(query, 'server-only-key');
    expect(request.url.searchParams.get('q')).toBe('isbn:9780306406157');
    expect(request.url.searchParams.get('langRestrict')).toBeNull();
  });

  it('decodes bounded coherent editions, strips description markup, validates ISBNs, and skips a malformed sibling', () => {
    const editions = decodeGoogleBooksResponse(
      googleBooksMalformedSibling,
      { correlationId: 'correlation-1', attemptId: 'attempt-1', fetchedAt: '2026-07-28T00:00:00.000Z' },
    );
    expect(editions).toHaveLength(1);
    expect(editions[0]).toMatchObject({
      providerRecordId: 'volume-exact-isbn',
      title: 'The Fixture Book',
      description: 'Synthetic edition description.',
      isbn10: '0306406152',
      isbn13: '9780306406157',
      language: 'en',
    });
    expect(JSON.stringify(editions[0])).not.toContain('volumeInfo');
  });

  it('selects the largest safe Google Books cover and falls back past unsafe larger links', () => {
    const decoded = decodeGoogleBooksResponse({
      totalItems: 1,
      items: [{
        id: 'cover-volume',
        volumeInfo: {
          title: 'Cover Fixture',
          authors: ['Fixture Author'],
          language: 'en',
          imageLinks: {
            extraLarge: 'https://user:secret@books.google.com/unsafe.jpg',
            large: 'https://example.com/unsafe.jpg',
            small: 'not a url',
            medium: 'http://books.google.com/books/content?id=cover&zoom=3',
            thumbnail: 'https://books.google.com/books/content?id=cover&zoom=1',
          },
        },
      }],
    }, {
      correlationId: 'cover-correlation',
      attemptId: 'cover-attempt',
      fetchedAt: '2026-07-28T00:00:00.000Z',
    });
    expect(decoded[0].coverReference)
      .toBe('https://books.google.com/books/content?id=cover&zoom=3');
  });

  it('preserves Unicode/original script and maps empty responses to no match', () => {
    const editions = decodeGoogleBooksResponse(
      googleBooksMultipleVolumes,
      { correlationId: 'correlation-2', attemptId: 'attempt-2', fetchedAt: '2026-07-28T00:00:00.000Z' },
    );
    expect(editions[1].title).toBe('गोदान');
    expect(editions[1].authors).toEqual(['प्रेमचंद']);
    expect(decodeGoogleBooksResponse(
      googleBooksEmptyResponse,
      { correlationId: 'c', attemptId: 'a', fetchedAt: '2026-07-28T00:00:00.000Z' },
    )).toEqual([]);
  });

  it('ranks exact equivalent ISBNs deterministically and preserves one whole volume', () => {
    const editions = decodeGoogleBooksResponse(
      googleBooksMultipleVolumes,
      { correlationId: 'correlation-3', attemptId: 'attempt-3', fetchedAt: '2026-07-28T00:00:00.000Z' },
    );
    const ranked = rankGoogleBooksEditions(isbnQuery, editions);
    expect(ranked.outcome).toBe('coherent_match');
    expect(ranked.selected?.providerRecordId).toBe('volume-exact-isbn');
    expect(ranked.selected?.authors).toEqual(['Fixture Author']);
    expect(rankGoogleBooksEditions(isbnQuery, editions)).toEqual(ranked);
  });

  it('accepts an exact ISBN when bibliographic evidence is unavailable', () => {
    const query = buildMetadataQueryIdentity({
      strategy: 'isbn', isbnClue: '0-306-40615-2', title: '', authors: [],
      language: 'en', editionClues: [],
    });
    const editions = decodeGoogleBooksResponse(
      googleBooksMultipleVolumes,
      { correlationId: 'isbn-only', attemptId: 'attempt-isbn-only',
        fetchedAt: '2026-07-28T00:00:00.000Z' },
    );
    const ranked = rankGoogleBooksEditions(query, editions);
    expect(ranked.outcome).toBe('coherent_match');
    expect(ranked.selected?.providerRecordId).toBe('volume-exact-isbn');
    expect(ranked.evidence).toContain('exact_validated_isbn');
  });

  it('keeps title and author primary when an ISBN points at a conflicting provider edition', () => {
    const query = buildMetadataQueryIdentity({
      strategy: 'isbn',
      isbnClue: '9781861972712',
      title: 'The Fixture Book',
      authors: ['Fixture Author'],
      language: 'en',
      editionClues: [],
    });
    const editions = decodeGoogleBooksResponse(
      googleBooksMultipleVolumes,
      { correlationId: 'title-author-primary', attemptId: 'attempt', fetchedAt: '2026-07-28T00:00:00.000Z' },
    );
    const ranked = rankGoogleBooksEditions(query, editions);
    expect(ranked.outcome).toBe('coherent_match');
    expect(ranked.selected?.providerRecordId).toBe('volume-exact-isbn');
    expect(ranked.evidence).toEqual(expect.arrayContaining([
      'exact_original_title',
      'author_overlap',
    ]));
  });

  it('uses language and ISBN only to break ties between title/author matches', () => {
    const editions = decodeGoogleBooksResponse({
      totalItems: 2,
      items: [
        {
          id: 'secondary-weaker',
          volumeInfo: {
            title: 'The Fixture Book', authors: ['Fixture Author'], language: 'fr',
            industryIdentifiers: [{ type: 'ISBN_13', identifier: '9781861972712' }],
          },
        },
        {
          id: 'secondary-stronger',
          volumeInfo: {
            title: 'The Fixture Book', authors: ['Fixture Author'], language: 'en',
            industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780306406157' }],
          },
        },
      ],
    }, {
      correlationId: 'secondary-ranking',
      attemptId: 'attempt',
      fetchedAt: '2026-07-28T00:00:00.000Z',
    });
    const ranked = rankGoogleBooksEditions(isbnQuery, editions);
    expect(ranked.outcome).toBe('coherent_match');
    expect(ranked.selected?.providerRecordId).toBe('secondary-stronger');
    expect(ranked.evidence).toEqual(expect.arrayContaining([
      'exact_validated_isbn',
      'language_compatible',
    ]));
  });

  it('uses edition clues only to break a tie between title/author matches', () => {
    const query = buildMetadataQueryIdentity({
      strategy: 'bibliographic',
      isbnClue: null,
      title: 'The Fixture Book',
      authors: ['Fixture Author'],
      language: 'en',
      editionClues: ['book'],
    });
    const editions = decodeGoogleBooksResponse({
      totalItems: 2,
      items: [
        {
          id: 'edition-weaker',
          volumeInfo: {
            title: 'The Fixture Book', authors: ['Fixture Author'],
            language: 'en', printType: 'MAGAZINE',
          },
        },
        {
          id: 'edition-stronger',
          volumeInfo: {
            title: 'The Fixture Book', authors: ['Fixture Author'],
            language: 'en', printType: 'BOOK',
          },
        },
      ],
    }, {
      correlationId: 'edition-ranking',
      attemptId: 'attempt',
      fetchedAt: '2026-07-28T00:00:00.000Z',
    });
    const ranked = rankGoogleBooksEditions(query, editions);
    expect(ranked.outcome).toBe('coherent_match');
    expect(ranked.selected?.providerRecordId).toBe('edition-stronger');
    expect(ranked.evidence).toContain('edition_clue_overlap');
  });

  it('fails closed with missing configuration and makes no HTTP call', async () => {
    const fetcher = jest.fn();
    const adapter = new GoogleBooksAdapter({
      mode: 'real',
      apiKey: null,
      fetcher,
      timeoutMs: 1_000,
      maxResponseBytes: 64_000,
    });
    await expect(adapter.lookup({
      query: isbnQuery,
      correlationId: 'correlation-4',
      attemptId: 'attempt-4',
      signal: new AbortController().signal,
    })).resolves.toMatchObject({ outcome: 'authentication_configuration_failure' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('classifies rate limits and never exposes credentials or response bodies', async () => {
    const fetcher = jest.fn().mockResolvedValue(new Response('secret provider body', {
      status: 429,
      headers: { 'content-type': 'application/json' },
    }));
    const adapter = new GoogleBooksAdapter({
      mode: 'real',
      apiKey: 'server-only-key',
      fetcher,
      timeoutMs: 1_000,
      maxResponseBytes: 64_000,
    });
    const result = await adapter.lookup({
      query: isbnQuery,
      correlationId: 'correlation-5',
      attemptId: 'attempt-5',
      signal: new AbortController().signal,
    });
    expect(result).toMatchObject({ outcome: 'rate_limited', retryable: true });
    expect(JSON.stringify(result)).not.toContain('server-only-key');
    expect(JSON.stringify(result)).not.toContain('secret provider body');
  });

  it.each([
    [503, 'provider_unavailable', true],
    [401, 'authentication_configuration_failure', false],
  ])('maps HTTP %i to %s', async (status, expected, retryable) => {
    const adapter = new GoogleBooksAdapter({
      mode: 'real',
      apiKey: 'server-only-key',
      fetcher: jest.fn().mockResolvedValue(new Response('', {
        status,
        headers: { 'content-type': 'application/json' },
      })),
      timeoutMs: 1_000,
      maxResponseBytes: 64_000,
    });
    await expect(adapter.lookup({
      query: isbnQuery,
      correlationId: 'correlation-http',
      attemptId: 'attempt-http',
      signal: new AbortController().signal,
    })).resolves.toMatchObject({ outcome: expected, retryable });
  });

  it('rejects unsupported content types, oversized bodies, and malformed JSON', async () => {
    const lookup = {
      query: isbnQuery,
      correlationId: 'correlation-bounds',
      attemptId: 'attempt-bounds',
      signal: new AbortController().signal,
    };
    const create = (response: Response) => new GoogleBooksAdapter({
      mode: 'real',
      apiKey: 'server-only-key',
      fetcher: jest.fn().mockResolvedValue(response),
      timeoutMs: 1_000,
      maxResponseBytes: 64,
    });
    await expect(create(new Response('plain', {
      headers: { 'content-type': 'text/plain' },
    })).lookup(lookup)).resolves.toMatchObject({ outcome: 'unsupported_content_type' });
    await expect(create(new Response('x'.repeat(65), {
      headers: { 'content-type': 'application/json' },
    })).lookup(lookup)).resolves.toMatchObject({ outcome: 'response_too_large' });
    await expect(create(new Response('{bad', {
      headers: { 'content-type': 'application/json' },
    })).lookup(lookup)).resolves.toMatchObject({ outcome: 'malformed_response' });
  });

  it('maps timeout and caller cancellation separately', async () => {
    const fetcher = jest.fn((_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }));
    const adapter = new GoogleBooksAdapter({
      mode: 'real',
      apiKey: 'server-only-key',
      fetcher,
      timeoutMs: 20,
      maxResponseBytes: 64_000,
    });
    await expect(adapter.lookup({
      query: isbnQuery,
      correlationId: 'correlation-timeout',
      attemptId: 'attempt-timeout',
      signal: new AbortController().signal,
    })).resolves.toMatchObject({ outcome: 'timeout', retryable: true });
    const controller = new AbortController();
    controller.abort();
    await expect(adapter.lookup({
      query: isbnQuery,
      correlationId: 'correlation-cancel',
      attemptId: 'attempt-cancel',
      signal: controller.signal,
    })).resolves.toMatchObject({ outcome: 'cancelled', retryable: false });
  });

  it('makes zero HTTP calls when cancellation already happened', async () => {
    const fetcher = jest.fn();
    const controller = new AbortController();
    controller.abort();
    const adapter = new GoogleBooksAdapter({
      mode: 'real',
      apiKey: 'server-only-key',
      fetcher,
      timeoutMs: 1_000,
      maxResponseBytes: 64_000,
    });
    await expect(adapter.lookup({
      query: isbnQuery,
      correlationId: 'correlation-pre-cancel',
      attemptId: 'attempt-pre-cancel',
      signal: controller.signal,
    })).resolves.toMatchObject({ outcome: 'cancelled', retryable: false });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
