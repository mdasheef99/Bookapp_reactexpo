import { fireEvent, render } from '@testing-library/react-native';
import { Link } from 'expo-router';
import { StoreViewDetailContent } from '../screens/StoreViewDetailScreen';
import { StoreViewListContent } from '../screens/StoreViewListScreen';
import { useStoreViewDetail, useStoreViewPage } from '../queries/storeViewQueries';

jest.mock('expo-router', () => ({
    Link: jest.fn(({ children }: { children: React.ReactNode }) => <>{children}</>),
}));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('../queries/storeViewQueries', () => ({
    useStoreViewPage: jest.fn(),
    useStoreViewDetail: jest.fn(),
}));
jest.mock('../queries/storeViewManagementQueries', () => ({
    useStoreViewManagementCommands: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('../queries/storeViewMediaCommands', () => ({
    useStoreViewMediaCommands: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('../queries/storeViewMediaQueries', () => ({
    useStoreViewMedia: () => ({ isPending: false, isError: false, data: null, refetch: jest.fn() }),
}));
jest.mock('../queries/storeViewHistoryQueries', () => ({
    useStoreViewHistory: () => ({ isPending: false, isError: false, data: null }),
}));
jest.mock('@/features/imageInventory/queries/publicationQueries', () => ({
    usePublicationCommands: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ colors: {
        accent: '#2563eb', bgCard: '#fff', bgSecondary: '#eee', border: '#ddd',
        error: '#b91c1c', textPrimary: '#111', textSecondary: '#555', textTertiary: '#777',
    } }),
}));
jest.mock('@/components/ui/ScreenBackground', () => ({
    ScreenBackground: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/components/ui/GlassCard', () => ({
    GlassCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const identity = { userId: 'owner-a', storeId: 'store-a' };
const inventoryId = '00000000-0000-4000-8000-000000000001';
const baseItem = {
    identity: { inventoryId },
    presentation: {
        title: 'The Bookshop', authors: ['Penelope Fitzgerald'], language: 'en',
        publicDescription: 'Public copy.', condition: 'good', publicConditionNote: 'Light wear.',
        hasDamage: false, damageTypes: [], damageNote: null, isSellable: true,
        sellingPriceMinor: 35000,
    },
    stockSummary: { quantityAvailable: 2, stockState: 'available' },
    lifecycle: { publicationState: 'published', effectiveState: 'live', visibilityStatus: 'published' },
    attention: { attentionState: 'none', attentionReasons: [] },
    capabilities: ['edit_details', 'adjust_stock'],
    versions: { inventoryVersion: 1, publicationIntentVersion: 1 },
    mediaSummary: { approvedCount: 1 },
    publicState: null,
} as any;

const pageHook = useStoreViewPage as jest.Mock;
const detailHook = useStoreViewDetail as jest.Mock;
const fetchNextPage = jest.fn();
const refetch = jest.fn();

function pageState(overrides: Record<string, unknown> = {}) {
    return {
        items: [], isPending: false, isError: false, isFetchNextPageError: false,
        isFetchingNextPage: false, hasNextPage: false, fetchNextPage, refetch,
        ...overrides,
    };
}

describe('Unit 7C WU2 Store View UI', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        pageHook.mockReturnValue(pageState());
    });

    it.each([
        ['private', 'Private'], ['live', 'Live'], ['paused', 'Paused'],
        ['needs_attention', 'Needs Attention'], ['publication_failed', 'Publication Failed'],
        ['out_of_stock', 'Out of Stock'],
    ])('renders server effective state %s as %s', (effectiveState, label) => {
        pageHook.mockReturnValue(pageState({
            items: [{ ...baseItem, lifecycle: { ...baseItem.lifecycle, effectiveState } }],
        }));
        const screen = render(<StoreViewListContent identity={identity} />);
        expect(screen.getByTestId(`store-view-state-${inventoryId}`).props.children).toBe(label);
    });

    it('keeps publication failure distinct under Needs Attention', () => {
        pageHook.mockReturnValue(pageState({ items: [{
            ...baseItem,
            lifecycle: { ...baseItem.lifecycle, publicationState: 'publication_failed', effectiveState: 'publication_failed' },
            attention: { attentionState: 'action_required', attentionReasons: ['publication_failed'] },
        }] }));
        const screen = render(<StoreViewListContent identity={identity} />);
        expect(screen.getByText('Publication Failed')).toBeTruthy();
        expect(screen.getByText('Needs attention')).toBeTruthy();
    });

    it('sends all six filter selections into the query hook', () => {
        const screen = render(<StoreViewListContent identity={identity} />);
        for (const filter of ['private', 'live', 'paused', 'needs_attention', 'out_of_stock', 'all']) {
            fireEvent.press(screen.getByTestId(`store-view-filter-${filter}`));
            expect(pageHook).toHaveBeenLastCalledWith(identity, filter);
        }
    });

    it('renders loading, error, empty, and pagination states', () => {
        pageHook.mockReturnValueOnce(pageState({ isPending: true }));
        expect(render(<StoreViewListContent identity={identity} />).getByText('Loading Store View…')).toBeTruthy();
        pageHook.mockReturnValueOnce(pageState({ isError: true }));
        expect(render(<StoreViewListContent identity={identity} />).getByText('Store View could not be loaded')).toBeTruthy();
        pageHook.mockReturnValueOnce(pageState());
        expect(render(<StoreViewListContent identity={identity} />).getByText('No committed books')).toBeTruthy();
        pageHook.mockReturnValueOnce(pageState({ items: [baseItem], hasNextPage: true }));
        const paged = render(<StoreViewListContent identity={identity} />);
        fireEvent.press(paged.getByTestId('store-view-load-more'));
        expect(fetchNextPage).toHaveBeenCalled();
    });

    it('routes cards with inventoryId, never listingId', () => {
        pageHook.mockReturnValue(pageState({ items: [{
            ...baseItem,
            publicState: { listingId: '00000000-0000-4000-8000-000000000099', coverUrl: null, availabilityStatus: 'available' },
        }] }));
        render(<StoreViewListContent identity={identity} />);
        expect(Link).toHaveBeenCalledWith(expect.objectContaining({
            href: { pathname: '/(store-owner)/store-view/[inventoryId]', params: { inventoryId } },
        }), undefined);
    });

    it('renders management detail and visually identifies Owner-only values', () => {
        detailHook.mockReturnValue({ isPending: false, isError: false, data: {
            ...baseItem,
            privateOperations: { shelfLocation: 'A3', internalNotes: 'Owner note' },
            stock: { quantityTotal: 2, quantityAvailable: 2, quantityReserved: 0, quantitySold: 0, quantityRemoved: 0 },
            historySummary: { publicRevisionCount: 1, latestPublicRevision: null },
        } });
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        expect(screen.getByText('Stock and operations · Owner only')).toBeTruthy();
        expect(screen.getByText('A3')).toBeTruthy();
        expect(screen.getByText('Owner note')).toBeTruthy();
        expect(screen.getByTestId('store-view-edit')).toBeTruthy();
        expect(screen.getByTestId('store-view-adjust-stock')).toBeTruthy();
    });

    it('keeps missing and cross-store detail errors non-enumerating', () => {
        detailHook.mockReturnValue({ isPending: false, isError: true, data: undefined });
        const screen = render(<StoreViewDetailContent identity={identity} inventoryId={inventoryId} />);
        expect(screen.getByText('Store View unavailable')).toBeTruthy();
        expect(screen.getByText(/may not exist or may not belong/u)).toBeTruthy();
    });
});
