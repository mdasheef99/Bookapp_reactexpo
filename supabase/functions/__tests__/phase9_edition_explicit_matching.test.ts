// Owner amendment 2026-10-16; DOC-3 §5.2.1 / picker SDD §4.1: explicit selection only.
// The case table is shared with the M76 SQL test so worker and database rules stay identical.
import cases from '../../tests/phase9/explicitEditionMatchingCases.json';
import { buildMetadataQueryIdentity } from '../_shared/imageInventory/metadata/queryIdentity';
import { normalizeGoogleEditionRows } from '../_shared/imageInventory/metadata/googleBooks/editionOptions';
import { mayMatchOpenLibraryIdentity, normalizeOpenLibraryRows } from '../_shared/imageInventory/metadata/openLibrary/normalizer';
import { explicitEditionAuthorKey, explicitEditionTitleKey } from '../_shared/imageInventory/metadata/explicitEditionTitle';

type Side = Readonly<{ title: string; authors: readonly string[]; language: string }>;
const query = (side: Side) => buildMetadataQueryIdentity({ strategy: 'bibliographic', isbnClue: null,
  title: side.title, authors: [...side.authors], language: side.language, editionClues: [] });
const context = { correlationId: 'explicit-match', attemptId: 'explicit-match', fetchedAt: '2026-10-16T00:00:00Z' };
const google = (q: Side, r: Side) => normalizeGoogleEditionRows({ items: [{ id: 'match', volumeInfo: {
  title: r.title, language: r.language, authors: [...r.authors], infoLink: 'https://books.google.com/books?id=match' } }] },
{ ...context, createOptionId: () => '10000000-0000-4000-8000-000000000001' }, query(q))[0];
const olLanguages: Record<string, string> = { en: '/languages/eng', fr: '/languages/fre' };
beforeAll(() => {
  if (!globalThis.crypto?.randomUUID) Object.defineProperty(globalThis, 'crypto', {
    configurable: true, value: require('node:crypto').webcrypto,
  });
});

it.each(cases.cases.map(c => [c.name, c] as const))('Google explicit option: %s', (_name, c) => {
  expect(google(c.query, c.result).eligibility).toBe(c.eligible ? 'eligible' : 'ineligible');
});

it.each(cases.cases.filter(c => c.result.language === 'und' || olLanguages[c.result.language])
  .map(c => [c.name, c] as const))('Open Library explicit option: %s', (_name, c) => {
  const raw = { key: '/books/OL100M', title: c.result.title,
    authors: c.result.authors.map((_author, index) => ({ key: `/authors/OL${index + 1}A` })),
    languages: c.result.language === 'und' ? [] : [{ key: olLanguages[c.result.language] }] };
  const authors = new Map(c.result.authors.map((author, index) => [`/authors/OL${index + 1}A`, author]));
  const row = normalizeOpenLibraryRows([raw], authors, context, query(c.query))[0];
  expect(row.eligibility).toBe(c.eligible ? 'eligible' : 'ineligible');
  // Own-author allocation never skips a row that final eligibility would admit.
  if (c.eligible) expect(mayMatchOpenLibraryIdentity(raw, query(c.query))).toBe(true);
});

it('keeps catalogue text and query identity unchanged', () => {
  const c = cases.cases.find(entry => entry.name === 'ampersand, spaced initials and accent')!;
  const row = google(c.query, c.result);
  expect(row.metadata).toMatchObject({ title: c.result.title, authors: c.result.authors });
  expect(query(c.query).normalizedAuthors).toEqual(['j. o. urmson', 'jonathan ree']);
  expect(row.metadata?.matchRationale).toBe('confirmation_required_text_evidence');
});

it.each([
  ['J. O. Urmson', 'jo urmson'], ['J.O. Urmson', 'jo urmson'], ['JO Urmson', 'jo urmson'],
  ['Jonathan Rée', 'jonathan ree'], ['J. R. R. Tolkien', 'jrr tolkien'], ['Plato', 'plato'], ['.', ''],
])('derives the author comparison key %s -> %s', (value, key) => expect(explicitEditionAuthorKey(value)).toBe(key));

it('folds only Latin combining accents and maps & only for English', () => {
  expect(explicitEditionTitleKey('Philosophy & Philosophers', true)).toBe('philosophy and philosophers');
  expect(explicitEditionTitleKey('Guerre & Paix', false)).toBe('guerre & paix');
  expect(explicitEditionTitleKey('Les Misérables', false)).toBe('les miserables');
  expect(explicitEditionTitleKey('किताब', false)).toBe('किताब'.normalize('NFD'));
});
