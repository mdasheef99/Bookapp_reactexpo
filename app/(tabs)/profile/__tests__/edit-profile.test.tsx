import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import EditProfileScreen from '../edit';
import { profileService } from '@/features/auth/services/profileService';

const mockBack = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('expo-image');
jest.mock('expo-image-picker', () => ({
    requestMediaLibraryPermissionsAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
    MediaTypeOptions: { Images: 'Images' },
}));
jest.mock('expo-router', () => ({ router: { back: (...args: unknown[]) => mockBack(...args) } }));
jest.mock('@/features/auth/hooks/useAuth', () => ({
    useAuth: () => ({ session: { user: { id: 'reader-1' } } }),
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
jest.mock('@/features/auth/services/profileService', () => ({
    profileService: {
        getProfile: jest.fn(),
        updateProfile: jest.fn(),
        uploadAvatar: jest.fn(),
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
                <EditProfileScreen />
            </QueryClientProvider>
        ),
    };
}

describe('EditProfileScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (profileService.getProfile as jest.Mock).mockResolvedValue({
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
            membership_tier: 'pro',
            trust_score: 4.5,
            created_at: '2026-05-10T10:00:00.000Z',
            updated_at: '2026-05-10T10:00:00.000Z',
        });
        (profileService.updateProfile as jest.Mock).mockResolvedValue({
            id: 'profile-1',
            user_id: 'reader-1',
            display_name: 'Priya S',
            username: 'priya_s',
            city: 'Delhi',
            avatar_url: null,
        });
    });

    it('loads existing fields and saves editable profile details', async () => {
        const { getByDisplayValue, getByTestId, getByText, queryClient, unmount } = renderWithQueryClient();

        await waitFor(() => expect(getByTestId('edit-profile-display-name')).toBeOnTheScreen());
        await waitFor(() => expect(profileService.getProfile).toHaveBeenCalledWith('reader-1'));
        await waitFor(() => expect(getByDisplayValue('Priya Sharma')).toBeOnTheScreen());

        fireEvent.changeText(getByTestId('edit-profile-display-name'), 'Priya S');
        fireEvent.changeText(getByTestId('edit-profile-username'), 'Priya S');
        fireEvent.changeText(getByTestId('edit-profile-city'), 'Delhi');
        fireEvent.press(getByText('Save Changes'));

        await waitFor(() => expect(profileService.updateProfile).toHaveBeenCalledWith('reader-1', {
            display_name: 'Priya S',
            username: 'Priya S',
            city: 'Delhi',
        }));
        expect(mockBack).toHaveBeenCalled();

        unmount();
        queryClient.clear();
    });

    it('picks an avatar and uploads it for the current user', async () => {
        const ImagePicker = jest.requireMock('expo-image-picker');
        ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' });
        ImagePicker.launchImageLibraryAsync.mockResolvedValue({
            canceled: false,
            assets: [{ uri: 'file:///avatar.png' }],
        });
        (profileService.uploadAvatar as jest.Mock).mockResolvedValue('https://cdn.example/avatar.png');
        const { getByText, queryClient, unmount } = renderWithQueryClient();

        await waitFor(() => expect(getByText('Change Photo')).toBeOnTheScreen());
        fireEvent.press(getByText('Change Photo'));

        await waitFor(() => expect(profileService.uploadAvatar).toHaveBeenCalledWith('reader-1', 'file:///avatar.png'));

        unmount();
        queryClient.clear();
    });
});
