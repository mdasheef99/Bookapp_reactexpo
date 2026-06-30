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
            bgSecondary: '#f1f5f9',
            border: '#e5e7eb',
            error: '#b91c1c',
            textPrimary: '#111827',
            textSecondary: '#4b5563',
            textTertiary: '#94a3b8',
        },
    }),
}));
jest.mock('@/components/ui/ScreenBackground', () => ({ ScreenBackground: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('@/components/ui/GlassCard', () => ({ GlassCard: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

const MOCK_INVENTORY_ITEM = {
    id: 'inventory-1',
    store_id: 'store-1',
    title: 'The Bookshop',
    isbn_13: '9780006543541',
    isbn_10: null,
    authors: null,
    condition: 'good',
    quantity_available: 2,
    selling_price_minor: 35000,
    visibility_status: 'draft',
    listing_quality_status: 'ready',
    public_notes: 'Clean copy',
    shelf_location: 'A3',
    entry_method: 'manual',
    created_at: '2026-06-28T00:00:00Z',
    updated_at: '2026-06-28T00:00:00Z',
};

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
        (storeInventoryService.listStoreInventory as jest.Mock).mockResolvedValue([MOCK_INVENTORY_ITEM]);

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
            { ...MOCK_INVENTORY_ITEM, quantity_available: 0 },
        ]);
        (storeInventoryService.publishInventoryItem as jest.Mock).mockRejectedValue(new Error('Quantity required'));

        const screen = render(<StoreInventoryScreen />);

        await waitFor(() => expect(screen.getByText('The Bookshop')).toBeTruthy());
        fireEvent.press(screen.getByTestId('publish-inventory-1'));

        await waitFor(() => expect(screen.getByText('Could not publish inventory item.')).toBeTruthy());
    });

    it('pauses a published inventory row from the list', async () => {
        (storeInventoryService.listStoreInventory as jest.Mock).mockResolvedValue([
            { ...MOCK_INVENTORY_ITEM, visibility_status: 'published' },
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
        (storeInventoryService.listStoreInventory as jest.Mock).mockResolvedValue([MOCK_INVENTORY_ITEM]);
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

    it('shows low stock badge for quantity of 1', async () => {
        (storeInventoryService.listStoreInventory as jest.Mock).mockResolvedValue([
            { ...MOCK_INVENTORY_ITEM, quantity_available: 1 },
        ]);

        const screen = render(<StoreInventoryScreen />);

        await waitFor(() => expect(screen.getAllByText('Low stock').length).toBeGreaterThanOrEqual(2));
    });

    it('shows out of stock badge for quantity of 0', async () => {
        (storeInventoryService.listStoreInventory as jest.Mock).mockResolvedValue([
            { ...MOCK_INVENTORY_ITEM, quantity_available: 0 },
        ]);

        const screen = render(<StoreInventoryScreen />);

        await waitFor(() => expect(screen.getByText('Out of stock')).toBeTruthy());
    });

    it('filters inventory by search query', async () => {
        (storeInventoryService.listStoreInventory as jest.Mock).mockResolvedValue([
            MOCK_INVENTORY_ITEM,
            { ...MOCK_INVENTORY_ITEM, id: 'inventory-2', title: 'Another Book' },
        ]);

        const screen = render(<StoreInventoryScreen />);

        await waitFor(() => expect(screen.getByText('The Bookshop')).toBeTruthy());
        expect(screen.getByText('Another Book')).toBeTruthy();

        fireEvent.changeText(screen.getByTestId('inventory-search'), 'Bookshop');

        await waitFor(() => expect(screen.queryByText('Another Book')).toBeNull());
        expect(screen.getByText('The Bookshop')).toBeTruthy();
    });

    it('opens edit modal when edit button is pressed', async () => {
        (storeInventoryService.listStoreInventory as jest.Mock).mockResolvedValue([MOCK_INVENTORY_ITEM]);

        const screen = render(<StoreInventoryScreen />);

        await waitFor(() => expect(screen.getByText('The Bookshop')).toBeTruthy());
        fireEvent.press(screen.getByTestId('edit-modal-inventory-1'));

        await waitFor(() => expect(screen.getByText('Edit Inventory')).toBeTruthy());
    });

    it('opens edit modal with current condition notes and shelf location', async () => {
        (storeInventoryService.listStoreInventory as jest.Mock).mockResolvedValue([
            { ...MOCK_INVENTORY_ITEM, condition: 'like_new', public_notes: 'Signed copy', shelf_location: 'B2' },
        ]);

        const screen = render(<StoreInventoryScreen />);

        await waitFor(() => expect(screen.getByText('The Bookshop')).toBeTruthy());
        fireEvent.press(screen.getByTestId('edit-modal-inventory-1'));

        await waitFor(() => expect(screen.getByDisplayValue('Signed copy')).toBeTruthy());
        expect(screen.getByDisplayValue('B2')).toBeTruthy();
        fireEvent.press(screen.getByTestId('edit-modal-save'));

        await waitFor(() => expect(storeInventoryService.updateInventoryItem).toHaveBeenCalledWith({
            storeId: 'store-1',
            inventoryId: 'inventory-1',
            condition: 'like_new',
            publicNotes: 'Signed copy',
            shelfLocation: 'B2',
        }));
    });

    it('filters inventory by condition status quantity and source', async () => {
        (storeInventoryService.listStoreInventory as jest.Mock).mockResolvedValue([
            { ...MOCK_INVENTORY_ITEM, id: 'inventory-1', title: 'Manual Published', condition: 'good', visibility_status: 'published', quantity_available: 1, entry_method: 'manual' },
            { ...MOCK_INVENTORY_ITEM, id: 'inventory-2', title: 'Image Draft', condition: 'fair', visibility_status: 'draft', quantity_available: 4, entry_method: 'image_extraction' },
        ]);

        const screen = render(<StoreInventoryScreen />);

        await waitFor(() => expect(screen.getByText('Manual Published')).toBeTruthy());
        expect(screen.getByText('Image Draft')).toBeTruthy();

        fireEvent.press(screen.getByTestId('filter-condition-fair'));
        await waitFor(() => expect(screen.queryByText('Manual Published')).toBeNull());
        expect(screen.getByText('Image Draft')).toBeTruthy();

        fireEvent.press(screen.getByTestId('filter-status-published'));
        await waitFor(() => expect(screen.queryByText('Image Draft')).toBeNull());

        fireEvent.press(screen.getByTestId('filter-condition-all'));
        await waitFor(() => expect(screen.getByText('Manual Published')).toBeTruthy());

        fireEvent.press(screen.getByTestId('filter-quantity-low_stock'));
        expect(screen.getByText('Manual Published')).toBeTruthy();

        fireEvent.press(screen.getByTestId('filter-source-image_extraction'));
        await waitFor(() => expect(screen.queryByText('Manual Published')).toBeNull());
    });

    it('bulk publishes and pauses selected rows', async () => {
        (storeInventoryService.listStoreInventory as jest.Mock)
            .mockResolvedValueOnce([MOCK_INVENTORY_ITEM])
            .mockResolvedValueOnce([{ ...MOCK_INVENTORY_ITEM, visibility_status: 'published' }]);

        const screen = render(<StoreInventoryScreen />);

        await waitFor(() => expect(screen.getByText('The Bookshop')).toBeTruthy());
        fireEvent.press(screen.getByTestId('select-inventory-1'));
        fireEvent.press(screen.getByTestId('bulk-publish'));

        await waitFor(() => expect(storeInventoryService.publishInventoryItem).toHaveBeenCalledWith({
            storeId: 'store-1',
            inventoryId: 'inventory-1',
        }));

        fireEvent.press(screen.getByTestId('select-inventory-1'));
        fireEvent.press(screen.getByTestId('bulk-pause'));

        await waitFor(() => expect(storeInventoryService.pauseInventoryItem).toHaveBeenCalledWith({
            storeId: 'store-1',
            inventoryId: 'inventory-1',
        }));
    });

    it('shows image-to-LLM placeholder button', async () => {
        const screen = render(<StoreInventoryScreen />);

        await waitFor(() => expect(storeInventoryService.listStoreInventory).toHaveBeenCalledWith('store-1'));
        expect(screen.getByText(/Image-to-LLM/i)).toBeTruthy();
    });
});
