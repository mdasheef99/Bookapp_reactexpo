import { render } from '@testing-library/react-native';
import OwnerOrdersScreen from '../screens/OwnerOrdersScreen';

jest.mock('../hooks/useOwnerCommerce', () => ({ useOwnerRequests: () => ({ data: [{
    request_id: 'request-1', status: 'submitted', store_id: 'store-1', customer_label: 'Customer',
    fulfillment_method: 'pickup', item_count: 2, version: 1,
    confirmation_due_at: '2099-01-01T00:00:00Z', updated_at: '2026-07-16T00:00:00Z',
}], isLoading: false, isFetching: false, refetch: jest.fn() }) }));
jest.mock('@/features/stores/hooks/useStoreOwnerGate', () => ({ useStoreOwnerGate: () => ({
    data: { state: 'active_owner', storeId: 'store-1', storeName: 'Local Books' }, isLoading: false,
}) }));
jest.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'owner-1' } }) }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ colors: { textPrimary: '#111', textSecondary: '#555', accent: '#06f', bgCard: '#fff', border: '#ddd' } }) }));

describe('OwnerOrdersScreen', () => {
    it('shows the entitled Owner inbox and safe customer label', () => {
        const screen = render(<OwnerOrdersScreen />);
        expect(screen.getByText('Order requests')).toBeTruthy();
        expect(screen.getByText('Customer')).toBeTruthy();
        expect(screen.getByText(/2 items/i)).toBeTruthy();
    });
    it('does not show phone, address, or a global customer ID', () => {
        const screen = render(<OwnerOrdersScreen />);
        expect(screen.queryByText(/phone|address|customer id/i)).toBeNull();
    });
});
