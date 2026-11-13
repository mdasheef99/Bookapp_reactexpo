import { z } from 'zod';
import { StoreViewResponseContractError } from './storeViewContracts';
import {
    STORE_VIEW_SUMMARY_CONTRACT_VERSION,
    storeViewSummarySchema,
    type StoreViewSummary,
} from '../../../../supabase/functions/_shared/imageInventory/contracts/storeViewSummary';

// The shared module is a pure Zod contract (no Supabase client or runtime imports).
export { STORE_VIEW_SUMMARY_CONTRACT_VERSION };
export type { StoreViewSummary };

export function decodeStoreViewSummaryResponse(value: unknown): StoreViewSummary {
    const result = z.object({
        contractVersion: z.literal(STORE_VIEW_SUMMARY_CONTRACT_VERSION),
        data: storeViewSummarySchema,
    }).strict().safeParse(value);
    if (!result.success) throw new StoreViewResponseContractError();
    return result.data.data;
}
