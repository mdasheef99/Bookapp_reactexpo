import { z } from 'zod';

export const STORE_VIEW_HISTORY_CONTRACT_VERSION = 'phase9-store-view-history-v1' as const;

const uuid = z.string().uuid();
const version = z.number().int().positive().safe();
const createdAt = z.string().datetime({ offset: true });
const mediaRole = z.enum(['damage', 'actual_copy', 'primary_fallback']);
const safeActivityFields = {
  commandId: uuid,
  inventoryVersion: version,
  publicationIntentVersion: version,
  outcome: z.string().min(1).max(128),
  changedFields: z.array(z.string().min(1).max(128)).max(32),
  delta: z.number().int().min(-1_000_000).max(1_000_000),
  mediaLinkIds: z.array(uuid).max(3),
  mediaAssetId: uuid,
  removedMediaAssetId: uuid,
  role: mediaRole,
};
const safeActivityDetails = z.object(safeActivityFields).partial().strict();
const jobStatus = z.enum([
  'open', 'in_progress', 'retry_scheduled', 'resolved', 'resolved_noop',
  'cancelled', 'dead_letter',
]);

const auditEntry = z.object({
  kind: z.literal('audit'),
  action: z.string().min(1).max(200),
  createdAt,
  details: safeActivityDetails,
}).strict();

const eventEntry = z.object({
  kind: z.literal('event'),
  eventType: z.string().min(1).max(200),
  source: z.string().min(1).max(64),
  severity: z.string().min(1).max(32),
  createdAt,
  payload: safeActivityDetails,
}).strict();

const retryEntry = z.object({
  kind: z.literal('publication_retry'),
  status: jobStatus,
  attemptCount: z.number().int().min(0).max(5),
  maxAttempts: z.number().int().min(1).max(5),
  safeErrorCode: z.string().min(1).max(128).nullable(),
  createdAt,
  updatedAt: createdAt,
  completedAt: createdAt.nullable(),
}).strict();

const revisionEntry = z.object({
  revisionNumber: version,
  sourceAction: z.enum([
    'initial_publish', 'republish', 'retry', 'save_details',
    'stock_adjustment', 'media_change',
  ]),
  createdAt,
  listingId: uuid.nullable(),
  publicSnapshot: z.record(z.string(), z.unknown()),
}).strict();

const readRequest = z.object({
  action: z.literal('read_store_view_history'),
  contractVersion: z.literal(STORE_VIEW_HISTORY_CONTRACT_VERSION),
  inventoryId: uuid,
}).strict();

const responseSchema = z.object({
  inventoryId: uuid,
  activity: z.array(z.union([auditEntry, eventEntry, retryEntry])).max(50),
  publicRevisions: z.array(revisionEntry).max(25),
}).strict();

export type StoreViewHistoryRequest = z.infer<typeof readRequest>;

export function parseStoreViewHistoryRequest(value: unknown): StoreViewHistoryRequest {
  const result = readRequest.safeParse(value);
  if (!result.success) {
    const unknown = result.error.issues.some((issue) => issue.code === 'unrecognized_keys');
    throw new Error(unknown ? 'unknown keys in Store View history request' : 'invalid Store View history request');
  }
  return result.data;
}

export function parseStoreViewHistoryRpcResponse(value: unknown) {
  const result = responseSchema.safeParse(value);
  if (!result.success) throw new Error('invalid Store View history response');
  return { contractVersion: STORE_VIEW_HISTORY_CONTRACT_VERSION, data: result.data };
}
