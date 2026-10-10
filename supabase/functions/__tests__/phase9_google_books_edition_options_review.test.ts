import { GoogleBooksAdapter } from '../_shared/imageInventory/metadata/googleBooks/adapter';
import { buildMetadataQueryIdentity } from '../_shared/imageInventory/metadata/queryIdentity';
import type { OptionsRetentionEvidence } from '../_shared/imageInventory/contracts/ownerEditionPicker';
import {
  googleBooksEditionPickerFixtures as fixtures,
  googleBooksEditionRetentionFixtures as retention,
} from './fixtures/phase9/googleBooksResponses';

// Picker §§4.1/8: regressions for the two independently reported Task 3 defects.
const fetchedAt = '2026-10-07T00:50:00.000Z';
const query = buildMetadataQueryIdentity({
  strategy: 'bibliographic', isbnClue: '0306406152', title: 'The Fixture Book',
  authors: ['Fixture Author'], language: 'en', editionClues: [],
});
async function lookup(
  body: unknown, headers: Record<string, string> = {},
  evidence: OptionsRetentionEvidence | null = retention.productCap,
) {
  const adapter = new GoogleBooksAdapter({
    mode: 'real', apiKey: 'synthetic-server-key', timeoutMs: 1000, maxResponseBytes: 64_000,
    fetcher: async () => new Response(JSON.stringify(body), {
      headers: { 'content-type': 'application/json', ...headers },
    }),
    verifyOptionsRetention: () => evidence,
  });
  return adapter.lookupEditionOptions({
    query, correlationId: 'review-correlation', attemptId: 'review-attempt',
    signal: new AbortController().signal,
  });
}
beforeAll(() => {
  if (!globalThis.crypto?.randomUUID) Object.defineProperty(globalThis, 'crypto', {
    configurable: true, value: require('node:crypto').webcrypto,
  });
});
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(fetchedAt));
});
afterEach(() => jest.useRealTimers());

describe('Task 3 review ISBN certainty (picker §4.1; DOC-3 §5.1)', () => {
  it.each([
    ['title', fixtures.unrelatedTitle.items[0]],
    ['author', fixtures.unrelatedAuthor.items[0]],
    ['language', fixtures.incompatibleLanguage.items[0]],
  ] as const)('requires confirmation when a safe same-ISBN sibling conflicts in %s', async (_field, conflict) => {
    const result = await lookup({ items: [fixtures.exactIsbn.items[0], conflict] });
    expect(result.outcome).toBe('ambiguous_match');
    expect(result.rows.map(row => row.ordinal)).toEqual([0, 1]);
    expect(result.rows[0]).toMatchObject({
      eligibility: 'eligible', metadata: {
        isbn13: '9780306406157', matchRationale: 'confirmation_required_conflicting_isbn_records',
      },
    });
    expect(result.rows[1]).toMatchObject({
      eligibility: 'ineligible', metadata: {
        isbn13: '9780306406157', matchRationale: 'identity_conflict_selection_disabled',
      },
    });
  });
  it('keeps identical duplicate records strong and independently selectable', async () => {
    const original = fixtures.exactIsbn.items[0];
    const result = await lookup({ items: [original, original] });
    expect(result.outcome).toBe('coherent_match');
    expect(result.rows.map(row => row.metadata?.matchRationale))
      .toEqual(['exact_validated_isbn', 'exact_validated_isbn']);
    expect(result.rows.map(row => row.eligibility)).toEqual(['eligible', 'eligible']);
    expect(new Set(result.rows.map(row => row.optionId)).size).toBe(2);
  });
  it('does not let an unrelated different-ISBN sibling weaken the exact match', async () => {
    const unrelated = fixtures.unrelatedAuthor.items[0];
    const result = await lookup({ items: [fixtures.exactIsbn.items[0], {
      ...unrelated, volumeInfo: { ...unrelated.volumeInfo,
        industryIdentifiers: [{ type: 'ISBN_13', identifier: '9781861972712' }] },
    }] });
    expect(result.outcome).toBe('coherent_match');
    expect(result.rows[0].metadata?.matchRationale).toBe('exact_validated_isbn');
    expect(result.rows[1].eligibility).toBe('ineligible');
  });
});

const date = 'Wed, 07 Oct 2026 00:00:00 GMT';
const expires = 'Wed, 07 Oct 2026 01:00:00 GMT';
const expiresCases: readonly {
  label: string; headers: Record<string, string>; deadline: string | null;
}[] = [
  { label: 'accounts for older cached age', headers: { date, expires, age: '3500' }, deadline: '2026-10-07T00:51:40.000Z' },
  { label: 'denies exhausted freshness', headers: { date, expires, age: '3600' }, deadline: null },
  { label: 'denies malformed age', headers: { date, expires, age: 'invalid' }, deadline: null },
  { label: 'denies malformed date', headers: { date: 'invalid', expires, age: '0' }, deadline: null },
  { label: 'denies old age without an origin date', headers: { expires, age: '3500' }, deadline: null },
  { label: 'denies expiry before the origin date', headers: { date: 'Wed, 07 Oct 2026 01:10:00 GMT', expires, age: '0' }, deadline: null },
  { label: 'uses apparent age for an unaged response', headers: { date, expires, age: '0' }, deadline: '2026-10-07T01:00:00.000Z' },
  { label: 'keeps an absolute expiry without date or age', headers: { expires }, deadline: '2026-10-07T01:00:00.000Z' },
];
describe('Task 3 review Expires-only freshness (picker §8)', () => {
  it.each(expiresCases)('$label', async ({ headers, deadline }) => {
    const result = await lookup(fixtures.exactIsbn, headers);
    expect(result.fetchedAt).toBe(fetchedAt);
    expect(result.retentionEvidence).toEqual(deadline === null ? retention.unknownPermission
      : { storagePermissionVerified: true, permittedDeadlineAt: deadline });
  });
  it('preserves an independently verified earlier deadline', async () => {
    const result = await lookup(fixtures.exactIsbn, { date, expires, age: '3500' }, {
      storagePermissionVerified: true, permittedDeadlineAt: '2026-10-07T00:51:00.000Z',
    });
    expect(result.retentionEvidence).toEqual({
      storagePermissionVerified: true, permittedDeadlineAt: '2026-10-07T00:51:00.000Z',
    });
  });
  it('does not turn fresh response headers into permission', async () => {
    const result = await lookup(fixtures.exactIsbn, { date, expires, age: '0' }, null);
    expect(result.retentionEvidence).toEqual(retention.unknownPermission);
    expect(result.rows).toHaveLength(1);
  });
});
