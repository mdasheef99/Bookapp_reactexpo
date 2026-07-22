import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import SettingsScreen from '../settings';

const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSignOut = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('expo-router', () => ({
    router: {
        back: (...args: unknown[]) => mockBack(...args),
        canGoBack: (...args: unknown[]) => mockCanGoBack(...args),
        push: (...args: unknown[]) => mockPush(...args),
        replace: (...args: unknown[]) => mockReplace(...args),
    },
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({
    useAuth: () => ({
        signOut: mockSignOut,
        session: { user: { id: 'reader-1', phone: '+919876543210' } },
    }),
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        phase: 'daylight',
        colors: {
            bgPrimary: '#FFFFFF',
            bgCard: '#F8FAFC',
            bgSecondary: '#EEF2FF',
            border: '#CBD5E1',
            accent: '#4F46E5',
            accentLight: '#818CF8',
            error: '#EF4444',
            errorLight: '#F87171',
            disabled: '#E0E0E0',
            disabledLight: '#CCCCCC',
            textPrimary: '#0F172A',
            textSecondary: '#475569',
            textTertiary: '#94A3B8',
        },
    }),
}));

describe('SettingsScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCanGoBack.mockReturnValue(false);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('renders account settings without theme controls and signs out', () => {
        const { getByText, queryByText } = render(<SettingsScreen />);

        expect(getByText('Settings')).toBeOnTheScreen();
        expect(getByText('+919876543210')).toBeOnTheScreen();
        expect(getByText('Notifications')).toBeOnTheScreen();
        expect(getByText('Notification preferences')).toBeOnTheScreen();
        expect(queryByText('Theme')).toBeNull();

        fireEvent.press(getByText('Sign Out'));

        expect(mockSignOut).toHaveBeenCalled();
    });

    it('falls back to Profile when the header back button has no local history', () => {
        const { getByLabelText } = render(<SettingsScreen />);

        fireEvent.press(getByLabelText('Go back'));

        expect(mockReplace).toHaveBeenCalledWith('/(tabs)/profile');
        expect(mockBack).not.toHaveBeenCalled();
    });

    it('opens notification history and preferences from account settings', () => {
        const { getByText } = render(<SettingsScreen />);

        fireEvent.press(getByText('Notifications'));
        fireEvent.press(getByText('Notification preferences'));

        expect(mockPush).toHaveBeenNthCalledWith(1, '/(tabs)/profile/notifications');
        expect(mockPush).toHaveBeenNthCalledWith(2, '/(tabs)/profile/notification-settings');
    });

    it('handles a rejected logout without exposing internal error details', async () => {
        const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
        mockSignOut.mockRejectedValueOnce(new Error('sensitive storage detail'));
        const { getByText } = render(<SettingsScreen />);

        fireEvent.press(getByText('Sign Out'));

        await waitFor(() => expect(alert).toHaveBeenCalledWith(
            'Sign out incomplete',
            'Please try again to finish removing this session from your device.',
        ));
    });
});
