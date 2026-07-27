import type {
  GenerateContentParameters,
  GenerateContentResponse,
} from '@google/genai';
import {
  assertSpineAnalysisIdentity,
  parseSpineAnalysisResult,
  SpineAnalysisRequest,
  SpineAnalysisResult,
  SpineImageAnalyzer,
} from '../contracts/vision';
import {
  GEMINI_VISION_PROMPT,
  GEMINI_VISION_RESPONSE_SCHEMA,
} from './geminiVisionSchema';
import { SpineAnalyzerError } from './spineAnalyzerError';

export { GEMINI_VISION_RESPONSE_SCHEMA } from './geminiVisionSchema';

type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';
type MediaInput = Readonly<{ bytes: Uint8Array; mimeType: ImageMime }>;
type GeminiResponse = Pick<GenerateContentResponse, 'text' | 'usageMetadata'>;
export type GeminiClient = Readonly<{
  models: {
    generateContent(parameters: GenerateContentParameters): Promise<GeminiResponse>;
  };
}>;

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
}>;

type SafeLogEvent = Readonly<{
  event: 'gemini_analysis_completed' | 'gemini_analysis_failed';
  provider: 'google_gemini';
  modelId: string;
  outcome?: string;
  classification?: string;
  durationMs: number;
}>;

export type GeminiAnalyzerOptions = Readonly<{
  client: GeminiClient;
  modelId: string;
  timeoutMs: number;
  resolveMedia(request: SpineAnalysisRequest): Promise<MediaInput>;
  recordUsage?: (evidence: GeminiUsageEvidence) => void | Promise<void>;
  calculateCostUnits?: (
    evidence: Omit<GeminiUsageEvidence, 'costUnits' | 'costPolicyVersion'>,
  ) => Readonly<{ costUnits: number; policyVersion: string }>;
  log?: (event: SafeLogEvent) => void;
  now?: () => Date;
  privilegedValues?: readonly string[];
}>;

const MODEL_ID = /^[a-z][a-z0-9._-]{1,63}$/u;
const POLICY_VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const MAX_TOKENS = 1_000_000_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export class GeminiAnalyzerError extends SpineAnalyzerError {
  override readonly name = 'GeminiAnalyzerError';
}

function boundedToken(value: unknown): number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_TOKENS
    ? value as number : 0;
}

function safeStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const status = (error as { status?: unknown }).status;
  return Number.isInteger(status) ? status as number : null;
}

function isTimeout(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = (error as { name?: unknown }).name;
  return name === 'AbortError' || name === 'TimeoutError' || name === 'RequestTimeoutError';
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

function usageEvidence(
  request: SpineAnalysisRequest,
  modelId: string,
  metadata: unknown,
  calculateCostUnits: GeminiAnalyzerOptions['calculateCostUnits'],
): GeminiUsageEvidence | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const input = metadata as Record<string, unknown>;
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
  const validCost = cost && Number.isFinite(cost.costUnits) && cost.costUnits >= 0
    && cost.costUnits <= MAX_TOKENS && POLICY_VERSION.test(cost.policyVersion);
  return {
    ...withoutCost,
    costUnits: validCost ? cost.costUnits : null,
    costPolicyVersion: validCost ? cost.policyVersion : null,
  };
}

export class GeminiSpineImageAnalyzer implements SpineImageAnalyzer {
  private readonly now: () => Date;

  constructor(private readonly options: GeminiAnalyzerOptions) {
    this.now = options.now ?? (() => new Date());
    if (!MODEL_ID.test(options.modelId)
      || !Number.isInteger(options.timeoutMs)
      || options.timeoutMs < 100
      || options.timeoutMs > 300_000
      || (options.privilegedValues ?? []).some((value) => !value)) {
      throw new Error('P9_WORKER_CONFIGURATION_INVALID');
    }
  }

  async analyze(request: SpineAnalysisRequest): Promise<SpineAnalysisResult> {
    const started = this.now().getTime();
    let media: MediaInput;
    try {
      media = await this.options.resolveMedia(request);
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(media.mimeType)
        || media.bytes.byteLength < 1 || media.bytes.byteLength > MAX_IMAGE_BYTES) {
        throw new Error('invalid media');
      }
    } catch {
      this.failed('media_unavailable', started);
      throw new GeminiAnalyzerError(
        'P9_VISION_MEDIA_UNAVAILABLE', false, 'media_unavailable',
      );
    }

    let response: GeminiResponse;
    try {
      response = await this.options.client.models.generateContent({
        model: this.options.modelId,
        contents: [{
          role: 'user',
          parts: [
            { text: GEMINI_VISION_PROMPT },
            {
              inlineData: {
                mimeType: media.mimeType,
                data: Buffer.from(media.bytes).toString('base64'),
              },
            },
          ],
        }],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: GEMINI_VISION_RESPONSE_SCHEMA,
          temperature: 0,
          candidateCount: 1,
          tools: undefined,
          httpOptions: { timeout: this.options.timeoutMs },
          abortSignal: AbortSignal.timeout(this.options.timeoutMs),
        },
      });
    } catch (error) {
      const classification = isTimeout(error)
        ? 'timeout' : safeStatus(error) === 429 ? 'rate_limited' : 'provider_error';
      this.failed(classification, started);
      throw new GeminiAnalyzerError(
        classification === 'timeout'
          ? 'P9_VISION_ANALYZER_TIMEOUT' : 'P9_VISION_ANALYZER_UNAVAILABLE',
        true,
        classification,
      );
    }

    const usage = usageEvidence(
      request,
      this.options.modelId,
      response.usageMetadata,
      this.options.calculateCostUnits,
    );
    if (usage) await this.options.recordUsage?.(usage);

    let providerOutput: Record<string, unknown>;
    try {
      if (typeof response.text !== 'string') throw new Error('missing text');
      const parsed = JSON.parse(response.text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('invalid json');
      }
      providerOutput = parsed as Record<string, unknown>;
    } catch {
      this.failed('malformed_response', started);
      throw new GeminiAnalyzerError(
        'P9_VISION_SCHEMA_INVALID', false, 'malformed_response',
      );
    }

    try {
      const result = parseSpineAnalysisResult(resultEnvelope(
        request,
        this.options.modelId,
        this.now().toISOString(),
        providerOutput,
      ));
      assertSpineAnalysisIdentity(request, result);
      this.options.log?.({
        event: 'gemini_analysis_completed',
        provider: 'google_gemini',
        modelId: this.options.modelId,
        outcome: result.imageOutcome,
        durationMs: Math.max(0, this.now().getTime() - started),
      });
      return result;
    } catch {
      this.failed('schema_invalid', started);
      throw new GeminiAnalyzerError(
        'P9_VISION_SCHEMA_INVALID', false, 'schema_invalid',
      );
    }
  }

  private failed(
    classification: 'timeout' | 'rate_limited' | 'provider_error'
      | 'media_unavailable' | 'malformed_response' | 'schema_invalid',
    started: number,
  ): void {
    this.options.log?.({
      event: 'gemini_analysis_failed',
      provider: 'google_gemini',
      modelId: this.options.modelId,
      classification,
      durationMs: Math.max(0, this.now().getTime() - started),
    });
  }
}
