import { SpineAnalyzerError } from './spineAnalyzerError';
import type {
  GeminiSchemaFailureCategory,
} from './geminiSchemaDiagnostics';

const MODEL_ID = /^[a-z][a-z0-9._-]{1,63}$/u;
const PROVIDER_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/u;

export const MAX_GEMINI_IMAGE_BYTES = 10 * 1024 * 1024;

export type GeminiProviderErrorCategory =
  | 'timeout'
  | 'rate_limited_or_quota'
  | 'authentication_or_key_restriction'
  | 'model_or_endpoint_unavailable'
  | 'malformed_request'
  | 'provider_4xx'
  | 'provider_5xx'
  | 'network'
  | 'provider_error';

export type GeminiFailureEvidence = Readonly<{
  httpStatus: number | null;
  providerErrorCode: string | null;
  providerErrorCategory: GeminiProviderErrorCategory;
  providerRequestId: string | null;
  safeMessage: string;
}>;

export type GeminiSafeLogEvent = Readonly<{
  event: 'gemini_analysis_completed' | 'gemini_analysis_failed';
  provider: 'google_gemini';
  modelId: string;
  outcome?: string;
  classification?: string;
  durationMs: number;
  httpStatus?: number | null;
  providerErrorCode?: string | null;
  providerErrorCategory?: GeminiProviderErrorCategory;
  providerRequestId?: string | null;
  safeMessage?: string;
  schemaField?: string | null;
  schemaFailureCategory?: GeminiSchemaFailureCategory;
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

function containsPrivilegedValue(
  value: string,
  privilegedValues: readonly string[],
): boolean {
  return privilegedValues.some((privileged) => value.includes(privileged));
}

export function safeProviderRequestId(
  value: unknown,
  privilegedValues: readonly string[] = [],
): string | null {
  return typeof value === 'string'
    && PROVIDER_REQUEST_ID.test(value)
    && !containsPrivilegedValue(value, privilegedValues)
    ? value
    : null;
}

type ErrorRecord = Readonly<Record<string, unknown>>;

function asRecord(value: unknown): ErrorRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as ErrorRecord
    : null;
}

function safeProviderErrorCode(
  value: unknown,
  privilegedValues: readonly string[],
): string | null {
  return typeof value === 'string'
    && /^[A-Z][A-Z0-9_]{1,63}$/u.test(value)
    && !containsPrivilegedValue(value, privilegedValues)
    ? value
    : null;
}

function numericHttpStatus(error: ErrorRecord, nested: ErrorRecord | null): number | null {
  const values = [error.status, error.statusCode, nested?.code, nested?.statusCode];
  for (const value of values) {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 400 && value <= 599) {
      return value;
    }
  }
  return null;
}

function providerErrorCode(
  error: ErrorRecord,
  nested: ErrorRecord | null,
  privilegedValues: readonly string[],
): string | null {
  return safeProviderErrorCode(
    nested?.status
      ?? nested?.reason
      ?? error.providerErrorCode
      ?? error.code,
    privilegedValues,
  );
}

function providerRequestId(
  error: ErrorRecord,
  nested: ErrorRecord | null,
  privilegedValues: readonly string[],
): string | null {
  return safeProviderRequestId(
    error.providerRequestId
      ?? error.requestId
      ?? error.responseId
      ?? nested?.providerRequestId
      ?? nested?.requestId
      ?? nested?.responseId,
    privilegedValues,
  );
}

function categorizeFailure(
  classification: ReturnType<typeof classifyGeminiFailure>,
  status: number | null,
  code: string | null,
  errorName: unknown,
): GeminiProviderErrorCategory {
  if (classification === 'timeout' || status === 408 || status === 504
    || code === 'DEADLINE_EXCEEDED') return 'timeout';
  if (classification === 'rate_limited' || status === 429 || code === 'RESOURCE_EXHAUSTED') {
    return 'rate_limited_or_quota';
  }
  if (status === 401 || status === 403 || code === 'UNAUTHENTICATED'
    || code === 'PERMISSION_DENIED') return 'authentication_or_key_restriction';
  if (status === 404 || code === 'NOT_FOUND') return 'model_or_endpoint_unavailable';
  if (status === 400 || code === 'INVALID_ARGUMENT' || code === 'FAILED_PRECONDITION') {
    return 'malformed_request';
  }
  if (status !== null && status >= 400 && status < 500) return 'provider_4xx';
  if (status !== null && status >= 500) return 'provider_5xx';
  if (errorName === 'FetchError' || errorName === 'NetworkError'
    || errorName === 'APIConnectionError') return 'network';
  return 'provider_error';
}

function safeFailureMessage(category: GeminiProviderErrorCategory): string {
  switch (category) {
    case 'timeout': return 'provider request timed out';
    case 'rate_limited_or_quota': return 'provider rate limit or quota response';
    case 'authentication_or_key_restriction': return 'provider rejected authentication or key policy';
    case 'model_or_endpoint_unavailable': return 'provider model or endpoint was unavailable';
    case 'malformed_request': return 'provider rejected the request shape';
    case 'provider_4xx': return 'provider rejected the request';
    case 'provider_5xx': return 'provider server error';
    case 'network': return 'provider request failed before a response';
    case 'provider_error': return 'unclassified provider failure';
  }
}

export function sanitizeGeminiFailure(
  error: unknown,
  classification: ReturnType<typeof classifyGeminiFailure> = classifyGeminiFailure(error),
  privilegedValues: readonly string[] = [],
): GeminiFailureEvidence {
  const record = asRecord(error) ?? {};
  const nested = asRecord(record.error);
  const status = numericHttpStatus(record, nested);
  const code = providerErrorCode(record, nested, privilegedValues);
  const category = categorizeFailure(classification, status, code, record.name);
  return {
    httpStatus: status,
    providerErrorCode: code,
    providerErrorCategory: category,
    providerRequestId: providerRequestId(record, nested, privilegedValues),
    safeMessage: safeFailureMessage(category),
  };
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
