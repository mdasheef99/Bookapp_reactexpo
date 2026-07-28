import {
  asRecord,
  assertKnownKeys,
  canonicalBcp47,
  Phase9ContractError,
  requiredString,
  utf8ByteLength,
} from '../domain/validation';
import {
  normalizeBibliographicSearchKey,
} from '../metadata/queryIdentity';
import { PHASE9_LIMITS } from './registers';
import {
  assertLanguageScriptCoherence,
  assertSourceLanguageScript,
  parseSupportedSearchVariantScript,
  SupportedSearchVariantScript,
  textUsesScript,
} from './searchVariantScripts';
import {
  PHASE9_CONTRACT_VERSION,
  PHASE9_SEARCH_VARIANT_SCHEMA_VERSION,
} from './versions';
import {
  parseSpineAnalysisResult,
  SpineAnalysisResult,
} from './vision';

const VARIANT_TYPES = [
  'primary_roman', 'roman_alternative', 'translation_candidate',
] as const;
const GENERATION_SOURCES = ['vision_model', 'recorded_fixture'] as const;
const SIDECAR_KEYS = [
  'contract_version', 'schema_version', 'analysis_reference',
  'generation_source', 'provider_key', 'model_key', 'model_version',
  'prompt_version', 'titles', 'authors',
] as const;
const FIELD_KEYS = [
  'source_field', 'source_text', 'source_language', 'source_script', 'proposals',
] as const;
const PROPOSAL_KEYS = [
  'variant_text', 'variant_language', 'variant_script', 'variant_type',
] as const;
const IDENTIFIER = /^[a-z][a-z0-9._-]{1,63}$/u;
const VERSION_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const OPAQUE_REFERENCE = /^[A-Za-z0-9._:-]{16,128}$/u;
const TITLE_SOURCE_FIELD = /^observation:([1-9]|1[0-5]):title$/u;
const AUTHOR_SOURCE_FIELD =
  /^observation:([1-9]|1[0-5]):author:([1-9]|1[0-9]|20)$/u;

export type SearchVariantType = typeof VARIANT_TYPES[number];
export type SearchVariantProposal = Readonly<{
  text: string;
  language: string;
  script: SupportedSearchVariantScript;
  type: SearchVariantType;
  deterministicSearchKey: string;
}>;
export type SearchVariantSource = Readonly<{
  field: string;
  text: string;
  language: string;
  script: SupportedSearchVariantScript;
  deterministicSearchKey: string;
}>;
export type TitleSearchVariantField = Readonly<{
  source: SearchVariantSource &
    Readonly<{ field: `observation:${number}:title` }>;
  proposals: readonly SearchVariantProposal[];
}>;
export type AuthorSearchVariantField = Readonly<{
  source: SearchVariantSource &
    Readonly<{ field: `observation:${number}:author:${number}` }>;
  proposals: readonly SearchVariantProposal[];
}>;
export type SearchVariantProposalSidecar = Readonly<{
  contractVersion: typeof PHASE9_CONTRACT_VERSION;
  schemaVersion: typeof PHASE9_SEARCH_VARIANT_SCHEMA_VERSION;
  analysisReference: string;
  generationSource: typeof GENERATION_SOURCES[number];
  providerKey: string;
  modelKey: string;
  modelVersion: string;
  promptVersion: string;
  titles: readonly TitleSearchVariantField[];
  authors: readonly AuthorSearchVariantField[];
}>;
export type SearchVariantCompanion =
  | Readonly<{ status: 'missing'; value: null }>
  | Readonly<{ status: 'rejected'; value: null; reason: 'schema_invalid' }>
  | Readonly<{ status: 'accepted'; value: SearchVariantProposalSidecar }>;

function proposal(value: unknown, field: string): SearchVariantProposal {
  const input = asRecord(value, field);
  assertKnownKeys(input, PROPOSAL_KEYS, field);
  if (!VARIANT_TYPES.includes(input.variant_type as SearchVariantType)) {
    throw new Phase9ContractError(`${field}.variant_type`, 'unsupported variant type');
  }
  const type = input.variant_type as SearchVariantType;
  const text = requiredString(
    input.variant_text, `${field}.variant_text`, PHASE9_LIMITS.aliasChars,
  );
  const language = canonicalBcp47(input.variant_language, `${field}.variant_language`);
  const variantScript = parseSupportedSearchVariantScript(
    input.variant_script, `${field}.variant_script`,
  );
  assertLanguageScriptCoherence(language, variantScript, field);
  if (type === 'translation_candidate') {
    if (language.split('-')[0] !== 'en' || variantScript !== 'Latn') {
      throw new Phase9ContractError(field, 'translation candidates must be English/Latin');
    }
  } else if (variantScript !== 'Latn') {
    throw new Phase9ContractError(field, 'Roman proposals must use Latin script');
  }
  if (!textUsesScript(text, variantScript)) {
    throw new Phase9ContractError(field, 'variant text and script conflict');
  }
  return {
    text,
    language,
    script: variantScript,
    type,
    deterministicSearchKey: normalizeBibliographicSearchKey(text),
  };
}

function deduplicate(
  source: SearchVariantSource,
  proposals: readonly SearchVariantProposal[],
): readonly SearchVariantProposal[] {
  const priority: Readonly<Record<SearchVariantType, number>> = {
    primary_roman: 0,
    roman_alternative: 1,
    translation_candidate: 2,
  };
  const sorted = proposals
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) =>
      priority[left.entry.type] - priority[right.entry.type] || left.index - right.index);
  const seen = new Set([`${source.script}:${source.deterministicSearchKey}`]);
  return sorted.flatMap(({ entry }) => {
    const key = `${entry.script}:${entry.deterministicSearchKey}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [entry];
  });
}

function field(
  value: unknown,
  fieldName: string,
  target: 'title' | 'author',
  textLimit: number,
): Readonly<{ source: SearchVariantSource; proposals: readonly SearchVariantProposal[] }> {
  const input = asRecord(value, fieldName);
  assertKnownKeys(input, FIELD_KEYS, fieldName);
  const sourceField = requiredString(
    input.source_field, `${fieldName}.source_field`, 48,
    {
      activeContent: false,
      pattern: target === 'title' ? TITLE_SOURCE_FIELD : AUTHOR_SOURCE_FIELD,
    },
  );
  if ((target === 'title' && !TITLE_SOURCE_FIELD.test(sourceField))
    || (target === 'author' && !AUTHOR_SOURCE_FIELD.test(sourceField))) {
    throw new Phase9ContractError(`${fieldName}.source_field`, 'wrong source field');
  }
  const text = requiredString(input.source_text, `${fieldName}.source_text`, textLimit);
  const language = canonicalBcp47(input.source_language, `${fieldName}.source_language`);
  const sourceScript = parseSupportedSearchVariantScript(
    input.source_script, `${fieldName}.source_script`,
  );
  assertSourceLanguageScript(text, language, sourceScript, fieldName);
  if (!Array.isArray(input.proposals)
    || input.proposals.length > PHASE9_LIMITS.searchVariantProposalCount) {
    throw new Phase9ContractError(
      `${fieldName}.proposals`,
      `must contain at most ${PHASE9_LIMITS.searchVariantProposalCount} entries`,
    );
  }
  const parsed = input.proposals.map((entry, index) =>
    proposal(entry, `${fieldName}.proposals[${index}]`));
  const counts = (type: SearchVariantType) =>
    parsed.filter((entry) => entry.type === type).length;
  if (counts('primary_roman') > 1
    || counts('roman_alternative') > PHASE9_LIMITS.searchVariantAlternativeCount
    || counts('translation_candidate') > 1) {
    throw new Phase9ContractError(`${fieldName}.proposals`, 'variant type limit exceeded');
  }
  const source: SearchVariantSource = {
    field: sourceField,
    text,
    language,
    script: sourceScript,
    deterministicSearchKey: normalizeBibliographicSearchKey(text),
  };
  return { source, proposals: deduplicate(source, parsed) };
}

function array(value: unknown, field: string, max: number): readonly unknown[] {
  if (!Array.isArray(value) || value.length > max) {
    throw new Phase9ContractError(field, `must be an array with at most ${max} entries`);
  }
  return value;
}

export function parseSearchVariantProposalSidecar(
  value: unknown,
): SearchVariantProposalSidecar {
  if (utf8ByteLength(value) > PHASE9_LIMITS.searchVariantSidecarBytes) {
    throw new Phase9ContractError('search_variant_sidecar', 'exceeds byte limit');
  }
  const input = asRecord(value, 'search_variant_sidecar');
  assertKnownKeys(input, SIDECAR_KEYS, 'search_variant_sidecar');
  if (input.contract_version !== PHASE9_CONTRACT_VERSION
    || input.schema_version !== PHASE9_SEARCH_VARIANT_SCHEMA_VERSION) {
    throw new Phase9ContractError('search_variant_sidecar', 'unsupported contract version');
  }
  if (!GENERATION_SOURCES.includes(
    input.generation_source as typeof GENERATION_SOURCES[number],
  )) {
    throw new Phase9ContractError('generation_source', 'unsupported generation source');
  }
  const titles = array(
    input.titles, 'titles', PHASE9_LIMITS.searchVariantTitleCount,
  ).map((entry, index) => field(
    entry, `titles[${index}]`, 'title', PHASE9_LIMITS.titleChars,
  ) as TitleSearchVariantField);
  const authorValues = array(
    input.authors, 'authors', PHASE9_LIMITS.searchVariantAuthorFieldCount,
  );
  const authors = authorValues.map((entry, index) => field(
    entry, `authors[${index}]`, 'author', PHASE9_LIMITS.authorChars,
  ) as AuthorSearchVariantField);
  const sourceFields = [...titles, ...authors].map(({ source }) => source.field);
  if (new Set(sourceFields).size !== sourceFields.length) {
    throw new Phase9ContractError('search_variant_sidecar', 'duplicate source field');
  }
  return {
    contractVersion: PHASE9_CONTRACT_VERSION,
    schemaVersion: PHASE9_SEARCH_VARIANT_SCHEMA_VERSION,
    analysisReference: requiredString(
      input.analysis_reference, 'analysis_reference', 128,
      { activeContent: false, pattern: OPAQUE_REFERENCE },
    ),
    generationSource:
      input.generation_source as typeof GENERATION_SOURCES[number],
    providerKey: requiredString(
      input.provider_key, 'provider_key', 64,
      { activeContent: false, pattern: IDENTIFIER },
    ),
    modelKey: requiredString(
      input.model_key, 'model_key', 64,
      { activeContent: false, pattern: IDENTIFIER },
    ),
    modelVersion: requiredString(
      input.model_version, 'model_version', 64,
      { activeContent: false, pattern: VERSION_IDENTIFIER },
    ),
    promptVersion: requiredString(
      input.prompt_version, 'prompt_version', 64,
      { activeContent: false, pattern: VERSION_IDENTIFIER },
    ),
    titles,
    authors,
  };
}

function sidecarSourcesMatchVision(
  sidecar: SearchVariantProposalSidecar,
  vision: SpineAnalysisResult,
): boolean {
  return [...sidecar.titles, ...sidecar.authors].every(({ source }) => {
    const titleMatch = TITLE_SOURCE_FIELD.exec(source.field);
    const authorMatch = AUTHOR_SOURCE_FIELD.exec(source.field);
    const observationOrdinal = Number(titleMatch?.[1] ?? authorMatch?.[1]);
    const observation = vision.observations[observationOrdinal - 1];
    if (!observation || observation.ordinal !== observationOrdinal) return false;
    if (titleMatch) return observation.titleGuess === source.text;
    const authorOrdinal = Number(authorMatch?.[2]);
    return observation.authorGuesses[authorOrdinal - 1] === source.text;
  });
}

export function decodeVisionSearchVariantCompanion(
  visionValue: unknown,
  sidecarValue: unknown,
): Readonly<{ vision: SpineAnalysisResult; searchVariantProposals: SearchVariantCompanion }> {
  const vision = parseSpineAnalysisResult(visionValue);
  if (sidecarValue === null || sidecarValue === undefined) {
    return {
      vision,
      searchVariantProposals: { status: 'missing', value: null },
    };
  }
  try {
    const value = parseSearchVariantProposalSidecar(sidecarValue);
    const matches = value.analysisReference === vision.correlationId
      && value.providerKey === vision.providerKey
      && value.modelKey === vision.modelKey
      && value.modelVersion === vision.modelVersion
      && value.promptVersion === vision.promptVersion
      && sidecarSourcesMatchVision(value, vision);
    if (!matches) {
      throw new Phase9ContractError('search_variant_sidecar', 'provenance mismatch');
    }
    return { vision, searchVariantProposals: { status: 'accepted', value } };
  } catch {
    return {
      vision,
      searchVariantProposals: {
        status: 'rejected',
        value: null,
        reason: 'schema_invalid',
      },
    };
  }
}
