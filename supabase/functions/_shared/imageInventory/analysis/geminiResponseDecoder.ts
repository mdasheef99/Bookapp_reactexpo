import {
  assertSpineAnalysisIdentity,
  SpineAnalysisRequest,
  SpineAnalysisResult,
} from '../contracts/vision';
import {
  decodeVisionSearchVariantCompanion,
  SearchVariantCompanion,
} from '../contracts/searchVariants';
import { buildGeminiSearchVariantSidecar } from './geminiMultilingualEnrichment';
import {
  asRecord,
  assertKnownKeys,
  Phase9ContractError,
} from '../domain/validation';

export type GeminiAnalysisWithCompanion = Readonly<{
  vision: SpineAnalysisResult;
  searchVariantProposals: SearchVariantCompanion;
}>;

const LANGUAGE_NAMES: Readonly<Record<string, string>> = {
  english: 'en', hindi: 'hi', kannada: 'kn', tamil: 'ta', telugu: 'te',
  malayalam: 'ml', arabic: 'ar', meitei: 'mni', manipuri: 'mni',
};
const RESPONSE_KEYS = ['vision'] as const;
const VISION_KEYS = [
  'image_outcome', 'detected_visible_book_count', 'observations',
] as const;
const OBSERVATION_KEYS = [
  'ordinal', 'title_guess', 'author_guesses', 'publisher_clue', 'isbn_clue',
  'detected_language', 'confidence', 'title_romanization',
  'english_translation_candidate', 'author_romanizations',
] as const;

function compactLanguage(value: unknown): unknown {
  if (value === null || value === undefined) return 'und';
  if (typeof value !== 'string') return value;
  return LANGUAGE_NAMES[value.trim().toLocaleLowerCase('en-US')] ?? value;
}

function compactIsbnClue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const withoutLabel = value.trim().replace(/^ISBN(?:-1[03])?\s*:?\s*/iu, '');
  return /^(?=.*\d)[\dXx\s-]+$/u.test(withoutLabel) ? withoutLabel : value;
}

function compactVision(value: unknown): Readonly<{
  canonical: Record<string, unknown>;
  flattenedObservations: readonly Record<string, unknown>[];
}> {
  const vision = asRecord(value, 'gemini_response.vision');
  assertKnownKeys(vision, VISION_KEYS, 'gemini_response.vision');
  if (!Array.isArray(vision.observations)) {
    throw new Phase9ContractError('gemini_response.vision.observations', 'must be an array');
  }
  const flattenedObservations = vision.observations.map((entry, index) => {
    const field = `gemini_response.vision.observations[${index}]`;
    const observation = asRecord(entry, field);
    assertKnownKeys(observation, OBSERVATION_KEYS, field);
    if (!Array.isArray(observation.author_guesses)
      || observation.author_guesses.length > 5) {
      throw new Phase9ContractError(
        `${field}.author_guesses`, 'must contain at most 5 entries',
      );
    }
    return {
      ordinal: observation.ordinal,
      title_guess: observation.title_guess,
      author_guesses: observation.author_guesses,
      publisher_clue: observation.publisher_clue,
      isbn_clue: compactIsbnClue(observation.isbn_clue),
      detected_language: compactLanguage(observation.detected_language),
      confidence: observation.confidence,
      title_romanization: observation.title_romanization,
      english_translation_candidate: observation.english_translation_candidate,
      author_romanizations: observation.author_romanizations,
    };
  });
  const observations = flattenedObservations.map((observation) => {
    const {
      title_romanization: _titleRomanization,
      english_translation_candidate: _englishTranslation,
      author_romanizations: _authorRomanizations,
      ...identity
    } = observation;
    return {
      ...identity,
      geometry: null,
      warning_codes: [],
    };
  });
  const imageOutcome = vision.image_outcome === 'success'
    ? 'analyzed' : vision.image_outcome;
  return {
    canonical: {
      image_outcome: imageOutcome,
      detected_visible_book_count: imageOutcome === 'analyzed'
        ? observations.length : vision.detected_visible_book_count,
      observations,
      warning_codes: [],
    },
    flattenedObservations,
  };
}

function resultEnvelope(
  request: SpineAnalysisRequest,
  modelId: string,
  receivedAt: string,
  output: Record<string, unknown>,
) {
  return {
    contract_version: request.contractVersion,
    schema_version: request.schemaVersion,
    pipeline_version: request.pipelineVersion,
    prompt_version: request.promptVersion,
    adapter_key: request.adapterKey,
    adapter_version: request.adapterVersion,
    job_reference: request.jobReference,
    attempt_number: request.attemptNumber,
    correlation_id: request.correlationId,
    expected_language: request.expectedLanguage,
    provider_key: 'google_gemini',
    model_key: modelId,
    model_version: modelId,
    received_at: receivedAt,
    ...output,
  };
}

export function decodeGeminiAnalysisResponse(
  request: SpineAnalysisRequest,
  modelId: string,
  receivedAt: string,
  providerOutput: Record<string, unknown>,
): GeminiAnalysisWithCompanion {
  assertKnownKeys(providerOutput, RESPONSE_KEYS, 'gemini_response');
  const compact = compactVision(providerOutput.vision);
  const envelope = resultEnvelope(
    request,
    modelId,
    receivedAt,
    compact.canonical,
  );
  const canonical = decodeVisionSearchVariantCompanion(envelope, undefined);
  assertSpineAnalysisIdentity(request, canonical.vision);
  let sidecarOutput: unknown;
  try {
    const built = buildGeminiSearchVariantSidecar(
      compact.flattenedObservations,
      canonical.vision,
      {
        analysisReference: request.correlationId,
        modelId,
        promptVersion: request.promptVersion,
      },
    );
    sidecarOutput = built ?? undefined;
  } catch {
    return {
      vision: canonical.vision,
      searchVariantProposals: {
        status: 'rejected', value: null, reason: 'schema_invalid',
      },
    };
  }
  const decoded = decodeVisionSearchVariantCompanion(envelope, sidecarOutput);
  assertSpineAnalysisIdentity(request, decoded.vision);
  return {
    vision: decoded.vision,
    searchVariantProposals: decoded.searchVariantProposals,
  };
}
