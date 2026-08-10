import {
  asRecord,
  assertKnownKeys,
  boundedInteger,
  boundedNumber,
  canonicalBcp47,
  optionalString,
  Phase9ContractError,
  requiredIsoTimestamp,
  requiredString,
  utf8ByteLength,
} from '../domain/validation';
import { validateIsbnPair } from '../domain/isbn';
import { PHASE9_CONTRACT_VERSION, PHASE9_METADATA_SCHEMA_VERSION } from './versions';
import { assertApprovedProviderHttpsUrl, ProviderHostPolicy } from './providerReuse';
import { PHASE9_LIMITS } from './registers';

const METADATA_KEYS = [
  'contract_version', 'schema_version', 'adapter_key', 'adapter_version', 'normalizer_version', 'correlation_id', 'attempt_id', 'provider_record_id',
  'fetched_at', 'title', 'subtitle', 'authors', 'description', 'isbn10', 'isbn13',
  'publisher', 'published_date', 'language', 'script', 'edition_statement', 'series', 'volume', 'format',
  'page_count', 'categories', 'cover_reference', 'match_rationale', 'confidence',
] as const;

const NORMALIZED_METADATA_KEYS = [
  'contractVersion', 'schemaVersion', 'adapterKey', 'adapterVersion', 'normalizerVersion', 'correlationId', 'attemptId', 'providerRecordId',
  'fetchedAt', 'title', 'subtitle', 'authors', 'description', 'isbn10', 'isbn13',
  'publisher', 'publishedDate', 'language', 'script', 'editionStatement', 'series', 'volume', 'format',
  'pageCount', 'categories', 'coverReference', 'matchRationale', 'confidence',
] as const;

export type MetadataEdition = Readonly<{
  contractVersion: typeof PHASE9_CONTRACT_VERSION;
  schemaVersion: typeof PHASE9_METADATA_SCHEMA_VERSION;
  adapterKey: string;
  adapterVersion: string;
  normalizerVersion: string;
  correlationId: string;
  attemptId: string;
  providerRecordId: string;
  fetchedAt: string;
  title: string;
  subtitle: string | null;
  authors: readonly string[];
  description: string | null;
  isbn10: string | null;
  isbn13: string | null;
  publisher: string | null;
  publishedDate: string | null;
  language: string;
  script: string | null;
  editionStatement: string | null;
  series: string | null;
  volume: string | null;
  format: string | null;
  pageCount: number | null;
  categories: readonly string[];
  coverReference: string | null;
  matchRationale: string;
  confidence: number;
}>;

export const METADATA_OUTCOMES = ['matched', 'provider_no_match', 'technical_failure', 'schema_invalid'] as const;
export type MetadataOutcome = typeof METADATA_OUTCOMES[number];
export type MetadataAdapterResult = Readonly<{
  contractVersion: typeof PHASE9_CONTRACT_VERSION;
  schemaVersion: typeof PHASE9_METADATA_SCHEMA_VERSION;
  adapterKey: string;
  adapterVersion: string;
  correlationId: string;
  attemptId: string;
  receivedAt: string;
  outcome: MetadataOutcome;
  candidates: readonly MetadataEdition[];
}>;

function parseArray(value: unknown, field: string, maxCount: number, maxLength: number): string[] {
  if (!Array.isArray(value) || value.length > maxCount) {
    throw new Phase9ContractError(field, `must be an array with at most ${maxCount} entries`);
  }
  return value.map((entry, index) => requiredString(entry, `${field}[${index}]`, maxLength));
}

function parseCoverReference(value: unknown, hostPolicy?: ProviderHostPolicy): string | null {
  if (value === null || value === undefined) return null;
  const reference = requiredString(value, 'cover_reference', PHASE9_LIMITS.coverReferenceChars, { activeContent: false });
  if (/^https:\/\//iu.test(reference)) {
    if (!hostPolicy) throw new Phase9ContractError('cover_reference', 'HTTPS cover requires an approved provider-host policy');
    return assertApprovedProviderHttpsUrl(reference, hostPolicy);
  }
  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//u.test(reference) || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,511}$/u.test(reference)) {
    throw new Phase9ContractError('cover_reference', 'must be a valid HTTPS URL or opaque provider reference');
  }
  return reference;
}

export function parseMetadataEdition(value: unknown, hostPolicy?: ProviderHostPolicy): MetadataEdition {
  if (utf8ByteLength(value) > PHASE9_LIMITS.rawPayloadBytes) throw new Phase9ContractError('metadata_result', `exceeds ${PHASE9_LIMITS.rawPayloadBytes} bytes`);
  const input = asRecord(value, 'metadata_result');
  assertKnownKeys(input, METADATA_KEYS, 'metadata_result');
  if (input.contract_version !== PHASE9_CONTRACT_VERSION) throw new Phase9ContractError('contract_version', 'unsupported version');
  if (input.schema_version !== PHASE9_METADATA_SCHEMA_VERSION) throw new Phase9ContractError('schema_version', 'unsupported version');
  const authors = parseArray(input.authors, 'authors', PHASE9_LIMITS.authorCount, PHASE9_LIMITS.authorChars);
  if (authors.length === 0) throw new Phase9ContractError('authors', 'requires an author or bounded unknown-author marker');
  const categories = input.categories === null || input.categories === undefined
    ? []
    : parseArray(input.categories, 'categories', PHASE9_LIMITS.categoryCount, PHASE9_LIMITS.categoryChars);
  const pair = validateIsbnPair(
    input.isbn10 === null || input.isbn10 === undefined ? null : requiredString(input.isbn10, 'isbn10', 32, { activeContent: false }),
    input.isbn13 === null || input.isbn13 === undefined ? null : requiredString(input.isbn13, 'isbn13', 32, { activeContent: false }),
  );
  const fetchedAt = requiredIsoTimestamp(input.fetched_at, 'fetched_at');
  const pageCount = input.page_count === null || input.page_count === undefined
    ? null
    : boundedInteger(input.page_count, 'page_count', 1, PHASE9_LIMITS.pageCount);
  return {
    contractVersion: PHASE9_CONTRACT_VERSION,
    schemaVersion: PHASE9_METADATA_SCHEMA_VERSION,
    adapterKey: requiredString(input.adapter_key, 'adapter_key', 64, { activeContent: false, pattern: /^[a-z][a-z0-9_-]{1,63}$/u }),
    adapterVersion: requiredString(input.adapter_version, 'adapter_version', 64, { activeContent: false }),
    normalizerVersion: requiredString(input.normalizer_version, 'normalizer_version', 64, { activeContent: false }),
    correlationId: requiredString(input.correlation_id, 'correlation_id', 128, { activeContent: false }),
    attemptId: requiredString(input.attempt_id, 'attempt_id', 128, { activeContent: false }),
    providerRecordId: requiredString(input.provider_record_id, 'provider_record_id', 256, { activeContent: false }),
    fetchedAt,
    title: requiredString(input.title, 'title', PHASE9_LIMITS.titleChars),
    subtitle: optionalString(input.subtitle, 'subtitle', PHASE9_LIMITS.subtitleChars),
    authors,
    description: optionalString(input.description, 'description', PHASE9_LIMITS.descriptionChars),
    isbn10: pair.isbn10,
    isbn13: pair.isbn13,
    publisher: optionalString(input.publisher, 'publisher', 256),
    publishedDate: optionalString(input.published_date, 'published_date', 32),
    language: canonicalBcp47(input.language, 'language'),
    script: optionalString(input.script, 'script', 16),
    editionStatement: optionalString(input.edition_statement, 'edition_statement', 256),
    series: optionalString(input.series, 'series', 256),
    volume: optionalString(input.volume, 'volume', 64),
    format: optionalString(input.format, 'format', 128),
    pageCount,
    categories,
    coverReference: parseCoverReference(input.cover_reference, hostPolicy),
    matchRationale: requiredString(input.match_rationale, 'match_rationale', 512),
    confidence: boundedNumber(input.confidence, 'confidence', 0, 1),
  };
}

export function parseNormalizedMetadataEdition(
  value: unknown,
  hostPolicy?: ProviderHostPolicy,
): MetadataEdition {
  const input = asRecord(value, 'normalized_metadata_edition');
  assertKnownKeys(input, NORMALIZED_METADATA_KEYS, 'normalized_metadata_edition');
  return parseMetadataEdition({
    contract_version: input.contractVersion,
    schema_version: input.schemaVersion,
    adapter_key: input.adapterKey,
    adapter_version: input.adapterVersion,
    normalizer_version: input.normalizerVersion,
    correlation_id: input.correlationId,
    attempt_id: input.attemptId,
    provider_record_id: input.providerRecordId,
    fetched_at: input.fetchedAt,
    title: input.title,
    subtitle: input.subtitle,
    authors: input.authors,
    description: input.description,
    isbn10: input.isbn10,
    isbn13: input.isbn13,
    publisher: input.publisher,
    published_date: input.publishedDate,
    language: input.language,
    script: input.script,
    edition_statement: input.editionStatement,
    series: input.series,
    volume: input.volume,
    format: input.format,
    page_count: input.pageCount,
    categories: input.categories,
    cover_reference: input.coverReference,
    match_rationale: input.matchRationale,
    confidence: input.confidence,
  }, hostPolicy);
}

export function parseMetadataAdapterResult(value: unknown, hostPolicy?: ProviderHostPolicy): MetadataAdapterResult {
  if (utf8ByteLength(value) > PHASE9_LIMITS.rawPayloadBytes) throw new Phase9ContractError('metadata_adapter_result', `exceeds ${PHASE9_LIMITS.rawPayloadBytes} bytes`);
  const input = asRecord(value, 'metadata_adapter_result');
  assertKnownKeys(input, ['contract_version', 'schema_version', 'adapter_key', 'adapter_version', 'correlation_id', 'attempt_id', 'received_at', 'outcome', 'candidates'], 'metadata_adapter_result');
  if (input.contract_version !== PHASE9_CONTRACT_VERSION || input.schema_version !== PHASE9_METADATA_SCHEMA_VERSION) {
    throw new Phase9ContractError('metadata_adapter_result', 'unsupported contract or schema version');
  }
  if (typeof input.outcome !== 'string' || !METADATA_OUTCOMES.includes(input.outcome as MetadataOutcome)) {
    throw new Phase9ContractError('outcome', 'unsupported metadata outcome');
  }
  if (!Array.isArray(input.candidates) || input.candidates.length > PHASE9_LIMITS.metadataCandidateCount) {
    throw new Phase9ContractError('candidates', `must contain at most ${PHASE9_LIMITS.metadataCandidateCount} coherent editions`);
  }
  const candidates = input.candidates.map((candidate) => parseMetadataEdition(candidate, hostPolicy));
  const outcome = input.outcome as MetadataOutcome;
  if (outcome === 'matched' && candidates.length === 0) throw new Phase9ContractError('candidates', 'matched outcome requires a coherent edition');
  if (outcome !== 'matched' && candidates.length > 0) throw new Phase9ContractError('candidates', 'non-matched outcome cannot carry editions');
  const receivedAt = requiredIsoTimestamp(input.received_at, 'received_at');
  return {
    contractVersion: PHASE9_CONTRACT_VERSION,
    schemaVersion: PHASE9_METADATA_SCHEMA_VERSION,
    adapterKey: requiredString(input.adapter_key, 'adapter_key', 64, { activeContent: false }),
    adapterVersion: requiredString(input.adapter_version, 'adapter_version', 64, { activeContent: false }),
    correlationId: requiredString(input.correlation_id, 'correlation_id', 128, { activeContent: false }),
    attemptId: requiredString(input.attempt_id, 'attempt_id', 128, { activeContent: false }),
    receivedAt,
    outcome,
    candidates,
  };
}

export type MetadataSelectionOutcome =
  | Readonly<{ outcome: 'selected'; edition: MetadataEdition; canonicalEditionId: string | null }>
  | Readonly<{ outcome: 'provider_no_match'; edition: null; canonicalEditionId: null }>;

export function metadataSelectionOutcome(candidates: readonly MetadataEdition[], selectedIndex: number | null): MetadataSelectionOutcome {
  if (selectedIndex === null || candidates.length === 0) {
    return { outcome: 'provider_no_match', edition: null, canonicalEditionId: null };
  }
  return { outcome: 'selected', edition: selectCoherentEdition(candidates, selectedIndex), canonicalEditionId: null };
}

export function selectCoherentEdition(candidates: readonly MetadataEdition[], selectedIndex: number): MetadataEdition {
  if (!Number.isSafeInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= candidates.length) {
    throw new Phase9ContractError('selected_index', 'does not identify one coherent edition');
  }
  return candidates[selectedIndex];
}
