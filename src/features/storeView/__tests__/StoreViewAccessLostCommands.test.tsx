import type { PropsWithChildren } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PublicationClientError } from '@/features/imageInventory/api/publicationService';
import { usePublicationCommands } from '@/features/imageInventory/queries/publicationQueries';
import { StoreViewManagementClientError } from '../api/storeViewManagementService';
import { useStoreViewManagementCommands } from '../queries/storeViewManagementQueries';
import { useStoreViewDetail, storeViewKeys } from '../queries/storeViewQueries';
import { storeViewMediaKeys } from '../queries/storeViewMediaQueries';
import { storeViewHistoryKeys } from '../queries/storeViewHistoryQueries';
import { StoreViewDetailContent } from '../screens/StoreViewDetailScreen';

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@/features/imageInventory/queries/publicationQueries', () => ({ usePublicationCommands: jest.fn() }));
jest.mock('../queries/storeViewManagementQueries', () => ({ useStoreViewManagementCommands: jest.fn() }));
jest.mock('../queries/storeViewQueries', () => {
    const actual = jest.requireActual('../queries/storeViewQueries');
    return { ...actual, useStoreViewDetail: jest.fn() };
});
jest.mock('../queries/storeViewMediaQueries', () => ({
    ...jest.requireActual('../queries/storeViewMediaQueries'),
    useStoreViewMedia: () => ({ isPending: false, isError: false, data: null, refetch: jest.fn() }),
}));
jest.mock('../queries/storeViewMediaCommands', () => ({
    useStoreViewMediaCommands: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('../queries/storeViewHistoryQueries', () => ({
    ...jest.requireActual('../queries/storeViewHistoryQueries'),
    useStoreViewHistory: () => ({ isPending: false, isError: false, data: null }),
}));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ colors: {
    accent: '#abc', bgPrimary: '#101820', border: '#555', textPrimary: '#fff', textSecondary: '#ddd',
} }) }));
jest.mock('@/components/ui/ScreenBackground', () => ({ ScreenBackground: ({ children }: PropsWithChildren) => <>{children}</> }));
jest.mock('@/components/ui/GlassCard', () => ({ GlassCard: ({ children }: PropsWithChildren) => <>{children}</> }));

const identity = { userId: 'owner-a', storeId: 'store-a' };
const inventoryId = '00000000-0000-4000-8000-000000000001';

function book() {
    return {
        identity: { inventoryId },
        presentation: { title: 'Book', authors: ['Author'], language: 'en',
            publicDescription: '', condition: 'good', publicConditionNote: '', hasDamage: false,
            damageTypes: [], damageNote: null, isSellable: true, sellingPriceMinor: 35000 },
        versions: { inventoryVersion: 3, publicationIntentVersion: 2 },
        stockSummary: { quantityAvailable: 1, stockState: 'low_stock' },
        lifecycle: { publicationState: 'published', effectiveState: 'live', visibilityStatus: 'published' },
        attention: { attentionState: 'none', attentionReasons: [] },
        capabilities: ['edit_details', 'adjust_stock', 'manage_photos', 'publish', 'pause', 'republish', 'make_private', 'retry_publication'],
        mediaSummary: { approvedCount: 1 }, publicState: null,
        privateOperations: { shelfLocation: 'A3', internalNotes: 'Private' },
        stock: { quantityTotal: 1, quantityAvailable: 1, quantityReserved: 0, quantitySold: 0, quantityRemoved: 0 },
        historySummary: { publicRevisionCount: 1, latestPublicRevision: null },
    } as any;
}

const managementMutate = jest.fn();
const publicationMutate = jest.fn();

function setup() {
    const client = new QueryClient({ defaultOptions: {
        queries: { retry: false, gcTime: Infinity }, mutations: { retry: false },
    } });
    client.setQueryData(storeViewKeys.detail(identity, inventoryId), book());
    client.setQueryData(storeViewMediaKeys.detail(identity, inventoryId), { private: 'photos' });
    client.setQueryData(storeViewHistoryKeys.detail(identity, inventoryId), { private: 'history' });
    (useStoreViewDetail as jest.Mock).mockReturnValue({
        isPending: false, data: book(), error: null, refetch: jest.fn(),
    });
    (useStoreViewManagementCommands as jest.Mock).mockReturnValue({ mutateAsync: managementMutate, isPending: false });
    (usePublicationCommands as jest.Mock).mockReturnValue({ mutateAsync: publicationMutate, isPending: false });
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />, { wrapper });
    return { screen, client };
}

beforeEach(() => {
    jest.clearAllMocks();
    managementMutate.mockResolvedValue({ outcome: 'stock_adjusted' });
    publicationMutate.mockResolvedValue({ outcome: 'paused' });
});

describe('Store View detail command access loss', () => {
    it('routes a 403 publication failure to the access-lost screen and clears the detail cache', async () => {
        publicationMutate.mockRejectedValueOnce(new PublicationClientError('P9_RESPONSE_INVALID', false, 'x', 403));
        const { screen, client } = setup();
        fireEvent.press(screen.getByTestId('store-view-pause'));
        await waitFor(() => expect(screen.getByText('Store View unavailable')).toBeTruthy());
        expect(client.getQueryData(storeViewKeys.detail(identity, inventoryId))).toBeUndefined();
        expect(client.getQueryData(storeViewMediaKeys.detail(identity, inventoryId))).toBeUndefined();
        expect(client.getQueryData(storeViewHistoryKeys.detail(identity, inventoryId))).toBeUndefined();
        client.clear();
    });

    it('routes an access-lost stock failure to the access-lost screen and clears the detail cache', async () => {
        managementMutate.mockRejectedValueOnce(new StoreViewManagementClientError('P9_OWNER_NOT_AUTHORIZED', false, 'x'));
        const { screen, client } = setup();
        fireEvent.press(screen.getByTestId('store-view-adjust-stock'));
        fireEvent.changeText(screen.getByTestId('store-view-stock-delta'), '2');
        fireEvent.press(screen.getByTestId('store-view-apply-stock'));
        await waitFor(() => expect(screen.getByText('Store View unavailable')).toBeTruthy());
        expect(client.getQueryData(storeViewKeys.detail(identity, inventoryId))).toBeUndefined();
        expect(client.getQueryData(storeViewMediaKeys.detail(identity, inventoryId))).toBeUndefined();
        expect(client.getQueryData(storeViewHistoryKeys.detail(identity, inventoryId))).toBeUndefined();
        client.clear();
    });
});
