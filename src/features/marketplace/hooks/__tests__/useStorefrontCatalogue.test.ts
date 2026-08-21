import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useStorefrontCatalogue } from '../useStorefrontCatalogue';
import { consumerDiscoveryService } from '../../services/consumerDiscoveryService';

jest.mock('../../services/consumerDiscoveryService', () => ({
    consumerDiscoveryService: { getStorefrontCatalogue: jest.fn() },
}));

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => { resolve = done; });
    return { promise, resolve };
}

const storeProfile = {
    publicStoreId: '20000000-0000-4000-8000-000000000001',
    displayName: 'Reader Lane', description: null, logo: null, cover: null,
    city: 'Pune', state: 'MH', locality: 'Camp', operatingHours: {},
    pickup: true, delivery: false, returnPolicy: 'no_returns' as const,
};

const page = (title: string, nextCursor: string | null = null) => ({
    contractVersion: 'q09-v1' as const,
    storeProfile,
    titleCount: 2,
    matchContextState: 'none' as const,
    highlightedTitleGroup: null,
    titleGroups: [{
        safeTitlePresentation: {
            originalTitle: title, authors: [], language: 'en', publicIsbn: null,
            cover: '/placeholder.png',
        },
        offers: [{
            listingId: title === 'Second page'
                ? '10000000-0000-4000-8000-000000000002'
                : '10000000-0000-4000-8000-000000000001',
            priceMinor: 35000,
            currency: 'INR' as const,
            condition: 'good' as const,
            hasDamage: false,
            publicDamageNote: null,
            damageTypes: [],
            availabilityStatus: 'available' as const,
            fulfillmentOptions: ['pickup'],
            confirmationBeforePayment: true as const,
        }],
    }],
    pageInfo: { nextCursor, hasNextPage: nextCursor !== null },
});

describe('useStorefrontCatalogue', () => {
    beforeEach(() => jest.resetAllMocks());

    it('fences a stale page response after Clear Search starts a fresh traversal', async () => {
        const searched = deferred<ReturnType<typeof page>>();
        (consumerDiscoveryService.getStorefrontCatalogue as jest.Mock)
            .mockReturnValueOnce(searched.promise)
            .mockResolvedValueOnce(page('Browse all'));
        const { result } = renderHook(() => useStorefrontCatalogue(
            storeProfile.publicStoreId, 'opaque-match-context',
        ));

        await act(async () => { await result.current.clearSearch(); });
        await waitFor(() => expect(result.current.titleGroups[0]?.safeTitlePresentation.originalTitle)
            .toBe('Browse all'));
        await act(async () => { searched.resolve(page('Stale searched result')); await searched.promise; });
        expect(result.current.titleGroups[0]?.safeTitlePresentation.originalTitle).toBe('Browse all');
        expect(consumerDiscoveryService.getStorefrontCatalogue).toHaveBeenLastCalledWith(
            expect.objectContaining({ matchContext: null, cursor: null }),
        );
    });

    it('loads one grouped-title page for repeated pagination taps', async () => {
        const second = deferred<ReturnType<typeof page>>();
        (consumerDiscoveryService.getStorefrontCatalogue as jest.Mock)
            .mockResolvedValueOnce(page('First page', 'cursor-2'))
            .mockReturnValueOnce(second.promise);
        const { result } = renderHook(() => useStorefrontCatalogue(storeProfile.publicStoreId));
        await waitFor(() => expect(result.current.nextCursor).toBe('cursor-2'));
        act(() => {
            void result.current.loadMore();
            void result.current.loadMore();
        });
        expect(consumerDiscoveryService.getStorefrontCatalogue).toHaveBeenCalledTimes(2);
        await act(async () => { second.resolve(page('Second page')); await second.promise; });
        expect(result.current.titleGroups.map((group) => group.safeTitlePresentation.originalTitle))
            .toEqual(['First page', 'Second page']);
    });

    it('clears the prior bookstore while a switched bookstore request is pending', async () => {
        const switched = deferred<ReturnType<typeof page>>();
        (consumerDiscoveryService.getStorefrontCatalogue as jest.Mock)
            .mockResolvedValueOnce(page('First store'))
            .mockReturnValueOnce(switched.promise);
        const { result, rerender } = renderHook<
            ReturnType<typeof useStorefrontCatalogue>,
            { id: string }
        >(
            ({ id }) => useStorefrontCatalogue(id),
            { initialProps: { id: storeProfile.publicStoreId } },
        );
        await waitFor(() => expect(result.current.profile?.displayName).toBe('Reader Lane'));
        rerender({ id: '20000000-0000-4000-8000-000000000002' });
        await waitFor(() => expect(result.current.profile).toBeNull());
        await act(async () => {
            switched.resolve({
                ...page('Second store'),
                storeProfile: {
                    ...storeProfile,
                    publicStoreId: '20000000-0000-4000-8000-000000000002',
                    displayName: 'Second Store',
                },
            });
            await switched.promise;
        });
        expect(result.current.profile?.displayName).toBe('Second Store');
    });

    it('drops unavailable match context from the ordinary fallback pagination stream', async () => {
        (consumerDiscoveryService.getStorefrontCatalogue as jest.Mock)
            .mockResolvedValueOnce({
                ...page('Fallback page', 'ordinary-cursor'),
                matchContextState: 'unavailable',
            })
            .mockResolvedValueOnce(page('Second page'));
        const { result } = renderHook(() => useStorefrontCatalogue(
            storeProfile.publicStoreId, 'stale-context',
        ));
        await waitFor(() => expect(result.current.nextCursor).toBe('ordinary-cursor'));
        expect(result.current.hasSearchContext).toBe(true);
        await act(async () => { await result.current.loadMore(); });
        expect(consumerDiscoveryService.getStorefrontCatalogue).toHaveBeenLastCalledWith(
            expect.objectContaining({ cursor: 'ordinary-cursor', matchContext: null }),
        );
    });

    it('does not resurrect unavailable match context on refresh or retry', async () => {
        (consumerDiscoveryService.getStorefrontCatalogue as jest.Mock)
            .mockResolvedValueOnce({
                ...page('Fallback page'),
                matchContextState: 'unavailable',
            })
            .mockResolvedValueOnce(page('Ordinary refresh'));
        const { result } = renderHook(() => useStorefrontCatalogue(
            storeProfile.publicStoreId, 'stale-context',
        ));

        await waitFor(() => expect(result.current.matchContextState).toBe('unavailable'));
        await act(async () => { await result.current.retry(); });

        expect(consumerDiscoveryService.getStorefrontCatalogue).toHaveBeenLastCalledWith({
            storeId: storeProfile.publicStoreId,
            pageSize: 12,
            cursor: null,
            matchContext: null,
        });
        expect(result.current.titleGroups[0]?.safeTitlePresentation.originalTitle)
            .toBe('Ordinary refresh');
    });
});
