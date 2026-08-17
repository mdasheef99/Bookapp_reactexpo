import { z } from 'zod';

export const STORE_VIEW_MANAGEMENT_CONTRACT_VERSION = 'phase9-store-view-management-v1' as const;

const uuid = z.string().uuid();
const version = z.number().int().positive().safe();
const nullableText = (max: number) => z.string().max(max).nullable();
const damageType = z.enum([
    'cover', 'binding', 'pages', 'water', 'staining', 'writing',
    'missing_parts', 'mould_or_contamination', 'other',
]);

export const storeViewChangesSchema = z.object({
    title: z.string().min(1).max(512),
    authors: z.array(z.string().min(1).max(256)).max(20),
    language: z.string().min(2).max(35),
    publicDescription: nullableText(5_000),
    sellingPriceMinor: z.number().int().nonnegative().max(2_147_483_647).safe(),
    condition: z.enum(['new', 'like_new', 'very_good', 'good', 'acceptable']),
    publicConditionNote: nullableText(1_000),
    hasDamage: z.boolean(),
    damageTypes: z.array(damageType).max(9),
    damageNote: nullableText(1_000),
    isSellable: z.boolean(),
    shelfLocation: nullableText(120),
    internalNotes: nullableText(1_000),
}).partial().strict().refine((value) => Object.keys(value).length > 0);

const baseResult = z.object({
    inventoryId: uuid,
    inventoryVersion: version,
    publicationIntentVersion: version,
    publicRevisionNumber: version.nullable(),
}).strict();

const responseSchemas = {
    update_store_inventory_details: baseResult.extend({
        outcome: z.literal('details_updated'),
    }).strict(),
    adjust_inventory_stock: baseResult.extend({
        stockState: z.enum(['available', 'low_stock', 'out_of_stock']),
        outcome: z.literal('stock_adjusted'),
    }).strict(),
} as const;

export type StoreViewChanges = z.infer<typeof storeViewChangesSchema>;
export type StoreViewManagementAction = keyof typeof responseSchemas;
export type StoreViewSaveResult = z.infer<typeof responseSchemas.update_store_inventory_details>;
export type StoreViewStockResult = z.infer<typeof responseSchemas.adjust_inventory_stock>;

export class StoreViewManagementResponseContractError extends Error {
    constructor() {
        super('The Store View management response could not be validated.');
        this.name = 'StoreViewManagementResponseContractError';
    }
}

export function decodeStoreViewManagementResponse<Action extends StoreViewManagementAction>(
    action: Action,
    value: unknown,
): z.infer<(typeof responseSchemas)[Action]> {
    const result = z.object({
        contractVersion: z.literal(STORE_VIEW_MANAGEMENT_CONTRACT_VERSION),
        data: responseSchemas[action],
    }).strict().safeParse(value);
    if (!result.success) throw new StoreViewManagementResponseContractError();
    return (result.data as unknown as {
        data: z.infer<(typeof responseSchemas)[Action]>;
    }).data;
}
