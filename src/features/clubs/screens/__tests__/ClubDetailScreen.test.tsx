import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ClubDetailScreen from '../ClubDetailScreen';
import { profileService } from '@/features/auth/services/profileService';



const mockRouterBack = jest.fn();
const mockRouterPush = jest.fn();
const mockUseClubPublicDetail = jest.fn();
const mockUseJoinClub = jest.fn();
const mockUseAcceptClubInvitation = jest.fn();
const mockUseClubMembership = jest.fn();
const mockUseClubJoinQuestions = jest.fn();
const mockUseMyClubApplication = jest.fn();
const mockUseMyClubInvitation = jest.fn();
const mockUseClubMembers = jest.fn();
const mockUseClubBookNominations = jest.fn();
const mockUseClubCurrentBookStatusOverview = jest.fn();
const mockUseCastClubBookVote = jest.fn();
const mockUseRemoveClubBookVote = jest.fn();
const mockUseSetClubCurrentBookReadingStatus = jest.fn();
const mockUseLeaveClub = jest.fn();
const mockUseClubAdminTransferRequests = jest.fn();
const mockUseAcceptClubAdminTransferRequest = jest.fn();

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({
    router: { back: (...args: unknown[]) => mockRouterBack(...args), push: (...args: unknown[]) => mockRouterPush(...args) },
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
    useAuth: () => ({ user: { id: 'reader-1' } }),
}));
jest.mock('@/features/auth/services/profileService', () => ({
    profileService: {
        getProfileSummary: jest.fn(),
    },
}));
jest.mock('@/features/clubs/hooks/useClubs', () => ({
    useClubPublicDetail: (...args: unknown[]) => mockUseClubPublicDetail(...args),
    useJoinClub: (...args: unknown[]) => mockUseJoinClub(...args),
    useAcceptClubInvitation: (...args: unknown[]) => mockUseAcceptClubInvitation(...args),
    useClubMembership: (...args: unknown[]) => mockUseClubMembership(...args),
    useClubJoinQuestions: (...args: unknown[]) => mockUseClubJoinQuestions(...args),
    useMyClubApplication: (...args: unknown[]) => mockUseMyClubApplication(...args),
    useMyClubInvitation: (...args: unknown[]) => mockUseMyClubInvitation(...args),
    useClubMembers: (...args: unknown[]) => mockUseClubMembers(...args),
    useClubBookNominations: (...args: unknown[]) => mockUseClubBookNominations(...args),
    useClubCurrentBookStatusOverview: (...args: unknown[]) => mockUseClubCurrentBookStatusOverview(...args),
    useCastClubBookVote: (...args: unknown[]) => mockUseCastClubBookVote(...args),
    useRemoveClubBookVote: (...args: unknown[]) => mockUseRemoveClubBookVote(...args),
    useSetClubCurrentBookReadingStatus: (...args: unknown[]) => mockUseSetClubCurrentBookReadingStatus(...args),
    useLeaveClub: (...args: unknown[]) => mockUseLeaveClub(...args),
    useClubAdminTransferRequests: (...args: unknown[]) => mockUseClubAdminTransferRequests(...args),
    useAcceptClubAdminTransferRequest: (...args: unknown[]) => mockUseAcceptClubAdminTransferRequest(...args),
}));

const baseClub = {
    id: 'club-1', name: 'Author Circle', description: 'Discuss monthly author picks.', cover_url: null, club_type: 'author_club',
    access_level: 'pro_plus', meeting_type: 'hybrid', member_count: 12, max_members: 20,
    current_book_id: null, current_book_google_books_id: null, current_book_title: 'Beloved', current_book_authors: ['Toni Morrison'],
    current_book_cover_url: null, current_book_retail_price: null, current_book_currency_code: null,
    admin_id: 'admin-1', admin_profile_id: 'profile-1', admin_display_name: 'Curator Cam', admin_avatar_url: null, admin_city: 'Bengaluru',
    author_id: 'author-1', author_user_id: 'author-user-1', author_display_name: 'Toni Morrison', author_avatar_url: null, author_city: 'Bengaluru',
    created_at: null, updated_at: null,
};

beforeEach(() => {
    jest.clearAllMocks();
    mockUseClubPublicDetail.mockReturnValue({
        data: baseClub,
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
    });
    mockUseJoinClub.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseAcceptClubInvitation.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseClubMembership.mockReturnValue({ data: null, isLoading: false });
    mockUseClubJoinQuestions.mockReturnValue({ data: [], isLoading: false });
    mockUseMyClubApplication.mockReturnValue({ data: null, isLoading: false });
    mockUseMyClubInvitation.mockReturnValue({ data: null, isLoading: false });
    mockUseClubMembers.mockReturnValue({ data: [], isLoading: false });
    mockUseClubBookNominations.mockReturnValue({ data: [], isLoading: false, isError: false, error: null, refetch: jest.fn() });
    mockUseClubCurrentBookStatusOverview.mockReturnValue({ data: null, isLoading: false, isError: false, error: null, refetch: jest.fn() });
    mockUseCastClubBookVote.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseRemoveClubBookVote.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseSetClubCurrentBookReadingStatus.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseLeaveClub.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseClubAdminTransferRequests.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
    mockUseAcceptClubAdminTransferRequest.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseClubCurrentBookStatusOverview.mockReturnValue({ data: null, isLoading: false, isError: false, error: null });
    (profileService.getProfileSummary as jest.Mock).mockResolvedValue({ membership_tier: 'pro_plus' });
});

describe('ClubDetailScreen', () => {
    it('shows the live public metadata summary for access, meeting format, and curator details', async () => {
        const { getByText, getAllByText } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(getByText('Club details')).toBeOnTheScreen();
        expect(getByText('Access requirement')).toBeOnTheScreen();
        expect(getAllByText('Pro+ members').length).toBeGreaterThan(0);
        expect(getByText('Meeting format')).toBeOnTheScreen();
        expect(getAllByText('Hybrid').length).toBeGreaterThan(0);
        expect(getByText('Club admin')).toBeOnTheScreen();
        expect(getByText('Curator Cam')).toBeOnTheScreen();
        expect(getByText('Verified author')).toBeOnTheScreen();
        expect(getAllByText('Toni Morrison').length).toBeGreaterThan(0);
    });

    it('lets a proposed successor accept a pending admin transfer from club detail', async () => {
        const mutateAsync = jest.fn().mockResolvedValue({ id: 'club-1' });
        const refetchTransfers = jest.fn().mockResolvedValue({ data: [] });
        const refetchClub = jest.fn().mockResolvedValue({ data: baseClub });
        mockUseClubPublicDetail.mockReturnValue({ data: baseClub, isLoading: false, isError: false, refetch: refetchClub });
        mockUseClubAdminTransferRequests.mockReturnValue({
            data: [{
                id: 'transfer-1',
                club_id: 'club-1',
                requested_by: 'admin-1',
                proposed_admin_user_id: 'reader-1',
                status: 'pending',
                created_at: '2026-05-29T00:00:00Z',
                responded_at: null,
                expires_at: '2026-06-05T00:00:00Z',
            }],
            isLoading: false,
            refetch: refetchTransfers,
        });
        mockUseAcceptClubAdminTransferRequest.mockReturnValue({ mutateAsync, isPending: false });

        const { getByTestId, getByText } = render(<ClubDetailScreen />);

        fireEvent.press(getByTestId('club-accept-admin-transfer'));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ clubId: 'club-1', requestId: 'transfer-1' }));
        expect(refetchClub).toHaveBeenCalled();
        expect(refetchTransfers).toHaveBeenCalled();
        expect(getByText('You are now the club admin.')).toBeOnTheScreen();
    });

    it('uses the live discussion copy for fallback public and member-only messaging', async () => {
        mockUseClubPublicDetail.mockReturnValue({
            data: { ...baseClub, description: null },
            isLoading: false,
            isError: false,
            refetch: jest.fn(),
        });
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });

        const { getByText, getByTestId } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(getByText(/Public club details, discussion entry points, and membership actions are live here\. Join to take part in member-only discussion, events, and current-book decisions\./i)).toBeOnTheScreen();
        expect(getByText(/Member-only spaces like discussion, club events, nominations, and the private member list are available here now\./i)).toBeOnTheScreen();
        fireEvent.press(getByTestId('tab-discussion'));
        expect(getByText(/Member-only discussion is now live here\. Active members can start topics and reply, while muted members can still read the conversation and keep up with unread activity\./i)).toBeOnTheScreen();
    });

    it('opens the club discussion route from the member discussion card', async () => {
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });

        const { getByTestId } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        fireEvent.press(getByTestId('tab-discussion'));
        fireEvent.press(getByTestId('club-view-discussion'));

        expect(mockRouterPush).toHaveBeenCalledWith('/clubs/club-1/discussion');
    });

    it('keeps current-book analytics and status controls hidden when no current book is selected', async () => {
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });

        const { queryByText, queryByTestId } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(queryByText('Active members')).toBeNull();
        expect(queryByText('Your club reading status')).toBeNull();
        expect(queryByTestId('club-current-book-status-want_to_read')).toBeNull();
    });

    it('shows invite acceptance UI when the signed-in user has a pending invite-only invitation', async () => {
        mockUseClubPublicDetail.mockReturnValue({
            data: {
                ...baseClub,
                id: 'club-invite',
                name: 'Invite Circle',
                club_type: 'invite_only',
                author_id: null,
                author_user_id: null,
                author_display_name: null,
                author_avatar_url: null,
                author_city: null,
            },
            isLoading: false,
            isError: false,
            refetch: jest.fn(),
        });
        mockUseMyClubInvitation.mockReturnValue({
            data: {
                id: 'invite-1',
                club_id: 'club-invite',
                inviter_user_id: 'admin-1',
                invitee_user_id: 'reader-1',
                status: 'pending',
                note: 'Come join our private read.',
                created_at: '2026-03-06T00:00:00Z',
                responded_at: null,
                inviterProfile: { id: 'profile-1', user_id: 'admin-1', display_name: 'Curator Cam', username: 'curatorcam', avatar_url: null, trust_score: 4.8, city: 'Bengaluru' },
                inviteeProfile: { id: 'profile-2', user_id: 'reader-1', display_name: 'Reader One', username: 'readerone', avatar_url: null, trust_score: 4.2, city: 'Bengaluru' },
            },
            isLoading: false,
        });

        const { getByText } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(getByText('Invitation ready')).toBeOnTheScreen();
        expect(getByText(/pending invitation from Curator Cam/i)).toBeOnTheScreen();
        expect(getByText('Accept invitation')).toBeOnTheScreen();
        expect(getByText('Note: Come join our private read.')).toBeOnTheScreen();
    });

    it('describes invite-only clubs without claiming invite workflows are backend-blocked', async () => {
        mockUseClubPublicDetail.mockReturnValue({
            data: {
                ...baseClub,
                id: 'club-invite',
                club_type: 'invite_only',
                author_id: null,
                author_user_id: null,
                author_display_name: null,
                author_avatar_url: null,
                author_city: null,
            },
            isLoading: false,
            isError: false,
            refetch: jest.fn(),
        });

        const { getByText, queryByText } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(getByText('Invite required')).toBeOnTheScreen();
        expect(getByText(/Invite-only clubs require a moderator or admin invitation\. If you have already been invited, sign in with the invited account to accept it here\./i)).toBeOnTheScreen();
        expect(queryByText(/still depend on backend support/i)).toBeNull();
    });

    it('describes manager invitation tools as live for revocation and read tracking', async () => {
        mockUseClubPublicDetail.mockReturnValue({
            data: {
                ...baseClub,
                id: 'club-invite',
                club_type: 'invite_only',
                admin_id: 'admin-1',
                author_id: null,
                author_user_id: null,
                author_display_name: null,
                author_avatar_url: null,
                author_city: null,
            },
            isLoading: false,
            isError: false,
            refetch: jest.fn(),
        });
        mockUseClubMembership.mockReturnValue({ data: { role: 'moderator', status: 'active' }, isLoading: false });

        const { getByText } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(getByText('Invitation tools')).toBeOnTheScreen();
        expect(getByText(/Username-based invitation creation, invitation history, revocation, and read tracking are wired to the live invite backend\./i)).toBeOnTheScreen();
    });

    it('shows the Manage Club entry point for admins with current-book guidance', async () => {
        mockUseClubMembership.mockReturnValue({ data: { role: 'admin', status: 'active' }, isLoading: false });

        const { getByText } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(getByText('Club management')).toBeOnTheScreen();
        expect(getByText(/current-book management, plus the existing basic settings, member-role management, remove-member workflows, and join-question management/i)).toBeOnTheScreen();
        expect(getByText('Manage club')).toBeOnTheScreen();
    });

    it('shows the Manage Club entry point for active moderators without exposing admin-only scope on the detail page', async () => {
        mockUseClubMembership.mockReturnValue({ data: { role: 'moderator', status: 'active' }, isLoading: false });

        const { getByText } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(getByText('Club management')).toBeOnTheScreen();
        expect(getByText(/finalize the current book after voting closes/i)).toBeOnTheScreen();
        expect(getByText('Manage club')).toBeOnTheScreen();
    });

    it('shows an entitlement warning when the current user tier does not meet the club access level', async () => {
        (profileService.getProfileSummary as jest.Mock).mockResolvedValueOnce({ membership_tier: 'free' });

        const { findByTestId, getByText } = render(<ClubDetailScreen />);

        expect(await findByTestId('club-entitlement-warning')).toBeOnTheScreen();
        expect(getByText(/cannot become active until your subscription tier meets that requirement/i)).toBeOnTheScreen();
    });

    it('shows member nominations and lets a member cast a vote', async () => {
        const mutateAsync = jest.fn().mockResolvedValue({ nomination_id: 'nomination-1', user_id: 'reader-1' });
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });
        mockUseClubBookNominations.mockReturnValue({
            data: [{
                id: 'nomination-1', club_id: 'club-1', book_id: 'book-1', nominated_by: 'admin-1', vote_count: 2, status: 'active', voting_ends_at: null, created_at: '2026-03-10T00:00:00Z',
                book: { id: 'book-1', google_books_id: 'gb-1', title: 'Beloved', authors: ['Toni Morrison'], cover_url: 'https://books.example/beloved.jpg' },
                nominatorProfile: { id: 'profile-1', user_id: 'admin-1', display_name: 'Curator Cam', username: 'curatorcam', avatar_url: null, trust_score: 4.8, city: 'Bengaluru' },
                currentUserVote: null,
            }],
            isLoading: false,
            isError: false,
            error: null,
            refetch: jest.fn(),
        });
        mockUseCastClubBookVote.mockReturnValue({ mutateAsync, isPending: false });

        const { getByText, getByTestId } = render(<ClubDetailScreen />);

        fireEvent.press(getByTestId('tab-nominations'));
        await waitFor(() => expect(getByText('Book nominations & voting')).toBeOnTheScreen());

        expect(getByText('Nominated by Curator Cam')).toBeOnTheScreen();
        expect(getByText('Vote for this book')).toBeOnTheScreen();

        fireEvent.press(getByTestId('club-book-vote-nomination-1'));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ nominationId: 'nomination-1', clubId: 'club-1' }));
    });

    it('shows current-book analytics and lets an active member update status', async () => {
        const mutateAsync = jest.fn().mockResolvedValue({
            current_book_id: 'book-1',
            member_reading_status: 'reading',
            to_start_count: 3,
            reading_count: 5,
            completed_count: 4,
            active_member_count: 12,
        });
        mockUseClubPublicDetail.mockReturnValue({
            data: {
                ...baseClub,
                current_book_id: 'book-1',
            },
            isLoading: false,
            isError: false,
            refetch: jest.fn(),
        });
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });
        mockUseClubCurrentBookStatusOverview.mockReturnValue({
            data: {
                current_book_id: 'book-1',
                member_reading_status: 'want_to_read',
                to_start_count: 3,
                reading_count: 5,
                completed_count: 4,
                active_member_count: 12,
            },
            isLoading: false,
            isError: false,
            error: null,
            refetch: jest.fn(),
        });
        mockUseSetClubCurrentBookReadingStatus.mockReturnValue({ mutateAsync, isPending: false });

        const { getByText, getByTestId } = render(<ClubDetailScreen />);

        fireEvent.press(getByTestId('tab-current-book'));
        await waitFor(() => expect(getByText('Your club reading status')).toBeOnTheScreen());

        expect(getByText('Active members')).toBeOnTheScreen();
        expect(getByText('Current status: To start')).toBeOnTheScreen();
        expect(getByTestId('club-current-book-status-want_to_read')).toBeOnTheScreen();
        expect(getByTestId('club-current-book-status-reading')).toBeOnTheScreen();
        expect(getByTestId('club-current-book-status-completed')).toBeOnTheScreen();

        fireEvent.press(getByTestId('club-current-book-status-reading'));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ clubId: 'club-1', status: 'reading' }));
    });

    it('shows current-book analytics but keeps status controls read-only for muted members', async () => {
        mockUseClubPublicDetail.mockReturnValue({
            data: {
                ...baseClub,
                current_book_id: 'book-1',
            },
            isLoading: false,
            isError: false,
            refetch: jest.fn(),
        });
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'muted' }, isLoading: false });
        mockUseClubCurrentBookStatusOverview.mockReturnValue({
            data: {
                current_book_id: 'book-1',
                member_reading_status: 'completed',
                to_start_count: 2,
                reading_count: 3,
                completed_count: 7,
                active_member_count: 12,
            },
            isLoading: false,
            isError: false,
            error: null,
            refetch: jest.fn(),
        });

        const { getByText, getByTestId, queryByTestId } = render(<ClubDetailScreen />);

        fireEvent.press(getByTestId('tab-current-book'));
        await waitFor(() => expect(getByText('Your club reading status')).toBeOnTheScreen());

        expect(getByText('Current status: Completed')).toBeOnTheScreen();
        expect(getByText(/Muted members can still view club progress/i)).toBeOnTheScreen();
        expect(queryByTestId('club-current-book-status-want_to_read')).toBeNull();
        expect(queryByTestId('club-current-book-status-reading')).toBeNull();
        expect(queryByTestId('club-current-book-status-completed')).toBeNull();
    });

    it('shows a Leave Club button for active members', async () => {
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });

        const { getByTestId } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(getByTestId('club-leave')).toBeOnTheScreen();
    });

    it('shows a Leave Club button for muted members', async () => {
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'muted' }, isLoading: false });

        const { getByTestId } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(getByTestId('club-leave')).toBeOnTheScreen();
    });

    it('shows a reading progress entry point for active members when there is a current book', async () => {
        mockUseClubPublicDetail.mockReturnValue({ data: { ...baseClub, current_book_id: 'book-1', current_book_title: 'Beloved', current_book_authors: ['Toni Morrison'] }, isLoading: false, isError: false, error: null });
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });
        mockUseClubCurrentBookStatusOverview.mockReturnValue({
            data: {
                current_book_id: 'book-1',
                member_reading_status: 'want_to_read',
                to_start_count: 3,
                reading_count: 2,
                completed_count: 1,
                active_member_count: 6,
            },
            isLoading: false,
            isError: false,
            error: null,
        });

        const { getByTestId } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        fireEvent.press(getByTestId('tab-current-book'));
        expect(getByTestId('club-view-reading-progress')).toBeOnTheScreen();
    });

    it('navigates to the reading progress screen from the current-book tab', async () => {
        mockUseClubPublicDetail.mockReturnValue({ data: { ...baseClub, current_book_id: 'book-1', current_book_title: 'Beloved', current_book_authors: ['Toni Morrison'] }, isLoading: false, isError: false, error: null });
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });
        mockUseClubCurrentBookStatusOverview.mockReturnValue({
            data: {
                current_book_id: 'book-1',
                member_reading_status: 'want_to_read',
                to_start_count: 3,
                reading_count: 2,
                completed_count: 1,
                active_member_count: 6,
            },
            isLoading: false,
            isError: false,
            error: null,
        });

        const { getByTestId } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        fireEvent.press(getByTestId('tab-current-book'));
        fireEvent.press(getByTestId('club-view-reading-progress'));

        expect(mockRouterPush).toHaveBeenCalledWith('/clubs/club-1/reading');
    });

    it('shows a custom leave confirmation modal when Leave club is tapped', async () => {
        const mutateAsync = jest.fn().mockResolvedValue(undefined);
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });
        mockUseLeaveClub.mockReturnValue({ mutateAsync, isPending: false });

        const { getByTestId, queryByTestId } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        // Modal should not be visible initially
        expect(queryByTestId('leave-confirm-modal')).toBeNull();

        // Tap Leave club button
        fireEvent.press(getByTestId('club-leave'));

        // Modal should now be visible with title, message, and two buttons
        await waitFor(() => expect(getByTestId('leave-confirm-modal')).toBeOnTheScreen());
        expect(getByTestId('leave-confirm-cancel')).toBeOnTheScreen();
        expect(getByTestId('leave-confirm-leave')).toBeOnTheScreen();
    });

    it('cancels leave when Cancel is tapped in the confirmation modal', async () => {
        const mutateAsync = jest.fn().mockResolvedValue(undefined);
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });
        mockUseLeaveClub.mockReturnValue({ mutateAsync, isPending: false });

        const { getByTestId, queryByTestId } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        fireEvent.press(getByTestId('club-leave'));
        await waitFor(() => expect(getByTestId('leave-confirm-modal')).toBeOnTheScreen());

        fireEvent.press(getByTestId('leave-confirm-cancel'));

        // Modal should be dismissed, mutation should NOT be called
        await waitFor(() => expect(queryByTestId('leave-confirm-modal')).toBeNull());
        expect(mutateAsync).not.toHaveBeenCalled();
    });

    it('leaves the club and navigates to browse when Leave Club is confirmed in modal', async () => {
        const mutateAsync = jest.fn().mockResolvedValue(undefined);
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });
        mockUseLeaveClub.mockReturnValue({ mutateAsync, isPending: false });

        const { getByTestId, queryByTestId } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        fireEvent.press(getByTestId('club-leave'));
        await waitFor(() => expect(getByTestId('leave-confirm-modal')).toBeOnTheScreen());

        fireEvent.press(getByTestId('leave-confirm-leave'));

        // Modal should dismiss, mutation fires, navigation happens
        await waitFor(() => expect(queryByTestId('leave-confirm-modal')).toBeNull());
        await waitFor(() => {
            expect(mutateAsync).toHaveBeenCalledWith({ clubId: 'club-1', userId: 'reader-1' });
        });
        expect(mockRouterPush).toHaveBeenCalledWith('/clubs');
    });

    it('shows the nomination entry point for active members', async () => {
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });

        const { getByTestId } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        fireEvent.press(getByTestId('tab-nominations'));
        fireEvent.press(getByTestId('club-nominate-book'));

        expect(mockRouterPush).toHaveBeenCalledWith('/clubs/club-1/nominate');
    });

    it('keeps finalization controls off the main club page even after voting has closed', async () => {
        mockUseClubMembership.mockReturnValue({ data: { role: 'admin', status: 'active' }, isLoading: false });
        mockUseClubBookNominations.mockReturnValue({
            data: [{
                id: 'nomination-2', club_id: 'club-1', book_id: 'book-2', nominated_by: 'reader-2', vote_count: 5, status: 'active', voting_ends_at: '2000-01-01T00:00:00Z', created_at: '2026-03-10T00:00:00Z',
                book: { id: 'book-2', google_books_id: 'gb-2', title: 'Song of Solomon', authors: ['Toni Morrison'], cover_url: null },
                nominatorProfile: { id: 'profile-2', user_id: 'reader-2', display_name: 'Reader Two', username: 'readertwo', avatar_url: null, trust_score: 4.1, city: 'Bengaluru' },
                currentUserVote: null,
            }],
            isLoading: false,
            isError: false,
            error: null,
            refetch: jest.fn(),
        });

        const { getByText, getByTestId, queryByTestId, queryByText } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        fireEvent.press(getByTestId('tab-nominations'));
        expect(queryByTestId('club-book-finalize-nomination-2')).toBeNull();
        expect(getByText('Voting has closed')).toBeOnTheScreen();
        expect(queryByText(/Eligible managers finalize the current book from Manage Club after voting closes/i)).toBeNull();
        expect(queryByText('Finalize becomes available after voting closes.')).toBeNull();
        expect(queryByText('Voting has closed. You can now finalize the current book.')).toBeNull();
    });
});
