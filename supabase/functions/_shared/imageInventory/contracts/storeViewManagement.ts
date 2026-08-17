import { z } from 'zod';

export const STORE_VIEW_MANAGEMENT_CONTRACT_VERSION = 'phase9-store-view-management-v1' as const;

const uuid = z.string().uuid();
const version = z.number().int().positive().safe();
const idempotencyKey = z.string().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/u);
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
}).partial().strict().refine((value) => Object.keys(value).length > 0, {
  message: 'at least one Store View change is required',
});

const saveRequest = z.object({
  action: z.literal('update_store_inventory_details'),
  contractVersion: z.literal(STORE_VIEW_MANAGEMENT_CONTRACT_VERSION),
  inventoryId: uuid,
  expectedInventoryVersion: version,
  changes: storeViewChangesSchema,
  idempotencyKey,
  commandId: uuid,
}).strict();

const stockRequest = z.object({
  action: z.literal('adjust_inventory_stock'),
  contractVersion: z.literal(STORE_VIEW_MANAGEMENT_CONTRACT_VERSION),
  inventoryId: uuid,
  expectedInventoryVersion: version,
  delta: z.number().int().min(-10_000).max(10_000).refine((value) => value !== 0),
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
  update_store_inventory_details: baseResult.extend({
    outcome: z.literal('details_updated'),
  }).strict(),
  adjust_inventory_stock: baseResult.extend({
    stockState: z.enum(['available', 'low_stock', 'out_of_stock']),
    outcome: z.literal('stock_adjusted'),
  }).strict(),
} as const;

const requestSchemas = {
  update_store_inventory_details: saveRequest,
  adjust_inventory_stock: stockRequest,
} as const;

export type StoreViewManagementAction = keyof typeof requestSchemas;
export type StoreViewManagementRequest =
  | z.infer<typeof saveRequest>
  | z.infer<typeof stockRequest>;

export function isStoreViewManagementAction(value: unknown): value is StoreViewManagementAction {
  return value === 'update_store_inventory_details' || value === 'adjust_inventory_stock';
}

export function parseStoreViewManagementRequest(value: unknown): StoreViewManagementRequest {
  const action = value && typeof value === 'object'
    ? (value as { action?: unknown }).action
    : undefined;
  const schema = isStoreViewManagementAction(action) ? requestSchemas[action] : undefined;
  const result = schema?.safeParse(value);
  if (!result?.success) {
    const unknown = result?.error.issues.some((issue) => issue.code === 'unrecognized_keys');
    throw new Error(unknown ? 'unknown keys in Store View management request' : 'invalid Store View management request');
  }
  return result.data as StoreViewManagementRequest;
}

export function parseStoreViewManagementRpcResponse<Action extends StoreViewManagementAction>(
  action: Action,
  value: unknown,
) {
  const result = responseSchemas[action].safeParse(value);
  if (!result.success) throw new Error('invalid Store View management response');
  return { contractVersion: STORE_VIEW_MANAGEMENT_CONTRACT_VERSION, data: result.data };
}
