import { render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SubscriptionStatusScreen from '../SubscriptionStatusScreen';
import { useStoreOwnerGate } from '../../hooks/useStoreOwnerGate';
import { storeSubscriptionService } from '../../services/storeSubscriptionService';

jest.mock('@/lib/supabase');

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

jest.mock('@/features/auth/hooks/useAuth', () => ({
    useAuth: jest.fn(() => ({ user: { id: 'test-user-1' } })),
}));

jest.mock('../../hooks/useStoreOwnerGate', () => ({ useStoreOwnerGate: jest.fn() }));

jest.mock('../../services/storeSubscriptionService', () => ({
    storeSubscriptionService: { getSubscriptionStatus: jest.fn() },
}));

jest.mock('@/hooks/useTheme', () => ({
    useTheme: jest.fn(() => ({
        colors: {
            accent: '#6366F1',
            bgPrimary: '#F8FAFC',
            bgSecondary: '#F1F5F9',
            bgCard: '#FFFFFF',
            border: '#E2E8F0',
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

const MOCK_SUBSCRIPTION_STATUS = {
    storeId: 'test-store-1',
    status: 'active',
    planName: 'Founding Store',
    currentPeriodStart: '2026-06-01T00:00:00Z',
    currentPeriodEnd: '2026-07-01T00:00:00Z',
    entitlements: [
        { featureKey: 'inventory_item_limit', limitValue: 100, isEnabled: true, usedValue: 12 },
        { featureKey: 'monthly_image_extraction_limit', limitValue: 25, isEnabled: true, usedValue: 5 },
        { featureKey: 'active_listing_limit', limitValue: 50, isEnabled: true, usedValue: 3 },
    ],
};

describe('SubscriptionStatusScreen', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        jest.clearAllMocks();
        queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
        (useStoreOwnerGate as jest.Mock).mockReturnValue({
            data: { state: 'active_owner', storeId: 'test-store-1', storeName: 'My Bookstore' },
            isLoading: false,
        });
        (storeSubscriptionService.getSubscriptionStatus as jest.Mock).mockResolvedValue(MOCK_SUBSCRIPTION_STATUS);
    });

    function renderWithProviders(ui: React.ReactElement) {
        return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
    }

    afterEach(() => {
        queryClient.clear();
    });

    it('shows the plan name', async () => {
        const { getByText } = renderWithProviders(<SubscriptionStatusScreen />);

        await waitFor(() => {
            expect(getByText('Founding Store')).toBeTruthy();
        });
    });

    it('shows the subscription status badge', async () => {
        const { findByText } = renderWithProviders(<SubscriptionStatusScreen />);

        // Screen renders status in a badge; use exact text to avoid matching "Active Listing Limit"
        await expect(findByText('active')).resolves.toBeTruthy();
    });

    it('shows current period dates', async () => {
        const { findByText } = renderWithProviders(<SubscriptionStatusScreen />);

        // Screen uses toLocaleDateString() which produces numeric format like "6/1/2026"
        await expect(findByText(/2026/)).resolves.toBeTruthy();
    });

    it('shows entitlements with usage', async () => {
        const { findByText } = renderWithProviders(<SubscriptionStatusScreen />);

        // Screen formats feature keys via formatFeatureKey() → "Inventory Item Limit"
        await expect(findByText(/Inventory Item Limit/i)).resolves.toBeTruthy();
        await expect(findByText(/Active Listing Limit/i)).resolves.toBeTruthy();
    });

    it('shows usage values for entitlements', async () => {
        const { findByText } = renderWithProviders(<SubscriptionStatusScreen />);

        await expect(findByText(/12/)).resolves.toBeTruthy();
        await expect(findByText(/100/)).resolves.toBeTruthy();
    });

    it('calls storeSubscriptionService.getSubscriptionStatus on mount', async () => {
        renderWithProviders(<SubscriptionStatusScreen />);

        await waitFor(() => {
            expect(storeSubscriptionService.getSubscriptionStatus).toHaveBeenCalledWith('test-store-1');
        });
    });

    it('blocks access when gate state is not active_owner', async () => {
        (useStoreOwnerGate as jest.Mock).mockReturnValue({
            data: { state: 'consumer_only' },
            isLoading: false,
        });

        const { queryByText } = renderWithProviders(<SubscriptionStatusScreen />);

        await waitFor(() => {
            expect(queryByText('Founding Store')).toBeNull();
        });
    });

    it('shows loading state while fetching', async () => {
        (storeSubscriptionService.getSubscriptionStatus as jest.Mock).mockReturnValue(new Promise(() => {}));

        const { findByText } = renderWithProviders(<SubscriptionStatusScreen />);

        await expect(findByText(/loading/i)).resolves.toBeTruthy();
    });

    it('shows grace message when subscription is not_started', async () => {
        (storeSubscriptionService.getSubscriptionStatus as jest.Mock).mockResolvedValue({
            storeId: 'test-store-1',
            status: 'not_started',
            planName: null,
            currentPeriodStart: null,
            currentPeriodEnd: null,
            entitlements: [],
        });

        const { findByText } = renderWithProviders(<SubscriptionStatusScreen />);

        await expect(findByText(/not.*started|trial|setup|pending/i)).resolves.toBeTruthy();
    });
});
