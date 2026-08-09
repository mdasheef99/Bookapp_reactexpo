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

const RESPONSE_KEYS = ['vision', 'multilingual_search_enrichment'] as const;
const VISION_KEYS = [
  'image_outcome', 'detected_visible_book_count', 'observations',
] as const;
const OBSERVATION_KEYS = [
  'ordinal', 'title_guess', 'author_guesses', 'publisher_clue', 'isbn_clue',
  'detected_language', 'confidence',
] as const;

function compactVision(value: unknown): Record<string, unknown> {
  const vision = asRecord(value, 'gemini_response.vision');
  assertKnownKeys(vision, VISION_KEYS, 'gemini_response.vision');
  if (!Array.isArray(vision.observations)) {
    throw new Phase9ContractError('gemini_response.vision.observations', 'must be an array');
  }
  const observations = vision.observations.map((entry, index) => {
    const field = `gemini_response.vision.observations[${index}]`;
    const observation = asRecord(entry, field);
    assertKnownKeys(observation, OBSERVATION_KEYS, field);
    if (!Array.isArray(observation.author_guesses)
      || observation.author_guesses.length > 5) {
      throw new Phase9ContractError(
        `${field}.author_guesses`, 'must contain at most 5 entries',
      );
    }
    return { ...observation, geometry: null, warning_codes: [] };
  });
  return { ...vision, observations, warning_codes: [] };
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
  const visionOutput = compactVision(providerOutput.vision);
  const envelope = resultEnvelope(
    request,
    modelId,
    receivedAt,
    visionOutput as Record<string, unknown>,
  );
  const canonical = decodeVisionSearchVariantCompanion(envelope, undefined);
  assertSpineAnalysisIdentity(request, canonical.vision);
  let sidecarOutput: unknown;
  if (Object.prototype.hasOwnProperty.call(
    providerOutput, 'multilingual_search_enrichment',
  )) {
    try {
      const built = buildGeminiSearchVariantSidecar(
        providerOutput.multilingual_search_enrichment,
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
  }
  const decoded = decodeVisionSearchVariantCompanion(envelope, sidecarOutput);
  assertSpineAnalysisIdentity(request, decoded.vision);
  return {
    vision: decoded.vision,
    searchVariantProposals: decoded.searchVariantProposals,
  };
}
