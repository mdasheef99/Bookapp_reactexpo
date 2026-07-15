import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import StoreSetupChecklistScreen from '../StoreSetupChecklistScreen';
import { useStoreOwnerGate } from '../../hooks/useStoreOwnerGate';
import { storeOwnerService } from '../../services/storeOwnerService';
import { storeProfileService } from '../../services/storeProfileService';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
jest.mock('../../hooks/useStoreOwnerGate', () => ({ useStoreOwnerGate: jest.fn() }));
jest.mock('../../services/storeOwnerService', () => ({
    storeOwnerService: {
        getSetupChecklist: jest.fn(),
    },
}));
jest.mock('../../services/storeProfileService', () => ({
    storeProfileService: { completeSetup: jest.fn() },
}));
jest.mock('expo-router', () => ({
    router: { push: jest.fn(), replace: jest.fn() },
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            accent: '#84cc16',
            bgSecondary: '#f8fafc',
            border: '#e5e7eb',
            error: '#b91c1c',
            success: '#15803d',
            textPrimary: '#111827',
            textSecondary: '#4b5563',
            warning: '#b45309',
        },
    }),
}));
jest.mock('@/components/ui/ScreenBackground', () => ({ ScreenBackground: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('@/components/ui/GlassCard', () => ({ GlassCard: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

const baseSetup = {
    storeId: 'store-1',
    storeName: 'Reader Lane Books',
    storeStatus: 'approved_pending_setup' as const,
    verificationStatus: 'approved' as const,
    setupStatus: 'incomplete' as const,
    sellingStatus: 'not_allowed' as const,
    payoutAccountStatus: 'not_started',
    subscriptionStatus: 'trialing' as const,
    checklist: [
        { key: 'verification', label: 'Verification approved', isComplete: true },
        { key: 'profile', label: 'Public profile basics', isComplete: true },
        { key: 'hours', label: 'Operating hours', isComplete: false },
    ],
};

describe('StoreSetupChecklistScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (useStoreOwnerGate as jest.Mock).mockReturnValue({
            data: { state: 'approved_pending_setup', storeId: 'store-1', storeName: 'Reader Lane Books' },
            isLoading: false,
        });
        (storeOwnerService.getSetupChecklist as jest.Mock).mockResolvedValue(baseSetup);
        (storeProfileService.completeSetup as jest.Mock).mockResolvedValue(undefined);
    });

    it('shows approved pending setup without selling enabled', async () => {
        const screen = render(<StoreSetupChecklistScreen />);

        await waitFor(() => expect(storeOwnerService.getSetupChecklist).toHaveBeenCalledWith('store-1'));
        await waitFor(() => expect(screen.getByText('Setup required before selling')).toBeTruthy());
        expect(screen.getByText('Selling status: Not allowed')).toBeTruthy();
        expect(screen.queryByText('Selling enabled')).toBeNull();
    });

    it('shows suspended and restricted states as blocked', async () => {
        (useStoreOwnerGate as jest.Mock).mockReturnValue({
            data: { state: 'suspended', storeId: 'store-1', storeName: 'Reader Lane Books', reason: 'Policy review' },
            isLoading: false,
        });
        (storeOwnerService.getSetupChecklist as jest.Mock).mockResolvedValue({
            ...baseSetup,
            storeStatus: 'suspended',
            sellingStatus: 'restricted',
        });

        const screen = render(<StoreSetupChecklistScreen />);

        await waitFor(() => expect(screen.getByText('Store access blocked')).toBeTruthy());
        expect(screen.getByText('Selling status: Restricted')).toBeTruthy();
    });

    it('shows subscription status without platform-wide subscription controls', async () => {
        const screen = render(<StoreSetupChecklistScreen />);

        await waitFor(() => expect(screen.getByText('Subscription: Trialing')).toBeTruthy());
        expect(screen.queryByText('Manage platform subscriptions')).toBeNull();
        expect(screen.queryByText('Create plan')).toBeNull();
    });

    it('links approved owners to setup settings and completes setup through the controlled boundary', async () => {
        const readySetup = {
            ...baseSetup,
            payoutAccountStatus: 'verified',
            checklist: baseSetup.checklist.map((item) => ({ ...item, isComplete: true })),
        };
        (storeOwnerService.getSetupChecklist as jest.Mock).mockResolvedValue(readySetup);
        const screen = render(<StoreSetupChecklistScreen />);

        await waitFor(() => expect(screen.getByText('Edit store settings')).toBeTruthy());
        fireEvent.press(screen.getByText('Edit store settings'));
        expect(router.push).toHaveBeenCalledWith('/(store-owner)/storefront');

        fireEvent.press(screen.getByText('Complete setup'));
        await waitFor(() => expect(storeProfileService.completeSetup).toHaveBeenCalledWith('store-1'));
        expect(router.replace).toHaveBeenCalledWith('/(store-owner)/dashboard');
    });
});
