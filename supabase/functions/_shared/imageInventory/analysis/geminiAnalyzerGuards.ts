import { SpineAnalyzerError } from './spineAnalyzerError';

const MODEL_ID = /^[a-z][a-z0-9._-]{1,63}$/u;
const PROVIDER_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/u;

export const MAX_GEMINI_IMAGE_BYTES = 10 * 1024 * 1024;

export type GeminiSafeLogEvent = Readonly<{
  event: 'gemini_analysis_completed' | 'gemini_analysis_failed';
  provider: 'google_gemini';
  modelId: string;
  outcome?: string;
  classification?: string;
  durationMs: number;
}>;

export class GeminiAnalyzerError extends SpineAnalyzerError {
  override readonly name = 'GeminiAnalyzerError';
}

export function assertGeminiConfiguration(
  modelId: string,
  timeoutMs: number,
  privilegedValues: readonly string[],
) {
  if (!MODEL_ID.test(modelId)
    || !Number.isInteger(timeoutMs)
    || timeoutMs < 100
    || timeoutMs > 300_000
    || privilegedValues.some((value) => !value)) {
    throw new Error('P9_WORKER_CONFIGURATION_INVALID');
  }
}

export function safeProviderRequestId(value: unknown): string | null {
  return typeof value === 'string' && PROVIDER_REQUEST_ID.test(value) ? value : null;
}

export function classifyGeminiFailure(error: unknown) {
  if (error && typeof error === 'object') {
    const name = (error as { name?: unknown }).name;
    if (name === 'AbortError' || name === 'TimeoutError' || name === 'RequestTimeoutError') {
      return 'timeout';
    }
    const status = (error as { status?: unknown }).status;
    if (status === 429) return 'rate_limited';
  }
  return 'provider_error';
}
