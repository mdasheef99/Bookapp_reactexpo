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
  assertRawPayloadWithinLimit,
  assertKnownKeys,
  boundedInteger,
  canonicalBcp47,
  Phase9ContractError,
  requiredString,
} from '../domain/validation';
import { PHASE9_LIMITS } from '../contracts/registers';
import { PHASE9_MAX_CANDIDATES } from '../contracts/versions';

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
const MAX_PROVIDER_VISIBLE_BOOKS = 100;
const IMAGE_OUTCOMES = [
  'analyzed', 'no_books', 'too_many_books', 'quality_rejected',
] as const;
const HUMAN_LANGUAGE_LABEL = /^[\p{L}\p{M}]+(?:[ ._'’()-]+[\p{L}\p{M}]+)*$/u;

function compactLanguage(value: unknown, field: string): string {
  if (value === null || value === undefined) return 'und';
  if (typeof value !== 'string') {
    throw new Phase9ContractError(field, 'must be a string');
  }
  const known = LANGUAGE_NAMES[value.trim().toLocaleLowerCase('en-US')];
  if (known) return known;
  try {
    return canonicalBcp47(value, field);
  } catch {
    const label = requiredString(value, field, PHASE9_LIMITS.languageTagChars);
    if (!HUMAN_LANGUAGE_LABEL.test(label)) {
      throw new Phase9ContractError(field, 'has an invalid language label format');
    }
    return 'und';
  }
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
  if (vision.observations.length > MAX_PROVIDER_VISIBLE_BOOKS) {
    throw new Phase9ContractError(
      'gemini_response.vision.observations',
      `must contain at most ${MAX_PROVIDER_VISIBLE_BOOKS} entries`,
    );
  }
  const reportedCount = vision.detected_visible_book_count === null
    ? null
    : boundedInteger(
      vision.detected_visible_book_count,
      'gemini_response.vision.detected_visible_book_count',
      0,
      MAX_PROVIDER_VISIBLE_BOOKS,
    );
  const imageOutcome = vision.image_outcome === 'success'
    ? 'analyzed' : vision.image_outcome;
  if (typeof imageOutcome !== 'string'
    || !IMAGE_OUTCOMES.includes(imageOutcome as typeof IMAGE_OUTCOMES[number])) {
    throw new Phase9ContractError(
      'gemini_response.vision.image_outcome', 'unsupported image outcome',
    );
  }
  const defensiveVisibleCount = Math.max(
    reportedCount ?? 0,
    vision.observations.length,
  );
  if (defensiveVisibleCount > PHASE9_MAX_CANDIDATES) {
    return {
      canonical: {
        image_outcome: 'too_many_books',
        detected_visible_book_count: defensiveVisibleCount,
        observations: [],
        warning_codes: [],
      },
      flattenedObservations: [],
    };
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
      detected_language: compactLanguage(
        observation.detected_language, `${field}.detected_language`,
      ),
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
  assertRawPayloadWithinLimit(providerOutput, 'gemini_response');
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
