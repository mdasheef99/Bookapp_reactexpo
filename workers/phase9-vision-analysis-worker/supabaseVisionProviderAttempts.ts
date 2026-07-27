import { randomUUID } from 'node:crypto';
import {
  GeminiUsageEvidence,
  VisionClaimContext,
  VisionProviderAttemptGateway,
} from '../../supabase/functions/_shared/imageInventory/analysis/geminiSpineImageAnalyzer';
import { SpineAnalyzerError } from '../../supabase/functions/_shared/imageInventory/analysis/spineAnalyzerError';
import { VisionMediaAuthorization } from './supabaseVisionMediaResolver';

type RpcResult = Readonly<{ data: unknown; error: { message?: string } | null }>;
type ServiceClient = Readonly<{
  rpc(name: string, args: Record<string, unknown>): Promise<RpcResult>;
}>;
type Registration = Readonly<{
  attempt_id: string;
  media_bucket: string;
  media_path: string;
  media_mime: string;
}>;

function databaseError(): SpineAnalyzerError {
  return new SpineAnalyzerError(
    'P9_VISION_ANALYZER_UNAVAILABLE', true, 'provider_error',
  );
}

async function rpc(
  client: ServiceClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  try {
    const result = await client.rpc(name, args);
    if (result.error) throw databaseError();
    return result.data;
  } catch (error) {
    if (error instanceof SpineAnalyzerError) throw error;
    throw databaseError();
  }
}

function registration(value: unknown): Readonly<{
  attemptId: string;
  mediaAuthorization: VisionMediaAuthorization;
}> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw databaseError();
  const input = value as Partial<Registration>;
  if (typeof input.attempt_id !== 'string'
    || typeof input.media_bucket !== 'string'
    || typeof input.media_path !== 'string'
    || input.media_mime !== 'image/webp') throw databaseError();
  return {
    attemptId: input.attempt_id,
    mediaAuthorization: {
      mediaBucket: input.media_bucket,
      mediaPath: input.media_path,
      mediaMime: 'image/webp',
    },
  };
}

const claimArgs = (claim: VisionClaimContext) => ({
  p_job_id: claim.jobId,
  p_worker: claim.leaseOwner,
  p_lease_token: claim.leaseToken,
  p_attempt_count: claim.attemptNumber,
});

export function createSupabaseVisionProviderAttempts(client: ServiceClient):
VisionProviderAttemptGateway & Readonly<{
  associate(attemptId: string, claim: VisionClaimContext): Promise<void>;
}> {
  return {
    async register(request, claim, lineage) {
      return registration(await rpc(client, 'phase9_register_vision_provider_attempt', {
        ...claimArgs(claim),
        p_job_reference: request.jobReference,
        p_correlation_id: request.correlationId,
        p_sanitized_media_reference: request.sanitizedMediaReference,
        p_external_call_id: randomUUID(),
        p_provider_role: lineage.providerRole,
        p_provider_key: lineage.providerKey,
        p_adapter_key: request.adapterKey,
        p_adapter_version: request.adapterVersion,
        p_model_key: lineage.modelKey,
        p_model_version: lineage.modelVersion,
        p_prompt_version: request.promptVersion,
        p_schema_version: request.schemaVersion,
      }));
    },
    async finalize(attemptId, claim, evidence) {
      const usage: GeminiUsageEvidence = evidence.usage;
      await rpc(client, 'phase9_finalize_vision_provider_attempt', {
        ...claimArgs(claim),
        p_attempt_id: attemptId,
        p_disposition: evidence.disposition,
        p_normalized_outcome: evidence.normalizedOutcome,
        p_provider_request_id: evidence.providerRequestId,
        p_usage: {
          prompt_tokens: usage.promptTokens,
          output_tokens: usage.outputTokens,
          total_tokens: usage.totalTokens,
          cached_tokens: usage.cachedTokens,
          thinking_tokens: usage.thinkingTokens,
        },
        p_pricing_policy_version: usage.costPolicyVersion,
        p_pricing_input: usage.pricingInput,
        p_cost_units: usage.costUnits,
      });
    },
    async mark(attemptId, claim, disposition, normalizedOutcome) {
      await rpc(client, 'phase9_mark_vision_provider_attempt', {
        p_attempt_id: attemptId,
        p_job_id: claim.jobId,
        p_disposition: disposition,
        p_normalized_outcome: normalizedOutcome,
      });
    },
    async associate(attemptId, claim) {
      await rpc(client, 'phase9_associate_vision_provider_attempt', {
        ...claimArgs(claim),
        p_attempt_id: attemptId,
      });
    },
  };
}
