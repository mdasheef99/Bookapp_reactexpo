import { normalizeIsbnClue } from '../domain/isbn';
import { canonicalBcp47 } from '../domain/validation';

export type LocalCanonicalEdition = Readonly<{
  id: string;
  isbn10: string | null;
  isbn13: string | null;
  originalTitle: string;
  originalAuthors: readonly string[];
  language: string;
}>;

export type LocalCanonicalResolution =
  | Readonly<{
    outcome: 'local_canonical_match';
    canonicalEditionId: string;
    evidence: 'validated_isbn' | 'exact_original_title_author_language';
    externalAttemptRequired: false;
    providerReservationRequired: false;
  }>
  | Readonly<{
    outcome: 'external_lookup_required';
    canonicalEditionId: null;
    evidence: 'insufficient_local_evidence';
    externalAttemptRequired: true;
    providerReservationRequired: true;
  }>;

const text = (value: string): string => value.normalize('NFKC').trim()
  .replace(/\s+/gu, ' ').toLocaleLowerCase('und');

export function localCanonicalResolution(input: Readonly<{
  isbnClue: string | null;
  title: string;
  authors: readonly string[];
  language: string;
  aliasMatches?: readonly string[];
  fuzzyMatches?: readonly string[];
}>, editions: readonly LocalCanonicalEdition[]): LocalCanonicalResolution {
  const isbn = input.isbnClue === null ? null : normalizeIsbnClue(input.isbnClue);
  if (isbn?.status === 'valid') {
    const match = editions.find((edition) =>
      edition.isbn13 === isbn.isbn13
      || (isbn.isbn10 !== null && edition.isbn10 === isbn.isbn10));
    if (match) {
      return {
        outcome: 'local_canonical_match',
        canonicalEditionId: match.id,
        evidence: 'validated_isbn',
        externalAttemptRequired: false,
        providerReservationRequired: false,
      };
    }
  }
  const title = text(input.title);
  const authors = input.authors.map(text);
  const language = canonicalBcp47(input.language, 'language');
  const exact = editions.find((edition) =>
    text(edition.originalTitle) === title
    && edition.originalAuthors.length === authors.length
    && edition.originalAuthors.map(text).every((author, index) => author === authors[index])
    && canonicalBcp47(edition.language, 'language') === language);
  if (exact) {
    return {
      outcome: 'local_canonical_match',
      canonicalEditionId: exact.id,
      evidence: 'exact_original_title_author_language',
      externalAttemptRequired: false,
      providerReservationRequired: false,
    };
  }
  return {
    outcome: 'external_lookup_required',
    canonicalEditionId: null,
    evidence: 'insufficient_local_evidence',
    externalAttemptRequired: true,
    providerReservationRequired: true,
  };
}
