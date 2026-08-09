import {
  asRecord,
  assertKnownKeys,
  Phase9ContractError,
  requiredString,
} from '../domain/validation';
import {
  PHASE9_CONTRACT_VERSION,
  PHASE9_SEARCH_VARIANT_SCHEMA_VERSION,
} from '../contracts/versions';
import { SpineAnalysisResult } from '../contracts/vision';
import {
  SupportedSearchVariantScript,
  textUsesScript,
} from '../contracts/searchVariantScripts';

const OBSERVATION_KEYS = [
  'ordinal', 'title_guess', 'author_guesses', 'publisher_clue', 'isbn_clue',
  'detected_language', 'confidence', 'title_romanization',
  'english_translation_candidate', 'author_romanizations',
] as const;
const SCRIPTS: readonly SupportedSearchVariantScript[] = [
  'Latn', 'Knda', 'Taml', 'Telu', 'Mlym', 'Deva', 'Arab', 'Mtei',
];

function optionalProposalText(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  return requiredString(value, field, 256);
}

function inferredScript(text: string, field: string): SupportedSearchVariantScript {
  const script = SCRIPTS.find((candidate) => textUsesScript(text, candidate));
  if (!script) throw new Phase9ContractError(field, 'unsupported source script');
  return script;
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
  if (!Array.isArray(value) || value.length !== vision.observations.length) {
    throw new Phase9ContractError(
      'vision.observations', 'must match canonical observations',
    );
  }
  const titles: Record<string, unknown>[] = [];
  const authors: Record<string, unknown>[] = [];

  value.forEach((entry, index) => {
    const field = `vision.observations[${index}]`;
    const input = asRecord(entry, field);
    assertKnownKeys(input, OBSERVATION_KEYS, field);
    const observation = vision.observations[index];
    if (input.ordinal !== observation.ordinal) {
      throw new Phase9ContractError(`${field}.ordinal`, 'does not match vision');
    }

    const titleRomanization = optionalProposalText(
      input.title_romanization, `${field}.title_romanization`,
    );
    const translation = optionalProposalText(
      input.english_translation_candidate,
      `${field}.english_translation_candidate`,
    );
    if (observation.titleGuess) {
      const script = inferredScript(observation.titleGuess, `${field}.title_guess`);
      const proposals = [
        ...(titleRomanization && script !== 'Latn'
          ? [romanProposal(titleRomanization, observation.detectedLanguage)] : []),
        ...(translation ? [translationProposal(translation)] : []),
      ];
      if (proposals.length > 0) {
        titles.push({
          source_field: `observation:${observation.ordinal}:title`,
          source_text: observation.titleGuess,
          source_language: observation.detectedLanguage,
          source_script: script,
          proposals,
        });
      }
    }

    if (!Array.isArray(input.author_romanizations)
      || input.author_romanizations.length > 5
      || input.author_romanizations.length !== observation.authorGuesses.length) {
      throw new Phase9ContractError(
        `${field}.author_romanizations`, 'must align one-to-one with author_guesses',
      );
    }
    input.author_romanizations.forEach((rawRomanization, authorIndex) => {
      const romanization = optionalProposalText(
        rawRomanization, `${field}.author_romanizations[${authorIndex}]`,
      );
      if (!romanization) return;
      const sourceText = observation.authorGuesses[authorIndex];
      const script = inferredScript(sourceText, `${field}.author_guesses[${authorIndex}]`);
      if (script === 'Latn') return;
      authors.push({
        source_field: `observation:${observation.ordinal}:author:${authorIndex + 1}`,
        source_text: sourceText,
        source_language: observation.detectedLanguage,
        source_script: script,
        proposals: [romanProposal(romanization, observation.detectedLanguage)],
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
