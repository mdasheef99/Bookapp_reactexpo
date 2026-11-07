import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { supabase } from '@/lib/supabase';
import { imageInventoryKeys, resetImageInventoryIdentityForTests } from '@/features/imageInventory/queries/ownerUxQueries';
import { synchronizeInventoryCommitSuccess } from '@/features/imageInventory/queries/ownerInventoryCommitQueries';
import { usePublicationCommands } from '@/features/imageInventory/queries/publicationQueries';
import { publicationService } from '@/features/imageInventory/api/publicationService';
import { storeViewService } from '../api/storeViewService';
import { decodeStoreViewSummaryResponse, STORE_VIEW_SUMMARY_CONTRACT_VERSION as contractVersion } from '../contracts/storeViewSummaryContracts';
import { storeViewSummaryKeys, useStoreViewSummary } from '../queries/storeViewSummaryQueries';
import { invalidateStoreViewAfterSave, invalidateStoreViewAfterMedia } from '../queries/storeViewInvalidation';

jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
jest.mock('@/features/imageInventory/api/publicationService', () => ({ publicationService: { setState: jest.fn(), retry: jest.fn() } }));
const data = { counts: { all: 6, private: 1, live: 1, paused: 1, needsAttention: 1, outOfStock: 1 }, availableStockValueMinor: '13835058042397261827' };
const invoke = supabase.functions.invoke as jest.Mock;
const identity = { userId: 'summary-data-owner', storeId: 'store-a' };
const other = { userId: 'other-owner', storeId: 'store-b' };
beforeEach(() => { jest.clearAllMocks(); invoke.mockResolvedValue({ data: { contractVersion, data }, error: null }); });

it('uses the strict summary action/version and preserves the exact decimal string', async () => {
    const signal = new AbortController().signal;
    expect(await storeViewService.summary(signal)).toEqual(data);
    expect(invoke).toHaveBeenCalledWith('phase9-owner-ingestion', { body: { action: 'read_store_view_summary', contractVersion }, signal });
});
it.each([
    { contractVersion, data, unknown: true }, { contractVersion: 'wrong', data },
    { contractVersion, data: { ...data, unknown: true } },
    { contractVersion, data: { ...data, counts: { ...data.counts, unknown: 0 } } },
    ...[-1, 1.5, Number.MAX_SAFE_INTEGER + 1, '1', null].map(all => ({ contractVersion, data: { ...data, counts: { ...data.counts, all } } })),
    ...['00', '-1', '1.0', '1e3', '', 123].map(availableStockValueMinor => ({ contractVersion, data: { ...data, availableStockValueMinor } })),
])('strictly rejects invalid client response %j', value => {
    expect(() => decodeStoreViewSummaryResponse(value)).toThrow('could not be validated');
});
it('turns a malformed response into the existing safe client error', async () => {
    invoke.mockResolvedValue({ data: { contractVersion, data: { ...data, extra: 'private' } } });
    await expect(storeViewService.summary()).rejects.toMatchObject({ code: 'P9_RESPONSE_INVALID', retryable: false });
});
it.each([401, 403])('preserves HTTP %i access loss without an error body', async status => {
    invoke.mockResolvedValue({ error: { context: { status } } });
    await expect(storeViewService.summary()).rejects.toMatchObject({ code: 'P9_AUTH_REQUIRED', retryable: false, httpStatus: status });
});
it('preserves the safe error envelope', async () => {
    invoke.mockResolvedValue({ error: { context: new Response(JSON.stringify({ error: 'P9_OWNER_NOT_AUTHORIZED', retryable: false, message: 'safe' }), { status: 400 }) } });
    await expect(storeViewService.summary()).rejects.toMatchObject({ code: 'P9_OWNER_NOT_AUTHORIZED', retryable: false });
});

it('refreshes active summary data after commit/save/stock/photo/publication and isolates identities', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const currentData = { counts: { all: 6, private: 2, live: 2, paused: 1, needsAttention: 0, outOfStock: 1 }, availableStockValueMinor: '111' };
    const foreignData = { counts: { all: 4, private: 1, live: 1, paused: 1, needsAttention: 1, outOfStock: 0 }, availableStockValueMinor: '222' };
    const service = jest.spyOn(storeViewService, 'summary')
        .mockResolvedValueOnce(currentData)
        .mockResolvedValueOnce(foreignData);
    const current = renderHook(() => useStoreViewSummary(identity), { wrapper });
    const foreign = renderHook(() => useStoreViewSummary(other), { wrapper });
    const unresolved = { userId: 'unresolved', storeId: 'unresolved' };
    client.setQueryData(storeViewSummaryKeys.summary(unresolved), data);
    await waitFor(() => expect(current.result.current.data).toEqual(currentData));
    await waitFor(() => expect(foreign.result.current.data).toEqual(foreignData));
    expect(storeViewSummaryKeys.summary(identity)).toEqual([...imageInventoryKeys.identity(identity), 'storeView', 'summary', contractVersion]);
    resetImageInventoryIdentityForTests(identity);
    let count = 6;
    const operations = [
        () => synchronizeInventoryCommitSuccess(client, identity, 'session', [{ sessionId: 'session', candidateId: 'candidate', candidateVersion: 1, inventoryId: 'inventory', inventoryVersion: 1, outcome: 'committed_private' }]),
        () => invalidateStoreViewAfterSave(client, identity), // save and stock share this invalidation
        () => invalidateStoreViewAfterMedia(client, identity), // reorder/remove/replace/add
    ];
    for (const operation of operations) {
        const next = { ...currentData, counts: { ...currentData.counts, all: ++count } };
        service.mockResolvedValueOnce(next);
        await act(async () => { await operation(); });
        await waitFor(() => expect(current.result.current.data).toEqual(next));
        expect(foreign.result.current.data).toEqual(foreignData);
        expect(client.getQueryState(storeViewSummaryKeys.summary(unresolved))?.isInvalidated).toBe(false);
    }
    const publish = renderHook(() => usePublicationCommands(identity), { wrapper });
    (publicationService.setState as jest.Mock).mockResolvedValue({});
    const nextCurrent = { ...currentData, counts: { ...currentData.counts, all: ++count } };
    const nextForeign = { ...foreignData, counts: { ...foreignData.counts, all: 5 } };
    service.mockResolvedValueOnce(nextCurrent).mockResolvedValueOnce(nextForeign);
    await act(async () => { await publish.result.current.mutateAsync({ inventoryId: 'inventory', inventoryVersion: 1, publicationIntentVersion: 1, intent: 'publish' }); });
    await waitFor(() => expect(current.result.current.data).toEqual(nextCurrent));
    await waitFor(() => expect(foreign.result.current.data).toEqual(nextForeign));
    // A broad publication invalidation refetches every identity in place and
    // never places one identity's response in the other identity's cache entry.
    expect(client.getQueryData(storeViewSummaryKeys.summary(identity))).toEqual(nextCurrent);
    expect(client.getQueryData(storeViewSummaryKeys.summary(other))).toEqual(nextForeign);
    expect(client.getQueryData(storeViewSummaryKeys.summary(other))).not.toEqual(nextCurrent);
    current.unmount(); foreign.unmount(); publish.unmount(); client.clear(); service.mockRestore();
});

it('a stalled summary settles after the bound so an awaited invalidation completes', async () => {
    jest.useFakeTimers();
    try {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
        const service = jest.spyOn(storeViewService, 'summary').mockImplementation(
            (signal) => new Promise<never>((_resolve, reject) => {
                signal?.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })), { once: true });
            }),
        );
        const hook = renderHook(() => useStoreViewSummary(identity), { wrapper });
        // The query retries a retryable failure once: cover the initial
        // attempt and the retry (10s bound each) so the query settles. The
        // retry is scheduled (retryDelay 0) and the second attempt arms its
        // own 10s timer only after the first rejection propagates through
        // promise microtasks, so advance past each bound in turn with the
        // async variant, which yields to microtasks between timers.
        await act(async () => { await jest.advanceTimersByTimeAsync(10_000); });
        await act(async () => { await jest.advanceTimersByTimeAsync(10_000); });
        await act(async () => { await jest.advanceTimersByTimeAsync(10_000); });
        expect(hook.result.current.isError).toBe(true);
        expect(hook.result.current.error).toMatchObject({ code: 'P9_INTERNAL_ERROR', retryable: true });
        // The publication path awaits invalidations over this prefix: with the
        // bound in place that await settles instead of hanging on a stall.
        service.mockResolvedValue(data);
        await act(async () => { await client.invalidateQueries({ queryKey: imageInventoryKeys.all }); });
        // The hook is notified through the query notify scheduler (a timer);
        // under fake timers it only reaches React once timers advance.
        await act(async () => { await jest.advanceTimersByTimeAsync(1); });
        expect(hook.result.current.data).toEqual(data);
        hook.unmount(); client.clear(); service.mockRestore();
    } finally {
        jest.useRealTimers();
    }
});
