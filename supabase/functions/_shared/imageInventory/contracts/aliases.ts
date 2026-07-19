import { asRecord, assertKnownKeys, boundedNumber, canonicalBcp47, Phase9ContractError, requiredString } from '../domain/validation';
import { PHASE9_ALIAS_SCHEMA_VERSION, PHASE9_CONTRACT_VERSION, PHASE9_MAX_AUTOMATED_ALIASES } from './versions';
import { PHASE9_LIMITS } from './registers';

const ALIAS_KEYS = ['text', 'language', 'kind', 'source', 'source_version', 'confidence', 'approval_status'] as const;
const KINDS = ['transliteration', 'translation', 'common_title', 'recognized_title'] as const;
const STATUSES = ['proposed', 'approved', 'rejected'] as const;
const SOURCE_TYPES = ['automated', 'provider_official', 'owner_verified', 'platform_verified'] as const;

export type SearchAlias = Readonly<{
  text: string;
  language: string;
  kind: typeof KINDS[number];
  source: string;
  sourceVersion: string;
  sourceType: typeof SOURCE_TYPES[number];
  confidence: number | null;
  approvalStatus: typeof STATUSES[number];
  searchOnly: true;
}>;

export type AliasResult = Readonly<{
  contractVersion: typeof PHASE9_CONTRACT_VERSION;
  schemaVersion: typeof PHASE9_ALIAS_SCHEMA_VERSION;
  adapterKey: string;
  adapterVersion: string;
  correlationId: string;
  attemptId: string;
  generatedAt: string;
  aliases: readonly SearchAlias[];
}>;

export function parseAutomatedAliasResult(value: unknown): AliasResult {
  const input = asRecord(value, 'alias_result');
  assertKnownKeys(input, ['contract_version', 'schema_version', 'adapter_key', 'adapter_version', 'correlation_id', 'attempt_id', 'generated_at', 'aliases'], 'alias_result');
  if (input.contract_version !== PHASE9_CONTRACT_VERSION || input.schema_version !== PHASE9_ALIAS_SCHEMA_VERSION) {
    throw new Phase9ContractError('alias_result', 'unsupported contract or schema version');
  }
  if (!Array.isArray(input.aliases) || input.aliases.length > PHASE9_MAX_AUTOMATED_ALIASES) {
    throw new Phase9ContractError('aliases', 'automated operation may propose at most three aliases');
  }
  const aliases = input.aliases.map((value, index): SearchAlias => {
    const field = `aliases[${index}]`;
    const alias = asRecord(value, field);
    assertKnownKeys(alias, ALIAS_KEYS, field);
    if (!KINDS.includes(alias.kind as typeof KINDS[number])) throw new Phase9ContractError(`${field}.kind`, 'unsupported alias kind');
    if (!STATUSES.includes(alias.approval_status as typeof STATUSES[number])) throw new Phase9ContractError(`${field}.approval_status`, 'unsupported approval status');
    const language = canonicalBcp47(alias.language, `${field}.language`);
    const parts = language.split('-');
    const script = parts.find((part) => part.length === 4);
    if (parts[0] !== 'en' || (script && script !== 'Latn')) {
      throw new Phase9ContractError(`${field}.language`, 'automated aliases must be English/Latin-script proposals');
    }
    return {
      text: requiredString(alias.text, `${field}.text`, PHASE9_LIMITS.aliasChars),
      language,
      kind: alias.kind as typeof KINDS[number],
      source: requiredString(alias.source, `${field}.source`, 64, { activeContent: false }),
      sourceVersion: requiredString(alias.source_version, `${field}.source_version`, 64, { activeContent: false }),
      sourceType: 'automated',
      confidence: alias.confidence === null || alias.confidence === undefined ? null : boundedNumber(alias.confidence, `${field}.confidence`, 0, 1),
      approvalStatus: alias.approval_status as typeof STATUSES[number],
      searchOnly: true,
    };
  });
  const generatedAt = requiredString(input.generated_at, 'generated_at', 40, { activeContent: false });
  if (!Number.isFinite(Date.parse(generatedAt))) throw new Phase9ContractError('generated_at', 'must be an ISO timestamp');
  return {
    contractVersion: PHASE9_CONTRACT_VERSION,
    schemaVersion: PHASE9_ALIAS_SCHEMA_VERSION,
    adapterKey: requiredString(input.adapter_key, 'adapter_key', 64, { activeContent: false }),
    adapterVersion: requiredString(input.adapter_version, 'adapter_version', 64, { activeContent: false }),
    correlationId: requiredString(input.correlation_id, 'correlation_id', 128, { activeContent: false }),
    attemptId: requiredString(input.attempt_id, 'attempt_id', 128, { activeContent: false }),
    generatedAt,
    aliases,
  };
}

export function parseRetainedAliasRows(value: unknown): readonly SearchAlias[] {
  if (!Array.isArray(value) || value.length > PHASE9_LIMITS.retainedAliasCount) {
    throw new Phase9ContractError('retained_aliases', `must contain at most ${PHASE9_LIMITS.retainedAliasCount} aliases`);
  }
  let automatedCount = 0;
  return value.map((entry, index): SearchAlias => {
    const field = `retained_aliases[${index}]`;
    const alias = asRecord(entry, field);
    assertKnownKeys(alias, [...ALIAS_KEYS, 'source_type'], field);
    if (!SOURCE_TYPES.includes(alias.source_type as typeof SOURCE_TYPES[number])) throw new Phase9ContractError(`${field}.source_type`, 'unsupported source type');
    if (!KINDS.includes(alias.kind as typeof KINDS[number])) throw new Phase9ContractError(`${field}.kind`, 'unsupported alias kind');
    if (!STATUSES.includes(alias.approval_status as typeof STATUSES[number])) throw new Phase9ContractError(`${field}.approval_status`, 'unsupported approval status');
    if (alias.source_type === 'automated' && ++automatedCount > PHASE9_MAX_AUTOMATED_ALIASES) {
      throw new Phase9ContractError('retained_aliases', 'may retain at most three aliases from one automated operation');
    }
    return {
      text: requiredString(alias.text, `${field}.text`, PHASE9_LIMITS.aliasChars),
      language: canonicalBcp47(alias.language, `${field}.language`),
      kind: alias.kind as typeof KINDS[number],
      source: requiredString(alias.source, `${field}.source`, 64, { activeContent: false }),
      sourceVersion: requiredString(alias.source_version, `${field}.source_version`, 64, { activeContent: false }),
      sourceType: alias.source_type as typeof SOURCE_TYPES[number],
      confidence: alias.confidence === null || alias.confidence === undefined ? null : boundedNumber(alias.confidence, `${field}.confidence`, 0, 1),
      approvalStatus: alias.approval_status as typeof STATUSES[number],
      searchOnly: true,
    };
  });
}
