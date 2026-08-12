import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import {
    OwnerInventoryReadError,
    ownerInventoryReadService,
    type OwnerInventoryListItem,
    type OwnerInventoryPage,
} from '../api/ownerInventoryReadService';
import {
    ownerInventoryReadKeys,
    useOwnerInventoryRead,
} from '../queries/ownerInventoryReadQueries';
import {
    coordinateImageInventoryIdentity,
    resetImageInventoryIdentityForTests,
} from '../queries/ownerUxQueries';

const identity = { userId: 'owner-a', storeId: 'store-a' } as const;

function inventoryItem(id: string, title: string): OwnerInventoryListItem {
    return {
        id,
        title,
        authors: null,
        isbn10: null,
        isbn13: null,
        condition: 'good',
        quantityAvailable: 2,
        sellingPriceMinor: 35000,
        visibilityStatus: 'draft',
        listingQualityStatus: 'ready',
        publicNotes: null,
        shelfLocation: null,
        entryMethod: 'manual',
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-03T10:00:00.000Z',
        version: 1,
        publicationStatus: 'private',
        publicationIntentVersion: 1,
        publicationRetryable: false,
        publicationFailureReason: null,
        publicListingStatus: null,
    };
}

function inventoryPage(
    items: OwnerInventoryListItem[],
    hasMore = false,
    nextCursor: string | null = null,
): OwnerInventoryPage {
    return {
        contractVersion: 'phase9-owner-inventory-v2',
        items,
        pageInfo: { hasMore, nextCursor },
    };
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe('useOwnerInventoryRead', () => {
    let client: QueryClient;
    let wrapper: ({ children }: PropsWithChildren) => React.JSX.Element;
    let listPage: jest.SpyInstance;

    beforeEach(() => {
        client = new QueryClient({
            defaultOptions: { queries: { gcTime: Infinity } },
        });
        wrapper = ({ children }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );
        listPage = jest.spyOn(ownerInventoryReadService, 'listPage');
        resetImageInventoryIdentityForTests(identity);
    });

    afterEach(() => {
        cleanup();
        listPage.mockRestore();
        client.clear();
        resetImageInventoryIdentityForTests();
    });

    it('loads a successful empty first page without manufacturing an error', async () => {
        listPage.mockResolvedValue(inventoryPage([]));
        const hook = renderHook(() => useOwnerInventoryRead(identity), { wrapper });

        await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
        expect(hook.result.current.items).toEqual([]);
        expect(hook.result.current.error).toBeNull();
        expect(listPage).toHaveBeenCalledWith(expect.objectContaining({ cursor: null }), expect.anything());
    });

    it('appends pages deterministically and removes duplicate inventory ids', async () => {
        const first = inventoryItem('10000000-0000-4000-8000-000000000001', 'First');
        const duplicate = inventoryItem('10000000-0000-4000-8000-000000000002', 'Second');
        const third = inventoryItem('10000000-0000-4000-8000-000000000003', 'Third');
        listPage.mockImplementation(async (request) => request?.cursor
            ? inventoryPage([{ ...duplicate, title: 'Second refreshed' }, third])
            : inventoryPage([first, duplicate], true, 'opaque-next'));

        const hook = renderHook(() => useOwnerInventoryRead(identity), { wrapper });
        await waitFor(() => expect(hook.result.current.items).toHaveLength(2));

        await act(async () => {
            await hook.result.current.loadNextPage();
        });

        await waitFor(() => expect(hook.result.current.items.map((row) => row.id)).toEqual([
            first.id,
            duplicate.id,
            third.id,
        ]));
        expect(hook.result.current.items[1].title).toBe('Second');
        expect(hook.result.current.hasMore).toBe(false);
    });

    it('resets to a first-page request and ignores an older search response', async () => {
        const oldRequest = deferred<OwnerInventoryPage>();
        const newRequest = deferred<OwnerInventoryPage>();
        listPage.mockImplementation((request) => request?.filters?.query === 'old'
            ? oldRequest.promise
            : newRequest.promise);

        const hook = renderHook<
            ReturnType<typeof useOwnerInventoryRead>,
            { query: string }
        >(
            ({ query }: { query: string }) => useOwnerInventoryRead(identity, { query }),
            { initialProps: { query: 'old' }, wrapper },
        );
        hook.rerender({ query: 'new' });

        await act(async () => {
            newRequest.resolve(inventoryPage([
                inventoryItem('10000000-0000-4000-8000-000000000004', 'New result'),
            ]));
        });
        await waitFor(() => expect(hook.result.current.items[0]?.title).toBe('New result'));

        await act(async () => {
            oldRequest.resolve(inventoryPage([
                inventoryItem('10000000-0000-4000-8000-000000000005', 'Stale result'),
            ]));
        });
        expect(hook.result.current.items[0]?.title).toBe('New result');
        expect(listPage.mock.calls.every(([request]) => request.cursor === null)).toBe(true);
    });

    it('preserves loaded rows when the next page fails and exposes a retry path', async () => {
        const first = inventoryItem('10000000-0000-4000-8000-000000000006', 'Preserved');
        listPage
            .mockResolvedValueOnce(inventoryPage([first], true, 'opaque-next'))
            .mockRejectedValueOnce(new OwnerInventoryReadError({
                category: 'unavailable',
                code: 'P9_UNAVAILABLE',
                retryable: false,
            }));

        const hook = renderHook(() => useOwnerInventoryRead(identity), { wrapper });
        await waitFor(() => expect(hook.result.current.items).toEqual([first]));

        await act(async () => {
            await hook.result.current.loadNextPage();
        });

        await waitFor(() => expect(hook.result.current.isNextPageError).toBe(true));
        expect(hook.result.current.items).toEqual([first]);
        expect(hook.result.current.error).toMatchObject({ category: 'unavailable' });
    });

    it('retries one transient read failure', async () => {
        listPage
            .mockRejectedValueOnce(new OwnerInventoryReadError({
                category: 'unavailable',
                code: 'P9_UNAVAILABLE',
                retryable: true,
            }))
            .mockResolvedValueOnce(inventoryPage([]));

        const hook = renderHook(() => useOwnerInventoryRead(identity), { wrapper });

        await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
        expect(listPage).toHaveBeenCalledTimes(2);
    });

    it('refreshes from the first page instead of replaying old cursors', async () => {
        const first = inventoryItem('10000000-0000-4000-8000-000000000007', 'First');
        const second = inventoryItem('10000000-0000-4000-8000-000000000008', 'Second');
        const refreshed = inventoryItem('10000000-0000-4000-8000-000000000009', 'Refreshed');
        let firstPageCalls = 0;
        listPage.mockImplementation(async (request) => {
            if (request?.cursor) return inventoryPage([second]);
            firstPageCalls += 1;
            return firstPageCalls === 1
                ? inventoryPage([first], true, 'opaque-next')
                : inventoryPage([refreshed]);
        });

        const hook = renderHook(() => useOwnerInventoryRead(identity), { wrapper });
        await waitFor(() => expect(hook.result.current.items).toEqual([first]));
        await act(async () => {
            await hook.result.current.loadNextPage();
        });
        await waitFor(() => expect(hook.result.current.items).toEqual([first, second]));

        await act(async () => {
            await hook.result.current.refresh();
        });

        await waitFor(() => expect(hook.result.current.items).toEqual([refreshed]));
        expect(listPage.mock.calls.at(-1)?.[0].cursor).toBeNull();
    });

    it('preserves loaded rows when a first-page refresh fails', async () => {
        const first = inventoryItem('10000000-0000-4000-8000-000000000010', 'Still visible');
        listPage
            .mockResolvedValueOnce(inventoryPage([first]))
            .mockRejectedValueOnce(new OwnerInventoryReadError({
                category: 'unavailable',
                code: 'P9_UNAVAILABLE',
                retryable: false,
            }));

        const hook = renderHook(() => useOwnerInventoryRead(identity), { wrapper });
        await waitFor(() => expect(hook.result.current.items).toEqual([first]));

        await act(async () => {
            await hook.result.current.refresh();
        });

        await waitFor(() => expect(hook.result.current.isRefreshError).toBe(true));
        expect(hook.result.current.items).toEqual([first]);
        expect(hook.result.current.error).toMatchObject({ category: 'unavailable' });
        expect(listPage.mock.calls.at(-1)?.[0].cursor).toBeNull();
    });

    it('does not recommit cached refresh data when a later refresh fails', async () => {
        const initial = inventoryItem('10000000-0000-4000-8000-000000000011', 'Initial');
        const second = inventoryItem('10000000-0000-4000-8000-000000000012', 'Second');
        const refreshed = inventoryItem('10000000-0000-4000-8000-000000000013', 'Refreshed');
        const third = inventoryItem('10000000-0000-4000-8000-000000000014', 'Third');
        let call = 0;
        listPage.mockImplementation(async () => {
            call += 1;
            if (call === 1) return inventoryPage([initial], true, 'initial-next');
            if (call === 2) return inventoryPage([second]);
            if (call === 3) return inventoryPage([refreshed], true, 'refreshed-next');
            if (call === 4) return inventoryPage([third]);
            throw new OwnerInventoryReadError({
                category: 'unavailable',
                code: 'P9_UNAVAILABLE',
                retryable: false,
            });
        });

        const hook = renderHook(() => useOwnerInventoryRead(identity), { wrapper });
        await waitFor(() => expect(hook.result.current.items).toEqual([initial]));
        await act(async () => { await hook.result.current.loadNextPage(); });
        await waitFor(() => expect(hook.result.current.items).toEqual([initial, second]));
        await act(async () => { await hook.result.current.refresh(); });
        await waitFor(() => expect(hook.result.current.items).toEqual([refreshed]));
        await act(async () => { await hook.result.current.loadNextPage(); });
        await waitFor(() => expect(hook.result.current.items).toEqual([refreshed, third]));

        await act(async () => { await hook.result.current.refresh(); });

        await waitFor(() => expect(hook.result.current.isRefreshError).toBe(true));
        expect(hook.result.current.items).toEqual([refreshed, third]);
    });

    it('does not repopulate a removed identity cache from a late refresh', async () => {
        const staleRefresh = deferred<OwnerInventoryPage>();
        const identityB = { userId: 'owner-b', storeId: 'store-b' } as const;
        let call = 0;
        listPage.mockImplementation(async () => {
            call += 1;
            if (call === 1) {
                return inventoryPage([inventoryItem('10000000-0000-4000-8000-000000000015', 'Owner A')]);
            }
            if (call === 2) return staleRefresh.promise;
            return inventoryPage([inventoryItem('10000000-0000-4000-8000-000000000016', 'Owner B')]);
        });

        const hook = renderHook<
            ReturnType<typeof useOwnerInventoryRead>,
            { currentIdentity: typeof identity | typeof identityB }
        >(
            ({ currentIdentity }) => useOwnerInventoryRead(currentIdentity),
            { initialProps: { currentIdentity: identity }, wrapper },
        );
        await waitFor(() => expect(hook.result.current.items[0]?.title).toBe('Owner A'));
        let refreshPromise!: Promise<void>;
        act(() => { refreshPromise = hook.result.current.refresh(); });
        await waitFor(() => expect(listPage).toHaveBeenCalledTimes(2));

        const oldKey = ownerInventoryReadKeys.list(identity, {});
        client.removeQueries({ queryKey: oldKey, exact: true });
        hook.rerender({ currentIdentity: identityB });
        await waitFor(() => expect(hook.result.current.items[0]?.title).toBe('Owner B'));

        await act(async () => {
            staleRefresh.resolve(inventoryPage([
                inventoryItem('10000000-0000-4000-8000-000000000017', 'Stale owner A'),
            ]));
            await refreshPromise;
        });

        expect(client.getQueryData(oldKey)).toBeUndefined();
        expect(hook.result.current.items[0]?.title).toBe('Owner B');
    });

    it.each(['unauthorized', 'unavailable'] as const)(
        'does not translate %s into an empty success',
        async (category) => {
            listPage.mockRejectedValue(new OwnerInventoryReadError({
                category,
                code: category === 'unauthorized' ? 'P9_OWNER_NOT_AUTHORIZED' : 'P9_UNAVAILABLE',
                retryable: false,
            }));
            const hook = renderHook(() => useOwnerInventoryRead(identity), { wrapper });

            await waitFor(() => expect(hook.result.current.isError).toBe(true));
            expect(hook.result.current.data).toBeUndefined();
            expect(hook.result.current.error).toMatchObject({ category });
        },
    );

    it('removes the Owner inventory cache during a user or store transition', async () => {
        const key = ownerInventoryReadKeys.list(identity, {});
        client.setQueryData(key, { pages: [inventoryPage([])], pageParams: [null] });

        await act(async () => {
            await coordinateImageInventoryIdentity(
                { userId: 'owner-b', storeId: 'store-b' },
                client,
            );
        });

        expect(client.getQueryData(key)).toBeUndefined();
    });
});
