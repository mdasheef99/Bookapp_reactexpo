import { z } from 'zod';

export const PUBLICATION_CONTRACT_VERSION = 'phase9-publication-v1' as const;
const version = z.number().int().positive().safe();
const uuid = z.string().uuid();
const key = z.string().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/u);
const base = { contractVersion: z.literal(PUBLICATION_CONTRACT_VERSION) };

const schemas = {
  set_publication_state: z.object({
    ...base, action: z.literal('set_publication_state'), inventoryId: uuid,
    expectedInventoryVersion: version, expectedPublicationIntentVersion: version,
    intent: z.enum(['publish', 'pause', 'private']), idempotencyKey: key, commandId: uuid,
  }).strict(),
  retry_publication: z.object({
    ...base, action: z.literal('retry_publication'), inventoryId: uuid,
    expectedPublicationIntentVersion: version, idempotencyKey: key, commandId: uuid,
  }).strict(),
  authorize_public_copy: z.object({
    ...base, action: z.literal('authorize_public_copy'), inventoryId: uuid,
    role: z.enum(['damage', 'actual_copy', 'primary_fallback']),
    ordinal: z.number().int().min(1).max(3),
    declaredMime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    declaredBytes: z.number().int().positive().max(10_485_760),
    envelopeSha256: z.string().regex(/^[a-f0-9]{64}$/u),
    idempotencyKey: key, commandId: uuid,
    operationKind: z.enum(['add', 'replace']).optional(),
    targetLinkId: uuid.optional(),
  }).strict().superRefine((value, context) => {
    if (value.operationKind === 'replace' && !value.targetLinkId) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['targetLinkId'], message: 'replace requires targetLinkId' });
    }
    if (value.operationKind === 'add' && value.targetLinkId) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['targetLinkId'], message: 'add cannot target a link' });
    }
    if (!value.operationKind && value.targetLinkId) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['operationKind'], message: 'targetLinkId requires operationKind' });
    }
  }),
  complete_public_copy_upload: z.object({
    ...base, action: z.literal('complete_public_copy_upload'),
    capabilityId: uuid, idempotencyKey: key, commandId: uuid,
  }).strict(),
  read_public_copy_status: z.object({
    ...base, action: z.literal('read_public_copy_status'), mediaAssetId: uuid,
  }).strict(),
  submit_public_copy_media: z.object({
    ...base, action: z.literal('submit_public_copy_media'), inventoryId: uuid,
    capabilityId: uuid, mediaAssetId: uuid,
    role: z.enum(['damage', 'actual_copy', 'primary_fallback']),
    publicOrder: z.number().int().min(1).max(3),
    idempotencyKey: key, commandId: uuid,
  }).strict(),
  read_publication_status: z.object({
    ...base, action: z.literal('read_publication_status'), inventoryId: uuid,
  }).strict(),
} as const;

export type PublicationAction = keyof typeof schemas;
export type PublicationRequest = z.infer<(typeof schemas)[PublicationAction]>;

export function isPublicationAction(value: unknown): value is PublicationAction {
  return typeof value === 'string' && value in schemas;
}

export function parsePublicationRequest(value: unknown): PublicationRequest {
  const action = value && typeof value === 'object'
    ? (value as { action?: unknown }).action : undefined;
  const schema = isPublicationAction(action) ? schemas[action] : undefined;
  const result = schema?.safeParse(value);
  if (!result?.success) {
    const unknown = result?.error.issues.some((issue) => issue.code === 'unrecognized_keys');
    throw new Error(unknown ? 'unknown keys in publication request' : 'invalid publication request');
  }
  return result.data as PublicationRequest;
}

const resultSchema = z.object({
  inventoryId: uuid, inventoryVersion: version, publicationIntentVersion: version,
  publicationStatus: z.enum(['private', 'publication_pending', 'published', 'publication_failed']),
  visibilityStatus: z.enum(['draft', 'published', 'paused', 'blocked', 'needs_review', 'out_of_stock']),
  publicationRetryable: z.boolean(), publicationFailureReason: z.enum([
    'projection_temporarily_unavailable', 'price', 'stock', 'sellability',
    'condition', 'metadata', 'damage_media', 'store_policy',
  ]).nullable(),
  outcome: z.enum([
    'published', 'pause', 'paused', 'private', 'committed_publication_failed',
    'owner_correction_required',
  ]), listingId: uuid.nullable(),
}).strict();

const responses = {
  set_publication_state: resultSchema,
  retry_publication: resultSchema,
  read_publication_status: resultSchema,
  authorize_public_copy: z.object({
    capabilityId: uuid, signedUploadUrl: z.string().url(), uploadToken: z.string().min(1),
    expiresAt: z.string().datetime({ offset: true }),
  }).strict(),
  complete_public_copy_upload: z.object({
    mediaAssetId: uuid,
    state: z.enum(['processing', 'approved']),
  }).strict(),
  read_public_copy_status: z.object({
    mediaAssetId: uuid,
    state: z.enum(['processing', 'approved', 'failed']),
  }).strict(),
  submit_public_copy_media: z.object({ mediaLinkId: uuid }).strict(),
} as const;

export function parsePublicationResponse(action: PublicationAction, value: unknown): unknown {
  const parsed = z.object({
    contractVersion: z.literal(PUBLICATION_CONTRACT_VERSION), data: responses[action],
  }).strict().safeParse(value);
  if (!parsed.success) throw new Error('P9_RESPONSE_INVALID');
  return parsed.data;
}
