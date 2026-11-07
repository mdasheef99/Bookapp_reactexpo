import { z } from 'zod';

export const STORE_VIEW_SUMMARY_CONTRACT_VERSION = 'phase9-store-view-summary-v1' as const;
const request = z.object({
  action: z.literal('read_store_view_summary'),
  contractVersion: z.literal(STORE_VIEW_SUMMARY_CONTRACT_VERSION),
}).strict();
const count = z.number().int().nonnegative().safe();
export const storeViewSummarySchema = z.object({
  counts: z.object({
    all: count, private: count, live: count, paused: count,
    needsAttention: count, outOfStock: count,
  }).strict(),
  availableStockValueMinor: z.string().regex(/^(0|[1-9][0-9]*)$/),
}).strict();

export type StoreViewSummaryRequest = z.infer<typeof request>;
export type StoreViewSummary = z.infer<typeof storeViewSummarySchema>;

export function parseStoreViewSummaryRequest(value: unknown): StoreViewSummaryRequest {
  const result = request.safeParse(value);
  if (!result.success) throw new Error('invalid Store View summary request');
  return result.data;
}

export function parseStoreViewSummaryRpcResponse(value: unknown) {
  const result = storeViewSummarySchema.safeParse(value);
  if (!result.success) throw new Error('P9_INTERNAL_ERROR: invalid Store View summary response');
  return { contractVersion: STORE_VIEW_SUMMARY_CONTRACT_VERSION, data: result.data };
}
