import { z } from 'zod';

export const STORE_VIEW_CONTRACT_VERSION = 'phase9-store-view-read-v1' as const;

export const STORE_VIEW_FILTERS = [
  'all', 'private', 'live', 'paused', 'needs_attention', 'out_of_stock',
] as const;

const uuid = z.string().uuid();
const count = z.number().int().nonnegative().safe();
const version = z.number().int().positive().safe();
const nullableText = z.string().max(10_000).nullable();
const condition = z.enum(['new', 'like_new', 'very_good', 'good', 'acceptable']);
const publicationState = z.enum([
  'private', 'publication_pending', 'published', 'publication_failed',
]);
const effectiveState = z.enum([
  'private', 'live', 'paused', 'needs_attention', 'publication_failed', 'out_of_stock',
]);
const visibilityStatus = z.enum([
  'draft', 'needs_review', 'published', 'paused', 'out_of_stock', 'blocked',
]);
const attentionReason = z.enum([
  'missing_metadata', 'missing_price', 'missing_condition', 'damage_evidence_required',
  'not_sellable', 'moderation_blocked', 'store_policy_blocked',
  'subscription_restricted', 'entitlement_blocked',
  'active_listing_limit_reached', 'publication_failed',
]);
const capability = z.enum([
  'edit_details', 'adjust_stock', 'manage_photos', 'publish', 'pause',
  'republish', 'make_private', 'retry_publication',
]);

const rawPublicState = z.object({
  listingId: uuid,
  storeId: uuid,
  title: z.string().min(1).max(512),
  authors: z.array(z.string().min(1).max(256)).max(20),
  language: z.string().min(1).max(35).nullable(),
  description: nullableText,
  editionStatement: nullableText,
  volume: nullableText,
  format: nullableText,
  isbn10: nullableText,
  isbn13: nullableText,
  condition,
  hasDamage: z.boolean(),
  publicDamageNote: nullableText,
  damageTypes: z.array(z.string().min(1).max(80)).max(20),
  priceMinor: count,
  currency: z.literal('INR'),
  availabilityStatus: z.enum(['available', 'low_stock', 'confirmation_required', 'unavailable']),
  coverUrl: z.string().min(1).max(2048).nullable(),
  publicMediaCount: count,
  fulfillmentOptions: z.array(z.string().min(1).max(80)).max(20),
  status: z.enum(['active', 'paused', 'out_of_stock', 'blocked']),
  moderationStatus: z.enum(['approved', 'pending', 'blocked', 'prohibited']),
  qualityStatus: z.string().min(1).max(80),
  friendlyInventoryFreshnessSignal: z.enum([
    'recent', 'needs_confirmation', 'not_recently_verified',
  ]),
}).strict().transform((value) => ({
  listingId: value.listingId,
  coverUrl: value.coverUrl,
  availabilityStatus: value.availabilityStatus,
}));

const item = z.object({
  identity: z.object({ inventoryId: uuid }).strict(),
  presentation: z.object({
    title: z.string().min(1).max(512),
    authors: z.array(z.string().min(1).max(256)).max(20),
    language: z.string().min(1).max(35).nullable(),
    publicDescription: nullableText,
    condition,
    publicConditionNote: nullableText,
    hasDamage: z.boolean(),
    damageTypes: z.array(z.string().min(1).max(80)).max(20),
    damageNote: nullableText,
    isSellable: z.boolean(),
    sellingPriceMinor: count,
  }).strict(),
  stockSummary: z.object({
    quantityAvailable: count,
    stockState: z.enum(['available', 'low_stock', 'out_of_stock']),
  }).strict(),
  lifecycle: z.object({ publicationState, effectiveState, visibilityStatus }).strict(),
  attention: z.object({
    attentionState: z.enum(['none', 'action_required']),
    attentionReasons: z.array(attentionReason),
  }).strict(),
  capabilities: z.array(capability),
  versions: z.object({
    inventoryVersion: version,
    publicationIntentVersion: version,
  }).strict(),
  mediaSummary: z.object({ approvedCount: count }).strict(),
  publicState: rawPublicState.nullable(),
}).strict();

const detail = item.extend({
  privateOperations: z.object({
    shelfLocation: nullableText,
    internalNotes: nullableText,
  }).strict(),
  stock: z.object({
    quantityTotal: count,
    quantityAvailable: count,
    quantityReserved: count,
    quantitySold: count,
    quantityRemoved: count,
  }).strict(),
  historySummary: z.object({
    publicRevisionCount: count,
    latestPublicRevision: z.object({
      revisionNumber: version,
      sourceAction: z.enum([
        'initial_publish', 'republish', 'retry', 'save_details',
        'stock_adjustment', 'media_change',
      ]),
      createdAt: z.string().datetime({ offset: true }),
    }).strict().nullable(),
  }).strict(),
}).strict();

const requestSchemas = {
  read_store_view_page: z.object({
    action: z.literal('read_store_view_page'),
    contractVersion: z.literal(STORE_VIEW_CONTRACT_VERSION),
    pageSize: z.number().int().min(1).max(50).safe().optional(),
    cursor: z.string().min(1).max(512).nullable().optional(),
    filter: z.enum(STORE_VIEW_FILTERS).optional(),
  }).strict(),
  read_store_view_detail: z.object({
    action: z.literal('read_store_view_detail'),
    contractVersion: z.literal(STORE_VIEW_CONTRACT_VERSION),
    inventoryId: uuid,
  }).strict(),
} as const;

const responseSchemas = {
  read_store_view_page: z.object({
    items: z.array(item),
    pageInfo: z.object({
      hasNextPage: z.boolean(),
      nextCursor: z.string().min(1).nullable(),
    }).strict(),
  }).strict().superRefine((value, context) => {
    if (value.pageInfo.hasNextPage !== (value.pageInfo.nextCursor !== null)) {
      context.addIssue({ code: 'custom', message: 'invalid Store View page info' });
    }
  }),
  read_store_view_detail: detail,
} as const;

export type StoreViewAction = keyof typeof requestSchemas;
export type StoreViewRequest = z.infer<(typeof requestSchemas)[StoreViewAction]>;

export function isStoreViewAction(value: unknown): value is StoreViewAction {
  return value === 'read_store_view_page' || value === 'read_store_view_detail';
}

export function parseStoreViewRequest(value: unknown): StoreViewRequest {
  const action = value && typeof value === 'object'
    ? (value as { action?: unknown }).action
    : undefined;
  const schema = isStoreViewAction(action) ? requestSchemas[action] : undefined;
  const result = schema?.safeParse(value);
  if (!result?.success) {
    const unknown = result?.error.issues.some((issue) => issue.code === 'unrecognized_keys');
    throw new Error(unknown ? 'unknown keys in Store View request' : 'invalid Store View request');
  }
  return result.data as StoreViewRequest;
}

export function parseStoreViewRpcResponse<Action extends StoreViewAction>(
  action: Action,
  value: unknown,
) {
  const result = responseSchemas[action].safeParse(value);
  if (!result.success) throw new Error('invalid Store View response');
  return { contractVersion: STORE_VIEW_CONTRACT_VERSION, data: result.data };
}
