import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import NotificationSettingsScreen from '../notification-settings';

const mockReplace = jest.fn();
let mockSearchParams: { clubOrigin?: string; returnTo?: string; settingsOrigin?: string } = {};
const mockMutate = jest.fn();
let mockSession: { user: { id: string } } | null = { user: { id: 'reader-1' } };

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('expo-router', () => ({
    useLocalSearchParams: () => mockSearchParams,
    router: {
        replace: (...args: unknown[]) => mockReplace(...args),
    },
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({
    useAuth: () => ({ session: mockSession }),
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            bgPrimary: '#FFFFFF',
            bgCard: '#F8FAFC',
            bgSecondary: '#EEF2FF',
            border: '#CBD5E1',
            accent: '#4F46E5',
            textPrimary: '#0F172A',
            textSecondary: '#475569',
            textTertiary: '#94A3B8',
        },
    }),
}));
jest.mock('@/features/notifications/hooks/useNotifications', () => ({
    useNotificationPreferences: () => ({
        data: [
            { id: 'pref-1', user_id: 'reader-1', preference_key: 'clubs', channel: 'push', enabled: true },
        ],
        isLoading: false,
    }),
    useUpsertNotificationPreference: () => ({ mutate: mockMutate }),
}));

describe('NotificationSettingsScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSearchParams = {};
        mockSession = { user: { id: 'reader-1' } };
    });

    it('shows critical preferences as always on and lets users toggle optional push settings', () => {
        const { getAllByText, getByLabelText, getByText } = render(<NotificationSettingsScreen />);

        expect(getByText('Exchange updates')).toBeOnTheScreen();
        expect(getAllByText('Always on')).toHaveLength(2);
        expect(getByText('Club activity')).toBeOnTheScreen();

        fireEvent(getByLabelText('Disable push notifications for Club activity'), 'valueChange', false);

        expect(mockMutate).toHaveBeenCalledWith({
            user_id: 'reader-1',
            preference_key: 'clubs',
            channel: 'push',
            enabled: false,
        });
    });

    it('explains why preferences cannot be changed without a signed-in user', () => {
        mockSession = null;

        const { getByLabelText, getByText } = render(<NotificationSettingsScreen />);

        expect(getByText('Sign in required')).toBeOnTheScreen();
        expect(getByText(/Notification preferences are saved to your account/i)).toBeOnTheScreen();

        fireEvent(getByLabelText('Disable push notifications for Club activity'), 'valueChange', false);

        expect(mockMutate).not.toHaveBeenCalled();
    });
    it('returns to Settings with the invitations origin preserved', () => {
        mockSearchParams = { returnTo: 'settings', settingsOrigin: 'club-invitations' };
        const { getByLabelText } = render(<NotificationSettingsScreen />);
        fireEvent.press(getByLabelText('Go back'));
        expect(mockReplace).toHaveBeenCalledWith('/(tabs)/profile/settings?returnTo=club-invitations');
    });

    it.each(['my-clubs', 'archived'])('keeps %s on returning to Settings', (clubOrigin) => {
        mockSearchParams = { returnTo: 'settings', settingsOrigin: 'club-invitations', clubOrigin };
        const screen = render(<NotificationSettingsScreen />);
        fireEvent.press(screen.getByLabelText('Go back'));
        expect(mockReplace).toHaveBeenCalledWith(`/(tabs)/profile/settings?returnTo=club-invitations&clubOrigin=${clubOrigin}`);
    });

});
