import {
  buildMetadataQueryIdentity,
  buildProviderCacheIdentity,
  normalizeIsbnClue,
} from '../_shared/imageInventory/contracts';

describe('Phase 9 Unit 5A ISBN and query identity', () => {
  test.each([
    ['0-306-40615-2', '0306406152', '9780306406157'],
    ['0 8044 2957 X', '080442957X', '9780804429573'],
    ['978-0-306-40615-7', null, '9780306406157'],
  ])('validates and normalizes %s', (clue, isbn10, isbn13) => {
    expect(normalizeIsbnClue(clue)).toEqual({
      status: 'valid',
      isbn10,
      isbn13,
      privateInvalidEvidence: null,
    });
  });

  test.each([
    '0306406153',
    '9780306406158',
    '978030640615',
    '03064061',
    '978-0-306-40615-A',
    'prefix 9780306406157 suffix',
    '',
  ])('rejects malformed, partial, or checksum-invalid clue %p', (clue) => {
    const result = normalizeIsbnClue(clue);
    expect(result.status).toBe('invalid');
    expect(result.isbn10).toBeNull();
    expect(result.isbn13).toBeNull();
    expect(result.privateInvalidEvidence).toBe(clue.trim() || null);
  });

  it('makes equivalent bibliographic clues provider-independent and retry-stable', () => {
    const first = buildMetadataQueryIdentity({
      strategy: 'isbn',
      isbnClue: '0-306-40615-2',
      title: '  The   Fixture Book ',
      authors: ['Fixture Author'],
      language: 'EN',
      editionClues: [' Paperback '],
    });
    const second = buildMetadataQueryIdentity({
      strategy: 'isbn',
      isbnClue: '9780306406157',
      title: 'the fixture book',
      authors: [' fixture   author '],
      language: 'en',
      editionClues: ['paperback'],
    });
    expect(first).toEqual(second);
    expect(JSON.stringify(first)).not.toMatch(/store|secret|credential|provider/i);
  });

  it('distinguishes strategy, language, and edition clues', () => {
    const baseline = {
      strategy: 'bibliographic' as const,
      isbnClue: null,
      title: 'Fixture Book',
      authors: ['Fixture Author'],
      language: 'en',
      editionClues: ['paperback'],
    };
    expect(buildMetadataQueryIdentity({ ...baseline, strategy: 'isbn' }).key)
      .not.toBe(buildMetadataQueryIdentity(baseline).key);
    expect(buildMetadataQueryIdentity({ ...baseline, language: 'hi-Deva' }).key)
      .not.toBe(buildMetadataQueryIdentity(baseline).key);
    expect(buildMetadataQueryIdentity({ ...baseline, editionClues: ['hardcover'] }).key)
      .not.toBe(buildMetadataQueryIdentity(baseline).key);
  });

  it('isolates provider cache identity by adapter and policy versions', () => {
    const query = buildMetadataQueryIdentity({
      strategy: 'bibliographic',
      isbnClue: null,
      title: 'Fixture Book',
      authors: ['Fixture Author'],
      language: 'en',
      editionClues: [],
    });
    const base = {
      query,
      adapterKey: 'recorded_metadata',
      adapterVersion: '1.0.0',
      capabilityVersion: 'cap-v1',
      schemaVersion: 'p9-metadata-v1',
      cachePolicyVersion: 'cache-v1',
      reusePolicyVersion: 'reuse-v1',
    };
    const identity = buildProviderCacheIdentity(base);
    expect(buildProviderCacheIdentity({ ...base, adapterVersion: '2.0.0' }).key)
      .not.toBe(identity.key);
    expect(buildProviderCacheIdentity({ ...base, reusePolicyVersion: 'reuse-v2' }).key)
      .not.toBe(identity.key);
  });
});
