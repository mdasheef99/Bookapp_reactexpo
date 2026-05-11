import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import SettingsScreen from '../settings';

const mockBack = jest.fn();
const mockSignOut = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('expo-router', () => ({ router: { back: (...args: unknown[]) => mockBack(...args) } }));
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
    });

    it('renders account settings without theme controls and signs out', () => {
        const { getByText, queryByText } = render(<SettingsScreen />);

        expect(getByText('Settings')).toBeOnTheScreen();
        expect(getByText('+919876543210')).toBeOnTheScreen();
        expect(getByText('Notification preferences')).toBeOnTheScreen();
        expect(queryByText('Theme')).toBeNull();

        fireEvent.press(getByText('Sign Out'));

        expect(mockSignOut).toHaveBeenCalled();
    });
});
