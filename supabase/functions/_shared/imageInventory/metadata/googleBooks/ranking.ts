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

function hasPrimaryIdentityEvidence(evidence: readonly string[]): boolean {
  return evidence.includes('exact_original_title') && evidence.includes('author_overlap');
}

function hasEditionClueOverlap(
  query: MetadataQueryIdentity,
  edition: MetadataEdition,
): boolean {
  if (query.normalizedEditionClues.length === 0) return false;
  const providerClues = [
    edition.editionStatement,
    edition.series,
    edition.volume,
    edition.format,
  ].filter((value): value is string => value !== null).map(normalized);
  return query.normalizedEditionClues.some((clue) => providerClues.includes(clue));
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
    const languageCompatible = evidence.includes('language_compatible');
    const editionClueOverlap = hasEditionClueOverlap(query, edition);
    if (exactIsbn) evidence.push('exact_validated_isbn');
    if (editionClueOverlap) evidence.push('edition_clue_overlap');
    const secondaryScore = Number(exactIsbn)
      + Number(languageCompatible)
      + Number(editionClueOverlap);
    return {
      edition,
      evidence,
      primaryMatch: hasPrimaryIdentityEvidence(evidence),
      exactIsbn,
      secondaryScore,
    };
  }).sort((left, right) =>
    Number(right.primaryMatch) - Number(left.primaryMatch)
    || right.secondaryScore - left.secondaryScore
    || left.edition.providerRecordId.localeCompare(right.edition.providerRecordId));

  const hasBibliographicEvidence = query.normalizedTitle.length > 0
    || query.normalizedAuthors.length > 0;
  const primaryMatches = ranked.filter((entry) => entry.primaryMatch);
  if (primaryMatches.length > 0) {
    const best = primaryMatches[0];
    const ties = primaryMatches.filter((entry) =>
      entry.secondaryScore === best.secondaryScore);
    if (ties.length > 1) {
      return {
        outcome: 'ambiguous_match',
        selected: null,
        evidence: ['title_author_secondary_tie'],
      };
    }
    return {
      outcome: 'coherent_match',
      selected: best.edition,
      evidence: Object.freeze(best.evidence),
    };
  }
  if (!hasBibliographicEvidence) {
    const exactIsbnMatches = ranked.filter((entry) => entry.exactIsbn);
    if (exactIsbnMatches.length > 0) {
      const best = exactIsbnMatches[0];
      const ties = exactIsbnMatches.filter((entry) =>
        entry.secondaryScore === best.secondaryScore);
      if (ties.length > 1) {
        return { outcome: 'ambiguous_match', selected: null, evidence: ['exact_isbn_tie'] };
      }
      return {
        outcome: 'coherent_match',
        selected: best.edition,
        evidence: Object.freeze(best.evidence),
      };
    }
  }
  if (ranked.some((entry) => entry.exactIsbn)) {
    return {
      outcome: 'material_conflict',
      selected: null,
      evidence: ['isbn_identity_conflicts_with_title_author'],
    };
  }
  return { outcome: 'no_acceptable_match', selected: null, evidence: [] };
}
