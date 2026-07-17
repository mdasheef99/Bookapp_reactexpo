import { fireEvent, render } from '@testing-library/react-native';
import OwnerOrderDetailScreen from '../screens/OwnerOrderDetailScreen';

const mockStart = jest.fn();
const mockConfirm = jest.fn();
jest.mock('../hooks/useOwnerCommerce', () => ({
    useOwnerRequest: () => ({ data: {
        request_id: 'request-1', status: 'store_reviewing', store_id: 'store-1', customer_label: 'Customer',
        fulfillment_method: 'pickup', currency_code: 'INR', version: 2,
        requested_subtotal_minor: 15000, final_subtotal_minor: null, final_total_minor: null,
        confirmation_due_at: '2099-01-01T00:00:00Z', updated_at: '2026-07-16T00:00:00Z',
        items: [{ item_id: 'item-1', title: 'The Book', authors: ['Author'], condition: 'good',
            requested_quantity: 2, confirmed_quantity: null, unit_price_bound_minor: 7500,
            confirmed_unit_price_minor: null, confirmation_status: 'requested', quantity_available: 3,
            pickup_eligible: true, delivery_eligible: false }],
    }, isLoading: false, error: null, refetch: jest.fn() }),
    useOwnerClarification: () => ({ data: null }),
    useStartStoreReviewMutation: () => ({ mutate: mockStart, isPending: false }),
    useConfirmFullMutation: () => ({ mutate: mockConfirm, isPending: false }),
    useConfirmPartialMutation: () => ({ mutate: jest.fn(), isPending: false }),
    useMarkUnavailableMutation: () => ({ mutate: jest.fn(), isPending: false }),
    useRejectRequestMutation: () => ({ mutate: jest.fn(), isPending: false }),
    useRequestClarificationMutation: () => ({ mutate: jest.fn(), isPending: false }),
    useRequestSupportMutation: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ colors: { textPrimary: '#111', textSecondary: '#555', textTertiary: '#777', accent: '#06f', bgCard: '#fff', border: '#ddd', error: '#b00' } }) }));

describe('OwnerOrderDetailScreen', () => {
    beforeEach(() => jest.clearAllMocks());
    it('shows safe item, bound, inventory, and deadline information', () => {
        const screen = render(<OwnerOrderDetailScreen requestId="request-1" />);
        expect(screen.getByText('The Book')).toBeTruthy();
        expect(screen.getByText(/requested 2/i)).toBeTruthy();
        expect(screen.getByText(/available 3/i)).toBeTruthy();
        expect(screen.getByText(/price bound.*₹75.00/i)).toBeTruthy();
    });
    it('does not expose phone or address', () => {
        const screen = render(<OwnerOrderDetailScreen requestId="request-1" />);
        expect(screen.queryByText(/phone|address/i)).toBeNull();
    });
    it('offers full confirmation with server-bound values', () => {
        const screen = render(<OwnerOrderDetailScreen requestId="request-1" />);
        fireEvent.press(screen.getByText('Confirm all available'));
        expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'request-1', version: 2 }));
    });
    it('offers distinct unavailable, rejection, clarification, and support actions', () => {
        const screen = render(<OwnerOrderDetailScreen requestId="request-1" />);
        expect(screen.getByText('Mark unavailable')).toBeTruthy();
        expect(screen.getByText('Reject request')).toBeTruthy();
        expect(screen.getByText('Ask customer')).toBeTruthy();
        expect(screen.getByText('Request platform support')).toBeTruthy();
    });
    it('does not render substitute or arbitrary price controls', () => {
        const screen = render(<OwnerOrderDetailScreen requestId="request-1" />);
        expect(screen.queryByText(/substitute/i)).toBeNull();
        expect(screen.queryByPlaceholderText(/price/i)).toBeNull();
    });
});
