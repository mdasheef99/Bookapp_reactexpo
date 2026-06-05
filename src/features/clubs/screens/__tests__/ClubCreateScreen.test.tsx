import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ClubCreateScreen from '../ClubCreateScreen';

const mockRouterBack = jest.fn();
const mockRouterReplace = jest.fn();
const mockRouterCanGoBack = jest.fn();
const mockUseAuth = jest.fn();
const mockUseCreateClub = jest.fn();
const mockGetProfile = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({
    router: {
        back: (...args: unknown[]) => mockRouterBack(...args),
        replace: (...args: unknown[]) => mockRouterReplace(...args),
        canGoBack: (...args: unknown[]) => mockRouterCanGoBack(...args),
    },
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            bgPrimary: '#FFFFFF',
            bgCard: '#F8FAFC',
            bgSecondary: '#EEF2FF',
            border: '#CBD5E1',
            accent: '#4F46E5',
            accentLight: '#818CF8',
            textPrimary: '#0F172A',
            textSecondary: '#475569',
            textTertiary: '#94A3B8',
            error: '#EF4444',
            errorLight: '#FEE2E2',
        },
    }),
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }));
jest.mock('@/features/clubs/hooks/useClubs', () => ({ useCreateClub: () => mockUseCreateClub() }));
jest.mock('@/features/auth/services/profileService', () => ({
    profileService: { getProfile: (...args: unknown[]) => mockGetProfile(...args) },
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockRouterCanGoBack.mockReturnValue(false);
    mockUseAuth.mockReturnValue({ user: { id: 'reader-1' } });
    mockUseCreateClub.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'club-created' }), isPending: false });
    mockGetProfile.mockResolvedValue({ id: 'profile-reader-1', user_id: 'reader-1', is_verified_author: false });
});

describe('ClubCreateScreen', () => {
    it('creates a public club and navigates to the new detail screen', async () => {
        const mutateAsync = jest.fn().mockResolvedValue({ id: 'club-created' });
        mockUseCreateClub.mockReturnValue({ mutateAsync, isPending: false });

        const { getByTestId } = render(<ClubCreateScreen />);
        await waitFor(() => expect(mockGetProfile).toHaveBeenCalledWith('reader-1'));

        fireEvent.changeText(getByTestId('create-club-name'), 'Weekend Readers');
        fireEvent.changeText(getByTestId('create-club-description'), 'Slow reads and lively discussion.');
        fireEvent.changeText(getByTestId('create-club-max-members'), '24');
        fireEvent.press(getByTestId('create-club-type-approval'));
        fireEvent.press(getByTestId('create-club-access-pro'));
        fireEvent.press(getByTestId('create-club-meeting-hybrid'));
        fireEvent.press(getByTestId('create-club-submit'));

        await waitFor(() => {
            expect(mutateAsync).toHaveBeenCalledWith({
                name: 'Weekend Readers',
                description: 'Slow reads and lively discussion.',
                cover_url: undefined,
                club_type: 'approval',
                access_level: 'pro',
                meeting_type: 'hybrid',
                admin_id: 'reader-1',
                max_members: 24,
            });
        });
        expect(mockRouterReplace).toHaveBeenCalledWith('/clubs/club-created');
    });

    it('shows validation feedback before submitting invalid input', async () => {
        const mutateAsync = jest.fn();
        mockUseCreateClub.mockReturnValue({ mutateAsync, isPending: false });

        const { getByTestId, getByText } = render(<ClubCreateScreen />);
        await waitFor(() => expect(mockGetProfile).toHaveBeenCalledWith('reader-1'));

        fireEvent.press(getByTestId('create-club-submit'));

        expect(getByText('Club name is required.')).toBeOnTheScreen();
        expect(mutateAsync).not.toHaveBeenCalled();
    });

    it('allows verified authors to create author clubs with their profile id', async () => {
        mockGetProfile.mockResolvedValueOnce({ id: 'author-profile-1', user_id: 'reader-1', is_verified_author: true });
        const mutateAsync = jest.fn().mockResolvedValue({ id: 'author-club-created' });
        mockUseCreateClub.mockReturnValue({ mutateAsync, isPending: false });

        const { getByTestId, findByTestId } = render(<ClubCreateScreen />);

        await findByTestId('create-club-type-author_club');
        fireEvent.changeText(getByTestId('create-club-name'), 'Author Salon');
        fireEvent.press(getByTestId('create-club-type-author_club'));
        fireEvent.press(getByTestId('create-club-submit'));

        await waitFor(() => {
            expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
                club_type: 'author_club',
                admin_id: 'reader-1',
                author_id: 'author-profile-1',
            }));
        });
    });
});
