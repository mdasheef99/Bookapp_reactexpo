import { render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StoreDashboardScreen from '../StoreDashboardScreen';
import { useStoreOwnerGate } from '../../hooks/useStoreOwnerGate';
import { storeDashboardService } from '../../services/storeDashboardService';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
jest.mock('../../hooks/useStoreOwnerGate', () => ({ useStoreOwnerGate: jest.fn() }));
jest.mock('../../services/storeDashboardService', () => ({
    storeDashboardService: { getDashboardData: jest.fn() },
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            accent: '#84cc16',
            bgCard: '#ffffff',
            bgSecondary: '#f8fafc',
            border: '#e5e7eb',
            error: '#b91c1c',
            textPrimary: '#111827',
            textSecondary: '#4b5563',
            textTertiary: '#6b7280',
        },
    }),
}));
jest.mock('@/components/ui/ScreenBackground', () => ({ ScreenBackground: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('@/components/ui/GlassCard', () => ({ GlassCard: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

describe('StoreDashboardScreen', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        jest.clearAllMocks();
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false, gcTime: 0 } },
        });
        (useStoreOwnerGate as jest.Mock).mockReturnValue({
            data: { state: 'active_owner', storeId: 'store-1', storeName: 'Reader Lane Books' },
            isLoading: false,
        });
        (storeDashboardService.getDashboardData as jest.Mock).mockResolvedValue({
            storeId: 'store-1',
            inventoryCounts: { total: 5, published: 3, draft: 1, paused: 1, lowStock: 1, outOfStock: 0 },
            quotaUsage: { inventoryItemLimit: 100, inventoryItemUsed: 5, monthlyImageExtractionLimit: 25, monthlyImageExtractionUsed: 0, activeListingLimit: 100, activeListingUsed: 3 },
            subscriptionStatus: { status: 'trialing', planName: 'Founding Trial', currentPeriodStart: '2026-06-01T00:00:00Z', currentPeriodEnd: '2026-09-01T00:00:00Z' },
            complianceBlockers: [
                { key: 'payout', label: 'Payout account not ready', isBlocked: true },
            ],
        });
    });

    afterEach(() => {
        queryClient.clear();
    });

    function renderWithProviders(ui: React.ReactElement) {
        return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
    }

    it('shows inventory health card with counts', async () => {
        const { getByText } = renderWithProviders(<StoreDashboardScreen />);

        await waitFor(() => expect(getByText('Inventory Health')).toBeTruthy());
        expect(getByText('5')).toBeTruthy();
    });

    it('shows quota usage card with limits', async () => {
        const { getByText } = renderWithProviders(<StoreDashboardScreen />);

        await waitFor(() => expect(getByText('Quota Usage')).toBeTruthy());
        expect(getByText('5/100')).toBeTruthy();
        expect(getByText('0/25')).toBeTruthy();
        expect(getByText('3/100')).toBeTruthy();
    });

    it('shows subscription status card', async () => {
        const { getByText } = renderWithProviders(<StoreDashboardScreen />);

        await waitFor(() => expect(getByText('Subscription')).toBeTruthy());
        expect(getByText('Founding Trial')).toBeTruthy();
    });

    it('shows placeholder for pending order requests', async () => {
        const { getByText } = renderWithProviders(<StoreDashboardScreen />);

        await waitFor(() => expect(getByText('Order Requests')).toBeTruthy());
    });

    it('shows compliance blockers', async () => {
        const { getByText } = renderWithProviders(<StoreDashboardScreen />);

        await waitFor(() => expect(getByText('Compliance')).toBeTruthy());
        expect(getByText('Payout account not ready')).toBeTruthy();
    });

    it('blocks access for non-active owner states', () => {
        (useStoreOwnerGate as jest.Mock).mockReturnValue({
            data: { state: 'approved_pending_setup', storeId: 'store-1', storeName: 'Reader Lane Books' },
            isLoading: false,
        });

        const { getByText, queryByText } = renderWithProviders(<StoreDashboardScreen />);

        expect(getByText('Complete store setup to access the console.')).toBeTruthy();
        expect(queryByText('Inventory Health')).toBeNull();
    });
});
