jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({
    router: { push: (...args: unknown[]) => mockRouterPush(...args) },
}));

import { fireEvent, render } from '@testing-library/react-native';
import ClubsBrowseScreen from '../index';

const mockUseBrowseClubs = jest.fn();
const mockUseMyBrowseClubs = jest.fn();
const mockUseMyArchivedManagedClubs = jest.fn();
const mockUseMyClubInvitationInbox = jest.fn();
const mockUseViewerMembershipTier = jest.fn();
const mockRouterPush = jest.fn();

jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            bgPrimary: '#FFFFFF', bgCard: '#F8FAFC', bgSecondary: '#EEF2FF', border: '#CBD5E1',
            accent: '#4F46E5', textPrimary: '#0F172A', textSecondary: '#475569', textTertiary: '#94A3B8',
        },
    }),
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 'reader-1' } }),
}));
jest.mock('@/features/clubs/hooks/useClubs', () => ({
    useBrowseClubs: (...args: unknown[]) => mockUseBrowseClubs(...args),
    useMyBrowseClubs: (...args: unknown[]) => mockUseMyBrowseClubs(...args),
    useMyArchivedManagedClubs: (...args: unknown[]) => mockUseMyArchivedManagedClubs(...args),
    useMyClubInvitationInbox: (...args: unknown[]) => mockUseMyClubInvitationInbox(...args),
}));
jest.mock('@/features/clubs/hooks/useViewerMembershipTier', () => ({
    useViewerMembershipTier: (...args: unknown[]) => mockUseViewerMembershipTier(...args),
}));
jest.mock('@/features/clubs/components/ClubCard', () => ({
    ClubCard: ({ club, onPress }: { club: { id: string; name: string }; onPress: (club: { id: string; name: string }) => void }) => {
        const React = require('react');
        const { TouchableOpacity, Text } = require('react-native');
        return React.createElement(TouchableOpacity, { onPress: () => onPress(club), testID: `club-card-${club.name}` }, React.createElement(Text, null, club.name));
    },
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockRouterPush.mockReset();
    mockUseBrowseClubs.mockReturnValue({ data: [{ id: 'club-1', name: 'Open Readers' }], isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false });
    mockUseMyBrowseClubs.mockReturnValue({ data: [{ id: 'club-2', name: 'Quiet Members' }], isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false });
    mockUseMyArchivedManagedClubs.mockReturnValue({ data: [{ id: 'club-3', name: 'Archived Circle' }], isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false });
    mockUseMyClubInvitationInbox.mockReturnValue({ data: [], isLoading: false });
    mockUseViewerMembershipTier.mockReturnValue({ tier: 'free', isLoading: false });
});

describe('ClubsBrowseScreen', () => {
    it('defaults to Discover scope with the reader-first hierarchy and no admin banner', () => {
        const { getByText, getByTestId, queryByText } = render(<ClubsBrowseScreen />);

        expect(getByText('BookConnect')).toBeOnTheScreen();
        expect(getByText('Clubs')).toBeOnTheScreen();
        expect(getByText('Discover')).toBeOnTheScreen();
        expect(getByText('Your Clubs • 1')).toBeOnTheScreen();
        expect(getByTestId('clubs-search-input')).toBeOnTheScreen();
        expect(getByTestId('clubs-filters-open')).toBeOnTheScreen();
        expect(getByText('Clubs to explore')).toBeOnTheScreen();
        expect(getByText('Open Readers')).toBeOnTheScreen();
        expect(getByTestId('clubs-archived-link')).toBeOnTheScreen();
        expect(queryByText(/invite acceptance, invitation revocation, read-state support, and archived-club recovery are live/i)).toBeNull();
        expect(queryByText(/still pending backend support/i)).toBeNull();
    });

    it('shows an unread invitations badge and opens the invitation inbox', () => {
        mockUseMyClubInvitationInbox.mockReturnValue({
            data: [
                { id: 'invite-1', read_at: null },
                { id: 'invite-2', read_at: '2026-05-23T00:00:00Z' },
            ],
            isLoading: false,
        });

        const { getByText, getByTestId } = render(<ClubsBrowseScreen />);

        expect(getByText('1')).toBeOnTheScreen();

        fireEvent.press(getByTestId('clubs-invitations-inbox'));

        expect(mockRouterPush).toHaveBeenCalledWith('/(tabs)/clubs/invitations');
    });

    it('shows a dedicated author clubs discovery section when author clubs are present', () => {
        mockUseBrowseClubs.mockReturnValue({
            data: [
                { id: 'club-1', name: 'Open Readers', club_type: 'public' },
                { id: 'club-author-1', name: 'Author Salon', club_type: 'author_club', author_display_name: 'Asha Dev' },
            ],
            isLoading: false,
            isError: false,
            refetch: jest.fn(),
            isRefetching: false,
        });

        const { getByText, getByTestId, queryByText } = render(<ClubsBrowseScreen />);

        expect(getByText('Author clubs spotlight')).toBeOnTheScreen();
        expect(getByText('AMA-style discussions, signed-edition reads, and verified author communities.')).toBeOnTheScreen();
        expect(getByText('1 verified author club')).toBeOnTheScreen();
        expect(queryByText('Create Club')).toBeNull();

        fireEvent.press(getByTestId('author-clubs-landing-link'));

        expect(mockRouterPush).toHaveBeenCalledWith('/(tabs)/clubs/authors');
    });

    it('opens venue discovery from the clubs browse screen', () => {
        const { getByTestId } = render(<ClubsBrowseScreen />);

        fireEvent.press(getByTestId('clubs-venues-discovery-link'));

        expect(mockRouterPush).toHaveBeenCalledWith('/(tabs)/clubs/venues');
    });

    it('maps Your Clubs to the mine scope with membership copy and results', () => {
        const { getByText, getByTestId } = render(<ClubsBrowseScreen />);

        fireEvent.press(getByTestId('clubs-filter-scope-mine'));

        expect(mockUseMyBrowseClubs).toHaveBeenLastCalledWith('reader-1', expect.any(Object), true);
        expect(getByText('Your clubs')).toBeOnTheScreen();
        expect(getByText('Quiet Members')).toBeOnTheScreen();
    });

    it('returns to Discover from Your Clubs', () => {
        const { getByText, getByTestId } = render(<ClubsBrowseScreen />);

        fireEvent.press(getByTestId('clubs-filter-scope-mine'));
        expect(getByText('Quiet Members')).toBeOnTheScreen();

        fireEvent.press(getByTestId('clubs-filter-scope-all'));

        expect(getByText('Clubs to explore')).toBeOnTheScreen();
        expect(getByText('Open Readers')).toBeOnTheScreen();
    });

    it('keeps archived clubs reachable as a secondary action and routes archived cards to lifecycle management', () => {
        const { getByText, getByTestId } = render(<ClubsBrowseScreen />);

        fireEvent.press(getByTestId('clubs-archived-link'));

        expect(mockUseMyArchivedManagedClubs).toHaveBeenLastCalledWith('reader-1', expect.any(Object), true);
        expect(getByText('Archived clubs')).toBeOnTheScreen();
        expect(getByText('Archived Circle')).toBeOnTheScreen();

        fireEvent.press(getByTestId('club-card-Archived Circle'));

        expect(mockRouterPush).toHaveBeenCalledWith('/(tabs)/clubs/club-3/manage?tab=lifecycle');
    });

    it('returns to Discover from the archived scope', () => {
        const { getByText, getByTestId } = render(<ClubsBrowseScreen />);

        fireEvent.press(getByTestId('clubs-archived-link'));
        expect(getByText('Archived clubs')).toBeOnTheScreen();

        fireEvent.press(getByTestId('clubs-archived-back'));

        expect(getByText('Clubs to explore')).toBeOnTheScreen();
    });

    it('shows scope-aware retry copy without the empty state when my clubs fails to load', () => {
        mockUseMyBrowseClubs.mockImplementation((_userId: string, _filters: unknown, enabled: boolean) => (
            enabled
                ? { data: [], isLoading: false, isError: true, refetch: jest.fn(), isRefetching: false }
                : { data: [{ id: 'club-2', name: 'Quiet Members' }], isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false }
        ));

        const { getByTestId, getByText, queryByText } = render(<ClubsBrowseScreen />);

        fireEvent.press(getByTestId('clubs-filter-scope-mine'));

        expect(getByText('Couldn’t load clubs')).toBeOnTheScreen();
        expect(getByText('Try refreshing to fetch your latest membership-linked club list from Supabase.')).toBeOnTheScreen();
        expect(queryByText('You have not joined any clubs yet')).toBeNull();
    });

    it('exposes every existing filter option through the compact Filters control', () => {
        const { getByTestId, getByText } = render(<ClubsBrowseScreen />);

        fireEvent.press(getByTestId('clubs-filters-open'));

        for (const label of ['All', 'Public', 'Approval', 'Invite only', 'Author clubs', 'Any', 'Online', 'Venue', 'Hybrid', 'All access', 'All members', 'Pro', 'Pro+']) {
            expect(getByText(label)).toBeOnTheScreen();
        }
    });

    it('applies a club-type filter from the sheet without dropping the other dimensions', () => {
        const { getByTestId } = render(<ClubsBrowseScreen />);

        fireEvent.press(getByTestId('clubs-filters-open'));
        fireEvent.press(getByTestId('clubs-filter-type-author_club'));

        const lastFilters = mockUseBrowseClubs.mock.calls[mockUseBrowseClubs.mock.calls.length - 1][0] as Record<string, unknown>;
        expect(lastFilters).toMatchObject({ clubType: 'author_club', limit: 20, offset: 0 });
        expect(getByTestId('clubs-filters-active-count')).toBeOnTheScreen();
    });

    it('resets all filter dimensions from the sheet', () => {
        const { getByTestId, queryByTestId } = render(<ClubsBrowseScreen />);

        fireEvent.press(getByTestId('clubs-filters-open'));
        fireEvent.press(getByTestId('clubs-filter-type-public'));
        expect(getByTestId('clubs-filters-active-count')).toBeOnTheScreen();

        fireEvent.press(getByTestId('clubs-filters-reset'));

        const lastFilters = mockUseBrowseClubs.mock.calls[mockUseBrowseClubs.mock.calls.length - 1][0] as Record<string, unknown>;
        expect(lastFilters).toMatchObject({ clubType: undefined, meetingType: undefined, accessLevel: undefined });
        expect(queryByTestId('clubs-filters-active-count')).toBeNull();
    });

    it('shows Create Club only for eligible Pro members and routes to creation', () => {
        mockUseViewerMembershipTier.mockReturnValue({ tier: 'pro', isLoading: false });

        const { getByTestId } = render(<ClubsBrowseScreen />);

        fireEvent.press(getByTestId('clubs-create-club'));

        expect(mockRouterPush).toHaveBeenCalledWith('/(tabs)/clubs/create');
    });

    it('taps a discovery row through to club detail', () => {
        const { getByTestId } = render(<ClubsBrowseScreen />);

        fireEvent.press(getByTestId('club-card-Open Readers'));

        expect(mockRouterPush).toHaveBeenCalledWith('/(tabs)/clubs/club-1');
    });
});
