import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useMarketplaceSearch } from '../useMarketplaceSearch';
import { consumerDiscoveryService } from '../../services/consumerDiscoveryService';
import type { GroupedBookResult } from '../../types';

jest.mock('../../services/consumerDiscoveryService', () => ({
    consumerDiscoveryService: {
        searchMarketplaceBooks: jest.fn(),
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

const firstResult: GroupedBookResult[] = [{
    groupingKey: 'title:old|author',
    title: 'Old Result',
    authors: ['Author'],
    isbn13: null,
    coverUrl: null,
    offerCount: 1,
    lowestPriceMinor: 10000,
    offers: [],
}];

const secondResult: GroupedBookResult[] = [{
    groupingKey: 'title:new|author',
    title: 'New Result',
    authors: ['Author'],
    isbn13: null,
    coverUrl: null,
    offerCount: 1,
    lowestPriceMinor: 20000,
    offers: [],
}];

describe('useMarketplaceSearch', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('ignores stale in-flight search responses when a newer query completes first', async () => {
        const oldRequest = deferred<typeof firstResult>();
        const newRequest = deferred<typeof secondResult>();
        (consumerDiscoveryService.searchMarketplaceBooks as jest.Mock)
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

        await waitFor(() => expect(result.current.results[0]?.title).toBe('New Result'));

        await act(async () => {
            oldRequest.resolve(firstResult);
            await oldRequest.promise;
        });

        expect(result.current.results[0]?.title).toBe('New Result');
    });
});
