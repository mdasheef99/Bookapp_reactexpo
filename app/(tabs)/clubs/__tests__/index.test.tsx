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
let mockAuthUser: { id: string } | null = { id: 'reader-1' };

jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            bgPrimary: '#FFFFFF', bgCard: '#F8FAFC', bgSecondary: '#EEF2FF', border: '#CBD5E1',
            accent: '#4F46E5', textPrimary: '#0F172A', textSecondary: '#475569', textTertiary: '#94A3B8',
        },
    }),
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({
    useAuth: () => ({ user: mockAuthUser }),
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
jest.mock('@/features/clubs/components/YourClubsCard', () => ({
    YourClubsCard: ({ club, onPress }: { club: { id: string; name: string }; onPress: (club: { id: string; name: string }) => void }) => {
        const React = require('react');
        const { TouchableOpacity, Text } = require('react-native');
        return React.createElement(TouchableOpacity, { onPress: () => onPress(club), testID: `your-club-card-${club.id}` }, React.createElement(Text, null, club.name));
    },
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockRouterPush.mockReset();
    mockAuthUser = { id: 'reader-1' };
    mockUseBrowseClubs.mockReturnValue({ data: [{ id: 'club-1', name: 'Open Readers' }], isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false });
    mockUseMyBrowseClubs.mockReturnValue({ data: [{ id: 'club-2', name: 'Quiet Members' }], isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false });
    mockUseMyArchivedManagedClubs.mockReturnValue({ data: [{ id: 'club-3', name: 'Archived Circle' }], isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false });
    mockUseMyClubInvitationInbox.mockReturnValue({ data: [], isLoading: false });
    mockUseViewerMembershipTier.mockReturnValue({ tier: 'free', isLoading: false });
});

describe('ClubsBrowseScreen', () => {
    it('uses the approved directory labels and count while keeping venue discovery reachable', () => {
        const { getByText, getByTestId, queryByText } = render(<ClubsBrowseScreen />);

        expect(getByText('COMMUNITY HUB')).toBeOnTheScreen();
        expect(getByText('Book Clubs')).toBeOnTheScreen();
        expect(getByText('All clubs')).toBeOnTheScreen();
        expect(getByText('My clubs')).toBeOnTheScreen();
        expect(getByTestId('clubs-mine-count')).toHaveTextContent('1');
        expect(getByText('Archived')).toBeOnTheScreen();
        expect(queryByText(/Your Clubs •/)).toBeNull();
        expect(getByTestId('clubs-search-input')).toBeOnTheScreen();
        expect(getByTestId('clubs-filters-open')).toBeOnTheScreen();
        expect(getByText('Find club venues')).toBeOnTheScreen();
        expect(getByText('Showing 1 active community')).toBeOnTheScreen();
        expect(getByText('Open Readers')).toBeOnTheScreen();
        expect(getByTestId('clubs-archived-link')).toBeOnTheScreen();
        expect(queryByText(/invite acceptance, invitation revocation, read-state support, and archived-club recovery are live/i)).toBeNull();
        expect(queryByText(/still pending backend support/i)).toBeNull();
    });

    it('keeps quick club-type filters aligned with the existing filters', () => {
        const { getByTestId } = render(<ClubsBrowseScreen />);

        fireEvent.press(getByTestId('clubs-quick-access-public'));

        let lastFilters = mockUseBrowseClubs.mock.calls[mockUseBrowseClubs.mock.calls.length - 1][0] as Record<string, unknown>;
        expect(lastFilters).toMatchObject({ clubType: 'public', accessLevel: undefined });

        fireEvent.press(getByTestId('clubs-quick-access-approval'));

        lastFilters = mockUseBrowseClubs.mock.calls[mockUseBrowseClubs.mock.calls.length - 1][0] as Record<string, unknown>;
        expect(lastFilters).toMatchObject({ clubType: 'approval', accessLevel: undefined });
    });

    it('opens the existing tier options from the compact Pro & Pro+ access shortcut', () => {
        const { getByTestId, getByText } = render(<ClubsBrowseScreen />);

        fireEvent.press(getByTestId('clubs-quick-access-tiers'));

        expect(getByText('Pro')).toBeOnTheScreen();
        expect(getByText('Pro+')).toBeOnTheScreen();

        fireEvent.press(getByTestId('clubs-filter-access-pro_plus'));

        const lastFilters = mockUseBrowseClubs.mock.calls[mockUseBrowseClubs.mock.calls.length - 1][0] as Record<string, unknown>;
        expect(lastFilters.accessLevel).toBe('pro_plus');
    });

    it('uses Any format as the clear state for meeting-format quick filters', () => {
        const { getByTestId, getByText } = render(<ClubsBrowseScreen />);

        expect(getByText('Any format')).toBeOnTheScreen();
        fireEvent.press(getByTestId('clubs-quick-meeting-venue_based'));

        let lastFilters = mockUseBrowseClubs.mock.calls[mockUseBrowseClubs.mock.calls.length - 1][0] as Record<string, unknown>;
        expect(lastFilters.meetingType).toBe('venue_based');

        fireEvent.press(getByTestId('clubs-quick-meeting-all'));

        lastFilters = mockUseBrowseClubs.mock.calls[mockUseBrowseClubs.mock.calls.length - 1][0] as Record<string, unknown>;
        expect(lastFilters.meetingType).toBeUndefined();
    });

    it('shows an unread invitations badge and opens the invitation inbox', () => {
        mockUseMyClubInvitationInbox.mockReturnValue({
            data: [
                { id: 'invite-1', read_at: null },
                { id: 'invite-2', read_at: '2026-05-23T00:00:00Z' },
            ],
            isLoading: false,
        });

        const { getByTestId } = render(<ClubsBrowseScreen />);

        expect(getByTestId('clubs-invitations-unread-count')).toHaveTextContent('1');

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

    it('maps My clubs to the mine scope with membership copy and shelf results', () => {
        const { getByText, getByTestId, queryByTestId } = render(<ClubsBrowseScreen />);

        fireEvent.press(getByTestId('clubs-filter-scope-mine'));

        expect(mockUseMyBrowseClubs).toHaveBeenLastCalledWith('reader-1', expect.any(Object), true);
        expect(getByText('Your reading circles')).toBeOnTheScreen();
        expect(getByTestId('your-club-card-club-2')).toBeOnTheScreen();
        expect(getByText('Quiet Members')).toBeOnTheScreen();
        expect(queryByTestId('clubs-venues-discovery-link')).toBeNull();
    });

    it('updates the My clubs count when its scope is active', () => {
        const { getByTestId } = render(<ClubsBrowseScreen />);

        fireEvent.press(getByTestId('clubs-filter-scope-mine'));

        expect(getByTestId('clubs-mine-count')).toHaveTextContent('1');
    });

    it('taps a Your Clubs shelf card through to club detail', () => {
        const { getByTestId } = render(<ClubsBrowseScreen />);

        fireEvent.press(getByTestId('clubs-filter-scope-mine'));
        fireEvent.press(getByTestId('your-club-card-club-2'));

        expect(mockRouterPush).toHaveBeenCalledWith('/(tabs)/clubs/club-2');
    });

    it('keeps search and filters available in Your Clubs', () => {
        const { getByTestId } = render(<ClubsBrowseScreen />);

        fireEvent.press(getByTestId('clubs-filter-scope-mine'));

        expect(getByTestId('clubs-search-input')).toBeOnTheScreen();
        expect(getByTestId('clubs-filters-open')).toBeOnTheScreen();
    });

    it('shows true-empty Your Clubs copy with a Discover path when unconstrained', () => {
        mockUseMyBrowseClubs.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false });

        const { getByTestId, getByText, queryByText } = render(<ClubsBrowseScreen />);

        fireEvent.press(getByTestId('clubs-filter-scope-mine'));

        expect(getByText('You have not joined any clubs yet')).toBeOnTheScreen();

        fireEvent.press(getByTestId('clubs-mine-discover-link'));

        expect(getByText('Showing 1 active community')).toBeOnTheScreen();
        expect(queryByText('You have not joined any clubs yet')).toBeNull();
    });

    it('shows scoped search-empty copy with Clear filters when search constrains mine', () => {
        mockUseMyBrowseClubs.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false });

        const { getByTestId, getByText, queryByText } = render(<ClubsBrowseScreen />);

        fireEvent.press(getByTestId('clubs-filter-scope-mine'));
        fireEvent.changeText(getByTestId('clubs-search-input'), 'mystery');

        expect(getByText('No clubs matched your search')).toBeOnTheScreen();
        expect(queryByText('You have not joined any clubs yet')).toBeNull();

        fireEvent.press(getByTestId('clubs-mine-clear-filters'));

        const lastFilters = mockUseMyBrowseClubs.mock.calls[mockUseMyBrowseClubs.mock.calls.length - 1][1] as Record<string, unknown>;
        expect(lastFilters).toMatchObject({ search: undefined, clubType: undefined, meetingType: undefined, accessLevel: undefined });
    });

    it('shows scoped filter-empty copy when filters constrain mine', () => {
        mockUseMyBrowseClubs.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false });

        const { getByTestId, getByText, queryByText } = render(<ClubsBrowseScreen />);

        fireEvent.press(getByTestId('clubs-filter-scope-mine'));
        fireEvent.press(getByTestId('clubs-filters-open'));
        fireEvent.press(getByTestId('clubs-filter-type-public'));

        expect(getByText('No clubs match these filters')).toBeOnTheScreen();
        expect(queryByText('You have not joined any clubs yet')).toBeNull();
    });

    it('does not stack a no-membership empty state under the signed-out notice', () => {
        mockAuthUser = null;
        mockUseMyBrowseClubs.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false });

        const { getByTestId, getByText, queryByText } = render(<ClubsBrowseScreen />);

        fireEvent.press(getByTestId('clubs-filter-scope-mine'));

        expect(getByText('Sign in to view your clubs')).toBeOnTheScreen();
        expect(queryByText('You have not joined any clubs yet')).toBeNull();
        expect(queryByText('No clubs matched your search')).toBeNull();
        expect(queryByText('No clubs match these filters')).toBeNull();
    });

    it('does not show the author spotlight in Your Clubs', () => {
        mockUseMyBrowseClubs.mockReturnValue({
            data: [
                { id: 'club-2', name: 'Quiet Members', club_type: 'public' },
                { id: 'club-author-9', name: 'Author Salon', club_type: 'author_club', author_display_name: 'Asha Dev' },
            ],
            isLoading: false,
            isError: false,
            refetch: jest.fn(),
            isRefetching: false,
        });

        const { getByTestId, queryByTestId } = render(<ClubsBrowseScreen />);

        fireEvent.press(getByTestId('clubs-filter-scope-mine'));

        expect(queryByTestId('clubs-author-spotlight')).toBeNull();
    });

    it('keeps archived and venue destinations reachable from Your Clubs without per-row actions', () => {
        const { getByTestId, getByText, queryByText } = render(<ClubsBrowseScreen />);

        fireEvent.press(getByTestId('clubs-filter-scope-mine'));

        fireEvent.press(getByTestId('clubs-venues-secondary-link'));
        expect(mockRouterPush).toHaveBeenCalledWith('/(tabs)/clubs/venues');

        fireEvent.press(getByTestId('clubs-archived-link'));
        expect(getByText('Archived clubs')).toBeOnTheScreen();

        expect(queryByText('Leave')).toBeNull();
        expect(queryByText('Manage')).toBeNull();
        expect(queryByText('Invite')).toBeNull();
    });

    it('returns to All clubs from My clubs', () => {
        const { getByText, getByTestId } = render(<ClubsBrowseScreen />);

        fireEvent.press(getByTestId('clubs-filter-scope-mine'));
        expect(getByTestId('your-club-card-club-2')).toBeOnTheScreen();

        fireEvent.press(getByTestId('clubs-filter-scope-all'));

        expect(getByText('Showing 1 active community')).toBeOnTheScreen();
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

    it('returns to All clubs from the archived scope', () => {
        const { getByText, getByTestId } = render(<ClubsBrowseScreen />);

        fireEvent.press(getByTestId('clubs-archived-link'));
        expect(getByText('Archived clubs')).toBeOnTheScreen();

        fireEvent.press(getByTestId('clubs-archived-back'));

        expect(getByText('Showing 1 active community')).toBeOnTheScreen();
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
