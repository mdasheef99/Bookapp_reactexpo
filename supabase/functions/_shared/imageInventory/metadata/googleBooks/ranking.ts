import { MetadataEdition } from '../../contracts/metadata';
import { MetadataQueryIdentity } from '../queryIdentity';

export type GoogleBooksRanking = Readonly<{
  outcome: 'coherent_match' | 'ambiguous_match' | 'material_conflict' | 'no_acceptable_match';
  selected: MetadataEdition | null;
  evidence: readonly string[];
}>;

const normalized = (value: string): string => value.normalize('NFKC').trim()
  .replace(/\s+/gu, ' ').toLocaleLowerCase('und');

function textualEvidence(query: MetadataQueryIdentity, edition: MetadataEdition): string[] {
  const evidence: string[] = [];
  if (query.normalizedTitle && normalized(edition.title) === query.normalizedTitle) {
    evidence.push('exact_original_title');
  }
  const editionAuthors = edition.authors.map(normalized);
  if (query.normalizedAuthors.length > 0
    && query.normalizedAuthors.every((author) => editionAuthors.includes(author))) {
    evidence.push('author_overlap');
  }
  if (edition.language.split('-')[0] === query.normalizedLanguage.split('-')[0]) {
    evidence.push('language_compatible');
  }
  return evidence;
}

export function rankGoogleBooksEditions(
  query: MetadataQueryIdentity,
  editions: readonly MetadataEdition[],
): GoogleBooksRanking {
  if (editions.length === 0) {
    return { outcome: 'no_acceptable_match', selected: null, evidence: [] };
  }
  const ranked = editions.map((edition) => {
    const evidence = textualEvidence(query, edition);
    const exactIsbn = Boolean(query.normalizedIsbn13
      && edition.isbn13 === query.normalizedIsbn13);
    const conflictingIsbn = Boolean(query.normalizedIsbn13 && edition.isbn13
      && edition.isbn13 !== query.normalizedIsbn13);
    return { edition, evidence, exactIsbn, conflictingIsbn };
  }).sort((left, right) =>
    Number(right.exactIsbn) - Number(left.exactIsbn)
    || right.evidence.length - left.evidence.length
    || left.edition.providerRecordId.localeCompare(right.edition.providerRecordId));

  const best = ranked[0];
  if (best.exactIsbn) {
    const ties = ranked.filter((entry) => entry.exactIsbn);
    if (ties.length > 1) {
      return { outcome: 'ambiguous_match', selected: null, evidence: ['exact_isbn_tie'] };
    }
    return {
      outcome: 'coherent_match',
      selected: best.edition,
      evidence: Object.freeze(['exact_validated_isbn', ...best.evidence]),
    };
  }
  if (ranked.some((entry) => entry.conflictingIsbn)) {
    return { outcome: 'material_conflict', selected: null, evidence: ['conflicting_isbn'] };
  }
  const coherentText = ranked.filter((entry) =>
    entry.evidence.includes('exact_original_title')
    && entry.evidence.includes('author_overlap')
    && entry.evidence.includes('language_compatible'));
  if (coherentText.length === 1) {
    return {
      outcome: 'coherent_match',
      selected: coherentText[0].edition,
      evidence: Object.freeze(coherentText[0].evidence),
    };
  }
  if (coherentText.length > 1) {
    return { outcome: 'ambiguous_match', selected: null, evidence: ['coherent_text_tie'] };
  }
  return { outcome: 'no_acceptable_match', selected: null, evidence: [] };
}
