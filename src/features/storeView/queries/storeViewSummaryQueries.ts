import { useQuery } from '@tanstack/react-query';
import { imageInventoryKeys, type ImageInventoryIdentity } from '@/features/imageInventory/queries/ownerUxQueries';
import { storeViewService, StoreViewClientError } from '../api/storeViewService';
import { STORE_VIEW_SUMMARY_CONTRACT_VERSION } from '../contracts/storeViewSummaryContracts';

/** A stalled summary must not hang awaited invalidations: bound every fetch to 10s. */
export const STORE_VIEW_SUMMARY_TIMEOUT_MS = 10_000;

export const storeViewSummaryKeys = {
    summary: (identity: ImageInventoryIdentity) => [
        ...imageInventoryKeys.identity(identity), 'storeView', 'summary', STORE_VIEW_SUMMARY_CONTRACT_VERSION,
    ] as const,
};

export function useStoreViewSummary(identity: ImageInventoryIdentity) {
    return useQuery({
        queryKey: storeViewSummaryKeys.summary(identity),
        queryFn: ({ signal }) => {
            const controller = new AbortController();
            const onAbort = () => controller.abort();
            signal?.addEventListener('abort', onAbort, { once: true });
            const timer = setTimeout(() => controller.abort(), STORE_VIEW_SUMMARY_TIMEOUT_MS);
            return storeViewService.summary(controller.signal).catch((error: unknown) => {
                // Our own timeout: surface a retryable client error so the
                // query settles instead of hanging. A caller abort stays an AbortError.
                if (error instanceof Error && error.name === 'AbortError' && !signal?.aborted) {
                    throw new StoreViewClientError('P9_INTERNAL_ERROR', true, 'Store View could not be loaded.');
                }
                throw error;
            }).finally(() => {
                clearTimeout(timer);
                signal?.removeEventListener('abort', onAbort);
            });
        },
        staleTime: 15_000,
        gcTime: 5 * 60_000,
        refetchOnReconnect: true,
        retry: (failures, error) => failures < 1 && error instanceof StoreViewClientError && error.retryable,
        retryDelay: 0,
    });
}
