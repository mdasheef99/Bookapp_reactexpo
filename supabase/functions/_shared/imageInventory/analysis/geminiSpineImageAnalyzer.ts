import type {
  GenerateContentParameters,
  GenerateContentResponse,
} from '@google/genai';
import {
  SpineAnalysisRequest,
  SpineAnalysisResult,
  SpineImageAnalyzer,
} from '../contracts/vision';
import { SearchVariantCompanion } from '../contracts/searchVariants';
import {
  GEMINI_VISION_PROMPT,
  GEMINI_VISION_RESPONSE_SCHEMA,
} from './geminiVisionSchema';
import {
  extractGeminiUsageEvidence,
  GeminiCostCalculator,
  GeminiUsageEvidence,
} from './geminiUsageEvidence';
import {
  AttemptRegistration,
  VisionClaimContext,
  VisionProviderAttemptGateway,
} from './visionProviderAttempt';
import {
  decodeGeminiAnalysisResponse,
  GeminiAnalysisWithCompanion,
} from './geminiResponseDecoder';
import { SpineAnalyzerError } from './spineAnalyzerError';
import {
  assertGeminiConfiguration,
  classifyGeminiFailure,
  GeminiAnalyzerError,
  GeminiSafeLogEvent,
  MAX_GEMINI_IMAGE_BYTES,
  safeProviderRequestId,
} from './geminiAnalyzerGuards';

export { GEMINI_VISION_RESPONSE_SCHEMA } from './geminiVisionSchema';
export type { GeminiUsageEvidence } from './geminiUsageEvidence';
export type {
  VisionClaimContext,
  VisionProviderAttemptGateway,
} from './visionProviderAttempt';

type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';
type MediaInput = Readonly<{ bytes: Uint8Array; mimeType: ImageMime }>;
type GeminiResponse = Pick<
GenerateContentResponse, 'text' | 'usageMetadata' | 'responseId'
>;
export type { GeminiAnalysisWithCompanion } from './geminiResponseDecoder';
export type GeminiClient = Readonly<{
  models: {
    generateContent(parameters: GenerateContentParameters): Promise<GeminiResponse>;
  };
}>;

export type GeminiAnalyzerOptions = Readonly<{
  client: GeminiClient;
  modelId: string;
  timeoutMs: number;
  resolveMedia(request: SpineAnalysisRequest, authorization?: unknown): Promise<MediaInput>;
  providerAttempts?: VisionProviderAttemptGateway;
  recordUsage?: (evidence: GeminiUsageEvidence) => void | Promise<void>;
  calculateCostUnits?: GeminiCostCalculator;
  log?: (event: GeminiSafeLogEvent) => void;
  now?: () => Date;
  privilegedValues?: readonly string[];
}>;

export { GeminiAnalyzerError } from './geminiAnalyzerGuards';

export class GeminiSpineImageAnalyzer implements SpineImageAnalyzer {
  private readonly now: () => Date;

  constructor(private readonly options: GeminiAnalyzerOptions) {
    this.now = options.now ?? (() => new Date());
    assertGeminiConfiguration(
      options.modelId,
      options.timeoutMs,
      options.privilegedValues ?? [],
    );
  }

  async analyze(request: SpineAnalysisRequest): Promise<SpineAnalysisResult> {
    return (await this.analyzeInternal(request)).result.vision;
  }

  async analyzeWithCompanion(
    request: SpineAnalysisRequest,
  ): Promise<GeminiAnalysisWithCompanion> {
    return (await this.analyzeInternal(request)).result;
  }

  async analyzeClaim(
    request: SpineAnalysisRequest,
    claim: VisionClaimContext,
  ): Promise<Readonly<{
    result: SpineAnalysisResult;
    providerAttemptId: string;
    searchVariantProposals: SearchVariantCompanion;
    accept(): Promise<void>;
    reject(disposition: 'stale_rejected' | 'outcome_unknown', outcome: string): Promise<void>;
  }>> {
    if (!this.options.providerAttempts) throw new Error('P9_WORKER_CONFIGURATION_INVALID');
    const completed = await this.analyzeInternal(request, claim);
    if (!completed.providerAttemptId) throw new Error('P9_WORKER_CONFIGURATION_INVALID');
    const attemptId = completed.providerAttemptId;
    return {
      result: completed.result.vision,
      providerAttemptId: attemptId,
      searchVariantProposals: completed.result.searchVariantProposals,
      accept: async () => {
        if (!this.options.providerAttempts?.associate) {
          throw new Error('P9_WORKER_CONFIGURATION_INVALID');
        }
        await this.options.providerAttempts.associate(attemptId, claim);
      },
      reject: async (disposition, outcome) => {
        await this.options.providerAttempts?.mark(
          attemptId, claim, disposition, outcome,
        );
      },
    };
  }

  private async analyzeInternal(
    request: SpineAnalysisRequest,
    claim?: VisionClaimContext,
  ): Promise<Readonly<{
    result: GeminiAnalysisWithCompanion;
    providerAttemptId?: string;
  }>> {
    const started = this.now().getTime();
    let registration: AttemptRegistration | undefined;
    let media: MediaInput;
    let mediaAuthorization: unknown;
    if (claim && this.options.providerAttempts) {
      registration = await this.options.providerAttempts.register(request, claim, {
        providerRole: 'primary',
        providerKey: 'google_gemini',
        modelKey: this.options.modelId,
        modelVersion: this.options.modelId,
      });
      try {
        mediaAuthorization = await this.options.providerAttempts.validateEgress(
          registration.attemptId, request, claim, 'media_download',
        );
      } catch (error) {
        await this.safeMark(
          registration.attemptId, claim, 'stale_rejected',
          'claim_invalid_before_media_download',
        );
        if (error instanceof SpineAnalyzerError) throw error;
        this.failed('media_unavailable', started);
        throw new GeminiAnalyzerError(
          'P9_VISION_MEDIA_UNAVAILABLE', false, 'media_unavailable',
        );
      }
    }
    try {
      media = await this.options.resolveMedia(request, mediaAuthorization);
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(media.mimeType)
        || media.bytes.byteLength < 1
        || media.bytes.byteLength > MAX_GEMINI_IMAGE_BYTES) {
        throw new Error('invalid media');
      }
    } catch (error) {
      if (registration && claim) {
        await this.safeMark(registration.attemptId, claim, 'failed', 'media_unavailable');
      }
      if (error instanceof SpineAnalyzerError) throw error;
      this.failed('media_unavailable', started);
      throw new GeminiAnalyzerError(
        'P9_VISION_MEDIA_UNAVAILABLE', false, 'media_unavailable',
      );
    }

    let response: GeminiResponse;
    if (registration && claim) {
      try {
        await this.options.providerAttempts?.validateEgress(
          registration.attemptId, request, claim, 'provider_egress',
        );
      } catch (error) {
        await this.safeMark(
          registration.attemptId, claim, 'stale_rejected',
          'claim_invalid_before_provider_egress',
        );
        if (error instanceof SpineAnalyzerError) throw error;
        this.failed('provider_error', started);
        throw new GeminiAnalyzerError(
          'P9_VISION_ANALYZER_UNAVAILABLE', true, 'provider_error',
        );
      }
    }
    try {
      response = await this.options.client.models.generateContent({
        model: this.options.modelId,
        contents: [{
          role: 'user',
          parts: [
            {
              text: [
                GEMINI_VISION_PROMPT,
                `Companion analysis_reference must be ${request.correlationId}.`,
                `Companion model_key/model_version must be ${this.options.modelId}.`,
                `Companion prompt_version must be ${request.promptVersion}.`,
              ].join(' '),
            },
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
      const classification = classifyGeminiFailure(error);
      if (registration && claim) {
        await this.safeMark(
          registration.attemptId,
          claim,
          classification === 'rate_limited' ? 'failed' : 'outcome_unknown',
          classification,
        );
      }
      this.failed(classification, started);
      throw new GeminiAnalyzerError(
        classification === 'timeout'
          ? 'P9_VISION_ANALYZER_TIMEOUT' : 'P9_VISION_ANALYZER_UNAVAILABLE',
        true,
        classification,
      );
    }

    const usage = extractGeminiUsageEvidence(
      request,
      this.options.modelId,
      response.usageMetadata,
      this.options.calculateCostUnits,
    );
    await this.options.recordUsage?.(usage);
    const providerRequestId = safeProviderRequestId(response.responseId);

    let providerOutput: Record<string, unknown>;
    try {
      if (typeof response.text !== 'string') throw new Error('missing text');
      const parsed = JSON.parse(response.text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('invalid json');
      }
      providerOutput = parsed as Record<string, unknown>;
    } catch {
      await this.finalize(
        registration, claim, 'failed', 'malformed_response', providerRequestId, usage,
      );
      this.failed('malformed_response', started);
      throw new GeminiAnalyzerError(
        'P9_VISION_SCHEMA_INVALID', false, 'malformed_response',
      );
    }

    let result: GeminiAnalysisWithCompanion;
    try {
      result = decodeGeminiAnalysisResponse(
        request,
        this.options.modelId,
        this.now().toISOString(),
        providerOutput,
      );
    } catch {
      await this.finalize(
        registration, claim, 'failed', 'schema_invalid', providerRequestId, usage,
      );
      this.failed('schema_invalid', started);
      throw new GeminiAnalyzerError(
        'P9_VISION_SCHEMA_INVALID', false, 'schema_invalid',
      );
    }
    await this.finalize(
      registration, claim, 'response_received', result.vision.imageOutcome, providerRequestId, usage,
    );
    this.options.log?.({
      event: 'gemini_analysis_completed',
      provider: 'google_gemini',
      modelId: this.options.modelId,
      outcome: result.vision.imageOutcome,
      durationMs: Math.max(0, this.now().getTime() - started),
    });
    return { result, providerAttemptId: registration?.attemptId };
  }

  private async finalize(
    registration: AttemptRegistration | undefined,
    claim: VisionClaimContext | undefined,
    disposition: 'response_received' | 'failed',
    normalizedOutcome: string,
    providerRequestId: string | null,
    usage: GeminiUsageEvidence,
  ): Promise<void> {
    if (registration && claim && this.options.providerAttempts) {
      await this.options.providerAttempts.finalize(registration.attemptId, claim, {
        disposition, normalizedOutcome, providerRequestId, usage,
      });
    }
  }

  private async safeMark(
    attemptId: string,
    claim: VisionClaimContext,
    disposition: 'stale_rejected' | 'failed' | 'outcome_unknown',
    normalizedOutcome: string,
  ): Promise<void> {
    try {
      await this.options.providerAttempts?.mark(
        attemptId, claim, disposition, normalizedOutcome,
      );
    } catch {
      // A still-registered row is intentionally discoverable by reconciliation.
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
