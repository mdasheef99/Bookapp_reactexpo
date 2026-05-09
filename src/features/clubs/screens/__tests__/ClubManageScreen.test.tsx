import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ClubManageScreen from '../ClubManageScreen';

let mockUserId = 'admin-1';
const mockRouterPush = jest.fn();
const mockUseClubPublicDetail = jest.fn();
const mockUseClubMembership = jest.fn();
const mockUseClubBookNominations = jest.fn();
const mockUseClubJoinQuestions = jest.fn();
const mockUseCreateClubJoinQuestion = jest.fn();
const mockUseUpdateClubJoinQuestion = jest.fn();
const mockUseDeleteClubJoinQuestion = jest.fn();
const mockUseFinalizeClubBookNomination = jest.fn();
const mockUseNominateClubBook = jest.fn();
const mockUseUpdateClub = jest.fn();
const mockUseClubMembers = jest.fn();
const mockUseUpdateClubMemberRole = jest.fn();
const mockUseRemoveClubMember = jest.fn();
const mockUseClubApplications = jest.fn();
const mockUseReviewClubApplication = jest.fn();
const mockUseClubInvitations = jest.fn();
const mockUseCreateClubInvitation = jest.fn();
const mockUseClubEvents = jest.fn();
const mockUseCancelClubEvent = jest.fn();
const mockUseDeleteClubEvent = jest.fn();
const mockUseUpdateClubMemberStatus = jest.fn();
const mockUseSetClubCurrentBookFromNomination = jest.fn();
const mockUseLocalSearchParams = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@/hooks/useDebounce', () => ({
    useDebounce: (value: string) => value,
}));
jest.mock('@/lib/navigation', () => ({
    navigateBackOrFallback: jest.fn(),
}));
jest.mock('expo-router', () => ({
    router: { back: jest.fn(), push: (...args: unknown[]) => mockRouterPush(...args) },
    useLocalSearchParams: (...args: unknown[]) => mockUseLocalSearchParams(...args),
}));
jest.mock('expo-image-picker', () => ({
    requestMediaLibraryPermissionsAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
    MediaType: { Images: 'Images' },
}));
jest.mock('@/lib/supabase', () => ({
    supabase: {
        storage: {
            from: jest.fn(() => ({
                upload: jest.fn().mockResolvedValue({ error: null }),
                getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/club-banner.jpg' } }),
            })),
        },
    },
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            bgPrimary: '#FFFFFF', bgCard: '#F8FAFC', bgSecondary: '#EEF2FF', border: '#CBD5E1', accent: '#4F46E5',
            textPrimary: '#0F172A', textSecondary: '#475569', textTertiary: '#94A3B8', accentLight: '#818CF8',
            error: '#EF4444', errorLight: '#F87171', disabled: '#E0E0E0', disabledLight: '#CCCCCC',
        },
    }),
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: mockUserId } }),
}));
jest.mock('@/features/clubs/hooks/useClubs', () => ({
    useClubPublicDetail: (...args: unknown[]) => mockUseClubPublicDetail(...args),
    useClubMembership: (...args: unknown[]) => mockUseClubMembership(...args),
    useClubBookNominations: (...args: unknown[]) => mockUseClubBookNominations(...args),
    useClubJoinQuestions: (...args: unknown[]) => mockUseClubJoinQuestions(...args),
    useClubMembers: (...args: unknown[]) => mockUseClubMembers(...args),
    useCreateClubJoinQuestion: (...args: unknown[]) => mockUseCreateClubJoinQuestion(...args),
    useUpdateClubJoinQuestion: (...args: unknown[]) => mockUseUpdateClubJoinQuestion(...args),
    useDeleteClubJoinQuestion: (...args: unknown[]) => mockUseDeleteClubJoinQuestion(...args),
    useFinalizeClubBookNomination: (...args: unknown[]) => mockUseFinalizeClubBookNomination(...args),
    useSetClubCurrentBookFromNomination: (...args: unknown[]) => mockUseSetClubCurrentBookFromNomination(...args),
    useNominateClubBook: (...args: unknown[]) => mockUseNominateClubBook(...args),
    useUpdateClub: (...args: unknown[]) => mockUseUpdateClub(...args),
    useUpdateClubMemberRole: (...args: unknown[]) => mockUseUpdateClubMemberRole(...args),
    useRemoveClubMember: (...args: unknown[]) => mockUseRemoveClubMember(...args),
    useClubApplications: (...args: unknown[]) => mockUseClubApplications(...args),
    useReviewClubApplication: (...args: unknown[]) => mockUseReviewClubApplication(...args),
    useClubInvitations: (...args: unknown[]) => mockUseClubInvitations(...args),
    useCreateClubInvitation: (...args: unknown[]) => mockUseCreateClubInvitation(...args),
    useClubEvents: (...args: unknown[]) => mockUseClubEvents(...args),
    useCancelClubEvent: (...args: unknown[]) => mockUseCancelClubEvent(...args),
    useDeleteClubEvent: (...args: unknown[]) => mockUseDeleteClubEvent(...args),
    useUpdateClubMemberStatus: (...args: unknown[]) => mockUseUpdateClubMemberStatus(...args),
}));

jest.mock('@/features/books/services/booksService', () => ({
    __esModule: true,
    searchGoogleBooksCached: jest.fn(),
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
    mockUserId = 'admin-1';
    mockRouterPush.mockReset();
    mockUseLocalSearchParams.mockReturnValue({ clubId: 'club-1', tab: undefined });
    mockUseClubPublicDetail.mockReturnValue({ data: baseClub, isLoading: false, isError: false, refetch: jest.fn() });
    mockUseClubMembership.mockReturnValue({ data: { role: 'admin', status: 'active' }, isLoading: false });
    mockUseClubBookNominations.mockReturnValue({ data: [], isLoading: false, isError: false, error: null, refetch: jest.fn() });
    mockUseClubJoinQuestions.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
    mockUseClubMembers.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
    mockUseCreateClubJoinQuestion.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseUpdateClubJoinQuestion.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseDeleteClubJoinQuestion.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseFinalizeClubBookNomination.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'club-1' }), isPending: false });
    mockUseSetClubCurrentBookFromNomination.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'club-1' }), isPending: false });
    mockUseNominateClubBook.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'nomination-1' }), isPending: false });
    mockUseUpdateClub.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'club-1' }), isPending: false });
    mockUseUpdateClubMemberRole.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'member-1' }), isPending: false });
    mockUseRemoveClubMember.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue(undefined), isPending: false });
    mockUseClubApplications.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
    mockUseReviewClubApplication.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseClubInvitations.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
    mockUseCreateClubInvitation.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseClubEvents.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
    mockUseCancelClubEvent.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseDeleteClubEvent.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseUpdateClubMemberStatus.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'member-1' }), isPending: false });
});

describe('ClubManageScreen', () => {
    it('shows club header and tab bar for admins with all tabs', () => {
        const { getByText } = render(<ClubManageScreen />);

        expect(getByText('Founders Circle')).toBeOnTheScreen();
        expect(getByText('Current Book')).toBeOnTheScreen();
        expect(getByText('Analytics')).toBeOnTheScreen();
        expect(getByText('Events')).toBeOnTheScreen();
        expect(getByText('Settings')).toBeOnTheScreen();
        expect(getByText('Members')).toBeOnTheScreen();
        expect(getByText('Join Questions')).toBeOnTheScreen();
        // Default active tab is Current Book
        expect(getByText('Current book')).toBeOnTheScreen();
    });

    it('opens create and edit actions from the manage events tab', () => {
        mockUseClubEvents.mockReturnValue({
            data: [{
                id: 'event-1',
                club_id: 'club-1',
                title: 'April planning session',
                description: 'Discuss next month picks.',
                event_type: 'hybrid',
                start_time: '2026-04-12T18:00:00.000Z',
                end_time: null,
                venue_id: null,
                manual_location: 'Library board room',
                meeting_link: 'https://meet.example.com/april-planning',
                max_attendees: null,
                created_by: 'admin-1',
                created_at: null,
                updated_at: null,
                status: 'scheduled',
                cancelled_at: null,
                cancelled_by: null,
                venue: null,
                creatorProfile: null,
                currentUserRsvp: null,
            }],
            isLoading: false,
            refetch: jest.fn(),
        });

        const { getByText, getByTestId } = render(<ClubManageScreen />);

        fireEvent.press(getByText('Events'));
        fireEvent.press(getByTestId('manage-create-event'));
        fireEvent.press(getByTestId('manage-edit-event-event-1'));

        expect(mockRouterPush).toHaveBeenNthCalledWith(1, '/clubs/club-1/events/create?returnTo=manage&manageTab=events');
        expect(mockRouterPush).toHaveBeenNthCalledWith(2, '/clubs/club-1/events/event-1/edit?returnTo=manage&manageTab=events');
    });

    it('lets admins switch away from the events tab after returning with the events query param', async () => {
        mockUseLocalSearchParams.mockReturnValue({ clubId: 'club-1', tab: 'events' });

        const { getByText, queryByText } = render(<ClubManageScreen />);

        await waitFor(() => expect(getByText('Manage events')).toBeOnTheScreen());

        fireEvent.press(getByText('Settings'));

        await waitFor(() => expect(getByText('Basic settings')).toBeOnTheScreen());
        expect(queryByText('Manage events')).toBeNull();
    });

    it('shows only Current Book tab for active moderators', async () => {
        mockUserId = 'reader-2';
        mockUseClubMembership.mockReturnValue({ data: { role: 'moderator', status: 'active' }, isLoading: false });
        mockUseClubBookNominations.mockReturnValue({
            data: [{
                id: 'nomination-1', club_id: 'club-1', book_id: 'book-1', nominated_by: 'reader-3', vote_count: 4, status: 'active', voting_ends_at: '2000-01-01T00:00:00Z', created_at: '2026-03-10T00:00:00Z',
                book: { id: 'book-1', google_books_id: 'gb-1', title: 'Beloved', authors: ['Toni Morrison'], cover_url: null },
                nominatorProfile: { id: 'profile-3', user_id: 'reader-3', display_name: 'Reader Three', username: 'readerthree', avatar_url: null, trust_score: 4.4, city: 'Bangalore' },
                currentUserVote: null,
            }],
            isLoading: false,
            isError: false,
            error: null,
            refetch: jest.fn(),
        });

        const { getByText, getByTestId, queryByText, queryByTestId } = render(<ClubManageScreen />);

        await waitFor(() => expect(getByText('Current book')).toBeOnTheScreen());

        // Moderators see Current Book tab but not admin tabs
        expect(queryByText('Settings')).toBeNull();
        expect(queryByText('Members')).toBeNull();
        // Moderators can see nominations but cannot finalize (admin-only action)
        expect(getByTestId('manage-current-book-title-nomination-1')).toBeOnTheScreen();
        expect(queryByTestId('manage-finalize-nomination-1')).toBeNull();
    });

    it('saves updated club settings through the manage-club settings mutation', async () => {
        const mutateAsync = jest.fn().mockResolvedValue({ id: 'club-1' });
        const refetch = jest.fn().mockResolvedValue({ data: null });
        mockUseClubPublicDetail.mockReturnValue({ data: baseClub, isLoading: false, isError: false, refetch });
        mockUseUpdateClub.mockReturnValue({ mutateAsync, isPending: false });

        const { getByTestId, getByText } = render(<ClubManageScreen />);

        // Navigate to Settings tab
        fireEvent.press(getByText('Settings'));

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

        // Navigate to Settings tab
        fireEvent.press(getByText('Settings'));

        fireEvent.changeText(getByTestId('settings-max-members-input'), '8');

        expect(getByText('Member cap cannot be below the current member count of 12.')).toBeOnTheScreen();
        fireEvent.press(getByTestId('save-settings-button'));

        await waitFor(() => {
            expect(mutateAsync).not.toHaveBeenCalled();
        });
    });

    it('resets unsaved settings changes back to the saved club state', () => {
        const { getByTestId, getByText } = render(<ClubManageScreen />);

        // Navigate to Settings tab
        fireEvent.press(getByText('Settings'));

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

        // Navigate to Settings tab
        fireEvent.press(getByText('Settings'));

        expect(queryByTestId('club-type-option-public')).toBeNull();
    });

    it('finalizes a closed nomination from Manage Club for an admin', async () => {
        mockUserId = 'admin-1';
        const mutateAsync = jest.fn().mockResolvedValue({ id: 'club-1' });
        const refetchClub = jest.fn().mockResolvedValue({ data: null });
        const refetchNominations = jest.fn().mockResolvedValue({ data: null });
        mockUseClubPublicDetail.mockReturnValue({ data: baseClub, isLoading: false, isError: false, refetch: refetchClub });
        mockUseClubMembership.mockReturnValue({ data: { role: 'admin', status: 'active' }, isLoading: false });
        mockUseClubBookNominations.mockReturnValue({
            data: [{
                id: 'nomination-1', club_id: 'club-1', book_id: 'book-1', nominated_by: 'reader-3', vote_count: 6, status: 'active', voting_ends_at: '2000-01-01T00:00:00Z', created_at: '2026-03-10T00:00:00Z',
                book: { id: 'book-1', google_books_id: 'gb-1', title: 'Beloved', authors: ['Toni Morrison'], cover_url: null },
                nominatorProfile: { id: 'profile-3', user_id: 'reader-3', display_name: 'Reader Three', username: 'readerthree', avatar_url: null, trust_score: 4.4, city: 'Bangalore' },
                currentUserVote: null,
            }],
            isLoading: false,
            isError: false,
            error: null,
            refetch: refetchNominations,
        });
        mockUseFinalizeClubBookNomination.mockReturnValue({ mutateAsync, isPending: false });

        const { getByTestId, getByText } = render(<ClubManageScreen />);

        fireEvent.press(getByTestId('manage-finalize-nomination-1'));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ nominationId: 'nomination-1' }));
        expect(refetchClub).toHaveBeenCalled();
        expect(refetchNominations).toHaveBeenCalled();
        expect(getByText('Current book finalized successfully.')).toBeOnTheScreen();
    });

    it('lets an admin set an active nomination as the current book before voting closes', async () => {
        const mutateAsync = jest.fn().mockResolvedValue({ id: 'club-1' });
        const refetchClub = jest.fn().mockResolvedValue({ data: null });
        const refetchNominations = jest.fn().mockResolvedValue({ data: null });
        mockUseClubPublicDetail.mockReturnValue({ data: baseClub, isLoading: false, isError: false, refetch: refetchClub });
        mockUseClubMembership.mockReturnValue({ data: { role: 'admin', status: 'active' }, isLoading: false });
        mockUseClubBookNominations.mockReturnValue({
            data: [{
                id: 'nomination-open-1', club_id: 'club-1', book_id: 'book-1', nominated_by: 'reader-3', vote_count: 4, status: 'active', voting_ends_at: '2099-01-01T00:00:00Z', created_at: '2026-03-10T00:00:00Z',
                book: { id: 'book-1', google_books_id: 'gb-1', title: 'Beloved', authors: ['Toni Morrison'], cover_url: null },
                nominatorProfile: { id: 'profile-3', user_id: 'reader-3', display_name: 'Reader Three', username: 'readerthree', avatar_url: null, trust_score: 4.4, city: 'Bangalore' },
                currentUserVote: null,
            }],
            isLoading: false,
            isError: false,
            error: null,
            refetch: refetchNominations,
        });
        mockUseSetClubCurrentBookFromNomination.mockReturnValue({ mutateAsync, isPending: false });

        const { getByTestId, getByText } = render(<ClubManageScreen />);

        fireEvent.press(getByTestId('manage-set-current-nomination-open-1'));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ nominationId: 'nomination-open-1' }));
        expect(refetchClub).toHaveBeenCalled();
        expect(refetchNominations).toHaveBeenCalled();
        expect(getByText('Current book updated successfully.')).toBeOnTheScreen();
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

        // Navigate to Members tab
        fireEvent.press(getByText('Members'));

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

        // Navigate to Members tab
        fireEvent.press(getByText('Members'));

        // The button is not visually disabled (member is active), but pressing it shows an error
        fireEvent.press(getByTestId('toggle-moderator-reader-2'));

        expect(getByText('Only Pro or Pro+ users can become club moderators. This member is currently on the Free tier.')).toBeOnTheScreen();
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

        // Navigate to Members tab
        fireEvent.press(getByText('Members'));

        fireEvent.press(getByTestId('remove-member-reader-2'));

        expect(alertSpy).toHaveBeenCalled();
        await waitFor(() => {
            expect(mutateAsync).toHaveBeenCalledWith({ clubId: 'club-1', userId: 'reader-2' });
        });
        expect(refetchMembers).toHaveBeenCalled();
        expect(getByText('Reader Two was removed from the club.')).toBeOnTheScreen();
    });

    it('creates a join question from the Join Questions tab', async () => {
        const createMutateAsync = jest.fn().mockResolvedValue({ id: 'q-1' });
        const refetchQuestions = jest.fn().mockResolvedValue({ data: null });
        mockUseCreateClubJoinQuestion.mockReturnValue({ mutateAsync: createMutateAsync, isPending: false });
        mockUseClubJoinQuestions.mockReturnValue({ data: [], isLoading: false, refetch: refetchQuestions });

        const { getByTestId, getByText } = render(<ClubManageScreen />);

        fireEvent.press(getByText('Join Questions'));
        await waitFor(() => expect(getByText('Join questions')).toBeOnTheScreen());

        fireEvent.changeText(getByTestId('new-question-input'), 'What is your favorite genre?');
        fireEvent.press(getByTestId('create-question-button'));

        await waitFor(() => {
            expect(createMutateAsync).toHaveBeenCalledWith({
                clubId: 'club-1',
                input: {
                    question: 'What is your favorite genre?',
                    isRequired: true,
                    orderIndex: 0,
                },
            });
        });
        expect(refetchQuestions).toHaveBeenCalled();
        expect(getByText('Join question added.')).toBeOnTheScreen();
    });

    it('searches Google Books and sets a current book via the manual override flow', async () => {
        const nominateMutateAsync = jest.fn().mockResolvedValue({ id: 'nomination-override-1' });
        const finalizeMutateAsync = jest.fn().mockResolvedValue({ id: 'club-1' });
        const refetchClub = jest.fn().mockResolvedValue({ data: null });
        const refetchNominations = jest.fn().mockResolvedValue({ data: null });
        jest.requireMock('@/features/books/services/booksService').searchGoogleBooksCached.mockResolvedValue({
            items: [
                {
                    id: 'book-override-1',
                    volumeInfo: {
                        title: 'Test Override Book',
                        authors: ['Test Author'],
                        imageLinks: { thumbnail: 'https://example.com/cover.jpg' },
                    },
                },
            ],
            totalItems: 1,
            hasMore: false,
            fromCache: false,
        });

        mockUseClubPublicDetail.mockReturnValue({ data: baseClub, isLoading: false, isError: false, refetch: refetchClub });
        mockUseClubBookNominations.mockReturnValue({ data: [], isLoading: false, isError: false, error: null, refetch: refetchNominations });
        mockUseNominateClubBook.mockReturnValue({ mutateAsync: nominateMutateAsync, isPending: false });
        mockUseFinalizeClubBookNomination.mockReturnValue({ mutateAsync: finalizeMutateAsync, isPending: false });

        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
            const confirmButton = buttons?.find((button) => button.text === 'Set current book');
            confirmButton?.onPress?.();
        });

        const { getByTestId, getByText } = render(<ClubManageScreen />);

        fireEvent.press(getByTestId('manage-toggle-override'));
        await waitFor(() => expect(getByText('Manual override')).toBeOnTheScreen());

        const searchGoogleBooksCached = jest.requireMock('@/features/books/services/booksService').searchGoogleBooksCached;

        fireEvent.changeText(getByTestId('manage-override-search'), 'Test Override');

        await waitFor(() => expect(searchGoogleBooksCached).toHaveBeenCalledWith('Test Override', 0, 10));
        await waitFor(() => expect(getByTestId('manage-override-result-book-override-1')).toBeOnTheScreen());

        fireEvent.press(getByTestId('manage-override-result-book-override-1'));
        fireEvent.press(getByTestId('manage-override-set'));

        expect(alertSpy).toHaveBeenCalled();
        await waitFor(() => {
            expect(nominateMutateAsync).toHaveBeenCalled();
        });
        await waitFor(() => {
            expect(finalizeMutateAsync).toHaveBeenCalledWith({ nominationId: 'nomination-override-1' });
        });
        expect(refetchClub).toHaveBeenCalled();
        expect(refetchNominations).toHaveBeenCalled();
    });

    it('only searches once after a single override query input change', async () => {
        jest.requireMock('@/features/books/services/booksService').searchGoogleBooksCached.mockResolvedValue({ items: [], totalItems: 0, hasMore: false, fromCache: false });

        const { getByTestId, getByText } = render(<ClubManageScreen />);
        fireEvent.press(getByTestId('manage-toggle-override'));
        await waitFor(() => expect(getByText('Manual override')).toBeOnTheScreen());

        fireEvent.changeText(getByTestId('manage-override-search'), 'Test Override');

        await waitFor(() => expect(jest.requireMock('@/features/books/services/booksService').searchGoogleBooksCached).toHaveBeenCalledWith('Test Override', 0, 10));
        expect(jest.requireMock('@/features/books/services/booksService').searchGoogleBooksCached).toHaveBeenCalledTimes(1);
    });

    it('shows cached results banner when search returns from cache', async () => {
        jest.requireMock('@/features/books/services/booksService').searchGoogleBooksCached.mockResolvedValue({
            items: [{ id: 'cached-book', volumeInfo: { title: 'Cached Book' } }],
            totalItems: 1,
            hasMore: false,
            fromCache: true,
        });

        const { getByTestId, getByText } = render(<ClubManageScreen />);
        fireEvent.press(getByTestId('manage-toggle-override'));
        await waitFor(() => expect(getByText('Manual override')).toBeOnTheScreen());

        fireEvent.changeText(getByTestId('manage-override-search'), 'Cached Book');

        await waitFor(() => expect(jest.requireMock('@/features/books/services/booksService').searchGoogleBooksCached).toHaveBeenCalledWith('Cached Book', 0, 10));
        await waitFor(() => expect(getByText('Showing cached results')).toBeOnTheScreen());
    });

    it('approves a pending application from the Applications tab', async () => {
        const reviewMutateAsync = jest.fn().mockResolvedValue(undefined);
        const refetchApplications = jest.fn().mockResolvedValue({ data: null });
        mockUseClubPublicDetail.mockReturnValue({
            data: { ...baseClub, club_type: 'approval' },
            isLoading: false,
            isError: false,
            refetch: jest.fn(),
        });
        mockUseClubApplications.mockReturnValue({
            data: [
                {
                    id: 'app-1',
                    club_id: 'club-1',
                    user_id: 'applicant-1',
                    status: 'pending',
                    answers: [{ question: 'Why join?', answer: 'I love books!' }],
                    created_at: '2026-04-30T00:00:00Z',
                    user_profile: { display_name: 'Book Lover', username: 'booklover' },
                },
            ],
            isLoading: false,
            refetch: refetchApplications,
        });
        mockUseReviewClubApplication.mockReturnValue({ mutateAsync: reviewMutateAsync, isPending: false });

        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
            const approveButton = buttons?.find((button) => button.text === 'Approve');
            approveButton?.onPress?.();
        });

        const { getByText } = render(<ClubManageScreen />);

        fireEvent.press(getByText('Applications'));
        await waitFor(() => expect(getByText('Book Lover')).toBeOnTheScreen());

        fireEvent.press(getByText('Approve'));
        expect(alertSpy).toHaveBeenCalled();

        await waitFor(() => {
            expect(reviewMutateAsync).toHaveBeenCalledWith({ applicationId: 'app-1', decision: 'approved' });
        });
        expect(refetchApplications).toHaveBeenCalled();
        expect(getByText('Application approved.')).toBeOnTheScreen();
    });

    it('sends an invitation from the Invitations tab', async () => {
        const inviteMutateAsync = jest.fn().mockResolvedValue({ id: 'invite-1' });
        const refetchInvitations = jest.fn().mockResolvedValue({ data: null });
        mockUseClubPublicDetail.mockReturnValue({
            data: { ...baseClub, club_type: 'invite_only' },
            isLoading: false,
            isError: false,
            refetch: jest.fn(),
        });
        mockUseClubInvitations.mockReturnValue({ data: [], isLoading: false, refetch: refetchInvitations });
        mockUseCreateClubInvitation.mockReturnValue({ mutateAsync: inviteMutateAsync, isPending: false });

        const { getByTestId, getByText, getAllByText } = render(<ClubManageScreen />);

        fireEvent.press(getAllByText('Invitations')[0]);
        await waitFor(() => expect(getByTestId('manage-invite-username-input')).toBeOnTheScreen());

        fireEvent.changeText(getByTestId('manage-invite-username-input'), 'newmember');
        fireEvent.press(getByText('Invite'));

        await waitFor(() => {
            expect(inviteMutateAsync).toHaveBeenCalledWith({ clubId: 'club-1', inviteeUsername: 'newmember' });
        });
        expect(refetchInvitations).toHaveBeenCalled();
        expect(getByText('Invitation sent.')).toBeOnTheScreen();
    });

    it('shows a cover image preview when the club already has a cover URL', async () => {
        mockUseClubPublicDetail.mockReturnValue({
            data: { ...baseClub, cover_url: 'https://images.example.com/founders.png' },
            isLoading: false,
            isError: false,
            refetch: jest.fn(),
        });

        const { getByTestId, getByText } = render(<ClubManageScreen />);

        fireEvent.press(getByText('Settings'));
        await waitFor(() => expect(getByTestId('settings-cover-preview')).toBeOnTheScreen());
    });

    it('shows "Select cover image" button and manual URL fallback in settings', async () => {
        mockUseClubPublicDetail.mockReturnValue({
            data: { ...baseClub, cover_url: null },
            isLoading: false,
            isError: false,
            refetch: jest.fn(),
        });

        const { getByTestId, getByText, queryByTestId } = render(<ClubManageScreen />);

        fireEvent.press(getByText('Settings'));
        await waitFor(() => expect(getByTestId('settings-pick-cover')).toBeOnTheScreen());
        expect(queryByTestId('settings-cover-preview')).toBeNull();
    });

    it('picks an image, uploads to Supabase Storage, and updates the cover URL field', async () => {
        const mockImagePicker = jest.requireMock('expo-image-picker');
        mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' });
        mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
            canceled: false,
            assets: [{ uri: 'file://test-photo.jpg', mimeType: 'image/jpeg' }],
        });

        jest.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            blob: jest.fn().mockResolvedValue({ type: 'image/jpeg' }),
        } as any);

        const { getByTestId, getByText, getByDisplayValue } = render(<ClubManageScreen />);

        fireEvent.press(getByText('Settings'));
        fireEvent.press(getByTestId('settings-pick-cover'));

        await waitFor(() => expect(mockImagePicker.launchImageLibraryAsync).toHaveBeenCalled());
        await waitFor(() => expect(getByDisplayValue('https://cdn.example.com/club-banner.jpg')).toBeOnTheScreen());
    });

    it('shows an alert when image picker permission is denied', async () => {
        const mockImagePicker = jest.requireMock('expo-image-picker');
        mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'denied' });

        const { getByTestId, getByText } = render(<ClubManageScreen />);

        fireEvent.press(getByText('Settings'));
        fireEvent.press(getByTestId('settings-pick-cover'));

        await waitFor(() => expect(getByText(/Permission denied\./)).toBeOnTheScreen());
    });

    it('renders analytics tab with member and nomination stats', () => {
        mockUseClubMembers.mockReturnValue({
            data: [
                { id: 'member-1', club_id: 'club-1', user_id: 'admin-1', role: 'admin', status: 'active', joined_at: null, profile: { display_name: 'Admin', username: 'admin' } },
                { id: 'member-2', club_id: 'club-1', user_id: 'reader-2', role: 'moderator', status: 'active', joined_at: null, profile: { display_name: 'Reader Two', username: 'readertwo' } },
                { id: 'member-3', club_id: 'club-1', user_id: 'reader-3', role: 'member', status: 'active', joined_at: null, profile: { display_name: 'Reader Three', username: 'readerthree' } },
            ],
            isLoading: false,
            refetch: jest.fn(),
        });
        mockUseClubBookNominations.mockReturnValue({
            data: [{ id: 'nom-1', club_id: 'club-1', book_id: 'b1', book_title: 'Book One', nominated_by: 'reader-2', vote_count: 3, status: 'active', voting_ends_at: '2000-01-01T00:00:00Z', created_at: '2026-03-10T00:00:00Z', book: { id: 'b1', google_books_id: 'gb1', title: 'Book One', authors: ['A'], cover_url: null }, nominatorProfile: { display_name: 'Reader Two' }, currentUserVote: null }],
            isLoading: false,
            isError: false,
            error: null,
            refetch: jest.fn(),
        });
        mockUseClubEvents.mockReturnValue({
            data: [{ id: 'evt-1', club_id: 'club-1', title: 'March Meet', description: null, event_type: 'virtual', start_time: '2026-06-01T18:00:00Z', end_time: null, venue_id: null, manual_location: null, meeting_link: null, max_attendees: null, created_by: 'admin-1', created_at: null, updated_at: null, status: 'scheduled', cancelled_at: null, cancelled_by: null, venue: null, creatorProfile: null, currentUserRsvp: null }],
            isLoading: false,
            refetch: jest.fn(),
        });

        const { getByText, getAllByText } = render(<ClubManageScreen />);

        fireEvent.press(getByText('Analytics'));
        expect(getByText('Club overview')).toBeOnTheScreen();
        expect(getByText('3')).toBeOnTheScreen(); // Members
        expect(getAllByText('Members')[1]).toBeOnTheScreen();
        // Use specific stat labels to avoid ambiguity with duplicate numbers
        expect(getAllByText('1')[0]).toBeOnTheScreen(); // Moderators
    });

    it('mutes and unmutes a member from the Members tab', async () => {
        const mutateAsync = jest.fn().mockResolvedValue({ id: 'member-2', club_id: 'club-1', user_id: 'reader-2', role: 'member', status: 'muted' });
        const refetchMembers = jest.fn().mockResolvedValue({ data: null });
        mockUseClubMembers.mockReturnValue({
            data: [
                { id: 'member-admin', club_id: 'club-1', user_id: 'admin-1', role: 'admin', status: 'active', joined_at: null, profile: { display_name: 'Admin Reader', username: 'adminreader' } },
                { id: 'member-2', club_id: 'club-1', user_id: 'reader-2', role: 'member', status: 'active', joined_at: null, profile: { display_name: 'Reader Two', username: 'readertwo' } },
            ],
            isLoading: false,
            refetch: refetchMembers,
        });
        mockUseUpdateClubMemberStatus.mockReturnValue({ mutateAsync, isPending: false });

        const { getByText, getByTestId } = render(<ClubManageScreen />);

        fireEvent.press(getByText('Members'));
        fireEvent.press(getByTestId('mute-member-reader-2'));

        await waitFor(() => {
            expect(mutateAsync).toHaveBeenCalledWith({ clubId: 'club-1', userId: 'reader-2', status: 'muted' });
        });
        expect(refetchMembers).toHaveBeenCalled();
        expect(getByText('Reader Two has been muted.')).toBeOnTheScreen();
    });

    it('shows upcoming and past events in the Events tab and cancels an event', async () => {
        const cancelMutateAsync = jest.fn().mockResolvedValue({});
        mockUseClubEvents.mockReturnValue({
            data: [
                { id: 'evt-upcoming', club_id: 'club-1', title: 'Upcoming Event', description: null, event_type: 'virtual', start_time: '2026-12-01T18:00:00Z', end_time: null, venue_id: null, manual_location: null, meeting_link: null, max_attendees: null, created_by: 'admin-1', created_at: null, updated_at: null, status: 'scheduled', cancelled_at: null, cancelled_by: null, venue: null, creatorProfile: null, currentUserRsvp: null },
                { id: 'evt-past', club_id: 'club-1', title: 'Past Event', description: null, event_type: 'virtual', start_time: '2020-01-01T18:00:00Z', end_time: null, venue_id: null, manual_location: null, meeting_link: null, max_attendees: null, created_by: 'admin-1', created_at: null, updated_at: null, status: 'scheduled', cancelled_at: null, cancelled_by: null, venue: null, creatorProfile: null, currentUserRsvp: null },
            ],
            isLoading: false,
            refetch: jest.fn(),
        });
        mockUseCancelClubEvent.mockReturnValue({ mutateAsync: cancelMutateAsync, isPending: false });

        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
            const cancelButton = buttons?.find((button) => button.text === 'Cancel event');
            cancelButton?.onPress?.();
        });

        const { getByText, getByTestId } = render(<ClubManageScreen />);

        fireEvent.press(getByText('Events'));
        expect(getByText('Upcoming events')).toBeOnTheScreen();
        expect(getByText('Past & cancelled events')).toBeOnTheScreen();

        fireEvent.press(getByTestId('cancel-event-evt-upcoming'));

        await waitFor(() => {
            expect(cancelMutateAsync).toHaveBeenCalledWith({ eventId: 'evt-upcoming', clubId: 'club-1', cancelledBy: 'admin-1' });
        });
        alertSpy.mockRestore();
    });

    it('shows nomination book cover and nominator in the Current Book tab', () => {
        mockUseClubBookNominations.mockReturnValue({
            data: [{
                id: 'nom-1', club_id: 'club-1', book_id: 'book-1', book_title: 'Beloved', nominated_by: 'reader-3', vote_count: 4, status: 'active', voting_ends_at: '2000-01-01T00:00:00Z', created_at: '2026-03-10T00:00:00Z',
                book: { id: 'book-1', google_books_id: 'gb-1', title: 'Beloved', authors: ['Toni Morrison'], cover_url: 'https://example.com/cover.jpg' },
                nominatorProfile: { id: 'profile-3', user_id: 'reader-3', display_name: 'Reader Three', username: 'readerthree', avatar_url: null, trust_score: 4.4, city: 'Bangalore' },
                currentUserVote: null,
            }],
            isLoading: false,
            isError: false,
            error: null,
            refetch: jest.fn(),
        });

        const { getByText, getByTestId } = render(<ClubManageScreen />);

        expect(getByText('Beloved')).toBeOnTheScreen();
        expect(getByText('Nominated by Reader Three')).toBeOnTheScreen();
        expect(getByTestId('manage-current-book-closed-nom-1')).toBeOnTheScreen();
    });

});
