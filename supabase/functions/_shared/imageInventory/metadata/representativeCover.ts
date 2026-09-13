import type { MetadataEdition } from '../contracts/metadata';

export const REPRESENTATIVE_COVER_POLICY_VERSION = 'p9-representative-cover-v1' as const;

export type MetadataRepresentativeCover = Readonly<{
  coverReference: string;
  sourceRelation: 'representative_edition';
  sourceProviderRecordId: string;
  selectionPolicyVersion: typeof REPRESENTATIVE_COVER_POLICY_VERSION;
  matchEvidence: readonly ['exact_title', 'exact_author_set', 'language_compatible'];
}>;

const normalized = (value: string): string => value.normalize('NFKC').trim()
  .replace(/\s+/gu, ' ').toLocaleLowerCase('und');
const languageBase = (value: string): string => value.toLocaleLowerCase('und').split('-')[0];
const normalizedAuthors = (edition: MetadataEdition): string => edition.authors
  .map(normalized).sort((left, right) => left.localeCompare(right)).join('\u0000');
const conflicts = (left: string | null, right: string | null): boolean => Boolean(
  left && right && normalized(left) !== normalized(right),
);

function compatible(selected: MetadataEdition, candidate: MetadataEdition): boolean {
  return candidate.providerRecordId !== selected.providerRecordId
    && candidate.coverReference !== null
    && normalized(candidate.title) === normalized(selected.title)
    && normalizedAuthors(candidate) === normalizedAuthors(selected)
    && languageBase(candidate.language) === languageBase(selected.language)
    && !conflicts(candidate.subtitle, selected.subtitle)
    && !conflicts(candidate.series, selected.series)
    && !conflicts(candidate.volume, selected.volume);
}

function compatibilityScore(selected: MetadataEdition, candidate: MetadataEdition): number {
  return Number(Boolean(selected.isbn13 && candidate.isbn13 === selected.isbn13)) * 8
    + Number(Boolean(selected.isbn10 && candidate.isbn10 === selected.isbn10)) * 4
    + Number(Boolean(selected.subtitle && candidate.subtitle
      && normalized(selected.subtitle) === normalized(candidate.subtitle))) * 2
    + Number(candidate.language.toLocaleLowerCase('und')
      === selected.language.toLocaleLowerCase('und'));
}

export function selectRepresentativeEditionCover(
  selected: MetadataEdition,
  candidates: readonly MetadataEdition[],
): MetadataRepresentativeCover | null {
  if (selected.coverReference !== null) return null;
  const source = candidates.filter((candidate) => compatible(selected, candidate))
    .sort((left, right) => compatibilityScore(selected, right)
      - compatibilityScore(selected, left)
      || left.providerRecordId.localeCompare(right.providerRecordId))[0];
  if (!source?.coverReference) return null;
  return Object.freeze({
    coverReference: source.coverReference,
    sourceRelation: 'representative_edition',
    sourceProviderRecordId: source.providerRecordId,
    selectionPolicyVersion: REPRESENTATIVE_COVER_POLICY_VERSION,
    matchEvidence: Object.freeze([
      'exact_title', 'exact_author_set', 'language_compatible',
    ]) as MetadataRepresentativeCover['matchEvidence'],
  });
}
