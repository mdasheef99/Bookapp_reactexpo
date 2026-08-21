import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useMarketplaceSearch } from '../useMarketplaceSearch';
import { consumerDiscoveryService } from '../../services/consumerDiscoveryService';
import type { BookstoreSearchPage, BookstoreSearchResult } from '../../types';

jest.mock('../../services/consumerDiscoveryService', () => ({
    consumerDiscoveryService: {
        searchBookstores: jest.fn(),
        recordUnavailableSearch: jest.fn(),
    },
}));

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

type HookProps = {
    query: string;
};

function result(id: string, title: string): BookstoreSearchResult {
    return {
        store: {
            publicStoreId: id,
            displayName: `${title} Books`,
            logo: null,
            locality: null,
            city: 'Pune',
            state: 'MH',
            pickup: true,
            delivery: false,
            returnPolicy: 'no_returns',
        },
        matchedBook: {
            matchContext: `context-${id}`,
            originalTitle: title,
            authors: ['Author'],
            language: 'en',
            publicIsbn: null,
            cover: '/placeholder.png',
            boundedMatchKind: 'original_title_exact',
        },
        offerSummary: {
            offerCount: 1,
            lowestPriceMinor: 10000,
            currency: 'INR',
            conditionSummary: { best: 'good', worst: 'good', distinct: ['good'] },
            damageSummary: { hasUndamagedOffers: true, hasDamagedOffers: false },
            fulfillmentSummary: { pickupOfferCount: 1, deliveryOfferCount: 0 },
            availabilityBand: 'available',
            confirmationBeforePayment: true,
        },
    };
}

function page(item: BookstoreSearchResult): BookstoreSearchPage {
    return {
        contractVersion: 'phase9-q08-v1',
        rankingVersion: 'phase9-q08-ranking-v1',
        bookstoreCount: 1,
        items: [item],
        pageInfo: { nextCursor: null, hasNextPage: false },
    };
}

const firstResult = page(result('20000000-0000-4000-8000-000000000001', 'Old Result'));
const secondResult = page(result('20000000-0000-4000-8000-000000000002', 'New Result'));

describe('useMarketplaceSearch', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        (consumerDiscoveryService.recordUnavailableSearch as jest.Mock).mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('ignores stale in-flight search responses when a newer query completes first', async () => {
        const oldRequest = deferred<typeof firstResult>();
        const newRequest = deferred<typeof secondResult>();
        (consumerDiscoveryService.searchBookstores as jest.Mock)
            .mockReturnValueOnce(oldRequest.promise)
            .mockReturnValueOnce(newRequest.promise);

        const { result, rerender } = renderHook<
            ReturnType<typeof useMarketplaceSearch>,
            HookProps
        >(
            ({ query }) => useMarketplaceSearch(query, 0),
            { initialProps: { query: 'old' } },
        );

        act(() => {
            jest.runOnlyPendingTimers();
        });

        rerender({ query: 'new' });

        act(() => {
            jest.runOnlyPendingTimers();
        });

        await act(async () => {
            newRequest.resolve(secondResult);
            await newRequest.promise;
        });

        await waitFor(() => expect(result.current.results[0]?.matchedBook.originalTitle).toBe('New Result'));

        await act(async () => {
            oldRequest.resolve(firstResult);
            await oldRequest.promise;
        });

        expect(result.current.results[0]?.matchedBook.originalTitle).toBe('New Result');
    });

    it('invalidates query A as soon as B is typed, before B debounce or stale telemetry', async () => {
        const oldRequest = deferred<typeof firstResult>();
        (consumerDiscoveryService.searchBookstores as jest.Mock)
            .mockReturnValueOnce(oldRequest.promise)
            .mockResolvedValueOnce(secondResult);

        const { result, rerender } = renderHook<
            ReturnType<typeof useMarketplaceSearch>,
            HookProps
        >(
            ({ query }) => useMarketplaceSearch(query, 400),
            { initialProps: { query: 'query A' } },
        );

        act(() => { jest.advanceTimersByTime(400); });
        expect(consumerDiscoveryService.searchBookstores).toHaveBeenCalledTimes(1);

        rerender({ query: 'query B' });
        await act(async () => {
            oldRequest.resolve({
                ...firstResult,
                bookstoreCount: 0,
                items: [],
            });
            await oldRequest.promise;
        });

        expect(result.current.results).toEqual([]);
        expect(consumerDiscoveryService.recordUnavailableSearch).not.toHaveBeenCalled();
        expect(consumerDiscoveryService.searchBookstores).toHaveBeenCalledTimes(1);

        await act(async () => { jest.advanceTimersByTime(400); });
        await waitFor(() => expect(result.current.results[0]?.matchedBook.originalTitle)
            .toBe('New Result'));
        expect(consumerDiscoveryService.searchBookstores).toHaveBeenCalledTimes(2);
        expect(consumerDiscoveryService.recordUnavailableSearch).not.toHaveBeenCalled();
    });

    it('cancels the pending debounce when an immediate search is submitted', async () => {
        (consumerDiscoveryService.searchBookstores as jest.Mock).mockResolvedValue({
            contractVersion: 'phase9-q08-v1', rankingVersion: 'phase9-q08-ranking-v1',
            bookstoreCount: 0, items: [], pageInfo: { nextCursor: null, hasNextPage: false },
        });
        const { result } = renderHook(() => useMarketplaceSearch('The Bookshop', 400));

        await act(async () => {
            await result.current.searchNow('The Bookshop');
        });
        act(() => {
            jest.advanceTimersByTime(400);
        });

        expect(consumerDiscoveryService.searchBookstores).toHaveBeenCalledTimes(1);
    });
});
