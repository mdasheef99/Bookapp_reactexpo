import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ClubEventsScreen from '../ClubEventsScreen';
import { profileService } from '@/features/auth/services/profileService';

const mockRouterBack = jest.fn();
const mockRouterPush = jest.fn();
const mockUseClubPublicDetail = jest.fn();
const mockUseClubMembership = jest.fn();
const mockUseClubEvents = jest.fn();
const mockUseUpsertClubEventRsvp = jest.fn();
const mockUseCancelClubEvent = jest.fn();
const mockUseDeleteClubEvent = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({
    router: { back: (...args: unknown[]) => mockRouterBack(...args), push: (...args: unknown[]) => mockRouterPush(...args) },
    useLocalSearchParams: () => ({ clubId: 'club-1' }),
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ colors: { bgPrimary: '#FFFFFF', bgCard: '#F8FAFC', bgSecondary: '#EEF2FF', border: '#CBD5E1', accent: '#4F46E5', textPrimary: '#0F172A', textSecondary: '#475569', textTertiary: '#94A3B8' } }),
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'reader-1' } }) }));
jest.mock('@/features/auth/services/profileService', () => ({ profileService: { getProfileSummary: jest.fn() } }));
// CACHE-02: screen now consumes useViewerMembershipTier (React Query) instead of
// calling profileService directly; mock the hook to keep these tests focused.
const mockUseViewerMembershipTier = jest.fn();
jest.mock('@/features/clubs/hooks/useViewerMembershipTier', () => ({
    useViewerMembershipTier: (...args: unknown[]) => mockUseViewerMembershipTier(...args),
}));
jest.mock('@/features/clubs/hooks/useClubs', () => ({
    useClubPublicDetail: (...args: unknown[]) => mockUseClubPublicDetail(...args),
    useClubMembership: (...args: unknown[]) => mockUseClubMembership(...args),
    useClubEvents: (...args: unknown[]) => mockUseClubEvents(...args),
    useUpsertClubEventRsvp: (...args: unknown[]) => mockUseUpsertClubEventRsvp(...args),
    useCancelClubEvent: (...args: unknown[]) => mockUseCancelClubEvent(...args),
    useDeleteClubEvent: (...args: unknown[]) => mockUseDeleteClubEvent(...args),
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockUseViewerMembershipTier.mockReturnValue({ tier: 'pro_plus', isLoading: false });
    mockUseClubPublicDetail.mockReturnValue({ data: { id: 'club-1', name: 'Author Circle', admin_id: 'admin-1', access_level: 'pro_plus' }, isLoading: false });
    mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });
    mockUseClubEvents.mockReturnValue({
        data: [{
            id: 'event-1', club_id: 'club-1', title: 'March meetup', description: 'Discuss the shortlist.', event_type: 'hybrid', start_time: '2026-03-20T12:00:00.000Z', end_time: null,
            venue_id: null, manual_location: 'Café upstairs', meeting_link: 'https://meet.example.com/club-room', max_attendees: null, created_by: 'admin-1', created_at: null, updated_at: null,
            status: 'scheduled', cancelled_at: null, cancelled_by: null, venue: null,
            creatorProfile: { id: 'profile-1', user_id: 'admin-1', display_name: 'Curator Cam', username: 'curatorcam', avatar_url: null, trust_score: 4.8, city: 'Bengaluru' },
            currentUserRsvp: null,
        }],
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
    });
    mockUseUpsertClubEventRsvp.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ status: 'going' }), isPending: false });
    mockUseCancelClubEvent.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseDeleteClubEvent.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    (profileService.getProfileSummary as jest.Mock).mockResolvedValue({ membership_tier: 'pro_plus' });
});

describe('ClubEventsScreen', () => {
    it('lets an active member RSVP to a scheduled event', async () => {
        const mutateAsync = jest.fn().mockResolvedValue({ status: 'going' });
        mockUseUpsertClubEventRsvp.mockReturnValue({ mutateAsync, isPending: false });

        const { getByTestId, getByText } = render(<ClubEventsScreen />);

        await waitFor(() => expect(mockUseViewerMembershipTier).toHaveBeenCalledWith('reader-1'));
        expect(getByText('March meetup')).toBeOnTheScreen();

        fireEvent.press(getByTestId('club-event-rsvp-going-event-1'));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ eventId: 'event-1', clubId: 'club-1', userId: 'reader-1', status: 'going' }));
    });

    it('shows the member-only read-only notice for muted members', async () => {
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'muted' }, isLoading: false });

        const { getByText, queryByTestId } = render(<ClubEventsScreen />);

        await waitFor(() => expect(mockUseViewerMembershipTier).toHaveBeenCalledWith('reader-1'));
        expect(getByText('Read-only event access')).toBeOnTheScreen();
        expect(queryByTestId('club-event-rsvp-going-event-1')).toBeNull();
    });

    it('shows the create-event entry point for an eligible admin', async () => {
        mockUseClubMembership.mockReturnValue({ data: { role: 'admin', status: 'active' }, isLoading: false });

        const { findByTestId } = render(<ClubEventsScreen />);

        fireEvent.press(await findByTestId('club-create-event'));

        expect(mockRouterPush).toHaveBeenCalledWith('/clubs/club-1/events/create');
    });
});