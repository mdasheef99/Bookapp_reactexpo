import { fireEvent, render, waitFor } from '@testing-library/react-native';
import StoreOwnerGateScreen from '../StoreOwnerGateScreen';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useStoreOwnerGate } from '../../hooks/useStoreOwnerGate';
import { storeOwnerService } from '../../services/storeOwnerService';

const mockReplace = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({ router: { replace: (...args: unknown[]) => mockReplace(...args) } }));
jest.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('../../hooks/useStoreOwnerGate', () => ({ useStoreOwnerGate: jest.fn() }));
jest.mock('../../services/storeOwnerService', () => ({
    storeOwnerService: {
        startOrResumeApplication: jest.fn(),
    },
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            accent: '#84cc16',
            bgSecondary: '#f8fafc',
            border: '#e5e7eb',
            textPrimary: '#111827',
            textSecondary: '#4b5563',
        },
    }),
}));
jest.mock('@/components/ui/GlassCard', () => ({ GlassCard: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('@/components/ui/ScreenBackground', () => ({ ScreenBackground: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

function mockGate(data: unknown) {
    (useStoreOwnerGate as jest.Mock).mockReturnValue({ data, isLoading: false, error: null });
}

describe('StoreOwnerGateScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (useAuth as jest.Mock).mockReturnValue({ user: { id: 'user-1' } });
        (storeOwnerService.startOrResumeApplication as jest.Mock).mockResolvedValue({
            storeId: 'store-1',
            requestId: 'request-1',
        });
    });

    it('routes unauthenticated users to Store Owner login intent', async () => {
        (useAuth as jest.Mock).mockReturnValue({ user: null });
        mockGate({ state: 'unauthenticated' });

        render(<StoreOwnerGateScreen />);

        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({
            pathname: '/(auth)/login',
            params: { intent: 'store_owner' },
        }));
    });

    it('starts a server-owned application before routing consumer-only users to onboarding', async () => {
        mockGate({ state: 'consumer_only' });

        const { getByText } = render(<StoreOwnerGateScreen />);

        expect(getByText('Apply as a bookstore')).toBeOnTheScreen();
        fireEvent.press(getByText('Start application'));
        await waitFor(() => expect(storeOwnerService.startOrResumeApplication).toHaveBeenCalledTimes(1));
        expect(mockReplace).toHaveBeenCalledWith('/(store-owner)/onboarding');
    });

    it('routes draft applications to onboarding', async () => {
        mockGate({ state: 'application_draft', storeId: 'store-1', requestId: 'request-1' });

        render(<StoreOwnerGateScreen />);

        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(store-owner)/onboarding'));
    });

    it('routes submitted applications to status', async () => {
        mockGate({ state: 'pending_verification', storeId: 'store-1', requestId: 'request-1' });

        render(<StoreOwnerGateScreen />);

        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(store-owner)/status'));
    });

    it('routes approved pending setup stores to setup', async () => {
        mockGate({ state: 'approved_pending_setup', storeId: 'store-1', storeName: 'Reader Lane Books' });

        render(<StoreOwnerGateScreen />);

        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(store-owner)/setup'));
    });

    it('routes active owner to dashboard', async () => {
        mockGate({ state: 'active_owner', storeId: 'store-1', storeName: 'Reader Lane Books' });

        render(<StoreOwnerGateScreen />);

        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(store-owner)/dashboard'));
    });
});
