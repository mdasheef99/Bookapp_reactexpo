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

export const storeViewHistoryRevisionSchema = z.object({
    revisionNumber: version,
    sourceAction: z.enum([
        'initial_publish', 'republish', 'retry', 'save_details',
        'stock_adjustment', 'media_change',
    ]),
    createdAt,
    listingId: uuid.nullable(),
    publicSnapshot: z.record(z.string(), z.unknown()),
}).strict();

export const storeViewHistoryActivitySchema = z.union([
    z.object({
        kind: z.literal('audit'),
        action: z.string().min(1).max(200),
        createdAt,
        details: safeActivityDetails,
    }).strict(),
    z.object({
        kind: z.literal('event'),
        eventType: z.string().min(1).max(200),
        source: z.string().min(1).max(64),
        severity: z.string().min(1).max(32),
        createdAt,
        payload: safeActivityDetails,
    }).strict(),
    z.object({
        kind: z.literal('publication_retry'),
        status: z.enum([
            'open', 'in_progress', 'retry_scheduled', 'resolved', 'resolved_noop',
            'cancelled', 'dead_letter',
        ]),
        attemptCount: z.number().int().min(0).max(5),
        maxAttempts: z.number().int().min(1).max(5),
        safeErrorCode: z.string().min(1).max(128).nullable(),
        createdAt,
        updatedAt: createdAt,
        completedAt: createdAt.nullable(),
    }).strict(),
]);

const readResponse = z.object({
    inventoryId: uuid,
    activity: z.array(storeViewHistoryActivitySchema).max(50),
    publicRevisions: z.array(storeViewHistoryRevisionSchema).max(25),
}).strict();

export type StoreViewHistory = z.infer<typeof readResponse>;
export type StoreViewHistoryActivity = z.infer<typeof storeViewHistoryActivitySchema>;
export type StoreViewHistoryRevision = z.infer<typeof storeViewHistoryRevisionSchema>;

export class StoreViewHistoryResponseContractError extends Error {
    constructor() {
        super('The Store View history response could not be validated.');
        this.name = 'StoreViewHistoryResponseContractError';
    }
}

export function decodeStoreViewHistoryResponse(value: unknown): StoreViewHistory {
    const result = z.object({
        contractVersion: z.literal(STORE_VIEW_HISTORY_CONTRACT_VERSION),
        data: readResponse,
    }).strict().safeParse(value);
    if (!result.success) throw new StoreViewHistoryResponseContractError();
    return (result.data as unknown as { data: StoreViewHistory }).data;
}
