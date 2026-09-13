import { normalizeIsbnClue } from '../domain/isbn';
import { canonicalBcp47 } from '../domain/validation';

export const METADATA_LOOKUP_CONTRACT_VERSION = 'p9-metadata-lookup-v1' as const;
export const METADATA_NORMALIZER_VERSION = 'p9-bibliographic-normalizer-v1' as const;
export const METADATA_CACHE_POLICY_VERSION = 'p9-metadata-cache-v1' as const;

export type MetadataLookupStrategy = 'isbn' | 'bibliographic' | 'approved_strong_evidence';

export type MetadataQueryIdentity = Readonly<{
  key: string;
  lookupContractVersion: typeof METADATA_LOOKUP_CONTRACT_VERSION;
  normalizerVersion: typeof METADATA_NORMALIZER_VERSION;
  strategy: MetadataLookupStrategy;
  normalizedIsbn13: string | null;
  normalizedTitle: string;
  normalizedAuthors: readonly string[];
  normalizedLanguage: string;
  normalizedEditionClues: readonly string[];
}>;

export const normalizeBibliographicText = (value: string): string => value
  .normalize('NFKC')
  .trim()
  .replace(/\s+/gu, ' ')
  .toLocaleLowerCase('und');

export const normalizeBibliographicSearchKey = (value: string): string =>
  normalizeBibliographicText(value)
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');

const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(', ')}]`;
  return JSON.stringify(value);
};

const stableKey = (parts: readonly unknown[]): string => canonicalJson(parts);

export function buildMetadataQueryIdentity(input: Readonly<{
  strategy: MetadataLookupStrategy;
  isbnClue: string | null;
  title: string;
  authors: readonly string[];
  language: string;
  editionClues: readonly string[];
}>): MetadataQueryIdentity {
  const isbn = input.isbnClue === null ? null : normalizeIsbnClue(input.isbnClue);
  const normalizedIsbn13 = isbn?.status === 'valid' ? isbn.isbn13 : null;
  const normalizedTitle = normalizeBibliographicText(input.title);
  const normalizedAuthors = input.authors.map(normalizeBibliographicText).filter(Boolean);
  const normalizedLanguage = canonicalBcp47(input.language, 'language');
  const normalizedEditionClues = [...new Set(
    input.editionClues.map(normalizeBibliographicText).filter(Boolean),
  )].sort();
  const hasBibliographicEvidence = normalizedTitle.length > 0 || normalizedAuthors.length > 0;
  const strategy: MetadataLookupStrategy = input.strategy === 'approved_strong_evidence'
    ? input.strategy
    : hasBibliographicEvidence ? 'bibliographic' : 'isbn';
  const key = stableKey([
    METADATA_LOOKUP_CONTRACT_VERSION,
    METADATA_NORMALIZER_VERSION,
    strategy,
    normalizedIsbn13,
    normalizedTitle,
    normalizedAuthors,
    normalizedLanguage,
    normalizedEditionClues,
  ]);
  return Object.freeze({
    key,
    lookupContractVersion: METADATA_LOOKUP_CONTRACT_VERSION,
    normalizerVersion: METADATA_NORMALIZER_VERSION,
    strategy,
    normalizedIsbn13,
    normalizedTitle,
    normalizedAuthors: Object.freeze(normalizedAuthors),
    normalizedLanguage,
    normalizedEditionClues: Object.freeze(normalizedEditionClues),
  });
}

export type ProviderCacheIdentity = Readonly<{
  key: string;
  queryKey: string;
  adapterKey: string;
  adapterVersion: string;
  capabilityVersion: string;
  schemaVersion: string;
  cachePolicyVersion: string;
  reusePolicyVersion: string;
}>;

export function buildProviderCacheIdentity(input: Omit<ProviderCacheIdentity, 'key' | 'queryKey'> & {
  query: MetadataQueryIdentity;
}): ProviderCacheIdentity {
  const key = stableKey([
    input.query.key,
    input.adapterKey,
    input.adapterVersion,
    input.capabilityVersion,
    input.schemaVersion,
    input.cachePolicyVersion,
    input.reusePolicyVersion,
  ]);
  return Object.freeze({
    key,
    queryKey: input.query.key,
    adapterKey: input.adapterKey,
    adapterVersion: input.adapterVersion,
    capabilityVersion: input.capabilityVersion,
    schemaVersion: input.schemaVersion,
    cachePolicyVersion: input.cachePolicyVersion,
    reusePolicyVersion: input.reusePolicyVersion,
  });
}
