import { z } from 'zod';

export const STORE_VIEW_MEDIA_CONTRACT_VERSION = 'phase9-store-view-media-v1' as const;

const uuid = z.string().uuid();
const version = z.number().int().positive().safe();
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

const readResponse = z.object({
    inventoryId: uuid,
    media: z.array(storeViewMediaRecordSchema),
    pendingReplacements: z.array(storeViewPendingReplacementSchema),
}).strict();

const baseResult = z.object({
    inventoryId: uuid,
    inventoryVersion: version,
    publicationIntentVersion: version,
    publicRevisionNumber: version.nullable(),
}).strict();

const responseSchemas = {
    read_store_view_media: readResponse,
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

export type StoreViewMedia = z.infer<typeof readResponse>;
export type StoreViewMediaRecord = z.infer<typeof storeViewMediaRecordSchema>;
export type StoreViewPendingReplacement = z.infer<typeof storeViewPendingReplacementSchema>;
export type StoreViewMediaResult<Action extends keyof typeof responseSchemas> =
    z.infer<(typeof responseSchemas)[Action]>;

export class StoreViewMediaResponseContractError extends Error {
    constructor() {
        super('The Store View media response could not be validated.');
        this.name = 'StoreViewMediaResponseContractError';
    }
}

export function decodeStoreViewMediaResponse<Action extends keyof typeof responseSchemas>(
    action: Action,
    value: unknown,
): StoreViewMediaResult<Action> {
    const result = z.object({
        contractVersion: z.literal(STORE_VIEW_MEDIA_CONTRACT_VERSION),
        data: responseSchemas[action],
    }).strict().safeParse(value);
    if (!result.success) throw new StoreViewMediaResponseContractError();
    return (result.data as unknown as { data: StoreViewMediaResult<Action> }).data;
}
