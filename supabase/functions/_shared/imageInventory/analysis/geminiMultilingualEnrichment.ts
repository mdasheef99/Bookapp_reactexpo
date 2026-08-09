import {
  asRecord,
  assertKnownKeys,
  canonicalBcp47,
  Phase9ContractError,
  requiredString,
} from '../domain/validation';
import {
  PHASE9_CONTRACT_VERSION,
  PHASE9_SEARCH_VARIANT_SCHEMA_VERSION,
} from '../contracts/versions';
import {
  SpineAnalysisResult,
} from '../contracts/vision';
import {
  SupportedSearchVariantScript,
  textUsesScript,
} from '../contracts/searchVariantScripts';

const ENRICHMENT_KEYS = [
  'observation_ordinal', 'title', 'authors',
] as const;
const TITLE_KEYS = [
  'source_language', 'source_script', 'title_romanization',
  'english_translation_candidate',
] as const;
const AUTHOR_KEYS = [
  'author_ordinal', 'source_language', 'source_script', 'author_romanization',
] as const;
const SCRIPTS: readonly SupportedSearchVariantScript[] = [
  'Latn', 'Knda', 'Taml', 'Telu', 'Mlym', 'Deva', 'Arab', 'Mtei',
];

function nullableText(value: unknown, field: string): string | null {
  if (value === null) return null;
  return requiredString(value, field, 256);
}
function sourceScript(value: unknown, text: string, field: string): SupportedSearchVariantScript {
  if (typeof value !== 'string' || !SCRIPTS.includes(value as SupportedSearchVariantScript)
    || !textUsesScript(text, value as SupportedSearchVariantScript)) {
    throw new Phase9ContractError(field, 'script does not match source text');
  }
  return value as SupportedSearchVariantScript;
}

function romanProposal(text: string, language: string) {
  return {
    variant_text: text,
    variant_language: language,
    variant_script: 'Latn',
    variant_type: 'primary_roman',
  };
}

function translationProposal(text: string) {
  return {
    variant_text: text,
    variant_language: 'en',
    variant_script: 'Latn',
    variant_type: 'translation_candidate',
  };
}

export function buildGeminiSearchVariantSidecar(
  value: unknown,
  vision: SpineAnalysisResult,
  identity: Readonly<{
    analysisReference: string;
    modelId: string;
    promptVersion: string;
  }>,
): Record<string, unknown> | null {
  if (!Array.isArray(value) || value.length > 15) {
    throw new Phase9ContractError(
      'multilingual_search_enrichment', 'must contain at most 15 entries',
    );
  }
  const titles: Record<string, unknown>[] = [];
  const authors: Record<string, unknown>[] = [];
  const seenOrdinals = new Set<number>();

  value.forEach((entry, index) => {
    const field = `multilingual_search_enrichment[${index}]`;
    const input = asRecord(entry, field);
    assertKnownKeys(input, ENRICHMENT_KEYS, field);
    const ordinal = input.observation_ordinal;
    if (!Number.isInteger(ordinal) || (ordinal as number) < 1
      || (ordinal as number) > 15 || seenOrdinals.has(ordinal as number)) {
      throw new Phase9ContractError(
        `${field}.observation_ordinal`, 'invalid or duplicate ordinal',
      );
    }
    seenOrdinals.add(ordinal as number);
    const observation = vision.observations.find((item) => item.ordinal === ordinal);
    if (!observation) {
      throw new Phase9ContractError(
        `${field}.observation_ordinal`, 'missing vision observation',
      );
    }
    if (input.title !== null) {
      const title = asRecord(input.title, `${field}.title`);
      assertKnownKeys(title, TITLE_KEYS, `${field}.title`);
      if (!observation.titleGuess) {
        throw new Phase9ContractError(`${field}.title`, 'missing vision title');
      }
      const language = canonicalBcp47(
        title.source_language, `${field}.title.source_language`,
      );
      const script = sourceScript(
        title.source_script, observation.titleGuess, `${field}.title.source_script`,
      );
      const titleRomanization = nullableText(
        title.title_romanization, `${field}.title.title_romanization`,
      );
      const translation = nullableText(
        title.english_translation_candidate,
        `${field}.title.english_translation_candidate`,
      );
      const proposals = [
        ...(titleRomanization && script !== 'Latn'
          ? [romanProposal(titleRomanization, language)] : []),
        ...(translation ? [translationProposal(translation)] : []),
      ];
      if (proposals.length > 0) {
        titles.push({
          source_field: `observation:${ordinal}:title`,
          source_text: observation.titleGuess,
          source_language: language,
          source_script: script,
          proposals,
        });
      }
    }

    if (!Array.isArray(input.authors) || input.authors.length > 5) {
      throw new Phase9ContractError(
        `${field}.authors`, 'must contain at most 5 entries',
      );
    }
    const seenAuthors = new Set<number>();
    input.authors.forEach((authorEntry, authorIndex) => {
      const authorField = `${field}.authors[${authorIndex}]`;
      const author = asRecord(authorEntry, authorField);
      assertKnownKeys(author, AUTHOR_KEYS, authorField);
      const authorOrdinal = author.author_ordinal;
      if (!Number.isInteger(authorOrdinal) || (authorOrdinal as number) < 1
        || (authorOrdinal as number) > observation.authorGuesses.length
        || seenAuthors.has(authorOrdinal as number)) {
        throw new Phase9ContractError(
          `${authorField}.author_ordinal`, 'invalid or duplicate author ordinal',
        );
      }
      seenAuthors.add(authorOrdinal as number);
      const romanization = nullableText(
        author.author_romanization, `${authorField}.author_romanization`,
      );
      const sourceText = observation.authorGuesses[(authorOrdinal as number) - 1];
      const language = canonicalBcp47(
        author.source_language, `${authorField}.source_language`,
      );
      const script = sourceScript(
        author.source_script, sourceText, `${authorField}.source_script`,
      );
      if (!romanization || script === 'Latn') return;
      authors.push({
        source_field: `observation:${ordinal}:author:${authorOrdinal}`,
        source_text: sourceText,
        source_language: language,
        source_script: script,
        proposals: [romanProposal(romanization, language)],
      });
    });
  });

  if (titles.length === 0 && authors.length === 0) return null;
  return {
    contract_version: PHASE9_CONTRACT_VERSION,
    schema_version: PHASE9_SEARCH_VARIANT_SCHEMA_VERSION,
    analysis_reference: identity.analysisReference,
    generation_source: 'vision_model',
    provider_key: 'google_gemini',
    model_key: identity.modelId,
    model_version: identity.modelId,
    prompt_version: identity.promptVersion,
    titles,
    authors,
  };
}
