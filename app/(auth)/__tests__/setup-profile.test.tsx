import { fireEvent, render, waitFor } from '@testing-library/react-native';
import SetupProfileScreen from '../setup-profile';

const mockReplace = jest.fn();
const mockRpc = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('expo-router', () => ({ router: { replace: (...args: unknown[]) => mockReplace(...args) } }));
jest.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            accent: '#84cc16',
            accentLight: '#a3e635',
            bgCard: '#ffffff',
            bgSecondary: '#f8fafc',
            border: '#e5e7eb',
            disabled: '#d1d5db',
            disabledLight: '#e5e7eb',
            error: '#ef4444',
            errorLight: '#f87171',
            textPrimary: '#111827',
            textSecondary: '#4b5563',
            textTertiary: '#9ca3af',
        },
    }),
}));
jest.mock('@/components/ui/GlassCard', () => ({ GlassCard: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('@/components/ui/ScreenBackground', () => ({ ScreenBackground: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));

describe('SetupProfileScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRpc.mockResolvedValue({
            data: { id: 'profile-1', user_id: 'user-1', display_name: 'Reader One', city: 'Mumbai' },
            error: null,
        });
    });

    it('completes setup through the atomic profile setup RPC', async () => {
        const { getByLabelText } = render(<SetupProfileScreen />);

        fireEvent.changeText(getByLabelText('Display name input'), 'Reader One');
        fireEvent.changeText(getByLabelText('City input'), 'Mumbai');
        fireEvent.changeText(getByLabelText('Referral code input'), 'ABCD1234');
        fireEvent.press(getByLabelText('Complete profile setup'));

        await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('complete_profile_setup', {
            p_display_name: 'Reader One',
            p_city: 'Mumbai',
            p_referral_code: 'ABCD1234',
        }));
        expect(mockReplace).toHaveBeenCalledWith('/(tabs)/library');
    });
});
