import {
  assertSpineAnalysisIdentity,
  SpineAnalysisRequest,
  SpineAnalysisResult,
} from '../contracts/vision';
import {
  decodeVisionSearchVariantCompanion,
  SearchVariantCompanion,
} from '../contracts/searchVariants';

export type GeminiAnalysisWithCompanion = Readonly<{
  vision: SpineAnalysisResult;
  searchVariantProposals: SearchVariantCompanion;
}>;

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
  const outer = Object.prototype.hasOwnProperty.call(providerOutput, 'vision');
  const visionOutput = outer ? providerOutput.vision : providerOutput;
  const sidecarOutput = outer
    ? providerOutput.search_variant_proposals
    : undefined;
  const decoded = decodeVisionSearchVariantCompanion(resultEnvelope(
    request,
    modelId,
    receivedAt,
    visionOutput as Record<string, unknown>,
  ), sidecarOutput);
  assertSpineAnalysisIdentity(request, decoded.vision);
  return {
    vision: decoded.vision,
    searchVariantProposals: decoded.searchVariantProposals,
  };
}
