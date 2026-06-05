import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ProfileScreen from '../index';
import { creditService } from '@/features/credits/services/creditService';
import { profileService } from '@/features/auth/services/profileService';

const mockPush = jest.fn();
const mockSignOut = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('expo-image');
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
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
jest.mock('@/features/credits/services/creditService', () => ({
    creditService: {
        getCreditBalance: jest.fn(),
    },
}));
jest.mock('@/features/auth/services/profileService', () => ({
    profileService: {
        getProfile: jest.fn(),
    },
}));

function renderWithQueryClient() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: Infinity },
            mutations: { retry: false, gcTime: Infinity },
        },
    });

    return {
        queryClient,
        ...render(
            <QueryClientProvider client={queryClient}>
                <ProfileScreen />
            </QueryClientProvider>
        ),
    };
}

describe('ProfileScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (profileService.getProfile as jest.Mock).mockResolvedValue({
            id: 'profile-1',
            user_id: 'reader-1',
            display_name: 'Priya Sharma',
            username: 'priya_reads',
            avatar_url: 'https://example.com/avatar.png',
            city: 'Mumbai',
            email: null,
            referral_code: 'PRIY1234',
            account_type: 'user',
            is_verified_author: false,
            membership_tier: 'pro_plus',
            trust_score: 4.75,
            created_at: '2026-05-10T10:00:00.000Z',
            updated_at: '2026-05-10T10:00:00.000Z',
        });
        (creditService.getCreditBalance as jest.Mock).mockResolvedValue({
            user_id: 'reader-1',
            available: 3,
            held: 1,
            lifetime_earned: 8,
            lifetime_spent: 4,
            updated_at: '2026-05-10T10:00:00.000Z',
        });
    });

    it('renders live profile identity, tier, trust score, and avatar image', async () => {
        const { getByText, getByTestId, queryClient, unmount } = renderWithQueryClient();

        await waitFor(() => expect(getByText('Priya Sharma')).toBeOnTheScreen());

        expect(profileService.getProfile).toHaveBeenCalledWith('reader-1');
        expect(getByText('@priya_reads')).toBeOnTheScreen();
        expect(getByText('Mumbai')).toBeOnTheScreen();
        expect(getByText('Pro+')).toBeOnTheScreen();
        expect(getByText('Trust 4.8')).toBeOnTheScreen();
        expect(getByTestId('profile-avatar-image')).toBeOnTheScreen();

        unmount();
        queryClient.clear();
    });

    it('navigates to settings from the account menu', async () => {
        const { getByText, queryClient, unmount } = renderWithQueryClient();

        await waitFor(() => expect(getByText('Priya Sharma')).toBeOnTheScreen());

        fireEvent.press(getByText('Settings'));

        expect(mockPush).toHaveBeenCalledWith('/(tabs)/profile/settings');

        unmount();
        queryClient.clear();
    });

    it('opens the create club route from the account menu', async () => {
        const { getByText, queryClient, unmount } = renderWithQueryClient();

        await waitFor(() => expect(getByText('Priya Sharma')).toBeOnTheScreen());

        fireEvent.press(getByText('Create Club'));

        expect(mockPush).toHaveBeenCalledWith('/(tabs)/clubs/create');

        unmount();
        queryClient.clear();
    });

    it('hides the create club route for free members', async () => {
        (profileService.getProfile as jest.Mock).mockResolvedValueOnce({
            id: 'profile-1',
            user_id: 'reader-1',
            display_name: 'Priya Sharma',
            username: 'priya_reads',
            avatar_url: null,
            city: 'Mumbai',
            email: null,
            referral_code: 'PRIY1234',
            account_type: 'user',
            is_verified_author: false,
            membership_tier: 'free',
            trust_score: 4.75,
            created_at: '2026-05-10T10:00:00.000Z',
            updated_at: '2026-05-10T10:00:00.000Z',
        });
        const { getByText, queryByText, queryClient, unmount } = renderWithQueryClient();

        await waitFor(() => expect(getByText('Priya Sharma')).toBeOnTheScreen());

        expect(queryByText('Create Club')).toBeNull();

        unmount();
        queryClient.clear();
    });

    it('opens the edit profile route from the profile header', async () => {
        const { getByText, queryClient, unmount } = renderWithQueryClient();

        await waitFor(() => expect(getByText('Priya Sharma')).toBeOnTheScreen());

        fireEvent.press(getByText('Edit Profile'));

        expect(mockPush).toHaveBeenCalledWith('/(tabs)/profile/edit');

        unmount();
        queryClient.clear();
    });

    it('opens the profile addresses route from the account menu', async () => {
        const { getByText, queryClient, unmount } = renderWithQueryClient();

        await waitFor(() => expect(getByText('Priya Sharma')).toBeOnTheScreen());

        fireEvent.press(getByText('Addresses'));

        expect(mockPush).toHaveBeenCalledWith('/(tabs)/profile/addresses');

        unmount();
        queryClient.clear();
    });
});
