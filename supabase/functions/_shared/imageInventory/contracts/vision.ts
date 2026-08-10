import {
  asRecord,
  assertKnownKeys,
  boundedInteger,
  boundedNumber,
  canonicalBcp47,
  optionalString,
  Phase9ContractError,
  requiredIsoTimestamp,
  requiredString,
  utf8ByteLength,
} from '../domain/validation';
import {
  PHASE9_CONTRACT_VERSION,
  PHASE9_MAX_CANDIDATES,
  PHASE9_VISION_SCHEMA_VERSION,
} from './versions';
import { PHASE9_LIMITS } from './registers';

export const VISION_IMAGE_OUTCOMES = [
  'analyzed', 'no_books', 'too_many_books', 'quality_rejected',
] as const;
export const VISION_OUTCOMES = VISION_IMAGE_OUTCOMES;
export const VISION_WARNING_CODES = [
  'low_contrast', 'low_confidence', 'partial_title', 'partial_author',
  'partial_isbn', 'partial_publisher', 'partial_occlusion', 'glare',
  'perspective_distortion',
] as const;

export type VisionImageOutcome = typeof VISION_IMAGE_OUTCOMES[number];
export type VisionWarningCode = typeof VISION_WARNING_CODES[number];
export type VisionGeometry = Readonly<{
  x: number; y: number; width: number; height: number; rotation: number;
}>;
export type SpineObservation = Readonly<{
  ordinal: number;
  titleGuess: string | null;
  authorGuesses: readonly string[];
  publisherClue: string | null;
  isbnClue: string | null;
  detectedLanguage: string;
  confidence: number;
  geometry: VisionGeometry | null;
  warningCodes: readonly VisionWarningCode[];
}>;
export type SpineAnalysisRequest = Readonly<{
  contractVersion: typeof PHASE9_CONTRACT_VERSION;
  schemaVersion: typeof PHASE9_VISION_SCHEMA_VERSION;
  pipelineVersion: string;
  promptVersion: string;
  adapterKey: string;
  adapterVersion: string;
  jobReference: string;
  attemptNumber: number;
  correlationId: string;
  requestedAt: string;
  expectedLanguage: string;
  maxVisibleBooks: typeof PHASE9_MAX_CANDIDATES;
  sanitizedMediaReference: string;
}>;
export type SpineAnalysisResult = Readonly<{
  contractVersion: typeof PHASE9_CONTRACT_VERSION;
  schemaVersion: typeof PHASE9_VISION_SCHEMA_VERSION;
  pipelineVersion: string;
  promptVersion: string;
  adapterKey: string;
  adapterVersion: string;
  jobReference: string;
  attemptNumber: number;
  correlationId: string;
  expectedLanguage: string;
  providerKey: string;
  modelKey: string;
  modelVersion: string;
  receivedAt: string;
  imageOutcome: VisionImageOutcome;
  detectedVisibleBookCount: number | null;
  observations: readonly SpineObservation[];
  warningCodes: readonly VisionWarningCode[];
}>;
export interface SpineImageAnalyzer {
  analyze(request: SpineAnalysisRequest): Promise<SpineAnalysisResult>;
}

const IDENTIFIER = /^[a-z][a-z0-9._-]{1,63}$/u;
const VERSION_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const OPAQUE_REFERENCE = /^[A-Za-z0-9._:-]{16,128}$/u;
const REQUEST_KEYS = [
  'contract_version', 'schema_version', 'pipeline_version', 'prompt_version',
  'adapter_key', 'adapter_version', 'job_reference', 'attempt_number',
  'correlation_id', 'requested_at', 'expected_language', 'max_visible_books',
  'sanitized_media_reference',
] as const;
const RESULT_KEYS = [
  'contract_version', 'schema_version', 'pipeline_version', 'prompt_version',
  'adapter_key', 'adapter_version', 'job_reference', 'attempt_number',
  'correlation_id', 'expected_language', 'provider_key', 'model_key',
  'model_version', 'received_at', 'image_outcome',
  'detected_visible_book_count', 'observations', 'warning_codes',
] as const;
const OBSERVATION_KEYS = [
  'ordinal', 'title_guess', 'author_guesses', 'publisher_clue', 'isbn_clue',
  'detected_language', 'confidence', 'geometry', 'warning_codes',
] as const;
const GEOMETRY_KEYS = ['x', 'y', 'width', 'height', 'rotation'] as const;

function timestamp(value: unknown, field: string): string {
  return requiredIsoTimestamp(value, field);
}

function identifier(value: unknown, field: string): string {
  return requiredString(value, field, 64, { activeContent: false, pattern: IDENTIFIER });
}

function versionIdentifier(value: unknown, field: string): string {
  return requiredString(value, field, 64, {
    activeContent: false,
    pattern: VERSION_IDENTIFIER,
  });
}

function warnings(value: unknown, field: string, max: number): VisionWarningCode[] {
  if (!Array.isArray(value) || value.length > max) {
    throw new Phase9ContractError(field, `must be an array with at most ${max} entries`);
  }
  const parsed = value.map((entry, index) => {
    if (typeof entry !== 'string' || !VISION_WARNING_CODES.includes(entry as VisionWarningCode)) {
      throw new Phase9ContractError(`${field}[${index}]`, 'unsupported warning code');
    }
    return entry as VisionWarningCode;
  });
  if (new Set(parsed).size !== parsed.length) {
    throw new Phase9ContractError(field, 'must not contain duplicate warning codes');
  }
  return parsed;
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length > PHASE9_LIMITS.authorCount) {
    throw new Phase9ContractError(field, `must be an array with at most ${PHASE9_LIMITS.authorCount} entries`);
  }
  return value.map((entry, index) => requiredString(
    entry, `${field}[${index}]`, PHASE9_LIMITS.authorChars,
  ));
}

function isbnClue(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  const clue = requiredString(value, field, PHASE9_LIMITS.isbnClueChars);
  if (!/^(?=.*\d)[\dXx\s-]+$/u.test(clue)) {
    throw new Phase9ContractError(field, 'contains non-ISBN clue characters');
  }
  return clue;
}

function language(value: unknown, field: string): string {
  if (value === 'und') return 'und';
  return canonicalBcp47(value, field);
}

function geometry(value: unknown, field: string): VisionGeometry | null {
  if (value === null || value === undefined) return null;
  const input = asRecord(value, field);
  assertKnownKeys(input, GEOMETRY_KEYS, field);
  const parsed = {
    x: boundedNumber(input.x, `${field}.x`, 0, 1),
    y: boundedNumber(input.y, `${field}.y`, 0, 1),
    width: boundedNumber(input.width, `${field}.width`, 0.001, 1),
    height: boundedNumber(input.height, `${field}.height`, 0.001, 1),
    rotation: boundedNumber(input.rotation, `${field}.rotation`, -180, 180),
  };
  if (parsed.x + parsed.width > 1.000001 || parsed.y + parsed.height > 1.000001) {
    throw new Phase9ContractError(field, 'geometry extends outside the normalized image');
  }
  return parsed;
}

function observation(value: unknown, index: number): SpineObservation {
  const field = `observations[${index}]`;
  const input = asRecord(value, field);
  assertKnownKeys(input, OBSERVATION_KEYS, field);
  return {
    ordinal: boundedInteger(input.ordinal, `${field}.ordinal`, 1, PHASE9_MAX_CANDIDATES),
    titleGuess: optionalString(input.title_guess, `${field}.title_guess`, PHASE9_LIMITS.titleChars),
    authorGuesses: stringArray(input.author_guesses, `${field}.author_guesses`),
    publisherClue: optionalString(input.publisher_clue, `${field}.publisher_clue`, 256),
    isbnClue: isbnClue(input.isbn_clue, `${field}.isbn_clue`),
    detectedLanguage: language(input.detected_language, `${field}.detected_language`),
    confidence: boundedNumber(input.confidence, `${field}.confidence`, 0, 1),
    geometry: geometry(input.geometry, `${field}.geometry`),
    warningCodes: warnings(input.warning_codes, `${field}.warning_codes`, 4),
  };
}

export function createSpineAnalysisRequest(
  value: Omit<SpineAnalysisRequest, 'contractVersion' | 'schemaVersion' | 'maxVisibleBooks'>,
): SpineAnalysisRequest {
  const snake = {
    contract_version: PHASE9_CONTRACT_VERSION,
    schema_version: PHASE9_VISION_SCHEMA_VERSION,
    pipeline_version: value.pipelineVersion,
    prompt_version: value.promptVersion,
    adapter_key: value.adapterKey,
    adapter_version: value.adapterVersion,
    job_reference: value.jobReference,
    attempt_number: value.attemptNumber,
    correlation_id: value.correlationId,
    requested_at: value.requestedAt,
    expected_language: value.expectedLanguage,
    max_visible_books: PHASE9_MAX_CANDIDATES,
    sanitized_media_reference: value.sanitizedMediaReference,
  };
  return parseSpineAnalysisRequest(snake);
}

export function parseSpineAnalysisRequest(value: unknown): SpineAnalysisRequest {
  const input = asRecord(value, 'vision_request');
  assertKnownKeys(input, REQUEST_KEYS, 'vision_request');
  if (input.contract_version !== PHASE9_CONTRACT_VERSION
    || input.schema_version !== PHASE9_VISION_SCHEMA_VERSION
    || input.max_visible_books !== PHASE9_MAX_CANDIDATES) {
    throw new Phase9ContractError('vision_request', 'unsupported contract configuration');
  }
  return {
    contractVersion: PHASE9_CONTRACT_VERSION,
    schemaVersion: PHASE9_VISION_SCHEMA_VERSION,
    pipelineVersion: versionIdentifier(input.pipeline_version, 'pipeline_version'),
    promptVersion: versionIdentifier(input.prompt_version, 'prompt_version'),
    adapterKey: identifier(input.adapter_key, 'adapter_key'),
    adapterVersion: versionIdentifier(input.adapter_version, 'adapter_version'),
    jobReference: requiredString(input.job_reference, 'job_reference', 128, { activeContent: false, pattern: OPAQUE_REFERENCE }),
    attemptNumber: boundedInteger(input.attempt_number, 'attempt_number', 1, 5),
    correlationId: requiredString(input.correlation_id, 'correlation_id', 128, { activeContent: false, pattern: OPAQUE_REFERENCE }),
    requestedAt: timestamp(input.requested_at, 'requested_at'),
    expectedLanguage: canonicalBcp47(input.expected_language, 'expected_language'),
    maxVisibleBooks: PHASE9_MAX_CANDIDATES,
    sanitizedMediaReference: requiredString(input.sanitized_media_reference, 'sanitized_media_reference', 128, {
      activeContent: false, pattern: /^media_[A-Za-z0-9_-]{16,120}$/u,
    }),
  };
}

export function parseSpineAnalysisResult(value: unknown): SpineAnalysisResult {
  if (utf8ByteLength(value) > PHASE9_LIMITS.rawPayloadBytes) {
    throw new Phase9ContractError('vision_result', `exceeds ${PHASE9_LIMITS.rawPayloadBytes} bytes`);
  }
  const input = asRecord(value, 'vision_result');
  assertKnownKeys(input, RESULT_KEYS, 'vision_result');
  if (input.contract_version !== PHASE9_CONTRACT_VERSION
    || input.schema_version !== PHASE9_VISION_SCHEMA_VERSION) {
    throw new Phase9ContractError('vision_result', 'unsupported contract version');
  }
  if (typeof input.image_outcome !== 'string'
    || !VISION_IMAGE_OUTCOMES.includes(input.image_outcome as VisionImageOutcome)) {
    throw new Phase9ContractError('image_outcome', 'unsupported image outcome');
  }
  if (!Array.isArray(input.observations) || input.observations.length > PHASE9_MAX_CANDIDATES) {
    throw new Phase9ContractError('observations', `must contain at most ${PHASE9_MAX_CANDIDATES} entries`);
  }
  const observations = input.observations.map(observation);
  if (observations.some((entry, index) => entry.ordinal !== index + 1)) {
    throw new Phase9ContractError('observations.ordinal', 'must be unique and ordered from 1');
  }
  const imageOutcome = input.image_outcome as VisionImageOutcome;
  const count = input.detected_visible_book_count === null
    ? null : boundedInteger(input.detected_visible_book_count, 'detected_visible_book_count', 0, 100);
  const coherent = (imageOutcome === 'no_books' && count === 0 && observations.length === 0)
    || (imageOutcome === 'too_many_books' && count !== null && count >= 16 && observations.length === 0)
    || (imageOutcome === 'analyzed' && count !== null && count >= 1
      && count <= PHASE9_MAX_CANDIDATES && observations.length === count)
    || (imageOutcome === 'quality_rejected' && (count === null || count <= PHASE9_MAX_CANDIDATES)
      && observations.length === 0);
  if (!coherent) throw new Phase9ContractError('observations', 'observation length and image outcome are incoherent');
  return {
    contractVersion: PHASE9_CONTRACT_VERSION,
    schemaVersion: PHASE9_VISION_SCHEMA_VERSION,
    pipelineVersion: versionIdentifier(input.pipeline_version, 'pipeline_version'),
    promptVersion: versionIdentifier(input.prompt_version, 'prompt_version'),
    adapterKey: identifier(input.adapter_key, 'adapter_key'),
    adapterVersion: versionIdentifier(input.adapter_version, 'adapter_version'),
    jobReference: requiredString(input.job_reference, 'job_reference', 128, { activeContent: false, pattern: OPAQUE_REFERENCE }),
    attemptNumber: boundedInteger(input.attempt_number, 'attempt_number', 1, 5),
    correlationId: requiredString(input.correlation_id, 'correlation_id', 128, { activeContent: false, pattern: OPAQUE_REFERENCE }),
    expectedLanguage: canonicalBcp47(input.expected_language, 'expected_language'),
    providerKey: identifier(input.provider_key, 'provider_key'),
    modelKey: identifier(input.model_key, 'model_key'),
    modelVersion: versionIdentifier(input.model_version, 'model_version'),
    receivedAt: timestamp(input.received_at, 'received_at'),
    imageOutcome,
    detectedVisibleBookCount: count,
    observations,
    warningCodes: warnings(input.warning_codes, 'warning_codes', 8),
  };
}

export function assertSpineAnalysisIdentity(
  request: SpineAnalysisRequest,
  result: SpineAnalysisResult,
): void {
  const keys = [
    'contractVersion', 'schemaVersion', 'pipelineVersion', 'promptVersion',
    'adapterKey', 'adapterVersion', 'jobReference', 'attemptNumber',
    'correlationId', 'expectedLanguage',
  ] as const;
  if (keys.some((key) => request[key] !== result[key])) {
    throw new Phase9ContractError('vision_result', 'request identity echo mismatch');
  }
}

export function spineAnalysisResultSnapshot(result: SpineAnalysisResult) {
  return {
    contract_version: result.contractVersion,
    schema_version: result.schemaVersion,
    pipeline_version: result.pipelineVersion,
    prompt_version: result.promptVersion,
    adapter_key: result.adapterKey,
    adapter_version: result.adapterVersion,
    job_reference: result.jobReference,
    attempt_number: result.attemptNumber,
    correlation_id: result.correlationId,
    expected_language: result.expectedLanguage,
    provider_key: result.providerKey,
    model_key: result.modelKey,
    model_version: result.modelVersion,
    received_at: result.receivedAt,
    image_outcome: result.imageOutcome,
    detected_visible_book_count: result.detectedVisibleBookCount,
    observations: result.observations.map((entry) => ({
      ordinal: entry.ordinal,
      title_guess: entry.titleGuess,
      author_guesses: entry.authorGuesses,
      publisher_clue: entry.publisherClue,
      isbn_clue: entry.isbnClue,
      detected_language: entry.detectedLanguage,
      confidence: entry.confidence,
      geometry: entry.geometry,
      warning_codes: entry.warningCodes,
    })),
    warning_codes: result.warningCodes,
  };
}
