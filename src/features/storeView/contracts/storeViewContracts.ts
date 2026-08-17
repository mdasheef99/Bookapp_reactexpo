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

const itemSchema = z.object({
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
    lifecycle: z.object({
        publicationState: z.enum(['private', 'publication_pending', 'published', 'publication_failed']),
        effectiveState: z.enum([
            'private', 'live', 'paused', 'needs_attention', 'publication_failed', 'out_of_stock',
        ]),
        visibilityStatus: z.enum([
            'draft', 'needs_review', 'published', 'paused', 'out_of_stock', 'blocked',
        ]),
    }).strict(),
    attention: z.object({
        attentionState: z.enum(['none', 'action_required']),
        attentionReasons: z.array(attentionReason),
    }).strict(),
    capabilities: z.array(capability),
    versions: z.object({ inventoryVersion: version, publicationIntentVersion: version }).strict(),
    mediaSummary: z.object({ approvedCount: count }).strict(),
    publicState: z.object({
        listingId: uuid,
        coverUrl: z.string().min(1).max(2048).nullable(),
        availabilityStatus: z.enum(['available', 'low_stock', 'confirmation_required', 'unavailable']),
    }).strict().nullable(),
}).strict();

const detailSchema = itemSchema.extend({
    privateOperations: z.object({ shelfLocation: nullableText, internalNotes: nullableText }).strict(),
    stock: z.object({
        quantityTotal: count, quantityAvailable: count, quantityReserved: count,
        quantitySold: count, quantityRemoved: count,
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

const responseSchemas = {
    read_store_view_page: z.object({
        items: z.array(itemSchema),
        pageInfo: z.object({ hasNextPage: z.boolean(), nextCursor: z.string().min(1).nullable() }).strict(),
    }).strict().superRefine((value, context) => {
        if (value.pageInfo.hasNextPage !== (value.pageInfo.nextCursor !== null)) {
            context.addIssue({ code: 'custom', message: 'invalid Store View page info' });
        }
    }),
    read_store_view_detail: detailSchema,
} as const;

export type StoreViewFilter = typeof STORE_VIEW_FILTERS[number];
export type StoreViewAction = keyof typeof responseSchemas;
export type StoreViewItem = z.infer<typeof itemSchema>;
export type StoreViewDetail = z.infer<typeof detailSchema>;
export type StoreViewPage = z.infer<typeof responseSchemas.read_store_view_page>;

export class StoreViewResponseContractError extends Error {
    constructor() {
        super('The Store View response could not be validated.');
        this.name = 'StoreViewResponseContractError';
    }
}

export function decodeStoreViewResponse<Action extends StoreViewAction>(
    action: Action,
    value: unknown,
): z.infer<(typeof responseSchemas)[Action]> {
    const result = z.object({
        contractVersion: z.literal(STORE_VIEW_CONTRACT_VERSION),
        data: responseSchemas[action],
    }).strict().safeParse(value);
    if (!result.success) throw new StoreViewResponseContractError();
    return (result.data as unknown as {
        data: z.infer<(typeof responseSchemas)[Action]>;
    }).data;
}
