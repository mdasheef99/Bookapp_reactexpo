import {
  PHASE9_CONTRACT_VERSION,
  PHASE9_MARKETPLACE_QUERY_VERSION,
  PHASE9_MAX_AUTOMATED_ALIASES,
  PHASE9_MAX_CANDIDATES,
  PHASE9_RANKING_VERSION,
} from './versions';

export type VisibilityClass = 'public' | 'owner_private' | 'service_internal';
export type NormalizationRule = 'none' | 'trim_nfc' | 'bcp47' | 'isbn' | 'lowercase' | 'uuid';

export type ValidationRule = Readonly<{
  field: string;
  type: 'string' | 'string_array' | 'integer' | 'number' | 'object' | 'boolean';
  nullable: boolean;
  min?: number;
  max?: number;
  normalization: NormalizationRule;
  rejects: readonly string[];
  visibility: VisibilityClass;
  unknownKeys: 'reject' | 'not_applicable';
}>;

const textRejects = ['control characters', 'bidi override/isolate characters', 'HTML', 'Markdown links', 'SQL statements', 'scripts/commands', 'paths', 'operational URLs'];

export const PHASE9_LIMITS = {
  titleChars: 512,
  subtitleChars: 512,
  authorChars: 256,
  authorCount: 20,
  descriptionChars: 5000,
  isbnClueChars: 32,
  languageTagChars: 35,
  candidateCount: PHASE9_MAX_CANDIDATES,
  automatedAliasCount: PHASE9_MAX_AUTOMATED_ALIASES,
  retainedAliasCount: 25,
  aliasChars: 256,
  categoryChars: 128,
  categoryCount: 20,
  pageCount: 100000,
  damageNoteChars: 1000,
  quantity: 10000,
  moneyMinor: 2147483647,
  idempotencyKeyChars: 128,
  commandIdChars: 36,
  rawPayloadBytes: 262144,
  warningCount: 20,
  warningChars: 256,
  marketplacePageSize: 50,
  metadataCandidateCount: 10,
  coverReferenceChars: 512,
} as const;

export const PHASE9_VALIDATION_MATRIX = {
  title: { field: 'title', type: 'string', nullable: false, min: 1, max: PHASE9_LIMITS.titleChars, normalization: 'trim_nfc', rejects: textRejects, visibility: 'public', unknownKeys: 'not_applicable' },
  subtitle: { field: 'subtitle', type: 'string', nullable: true, min: 1, max: PHASE9_LIMITS.subtitleChars, normalization: 'trim_nfc', rejects: textRejects, visibility: 'public', unknownKeys: 'not_applicable' },
  author: { field: 'author', type: 'string', nullable: false, min: 1, max: PHASE9_LIMITS.authorChars, normalization: 'trim_nfc', rejects: textRejects, visibility: 'public', unknownKeys: 'not_applicable' },
  authors: { field: 'authors', type: 'string_array', nullable: false, min: 1, max: PHASE9_LIMITS.authorCount, normalization: 'trim_nfc', rejects: ['unknown keys', ...textRejects], visibility: 'public', unknownKeys: 'reject' },
  description: { field: 'description', type: 'string', nullable: true, min: 1, max: PHASE9_LIMITS.descriptionChars, normalization: 'trim_nfc', rejects: textRejects, visibility: 'public', unknownKeys: 'not_applicable' },
  isbn_clue: { field: 'isbn_clue', type: 'string', nullable: true, min: 10, max: PHASE9_LIMITS.isbnClueChars, normalization: 'isbn', rejects: ['non ISBN characters', ...textRejects], visibility: 'owner_private', unknownKeys: 'not_applicable' },
  language: { field: 'language', type: 'string', nullable: false, min: 2, max: PHASE9_LIMITS.languageTagChars, normalization: 'bcp47', rejects: ['malformed BCP 47 shape', ...textRejects], visibility: 'public', unknownKeys: 'not_applicable' },
  candidate_count: { field: 'candidate_count', type: 'integer', nullable: false, min: 0, max: PHASE9_LIMITS.candidateCount, normalization: 'none', rejects: ['unsafe integer', 'truncation'], visibility: 'service_internal', unknownKeys: 'not_applicable' },
  automated_aliases: { field: 'automated_aliases', type: 'string_array', nullable: false, min: 0, max: PHASE9_LIMITS.automatedAliasCount, normalization: 'trim_nfc', rejects: ['identity use', ...textRejects], visibility: 'owner_private', unknownKeys: 'reject' },
  retained_aliases: { field: 'retained_aliases', type: 'string_array', nullable: false, min: 0, max: PHASE9_LIMITS.retainedAliasCount, normalization: 'trim_nfc', rejects: ['missing provenance', 'identity use', ...textRejects], visibility: 'owner_private', unknownKeys: 'reject' },
  category: { field: 'category', type: 'string', nullable: false, min: 1, max: PHASE9_LIMITS.categoryChars, normalization: 'trim_nfc', rejects: textRejects, visibility: 'public', unknownKeys: 'not_applicable' },
  categories: { field: 'categories', type: 'string_array', nullable: true, min: 0, max: PHASE9_LIMITS.categoryCount, normalization: 'trim_nfc', rejects: textRejects, visibility: 'public', unknownKeys: 'reject' },
  page_count: { field: 'page_count', type: 'integer', nullable: true, min: 1, max: PHASE9_LIMITS.pageCount, normalization: 'none', rejects: ['unsafe integer', 'negative value'], visibility: 'public', unknownKeys: 'not_applicable' },
  geometry: { field: 'geometry', type: 'object', nullable: true, normalization: 'none', rejects: ['unknown keys', 'non-finite coordinates', 'coordinates outside 0..1'], visibility: 'service_internal', unknownKeys: 'reject' },
  damage_note: { field: 'damage_note', type: 'string', nullable: true, min: 1, max: PHASE9_LIMITS.damageNoteChars, normalization: 'trim_nfc', rejects: textRejects, visibility: 'public', unknownKeys: 'not_applicable' },
  quantity: { field: 'quantity', type: 'integer', nullable: false, min: 1, max: PHASE9_LIMITS.quantity, normalization: 'none', rejects: ['unsafe integer', 'zero', 'negative value'], visibility: 'owner_private', unknownKeys: 'not_applicable' },
  price_paise: { field: 'price_paise', type: 'integer', nullable: false, min: 0, max: PHASE9_LIMITS.moneyMinor, normalization: 'none', rejects: ['unsafe integer', 'negative value', 'floating point'], visibility: 'owner_private', unknownKeys: 'not_applicable' },
  idempotency_key: { field: 'idempotency_key', type: 'string', nullable: false, min: 16, max: PHASE9_LIMITS.idempotencyKeyChars, normalization: 'none', rejects: ['whitespace', 'path separators', ...textRejects], visibility: 'service_internal', unknownKeys: 'not_applicable' },
  command_id: { field: 'command_id', type: 'string', nullable: false, min: PHASE9_LIMITS.commandIdChars, max: PHASE9_LIMITS.commandIdChars, normalization: 'uuid', rejects: ['non UUID'], visibility: 'service_internal', unknownKeys: 'not_applicable' },
  raw_payload_bytes: { field: 'raw_payload_bytes', type: 'integer', nullable: false, min: 0, max: PHASE9_LIMITS.rawPayloadBytes, normalization: 'none', rejects: ['oversized payload', 'unsafe integer'], visibility: 'service_internal', unknownKeys: 'not_applicable' },
  cover_reference: { field: 'cover_reference', type: 'string', nullable: true, min: 1, max: PHASE9_LIMITS.coverReferenceChars, normalization: 'none', rejects: ['non-HTTPS URL', 'unapproved provider host', 'URL credentials'], visibility: 'public', unknownKeys: 'not_applicable' },
} as const satisfies Record<string, ValidationRule>;

export type Phase9ErrorCode =
  | 'P9_OWNER_NOT_AUTHORIZED'
  | 'P9_SESSION_NOT_ACTIVE'
  | 'P9_CANDIDATE_VERSION_CONFLICT'
  | 'P9_DUPLICATE_TARGET_CHANGED'
  | 'P9_MEDIA_NOT_APPROVED'
  | 'P9_MEDIA_SIGNATURE_INVALID'
  | 'P9_MEDIA_MIME_MISMATCH'
  | 'P9_MEDIA_TOO_LARGE'
  | 'P9_MEDIA_DECODE_FAILED'
  | 'P9_MEDIA_DIMENSIONS_EXCEEDED'
  | 'P9_MEDIA_PIXEL_LIMIT'
  | 'P9_MEDIA_MULTIFRAME_UNSUPPORTED'
  | 'P9_MEDIA_OBJECT_CHANGED'
  | 'P9_MEDIA_PROCESSING_RETRYABLE'
  | 'P9_QUANTITY_INVARIANT_FAILED'
  | 'P9_PUBLICATION_FAILED'
  | 'P9_AUTH_REQUIRED'
  | 'P9_REQUEST_INVALID'
  | 'P9_NOT_FOUND'
  | 'P9_STATE_CONFLICT'
  | 'P9_VERSION_CONFLICT'
  | 'P9_IDEMPOTENCY_MISMATCH'
  | 'P9_LIMIT_EXCEEDED'
  | 'P9_QUOTA_EXCEEDED'
  | 'P9_RATE_LIMITED'
  | 'P9_CURSOR_INVALID'
  | 'P9_SOFT_HOLD_REQUIRED'
  | 'P9_INSUFFICIENT_AVAILABLE_QUANTITY'
  | 'P9_POLICY_CONFIGURATION_INVALID'
  | 'P9_INTERNAL_ERROR';

export type ErrorDefinition = Readonly<{
  code: Phase9ErrorCode;
  httpStatus: number;
  retryable: boolean;
  safeOwnerMessage: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  survivingEffect: 'none' | 'private_inventory_committed';
  reuseIdempotencyKey: boolean;
}>;

export const PHASE9_ERROR_CATALOGUE: Record<Phase9ErrorCode, ErrorDefinition> = {
  P9_OWNER_NOT_AUTHORIZED: { code: 'P9_OWNER_NOT_AUTHORIZED', httpStatus: 403, retryable: false, safeOwnerMessage: 'You no longer have permission to manage this store.', severity: 'warning', survivingEffect: 'none', reuseIdempotencyKey: true },
  P9_SESSION_NOT_ACTIVE: { code: 'P9_SESSION_NOT_ACTIVE', httpStatus: 409, retryable: false, safeOwnerMessage: 'This inventory session is no longer active.', severity: 'info', survivingEffect: 'none', reuseIdempotencyKey: true },
  P9_CANDIDATE_VERSION_CONFLICT: { code: 'P9_CANDIDATE_VERSION_CONFLICT', httpStatus: 409, retryable: true, safeOwnerMessage: 'This book changed. Refresh it before trying again.', severity: 'info', survivingEffect: 'none', reuseIdempotencyKey: true },
  P9_DUPLICATE_TARGET_CHANGED: { code: 'P9_DUPLICATE_TARGET_CHANGED', httpStatus: 409, retryable: true, safeOwnerMessage: 'The matching inventory item changed. Review the duplicate options again.', severity: 'info', survivingEffect: 'none', reuseIdempotencyKey: true },
  P9_MEDIA_NOT_APPROVED: { code: 'P9_MEDIA_NOT_APPROVED', httpStatus: 422, retryable: false, safeOwnerMessage: 'Approve the required book photos before publishing.', severity: 'warning', survivingEffect: 'none', reuseIdempotencyKey: true },
  P9_MEDIA_SIGNATURE_INVALID: { code: 'P9_MEDIA_SIGNATURE_INVALID', httpStatus: 422, retryable: false, safeOwnerMessage: 'This image format could not be verified.', severity: 'warning', survivingEffect: 'none', reuseIdempotencyKey: true },
  P9_MEDIA_MIME_MISMATCH: { code: 'P9_MEDIA_MIME_MISMATCH', httpStatus: 422, retryable: false, safeOwnerMessage: 'This image does not match its declared format.', severity: 'warning', survivingEffect: 'none', reuseIdempotencyKey: true },
  P9_MEDIA_TOO_LARGE: { code: 'P9_MEDIA_TOO_LARGE', httpStatus: 422, retryable: false, safeOwnerMessage: 'This image exceeds the upload limit.', severity: 'info', survivingEffect: 'none', reuseIdempotencyKey: true },
  P9_MEDIA_DECODE_FAILED: { code: 'P9_MEDIA_DECODE_FAILED', httpStatus: 422, retryable: false, safeOwnerMessage: 'This image could not be decoded safely.', severity: 'warning', survivingEffect: 'none', reuseIdempotencyKey: true },
  P9_MEDIA_DIMENSIONS_EXCEEDED: { code: 'P9_MEDIA_DIMENSIONS_EXCEEDED', httpStatus: 422, retryable: false, safeOwnerMessage: 'This image is too wide or tall.', severity: 'info', survivingEffect: 'none', reuseIdempotencyKey: true },
  P9_MEDIA_PIXEL_LIMIT: { code: 'P9_MEDIA_PIXEL_LIMIT', httpStatus: 422, retryable: false, safeOwnerMessage: 'This image has too many pixels.', severity: 'info', survivingEffect: 'none', reuseIdempotencyKey: true },
  P9_MEDIA_MULTIFRAME_UNSUPPORTED: { code: 'P9_MEDIA_MULTIFRAME_UNSUPPORTED', httpStatus: 422, retryable: false, safeOwnerMessage: 'Animated or multi-frame images are not supported.', severity: 'info', survivingEffect: 'none', reuseIdempotencyKey: true },
  P9_MEDIA_OBJECT_CHANGED: { code: 'P9_MEDIA_OBJECT_CHANGED', httpStatus: 409, retryable: false, safeOwnerMessage: 'The uploaded image changed; request a new upload.', severity: 'warning', survivingEffect: 'none', reuseIdempotencyKey: false },
  P9_MEDIA_PROCESSING_RETRYABLE: { code: 'P9_MEDIA_PROCESSING_RETRYABLE', httpStatus: 503, retryable: true, safeOwnerMessage: 'Image validation will retry.', severity: 'warning', survivingEffect: 'none', reuseIdempotencyKey: true },
  P9_QUANTITY_INVARIANT_FAILED: { code: 'P9_QUANTITY_INVARIANT_FAILED', httpStatus: 409, retryable: false, safeOwnerMessage: 'The quantity could not be updated safely. Please contact support.', severity: 'critical', survivingEffect: 'none', reuseIdempotencyKey: true },
  P9_PUBLICATION_FAILED: { code: 'P9_PUBLICATION_FAILED', httpStatus: 202, retryable: true, safeOwnerMessage: 'The book was saved privately, but publishing is still pending.', severity: 'error', survivingEffect: 'private_inventory_committed', reuseIdempotencyKey: true },
  P9_AUTH_REQUIRED: { code: 'P9_AUTH_REQUIRED', httpStatus: 401, retryable: false, safeOwnerMessage: 'Sign in again before continuing.', severity: 'info', survivingEffect: 'none', reuseIdempotencyKey: true },
  P9_REQUEST_INVALID: { code: 'P9_REQUEST_INVALID', httpStatus: 400, retryable: false, safeOwnerMessage: 'Some submitted information is invalid.', severity: 'info', survivingEffect: 'none', reuseIdempotencyKey: true },
  P9_NOT_FOUND: { code: 'P9_NOT_FOUND', httpStatus: 404, retryable: false, safeOwnerMessage: 'The requested item is unavailable.', severity: 'info', survivingEffect: 'none', reuseIdempotencyKey: true },
  P9_STATE_CONFLICT: { code: 'P9_STATE_CONFLICT', httpStatus: 409, retryable: true, safeOwnerMessage: 'This item is no longer in the expected state. Refresh and try again.', severity: 'info', survivingEffect: 'none', reuseIdempotencyKey: true },
  P9_VERSION_CONFLICT: { code: 'P9_VERSION_CONFLICT', httpStatus: 409, retryable: true, safeOwnerMessage: 'This item changed. Refresh before trying again.', severity: 'info', survivingEffect: 'none', reuseIdempotencyKey: true },
  P9_IDEMPOTENCY_MISMATCH: { code: 'P9_IDEMPOTENCY_MISMATCH', httpStatus: 409, retryable: false, safeOwnerMessage: 'This retry does not match the original request.', severity: 'warning', survivingEffect: 'none', reuseIdempotencyKey: false },
  P9_LIMIT_EXCEEDED: { code: 'P9_LIMIT_EXCEEDED', httpStatus: 422, retryable: false, safeOwnerMessage: 'The submitted value exceeds the allowed limit.', severity: 'info', survivingEffect: 'none', reuseIdempotencyKey: true },
  P9_QUOTA_EXCEEDED: { code: 'P9_QUOTA_EXCEEDED', httpStatus: 429, retryable: false, safeOwnerMessage: 'The current extraction allowance has been reached. Manual entry remains available.', severity: 'info', survivingEffect: 'none', reuseIdempotencyKey: true },
  P9_RATE_LIMITED: { code: 'P9_RATE_LIMITED', httpStatus: 429, retryable: true, safeOwnerMessage: 'Too many requests were made. Try again shortly.', severity: 'info', survivingEffect: 'none', reuseIdempotencyKey: true },
  P9_CURSOR_INVALID: { code: 'P9_CURSOR_INVALID', httpStatus: 400, retryable: false, safeOwnerMessage: 'These results changed. Start again from the first page.', severity: 'info', survivingEffect: 'none', reuseIdempotencyKey: true },
  P9_SOFT_HOLD_REQUIRED: { code: 'P9_SOFT_HOLD_REQUIRED', httpStatus: 409, retryable: true, safeOwnerMessage: 'The confirmed item is no longer reserved. Refresh before continuing.', severity: 'info', survivingEffect: 'none', reuseIdempotencyKey: true },
  P9_INSUFFICIENT_AVAILABLE_QUANTITY: { code: 'P9_INSUFFICIENT_AVAILABLE_QUANTITY', httpStatus: 409, retryable: true, safeOwnerMessage: 'The requested quantity is no longer available.', severity: 'info', survivingEffect: 'none', reuseIdempotencyKey: true },
  P9_POLICY_CONFIGURATION_INVALID: { code: 'P9_POLICY_CONFIGURATION_INVALID', httpStatus: 500, retryable: false, safeOwnerMessage: 'This action is temporarily unavailable.', severity: 'critical', survivingEffect: 'none', reuseIdempotencyKey: true },
  P9_INTERNAL_ERROR: { code: 'P9_INTERNAL_ERROR', httpStatus: 500, retryable: true, safeOwnerMessage: 'Something went wrong. Try again using the same request.', severity: 'error', survivingEffect: 'none', reuseIdempotencyKey: true },
};

export const PHASE9_OPERATION_ERROR_CODES = {
  C01: ['P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_STATE_CONFLICT', 'P9_QUOTA_EXCEEDED'],
  C02: ['P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_STATE_CONFLICT', 'P9_MEDIA_NOT_APPROVED', 'P9_MEDIA_TOO_LARGE', 'P9_QUOTA_EXCEEDED'],
  C03: ['P9_MEDIA_NOT_APPROVED', 'P9_MEDIA_SIGNATURE_INVALID', 'P9_MEDIA_MIME_MISMATCH', 'P9_MEDIA_TOO_LARGE', 'P9_MEDIA_DECODE_FAILED', 'P9_MEDIA_DIMENSIONS_EXCEEDED', 'P9_MEDIA_PIXEL_LIMIT', 'P9_MEDIA_MULTIFRAME_UNSUPPORTED', 'P9_MEDIA_OBJECT_CHANGED', 'P9_STATE_CONFLICT', 'P9_IDEMPOTENCY_MISMATCH', 'P9_QUOTA_EXCEEDED'],
  C04: ['P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_STATE_CONFLICT', 'P9_VERSION_CONFLICT'],
  C05: ['P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_CANDIDATE_VERSION_CONFLICT', 'P9_REQUEST_INVALID'],
  C06: ['P9_STATE_CONFLICT', 'P9_LIMIT_EXCEEDED', 'P9_REQUEST_INVALID'],
  C07: ['P9_OWNER_NOT_AUTHORIZED', 'P9_STATE_CONFLICT', 'P9_CANDIDATE_VERSION_CONFLICT'],
  C08: ['P9_OWNER_NOT_AUTHORIZED', 'P9_STATE_CONFLICT', 'P9_CANDIDATE_VERSION_CONFLICT', 'P9_DUPLICATE_TARGET_CHANGED', 'P9_QUANTITY_INVARIANT_FAILED', 'P9_REQUEST_INVALID'],
  C09: ['P9_OWNER_NOT_AUTHORIZED', 'P9_CANDIDATE_VERSION_CONFLICT', 'P9_DUPLICATE_TARGET_CHANGED', 'P9_QUANTITY_INVARIANT_FAILED'],
  C10: ['P9_OWNER_NOT_AUTHORIZED', 'P9_VERSION_CONFLICT', 'P9_REQUEST_INVALID', 'P9_QUANTITY_INVARIANT_FAILED'],
  C11: ['P9_OWNER_NOT_AUTHORIZED', 'P9_MEDIA_NOT_APPROVED', 'P9_PUBLICATION_FAILED', 'P9_STATE_CONFLICT', 'P9_VERSION_CONFLICT'],
  C12: ['P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_STATE_CONFLICT', 'P9_VERSION_CONFLICT', 'P9_PUBLICATION_FAILED'],
  C13: ['P9_OWNER_NOT_AUTHORIZED', 'P9_STATE_CONFLICT', 'P9_CANDIDATE_VERSION_CONFLICT'],
  C14: ['P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_STATE_CONFLICT', 'P9_LIMIT_EXCEEDED'],
  C15: ['P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_STATE_CONFLICT', 'P9_MEDIA_NOT_APPROVED', 'P9_LIMIT_EXCEEDED'],
  C16: ['P9_OWNER_NOT_AUTHORIZED', 'P9_MEDIA_NOT_APPROVED', 'P9_STATE_CONFLICT', 'P9_VERSION_CONFLICT'],
  C17: ['P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_STATE_CONFLICT', 'P9_VERSION_CONFLICT', 'P9_SOFT_HOLD_REQUIRED'],
  C18: ['P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_STATE_CONFLICT', 'P9_VERSION_CONFLICT'],
  C19: ['P9_OWNER_NOT_AUTHORIZED', 'P9_STATE_CONFLICT', 'P9_VERSION_CONFLICT'],
  C20: ['P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_STATE_CONFLICT', 'P9_MEDIA_NOT_APPROVED', 'P9_LIMIT_EXCEEDED'],
  C21: ['P9_OWNER_NOT_AUTHORIZED', 'P9_MEDIA_NOT_APPROVED', 'P9_STATE_CONFLICT', 'P9_VERSION_CONFLICT'],
  C22: ['P9_OWNER_NOT_AUTHORIZED', 'P9_VERSION_CONFLICT', 'P9_REQUEST_INVALID'],
  C23: ['P9_OWNER_NOT_AUTHORIZED', 'P9_QUANTITY_INVARIANT_FAILED', 'P9_VERSION_CONFLICT'],
  C24: ['P9_OWNER_NOT_AUTHORIZED', 'P9_VERSION_CONFLICT', 'P9_REQUEST_INVALID'],
  C25: ['P9_OWNER_NOT_AUTHORIZED', 'P9_MEDIA_NOT_APPROVED', 'P9_REQUEST_INVALID', 'P9_VERSION_CONFLICT'],
  C26: ['P9_OWNER_NOT_AUTHORIZED', 'P9_MEDIA_NOT_APPROVED', 'P9_PUBLICATION_FAILED', 'P9_VERSION_CONFLICT'],
  C27: ['P9_AUTH_REQUIRED', 'P9_MEDIA_NOT_APPROVED', 'P9_STATE_CONFLICT', 'P9_VERSION_CONFLICT'],
  C28: ['P9_OWNER_NOT_AUTHORIZED', 'P9_STATE_CONFLICT', 'P9_VERSION_CONFLICT', 'P9_INSUFFICIENT_AVAILABLE_QUANTITY'],
  C29: ['P9_AUTH_REQUIRED', 'P9_STATE_CONFLICT', 'P9_VERSION_CONFLICT'],
  C30: ['P9_AUTH_REQUIRED', 'P9_STATE_CONFLICT', 'P9_VERSION_CONFLICT', 'P9_INSUFFICIENT_AVAILABLE_QUANTITY', 'P9_POLICY_CONFIGURATION_INVALID'],
  Q01: ['P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_NOT_FOUND'],
  Q02: ['P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_CURSOR_INVALID'],
  Q03: ['P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_CURSOR_INVALID'],
  Q04: ['P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_NOT_FOUND'],
  Q05: ['P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_NOT_FOUND'],
  Q06: ['P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_NOT_FOUND'],
  Q07: ['P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_REQUEST_INVALID'],
  Q08: ['P9_REQUEST_INVALID', 'P9_CURSOR_INVALID', 'P9_RATE_LIMITED'],
  Q09: ['P9_NOT_FOUND', 'P9_CURSOR_INVALID'],
  Q10: ['P9_NOT_FOUND'],
  Q11: ['P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_NOT_FOUND'],
} as const satisfies Record<string, readonly Phase9ErrorCode[]>;

export const PHASE9_PROVIDER_REUSE_FIELDS = [
  'title', 'subtitle', 'authors', 'description', 'isbn10', 'isbn13', 'publisher',
  'published_date', 'language', 'edition_statement', 'volume', 'format', 'page_count',
  'categories', 'cover_reference',
] as const;

export type ProviderFieldReuse = Readonly<{
  field: typeof PHASE9_PROVIDER_REUSE_FIELDS[number];
  matching: boolean;
  storage: boolean;
  publicDisplay: boolean;
  imageCache: boolean;
  attributionRequired: boolean;
  revalidateAfterSeconds: number | null;
}>;

export type GrantAccess = 'none' | 'select_safe_projection' | 'execute_command';
export const PHASE9_GRANT_MATRIX = [
  { resource: 'owner_safe_commands', anon: 'none', authenticated: 'execute_command', serviceRole: 'execute_command', rlsRequired: true },
  { resource: 'public_marketplace_projection', anon: 'select_safe_projection', authenticated: 'select_safe_projection', serviceRole: 'select_safe_projection', rlsRequired: true },
  { resource: 'sessions_inputs_candidates', anon: 'none', authenticated: 'none', serviceRole: 'execute_command', rlsRequired: true },
  { resource: 'provider_attempts_raw_payloads', anon: 'none', authenticated: 'none', serviceRole: 'execute_command', rlsRequired: true },
  { resource: 'jobs_usage_cost_lifecycle', anon: 'none', authenticated: 'none', serviceRole: 'execute_command', rlsRequired: true },
  { resource: 'private_security_helpers', anon: 'none', authenticated: 'none', serviceRole: 'execute_command', rlsRequired: false },
] as const satisfies ReadonlyArray<{ resource: string; anon: GrantAccess; authenticated: GrantAccess; serviceRole: GrantAccess; rlsRequired: boolean }>;

export const PHASE9_GRANT_CONTROLS = {
  tenantAuthority: 'server_derived_store_id',
  apiExposedTablesRequireRls: true,
  internalOperationalTablesServiceOnly: true,
  ambientAuthenticatedWrites: 'denied',
  defaultPublicPrivileges: 'revoked',
  defaultFunctionExecute: 'revoked',
  privilegedHelperSchema: 'private_non_public_where_practical',
  privilegedHelperClientExecute: 'denied',
  searchPath: 'pinned',
  references: 'schema_qualified',
  ownerCustomerReads: 'bounded_safe_commands_or_projections',
  crossStoreDenialTests: 'required',
} as const;

export const PHASE9_MARKETPLACE_QUERY_REGISTER = {
  contractVersion: PHASE9_CONTRACT_VERSION,
  queryVersion: PHASE9_MARKETPLACE_QUERY_VERSION,
  rankingVersion: PHASE9_RANKING_VERSION,
  resultIdentity: 'edition_or_reviewed_store_snapshot_match',
  groupIdentity: 'store_id',
  counts: ['bookstore_count', 'offer_count', 'title_count'],
  publicFields: ['store_id', 'public_store_name', 'public_locality', 'match_summary', 'availability_band', 'cover', 'price_from_paise', 'condition_summary', 'damage_disclosure'],
  forbiddenFields: ['exact_quantity', 'shelf_location', 'acquisition_cost', 'raw_payload', 'private_notes', 'scan_media', 'request_media', 'provider_credentials'],
  bookMatchRanking: ['exact_isbn', 'exact_original_title_author', 'exact_approved_alias', 'strong_original_relevance', 'bounded_fuzzy_relevance'],
  storeResultRanking: ['eligibility', 'availability', 'locality_distance', 'fulfillment_compatibility', 'freshness', 'price_condition_tiebreakers'],
  finalTieBreaker: 'store_id_ascending',
  paginationUnit: 'store_group',
  cursorProtection: 'server_authenticated_and_context_bound',
  aliasMatchBehavior: 'match_context_only_display_original_authoritative_text',
  storefrontBehavior: 'complete_active_public_catalogue_with_optional_pinned_match',
} as const;

export const PHASE9_FORBIDDEN_TELEMETRY_FIELDS = [
  'image', 'image_bytes', 'base64', 'raw_payload', 'raw_prompt', 'prompt', 'signed_url',
  'signedUrl', 'signedUploadUrl', 'signed_upload_url', 'authorization',
  'access_token', 'accessToken', 'refresh_token', 'refreshToken',
  'provider_secret', 'providerSecret', 'service_role_key', 'serviceRoleKey',
  'supabase_service_role_key', 'supabaseServiceRoleKey',
  'customer_phone', 'customer_address', 'shelf_location', 'object_path', 'objectPath',
  'storage_path', 'capability', 'capability_id', 'capabilityId', 'upload_token', 'uploadToken', 'exif', 'gps', 'raw_media',
] as const;

export const PHASE9_PERSISTED_TELEMETRY_DETAIL_ALLOWLIST = [
  'operation', 'outcome', 'safe_error_code', 'retryable', 'attempt_count',
  'duration_ms', 'input_bytes', 'output_bytes', 'width', 'height', 'detected_mime',
] as const;

export const PHASE9_PERSISTED_AUDIT_DETAIL_ALLOWLIST = [
  'operation', 'outcome', 'safe_error_code', 'entity_type', 'entity_id',
  'store_id', 'actor_id', 'command_id', 'idempotency_key',
] as const;

export const PHASE9_FORBIDDEN_ADAPTER_AUTHORITY_FIELDS = [
  'store_id', 'actor_id', 'user_id', 'workflow_state', 'retryable', 'fallback_allowed',
  'database_command', 'storage_path', 'signed_url', 'signedUrl', 'tools', 'tool_call',
  'credentials', 'authorization', 'idempotency_key', 'command_id',
] as const;
