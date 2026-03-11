import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ClubManageScreen from '../ClubManageScreen';

const mockUseClubPublicDetail = jest.fn();
const mockUseClubMembership = jest.fn();
const mockUseClubJoinQuestions = jest.fn();
const mockUseCreateClubJoinQuestion = jest.fn();
const mockUseUpdateClubJoinQuestion = jest.fn();
const mockUseDeleteClubJoinQuestion = jest.fn();
const mockUseUpdateClub = jest.fn();
const mockUseClubMembers = jest.fn();
const mockUseUpdateClubMemberRole = jest.fn();
const mockUseRemoveClubMember = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({
    router: { back: jest.fn() },
    useLocalSearchParams: () => ({ clubId: 'club-1' }),
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            bgPrimary: '#FFFFFF', bgCard: '#F8FAFC', bgSecondary: '#EEF2FF', border: '#CBD5E1', accent: '#4F46E5',
            textPrimary: '#0F172A', textSecondary: '#475569', textTertiary: '#94A3B8', accentLight: '#818CF8',
        },
    }),
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 'admin-1' } }),
}));
jest.mock('@/features/clubs/hooks/useClubs', () => ({
    useClubPublicDetail: (...args: unknown[]) => mockUseClubPublicDetail(...args),
    useClubMembership: (...args: unknown[]) => mockUseClubMembership(...args),
    useClubJoinQuestions: (...args: unknown[]) => mockUseClubJoinQuestions(...args),
    useClubMembers: (...args: unknown[]) => mockUseClubMembers(...args),
    useCreateClubJoinQuestion: (...args: unknown[]) => mockUseCreateClubJoinQuestion(...args),
    useUpdateClubJoinQuestion: (...args: unknown[]) => mockUseUpdateClubJoinQuestion(...args),
    useDeleteClubJoinQuestion: (...args: unknown[]) => mockUseDeleteClubJoinQuestion(...args),
    useUpdateClub: (...args: unknown[]) => mockUseUpdateClub(...args),
    useUpdateClubMemberRole: (...args: unknown[]) => mockUseUpdateClubMemberRole(...args),
    useRemoveClubMember: (...args: unknown[]) => mockUseRemoveClubMember(...args),
}));

const baseClub = {
    id: 'club-1',
    name: 'Founders Circle',
    description: 'Original description',
    cover_url: null,
    club_type: 'public',
    access_level: 'all',
    meeting_type: 'online_only',
    member_count: 12,
    max_members: 30,
    current_book_id: null,
    current_book_google_books_id: null,
    current_book_title: null,
    current_book_authors: null,
    current_book_cover_url: null,
    current_book_retail_price: null,
    current_book_currency_code: null,
    admin_id: 'admin-1',
    admin_profile_id: 'profile-1',
    admin_display_name: 'Admin Reader',
    admin_avatar_url: null,
    admin_city: 'Bangalore',
    author_id: null,
    author_user_id: null,
    author_display_name: null,
    author_avatar_url: null,
    author_city: null,
    created_at: null,
    updated_at: null,
};

beforeEach(() => {
    jest.clearAllMocks();
    mockUseClubPublicDetail.mockReturnValue({ data: baseClub, isLoading: false, isError: false, refetch: jest.fn() });
    mockUseClubMembership.mockReturnValue({ data: { role: 'admin' }, isLoading: false });
    mockUseClubJoinQuestions.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
    mockUseClubMembers.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
    mockUseCreateClubJoinQuestion.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseUpdateClubJoinQuestion.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseDeleteClubJoinQuestion.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseUpdateClub.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'club-1' }), isPending: false });
    mockUseUpdateClubMemberRole.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'member-1' }), isPending: false });
    mockUseRemoveClubMember.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue(undefined), isPending: false });
});

describe('ClubManageScreen', () => {
    it('shows the settings, member-management, and join-question sections on the manage screen', () => {
        const { getByText, getByTestId } = render(<ClubManageScreen />);

        expect(getByText('Manage club')).toBeOnTheScreen();
        expect(getByText('Basic settings')).toBeOnTheScreen();
        expect(getByText('Current saved state')).toBeOnTheScreen();
        expect(getByTestId('settings-name-input')).toBeOnTheScreen();
        expect(getByText('Members & roles')).toBeOnTheScreen();
        expect(getByText('Add join question')).toBeOnTheScreen();
    });

    it('saves updated club settings through the manage-club settings mutation', async () => {
        const mutateAsync = jest.fn().mockResolvedValue({ id: 'club-1' });
        const refetch = jest.fn().mockResolvedValue({ data: null });
        mockUseClubPublicDetail.mockReturnValue({ data: baseClub, isLoading: false, isError: false, refetch });
        mockUseUpdateClub.mockReturnValue({ mutateAsync, isPending: false });

        const { getByTestId, getByText } = render(<ClubManageScreen />);

        fireEvent.changeText(getByTestId('settings-name-input'), 'Updated Founders Circle');
        fireEvent.changeText(getByTestId('settings-description-input'), 'A better club summary');
        fireEvent.changeText(getByTestId('settings-cover-url-input'), 'https://images.example.com/founders.png');
        fireEvent.changeText(getByTestId('settings-max-members-input'), '48');
        fireEvent.press(getByTestId('club-type-option-approval'));
        fireEvent.press(getByTestId('access-level-option-pro'));
        fireEvent.press(getByTestId('meeting-type-option-hybrid'));
        fireEvent.press(getByTestId('save-settings-button'));

        await waitFor(() => {
            expect(mutateAsync).toHaveBeenCalledWith({
                clubId: 'club-1',
                updates: {
                    name: 'Updated Founders Circle',
                    description: 'A better club summary',
                    cover_url: 'https://images.example.com/founders.png',
                    max_members: 48,
                    club_type: 'approval',
                    access_level: 'pro',
                    meeting_type: 'hybrid',
                },
            });
        });
        expect(refetch).toHaveBeenCalled();
        expect(getByText('Basic club settings saved.')).toBeOnTheScreen();
    });

    it('blocks saving when the member cap is below the current member count', async () => {
        const mutateAsync = jest.fn().mockResolvedValue({ id: 'club-1' });
        mockUseUpdateClub.mockReturnValue({ mutateAsync, isPending: false });

        const { getByTestId, getByText } = render(<ClubManageScreen />);

        fireEvent.changeText(getByTestId('settings-max-members-input'), '8');

        expect(getByTestId('settings-validation-message')).toBeOnTheScreen();
        expect(getByText('Member cap cannot be below the current member count of 12.')).toBeOnTheScreen();
        fireEvent.press(getByTestId('save-settings-button'));

        await waitFor(() => {
            expect(mutateAsync).not.toHaveBeenCalled();
        });
    });

    it('resets unsaved settings changes back to the saved club state', () => {
        const { getByTestId } = render(<ClubManageScreen />);

        fireEvent.changeText(getByTestId('settings-name-input'), 'Temporary rename');
        fireEvent.changeText(getByTestId('settings-cover-url-input'), 'https://images.example.com/temp.png');
        fireEvent.changeText(getByTestId('settings-max-members-input'), '48');
        fireEvent.press(getByTestId('access-level-option-pro'));
        fireEvent.press(getByTestId('reset-settings-button'));

        expect(getByTestId('settings-name-input').props.value).toBe('Founders Circle');
        expect(getByTestId('settings-cover-url-input').props.value).toBe('');
        expect(getByTestId('settings-max-members-input').props.value).toBe('30');
    });

    it('locks club type editing for author clubs while keeping other settings editable', () => {
        mockUseClubPublicDetail.mockReturnValue({
            data: { ...baseClub, club_type: 'author_club', author_id: 'author-1', author_display_name: 'Toni Morrison' },
            isLoading: false,
            isError: false,
            refetch: jest.fn(),
        });

        const { getByText, queryByTestId } = render(<ClubManageScreen />);

        expect(getByText(/author clubs keep their club type locked here/i)).toBeOnTheScreen();
        expect(queryByTestId('club-type-option-public')).toBeNull();
    });

    it('toggles moderator assignment from the current member list', async () => {
        const mutateAsync = jest.fn().mockResolvedValue({ id: 'member-2', club_id: 'club-1', user_id: 'reader-2', role: 'moderator', status: 'active' });
        const refetchMembers = jest.fn().mockResolvedValue({ data: null });
        mockUseClubMembers.mockReturnValue({
            data: [
                { id: 'member-admin', club_id: 'club-1', user_id: 'admin-1', role: 'admin', status: 'active', joined_at: null, profile: { display_name: 'Admin Reader', username: 'adminreader', membership_tier: 'pro_plus' } },
                { id: 'member-2', club_id: 'club-1', user_id: 'reader-2', role: 'member', status: 'active', joined_at: null, profile: { display_name: 'Reader Two', username: 'readertwo', membership_tier: 'pro' } },
            ],
            isLoading: false,
            refetch: refetchMembers,
        });
        mockUseUpdateClubMemberRole.mockReturnValue({ mutateAsync, isPending: false });

        const { getByTestId, getByText } = render(<ClubManageScreen />);

        fireEvent.press(getByTestId('toggle-moderator-reader-2'));

        await waitFor(() => {
            expect(mutateAsync).toHaveBeenCalledWith({ clubId: 'club-1', userId: 'reader-2', role: 'moderator' });
        });
        expect(refetchMembers).toHaveBeenCalled();
        expect(getByText('Reader Two is now a moderator.')).toBeOnTheScreen();
    });

    it('blocks assigning moderator to a free-tier member and explains why', () => {
        mockUseClubMembers.mockReturnValue({
            data: [
                { id: 'member-2', club_id: 'club-1', user_id: 'reader-2', role: 'member', status: 'active', joined_at: null, profile: { display_name: 'Reader Two', username: 'readertwo', membership_tier: 'free' } },
            ],
            isLoading: false,
            refetch: jest.fn(),
        });

        const { getByTestId, getByText } = render(<ClubManageScreen />);

        expect(getByTestId('toggle-moderator-reader-2')).toBeDisabled();
        expect(getByText('Requires Pro or Pro+ membership.')).toBeOnTheScreen();
    });

    it('removes a non-admin member from the current member list after confirmation', async () => {
        const mutateAsync = jest.fn().mockResolvedValue(undefined);
        const refetchMembers = jest.fn().mockResolvedValue({ data: null });
        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
            const removeButton = buttons?.find((button) => button.text === 'Remove');
            removeButton?.onPress?.();
        });

        mockUseClubMembers.mockReturnValue({
            data: [
                { id: 'member-admin', club_id: 'club-1', user_id: 'admin-1', role: 'admin', status: 'active', joined_at: null, profile: { display_name: 'Admin Reader', username: 'adminreader' } },
                { id: 'member-2', club_id: 'club-1', user_id: 'reader-2', role: 'moderator', status: 'active', joined_at: null, profile: { display_name: 'Reader Two', username: 'readertwo' } },
            ],
            isLoading: false,
            refetch: refetchMembers,
        });
        mockUseRemoveClubMember.mockReturnValue({ mutateAsync, isPending: false });

        const { getByTestId, getByText } = render(<ClubManageScreen />);

        fireEvent.press(getByTestId('remove-member-reader-2'));

        expect(alertSpy).toHaveBeenCalled();
        await waitFor(() => {
            expect(mutateAsync).toHaveBeenCalledWith({ clubId: 'club-1', userId: 'reader-2' });
        });
        expect(refetchMembers).toHaveBeenCalled();
        expect(getByText('Reader Two was removed from the club.')).toBeOnTheScreen();
    });
});