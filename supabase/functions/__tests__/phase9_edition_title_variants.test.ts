// Owner decision 2026-10-13; picker SDD §4.1 / DOC-3 §5.2.1: explicit selection only.
import { buildMetadataQueryIdentity } from '../_shared/imageInventory/metadata/queryIdentity';
import { normalizeGoogleEditionRows } from '../_shared/imageInventory/metadata/googleBooks/editionOptions';
import { mayMatchOpenLibraryIdentity, normalizeOpenLibraryRows } from '../_shared/imageInventory/metadata/openLibrary/normalizer';

const query = (extra = {}) => buildMetadataQueryIdentity({ strategy: 'bibliographic', isbnClue: null,
  title: 'The Black Swan', authors: ['Nassim Nicholas Taleb'], language: 'en', editionClues: [], ...extra });
const context = { correlationId: 'title-variant', attemptId: 'title-variant', fetchedAt: '2026-10-13T00:00:00Z' };
const google = (title: string, language = 'en', authors = ['Nassim Nicholas Taleb'], identity = query()) =>
  normalizeGoogleEditionRows({ items: [{ id: 'variant', volumeInfo: { title, language, authors,
    infoLink: 'https://books.google.com/books?id=variant' } }] },
  { ...context, createOptionId: () => '10000000-0000-4000-8000-000000000001' }, identity)[0];
const edition = (title: string, extra = {}) => ({ key: '/books/OL100M', title,
  authors: [{ key: '/authors/OL1A' }], languages: [{ key: '/languages/eng' }], ...extra });
beforeAll(() => {
  if (!globalThis.crypto?.randomUUID) Object.defineProperty(globalThis, 'crypto', {
    configurable: true, value: require('node:crypto').webcrypto,
  });
});

it.each([
  ['The Black Swan', 'Black Swan'], ['Black Swan', 'The Black Swan'],
  [' THE   BLACK SWAN ', 'black swan'], ['The Black Swan', 'The Black Swan'],
])('admits the bounded English title comparison %s / %s for an explicit option', (observed, supplied) => {
  const row = google(supplied, 'en', ['Nassim Nicholas Taleb'], query({ title: observed }));
  expect(row.eligibility).toBe('eligible');
  expect(row.metadata?.title).toBe(supplied.trim().replace(/\s+/gu, ' '));
  expect(row.metadata?.coverReference).toBeNull();
  expect(row.metadata?.matchRationale).toBe('confirmation_required_text_evidence');
});
it('retains base-language compatibility for English regional tags', () => {
  expect(google('Black Swan', 'en-US', undefined, query({ language: 'en-GB' })).eligibility).toBe('eligible');
});
it.each(['A Black Swan', 'Black Swan Theory', 'The The Black Swan', 'Black-Swan'])(
  'keeps the different title %s blocked', title => expect(google(title).eligibility).toBe('ineligible'));
it.each([['fr', 'en'], ['en', 'fr'], ['und', 'en'], ['en', 'und'], ['fr', 'fr']])(
  'does not apply the English title variant to result language %s / query language %s', (result, observed) => {
    expect(google('Black Swan', result, undefined, query({ language: observed })).eligibility).toBe('ineligible');
  });
it.each([
  // A matching middle initial is accepted since 2026-10-17; a different one is not.
  ['different middle initial', ['Nassim K. Taleb']], ['different author', ['Wrong Author']],
  ['missing coauthor', ['Nassim Nicholas Taleb', 'Missing Coauthor']],
] as const)(
  'requires every supplied author without fuzzy aliases: %s', (_label, authors) => {
    expect(google('Black Swan', 'en', ['Nassim Nicholas Taleb'], query({ authors: [...authors] })).eligibility).toBe('ineligible');
  });
it('does not infer book identity from a title without authors or validated ISBN', () => {
  expect(google('Black Swan', 'en', undefined, query({ authors: [] })).eligibility).toBe('ineligible');
});
it('uses the same comparison before own-author allocation and after Open Library decoding', () => {
  const raw = edition('Black Swan');
  expect(mayMatchOpenLibraryIdentity(raw, query())).toBe(true);
  const row = normalizeOpenLibraryRows([raw], new Map([['/authors/OL1A', 'Nassim Nicholas Taleb']]), context, query())[0];
  expect(row).toMatchObject({ ordinal: 0, eligibility: 'eligible', metadata: {
    title: 'Black Swan', authors: ['Nassim Nicholas Taleb'], coverReference: null,
  } });
});
it('does not allocate an author budget to unsafe or incompatible variant facts', () => {
  expect(mayMatchOpenLibraryIdentity(edition('Black Swan', { isbn_13: ['invalid'] }), query())).toBe(false);
  expect(mayMatchOpenLibraryIdentity(edition('Black Swan', { languages: [] }), query())).toBe(false);
  expect(mayMatchOpenLibraryIdentity(edition('Black Swan', { authors: [1, 2, 3, 4, 5].map(id => ({ key: '/authors/OL' + id + 'A' })) }), query())).toBe(false);
});
