import { fireEvent, render } from '@testing-library/react-native';
import { useOwnerInventoryRead } from '../queries/ownerInventoryReadQueries';
import { OwnerInventoryReadScreen } from '../screens/OwnerInventoryReadScreen';

const mockPush = jest.fn();
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({
    useRouter: () => ({ push: mockPush }),
}));
jest.mock('../queries/ownerInventoryReadQueries', () => ({ useOwnerInventoryRead: jest.fn() }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ colors: {
    accent: '#2563eb', border: '#d1d5db', textPrimary: '#111827', textSecondary: '#4b5563',
} }) }));
jest.mock('@/components/ui/ScreenBackground', () => ({
    ScreenBackground: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/components/ui/GlassCard', () => ({
    GlassCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const identity = { userId: 'owner-a', storeId: 'store-a' } as const;
const inventoryId = '10000000-0000-4000-8000-000000000001';

function readState() {
    return {
        items: [{
            id: inventoryId, title: 'Committed book', authors: ['Author'], isbn10: null,
            isbn13: null, condition: 'good', quantityAvailable: 2, sellingPriceMinor: 500,
            visibilityStatus: 'draft', listingQualityStatus: 'ready', publicNotes: null,
            shelfLocation: null, entryMethod: 'manual', createdAt: '2026-08-12T10:00:00.000Z',
            updatedAt: '2026-08-12T10:00:00.000Z', version: 4,
            publicationStatus: 'private', publicationIntentVersion: 2,
            publicationRetryable: false, publicationFailureReason: null, publicListingStatus: null,
        }],
        data: { pages: [] }, error: null, isPending: false, isSuccess: true, isError: false,
        isFetchingNextPage: false, isNextPageError: false, isRefreshError: false, hasMore: false,
        loadNextPage: jest.fn(), refresh: jest.fn(), resetPagination: jest.fn(),
    };
}

describe('Unit 7C WU5 Inventory cutover', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (useOwnerInventoryRead as jest.Mock).mockReturnValue(readState());
    });

    it('removes publication and public-media policy from Inventory and hands off by inventoryId', () => {
        const screen = render(<OwnerInventoryReadScreen identity={identity} />);

        expect(screen.getByText('Committed book')).toBeTruthy();
        expect(screen.queryByText(/Publication/u)).toBeNull();
        expect(screen.queryByTestId(`publish-${inventoryId}`)).toBeNull();
        expect(screen.queryByTestId(`manage-public-media-${inventoryId}`)).toBeNull();
        expect(screen.queryByTestId('publication-filter-published')).toBeNull();

        fireEvent.press(screen.getByTestId(`inventory-open-store-view-${inventoryId}`));
        expect(mockPush).toHaveBeenCalledWith({
            pathname: '/(store-owner)/store-view/[inventoryId]',
            params: { inventoryId },
        });
    });
});
