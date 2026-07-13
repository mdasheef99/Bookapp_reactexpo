import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type React from 'react';
import StoreProfileScreen from '../StoreProfileScreen';
import { useStoreOwnerGate } from '../../hooks/useStoreOwnerGate';
import { storeProfileService } from '../../services/storeProfileService';

jest.mock('@/lib/supabase');

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

jest.mock('@/features/auth/hooks/useAuth', () => ({
    useAuth: jest.fn(() => ({ user: { id: 'test-user-1' } })),
}));

jest.mock('../../hooks/useStoreOwnerGate', () => ({ useStoreOwnerGate: jest.fn() }));

jest.mock('../../services/storeProfileService', () => ({
    storeProfileService: { getProfile: jest.fn(), updateProfile: jest.fn() },
    OPERATING_HOURS_DAYS: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    RETURN_POLICY_TYPES: ['no_returns', 'no_returns_except_wrong_item', 'returns_within_3_days', 'returns_within_7_days'],
}));

jest.mock('@/hooks/useTheme', () => ({
    useTheme: jest.fn(() => ({
        colors: {
            accent: '#6366F1',
            textPrimary: '#0F172A',
            textSecondary: '#475569',
            textTertiary: '#94A3B8',
        },
    })),
}));

jest.mock('@/components/ui/ScreenBackground', () => ({
    ScreenBackground: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/ui/GlassCard', () => ({
    GlassCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const MOCK_PROFILE = {
    storeId: 'test-store-1',
    displayName: 'My Bookstore',
    description: 'A cozy independent bookstore',
    logoUrl: 'https://example.com/logo.png',
    coverUrl: 'https://example.com/cover.png',
    operatingHours: {
        monday: { open: '09:00', close: '18:00', closed: false },
        tuesday: { open: '09:00', close: '18:00', closed: false },
        wednesday: { open: '09:00', close: '18:00', closed: false },
        thursday: { open: '09:00', close: '18:00', closed: false },
        friday: { open: '09:00', close: '18:00', closed: false },
        saturday: { open: '10:00', close: '17:00', closed: false },
        sunday: { open: null, close: null, closed: true },
        temporary_closure: false,
    },
    pickupEnabled: true,
    deliveryEnabled: false,
    minimumDeliveryOrderValueMinor: null,
    returnPolicyType: 'returns_within_7_days',
    payoutAccountStatus: 'verified',
};

describe('StoreProfileScreen', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        jest.clearAllMocks();
        queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        (useStoreOwnerGate as jest.Mock).mockReturnValue({
            data: { state: 'active_owner', storeId: 'test-store-1', storeName: 'My Bookstore' },
            isLoading: false,
        });
        (storeProfileService.getProfile as jest.Mock).mockResolvedValue(MOCK_PROFILE);
        (storeProfileService.updateProfile as jest.Mock).mockResolvedValue(MOCK_PROFILE);
    });

    function renderWithProviders(ui: React.ReactElement) {
        return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
    }

    afterEach(() => {
        queryClient.clear();
    });

    it('shows the store display name and description in the profile section', async () => {
        const { findByText } = renderWithProviders(<StoreProfileScreen />);

        await expect(findByText('My Bookstore')).resolves.toBeTruthy();
        await expect(findByText('A cozy independent bookstore')).resolves.toBeTruthy();
    });

    it('shows the operating hours section', async () => {
        const { findByText, getAllByDisplayValue } = renderWithProviders(<StoreProfileScreen />);

        await expect(findByText('Operating Hours')).resolves.toBeTruthy();
        const dayEntries = getAllByDisplayValue(/^\d{2}:\d{2}$/);
        expect(dayEntries.length).toBeGreaterThan(0);
    });

    it('shows the return policy section', async () => {
        const { findByText } = renderWithProviders(<StoreProfileScreen />);

        await expect(findByText('Return Policy')).resolves.toBeTruthy();
        await expect(findByText(/returns_within_7_days/i)).resolves.toBeTruthy();
    });

    it('shows the fulfillment section with pickup and delivery options', async () => {
        const { findByText } = renderWithProviders(<StoreProfileScreen />);

        await expect(findByText('Fulfillment')).resolves.toBeTruthy();
        await expect(findByText(/pickup/i)).resolves.toBeTruthy();
    });

    it('loads the profile via storeProfileService.getProfile on mount', async () => {
        renderWithProviders(<StoreProfileScreen />);

        await waitFor(() => {
            expect(storeProfileService.getProfile).toHaveBeenCalledWith('test-store-1');
        });
    });

    it('saves profile basics independently', async () => {
        const { findByDisplayValue, getByTestId } = renderWithProviders(<StoreProfileScreen />);

        const nameInput = await findByDisplayValue('My Bookstore');
        fireEvent.changeText(nameInput, 'Updated Books');
        fireEvent.press(getByTestId('save-profile-section'));

        await waitFor(() => {
            expect(storeProfileService.updateProfile).toHaveBeenCalledWith('test-store-1', expect.objectContaining({
                displayName: 'Updated Books',
                description: 'A cozy independent bookstore',
            }));
        });
    });

    it('saves policies with the agreed return policy values', async () => {
        const { findByText, getByTestId } = renderWithProviders(<StoreProfileScreen />);

        await findByText('Return Policy');
        fireEvent.press(getByTestId('policy-no_returns_except_wrong_item'));
        fireEvent.press(getByTestId('save-policies-section'));

        await waitFor(() => {
            expect(storeProfileService.updateProfile).toHaveBeenCalledWith('test-store-1', expect.objectContaining({
                returnPolicyType: 'no_returns_except_wrong_item',
            }));
        });
    });

    it('saves fulfillment settings independently', async () => {
        const { findByText, getByTestId } = renderWithProviders(<StoreProfileScreen />);

        await findByText('Fulfillment');
        fireEvent.press(getByTestId('toggle-delivery'));
        fireEvent.changeText(getByTestId('minimum-delivery-order'), '450');
        fireEvent.press(getByTestId('save-fulfillment-section'));

        await waitFor(() => {
            expect(storeProfileService.updateProfile).toHaveBeenCalledWith('test-store-1', expect.objectContaining({
                deliveryEnabled: true,
                minimumDeliveryOrderValueMinor: 45000,
            }));
        });
    });

    it('blocks access when gate state is not active_owner', async () => {
        (useStoreOwnerGate as jest.Mock).mockReturnValue({
            data: { state: 'consumer_only' },
            isLoading: false,
        });

        const { queryByText } = renderWithProviders(<StoreProfileScreen />);

        await waitFor(() => {
            expect(queryByText('My Bookstore')).toBeNull();
        });
    });

    it('shows a loading indicator while profile is loading', async () => {
        (storeProfileService.getProfile as jest.Mock).mockReturnValue(new Promise(() => {}));

        const { findByText } = renderWithProviders(<StoreProfileScreen />);

        await expect(findByText(/loading/i)).resolves.toBeTruthy();
    });
});
