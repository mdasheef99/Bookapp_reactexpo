import { act, renderHook, waitFor } from '@testing-library/react-native';
import { consumerDiscoveryService } from '../../services/consumerDiscoveryService';
import { usePublicListingDetail } from '../usePublicListingDetail';
import type { PublicListingDetail } from '../../types';

jest.mock('../../services/consumerDiscoveryService', () => ({
    consumerDiscoveryService: { getPublicListingDetail: jest.fn() },
}));

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => { resolve = done; });
    return { promise, resolve };
}

function detail(listingId: string, title: string): PublicListingDetail {
    return {
        contractVersion: 'q10-v1', listingId,
        store: {
            publicStoreId: '20000000-0000-4000-8000-000000000001',
            displayName: 'Reader Lane', description: null, logo: null, cover: null,
            locality: null, city: 'Pune', state: 'MH', pickup: true, delivery: false,
            returnPolicy: 'no_returns',
        },
        title, authors: [], language: 'en', description: null, editionStatement: null,
        volume: null, format: null, isbn10: null, isbn13: null, cover: '/placeholder.png',
        priceMinor: 35000, currency: 'INR', condition: 'good', hasDamage: false,
        publicDamageNote: null, damageTypes: [], availabilityStatus: 'available',
        fulfillmentOptions: ['pickup'], confirmationBeforePayment: true, gallery: [],
    };
}

describe('usePublicListingDetail', () => {
    beforeEach(() => jest.clearAllMocks());

    it('fences a stale detail response when the listing changes', async () => {
        const stale = deferred<PublicListingDetail>();
        (consumerDiscoveryService.getPublicListingDetail as jest.Mock)
            .mockReturnValueOnce(stale.promise)
            .mockResolvedValueOnce(detail('10000000-0000-4000-8000-000000000002', 'Current'));
        const { result, rerender } = renderHook<
            ReturnType<typeof usePublicListingDetail>,
            { id: string }
        >(
            ({ id }) => usePublicListingDetail(id),
            { initialProps: { id: '10000000-0000-4000-8000-000000000001' } },
        );
        rerender({ id: '10000000-0000-4000-8000-000000000002' });
        await waitFor(() => expect(result.current.detail?.title).toBe('Current'));
        await act(async () => {
            stale.resolve(detail('10000000-0000-4000-8000-000000000001', 'Stale'));
            await stale.promise;
        });
        expect(result.current.detail?.title).toBe('Current');
    });
});
