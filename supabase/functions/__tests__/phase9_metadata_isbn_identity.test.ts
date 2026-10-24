import {
  buildMetadataQueryIdentity,
  buildProviderCacheIdentity,
  normalizeIsbnClue,
} from '../_shared/imageInventory/contracts';
import { decodeMetadataJobContext } from '../_shared/imageInventory/runtime/metadataJobContext';
import { requestFromMetadataContext } from '../_shared/imageInventory/runtime/metadataProductionGateway';
import { explicitContext } from './fixtures/phase9/editionOptionsWorker';

describe('Phase 9 Unit 5A ISBN and query identity', () => {
  it('rebuilds the ISBN-only key from an edition context with empty identity text (slice 5 §6)', () => {
    const key = '["p9-metadata-lookup-v1", "p9-bibliographic-normalizer-v1", "isbn", "9780306406157", "", [], "und", []]';
    const context = decodeMetadataJobContext({...explicitContext,title:'',authors:[],
      isbnClue:'9780306406157',language:'und',publisherClue:null,inputId:null,observationId:null,queryIdentity:key});
    expect(requestFromMetadataContext(context).query.key).toBe(key);
  });
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

  it('uses bibliographic strategy when title or author clues accompany an ISBN', () => {
    const baseline = {
      strategy: 'bibliographic' as const,
      isbnClue: null,
      title: 'Fixture Book',
      authors: ['Fixture Author'],
      language: 'en',
      editionClues: ['paperback'],
    };
    expect(buildMetadataQueryIdentity({ ...baseline, strategy: 'isbn' }).strategy)
      .toBe('bibliographic');
    expect(buildMetadataQueryIdentity({
      ...baseline, strategy: 'isbn', isbnClue: '9780306406158',
    }).strategy).toBe('bibliographic');
    expect(buildMetadataQueryIdentity({
      ...baseline, strategy: 'approved_strong_evidence', isbnClue: '9780306406158',
    }).strategy).toBe('approved_strong_evidence');
    expect(buildMetadataQueryIdentity({
      ...baseline, strategy: 'isbn', isbnClue: '0-306-40615-2', title: '', authors: [],
    }).strategy).toBe('isbn');
  });

  it('distinguishes language and edition clues', () => {
    const baseline = {
      strategy: 'bibliographic' as const,
      isbnClue: null,
      title: 'Fixture Book',
      authors: ['Fixture Author'],
      language: 'en',
      editionClues: ['paperback'],
    };
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
