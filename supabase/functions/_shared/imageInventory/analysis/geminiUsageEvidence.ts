import { SpineAnalysisRequest } from '../contracts/vision';

export type GeminiUsageEvidence = Readonly<{
  providerKey: 'google_gemini';
  modelId: string;
  adapterKey: string;
  adapterVersion: string;
  promptVersion: string;
  schemaVersion: string;
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens: number;
  thinkingTokens: number;
  costUnits: number | null;
  costPolicyVersion: string | null;
  pricingInput: Readonly<Record<string, string | number>> | null;
}>;

export type GeminiCostCalculator = (
  evidence: Omit<
  GeminiUsageEvidence,
  'costUnits' | 'costPolicyVersion' | 'pricingInput'
  >,
) => Readonly<{
  costUnits: number;
  policyVersion: string;
  pricingInput: Readonly<Record<string, string | number>>;
}>;

const POLICY_VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const MAX_TOKENS = 1_000_000_000;

function boundedToken(value: unknown): number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_TOKENS
    ? value as number : 0;
}

export function extractGeminiUsageEvidence(
  request: SpineAnalysisRequest,
  modelId: string,
  metadata: unknown,
  calculateCostUnits?: GeminiCostCalculator,
): GeminiUsageEvidence {
  const input = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata as Record<string, unknown> : {};
  const withoutCost = {
    providerKey: 'google_gemini' as const,
    modelId,
    adapterKey: request.adapterKey,
    adapterVersion: request.adapterVersion,
    promptVersion: request.promptVersion,
    schemaVersion: request.schemaVersion,
    promptTokens: boundedToken(input.promptTokenCount),
    outputTokens: boundedToken(input.candidatesTokenCount),
    totalTokens: boundedToken(input.totalTokenCount),
    cachedTokens: boundedToken(input.cachedContentTokenCount),
    thinkingTokens: boundedToken(input.thoughtsTokenCount),
  };
  const cost = calculateCostUnits?.(withoutCost);
  const pricingInputValid = cost?.pricingInput
    && typeof cost.pricingInput === 'object'
    && !Array.isArray(cost.pricingInput)
    && JSON.stringify(cost.pricingInput).length <= 4096;
  const costValid = cost && Number.isFinite(cost.costUnits) && cost.costUnits >= 0
    && cost.costUnits <= MAX_TOKENS && POLICY_VERSION.test(cost.policyVersion)
    && pricingInputValid;
  return {
    ...withoutCost,
    costUnits: costValid ? cost.costUnits : null,
    costPolicyVersion: costValid ? cost.policyVersion : null,
    pricingInput: costValid ? cost.pricingInput : null,
  };
}
