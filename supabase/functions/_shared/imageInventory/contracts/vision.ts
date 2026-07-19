import {
  asRecord,
  assertKnownKeys,
  boundedInteger,
  boundedNumber,
  canonicalBcp47,
  optionalString,
  Phase9ContractError,
  requiredString,
  utf8ByteLength,
} from '../domain/validation';
import {
  PHASE9_CONTRACT_VERSION,
  PHASE9_DEFAULT_SELECTED_LANGUAGE,
  PHASE9_MAX_CANDIDATES,
  PHASE9_MAX_VISION_FALLBACKS,
  PHASE9_VISION_SCHEMA_VERSION,
} from './versions';
import { PHASE9_LIMITS } from './registers';

export const VISION_OUTCOMES = [
  'accepted',
  'no_books',
  'wrong_language',
  'over_candidate_limit',
  'quality_rejected',
  'technical_failure',
  'schema_invalid',
  'broadly_unusable',
] as const;

export type VisionOutcome = typeof VISION_OUTCOMES[number];
export type VisionGeometry = Readonly<{ x: number; y: number; width: number; height: number; rotation: number }>;
export type VisionCandidate = Readonly<{
  ordinal: number;
  title: string | null;
  authors: readonly string[];
  visibleIsbnClue: string | null;
  language: string;
  confidence: number;
  geometry: VisionGeometry | null;
  warnings: readonly string[];
}>;

export type VisionResult = Readonly<{
  contractVersion: typeof PHASE9_CONTRACT_VERSION;
  schemaVersion: typeof PHASE9_VISION_SCHEMA_VERSION;
  adapterKey: string;
  adapterVersion: string;
  correlationId: string;
  attemptId: string;
  receivedAt: string;
  selectedLanguage: string;
  outcome: VisionOutcome;
  candidates: readonly VisionCandidate[];
  warnings: readonly string[];
}>;

export type VisionRequest = Readonly<{
  contractVersion: typeof PHASE9_CONTRACT_VERSION;
  schemaVersion: typeof PHASE9_VISION_SCHEMA_VERSION;
  adapterKey: string;
  adapterVersion: string;
  correlationId: string;
  attemptId: string;
  requestedAt: string;
  selectedLanguage: string;
  batchType: 'spine_stack';
  maxCandidates: typeof PHASE9_MAX_CANDIDATES;
  sanitizedMediaReference: string;
  taskVersion: string;
}>;

export function createVisionRequest(input: {
  adapterKey: string;
  adapterVersion: string;
  correlationId: string;
  attemptId: string;
  requestedAt: string;
  selectedLanguage?: string;
  sanitizedMediaReference: string;
  taskVersion: string;
}): VisionRequest {
  const requestedAt = requiredString(input.requestedAt, 'requested_at', 40, { activeContent: false });
  if (!Number.isFinite(Date.parse(requestedAt))) throw new Phase9ContractError('requested_at', 'must be an ISO timestamp');
  return {
    contractVersion: PHASE9_CONTRACT_VERSION,
    schemaVersion: PHASE9_VISION_SCHEMA_VERSION,
    adapterKey: requiredString(input.adapterKey, 'adapter_key', 64, { activeContent: false, pattern: /^[a-z][a-z0-9_-]{1,63}$/u }),
    adapterVersion: requiredString(input.adapterVersion, 'adapter_version', 64, { activeContent: false }),
    correlationId: requiredString(input.correlationId, 'correlation_id', 128, { activeContent: false }),
    attemptId: requiredString(input.attemptId, 'attempt_id', 128, { activeContent: false }),
    requestedAt,
    selectedLanguage: canonicalBcp47(input.selectedLanguage ?? PHASE9_DEFAULT_SELECTED_LANGUAGE),
    batchType: 'spine_stack',
    maxCandidates: PHASE9_MAX_CANDIDATES,
    sanitizedMediaReference: requiredString(input.sanitizedMediaReference, 'sanitized_media_reference', 128, { activeContent: false, pattern: /^media_[A-Za-z0-9_-]{16,120}$/u }),
    taskVersion: requiredString(input.taskVersion, 'task_version', 64, { activeContent: false }),
  };
}

const RESULT_KEYS = ['contract_version', 'schema_version', 'adapter_key', 'adapter_version', 'correlation_id', 'attempt_id', 'received_at', 'selected_language', 'outcome', 'candidates', 'warnings'] as const;
const CANDIDATE_KEYS = ['ordinal', 'title', 'authors', 'visible_isbn_clue', 'language', 'confidence', 'geometry', 'warnings'] as const;
const GEOMETRY_KEYS = ['x', 'y', 'width', 'height', 'rotation'] as const;

function parseStringArray(value: unknown, field: string, maxCount: number, maxLength: number): string[] {
  if (!Array.isArray(value) || value.length > maxCount) {
    throw new Phase9ContractError(field, `must be an array with at most ${maxCount} entries`);
  }
  return value.map((entry, index) => requiredString(entry, `${field}[${index}]`, maxLength));
}

function parseVisibleIsbnClue(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  const clue = requiredString(value, field, PHASE9_LIMITS.isbnClueChars, { activeContent: false });
  if (!/^(?=.*\d)[\dXx\s-]+$/u.test(clue)) {
    throw new Phase9ContractError(field, 'contains non-ISBN clue characters');
  }
  return clue;
}

function parseGeometry(value: unknown, field: string): VisionGeometry | null {
  if (value === null || value === undefined) return null;
  const input = asRecord(value, field);
  assertKnownKeys(input, GEOMETRY_KEYS, field);
  const x = boundedNumber(input.x, `${field}.x`, 0, 1);
  const y = boundedNumber(input.y, `${field}.y`, 0, 1);
  const width = boundedNumber(input.width, `${field}.width`, 0.001, 1);
  const height = boundedNumber(input.height, `${field}.height`, 0.001, 1);
  const rotation = boundedNumber(input.rotation, `${field}.rotation`, -180, 180);
  if (x + width > 1.000001 || y + height > 1.000001) {
    throw new Phase9ContractError(field, 'geometry extends outside the normalized image');
  }
  return { x, y, width, height, rotation };
}

function parseCandidate(value: unknown, index: number): VisionCandidate {
  const field = `candidates[${index}]`;
  const input = asRecord(value, field);
  assertKnownKeys(input, CANDIDATE_KEYS, field);
  const authors = parseStringArray(input.authors, `${field}.authors`, PHASE9_LIMITS.authorCount, PHASE9_LIMITS.authorChars);
  return {
    ordinal: boundedInteger(input.ordinal, `${field}.ordinal`, 1, PHASE9_MAX_CANDIDATES),
    title: optionalString(input.title, `${field}.title`, PHASE9_LIMITS.titleChars),
    authors,
    visibleIsbnClue: parseVisibleIsbnClue(input.visible_isbn_clue, `${field}.visible_isbn_clue`),
    language: canonicalBcp47(input.language, `${field}.language`),
    confidence: boundedNumber(input.confidence, `${field}.confidence`, 0, 1),
    geometry: parseGeometry(input.geometry, `${field}.geometry`),
    warnings: parseStringArray(input.warnings, `${field}.warnings`, PHASE9_LIMITS.warningCount, PHASE9_LIMITS.warningChars),
  };
}

export function parseVisionResult(value: unknown): VisionResult {
  if (utf8ByteLength(value) > PHASE9_LIMITS.rawPayloadBytes) throw new Phase9ContractError('vision_result', `exceeds ${PHASE9_LIMITS.rawPayloadBytes} bytes`);
  const input = asRecord(value, 'vision_result');
  assertKnownKeys(input, RESULT_KEYS, 'vision_result');
  if (input.contract_version !== PHASE9_CONTRACT_VERSION) throw new Phase9ContractError('contract_version', 'unsupported version');
  if (input.schema_version !== PHASE9_VISION_SCHEMA_VERSION) throw new Phase9ContractError('schema_version', 'unsupported version');
  if (typeof input.outcome !== 'string' || !VISION_OUTCOMES.includes(input.outcome as VisionOutcome)) {
    throw new Phase9ContractError('outcome', 'unsupported outcome');
  }
  if (!Array.isArray(input.candidates)) throw new Phase9ContractError('candidates', 'must be an array');
  if (input.candidates.length > PHASE9_MAX_CANDIDATES) {
    throw new Phase9ContractError('candidates', 'over candidate limit; reject the whole image without truncation');
  }
  const candidates = input.candidates.map(parseCandidate);
  const ordinals = candidates.map((candidate) => candidate.ordinal);
  if (new Set(ordinals).size !== ordinals.length || ordinals.some((ordinal, index) => ordinal !== index + 1)) {
    throw new Phase9ContractError('candidates.ordinal', 'must be unique and ordered from 1');
  }
  const outcome = input.outcome as VisionOutcome;
  if (outcome === 'accepted' && candidates.length === 0) {
    throw new Phase9ContractError('candidates', 'accepted outcome requires at least one candidate');
  }
  if (outcome !== 'accepted' && candidates.length > 0) {
    throw new Phase9ContractError('candidates', 'non-accepted outcomes cannot carry candidates');
  }
  const selectedLanguage = canonicalBcp47(input.selected_language, 'selected_language');
  if (outcome === 'accepted' && candidates.some((candidate) => candidate.language.split('-')[0] !== selectedLanguage.split('-')[0])) {
    throw new Phase9ContractError('candidates.language', 'candidate does not match the selected language batch');
  }
  const receivedAt = requiredString(input.received_at, 'received_at', 40, { activeContent: false });
  if (!Number.isFinite(Date.parse(receivedAt))) throw new Phase9ContractError('received_at', 'must be an ISO timestamp');
  return {
    contractVersion: PHASE9_CONTRACT_VERSION,
    schemaVersion: PHASE9_VISION_SCHEMA_VERSION,
    adapterKey: requiredString(input.adapter_key, 'adapter_key', 64, { activeContent: false, pattern: /^[a-z][a-z0-9_-]{1,63}$/u }),
    adapterVersion: requiredString(input.adapter_version, 'adapter_version', 64, { activeContent: false }),
    correlationId: requiredString(input.correlation_id, 'correlation_id', 128, { activeContent: false }),
    attemptId: requiredString(input.attempt_id, 'attempt_id', 128, { activeContent: false }),
    receivedAt,
    selectedLanguage,
    outcome,
    candidates,
    warnings: parseStringArray(input.warnings, 'warnings', PHASE9_LIMITS.warningCount, PHASE9_LIMITS.warningChars),
  };
}

export function shouldUseVisionFallback(outcome: VisionOutcome, fallbacksAlreadyUsed: number): boolean {
  if (fallbacksAlreadyUsed >= PHASE9_MAX_VISION_FALLBACKS) return false;
  return outcome === 'technical_failure' || outcome === 'schema_invalid' || outcome === 'broadly_unusable';
}
