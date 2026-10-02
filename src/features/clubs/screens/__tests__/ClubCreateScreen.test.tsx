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
    it('preserves defaults and trims optional fields in the creation payload', async () => {
        const mutateAsync = jest.fn().mockResolvedValue({ id: 'club-created' });
        mockUseCreateClub.mockReturnValue({ mutateAsync, isPending: false });
        const { getByTestId, queryByTestId } = render(<ClubCreateScreen />);
        await waitFor(() => expect(mockGetProfile).toHaveBeenCalledWith('reader-1'));
        expect(queryByTestId('create-club-type-author_club')).toBeNull();
        expect(getByTestId('create-club-type-public').props.accessibilityState).toMatchObject({ selected: true });
        expect(getByTestId('create-club-type-public').props.accessibilityLabel).toBe('Public, selected');
        expect(getByTestId('create-club-access-all').props.accessibilityState).toMatchObject({ selected: true });
        expect(getByTestId('create-club-meeting-none').props.accessibilityState).toMatchObject({ selected: true });
        fireEvent.changeText(getByTestId('create-club-name'), '  Weekend Readers  ');
        fireEvent.changeText(getByTestId('create-club-description'), '  ');
        fireEvent.changeText(getByTestId('create-club-max-members'), '  ');
        fireEvent.press(getByTestId('create-club-submit'));
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({
            name: 'Weekend Readers', description: undefined, cover_url: undefined,
            club_type: 'public', access_level: 'all', meeting_type: undefined,
            admin_id: 'reader-1', max_members: undefined, author_id: undefined,
        }));
        expect(mockRouterReplace).toHaveBeenCalledWith('/clubs/club-created');
    });

    it.each([
        ['create-club-name', 'ab', 'Club name must be at least 3 characters.'],
        ['create-club-max-members', '1', 'Member cap must be a whole number of at least 2.'],
        ['create-club-max-members', '2.5', 'Member cap must be a whole number of at least 2.'],
        ['create-club-max-members', 'abc', 'Member cap must be a whole number of at least 2.'],
        ['create-club-cover-url', 'ftp://cover.jpg', 'Cover image must be an http or https URL.'],
    ])('retains validation for %s = %s', async (field, value, message) => {
        const mutateAsync = jest.fn();
        mockUseCreateClub.mockReturnValue({ mutateAsync, isPending: false });
        const { getByTestId, getByText } = render(<ClubCreateScreen />);
        await waitFor(() => expect(mockGetProfile).toHaveBeenCalledWith('reader-1'));
        fireEvent.changeText(getByTestId('create-club-name'), 'Weekend Readers');
        fireEvent.changeText(getByTestId(field), value);
        fireEvent.press(getByTestId('create-club-submit'));
        expect(getByText(message)).toBeOnTheScreen();
        expect(mutateAsync).not.toHaveBeenCalled();
        expect(mockRouterReplace).not.toHaveBeenCalled();
    });

    it('keeps cover preview and the selected invite, Pro+ and online values', async () => {
        const mutateAsync = jest.fn().mockResolvedValue({ id: 'club-created' });
        mockUseCreateClub.mockReturnValue({ mutateAsync, isPending: false });
        const { getByTestId, queryByTestId } = render(<ClubCreateScreen />);
        await waitFor(() => expect(mockGetProfile).toHaveBeenCalledWith('reader-1'));
        fireEvent.changeText(getByTestId('create-club-name'), 'Private Readers');
        fireEvent.changeText(getByTestId('create-club-cover-url'), ' https://example.com/cover.jpg ');
        expect(getByTestId('create-club-cover-preview')).toBeOnTheScreen();
        fireEvent.changeText(getByTestId('create-club-cover-url'), '');
        expect(queryByTestId('create-club-cover-preview')).toBeNull();
        fireEvent.changeText(getByTestId('create-club-cover-url'), ' https://example.com/cover.jpg ');
        fireEvent.press(getByTestId('create-club-type-invite_only'));
        fireEvent.press(getByTestId('create-club-access-pro_plus'));
        fireEvent.press(getByTestId('create-club-meeting-venue_based'));
        expect(getByTestId('create-club-meeting-venue_based').props.accessibilityState).toMatchObject({ selected: true });
        fireEvent.press(getByTestId('create-club-meeting-online_only'));
        expect(getByTestId('create-club-meeting-venue_based').props.accessibilityState).toMatchObject({ selected: false });
        expect(getByTestId('create-club-meeting-online_only').props.accessibilityLabel).toBe('Online only, selected');
        fireEvent.press(getByTestId('create-club-submit'));
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
            cover_url: 'https://example.com/cover.jpg', club_type: 'invite_only',
            access_level: 'pro_plus', meeting_type: 'online_only',
        })));
    });

    it('keeps the sign-in notice and disables submission for signed-out readers', () => {
        mockUseAuth.mockReturnValue({ user: null });
        const { getByTestId, getByText } = render(<ClubCreateScreen />);
        expect(getByText('Sign in required')).toBeOnTheScreen();
        expect(getByTestId('create-club-submit')).toBeDisabled();
        fireEvent.press(getByTestId('create-club-submit'));
        expect(mockUseCreateClub().mutateAsync).not.toHaveBeenCalled();
        expect(mockGetProfile).not.toHaveBeenCalled();
    });

    it('disables pending submission and preserves the draft', async () => {
        const mutateAsync = jest.fn();
        mockUseCreateClub.mockReturnValue({ mutateAsync, isPending: true });
        const { getByTestId } = render(<ClubCreateScreen />);
        await waitFor(() => expect(mockGetProfile).toHaveBeenCalledWith('reader-1'));
        fireEvent.changeText(getByTestId('create-club-name'), 'Weekend Readers');
        expect(getByTestId('create-club-submit')).toBeDisabled();
        expect(getByTestId('create-club-submit').props.accessibilityState).toMatchObject({ busy: true });
        expect(getByTestId('create-club-name').props.value).toBe('Weekend Readers');
        fireEvent.press(getByTestId('create-club-submit'));
        expect(mutateAsync).not.toHaveBeenCalled();
    });

    it('shows mutation errors and retains values without navigating', async () => {
        const mutateAsync = jest.fn().mockRejectedValue(new Error('Club limit reached.'));
        mockUseCreateClub.mockReturnValue({ mutateAsync, isPending: false });
        const { getByTestId, findByText } = render(<ClubCreateScreen />);
        fireEvent.changeText(getByTestId('create-club-name'), 'Weekend Readers');
        fireEvent.press(getByTestId('create-club-submit'));
        expect(await findByText('Club limit reached.')).toBeOnTheScreen();
        expect(getByTestId('create-club-name').props.value).toBe('Weekend Readers');
        expect(mockRouterReplace).not.toHaveBeenCalled();
    });

    it.each([false, true])('preserves Back navigation when history is %s', async (canGoBack) => {
        mockRouterCanGoBack.mockReturnValue(canGoBack);
        const { getByTestId } = render(<ClubCreateScreen />);
        await waitFor(() => expect(mockGetProfile).toHaveBeenCalledWith('reader-1'));
        fireEvent.press(getByTestId('create-club-back'));
        expect(mockRouterBack).not.toHaveBeenCalled();
        expect(mockRouterReplace).toHaveBeenCalledWith('/clubs');
    });

    it('creates an approval club and navigates to the new detail screen', async () => {
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
