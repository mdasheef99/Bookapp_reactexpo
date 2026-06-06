import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import NotificationSettingsScreen from '../notification-settings';

const mockReplace = jest.fn();
const mockMutate = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('expo-router', () => ({
    router: {
        replace: (...args: unknown[]) => mockReplace(...args),
    },
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({
    useAuth: () => ({ session: { user: { id: 'reader-1' } } }),
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
});
