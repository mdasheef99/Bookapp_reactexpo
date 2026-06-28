import { fireEvent, render, waitFor } from '@testing-library/react-native';
import StoreInventoryScreen from '../StoreInventoryScreen';
import { useStoreOwnerGate } from '../../hooks/useStoreOwnerGate';
import { storeInventoryService } from '../../services/storeInventoryService';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
jest.mock('../../hooks/useStoreOwnerGate', () => ({ useStoreOwnerGate: jest.fn() }));
jest.mock('../../services/storeInventoryService', () => ({
    storeInventoryService: {
        createManualInventoryItem: jest.fn(),
        findPotentialDuplicates: jest.fn(),
        listStoreInventory: jest.fn(),
        publishInventoryItem: jest.fn(),
        pauseInventoryItem: jest.fn(),
        updateInventoryItem: jest.fn(),
    },
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            accent: '#84cc16',
            bgCard: '#ffffff',
            border: '#e5e7eb',
            error: '#b91c1c',
            textPrimary: '#111827',
            textSecondary: '#4b5563',
        },
    }),
}));
jest.mock('@/components/ui/ScreenBackground', () => ({ ScreenBackground: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('@/components/ui/GlassCard', () => ({ GlassCard: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

describe('StoreInventoryScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (useStoreOwnerGate as jest.Mock).mockReturnValue({
            data: { state: 'active_owner', storeId: 'store-1', storeName: 'Reader Lane Books' },
            isLoading: false,
        });
        (storeInventoryService.listStoreInventory as jest.Mock).mockResolvedValue([]);
        (storeInventoryService.findPotentialDuplicates as jest.Mock).mockResolvedValue([]);
        (storeInventoryService.createManualInventoryItem as jest.Mock).mockResolvedValue({ id: 'inventory-1' });
        (storeInventoryService.publishInventoryItem as jest.Mock).mockResolvedValue(undefined);
        (storeInventoryService.pauseInventoryItem as jest.Mock).mockResolvedValue(undefined);
        (storeInventoryService.updateInventoryItem as jest.Mock).mockResolvedValue(undefined);
    });

    it('creates manual inventory for the server-verified store id', async () => {
        const screen = render(<StoreInventoryScreen />);

        fireEvent.changeText(screen.getByPlaceholderText('Title'), 'The Bookshop');
        fireEvent.changeText(screen.getByPlaceholderText('Author'), 'Penelope Fitzgerald');
        fireEvent.changeText(screen.getByPlaceholderText('ISBN-13'), '9780006543541');
        fireEvent.changeText(screen.getByPlaceholderText('Price in rupees'), '350');
        fireEvent.changeText(screen.getByPlaceholderText('Quantity'), '2');
        fireEvent.press(screen.getByTestId('condition-like_new'));
        fireEvent.press(screen.getByTestId('save-inventory-draft'));

        await waitFor(() => expect(storeInventoryService.createManualInventoryItem).toHaveBeenCalledWith(expect.objectContaining({
            storeId: 'store-1',
            title: 'The Bookshop',
            authors: ['Penelope Fitzgerald'],
            isbn13: '9780006543541',
            condition: 'like_new',
            sellingPriceMinor: 35000,
            quantityAvailable: 2,
            visibilityStatus: 'draft',
        })));
    });

    it('shows duplicates without exposing private fields', async () => {
        (storeInventoryService.findPotentialDuplicates as jest.Mock).mockResolvedValue([
            {
                id: 'inventory-1',
                title: 'The Bookshop',
                isbn_13: '9780006543541',
                shelf_location: 'A3',
                acquisition_cost_minor: 12000,
                internal_notes: 'private',
            },
        ]);

        const screen = render(<StoreInventoryScreen />);

        fireEvent.changeText(screen.getByPlaceholderText('Title'), 'The Bookshop');
        fireEvent.changeText(screen.getByPlaceholderText('ISBN-13'), '9780006543541');
        fireEvent.press(screen.getByTestId('check-duplicates'));

        await waitFor(() => expect(screen.getByText('Potential duplicate: The Bookshop')).toBeTruthy());
        expect(screen.queryByText('A3')).toBeNull();
        expect(screen.queryByText('private')).toBeNull();
    });

    it('blocks manual inventory form for non-active owner states', () => {
        (useStoreOwnerGate as jest.Mock).mockReturnValue({
            data: { state: 'approved_pending_setup', storeId: 'store-1', storeName: 'Reader Lane Books' },
            isLoading: false,
        });

        const screen = render(<StoreInventoryScreen />);

        expect(screen.getByText('Complete store setup before adding inventory.')).toBeTruthy();
        expect(screen.queryByText('Save draft')).toBeNull();
    });

    it('publishes a ready draft inventory row from the verified store context', async () => {
        (storeInventoryService.listStoreInventory as jest.Mock).mockResolvedValue([
            {
                id: 'inventory-1',
                store_id: 'store-1',
                title: 'The Bookshop',
                isbn_13: '9780006543541',
                condition: 'good',
                quantity_available: 2,
                selling_price_minor: 35000,
                visibility_status: 'draft',
                listing_quality_status: 'ready',
                created_at: '2026-06-28T00:00:00Z',
                updated_at: '2026-06-28T00:00:00Z',
            },
        ]);

        const screen = render(<StoreInventoryScreen />);

        await waitFor(() => expect(screen.getByText('The Bookshop')).toBeTruthy());
        expect(screen.getByText('good - Rs 350 - Qty 2')).toBeTruthy();
        fireEvent.press(screen.getByTestId('publish-inventory-1'));

        await waitFor(() => expect(storeInventoryService.publishInventoryItem).toHaveBeenCalledWith({
            storeId: 'store-1',
            inventoryId: 'inventory-1',
        }));
    });

    it('shows a recoverable message when publishing fails', async () => {
        (storeInventoryService.listStoreInventory as jest.Mock).mockResolvedValue([
            {
                id: 'inventory-1',
                store_id: 'store-1',
                title: 'The Bookshop',
                isbn_13: '9780006543541',
                condition: 'good',
                quantity_available: 0,
                selling_price_minor: 35000,
                visibility_status: 'draft',
                listing_quality_status: 'ready',
            },
        ]);
        (storeInventoryService.publishInventoryItem as jest.Mock).mockRejectedValue(new Error('Quantity required'));

        const screen = render(<StoreInventoryScreen />);

        await waitFor(() => expect(screen.getByText('The Bookshop')).toBeTruthy());
        fireEvent.press(screen.getByTestId('publish-inventory-1'));

        await waitFor(() => expect(screen.getByText('Could not publish inventory item.')).toBeTruthy());
    });

    it('pauses a published inventory row from the list', async () => {
        (storeInventoryService.listStoreInventory as jest.Mock).mockResolvedValue([
            {
                id: 'inventory-1',
                store_id: 'store-1',
                title: 'The Bookshop',
                condition: 'good',
                quantity_available: 2,
                selling_price_minor: 35000,
                visibility_status: 'published',
                listing_quality_status: 'ready',
            },
        ]);
        (storeInventoryService.pauseInventoryItem as jest.Mock).mockResolvedValue(undefined);

        const screen = render(<StoreInventoryScreen />);

        await waitFor(() => expect(screen.getByText('The Bookshop')).toBeTruthy());
        fireEvent.press(screen.getByTestId('pause-inventory-1'));

        await waitFor(() => expect(storeInventoryService.pauseInventoryItem).toHaveBeenCalledWith({
            storeId: 'store-1',
            inventoryId: 'inventory-1',
        }));
    });

    it('saves minimal price and quantity edits from the list', async () => {
        (storeInventoryService.listStoreInventory as jest.Mock).mockResolvedValue([
            {
                id: 'inventory-1',
                store_id: 'store-1',
                title: 'The Bookshop',
                condition: 'good',
                quantity_available: 2,
                selling_price_minor: 35000,
                visibility_status: 'draft',
                listing_quality_status: 'ready',
            },
        ]);
        (storeInventoryService.updateInventoryItem as jest.Mock).mockResolvedValue(undefined);

        const screen = render(<StoreInventoryScreen />);

        await waitFor(() => expect(screen.getByText('The Bookshop')).toBeTruthy());
        fireEvent.changeText(screen.getByTestId('edit-price-inventory-1'), '425');
        fireEvent.changeText(screen.getByTestId('edit-quantity-inventory-1'), '3');
        fireEvent.press(screen.getByTestId('save-edit-inventory-1'));

        await waitFor(() => expect(storeInventoryService.updateInventoryItem).toHaveBeenCalledWith({
            storeId: 'store-1',
            inventoryId: 'inventory-1',
            sellingPriceMinor: 42500,
            quantityAvailable: 3,
        }));
    });
});
