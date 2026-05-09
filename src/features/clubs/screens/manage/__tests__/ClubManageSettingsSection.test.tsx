import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ClubManageSettingsSection } from '../ClubManageSettingsSection';

const colors = {
    bgPrimary: '#FFFFFF',
    bgCard: '#F8F8F8',
    bgSecondary: '#F0F0F0',
    textPrimary: '#1A1A1A',
    textSecondary: '#666666',
    textTertiary: '#999999',
    accent: '#007AFF',
    accentLight: '#E5F1FF',
    border: '#E5E5E5',
    error: '#EF4444',
    errorLight: '#FEE2E2',
};

jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ colors }),
}));

jest.mock('expo-image', () => ({
    Image: 'Image',
}));

jest.mock('expo-image-picker', () => ({
    requestMediaLibraryPermissionsAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
    MediaType: { Images: 'Images' },
}));

jest.mock('@/lib/supabase', () => ({
    supabase: {
        storage: {
            from: jest.fn((bucket: string) => ({
                upload: jest.fn().mockResolvedValue({ error: null }),
                getPublicUrl: jest.fn().mockReturnValue({
                    data: { publicUrl: `https://cdn.example.com/${bucket}/new-cover.jpg` },
                }),
            })),
        },
    },
}));

const mockClub = {
    id: 'club-1',
    name: 'Test Club',
    slug: 'test-club',
    description: 'A test club',
    cover_url: 'https://images.example.com/founders.png',
    visibility: 'public',
    access_level: 'pro_plus',
    max_members: 100,
    member_count: 12,
    club_type: 'book',
    meeting_type: 'virtual',
    current_book_id: null,
    current_book_title: null,
    current_book_cover_url: null,
    current_book_authors: null,
} as any;

const baseSettings = {
    name: 'Test Club',
    slug: 'test-club',
    description: 'A test club',
    coverUrl: 'https://images.example.com/founders.png',
    clubType: 'book' as const,
    meetingType: 'virtual' as const,
    accessLevel: 'pro_plus' as const,
    maxMembers: '100',
};

describe('ClubManageSettingsSection', () => {
    const mockOnSave = jest.fn().mockResolvedValue(undefined);
    const mockOnReset = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders cover image preview when coverUrl is set', () => {
        const { getByTestId } = render(
            <ClubManageSettingsSection
                club={mockClub}
                settings={baseSettings}
                setSettings={jest.fn()}
                isSaving={false}
                onSave={mockOnSave}
                onReset={mockOnReset}
            />
        );

        expect(getByTestId('settings-cover-preview')).toBeOnTheScreen();
        expect(getByTestId('settings-pick-cover')).toBeOnTheScreen();
    });

    it('shows "Select cover image" button without preview when coverUrl is empty', () => {
        const settings = { ...baseSettings, coverUrl: '' };
        const { getByTestId, queryByTestId } = render(
            <ClubManageSettingsSection
                club={mockClub}
                settings={settings}
                setSettings={jest.fn()}
                isSaving={false}
                onSave={mockOnSave}
                onReset={mockOnReset}
            />
        );

        expect(queryByTestId('settings-cover-preview')).toBeNull();
        expect(getByTestId('settings-pick-cover')).toBeOnTheScreen();
    });

    it('launches image picker when the pick-cover button is pressed', async () => {
        const mockImagePicker = jest.requireMock('expo-image-picker');
        mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' });
        mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
            canceled: false,
            assets: [{ uri: 'file://test-photo.jpg' }],
        });

        const { getByTestId } = render(
            <ClubManageSettingsSection
                club={mockClub}
                settings={{ ...baseSettings, coverUrl: '' }}
                setSettings={jest.fn()}
                isSaving={false}
                onSave={mockOnSave}
                onReset={mockOnReset}
            />
        );

        fireEvent.press(getByTestId('settings-pick-cover'));

        await waitFor(() => expect(mockImagePicker.launchImageLibraryAsync).toHaveBeenCalled());
    });

    it('shows an error banner when image picker permission is denied', async () => {
        const mockImagePicker = jest.requireMock('expo-image-picker');
        mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'denied' });

        const { getByTestId, getByText } = render(
            <ClubManageSettingsSection
                club={mockClub}
                settings={baseSettings}
                setSettings={jest.fn()}
                isSaving={false}
                onSave={mockOnSave}
                onReset={mockOnReset}
            />
        );

        fireEvent.press(getByTestId('settings-pick-cover'));

        await waitFor(() => expect(getByText(/Permission denied/)).toBeOnTheScreen());
    });

    it('allows manual URL entry as fallback', () => {
        const setSettings = jest.fn();
        const { getByTestId } = render(
            <ClubManageSettingsSection
                club={mockClub}
                settings={baseSettings}
                setSettings={setSettings}
                isSaving={false}
                onSave={mockOnSave}
                onReset={mockOnReset}
            />
        );

        fireEvent.changeText(getByTestId('settings-cover-url-input'), 'https://manual.example.com/cover.png');
        expect(getByTestId('settings-cover-url-input')).toBeOnTheScreen();
    });
});
