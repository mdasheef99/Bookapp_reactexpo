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
  pricingInput: GeminiPricingInput | null;
}>;

export type GeminiPricingInput = Readonly<{
  currency?: string;
  input_basis?: string;
  input_unit_cost?: number;
  output_unit_cost?: number;
  cached_unit_cost?: number;
  thinking_unit_cost?: number;
  pricing_source_version?: string;
}>;

export type GeminiCostCalculator = (
  evidence: Omit<
  GeminiUsageEvidence,
  'costUnits' | 'costPolicyVersion' | 'pricingInput'
  >,
) => Readonly<{
  costUnits: number;
  policyVersion: string;
  pricingInput: GeminiPricingInput;
}>;

const POLICY_VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const IDENTIFIER = /^[a-z][a-z0-9._-]{0,63}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const CURRENCY = /^[A-Z]{3}$/u;
const MAX_TOKENS = 1_000_000_000;
const MAX_UNIT_COST = 1_000_000;
const PRICING_KEYS = new Set([
  'currency', 'input_basis', 'input_unit_cost', 'output_unit_cost',
  'cached_unit_cost', 'thinking_unit_cost', 'pricing_source_version',
]);
const NUMERIC_KEYS = new Set([
  'input_unit_cost', 'output_unit_cost', 'cached_unit_cost', 'thinking_unit_cost',
]);

function boundedToken(value: unknown): number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_TOKENS
    ? value as number : 0;
}

function validPricingInput(value: unknown): value is GeminiPricingInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input);
  if (keys.length < 1 || keys.length > PRICING_KEYS.size
    || keys.some((key) => !PRICING_KEYS.has(key))) return false;
  for (const [key, field] of Object.entries(input)) {
    if (NUMERIC_KEYS.has(key)) {
      if (typeof field !== 'number' || !Number.isFinite(field)
        || field < 0 || field > MAX_UNIT_COST) return false;
    } else if (key === 'currency') {
      if (typeof field !== 'string' || !CURRENCY.test(field)) return false;
    } else if (key === 'input_basis') {
      if (typeof field !== 'string' || !IDENTIFIER.test(field)) return false;
    } else if (typeof field !== 'string' || !VERSION.test(field)) return false;
  }
  return JSON.stringify(input).length <= 1024;
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
  const pricingInputValid = validPricingInput(cost?.pricingInput);
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
