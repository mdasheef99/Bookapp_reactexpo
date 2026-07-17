import { fireEvent, render } from '@testing-library/react-native';
import CustomerCartScreen from '../screens/CustomerCartScreen';

const mockMutate = jest.fn();
const mockSubmit = jest.fn();
jest.mock('../hooks/useCustomerCommerce', () => ({
    useCustomerCart: () => ({
        data: {
            cartId: 'cart-1', storeId: 'store-1', status: 'active', currencyCode: 'INR',
            version: 3, expiresAt: '2099-01-01T00:00:00Z', updatedAt: '2026-07-16T00:00:00Z',
            items: [{ itemId: 'item-1', listingId: 'listing-1', quantity: 2,
                priceSnapshotMinor: 12500, currencyCode: 'INR', version: 1,
                listing: { title: 'The Book', condition: 'good' } }],
        },
        isLoading: false, error: null, refetch: jest.fn(),
    }),
    useCartQuantityMutation: () => ({ mutate: mockMutate, isPending: false }),
    useRemoveCartItemMutation: () => ({ mutate: jest.fn(), isPending: false }),
    useSubmitOrderRequestMutation: () => ({ mutate: mockSubmit, isPending: false }),
}));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ colors: {
    textPrimary: '#111', textSecondary: '#555', textTertiary: '#777', accent: '#06f',
    bgCard: '#fff', border: '#ddd', error: '#b00',
} }) }));

describe('CustomerCartScreen', () => {
    beforeEach(() => jest.clearAllMocks());

    it('renders server-projected price, quantity, and subtotal', () => {
        const screen = render(<CustomerCartScreen />);
        expect(screen.getByText('The Book')).toBeTruthy();
        expect(screen.getByText('₹125.00 each')).toBeTruthy();
        expect(screen.getAllByText('₹250.00').length).toBeGreaterThan(0);
    });

    it('updates quantity through its mutation', () => {
        const screen = render(<CustomerCartScreen />);
        fireEvent.press(screen.getByLabelText('Increase The Book quantity'));
        expect(mockMutate).toHaveBeenCalledWith({ itemId: 'item-1', quantity: 3, version: 3 });
    });

    it('prevents duplicate submit while mutation state owns the tap', () => {
        const screen = render(<CustomerCartScreen />);
        fireEvent.press(screen.getByText('Submit request'));
        expect(mockSubmit).toHaveBeenCalledTimes(1);
    });

    it('does not claim inventory is reserved', () => {
        const screen = render(<CustomerCartScreen />);
        expect(screen.queryByText(/^Inventory is reserved/i)).toBeNull();
        expect(screen.getByText(/store confirms availability/i)).toBeTruthy();
    });
});
