jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({
    router: {
        back: (...args: unknown[]) => mockRouterBack(...args),
        push: (...args: unknown[]) => mockRouterPush(...args),
    },
}));

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ClubInvitationsInboxScreen from '../ClubInvitationsInboxScreen';

const mockUseMyClubInvitationInbox = jest.fn();
const mockUseMarkInvitationRead = jest.fn();
const mockUseAcceptClubInvitation = jest.fn();
const mockRouterBack = jest.fn();
const mockRouterPush = jest.fn();

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
    useAuth: () => ({ user: { id: 'reader-1' } }),
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
        expect(getByText('Manage notification preferences for new invite-only club invitations.')).toBeOnTheScreen();

        fireEvent.press(getByTestId('club-invitations-notification-settings'));

        expect(mockRouterPush).toHaveBeenCalledWith('/(tabs)/profile/settings');
    });

    it('marks unread invitations read before opening club detail', async () => {
        const markRead = jest.fn().mockResolvedValue(baseInvite);
        mockUseMarkInvitationRead.mockReturnValue({ mutateAsync: markRead, isPending: false });
        const { getByTestId } = render(<ClubInvitationsInboxScreen />);

        fireEvent.press(getByTestId('club-invitation-open-invite-1'));

        await waitFor(() => {
            expect(markRead).toHaveBeenCalledWith({ invitationId: 'invite-1', clubId: 'club-1', userId: 'reader-1' });
        });
        expect(mockRouterPush).toHaveBeenCalledWith('/(tabs)/clubs/club-1');
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
});
