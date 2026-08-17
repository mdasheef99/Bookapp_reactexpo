import { z } from 'zod';

export const STORE_VIEW_MEDIA_CONTRACT_VERSION = 'phase9-store-view-media-v1' as const;

const uuid = z.string().uuid();
const version = z.number().int().positive().safe();
const idempotencyKey = z.string().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/u);
const mediaRole = z.enum(['damage', 'actual_copy', 'primary_fallback']);
const publicOrder = z.number().int().min(1).max(3);

export const storeViewMediaRecordSchema = z.object({
  linkId: uuid,
  mediaAssetId: uuid,
  role: mediaRole,
  publicOrder,
  approvalStatus: z.literal('approved'),
  approvedAt: z.string().datetime({ offset: true }),
  url: z.string().min(1).max(2048),
  width: z.number().int().positive().max(8192),
  height: z.number().int().positive().max(8192),
}).strict();

export const storeViewPendingReplacementSchema = z.object({
  capabilityId: uuid,
  role: mediaRole,
  order: publicOrder,
  state: z.enum(['upload_pending', 'processing', 'failed', 'approved']),
  operationKind: z.enum(['add', 'replace']),
  targetLinkId: uuid.nullable(),
  sourceMediaAssetId: uuid.nullable(),
  mediaAssetId: uuid.nullable(),
  safeErrorCode: z.string().min(1).max(128).nullable(),
}).strict().superRefine((value, context) => {
  if (value.operationKind === 'replace' && !value.targetLinkId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['targetLinkId'], message: 'replace requires targetLinkId' });
  }
  if (value.operationKind === 'add' && value.targetLinkId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['targetLinkId'], message: 'add cannot target a link' });
  }
});

const readRequest = z.object({
  action: z.literal('read_store_view_media'),
  contractVersion: z.literal(STORE_VIEW_MEDIA_CONTRACT_VERSION),
  inventoryId: uuid,
}).strict();

const reorderRequest = z.object({
  action: z.literal('reorder_store_view_media'),
  contractVersion: z.literal(STORE_VIEW_MEDIA_CONTRACT_VERSION),
  inventoryId: uuid,
  expectedInventoryVersion: version,
  orderedLinkIds: z.array(uuid).min(1).max(3),
  idempotencyKey,
  commandId: uuid,
}).strict();

const removeRequest = z.object({
  action: z.literal('remove_store_view_media'),
  contractVersion: z.literal(STORE_VIEW_MEDIA_CONTRACT_VERSION),
  inventoryId: uuid,
  expectedInventoryVersion: version,
  linkId: uuid,
  idempotencyKey,
  commandId: uuid,
}).strict();

const replaceRequest = z.object({
  action: z.literal('replace_store_view_media'),
  contractVersion: z.literal(STORE_VIEW_MEDIA_CONTRACT_VERSION),
  inventoryId: uuid,
  expectedInventoryVersion: version,
  capabilityId: uuid,
  mediaAssetId: uuid,
  targetLinkId: uuid,
  idempotencyKey,
  commandId: uuid,
}).strict();

const baseResult = z.object({
  inventoryId: uuid,
  inventoryVersion: version,
  publicationIntentVersion: version,
  publicRevisionNumber: version.nullable(),
}).strict();

const responseSchemas = {
  read_store_view_media: z.object({
    inventoryId: uuid,
    media: z.array(storeViewMediaRecordSchema),
    pendingReplacements: z.array(storeViewPendingReplacementSchema),
  }).strict(),
  reorder_store_view_media: baseResult.extend({
    mediaLinkIds: z.array(uuid).min(1).max(3),
    outcome: z.literal('media_reordered'),
  }).strict(),
  remove_store_view_media: baseResult.extend({
    removedMediaAssetId: uuid,
    outcome: z.literal('media_removed'),
  }).strict(),
  replace_store_view_media: baseResult.extend({
    mediaLinkId: uuid,
    mediaAssetId: uuid,
    removedMediaAssetId: uuid,
    outcome: z.literal('media_replaced'),
  }).strict(),
} as const;

const requestSchemas = {
  read_store_view_media: readRequest,
  reorder_store_view_media: reorderRequest,
  remove_store_view_media: removeRequest,
  replace_store_view_media: replaceRequest,
} as const;

export type StoreViewMediaAction = keyof typeof requestSchemas;
export type StoreViewMediaRequest =
  | z.infer<typeof readRequest>
  | z.infer<typeof reorderRequest>
  | z.infer<typeof removeRequest>
  | z.infer<typeof replaceRequest>;

export function isStoreViewMediaAction(value: unknown): value is StoreViewMediaAction {
  return value === 'read_store_view_media' || value === 'reorder_store_view_media'
    || value === 'remove_store_view_media' || value === 'replace_store_view_media';
}

export function parseStoreViewMediaRequest(value: unknown): StoreViewMediaRequest {
  const action = value && typeof value === 'object'
    ? (value as { action?: unknown }).action
    : undefined;
  const schema = isStoreViewMediaAction(action) ? requestSchemas[action] : undefined;
  const result = schema?.safeParse(value);
  if (!result?.success) {
    const unknown = result?.error.issues.some((issue) => issue.code === 'unrecognized_keys');
    throw new Error(unknown ? 'unknown keys in Store View media request' : 'invalid Store View media request');
  }
  return result.data as StoreViewMediaRequest;
}

export function parseStoreViewMediaRpcResponse<Action extends StoreViewMediaAction>(
  action: Action,
  value: unknown,
) {
  const result = responseSchemas[action].safeParse(value);
  if (!result.success) throw new Error('invalid Store View media response');
  return { contractVersion: STORE_VIEW_MEDIA_CONTRACT_VERSION, data: result.data };
}
