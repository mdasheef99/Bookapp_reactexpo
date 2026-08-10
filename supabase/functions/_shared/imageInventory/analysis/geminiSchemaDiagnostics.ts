import { Phase9ContractError } from '../domain/validation';

export type GeminiSchemaFailureCategory =
  | 'unknown_keys'
  | 'type'
  | 'bounds'
  | 'format'
  | 'active_content'
  | 'coherence'
  | 'identity'
  | 'other';

export type GeminiSchemaDiagnostic = Readonly<{
  schemaField: string | null;
  schemaFailureCategory: GeminiSchemaFailureCategory;
}>;

const SAFE_FIELD_SEGMENTS = new Set([
  'gemini_response', 'vision', 'vision_result', 'observations', 'observations[]',
  'ordinal', 'title_guess', 'author_guesses', 'publisher_clue', 'isbn_clue',
  'detected_language', 'confidence', 'geometry', 'warning_codes',
  'image_outcome', 'detected_visible_book_count', 'contract_version',
  'schema_version', 'pipeline_version', 'prompt_version', 'adapter_key',
  'adapter_version', 'job_reference', 'attempt_number', 'correlation_id',
  'expected_language', 'provider_key', 'model_key', 'model_version',
  'received_at',
]);

function safeSchemaField(field: unknown): string | null {
  if (typeof field !== 'string' || field.length < 1 || field.length > 160) {
    return null;
  }
  const normalized = field.replace(/\[\d{1,3}\]/gu, '[]');
  return normalized.split('.').every((segment) => SAFE_FIELD_SEGMENTS.has(segment))
    ? normalized
    : null;
}

function category(reason: string): GeminiSchemaFailureCategory {
  if (reason.startsWith('unknown keys:')) return 'unknown_keys';
  if (/must be (?:an object|an array|a string)/u.test(reason)) return 'type';
  if (/at most|exceeds|safe integer|finite number|from \d/u.test(reason)) return 'bounds';
  if (/active or operational|control or bidi/u.test(reason)) return 'active_content';
  if (/incoherent|unique and ordered|must match|align one-to-one/u.test(reason)) {
    return 'coherence';
  }
  if (/identity|contract version|contract configuration/u.test(reason)) return 'identity';
  if (/format|BCP 47|unsupported|non-ISBN|pattern/u.test(reason)) return 'format';
  return 'other';
}

export function sanitizeGeminiSchemaFailure(error: unknown): GeminiSchemaDiagnostic {
  if (!(error instanceof Phase9ContractError)) {
    return { schemaField: null, schemaFailureCategory: 'other' };
  }
  return {
    schemaField: safeSchemaField(error.field),
    schemaFailureCategory: category(error.reason),
  };
}
