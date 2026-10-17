import { Alert, Platform, View } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { clubsService } from '@/features/clubs/services/clubsService';
import ClubManageScreen from '../ClubManageScreen';

let mockUserId = 'admin-1';
const mockRouterPush = jest.fn();
const mockUseClubPublicDetail = jest.fn();
const mockUseClubReadingSchedule = jest.fn();
const mockUseUpsertClubReadingSchedule = jest.fn();
const mockUseArchiveClub = jest.fn();
const mockUseUnarchiveClub = jest.fn();
const mockUseClubAdminTransferRequests = jest.fn();
const mockUseRequestClubAdminTransfer = jest.fn();
const mockUseClubMemberActions = jest.fn();
const mockUseCreateClubMemberAction = jest.fn();
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
const mockUseRevokeClubInvitation = jest.fn();
const mockUseClubEvents = jest.fn();
const mockUseClubEventVenues = jest.fn();
const mockUseAddClubVenueLink = jest.fn();
const mockUseRemoveClubVenueLink = jest.fn();
const mockUseSetPrimaryClubVenue = jest.fn();
const mockUseCancelClubEvent = jest.fn();
const mockUseDeleteClubEvent = jest.fn();
const mockUseUpdateClubMemberStatus = jest.fn();
const mockUseSetClubCurrentBookFromNomination = jest.fn();
const mockUseClubCurrentBookStatusOverview = jest.fn();
const mockUseClubDiscussionReports = jest.fn();
const mockUseResolveClubDiscussionReport = jest.fn();
const mockUseClubComplaints = jest.fn();
const mockUseResolveClubComplaint = jest.fn();
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
    useClubManageDetail: (...args: unknown[]) => mockUseClubPublicDetail(...args),
    useClubMembership: (...args: unknown[]) => mockUseClubMembership(...args),
    useClubBookNominations: (...args: unknown[]) => mockUseClubBookNominations(...args),
    useClubJoinQuestions: (...args: unknown[]) => mockUseClubJoinQuestions(...args),
    useClubMembers: (...args: unknown[]) => mockUseClubMembers(...args),
    useClubMemberActions: (...args: unknown[]) => mockUseClubMemberActions(...args),
    useCreateClubJoinQuestion: (...args: unknown[]) => mockUseCreateClubJoinQuestion(...args),
    useUpdateClubJoinQuestion: (...args: unknown[]) => mockUseUpdateClubJoinQuestion(...args),
    useDeleteClubJoinQuestion: (...args: unknown[]) => mockUseDeleteClubJoinQuestion(...args),
    useFinalizeClubBookNomination: (...args: unknown[]) => mockUseFinalizeClubBookNomination(...args),
    useSetClubCurrentBookFromNomination: (...args: unknown[]) => mockUseSetClubCurrentBookFromNomination(...args),
    useClubCurrentBookStatusOverview: (...args: unknown[]) => mockUseClubCurrentBookStatusOverview(...args),
    useNominateClubBook: (...args: unknown[]) => mockUseNominateClubBook(...args),
    useUpdateClub: (...args: unknown[]) => mockUseUpdateClub(...args),
    useUpdateClubMemberRole: (...args: unknown[]) => mockUseUpdateClubMemberRole(...args),
    useRemoveClubMember: (...args: unknown[]) => mockUseRemoveClubMember(...args),
    useClubApplications: (...args: unknown[]) => mockUseClubApplications(...args),
    useReviewClubApplication: (...args: unknown[]) => mockUseReviewClubApplication(...args),
    useClubInvitations: (...args: unknown[]) => mockUseClubInvitations(...args),
    useCreateClubInvitation: (...args: unknown[]) => mockUseCreateClubInvitation(...args),
    useRevokeClubInvitation: (...args: unknown[]) => mockUseRevokeClubInvitation(...args),
    useClubEvents: (...args: unknown[]) => mockUseClubEvents(...args),
    useClubEventVenues: (...args: unknown[]) => mockUseClubEventVenues(...args),
    useAddClubVenueLink: (...args: unknown[]) => mockUseAddClubVenueLink(...args),
    useRemoveClubVenueLink: (...args: unknown[]) => mockUseRemoveClubVenueLink(...args),
    useSetPrimaryClubVenue: (...args: unknown[]) => mockUseSetPrimaryClubVenue(...args),
    useCancelClubEvent: (...args: unknown[]) => mockUseCancelClubEvent(...args),
    useDeleteClubEvent: (...args: unknown[]) => mockUseDeleteClubEvent(...args),
    useUpdateClubMemberStatus: (...args: unknown[]) => mockUseUpdateClubMemberStatus(...args),
    useCreateClubMemberAction: (...args: unknown[]) => mockUseCreateClubMemberAction(...args),
    useClubReadingSchedule: (...args: unknown[]) => mockUseClubReadingSchedule(...args),
    useUpsertClubReadingSchedule: (...args: unknown[]) => mockUseUpsertClubReadingSchedule(...args),
    useClubDiscussionReports: (...args: unknown[]) => mockUseClubDiscussionReports(...args),
    useResolveClubDiscussionReport: (...args: unknown[]) => mockUseResolveClubDiscussionReport(...args),
    useClubComplaints: (...args: unknown[]) => mockUseClubComplaints(...args),
    useResolveClubComplaint: (...args: unknown[]) => mockUseResolveClubComplaint(...args),
    useArchiveClub: (...args: unknown[]) => mockUseArchiveClub(...args),
    useUnarchiveClub: (...args: unknown[]) => mockUseUnarchiveClub(...args),
    useClubAdminTransferRequests: (...args: unknown[]) => mockUseClubAdminTransferRequests(...args),
    useRequestClubAdminTransfer: (...args: unknown[]) => mockUseRequestClubAdminTransfer(...args),
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
    is_archived: false,
    archived_at: null,
};

const testVenueDetails = { venue_type: null, city: null, address_line1: null, address_line2: null, verification_status: 'approved' };
const primaryVenueLinks = [
    { club_id: 'club-1', venue_id: 'venue-1', is_primary: true, venue: { ...testVenueDetails, id: 'venue-1', name: 'Central Library' } },
    { club_id: 'club-1', venue_id: 'venue-2', is_primary: false, venue: { ...testVenueDetails, id: 'venue-2', name: 'Riverside Hall' } },
    { club_id: 'club-1', venue_id: 'venue-3', is_primary: false, venue: { ...testVenueDetails, id: 'venue-3', name: 'Garden Room' } },
];

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

beforeEach(() => {
    jest.clearAllMocks();
    mockUserId = 'admin-1';
    mockRouterPush.mockReset();
    mockUseLocalSearchParams.mockReturnValue({ clubId: 'club-1', tab: undefined });
    mockUseClubPublicDetail.mockReturnValue({ data: baseClub, isLoading: false, isError: false, refetch: jest.fn() });
    mockUseClubReadingSchedule.mockReturnValue({ data: null, isLoading: false, isError: false, error: null, refetch: jest.fn() });
    mockUseUpsertClubReadingSchedule.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseArchiveClub.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'club-1' }), isPending: false });
    mockUseUnarchiveClub.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'club-1' }), isPending: false });
    mockUseClubAdminTransferRequests.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
    mockUseRequestClubAdminTransfer.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'request-1' }), isPending: false });
    mockUseClubMemberActions.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
    mockUseCreateClubMemberAction.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'action-1' }), isPending: false });
    mockUseClubMembership.mockReturnValue({ data: { role: 'admin', status: 'active' }, isLoading: false });
    mockUseClubBookNominations.mockReturnValue({ data: [], isLoading: false, isError: false, error: null, refetch: jest.fn() });
    mockUseClubJoinQuestions.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
    mockUseClubMembers.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
    mockUseCreateClubJoinQuestion.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseUpdateClubJoinQuestion.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseDeleteClubJoinQuestion.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseFinalizeClubBookNomination.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'club-1' }), isPending: false });
    mockUseSetClubCurrentBookFromNomination.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'club-1' }), isPending: false });
    mockUseClubCurrentBookStatusOverview.mockReturnValue({ data: null, isLoading: false, isError: false, error: null, refetch: jest.fn() });
    mockUseNominateClubBook.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'nomination-1' }), isPending: false });
    mockUseUpdateClub.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'club-1' }), isPending: false });
    mockUseUpdateClubMemberRole.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'member-1' }), isPending: false });
    mockUseRemoveClubMember.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue(undefined), isPending: false });
    mockUseClubApplications.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
    mockUseReviewClubApplication.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseClubInvitations.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
    mockUseCreateClubInvitation.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseRevokeClubInvitation.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseClubEvents.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
    mockUseClubEventVenues.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
    mockUseAddClubVenueLink.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseRemoveClubVenueLink.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseSetPrimaryClubVenue.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({}), isPending: false });
    mockUseCancelClubEvent.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseDeleteClubEvent.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseUpdateClubMemberStatus.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'member-1' }), isPending: false });
    mockUseClubDiscussionReports.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
    mockUseResolveClubDiscussionReport.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'report-1' }), isPending: false });
    mockUseClubComplaints.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
    mockUseResolveClubComplaint.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'complaint-1' }), isPending: false });
});

describe('ClubManageScreen', () => {
    it('keeps Saving visible when a cache update moves the badge before confirmation finishes', async () => {
        const confirmation = deferred<{ data: typeof primaryVenueLinks; isError: boolean }>();
        const refetch = jest.fn(() => confirmation.promise);
        mockUseClubEventVenues.mockReturnValue({ data: primaryVenueLinks, isLoading: false, refetch });
        const screen = render(<ClubManageScreen />);
        fireEvent.press(screen.getByText('Venues'));
        fireEvent.press(screen.getByTestId('manage-venue-set-primary-venue-2'));
        await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
        const updated = primaryVenueLinks.map(link => ({ ...link, is_primary: link.venue_id === 'venue-2' }));
        mockUseClubEventVenues.mockReturnValue({ data: updated, isLoading: false, refetch });
        screen.rerender(<ClubManageScreen />);
        expect(screen.getByTestId('manage-venue-primary-badge-venue-2')).toBeOnTheScreen();
        expect(screen.getByText('Saving…')).toBeOnTheScreen();
        expect(screen.getByTestId('manage-venue-set-primary-venue-1')).toBeDisabled();
        await act(async () => confirmation.resolve({ data: updated, isError: false }));
        expect(screen.queryByText('Saving…')).toBeNull();
        expect(screen.getByTestId('manage-venue-set-primary-venue-1')).toBeEnabled();
    });

    it.each(['success', 'failure'] as const)('retains feedback when Remove unlinks a pending target before RPC %s', async outcome => {
        const mutation = deferred<void>();
        const remaining = primaryVenueLinks.filter(link => link.venue_id !== 'venue-2');
        const refetch = jest.fn().mockResolvedValue({ data: remaining, isError: false });
        mockUseSetPrimaryClubVenue.mockReturnValue({ mutateAsync: jest.fn(() => mutation.promise), isPending: false });
        mockUseRemoveClubVenueLink.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue(undefined), isPending: false });
        mockUseClubEventVenues.mockReturnValue({ data: primaryVenueLinks, isLoading: false, refetch });
        const screen = render(<ClubManageScreen />);
        fireEvent.press(screen.getByText('Venues'));
        fireEvent.press(screen.getByTestId('manage-venue-set-primary-venue-2'));
        fireEvent.press(screen.getByTestId('manage-venue-remove-venue-2'));
        fireEvent.press(screen.getByTestId('manage-venue-confirm-remove'));
        await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
        mockUseClubEventVenues.mockReturnValue({ data: remaining, isLoading: false, refetch });
        screen.rerender(<ClubManageScreen />);
        expect(screen.getByText('Saving…')).toBeOnTheScreen();
        await act(async () => {
            if (outcome === 'success') mutation.resolve();
            else mutation.reject(new Error('No longer linked'));
        });
        expect(screen.getByText(/The selected venue is no longer shown/)).toBeOnTheScreen();
        expect(screen.queryByTestId('manage-venue-retry-venue-2')).toBeNull();
        expect(screen.getByTestId('manage-venue-set-primary-venue-3')).toBeEnabled();
        expect(screen.getByTestId('manage-venues-add')).toBeOnTheScreen();
    });

    it.each(['success', 'failure'] as const)('ignores delayed RPC %s after changing clubs and allows a new selection', async outcome => {
        const oldMutation = deferred<void>();
        const newMutation = deferred<void>();
        const mutateAsync = jest.fn().mockReturnValueOnce(oldMutation.promise).mockReturnValueOnce(newMutation.promise);
        const refetch = jest.fn().mockResolvedValue({ data: primaryVenueLinks, isError: false });
        mockUseSetPrimaryClubVenue.mockReturnValue({ mutateAsync, isPending: false });
        mockUseClubEventVenues.mockReturnValue({ data: primaryVenueLinks, isLoading: false, refetch });
        const screen = render(<ClubManageScreen />);
        fireEvent.press(screen.getByText('Venues'));
        fireEvent.press(screen.getByTestId('manage-venue-set-primary-venue-2'));
        mockUseLocalSearchParams.mockReturnValue({ clubId: 'club-2', tab: 'venues' });
        mockUseClubPublicDetail.mockReturnValue({ data: { ...baseClub, id: 'club-2' }, isLoading: false, refetch: jest.fn() });
        mockUseClubEventVenues.mockReturnValue({ data: primaryVenueLinks.map(link => ({ ...link, club_id: 'club-2' })), isLoading: false, refetch });
        screen.rerender(<ClubManageScreen />);
        expect(screen.queryByText('Saving…')).toBeNull();
        fireEvent.press(screen.getByTestId('manage-venue-set-primary-venue-2'));
        expect(mutateAsync).toHaveBeenLastCalledWith({ clubId: 'club-2', venueId: 'venue-2' });
        await act(async () => {
            if (outcome === 'success') oldMutation.resolve();
            else oldMutation.reject(new Error('Old club failure'));
        });
        expect(refetch).not.toHaveBeenCalled();
        expect(screen.getByText('Saving…')).toBeOnTheScreen();
        screen.unmount();
        await act(async () => newMutation.resolve());
        expect(refetch).not.toHaveBeenCalled();
    });

    it.each(['empty', 'unreadable'] as const)('retains section recovery when the refreshed target is %s', async kind => {
        const mutation = deferred<void>();
        const missingTarget = kind === 'empty' ? [] : [{ ...primaryVenueLinks[1], is_primary: true, venue: null }];
        const refetch = jest.fn().mockResolvedValue({ data: missingTarget, isError: false });
        mockUseSetPrimaryClubVenue.mockReturnValue({ mutateAsync: jest.fn(() => mutation.promise), isPending: false });
        mockUseClubEventVenues.mockReturnValue({ data: primaryVenueLinks, isLoading: false, refetch });
        const screen = render(<ClubManageScreen />);
        fireEvent.press(screen.getByText('Venues'));
        fireEvent.press(screen.getByTestId('manage-venue-set-primary-venue-2'));
        mockUseClubEventVenues.mockReturnValue({ data: missingTarget, isLoading: false, refetch });
        screen.rerender(<ClubManageScreen />);
        expect(screen.getByText('Saving…')).toBeOnTheScreen();
        await act(async () => mutation.resolve());
        expect(screen.getByText(/The selected venue is no longer shown/)).toBeOnTheScreen();
        expect(screen.queryByTestId('manage-venue-retry-venue-2')).toBeNull();
        expect(screen.getByTestId('manage-venues-add')).toBeOnTheScreen();
    });

    it('ignores old confirmation data after a club switch even when clubs share a venue', async () => {
        const oldConfirmation = deferred<{ data: typeof primaryVenueLinks; isError: boolean }>();
        const newMutation = deferred<void>();
        const mutateAsync = jest.fn().mockResolvedValueOnce({}).mockReturnValueOnce(newMutation.promise);
        const refetch = jest.fn(() => oldConfirmation.promise);
        mockUseSetPrimaryClubVenue.mockReturnValue({ mutateAsync, isPending: false });
        mockUseClubEventVenues.mockReturnValue({ data: primaryVenueLinks, isLoading: false, refetch });
        const screen = render(<ClubManageScreen />);
        fireEvent.press(screen.getByText('Venues'));
        fireEvent.press(screen.getByTestId('manage-venue-set-primary-venue-2'));
        await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
        mockUseLocalSearchParams.mockReturnValue({ clubId: 'club-2', tab: 'venues' });
        mockUseClubPublicDetail.mockReturnValue({ data: { ...baseClub, id: 'club-2' }, isLoading: false, refetch: jest.fn() });
        mockUseClubEventVenues.mockReturnValue({ data: primaryVenueLinks.map(link => ({ ...link, club_id: 'club-2' })), isLoading: false, refetch });
        screen.rerender(<ClubManageScreen />);
        fireEvent.press(screen.getByTestId('manage-venue-set-primary-venue-2'));
        await act(async () => oldConfirmation.resolve({
            data: primaryVenueLinks.map(link => ({ ...link, club_id: 'club-2', is_primary: link.venue_id === 'venue-2' })), isError: false,
        }));
        expect(screen.getByText('Saving…')).toBeOnTheScreen();
        expect(screen.queryByText(/could not confirm/)).toBeNull();
        screen.unmount();
        await act(async () => newMutation.resolve());
    });

    it('clears pending selection on account change and fences the old RPC response', async () => {
        const mutation = deferred<void>();
        const refetch = jest.fn();
        mockUseSetPrimaryClubVenue.mockReturnValue({ mutateAsync: jest.fn(() => mutation.promise), isPending: false });
        mockUseClubEventVenues.mockReturnValue({ data: primaryVenueLinks, isLoading: false, refetch });
        const screen = render(<ClubManageScreen />);
        fireEvent.press(screen.getByText('Venues'));
        fireEvent.press(screen.getByTestId('manage-venue-set-primary-venue-2'));
        mockUserId = 'admin-2';
        mockUseLocalSearchParams.mockReturnValue({ clubId: 'club-1', tab: 'venues' });
        mockUseClubPublicDetail.mockReturnValue({ data: { ...baseClub, admin_id: 'admin-2' }, isLoading: false, refetch: jest.fn() });
        screen.rerender(<ClubManageScreen />);
        expect(screen.queryByText('Saving…')).toBeNull();
        await act(async () => mutation.resolve());
        expect(refetch).not.toHaveBeenCalled();
    });

    it('does not confirm matching venue data from another club', async () => {
        const wrongClubLinks = primaryVenueLinks.map(link => ({ ...link, club_id: 'club-2', is_primary: link.venue_id === 'venue-2' }));
        mockUseClubEventVenues.mockReturnValue({
            data: primaryVenueLinks, isLoading: false,
            refetch: jest.fn().mockResolvedValue({ data: wrongClubLinks, isError: false }),
        });
        const screen = render(<ClubManageScreen />);
        fireEvent.press(screen.getByText('Venues'));
        fireEvent.press(screen.getByTestId('manage-venue-set-primary-venue-2'));
        expect(await screen.findByText(/could not confirm this venue/)).toBeOnTheScreen();
        expect(screen.getByTestId('manage-venue-retry-venue-2')).toBeOnTheScreen();
    });

    it('keeps recovery when refetch resolves isError with cached primary data', async () => {
        const updated = primaryVenueLinks.map(link => ({ ...link, is_primary: link.venue_id === 'venue-2' }));
        mockUseClubEventVenues.mockReturnValue({
            data: primaryVenueLinks, isLoading: false,
            refetch: jest.fn().mockResolvedValue({ data: updated, isError: true }),
        });
        const screen = render(<ClubManageScreen />);
        fireEvent.press(screen.getByText('Venues'));
        fireEvent.press(screen.getByTestId('manage-venue-set-primary-venue-2'));
        expect(await screen.findByText(/could not confirm this venue/)).toBeOnTheScreen();
    });

    it('does not unlink until confirmed and Cancel leaves the link intact', async () => {
        const remove = jest.fn().mockResolvedValue(undefined);
        mockUseRemoveClubVenueLink.mockReturnValue({ mutateAsync: remove, isPending: false });
        mockUseClubEventVenues.mockReturnValue({ data: primaryVenueLinks, isLoading: false, refetch: jest.fn() });
        const screen = render(<ClubManageScreen />);
        fireEvent.press(screen.getByText('Venues'));
        fireEvent.press(screen.getByTestId('manage-venue-remove-venue-1'));
        expect(screen.getByText('Remove venue?')).toBeOnTheScreen();
        expect(screen.getByText('The club will have no primary venue until you select another.')).toBeOnTheScreen();
        expect(remove).not.toHaveBeenCalled();
        fireEvent.press(screen.getByTestId('manage-venue-cancel-remove'));
        expect(screen.queryByText('Remove venue?')).toBeNull();
        expect(remove).not.toHaveBeenCalled();
        fireEvent.press(screen.getByTestId('manage-venue-remove-venue-2'));
        fireEvent.press(screen.getByTestId('manage-venue-confirm-remove'));
        await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
        expect(remove).toHaveBeenCalledWith({ clubId: 'club-1', venueId: 'venue-2' });
    });

    it.each(['club', 'account'] as const)('hands web focus to the management surface on a %s change', kind => {
        const os = Platform.OS;
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
        const focus = jest.spyOn(View.prototype, 'focus');
        const screen = render(<ClubManageScreen />);
        try {
            expect(focus).not.toHaveBeenCalled();
            if (kind === 'club') mockUseLocalSearchParams.mockReturnValue({ clubId: 'club-2', tab: 'venues' });
            else mockUserId = 'admin-2';
            screen.rerender(<ClubManageScreen />);
            expect(focus).toHaveBeenCalledTimes(1);
            expect(screen.getByTestId('club-management-surface').props.accessibilityLabel).toBe('Club management');
        } finally {
            screen.unmount();
            focus.mockRestore();
            Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
        }
    });

    it.each([false, true])('hands web focus to Add when the removal target disappears (confirmed=%s)', async confirmed => {
        const os = Platform.OS;
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
        const focus = jest.spyOn(View.prototype, 'focus');
        mockUseRemoveClubVenueLink.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue(undefined), isPending: false });
        mockUseClubEventVenues.mockReturnValue({ data: primaryVenueLinks, isLoading: false, refetch: jest.fn() });
        const screen = render(<ClubManageScreen />);
        try {
            fireEvent.press(screen.getByText('Venues'));
            fireEvent.press(screen.getByTestId('manage-venue-remove-venue-2'));
            if (confirmed) await act(async () => fireEvent.press(screen.getByTestId('manage-venue-confirm-remove')));
            mockUseClubEventVenues.mockReturnValue({ data: primaryVenueLinks.filter(link => link.venue_id !== 'venue-2'), isLoading: false, refetch: jest.fn() });
            screen.rerender(<ClubManageScreen />);
            expect(focus).toHaveBeenCalledTimes(1);
            expect(screen.queryByTestId('manage-venue-confirm-remove')).toBeNull();
        } finally {
            screen.unmount();
            focus.mockRestore();
            Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
        }
    });

    it('dismisses confirmation if its target disappears without unlinking again', () => {
        const remove = jest.fn();
        mockUseRemoveClubVenueLink.mockReturnValue({ mutateAsync: remove, isPending: false });
        mockUseClubEventVenues.mockReturnValue({ data: primaryVenueLinks, isLoading: false, refetch: jest.fn() });
        const screen = render(<ClubManageScreen />);
        fireEvent.press(screen.getByText('Venues'));
        fireEvent.press(screen.getByTestId('manage-venue-remove-venue-2'));
        mockUseClubEventVenues.mockReturnValue({ data: primaryVenueLinks.filter(link => link.venue_id !== 'venue-2'), isLoading: false, refetch: jest.fn() });
        screen.rerender(<ClubManageScreen />);
        expect(screen.queryByTestId('manage-venue-confirm-remove')).toBeNull();
        expect(remove).not.toHaveBeenCalled();
        expect(screen.getByTestId('manage-venues-add')).toBeEnabled();
    });

    it.each(['club', 'account'] as const)('dismisses removal confirmation after a %s change', kind => {
        mockUseClubEventVenues.mockReturnValue({ data: primaryVenueLinks, isLoading: false, refetch: jest.fn() });
        const screen = render(<ClubManageScreen />);
        fireEvent.press(screen.getByText('Venues'));
        fireEvent.press(screen.getByTestId('manage-venue-remove-venue-2'));
        if (kind === 'club') mockUseLocalSearchParams.mockReturnValue({ clubId: 'club-2', tab: 'venues' });
        else mockUserId = 'admin-2';
        screen.rerender(<ClubManageScreen />);
        expect(screen.queryByTestId('manage-venue-confirm-remove')).toBeNull();
    });

    it.each([
        ['club', 'success'], ['club', 'failure'], ['club', 'confirmation'],
        ['account', 'success'], ['account', 'failure'], ['account', 'confirmation'],
    ] as const)('fences real-query %s changes during delayed %s', async (identity, outcome) => {
        const realHooks = jest.requireActual<typeof import('@/features/clubs/hooks/useClubs')>('@/features/clubs/hooks/useClubs');
        const rpc = deferred<Awaited<ReturnType<typeof clubsService.setPrimaryClubVenue>>>();
        const confirmation = deferred<typeof primaryVenueLinks>();
        const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
        const oldKey = realHooks.clubKeys.eventVenues('club-1');
        client.setQueryData(oldKey, primaryVenueLinks);
        const readSpy = jest.spyOn(clubsService, 'getClubEventVenues').mockResolvedValue(primaryVenueLinks);
        if (outcome === 'confirmation') readSpy.mockImplementation(() => confirmation.promise);
        const writeSpy = jest.spyOn(clubsService, 'setPrimaryClubVenue').mockImplementation(() => rpc.promise);
        mockUseClubEventVenues.mockImplementation(realHooks.useClubEventVenues);
        mockUseSetPrimaryClubVenue.mockImplementation(realHooks.useSetPrimaryClubVenue);
        const screen = render(<QueryClientProvider client={client}><ClubManageScreen /></QueryClientProvider>);
        try {
            fireEvent.press(screen.getByText('Venues'));
            fireEvent.press(screen.getByTestId('manage-venue-set-primary-venue-2'));
            if (outcome === 'confirmation') {
                await act(async () => rpc.resolve({ ...primaryVenueLinks[1], is_primary: true }));
                await waitFor(() => expect(readSpy).toHaveBeenCalledTimes(2));
            }
            const clubId = identity === 'club' ? 'club-2' : 'club-1';
            const newLinks = primaryVenueLinks.map(link => ({ ...link, club_id: clubId }));
            // Auth changes clear account-owned caches in the app; model that boundary here.
            if (identity === 'account') { client.clear(); mockUserId = 'admin-2'; }
            client.setQueryData(realHooks.clubKeys.eventVenues(clubId), newLinks);
            readSpy.mockResolvedValue(newLinks);
            mockUseLocalSearchParams.mockReturnValue({ clubId, tab: 'venues' });
            mockUseClubPublicDetail.mockReturnValue({ data: { ...baseClub, id: clubId, admin_id: mockUserId }, isLoading: false, refetch: jest.fn() });
            screen.rerender(<QueryClientProvider client={client}><ClubManageScreen /></QueryClientProvider>);
            expect(screen.queryByText('Saving…')).toBeNull();
            await act(async () => {
                if (outcome === 'failure') rpc.reject(new Error('Old identity failure'));
                else if (outcome === 'confirmation') confirmation.resolve(primaryVenueLinks.map(link => ({ ...link, is_primary: link.venue_id === 'venue-2' })));
                else rpc.resolve({ ...primaryVenueLinks[1], is_primary: true });
            });
            await waitFor(() => expect(screen.getByTestId('manage-venue-set-primary-venue-2')).toBeEnabled());
            expect(screen.queryByText(/could not confirm/)).toBeNull();
            expect(screen.queryByText(/Old identity failure/)).toBeNull();
            expect(screen.queryByText('Saving…')).toBeNull();
            expect(writeSpy).toHaveBeenCalledTimes(1);
        } finally {
            screen.unmount();
            rpc.resolve({ ...primaryVenueLinks[1], is_primary: true });
            confirmation.resolve(primaryVenueLinks);
            client.clear(); readSpy.mockRestore(); writeSpy.mockRestore();
        }
    });

    it('retains recovery through real Remove invalidation during primary confirmation', async () => {
        const realHooks = jest.requireActual<typeof import('@/features/clubs/hooks/useClubs')>('@/features/clubs/hooks/useClubs');
        const confirmation = deferred<typeof primaryVenueLinks>();
        const remaining = primaryVenueLinks.filter(link => link.venue_id !== 'venue-2');
        const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
        client.setQueryData(realHooks.clubKeys.eventVenues('club-1'), primaryVenueLinks);
        const readSpy = jest.spyOn(clubsService, 'getClubEventVenues').mockResolvedValue(remaining)
            .mockImplementationOnce(() => confirmation.promise).mockImplementationOnce(() => confirmation.promise);
        const writeSpy = jest.spyOn(clubsService, 'setPrimaryClubVenue').mockResolvedValue({ ...primaryVenueLinks[1], is_primary: true });
        const removeSpy = jest.spyOn(clubsService, 'removeClubVenueLink').mockResolvedValue(undefined);
        mockUseClubEventVenues.mockImplementation(realHooks.useClubEventVenues);
        mockUseSetPrimaryClubVenue.mockImplementation(realHooks.useSetPrimaryClubVenue);
        mockUseRemoveClubVenueLink.mockImplementation(realHooks.useRemoveClubVenueLink);
        const screen = render(<QueryClientProvider client={client}><ClubManageScreen /></QueryClientProvider>);
        try {
            fireEvent.press(screen.getByText('Venues'));
            fireEvent.press(screen.getByTestId('manage-venue-set-primary-venue-2'));
            await waitFor(() => expect(readSpy).toHaveBeenCalledTimes(2));
            fireEvent.press(screen.getByTestId('manage-venue-remove-venue-2'));
            fireEvent.press(screen.getByTestId('manage-venue-confirm-remove'));
            await waitFor(() => expect(removeSpy).toHaveBeenCalledTimes(1));
            await act(async () => confirmation.resolve(remaining));
            await waitFor(() => expect(screen.getByText(/The selected venue is no longer shown/)).toBeOnTheScreen());
            expect(screen.queryByTestId('manage-venue-retry-venue-2')).toBeNull();
            expect(screen.getByTestId('manage-venues-add')).toBeEnabled();
            expect(removeSpy).toHaveBeenCalledTimes(1);
        } finally {
            screen.unmount(); confirmation.resolve(remaining); client.clear();
            readSpy.mockRestore(); writeSpy.mockRestore(); removeSpy.mockRestore();
        }
    });

    it.each(['success', 'failure'] as const)('fences real-query failure refresh %s after unmount', async outcome => {
        const realHooks = jest.requireActual<typeof import('@/features/clubs/hooks/useClubs')>('@/features/clubs/hooks/useClubs');
        const refresh = deferred<typeof primaryVenueLinks>();
        const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
        client.setQueryData(realHooks.clubKeys.eventVenues('club-1'), primaryVenueLinks);
        const readSpy = jest.spyOn(clubsService, 'getClubEventVenues').mockImplementation(() => refresh.promise);
        const writeSpy = jest.spyOn(clubsService, 'setPrimaryClubVenue').mockRejectedValue(new Error('Primary rejected'));
        mockUseClubEventVenues.mockImplementation(realHooks.useClubEventVenues);
        mockUseSetPrimaryClubVenue.mockImplementation(realHooks.useSetPrimaryClubVenue);
        const screen = render(<QueryClientProvider client={client}><ClubManageScreen /></QueryClientProvider>);
        try {
            fireEvent.press(screen.getByText('Venues'));
            fireEvent.press(screen.getByTestId('manage-venue-set-primary-venue-2'));
            await waitFor(() => expect(readSpy).toHaveBeenCalledTimes(1));
            screen.unmount();
            await act(async () => {
                if (outcome === 'success') refresh.resolve(primaryVenueLinks);
                else refresh.reject(new Error('Refresh rejected'));
            });
            expect(readSpy).toHaveBeenCalledTimes(1);
            expect(client.getQueryCache().find({ queryKey: realHooks.clubKeys.eventVenues('club-1') })?.getObserversCount() ?? 0).toBe(0);
        } finally {
            screen.unmount(); refresh.resolve(primaryVenueLinks); client.clear();
            readSpy.mockRestore(); writeSpy.mockRestore();
        }
    });

    it('keeps Saving through real venue-query invalidation and confirmation', async () => {
        const realHooks = jest.requireActual<typeof import('@/features/clubs/hooks/useClubs')>('@/features/clubs/hooks/useClubs');
        const confirmation = deferred<typeof primaryVenueLinks>();
        const invalidatedRead = deferred<typeof primaryVenueLinks>();
        const updated = primaryVenueLinks.map(link => ({ ...link, is_primary: link.venue_id === 'venue-2' }));
        const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
        client.setQueryData(realHooks.clubKeys.eventVenues('club-1'), primaryVenueLinks);
        const readSpy = jest.spyOn(clubsService, 'getClubEventVenues')
            .mockImplementationOnce(() => invalidatedRead.promise)
            .mockImplementationOnce(() => confirmation.promise);
        const writeSpy = jest.spyOn(clubsService, 'setPrimaryClubVenue').mockResolvedValue({ club_id: 'club-1', venue_id: 'venue-2', is_primary: true, venue: null });
        mockUseClubEventVenues.mockImplementation(realHooks.useClubEventVenues);
        mockUseSetPrimaryClubVenue.mockImplementation(realHooks.useSetPrimaryClubVenue);
        const screen = render(<QueryClientProvider client={client}><ClubManageScreen /></QueryClientProvider>);
        try {
            fireEvent.press(screen.getByText('Venues'));
            fireEvent.press(screen.getByTestId('manage-venue-set-primary-venue-2'));
            fireEvent.press(screen.getByTestId('manage-venue-set-primary-venue-2'));
            await waitFor(() => expect(readSpy).toHaveBeenCalledTimes(2));
            expect(writeSpy).toHaveBeenCalledTimes(1);
            await act(async () => client.setQueryData(realHooks.clubKeys.eventVenues('club-1'), updated));
            await waitFor(() => expect(screen.getByTestId('manage-venue-primary-badge-venue-2')).toBeOnTheScreen());
            expect(screen.getByText('Saving…')).toBeOnTheScreen();
            await act(async () => confirmation.resolve(updated));
            await waitFor(() => expect(screen.queryByText('Saving…')).toBeNull());
            expect(screen.getByTestId('manage-venue-set-primary-venue-1')).toBeEnabled();
        } finally {
            screen.unmount();
            invalidatedRead.resolve(updated);
            confirmation.resolve(updated);
            client.clear();
            readSpy.mockRestore();
            writeSpy.mockRestore();
        }
    });

    it('shows club header and tab bar for admins with all tabs', () => {
        const { getByText } = render(<ClubManageScreen />);

        expect(getByText('Founders Circle')).toBeOnTheScreen();
        expect(getByText('All members · Online only')).toBeOnTheScreen();
        expect(getByText('Current Book')).toBeOnTheScreen();
        expect(getByText('Schedule')).toBeOnTheScreen();
        expect(getByText('Analytics')).toBeOnTheScreen();
        expect(getByText('Events')).toBeOnTheScreen();
        expect(getByText('Venues')).toBeOnTheScreen();
        expect(getByText('Settings')).toBeOnTheScreen();
        expect(getByText('Members')).toBeOnTheScreen();
        expect(getByText('Join Questions')).toBeOnTheScreen();
        expect(getByText('Lifecycle')).toBeOnTheScreen();
        // Default active tab is Current Book
        expect(getByText('Current book')).toBeOnTheScreen();
    });

    it('shows a venue management tab for admins and can open venue linking', async () => {
        mockUseClubEventVenues.mockReturnValue({
            data: [{ club_id: 'club-1', venue_id: 'venue-1', is_primary: true, venue: { id: 'venue-1', name: 'Central Library', address_line1: '12 Main St', city: 'Bengaluru', verification_status: 'approved' } }],
            isLoading: false,
            refetch: jest.fn(),
        });

        const { getByText, getByTestId } = render(<ClubManageScreen />);

        fireEvent.press(getByText('Venues'));

        await waitFor(() => expect(getByText('Central Library')).toBeOnTheScreen());
        expect(getByText('Primary venue')).toBeOnTheScreen();

        fireEvent.press(getByTestId('manage-venues-add'));

        expect(mockRouterPush).toHaveBeenCalledWith('/clubs/club-1/venues?returnTo=manage-venues');
    });

    it('sets a linked venue as primary and exposes a pending action without hiding remove controls', async () => {
        let finishMutation!: () => void;
        let finishRefetch!: () => void;
        const setPrimary = jest.fn(() => new Promise<void>((resolve) => {
            finishMutation = resolve;
        }));
        mockUseSetPrimaryClubVenue.mockReturnValue({ mutateAsync: setPrimary, isPending: false });
        const initialVenueLinks = [
            { club_id: 'club-1', venue_id: 'venue-1', is_primary: true, venue: { id: 'venue-1', name: 'Central Library', address_line1: '12 Main St', city: 'Bengaluru', verification_status: 'approved' } },
            { club_id: 'club-1', venue_id: 'venue-2', is_primary: false, venue: { id: 'venue-2', name: 'Riverside Hall', address_line1: '8 River Rd', city: 'Bengaluru', verification_status: 'approved' } },
        ];
        const updatedVenueLinks = [
            { ...initialVenueLinks[0], is_primary: false },
            { ...initialVenueLinks[1], is_primary: true },
        ];
        let currentVenueLinks = initialVenueLinks;
        const refetchVenues = jest.fn(() => new Promise((resolve) => {
            finishRefetch = () => {
                currentVenueLinks = updatedVenueLinks;
                resolve({ data: updatedVenueLinks, isError: false });
            };
        }));
        mockUseClubEventVenues.mockImplementation(() => ({
            data: currentVenueLinks,
            isLoading: false,
            refetch: refetchVenues,
        }));

        const { getByText, getByTestId, queryByTestId } = render(<ClubManageScreen />);

        fireEvent.press(getByText('Venues'));

        expect(await getByText('Primary venue is suggested for new in-person or hybrid events; existing events keep their saved venue.')).toBeOnTheScreen();
        expect(getByText('Primary venue')).toBeOnTheScreen();
        expect(getByTestId('manage-venue-remove-venue-1')).toBeOnTheScreen();
        expect(getByTestId('manage-venue-remove-venue-2')).toBeOnTheScreen();
        expect(getByTestId('manage-venues-add')).toBeOnTheScreen();
        fireEvent.press(getByTestId('manage-venue-set-primary-venue-2'));
        await waitFor(() => expect(setPrimary).toHaveBeenCalledWith({ clubId: 'club-1', venueId: 'venue-2' }));
        expect(getByText('Saving…')).toBeOnTheScreen();
        expect(getByTestId('manage-venue-remove-venue-1')).toBeOnTheScreen();
        expect(getByTestId('manage-venue-remove-venue-2')).toBeOnTheScreen();
        expect(getByTestId('manage-venue-set-primary-venue-2').props.accessibilityState).toEqual({ disabled: true, busy: true });
        finishMutation();
        await waitFor(() => expect(refetchVenues).toHaveBeenCalledTimes(1));
        expect(getByText('Saving…')).toBeOnTheScreen();
        expect(getByTestId('manage-venue-primary-badge-venue-1')).toBeOnTheScreen();
        finishRefetch();
        await waitFor(() => {
            expect(getByTestId('manage-venue-primary-badge-venue-2')).toBeOnTheScreen();
            expect(queryByTestId('manage-venue-primary-badge-venue-1')).toBeNull();
            expect(getByTestId('manage-venue-set-primary-venue-1')).toBeOnTheScreen();
        });
    });

    it('keeps the previous primary visible after a failed selection and offers retry', async () => {
        const setPrimary = jest.fn().mockRejectedValue(new Error('The venue update was rejected.'));
        const venueLinks = [
            { club_id: 'club-1', venue_id: 'venue-1', is_primary: true, venue: { id: 'venue-1', name: 'Central Library', address_line1: '12 Main St', city: 'Bengaluru', verification_status: 'approved' } },
            { club_id: 'club-1', venue_id: 'venue-2', is_primary: false, venue: { id: 'venue-2', name: 'Riverside Hall', address_line1: '8 River Rd', city: 'Bengaluru', verification_status: 'approved' } },
        ];
        const refetchVenues = jest.fn().mockResolvedValue({ data: venueLinks, isError: false });
        mockUseSetPrimaryClubVenue.mockReturnValue({ mutateAsync: setPrimary, isPending: false });
        mockUseClubEventVenues.mockReturnValue({ data: venueLinks, isLoading: false, refetch: refetchVenues });

        const { getByText, getByTestId, findByText } = render(<ClubManageScreen />);
        fireEvent.press(getByText('Venues'));
        fireEvent.press(getByTestId('manage-venue-set-primary-venue-2'));

        expect(await findByText('Couldn’t update primary venue. Central Library remains primary.')).toBeOnTheScreen();
        expect(getByText('Primary venue')).toBeOnTheScreen();
        expect(getByTestId('manage-venue-remove-venue-1')).toBeOnTheScreen();
        expect(getByTestId('manage-venue-remove-venue-2')).toBeOnTheScreen();
        fireEvent.press(getByTestId('manage-venue-retry-venue-2'));
        await waitFor(() => expect(setPrimary).toHaveBeenCalledTimes(2));
    });

    it.each(['non-owner admin', 'archived owner'])('hides primary selection for a %s without removing existing link actions', kind => {
        mockUseClubPublicDetail.mockReturnValue({
            data: { ...baseClub, ...(kind === 'non-owner admin' ? { admin_id: 'another-owner' } : { is_archived: true }) },
            isLoading: false, isError: false, refetch: jest.fn(),
        });
        mockUseClubEventVenues.mockReturnValue({ data: primaryVenueLinks, isLoading: false, refetch: jest.fn() });
        const screen = render(<ClubManageScreen />);
        fireEvent.press(screen.getByText('Venues'));
        expect(screen.queryByTestId('manage-venue-set-primary-venue-2')).toBeNull();
        expect(screen.getByTestId('manage-venue-primary-badge-venue-1')).toBeOnTheScreen();
        expect(screen.getByTestId('manage-venues-add')).toBeOnTheScreen();
        expect(screen.getByTestId('manage-venue-remove-venue-2')).toBeOnTheScreen();
    });

    it.each(['confirmed', 'wrong club', 'unreadable', 'failed refresh'])('reconciles a lost RPC response using %s readback', async kind => {
        const updated = primaryVenueLinks.map(link => ({ ...link, is_primary: link.venue_id === 'venue-2' }));
        const readback = kind === 'wrong club' ? updated.map(link => ({ ...link, club_id: 'another-club' }))
            : kind === 'unreadable' ? updated.map(link => ({ ...link, venue: null })) : updated;
        mockUseSetPrimaryClubVenue.mockReturnValue({ mutateAsync: jest.fn().mockRejectedValue(new Error('Response lost')), isPending: false });
        let current = primaryVenueLinks;
        const refetch = jest.fn(async () => {
            current = updated;
            return { data: readback, isError: kind === 'failed refresh' };
        });
        mockUseClubEventVenues.mockImplementation(() => ({ data: current, isLoading: false, refetch }));
        const screen = render(<ClubManageScreen />);
        fireEvent.press(screen.getByText('Venues'));
        fireEvent.press(screen.getByTestId('manage-venue-set-primary-venue-2'));
        await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.queryByText('Saving…')).toBeNull());
        if (kind === 'confirmed') {
            expect(screen.queryByTestId('manage-venue-retry-venue-2')).toBeNull();
            expect(screen.getByTestId('manage-venue-primary-badge-venue-2')).toBeOnTheScreen();
        }
        else {
            expect(screen.getByTestId('manage-venue-retry-venue-2')).toBeOnTheScreen();
            expect(screen.getByText('Couldn’t update primary venue. Refresh and try again.')).toBeOnTheScreen();
            expect(screen.queryByText('Couldn’t update primary venue. No primary venue is set.')).toBeNull();
        }
    });

    it.each(['wrong club', 'unreadable'])('retains recovery when the displayed query adopts %s readback after response loss', async kind => {
        const updated = primaryVenueLinks.map(link => ({ ...link, is_primary: link.venue_id === 'venue-2' }));
        const readback = kind === 'wrong club' ? updated.map(link => ({ ...link, club_id: 'another-club' }))
            : updated.map(link => ({ ...link, venue: null }));
        mockUseSetPrimaryClubVenue.mockReturnValue({ mutateAsync: jest.fn().mockRejectedValue(new Error('Response lost')), isPending: false });
        let current: typeof readback | typeof primaryVenueLinks = primaryVenueLinks;
        const refetch = jest.fn(async () => {
            current = readback;
            return { data: readback, isError: false };
        });
        mockUseClubEventVenues.mockImplementation(() => ({ data: current, isLoading: false, refetch }));
        const screen = render(<ClubManageScreen />);
        fireEvent.press(screen.getByText('Venues'));
        fireEvent.press(screen.getByTestId('manage-venue-set-primary-venue-2'));
        await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.queryByText('Saving…')).toBeNull());
        expect(screen.queryByText('Couldn’t update primary venue. No primary venue is set.')).toBeNull();
        expect(screen.getByTestId('manage-venues-add')).toBeOnTheScreen();
        if (kind === 'unreadable') {
            expect(screen.getByTestId('manage-venues-selection-status')).toBeOnTheScreen();
            expect(screen.queryByTestId('manage-venue-retry-venue-2')).toBeNull();
            expect(screen.queryByTestId('manage-venue-primary-badge-venue-2')).toBeNull();
        } else {
            expect(screen.getByText('Couldn’t update primary venue. Refresh and try again.')).toBeOnTheScreen();
            expect(screen.getByTestId('manage-venue-retry-venue-2')).toBeOnTheScreen();
        }
    });

    it.each(['lost focus', 'moved focus', 'background click'])('handles an externally removed focused venue with %s', kind => {
        const os = Platform.OS;
        const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
        const body = {};
        const otherControl = {};
        const control = { contains: (target: unknown) => target === control };
        const listeners = new Map<string, (event: { target: unknown }) => void>();
        const documentMock = { body, documentElement: {}, activeElement: control as unknown,
            addEventListener: (type: string, listener: (event: { target: unknown }) => void) => listeners.set(type, listener),
            removeEventListener: (type: string) => listeners.delete(type),
        };
        Object.defineProperty(globalThis, 'document', { configurable: true, value: documentMock });
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
        const focus = jest.spyOn(View.prototype, 'focus');
        mockUseClubEventVenues.mockReturnValue({ data: primaryVenueLinks, isLoading: false, refetch: jest.fn() });
        const screen = render(<ClubManageScreen />);
        try {
            fireEvent.press(screen.getByText('Venues'));
            fireEvent(screen.getByTestId('manage-venue-remove-venue-2'), 'focus', { currentTarget: control });
            if (kind === 'moved focus') {
                documentMock.activeElement = otherControl;
                listeners.get('focusin')?.({ target: otherControl });
            } else {
                if (kind === 'background click') listeners.get('pointerdown')?.({ target: body });
                documentMock.activeElement = body;
            }
            mockUseClubEventVenues.mockReturnValue({ data: primaryVenueLinks.filter(link => link.venue_id !== 'venue-2'), isLoading: false, refetch: jest.fn() });
            screen.rerender(<ClubManageScreen />);
            expect(focus).toHaveBeenCalledTimes(kind === 'lost focus' ? 1 : 0);
            expect(screen.queryByTestId('manage-venue-confirm-remove')).toBeNull();
        } finally {
            screen.unmount();
            expect(listeners.size).toBe(0);
            focus.mockRestore();
            Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
            if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
            else Reflect.deleteProperty(globalThis, 'document');
        }
    });

    it('keeps a recovery action when the RPC succeeds but the refreshed list cannot confirm the target', async () => {
        const venueLinks = [
            { club_id: 'club-1', venue_id: 'venue-1', is_primary: true, venue: { id: 'venue-1', name: 'Central Library', address_line1: '12 Main St', city: 'Bengaluru', verification_status: 'approved' } },
            { club_id: 'club-1', venue_id: 'venue-2', is_primary: false, venue: { id: 'venue-2', name: 'Riverside Hall', address_line1: '8 River Rd', city: 'Bengaluru', verification_status: 'approved' } },
        ];
        const setPrimary = jest.fn().mockResolvedValue({});
        mockUseSetPrimaryClubVenue.mockReturnValue({ mutateAsync: setPrimary, isPending: false });
        mockUseClubEventVenues.mockReturnValue({
            data: venueLinks,
            isLoading: false,
            refetch: jest.fn().mockResolvedValue({ data: venueLinks, isError: false }),
        });

        const { getByText, getByTestId, findByText } = render(<ClubManageScreen />);
        fireEvent.press(getByText('Venues'));
        fireEvent.press(getByTestId('manage-venue-set-primary-venue-2'));

        expect(await findByText('Primary venue update succeeded, but the latest venue list could not confirm this venue as primary. Try again to set it as primary.')).toBeOnTheScreen();
        expect(getByTestId('manage-venue-primary-badge-venue-1')).toBeOnTheScreen();
        expect(getByTestId('manage-venue-retry-venue-2')).toBeOnTheScreen();
        expect(setPrimary).toHaveBeenCalledTimes(1);
    });

    it('keeps a recovery action when the refreshed venue-list request fails after RPC success', async () => {
        const venueLinks = [
            { club_id: 'club-1', venue_id: 'venue-1', is_primary: true, venue: { id: 'venue-1', name: 'Central Library', address_line1: '12 Main St', city: 'Bengaluru', verification_status: 'approved' } },
            { club_id: 'club-1', venue_id: 'venue-2', is_primary: false, venue: { id: 'venue-2', name: 'Riverside Hall', address_line1: '8 River Rd', city: 'Bengaluru', verification_status: 'approved' } },
        ];
        const setPrimary = jest.fn().mockResolvedValue({});
        mockUseSetPrimaryClubVenue.mockReturnValue({ mutateAsync: setPrimary, isPending: false });
        mockUseClubEventVenues.mockReturnValue({
            data: venueLinks,
            isLoading: false,
            refetch: jest.fn().mockRejectedValue(new Error('refresh failed')),
        });

        const { getByText, getByTestId, findByText } = render(<ClubManageScreen />);
        fireEvent.press(getByText('Venues'));
        fireEvent.press(getByTestId('manage-venue-set-primary-venue-2'));

        expect(await findByText('Primary venue update succeeded, but the latest venue list could not confirm this venue as primary. Try again to set it as primary.')).toBeOnTheScreen();
        expect(getByTestId('manage-venue-primary-badge-venue-1')).toBeOnTheScreen();
        expect(getByTestId('manage-venue-retry-venue-2')).toBeOnTheScreen();
        expect(setPrimary).toHaveBeenCalledTimes(1);
    });

    it('keeps add and remove venue actions available when primary selection is absent', async () => {
        const removeMutateAsync = jest.fn().mockResolvedValue(undefined);
        mockUseRemoveClubVenueLink.mockReturnValue({ mutateAsync: removeMutateAsync, isPending: false });
        mockUseClubEventVenues.mockReturnValue({
            data: [{ club_id: 'club-1', venue_id: 'venue-2', is_primary: false, venue: { id: 'venue-2', name: 'Riverside Hall', address_line1: '8 River Rd', city: 'Bengaluru', verification_status: 'approved' } }],
            isLoading: false,
            refetch: jest.fn(),
        });

        const { getByText, getByTestId } = render(<ClubManageScreen />);
        fireEvent.press(getByText('Venues'));

        await waitFor(() => expect(getByText('Riverside Hall')).toBeOnTheScreen());
        expect(getByTestId('manage-venues-add')).toBeOnTheScreen();
        expect(getByTestId('manage-venue-set-primary-venue-2')).toBeOnTheScreen();
        fireEvent.press(getByTestId('manage-venue-remove-venue-2'));
        fireEvent.press(getByTestId('manage-venue-confirm-remove'));
        await waitFor(() => expect(removeMutateAsync).toHaveBeenCalledWith({ clubId: 'club-1', venueId: 'venue-2' }));
    });

    it('shows platform complaints in Reports and resolves them', async () => {
        const mutateAsync = jest.fn().mockResolvedValue({ id: 'complaint-1', status: 'resolved' });
        const refetchComplaints = jest.fn().mockResolvedValue({ data: null });
        mockUseClubComplaints.mockReturnValue({
            data: [{
                id: 'complaint-1',
                club_id: 'club-1',
                reporter_id: 'reader-1',
                reported_user_id: 'reader-2',
                message_id: 'message-1',
                reason: 'harassment',
                description: 'Personal attack in chat.',
                status: 'pending',
                resolved_by: null,
                resolution_action: null,
                resolved_at: null,
                created_at: '2026-05-30T00:00:00Z',
                reporterProfile: { display_name: 'Reporter One', username: 'reporterone' },
                reportedUserProfile: { display_name: 'Reported Two', username: 'reportedtwo' },
                resolvedByProfile: null,
            }],
            isLoading: false,
            refetch: refetchComplaints,
        });
        mockUseResolveClubComplaint.mockReturnValue({ mutateAsync, isPending: false });

        const { getByText, getByTestId } = render(<ClubManageScreen />);

        fireEvent.press(getByText('Reports'));
        expect(getByText('Platform complaints')).toBeOnTheScreen();
        expect(getByText('Resolution actions create moderation records; durable resolution notes need the app-wide audit/RPC contract before they are saved.')).toBeOnTheScreen();
        expect(getByText('Reported Two')).toBeOnTheScreen();
        expect(getByText('Personal attack in chat.')).toBeOnTheScreen();

        fireEvent.press(getByTestId('resolve-complaint-no-action-complaint-1'));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({
            clubId: 'club-1',
            complaintId: 'complaint-1',
            status: 'resolved',
            resolutionAction: 'no_action',
        }));
        expect(refetchComplaints).toHaveBeenCalled();
        expect(getByText('Platform complaint resolved.')).toBeOnTheScreen();
    });

    it('bridges a platform complaint to a member warning before resolving it', async () => {
        const resolveComplaint = jest.fn().mockResolvedValue({ id: 'complaint-1', status: 'resolved' });
        const createAction = jest.fn().mockResolvedValue({ id: 'action-1' });
        const refetchComplaints = jest.fn().mockResolvedValue({ data: null });
        const refetchMembers = jest.fn().mockResolvedValue({ data: null });
        const refetchMemberActions = jest.fn().mockResolvedValue({ data: null });
        mockUseClubMembers.mockReturnValue({
            data: [{
                id: 'member-2',
                club_id: 'club-1',
                user_id: 'reader-2',
                role: 'member',
                status: 'active',
                joined_at: null,
                profile: { display_name: 'Reported Two', username: 'reportedtwo', membership_tier: 'pro' },
            }],
            isLoading: false,
            refetch: refetchMembers,
        });
        mockUseClubMemberActions.mockReturnValue({ data: [], isLoading: false, refetch: refetchMemberActions });
        mockUseCreateClubMemberAction.mockReturnValue({ mutateAsync: createAction, isPending: false });
        mockUseClubComplaints.mockReturnValue({
            data: [{
                id: 'complaint-1',
                club_id: 'club-1',
                reporter_id: 'reader-1',
                reported_user_id: 'reader-2',
                message_id: 'message-1',
                reason: 'harassment',
                description: 'Personal attack in chat.',
                status: 'pending',
                resolved_by: null,
                resolution_action: null,
                resolved_at: null,
                created_at: '2026-05-30T00:00:00Z',
                reporterProfile: { display_name: 'Reporter One', username: 'reporterone' },
                reportedUserProfile: { display_name: 'Reported Two', username: 'reportedtwo' },
                resolvedByProfile: null,
            }],
            isLoading: false,
            refetch: refetchComplaints,
        });
        mockUseResolveClubComplaint.mockReturnValue({ mutateAsync: resolveComplaint, isPending: false });

        const { getByText, getByTestId } = render(<ClubManageScreen />);

        fireEvent.press(getByText('Reports'));
        fireEvent.press(getByTestId('resolve-complaint-warned-complaint-1'));

        await waitFor(() => expect(createAction).toHaveBeenCalledWith({
            clubId: 'club-1',
            userId: 'reader-2',
            actionType: 'warned',
            reason: 'Personal attack in chat.',
            durationHours: null,
        }));
        expect(resolveComplaint).toHaveBeenCalledWith({
            clubId: 'club-1',
            complaintId: 'complaint-1',
            status: 'resolved',
            resolutionAction: 'warned',
        });
        expect(refetchComplaints).toHaveBeenCalled();
        expect(refetchMembers).toHaveBeenCalled();
        expect(refetchMemberActions).toHaveBeenCalled();
        expect(getByText('Platform complaint action saved.')).toBeOnTheScreen();
    });

    it('saves reading schedule milestones for the current book', async () => {
        const mutateAsync = jest.fn().mockResolvedValue({ id: 'schedule-1', club_id: 'club-1' });
        const refetchSchedule = jest.fn().mockResolvedValue({ data: null });
        mockUseClubPublicDetail.mockReturnValue({
            data: { ...baseClub, current_book_id: 'book-1', current_book_title: 'Beloved', current_book_authors: ['Toni Morrison'] },
            isLoading: false,
            isError: false,
            refetch: jest.fn(),
        });
        mockUseClubReadingSchedule.mockReturnValue({ data: null, isLoading: false, isError: false, error: null, refetch: refetchSchedule });
        mockUseUpsertClubReadingSchedule.mockReturnValue({ mutateAsync, isPending: false });

        const { getByText, getByTestId } = render(<ClubManageScreen />);

        fireEvent.press(getByText('Schedule'));
        fireEvent.changeText(getByTestId('schedule-label-0'), 'Week 1');
        fireEvent.changeText(getByTestId('schedule-target-0'), 'Chapters 1-5');
        fireEvent.changeText(getByTestId('schedule-due-0'), '2026-06-15');
        fireEvent.press(getByTestId('schedule-save'));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({
            clubId: 'club-1',
            bookId: 'book-1',
            createdBy: 'admin-1',
            milestones: [{
                id: expect.any(String),
                label: 'Week 1',
                target: 'Chapters 1-5',
                dueDate: '2026-06-15',
            }],
        }));
        expect(refetchSchedule).toHaveBeenCalled();
        expect(getByText('Reading schedule saved.')).toBeOnTheScreen();
    });

    it('blocks reading schedule milestones when due dates move backward', async () => {
        const mutateAsync = jest.fn().mockResolvedValue({ id: 'schedule-1', club_id: 'club-1' });
        mockUseClubPublicDetail.mockReturnValue({
            data: { ...baseClub, current_book_id: 'book-1', current_book_title: 'Beloved', current_book_authors: ['Toni Morrison'] },
            isLoading: false,
            isError: false,
            refetch: jest.fn(),
        });
        mockUseClubReadingSchedule.mockReturnValue({ data: null, isLoading: false, isError: false, error: null, refetch: jest.fn() });
        mockUseUpsertClubReadingSchedule.mockReturnValue({ mutateAsync, isPending: false });

        const { getByText, getByTestId } = render(<ClubManageScreen />);

        fireEvent.press(getByText('Schedule'));
        fireEvent.changeText(getByTestId('schedule-label-0'), 'Week 1');
        fireEvent.changeText(getByTestId('schedule-target-0'), 'Chapters 1-5');
        fireEvent.changeText(getByTestId('schedule-due-0'), '2026-06-20');
        fireEvent.press(getByTestId('schedule-add-milestone'));
        fireEvent.changeText(getByTestId('schedule-label-1'), 'Week 2');
        fireEvent.changeText(getByTestId('schedule-target-1'), 'Chapters 6-10');
        fireEvent.changeText(getByTestId('schedule-due-1'), '2026-06-10');
        fireEvent.press(getByTestId('schedule-save'));

        expect(mutateAsync).not.toHaveBeenCalled();
        expect(getByText('Due dates must stay in chronological order.')).toBeOnTheScreen();
    });

    it('blocks reading schedule milestones when chapter targets move backward', async () => {
        const mutateAsync = jest.fn().mockResolvedValue({ id: 'schedule-1', club_id: 'club-1' });
        mockUseClubPublicDetail.mockReturnValue({
            data: { ...baseClub, current_book_id: 'book-1', current_book_title: 'Beloved', current_book_authors: ['Toni Morrison'] },
            isLoading: false,
            isError: false,
            refetch: jest.fn(),
        });
        mockUseClubReadingSchedule.mockReturnValue({ data: null, isLoading: false, isError: false, error: null, refetch: jest.fn() });
        mockUseUpsertClubReadingSchedule.mockReturnValue({ mutateAsync, isPending: false });

        const { getByText, getByTestId } = render(<ClubManageScreen />);

        fireEvent.press(getByText('Schedule'));
        expect(getByText('One active schedule is stored per current book; reminder delivery is deferred to the app-wide notification pipeline.')).toBeOnTheScreen();
        fireEvent.changeText(getByTestId('schedule-label-0'), 'Week 1');
        fireEvent.changeText(getByTestId('schedule-target-0'), 'Chapters 10-12');
        fireEvent.changeText(getByTestId('schedule-due-0'), '2026-06-10');
        fireEvent.press(getByTestId('schedule-add-milestone'));
        fireEvent.changeText(getByTestId('schedule-label-1'), 'Week 2');
        fireEvent.changeText(getByTestId('schedule-target-1'), 'Chapters 1-3');
        fireEvent.changeText(getByTestId('schedule-due-1'), '2026-06-20');
        fireEvent.press(getByTestId('schedule-save'));

        expect(mutateAsync).not.toHaveBeenCalled();
        expect(getByText('Chapter targets must stay in reading order.')).toBeOnTheScreen();
    });

    it('archives the club from the lifecycle tab after confirmation', async () => {
        const mutateAsync = jest.fn().mockResolvedValue({ id: 'club-1' });
        const refetchClub = jest.fn().mockResolvedValue({ data: null });
        mockUseClubPublicDetail.mockReturnValue({ data: baseClub, isLoading: false, isError: false, refetch: refetchClub });
        mockUseArchiveClub.mockReturnValue({ mutateAsync, isPending: false });
        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
            buttons?.find((button) => button.text === 'Archive')?.onPress?.();
        });

        const { getByText, getByTestId } = render(<ClubManageScreen />);

        fireEvent.press(getByText('Lifecycle'));
        fireEvent.press(getByTestId('manage-archive-club'));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ clubId: 'club-1' }));
        expect(refetchClub).toHaveBeenCalled();
        expect(getByText('Club archived. You can restore it from Archived clubs.')).toBeOnTheScreen();
        alertSpy.mockRestore();
    });

    it('opens a requested manage route tab on initial render', () => {
        mockUseLocalSearchParams.mockReturnValue({ clubId: 'club-1', tab: 'lifecycle' });

        const { getByText } = render(<ClubManageScreen />);

        expect(getByText('Archive status')).toBeOnTheScreen();
        expect(getByText('Admin succession')).toBeOnTheScreen();
    });

    it('surfaces downgrade succession and archive retention guidance in lifecycle', () => {
        const { getByText } = render(<ClubManageScreen />);

        fireEvent.press(getByText('Lifecycle'));

        expect(getByText('Downgrade succession')).toBeOnTheScreen();
        expect(getByText('Select a Pro or Pro+ successor before downgrading the current admin so the club stays active.')).toBeOnTheScreen();
        expect(getByText('Automatic successor selection is not enabled yet. Request a successor before downgrade.')).toBeOnTheScreen();
        expect(getByText('Archive retention')).toBeOnTheScreen();
        expect(getByText('Archived clubs stay restorable for admins while retention rules are active.')).toBeOnTheScreen();
        expect(getByText('Deletion rules are policy-controlled; archived clubs stay restorable until a retention rule is rolled out.')).toBeOnTheScreen();
    });

    it('surfaces lifecycle readiness, successor coverage, retention state, and admin warnings', () => {
        mockUseClubMembers.mockReturnValue({
            data: [
                { id: 'member-admin', club_id: 'club-1', user_id: 'admin-1', role: 'admin', status: 'active', joined_at: null, profile: { display_name: 'Admin Reader', username: 'adminreader', membership_tier: 'pro_plus' } },
                { id: 'member-2', club_id: 'club-1', user_id: 'reader-2', role: 'member', status: 'active', joined_at: null, profile: { display_name: 'Reader Two', username: 'readertwo', membership_tier: 'pro' } },
                { id: 'member-3', club_id: 'club-1', user_id: 'reader-3', role: 'member', status: 'active', joined_at: null, profile: { display_name: 'Reader Three', username: 'readerthree', membership_tier: 'free' } },
            ],
            isLoading: false,
            refetch: jest.fn(),
        });
        mockUseClubAdminTransferRequests.mockReturnValue({
            data: [{
                id: 'request-1',
                club_id: 'club-1',
                requested_by: 'admin-1',
                proposed_admin_user_id: 'reader-2',
                status: 'pending',
                created_at: '2026-06-01T00:00:00Z',
                responded_at: null,
                expires_at: '2026-06-15T00:00:00Z',
            }],
            isLoading: false,
            refetch: jest.fn(),
        });

        const { getByText } = render(<ClubManageScreen />);

        fireEvent.press(getByText('Lifecycle'));

        expect(getByText('Lifecycle policy')).toBeOnTheScreen();
        expect(getByText('Downgrade readiness')).toBeOnTheScreen();
        expect(getByText('Ready for admin handoff: an eligible successor has a pending request.')).toBeOnTheScreen();
        expect(getByText('Successor coverage')).toBeOnTheScreen();
        expect(getByText('1 eligible successor · 1 pending transfer request')).toBeOnTheScreen();
        expect(getByText('Archive retention state')).toBeOnTheScreen();
        expect(getByText('Active: no archive retention countdown is running for this club.')).toBeOnTheScreen();
        expect(getByText('Admin warning')).toBeOnTheScreen();
        expect(getByText('This screen does not automatically demote admins, transfer ownership, archive excess clubs, or delete archived clubs. Use explicit requests until product policy confirms automation.')).toBeOnTheScreen();
    });

    it('requests admin transfer to an eligible Pro member from lifecycle', async () => {
        const mutateAsync = jest.fn().mockResolvedValue({ id: 'club-1' });
        const refetchRequests = jest.fn().mockResolvedValue({ data: null });
        mockUseRequestClubAdminTransfer.mockReturnValue({ mutateAsync, isPending: false });
        mockUseClubAdminTransferRequests.mockReturnValue({ data: [], isLoading: false, refetch: refetchRequests });
        mockUseClubMembers.mockReturnValue({
            data: [
                { id: 'member-admin', club_id: 'club-1', user_id: 'admin-1', role: 'admin', status: 'active', joined_at: null, profile: { display_name: 'Admin Reader', username: 'adminreader', membership_tier: 'pro_plus' } },
                { id: 'member-2', club_id: 'club-1', user_id: 'reader-2', role: 'member', status: 'active', joined_at: null, profile: { display_name: 'Reader Two', username: 'readertwo', membership_tier: 'pro' } },
            ],
            isLoading: false,
            refetch: jest.fn(),
        });
        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
            buttons?.find((button) => button.text === 'Send request')?.onPress?.();
        });

        const { getByText, getByTestId } = render(<ClubManageScreen />);

        fireEvent.press(getByText('Lifecycle'));
        fireEvent.press(getByTestId('transfer-admin-reader-2'));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ clubId: 'club-1', newAdminUserId: 'reader-2' }));
        expect(refetchRequests).toHaveBeenCalled();
        expect(getByText('Admin transfer request sent to Reader Two.')).toBeOnTheScreen();
        alertSpy.mockRestore();
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

        expect(getByText('Nominations are the default source of truth for choosing the club\'s current read.')).toBeOnTheScreen();
        expect(getByText('Admin shortcut: set this active nomination as the current read before voting closes.')).toBeOnTheScreen();
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
            const confirmButton = buttons?.find((button) => button.text === 'Apply override');
            confirmButton?.onPress?.();
        });

        const { getByTestId, getByText } = render(<ClubManageScreen />);

        fireEvent.press(getByTestId('manage-toggle-override'));
        await waitFor(() => expect(getByText('Admin override')).toBeOnTheScreen());

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
        await waitFor(() => expect(getByText('Admin override')).toBeOnTheScreen());

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
        await waitFor(() => expect(getByText('Admin override')).toBeOnTheScreen());

        fireEvent.changeText(getByTestId('manage-override-search'), 'Cached Book');

        await waitFor(() => expect(jest.requireMock('@/features/books/services/booksService').searchGoogleBooksCached).toHaveBeenCalledWith('Cached Book', 0, 10));
        await waitFor(() => expect(getByText('Showing cached results')).toBeOnTheScreen());
    });

    it('handles a manual override search button press on web without treating the press event as the query', async () => {
        const searchGoogleBooksCached = jest.requireMock('@/features/books/services/booksService').searchGoogleBooksCached;
        searchGoogleBooksCached.mockResolvedValue({ items: [], totalItems: 0, hasMore: false, fromCache: false });

        const { getByTestId, getByText } = render(<ClubManageScreen />);
        fireEvent.press(getByTestId('manage-toggle-override'));
        await waitFor(() => expect(getByText('Admin override')).toBeOnTheScreen());

        fireEvent.changeText(getByTestId('manage-override-search'), 'ab');
        fireEvent.press(getByText('Search'));

        expect(searchGoogleBooksCached).not.toHaveBeenCalled();
        expect(getByText('Enter at least 3 characters to search Google Books.')).toBeOnTheScreen();
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
                    applicantProfile: { display_name: 'Book Lover', username: 'booklover' },
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
        mockUseClubPublicDetail.mockReturnValue({
            data: {
                ...baseClub,
                current_book_id: 'book-1',
                current_book_title: 'Book One',
                current_book_authors: ['A'],
            },
            isLoading: false,
            isError: false,
            refetch: jest.fn(),
        });
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
        mockUseClubCurrentBookStatusOverview.mockReturnValue({
            data: {
                current_book_id: 'book-1',
                member_reading_status: 'reading',
                to_start_count: 1,
                reading_count: 1,
                completed_count: 1,
                active_member_count: 3,
            },
            isLoading: false,
            isError: false,
            error: null,
            refetch: jest.fn(),
        });

        const { getByText, getAllByText } = render(<ClubManageScreen />);

        fireEvent.press(getByText('Analytics'));
        expect(getByText('Club overview')).toBeOnTheScreen();
        expect(getAllByText('3')[0]).toBeOnTheScreen(); // Members
        expect(getAllByText('Members')[1]).toBeOnTheScreen();
        // Use specific stat labels to avoid ambiguity with duplicate numbers
        expect(getAllByText('1')[0]).toBeOnTheScreen(); // Moderators
        expect(getByText('Members / Capacity')).toBeOnTheScreen();
        expect(getByText('3/30')).toBeOnTheScreen();
        expect(getByText('Reading progress')).toBeOnTheScreen();
        expect(getByText('To start')).toBeOnTheScreen();
        expect(getByText('Completed')).toBeOnTheScreen();
    });

    it('shows an error message when current-book analytics fail to load', () => {
        mockUseClubPublicDetail.mockReturnValue({
            data: {
                ...baseClub,
                current_book_id: 'book-1',
                current_book_title: 'Book One',
                current_book_authors: ['A'],
            },
            isLoading: false,
            isError: false,
            refetch: jest.fn(),
        });
        mockUseClubMembers.mockReturnValue({
            data: [
                { id: 'member-1', club_id: 'club-1', user_id: 'admin-1', role: 'admin', status: 'active', joined_at: null, profile: { display_name: 'Admin', username: 'admin' } },
            ],
            isLoading: false,
            refetch: jest.fn(),
        });
        mockUseClubBookNominations.mockReturnValue({
            data: [],
            isLoading: false,
            isError: false,
            error: null,
            refetch: jest.fn(),
        });
        mockUseClubEvents.mockReturnValue({
            data: [],
            isLoading: false,
            refetch: jest.fn(),
        });
        mockUseClubCurrentBookStatusOverview.mockReturnValue({
            data: null,
            isLoading: false,
            isError: true,
            error: new Error('Current book progress is unavailable.'),
            refetch: jest.fn(),
        });

        const { getByText } = render(<ClubManageScreen />);

        fireEvent.press(getByText('Analytics'));
        expect(getByText('Current book progress is unavailable.')).toBeOnTheScreen();
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

    it('records a warning action from the Members tab', async () => {
        const mutateAsync = jest.fn().mockResolvedValue({ id: 'action-1' });
        const refetchMembers = jest.fn().mockResolvedValue({ data: null });
        const refetchActions = jest.fn().mockResolvedValue({ data: null });
        mockUseClubMembers.mockReturnValue({
            data: [
                { id: 'member-admin', club_id: 'club-1', user_id: 'admin-1', role: 'admin', status: 'active', joined_at: null, profile: { display_name: 'Admin Reader', username: 'adminreader' } },
                { id: 'member-2', club_id: 'club-1', user_id: 'reader-2', role: 'member', status: 'active', joined_at: null, profile: { display_name: 'Reader Two', username: 'readertwo' } },
            ],
            isLoading: false,
            refetch: refetchMembers,
        });
        mockUseClubMemberActions.mockReturnValue({ data: [], isLoading: false, refetch: refetchActions });
        mockUseCreateClubMemberAction.mockReturnValue({ mutateAsync, isPending: false });

        const { getByText, getByTestId } = render(<ClubManageScreen />);

        fireEvent.press(getByText('Members'));
        fireEvent.press(getByTestId('member-action-warned-reader-2'));
        fireEvent.changeText(getByTestId('member-action-reason-reader-2'), 'Repeated spoilers');
        fireEvent.press(getByTestId('member-action-submit-reader-2'));

        await waitFor(() => {
            expect(mutateAsync).toHaveBeenCalledWith({
                clubId: 'club-1',
                userId: 'reader-2',
                actionType: 'warned',
                reason: 'Repeated spoilers',
                durationHours: null,
            });
        });
        expect(refetchMembers).toHaveBeenCalled();
        expect(refetchActions).toHaveBeenCalled();
        await waitFor(() => expect(getByText('Reader Two moderation action saved.')).toBeOnTheScreen());
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

    it('preserves the directory origin when opening the venue picker', () => {
        mockUseLocalSearchParams.mockReturnValue({ clubId: 'club-1', tab: 'venues', clubOrigin: 'my-clubs' });
        const { getByTestId } = render(<ClubManageScreen />);
        fireEvent.press(getByTestId('manage-venues-add'));
        expect(mockRouterPush).toHaveBeenCalledWith('/clubs/club-1/venues?returnTo=manage-venues&clubOrigin=my-clubs');
    });

});
