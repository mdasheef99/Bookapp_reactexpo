import { fireEvent, render } from '@testing-library/react-native';
import CustomerRequestDetailScreen from '../screens/CustomerRequestDetailScreen';

const mockAccept = jest.fn();
const mockCancel = jest.fn();
jest.mock('../hooks/useCustomerCommerce', () => ({
    useCustomerRequest: () => ({ data: {
        request_id: 'request-1', status: 'payment_ready', store_id: 'store-1', store_name: 'Local Books',
        fulfillment_method: 'pickup', currency_code: 'INR', version: 5,
        requested_subtotal_minor: 20000, final_subtotal_minor: 20000,
        final_delivery_tariff_minor: 0, final_total_minor: 20000,
        confirmation_due_at: '2026-07-17T12:00:00Z', acceptance_expires_at: null,
        payment_ready_at: '2026-07-16T10:00:00Z', payment_expires_at: '2026-07-16T11:00:00Z',
        updated_at: '2026-07-16T10:00:00Z', items: [{ item_id: 'item-1', title: 'The Book',
            authors: ['Author'], condition: 'good', requested_quantity: 1, confirmed_quantity: 1,
            unit_price_bound_minor: 20000, confirmed_unit_price_minor: 20000,
            confirmation_status: 'confirmed_full', pickup_eligible: true }],
    }, isLoading: false, error: null, refetch: jest.fn() }),
    useCustomerClarification: () => ({ data: null }),
    useProvideClarificationMutation: () => ({ mutate: jest.fn(), isPending: false }),
    useAcceptConfirmedChangesMutation: () => ({ mutate: mockAccept, isPending: false }),
    useCancelOrderRequestMutation: () => ({ mutate: mockCancel, isPending: false }),
}));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ colors: {
    textPrimary: '#111', textSecondary: '#555', textTertiary: '#777', accent: '#06f',
    bgCard: '#fff', border: '#ddd', error: '#b00',
} }) }));

describe('CustomerRequestDetailScreen', () => {
    beforeEach(() => jest.clearAllMocks());

    it('shows immutable payment-ready totals and expiry', () => {
        const screen = render(<CustomerRequestDetailScreen requestId="request-1" />);
        expect(screen.getByText('Payment ready')).toBeTruthy();
        expect(screen.getByText('Final total')).toBeTruthy();
        expect(screen.getAllByText('₹200.00').length).toBeGreaterThan(0);
        expect(screen.getByText(/payment window/i)).toBeTruthy();
    });

    it('does not render a provider payment button', () => {
        const screen = render(<CustomerRequestDetailScreen requestId="request-1" />);
        expect(screen.queryByRole('button', { name: /^Pay/i })).toBeNull();
        expect(screen.getByText(/payment integration.*Phase 7/i)).toBeTruthy();
    });

    it('offers customer cancellation in payment-ready state', () => {
        const screen = render(<CustomerRequestDetailScreen requestId="request-1" />);
        fireEvent.press(screen.getByText('Cancel request'));
        expect(mockCancel).toHaveBeenCalledWith({ requestId: 'request-1', version: 5 });
    });

    it('never displays internal identifiers or contact data', () => {
        const screen = render(<CustomerRequestDetailScreen requestId="request-1" />);
        expect(screen.queryByText(/correlation/i)).toBeNull();
        expect(screen.queryByText(/phone|address/i)).toBeNull();
    });
});
