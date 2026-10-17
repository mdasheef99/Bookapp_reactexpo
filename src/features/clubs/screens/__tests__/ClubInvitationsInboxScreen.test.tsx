jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({
    router: {
        back: (...args: unknown[]) => mockRouterBack(...args),
        push: (...args: unknown[]) => mockRouterPush(...args),
        replace: (...args: unknown[]) => mockRouterReplace(...args),
    },
    useLocalSearchParams: () => mockSearchParams,
}));

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ClubInvitationsInboxScreen from '../ClubInvitationsInboxScreen';

const mockUseMyClubInvitationInbox = jest.fn();
const mockUseMarkInvitationRead = jest.fn();
const mockUseAcceptClubInvitation = jest.fn();
const mockRouterBack = jest.fn();
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
const mockUseAuth = jest.fn();
let mockSearchParams: { clubOrigin?: string } = {};

jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            bgPrimary: '#FFFFFF', bgCard: '#F8FAFC', bgSecondary: '#EEF2FF', border: '#CBD5E1',
            accent: '#4F46E5', textPrimary: '#0F172A', textSecondary: '#475569', textTertiary: '#94A3B8',
            success: '#16A34A', error: '#DC2626',
        },
    }),
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({
    useAuth: () => mockUseAuth(),
}));
jest.mock('@/features/clubs/hooks/useClubs', () => ({
    useMyClubInvitationInbox: (...args: unknown[]) => mockUseMyClubInvitationInbox(...args),
    useMarkInvitationRead: (...args: unknown[]) => mockUseMarkInvitationRead(...args),
    useAcceptClubInvitation: (...args: unknown[]) => mockUseAcceptClubInvitation(...args),
}));

const baseInvite = {
    id: 'invite-1',
    club_id: 'club-1',
    inviter_user_id: 'admin-1',
    invitee_user_id: 'reader-1',
    status: 'pending',
    note: 'Bring your favorite annotation.',
    created_at: '2026-05-23T00:00:00Z',
    responded_at: null,
    read_at: null,
    inviterProfile: { display_name: 'Admin Reader', username: 'adminreader' },
    inviteeProfile: null,
    club: {
        id: 'club-1',
        name: 'Quiet Sci-Fi Circle',
        club_type: 'invite_only',
        current_book_title: 'Dune',
        admin_display_name: 'Admin Reader',
    },
};

const acceptedInvite = {
    ...baseInvite,
    id: 'invite-accepted',
    club_id: 'club-accepted',
    status: 'accepted',
    note: null,
    responded_at: '2026-05-24T00:00:00Z',
    read_at: '2026-05-23T01:00:00Z',
    club: {
        ...baseInvite.club,
        id: 'club-accepted',
        name: 'Accepted Classics',
        current_book_title: 'Beloved',
    },
};

beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = {};
    mockUseAuth.mockReturnValue({ user: { id: 'reader-1' } });
    mockUseMyClubInvitationInbox.mockReturnValue({ data: [baseInvite], isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false });
    mockUseMarkInvitationRead.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseAcceptClubInvitation.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
});

describe('ClubInvitationsInboxScreen', () => {
    it('renders pending invitations with unread state and club context', () => {
        const { getAllByText, getByText } = render(<ClubInvitationsInboxScreen />);

        expect(getByText('Club invitations')).toBeOnTheScreen();
        expect(getByText('Quiet Sci-Fi Circle')).toBeOnTheScreen();
        expect(getAllByText('Unread').length).toBeGreaterThan(0);
        expect(getByText('Current read: Dune')).toBeOnTheScreen();
        expect(getByText('Invited by Admin Reader')).toBeOnTheScreen();
    });

    it('groups historical invitations separately without pending actions', () => {
        mockUseMyClubInvitationInbox.mockReturnValue({ data: [baseInvite, acceptedInvite], isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false });

        const { getByText, queryByTestId } = render(<ClubInvitationsInboxScreen />);

        expect(getByText('Pending invitations')).toBeOnTheScreen();
        expect(getByText('Past invitations')).toBeOnTheScreen();
        expect(getByText('Accepted Classics')).toBeOnTheScreen();
        expect(getByText('Accepted')).toBeOnTheScreen();
        expect(queryByTestId('club-invitation-accept-invite-accepted')).toBeNull();
    });

    it('hands invitation reminders off to notification settings', () => {
        const { getByTestId, getByText } = render(<ClubInvitationsInboxScreen />);

        expect(getByText('Invitation reminders')).toBeOnTheScreen();
        expect(getByText('Choose how you hear about new club invitations.')).toBeOnTheScreen();

        fireEvent.press(getByTestId('club-invitations-notification-settings'));

        expect(mockRouterPush).toHaveBeenCalledWith('/(tabs)/profile/settings?returnTo=club-invitations');
    });

    it.each([
        ['my-clubs', '/(tabs)/clubs?scope=mine'],
        ['archived', '/(tabs)/clubs?scope=archived'],
    ])('returns to the originating %s directory from the inbox', async (clubOrigin, expectedHref) => {
        mockSearchParams = { clubOrigin };
        const { getByRole } = render(<ClubInvitationsInboxScreen />);

        await waitFor(() => expect(getByRole('button', { name: 'Back to clubs' })).toBeOnTheScreen());
        fireEvent.press(getByRole('button', { name: 'Back to clubs' }));

        expect(mockRouterReplace).toHaveBeenCalledWith(expectedHref);
    });

    it('marks unread invitations read before opening club detail', async () => {
        const markRead = jest.fn().mockResolvedValue(baseInvite);
        mockUseMarkInvitationRead.mockReturnValue({ mutateAsync: markRead, isPending: false });
        const { getByTestId } = render(<ClubInvitationsInboxScreen />);

        fireEvent.press(getByTestId('club-invitation-open-invite-1'));

        await waitFor(() => {
            expect(markRead).toHaveBeenCalledWith({ invitationId: 'invite-1', clubId: 'club-1', userId: 'reader-1' });
        });
        expect(mockRouterPush).toHaveBeenCalledWith('/(tabs)/clubs/club-1?returnTo=invitations');
    });

    it('accepts an invitation from the inbox', async () => {
        const acceptInvite = jest.fn().mockResolvedValue({ id: 'member-1', club_id: 'club-1', user_id: 'reader-1', status: 'active' });
        mockUseAcceptClubInvitation.mockReturnValue({ mutateAsync: acceptInvite, isPending: false });
        const { getByTestId, getByText } = render(<ClubInvitationsInboxScreen />);

        fireEvent.press(getByTestId('club-invitation-accept-invite-1'));

        await waitFor(() => {
            expect(acceptInvite).toHaveBeenCalledWith({ invitationId: 'invite-1', clubId: 'club-1', userId: 'reader-1' });
        });
        expect(getByText('Invitation accepted. You are now an active member of Quiet Sci-Fi Circle.')).toBeOnTheScreen();
    });

    it('opens an already read invitation without marking it read again', async () => {
        const markRead = jest.fn();
        mockUseMarkInvitationRead.mockReturnValue({ mutateAsync: markRead, isPending: false });
        mockUseMyClubInvitationInbox.mockReturnValue({ data: [{ ...baseInvite, read_at: '2026-05-23T01:00:00Z' }], isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false });
        const { getByTestId } = render(<ClubInvitationsInboxScreen />);

        fireEvent.press(getByTestId('club-invitation-open-invite-1'));

        await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/(tabs)/clubs/club-1?returnTo=invitations'));
        expect(markRead).not.toHaveBeenCalled();
    });

    it('keeps the inbox open and displays an error when marking read fails', async () => {
        mockUseMarkInvitationRead.mockReturnValue({ mutateAsync: jest.fn().mockRejectedValue(new Error('Read update failed.')), isPending: false });
        const { getByTestId, getByText } = render(<ClubInvitationsInboxScreen />);

        fireEvent.press(getByTestId('club-invitation-open-invite-1'));

        await waitFor(() => expect(getByText('Read update failed.')).toBeOnTheScreen());
        expect(mockRouterPush).not.toHaveBeenCalled();
    });

    it('displays acceptance errors without reporting success', async () => {
        mockUseAcceptClubInvitation.mockReturnValue({ mutateAsync: jest.fn().mockRejectedValue(new Error('Invitation expired.')), isPending: false });
        const { getByTestId, getByText, queryByText } = render(<ClubInvitationsInboxScreen />);

        fireEvent.press(getByTestId('club-invitation-accept-invite-1'));

        await waitFor(() => expect(getByText('Invitation expired.')).toBeOnTheScreen());
        expect(queryByText(/You are now an active member/)).toBeNull();
    });

    it('preserves disabled action states while invitation mutations are pending', () => {
        mockUseMarkInvitationRead.mockReturnValue({ mutateAsync: jest.fn(), isPending: true });
        mockUseAcceptClubInvitation.mockReturnValue({ mutateAsync: jest.fn(), isPending: true });
        const { getByTestId } = render(<ClubInvitationsInboxScreen />);

        expect(getByTestId('club-invitation-open-invite-1')).toBeDisabled();
        expect(getByTestId('club-invitation-accept-invite-1')).toBeDisabled();
    });

    it('requests the next twenty invitations when load more is pressed', () => {
        const invitations = Array.from({ length: 20 }, (_, index) => ({ ...baseInvite, id: 'invite-' + index }));
        mockUseMyClubInvitationInbox.mockReturnValue({ data: invitations, isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false });
        const { getByTestId } = render(<ClubInvitationsInboxScreen />);

        fireEvent.press(getByTestId('club-invitations-load-more'));

        expect(mockUseMyClubInvitationInbox).toHaveBeenLastCalledWith('reader-1', { limit: 40 });
    });

    it('refreshes through the visible web control and disables it during refetch', () => {
        const refetch = jest.fn();
        mockUseMyClubInvitationInbox.mockReturnValue({ data: [baseInvite], isLoading: false, isError: false, refetch, isRefetching: false });
        const { getByTestId, rerender } = render(<ClubInvitationsInboxScreen />);
        fireEvent.press(getByTestId('club-invitations-refresh'));
        expect(refetch).toHaveBeenCalledTimes(1);

        mockUseMyClubInvitationInbox.mockReturnValue({ data: [baseInvite], isLoading: false, isError: false, refetch, isRefetching: true });
        rerender(<ClubInvitationsInboxScreen />);
        expect(getByTestId('club-invitations-refresh')).toBeDisabled();
    });

    it('shows sign-in guidance and omits notification settings when signed out', () => {
        mockUseAuth.mockReturnValue({ user: null });
        mockUseMyClubInvitationInbox.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false });
        const { getByText, getByTestId, queryByTestId } = render(<ClubInvitationsInboxScreen />);

        expect(getByText('Sign in to view invitations')).toBeOnTheScreen();
        expect(getByTestId('club-invitations-refresh')).toBeDisabled();
        expect(queryByTestId('club-invitations-notification-settings')).toBeNull();
        expect(mockUseMyClubInvitationInbox).toHaveBeenCalledWith(null, { limit: 20 });
    });

    it('retains history metadata and limits all past statuses to View club', () => {
        const history = ['accepted', 'expired', 'revoked'].map((status) => ({ ...acceptedInvite, id: status, status }));
        mockUseMyClubInvitationInbox.mockReturnValue({ data: history, isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false });
        const { getByTestId, queryByTestId, getAllByText } = render(<ClubInvitationsInboxScreen />);

        for (const invitation of history) {
            expect(getByTestId('club-invitation-open-' + invitation.id)).toBeOnTheScreen();
            expect(queryByTestId('club-invitation-accept-' + invitation.id)).toBeNull();
        }
        expect(getAllByText('Current read: Beloved')).toHaveLength(3);
        expect(getAllByText('Updated ' + new Date(acceptedInvite.responded_at).toLocaleString())).toHaveLength(3);
    });
    it.each(['my-clubs', 'archived'])('carries %s into the Settings detour and directory fallback', (clubOrigin) => {
        mockSearchParams = { clubOrigin };
        const screen = render(<ClubInvitationsInboxScreen />);
        fireEvent.press(screen.getByTestId('club-invitations-notification-settings'));
        expect(mockRouterPush).toHaveBeenCalledWith(`/(tabs)/profile/settings?returnTo=club-invitations&clubOrigin=${clubOrigin}`);
        fireEvent.press(screen.getByLabelText('Back to clubs'));
        expect(mockRouterReplace).toHaveBeenCalledWith(`/(tabs)/clubs?scope=${clubOrigin === 'my-clubs' ? 'mine' : 'archived'}`);
    });

});
