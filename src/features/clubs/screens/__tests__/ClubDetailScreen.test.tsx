import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import ClubDetailScreen from '../ClubDetailScreen';
import { profileService } from '@/features/auth/services/profileService';

const mockRouterBack = jest.fn();
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
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

let mockSearchParams: { clubId: string; tab?: string } = { clubId: 'club-1' };
let mockAuthUser: { id: string } | null = { id: 'reader-1' };

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({
    router: {
        back: (...args: unknown[]) => mockRouterBack(...args),
        push: (...args: unknown[]) => mockRouterPush(...args),
        replace: (...args: unknown[]) => mockRouterReplace(...args),
    },
    useLocalSearchParams: () => mockSearchParams,
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
    useAuth: () => ({ user: mockAuthUser }),
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
    mockSearchParams = { clubId: 'club-1' };
    mockAuthUser = { id: 'reader-1' };
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
    (profileService.getProfileSummary as jest.Mock).mockResolvedValue({ membership_tier: 'pro_plus' });
});

describe('ClubDetailScreen', () => {
    it('shows the Club Home identity hierarchy with restrained metadata', async () => {
        const { getByText, getAllByText, queryByText } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(getByText('Author Circle')).toBeOnTheScreen();
        expect(getByText('Author · Pro+ members · Hybrid · Bengaluru')).toBeOnTheScreen();
        expect(getByText('Discuss monthly author picks.')).toBeOnTheScreen();
        expect(getAllByText('Toni Morrison').length).toBeGreaterThan(0);
        expect(queryByText('About')).toBeNull();
        expect(getByText('Curator Cam')).toBeOnTheScreen();
        expect(getByText('Verified author · Toni Morrison')).toBeOnTheScreen();
    });

    it('exposes a visible back affordance that returns safely to Clubs', async () => {
        const { getByTestId } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        fireEvent.press(getByTestId('club-home-back'));
        expect(mockRouterReplace).toHaveBeenCalledWith('/(tabs)/clubs');
    });

    it('keeps Home free of a redundant local tab row and exposes contextual Books, Discuss, and Events actions', async () => {
        const { getByTestId, queryByTestId } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(queryByTestId('club-home-nav')).toBeNull();
        expect(getByTestId('club-open-books')).toBeOnTheScreen();
        expect(getByTestId('club-home-discuss-entry')).toBeOnTheScreen();
        expect(getByTestId('club-home-readers-entry')).toBeOnTheScreen();
        expect(getByTestId('club-home-events-entry')).toBeOnTheScreen();
    });

    it('styles Discuss and Events as distinct literary destination buttons', async () => {
        const { getByTestId, queryByText } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        const discussStyle = StyleSheet.flatten(getByTestId('club-home-discuss-entry').props.style);
        const eventsStyle = StyleSheet.flatten(getByTestId('club-home-events-entry').props.style);

        expect(discussStyle).toEqual(expect.objectContaining({
            minHeight: 62,
            borderWidth: 1,
            backgroundColor: '#FAEDE9',
        }));
        expect(eventsStyle).toEqual(expect.objectContaining({
            minHeight: 62,
            borderWidth: 1,
            backgroundColor: '#FFF8F6',
        }));
        expect(getByTestId('club-home-discuss-icon').props.name).toBe('chatbubble-outline');
        expect(getByTestId('club-home-events-icon').props.name).toBe('calendar-outline');
        expect(queryByText('Join the conversation')).toBeNull();
        expect(queryByText('See upcoming gatherings')).toBeNull();
    });

    it('does not render the old five-tab home monolith', async () => {
        const { queryByTestId } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(queryByTestId('tab-about')).toBeNull();
        expect(queryByTestId('tab-current-book')).toBeNull();
        expect(queryByTestId('tab-nominations')).toBeNull();
        expect(queryByTestId('tab-events')).toBeNull();
        expect(queryByTestId('tab-discussion')).toBeNull();
    });

    it('navigates Discuss and Events through the existing routes', async () => {
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });

        const { getByTestId } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        fireEvent.press(getByTestId('club-home-discuss-entry'));
        expect(mockRouterPush).toHaveBeenCalledWith('/clubs/club-1/discussion');

        fireEvent.press(getByTestId('club-home-events-entry'));
        expect(mockRouterPush).toHaveBeenCalledWith('/clubs/club-1/events');

        expect(getByTestId('club-home-discuss-entry')).toBeOnTheScreen();
        expect(getByTestId('club-home-events-entry')).toBeOnTheScreen();
    });

    it('does not show the old implementation-status fallback when no description exists', async () => {
        mockUseClubPublicDetail.mockReturnValue({
            data: { ...baseClub, description: null },
            isLoading: false,
            isError: false,
            refetch: jest.fn(),
        });
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });

        const { queryByText, getByText } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(queryByText(/Public club details, discussion entry points, and membership actions are live here/i)).toBeNull();
        expect(queryByText('About')).toBeNull();
        expect(getByText('Author Circle')).toBeOnTheScreen();
    });

    it('shows an active-member home with teaser and Readers row', async () => {
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });

        const { getByText, getByTestId } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(getByText('Member')).toBeOnTheScreen();
        expect(getByTestId('club-leave')).toBeOnTheScreen();
        expect(getByText('Currently reading')).toBeOnTheScreen();
        expect(getByText('Beloved')).toBeOnTheScreen();
        expect(getByTestId('club-open-books')).toBeOnTheScreen();
        expect(getByTestId('club-home-readers-entry')).toBeOnTheScreen();
        expect(getByTestId('club-home-discuss-entry')).toBeOnTheScreen();
        expect(getByTestId('club-home-events-entry')).toBeOnTheScreen();
    });

    it('shows the current-book teaser without analytics on Home', async () => {
        mockUseClubPublicDetail.mockReturnValue({
            data: { ...baseClub, current_book_id: 'book-1', current_book_title: 'Beloved', current_book_authors: ['Toni Morrison'] },
            isLoading: false, isError: false, refetch: jest.fn(),
        });
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
            refetch: jest.fn(),
        });

        const { getByText, queryByText, getByTestId } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(getByText('Beloved')).toBeOnTheScreen();
        expect(getByText('Open in Books →')).toBeOnTheScreen();
        expect(queryByText('Active members')).toBeNull();
        expect(queryByText('Your club reading status')).toBeNull();

        fireEvent.press(getByTestId('club-open-books'));
        await waitFor(() => expect(getByText('Your club reading status')).toBeOnTheScreen());
        expect(getByText('Active members')).toBeOnTheScreen();
    });

    it('shows a neutral no-current-book state on Home', async () => {
        mockUseClubPublicDetail.mockReturnValue({
            data: { ...baseClub, current_book_id: null, current_book_title: null, current_book_authors: null },
            isLoading: false, isError: false, refetch: jest.fn(),
        });
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });

        const { getByTestId, queryByText } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(getByTestId('club-no-current-book')).toBeOnTheScreen();
        expect(getByTestId('club-open-books')).toBeOnTheScreen();
        expect(queryByText('Active members')).toBeNull();

        fireEvent.press(getByTestId('club-open-books'));
        await waitFor(() => expect(getByTestId('club-books-compat')).toBeOnTheScreen());
    });

    it('does not fetch or display discussion/event previews on Home', async () => {
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });

        const { queryByText } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(queryByText(/unread/i)).toBeNull();
        expect(queryByText(/RSVP/i)).toBeNull();
        expect(queryByText(/reply count/i)).toBeNull();
        expect(queryByText(/next event/i)).toBeNull();
    });

    it('keeps Readers private for non-members', async () => {
        mockUseClubMembers.mockReturnValue({
            data: [{
                id: 'm-1', club_id: 'club-1', user_id: 'u-1', role: 'member', status: 'active', joined_at: null,
                profile: { id: 'p-1', user_id: 'u-1', display_name: 'Private Reader', username: 'privatereader', avatar_url: null, trust_score: 4, city: 'Bengaluru' },
            }],
            isLoading: false,
        });

        const { getByText, queryByText } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(getByText('Member list is private')).toBeOnTheScreen();
        expect(queryByText('Private Reader')).toBeNull();
    });

    it('lets members expand the Readers row to reach the existing member list', async () => {
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });
        mockUseClubMembers.mockReturnValue({
            data: [{
                id: 'm-1', club_id: 'club-1', user_id: 'u-1', role: 'member', status: 'active', joined_at: null,
                profile: { id: 'p-1', user_id: 'u-1', display_name: 'Visible Reader', username: 'visiblereader', avatar_url: null, trust_score: 4, city: 'Bengaluru' },
            }],
            isLoading: false,
        });

        const { getByTestId, getByText, queryByText } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(queryByText('Visible Reader')).toBeNull();
        fireEvent.press(getByTestId('club-home-readers-entry'));
        expect(getByTestId('club-member-list')).toBeOnTheScreen();
        expect(getByText('Visible Reader')).toBeOnTheScreen();
    });

    it('shows signed-out membership state without a fake join action', async () => {
        mockAuthUser = null;

        const { getByText, queryByTestId } = render(<ClubDetailScreen />);

        expect(getByText('Sign in required')).toBeOnTheScreen();
        expect(queryByTestId('club-primary-action')).toBeNull();
    });

    it('shows Join for public non-members', async () => {
        mockUseClubPublicDetail.mockReturnValue({
            data: { ...baseClub, club_type: 'public', access_level: 'all', author_id: null, author_user_id: null, author_display_name: null, author_avatar_url: null, author_city: null },
            isLoading: false, isError: false, refetch: jest.fn(),
        });
        (profileService.getProfileSummary as jest.Mock).mockResolvedValue({ membership_tier: 'free' });

        const { getByTestId, getByText } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(getByTestId('club-primary-action')).toBeOnTheScreen();
        expect(getByText('Join this club')).toBeOnTheScreen();
    });

    it('shows Apply with join questions for approval clubs', async () => {
        mockUseClubPublicDetail.mockReturnValue({
            data: { ...baseClub, club_type: 'approval', author_id: null, author_user_id: null, author_display_name: null, author_avatar_url: null, author_city: null },
            isLoading: false, isError: false, refetch: jest.fn(),
        });
        mockUseClubJoinQuestions.mockReturnValue({
            data: [{ id: 'q-1', club_id: 'club-1', question: 'Why do you want to join?', is_required: true, order_index: 0 }],
            isLoading: false,
        });

        const { getByTestId, getByText } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(getByText('Join questions')).toBeOnTheScreen();
        expect(getByTestId('join-question-q-1')).toBeOnTheScreen();
        expect(getByText('Apply to join')).toBeOnTheScreen();
    });

    it('shows application pending without a duplicate Apply CTA', async () => {
        mockUseClubPublicDetail.mockReturnValue({
            data: { ...baseClub, club_type: 'approval', author_id: null, author_user_id: null, author_display_name: null, author_avatar_url: null, author_city: null },
            isLoading: false, isError: false, refetch: jest.fn(),
        });
        mockUseMyClubApplication.mockReturnValue({ data: { status: 'pending', answers: {} }, isLoading: false });

        const { getByText, queryByTestId } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(getByText('Application pending')).toBeOnTheScreen();
        expect(queryByTestId('club-primary-action')).toBeNull();
    });

    it('shows declined applications with the reviewer reason', async () => {
        mockUseClubPublicDetail.mockReturnValue({
            data: { ...baseClub, club_type: 'approval', author_id: null, author_user_id: null, author_display_name: null, author_avatar_url: null, author_city: null },
            isLoading: false, isError: false, refetch: jest.fn(),
        });
        mockUseMyClubApplication.mockReturnValue({ data: { status: 'declined', decline_reason: 'Not a fit right now.', answers: {} }, isLoading: false });

        const { getByText } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(getByText('Application declined')).toBeOnTheScreen();
        expect(getByText('Not a fit right now.')).toBeOnTheScreen();
    });

    it('shows muted members read-only state with Leave still reachable', async () => {
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'muted' }, isLoading: false });

        const { getByText, getByTestId } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(getByText('Muted member')).toBeOnTheScreen();
        expect(getByText(/read-only access/i)).toBeOnTheScreen();
        expect(getByTestId('club-leave')).toBeOnTheScreen();
    });

    it('shows banned members a restricted state with no join action', async () => {
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'banned' }, isLoading: false });

        const { getByText, queryByTestId } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(getByText('Membership restricted')).toBeOnTheScreen();
        expect(queryByTestId('club-primary-action')).toBeNull();
        expect(queryByTestId('club-accept-invitation')).toBeNull();
    });

    it('lets a proposed successor accept a pending admin transfer from club detail', async () => {
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });
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

    it('shows transfer failure feedback to an active member', async () => {
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });
        mockUseClubAdminTransferRequests.mockReturnValue({
            data: [{ id: 'transfer-1', club_id: 'club-1', proposed_admin_user_id: 'reader-1', status: 'pending' }],
            isLoading: false, refetch: jest.fn(),
        });
        mockUseAcceptClubAdminTransferRequest.mockReturnValue({
            mutateAsync: jest.fn().mockRejectedValue(new Error('Transfer expired.')), isPending: false,
        });
        const { getByTestId, getByText } = render(<ClubDetailScreen />);
        fireEvent.press(getByTestId('club-accept-admin-transfer'));
        await waitFor(() => expect(getByText('Transfer expired.')).toBeOnTheScreen());
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

        expect(getByText('Club tools')).toBeOnTheScreen();
        expect(getByText('Invitation tools')).toBeOnTheScreen();
        expect(getByText(/Username-based invitation creation, invitation history, revocation, and read tracking are wired to the live invite backend\./i)).toBeOnTheScreen();
    });

    it('shows Review applications only for eligible managers', async () => {
        mockUseClubMembership.mockReturnValue({ data: { role: 'moderator', status: 'active' }, isLoading: false });

        const { getByTestId } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(getByTestId('club-review-applications')).toBeOnTheScreen();
    });

    it('hides manager tools from ordinary members', async () => {
        mockUseClubPublicDetail.mockReturnValue({
            data: { ...baseClub, club_type: 'public', access_level: 'all' },
            isLoading: false, isError: false, refetch: jest.fn(),
        });
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });

        const { queryByTestId } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(queryByTestId('club-tools')).toBeNull();
        expect(queryByTestId('club-manage')).toBeNull();
        expect(queryByTestId('club-review-applications')).toBeNull();
        expect(queryByTestId('club-invite-readers')).toBeNull();
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

    it('opens Books compatibility and lets a member cast a vote', async () => {
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

        fireEvent.press(getByTestId('club-open-books'));
        await waitFor(() => expect(getByText('Book nominations & voting')).toBeOnTheScreen());

        expect(getByText('Nominated by Curator Cam')).toBeOnTheScreen();
        expect(getByText('Vote for this book')).toBeOnTheScreen();

        fireEvent.press(getByTestId('club-book-vote-nomination-1'));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ nominationId: 'nomination-1', clubId: 'club-1' }));
    });

    it('shows current-book analytics in Books compat and lets an active member update status', async () => {
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

        fireEvent.press(getByTestId('club-open-books'));
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

        fireEvent.press(getByTestId('club-open-books'));
        await waitFor(() => expect(getByText('Your club reading status')).toBeOnTheScreen());

        expect(getByText('Current status: Completed')).toBeOnTheScreen();
        expect(getByText(/Muted members can still view club progress/i)).toBeOnTheScreen();
        expect(queryByTestId('club-current-book-status-want_to_read')).toBeNull();
        expect(queryByTestId('club-current-book-status-reading')).toBeNull();
        expect(queryByTestId('club-current-book-status-completed')).toBeNull();
    });

    it('keeps current-book analytics hidden on Home when no current book is selected', async () => {
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });

        const { queryByText, queryByTestId } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(queryByText('Active members')).toBeNull();
        expect(queryByText('Your club reading status')).toBeNull();
        expect(queryByTestId('club-current-book-status-want_to_read')).toBeNull();
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

    it('opens the Books compat reading progress entry point for active members', async () => {
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

        fireEvent.press(getByTestId('club-open-books'));
        expect(getByTestId('club-view-reading-progress')).toBeOnTheScreen();
    });

    it('navigates to the reading progress screen from Books compat', async () => {
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

        fireEvent.press(getByTestId('club-open-books'));
        fireEvent.press(getByTestId('club-view-reading-progress'));

        expect(mockRouterPush).toHaveBeenCalledWith('/clubs/club-1/reading');
    });

    it('shows a custom leave confirmation modal when Leave club is tapped', async () => {
        const mutateAsync = jest.fn().mockResolvedValue(undefined);
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });
        mockUseLeaveClub.mockReturnValue({ mutateAsync, isPending: false });

        const { getByTestId, queryByTestId } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(queryByTestId('leave-confirm-modal')).toBeNull();
        fireEvent.press(getByTestId('club-leave'));
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

        await waitFor(() => expect(queryByTestId('leave-confirm-modal')).toBeNull());
        await waitFor(() => {
            expect(mutateAsync).toHaveBeenCalledWith({ clubId: 'club-1', userId: 'reader-1' });
        });
        expect(mockRouterPush).toHaveBeenCalledWith('/clubs');
    });

    it.each(['active', 'muted'])('shows leave failure feedback to a %s member without navigating away', async (status) => {
        const mutateAsync = jest.fn().mockRejectedValue(new Error('Unable to leave this club right now.'));
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status }, isLoading: false });
        mockUseLeaveClub.mockReturnValue({ mutateAsync, isPending: false });
        const { getByTestId, getByText, queryByTestId } = render(<ClubDetailScreen />);
        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));
        fireEvent.press(getByTestId('club-leave'));
        fireEvent.press(getByTestId('leave-confirm-leave'));
        await waitFor(() => expect(getByText('Unable to leave this club right now.')).toBeOnTheScreen());
        expect(queryByTestId('leave-confirm-modal')).toBeNull();
        expect(mockRouterPush).not.toHaveBeenCalled();
    });

    it('shows the nomination entry point in Books compat for active members', async () => {
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });

        const { getByTestId } = render(<ClubDetailScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        fireEvent.press(getByTestId('club-open-books'));
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

        fireEvent.press(getByTestId('club-open-books'));
        expect(queryByTestId('club-book-finalize-nomination-2')).toBeNull();
        expect(getByText('Voting has closed')).toBeOnTheScreen();
        expect(queryByText(/Eligible managers finalize the current book from Manage Club after voting closes/i)).toBeNull();
        expect(queryByText('Finalize becomes available after voting closes.')).toBeNull();
        expect(queryByText('Voting has closed. You can now finalize the current book.')).toBeNull();
    });

    it('preserves ?tab=current-book deep links through Books compat', async () => {
        mockSearchParams = { clubId: 'club-1', tab: 'current-book' };
        mockUseClubPublicDetail.mockReturnValue({
            data: { ...baseClub, current_book_id: 'book-1', current_book_title: 'Beloved', current_book_authors: ['Toni Morrison'] },
            isLoading: false, isError: false, refetch: jest.fn(),
        });
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });
        mockUseClubCurrentBookStatusOverview.mockReturnValue({
            data: { current_book_id: 'book-1', member_reading_status: 'reading', to_start_count: 1, reading_count: 2, completed_count: 3, active_member_count: 6 },
            isLoading: false, isError: false, error: null, refetch: jest.fn(),
        });

        const { getByTestId, getByText } = render(<ClubDetailScreen />);

        await waitFor(() => expect(getByTestId('club-books-compat')).toBeOnTheScreen());
        expect(getByTestId('club-books-current')).toBeOnTheScreen();
        expect(getByText('Your club reading status')).toBeOnTheScreen();
    });

    it('preserves ?tab=nominations deep links through Books compat', async () => {
        mockSearchParams = { clubId: 'club-1', tab: 'nominations' };
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });
        mockUseClubBookNominations.mockReturnValue({
            data: [{
                id: 'nomination-9', club_id: 'club-1', book_id: 'book-9', nominated_by: 'reader-2', vote_count: 1, status: 'active', voting_ends_at: null, created_at: '2026-03-10T00:00:00Z',
                book: { id: 'book-9', google_books_id: 'gb-9', title: 'Jazz', authors: ['Toni Morrison'], cover_url: null },
                nominatorProfile: { id: 'profile-2', user_id: 'reader-2', display_name: 'Reader Two', username: 'readertwo', avatar_url: null, trust_score: 4.1, city: 'Bengaluru' },
                currentUserVote: null,
            }],
            isLoading: false, isError: false, error: null, refetch: jest.fn(),
        });

        const { getByTestId, getByText } = render(<ClubDetailScreen />);

        await waitFor(() => expect(getByTestId('club-books-compat')).toBeOnTheScreen());
        expect(getByTestId('club-books-nominations')).toBeOnTheScreen();
        expect(getByText('Book nominations & voting')).toBeOnTheScreen();
    });
});
