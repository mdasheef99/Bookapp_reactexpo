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

const RESPONSE_KEYS = ['vision'] as const;
const VISION_KEYS = [
  'image_outcome', 'detected_visible_book_count', 'observations',
] as const;
const OBSERVATION_KEYS = [
  'ordinal', 'title_guess', 'author_guesses', 'publisher_clue', 'isbn_clue',
  'detected_language', 'confidence', 'title_romanization',
  'english_translation_candidate', 'author_romanizations',
] as const;

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
    return observation;
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
      detected_language: identity.detected_language === null
        ? 'und' : identity.detected_language,
      geometry: null,
      warning_codes: [],
    };
  });
  return {
    canonical: {
      ...vision,
      image_outcome: vision.image_outcome === 'success'
        ? 'analyzed' : vision.image_outcome,
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
