import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ClubEventEditorScreen from '../ClubEventEditorScreen';
import { profileService } from '@/features/auth/services/profileService';
import { navigateBackOrFallback } from '@/lib/navigation';

const mockRouterBack = jest.fn();
const mockRouterReplace = jest.fn();
const mockRouterPush = jest.fn();
const mockUseClubPublicDetail = jest.fn();
const mockUseClubMembership = jest.fn();
const mockUseClubEvent = jest.fn();
const mockUseClubEventVenues = jest.fn();
const mockUseCreateClubEvent = jest.fn();
const mockUseUpdateClubEvent = jest.fn();
const mockUseLocalSearchParams = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@react-native-community/datetimepicker', () => {
    const { View } = require('react-native');
    return function MockDateTimePicker(props: Record<string, unknown>) {
        return <View {...props} />;
    };
});
jest.mock('@/lib/navigation', () => ({
    navigateBackOrFallback: jest.fn(),
}));
jest.mock('expo-router', () => ({
    router: { back: (...args: unknown[]) => mockRouterBack(...args), replace: (...args: unknown[]) => mockRouterReplace(...args), push: (...args: unknown[]) => mockRouterPush(...args) },
    useLocalSearchParams: () => mockUseLocalSearchParams(),
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ colors: { bgPrimary: '#FFFFFF', bgCard: '#F8FAFC', bgSecondary: '#EEF2FF', border: '#CBD5E1', accent: '#4F46E5', textPrimary: '#0F172A', textSecondary: '#475569', textTertiary: '#94A3B8' } }),
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'reader-1' } }) }));
jest.mock('@/features/auth/services/profileService', () => ({ profileService: { getProfileSummary: jest.fn() } }));
jest.mock('@/features/clubs/hooks/useClubs', () => ({
    useClubPublicDetail: (...args: unknown[]) => mockUseClubPublicDetail(...args),
    useClubMembership: (...args: unknown[]) => mockUseClubMembership(...args),
    useClubEvent: (...args: unknown[]) => mockUseClubEvent(...args),
    useClubEventVenues: (...args: unknown[]) => mockUseClubEventVenues(...args),
    useCreateClubEvent: (...args: unknown[]) => mockUseCreateClubEvent(...args),
    useUpdateClubEvent: (...args: unknown[]) => mockUseUpdateClubEvent(...args),
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocalSearchParams.mockReturnValue({ clubId: 'club-1' });
    mockUseClubPublicDetail.mockReturnValue({ data: { id: 'club-1', name: 'Author Circle', admin_id: 'admin-1', access_level: 'pro_plus' }, isLoading: false });
    mockUseClubMembership.mockReturnValue({ data: { role: 'moderator', status: 'active' }, isLoading: false });
    mockUseClubEvent.mockReturnValue({ data: null, isLoading: false });
    mockUseClubEventVenues.mockReturnValue({ data: [], isLoading: false });
    mockUseCreateClubEvent.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({ id: 'event-1' }), isPending: false });
    mockUseUpdateClubEvent.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    (profileService.getProfileSummary as jest.Mock).mockReset().mockResolvedValue({ membership_tier: 'pro_plus' });
});

describe('ClubEventEditorScreen', () => {
    it('creates a hybrid event using the manual meetup location fallback when there are no linked venues', async () => {
        const mutateAsync = jest.fn().mockResolvedValue({ id: 'event-1' });
        mockUseCreateClubEvent.mockReturnValue({ mutateAsync, isPending: false });

        const { getByTestId } = render(<ClubEventEditorScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        fireEvent.changeText(getByTestId('club-event-title'), 'Hybrid planning night');
        fireEvent.press(getByTestId('club-event-start-date'));
        fireEvent(getByTestId('club-event-start-date-picker'), 'onChange', { type: 'set' }, new Date('2026-03-24T09:00:00.000Z'));
        fireEvent.press(getByTestId('club-event-start-time'));
        fireEvent(getByTestId('club-event-start-time-picker'), 'onChange', { type: 'set' }, new Date('2026-03-24T18:30:00.000Z'));
        fireEvent.press(getByTestId('club-event-type-hybrid'));
        fireEvent.changeText(getByTestId('club-event-manual-location'), 'Cafe upstairs');
        fireEvent.changeText(getByTestId('club-event-meeting-link'), 'https://meet.example.com/hybrid-night');
        fireEvent.changeText(getByTestId('club-event-description'), 'Bring your notes');
        fireEvent.press(getByTestId('club-event-submit'));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
            clubId: 'club-1',
            title: 'Hybrid planning night',
            eventType: 'hybrid',
            manualLocation: 'Cafe upstairs',
            meetingLink: 'https://meet.example.com/hybrid-night',
            startTime: expect.any(String),
        })));
        expect(mockRouterReplace).toHaveBeenCalledWith('/clubs/club-1/events');
    });

    it('returns to the manage events tab after saving when opened from Manage Club', async () => {
        const mutateAsync = jest.fn().mockResolvedValue({ id: 'event-1' });
        mockUseLocalSearchParams.mockReturnValue({ clubId: 'club-1', returnTo: 'manage', manageTab: 'events' });
        mockUseCreateClubEvent.mockReturnValue({ mutateAsync, isPending: false });

        const { getByTestId } = render(<ClubEventEditorScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        fireEvent.changeText(getByTestId('club-event-title'), 'Manage-created event');
        fireEvent.press(getByTestId('club-event-start-date'));
        fireEvent(getByTestId('club-event-start-date-picker'), 'onChange', { type: 'set' }, new Date('2026-03-24T09:00:00.000Z'));
        fireEvent.press(getByTestId('club-event-start-time'));
        fireEvent(getByTestId('club-event-start-time-picker'), 'onChange', { type: 'set' }, new Date('2026-03-24T18:30:00.000Z'));
        fireEvent.changeText(getByTestId('club-event-meeting-link'), 'https://meet.example.com/manage-created');
        fireEvent.press(getByTestId('club-event-submit'));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
        expect(mockRouterReplace).toHaveBeenCalledWith('/clubs/club-1/manage?tab=events');
    });

    it('returns directly to the manage events tab from the back button when opened from Manage Club', async () => {
        mockUseLocalSearchParams.mockReturnValue({ clubId: 'club-1', returnTo: 'manage', manageTab: 'events' });

        const { UNSAFE_getAllByType } = render(<ClubEventEditorScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        const touchables = UNSAFE_getAllByType(require('react-native').TouchableOpacity);
        fireEvent.press(touchables[0]);

        expect(mockRouterReplace).toHaveBeenCalledWith('/clubs/club-1/manage?tab=events');
        expect(navigateBackOrFallback).not.toHaveBeenCalled();
    });

    it('restores a serialized draft when returning from the venue picker', async () => {
        const draft = JSON.stringify({
            title: 'Draft planning night',
            description: 'Bring annotations',
            eventType: 'hybrid',
            startDate: '2026-03-24',
            startTime: '18:30',
            endDate: '2026-03-24',
            endTime: '20:00',
            meetingLink: 'https://meet.example.com/draft-night',
            manualLocation: 'Cafe upstairs',
            selectedVenueId: 'venue-2',
            locationMode: 'linked_venue',
        });
        mockUseLocalSearchParams.mockReturnValue({ clubId: 'club-1', draft, preselectedVenueId: 'venue-2' });
        mockUseClubEventVenues.mockReturnValue({
            data: [
                { venue_id: 'venue-1', venue: { id: 'venue-1', name: 'Central Library', address_line1: '123 Queen St', city: 'Auckland' } },
                { venue_id: 'venue-2', venue: { id: 'venue-2', name: 'Harbor Books', address_line1: '45 Beach Rd', city: 'Auckland' } },
            ],
            isLoading: false,
        });

        const { getByTestId, getByDisplayValue, getByText } = render(<ClubEventEditorScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        expect(getByTestId('club-event-title').props.value).toBe('Draft planning night');
        expect(getByDisplayValue('https://meet.example.com/draft-night')).toBeOnTheScreen();
        expect(getByText('Harbor Books')).toBeOnTheScreen();
    });

    it('preserves the current draft when opening the venue picker', async () => {
        mockUseClubEventVenues.mockReturnValue({
            data: [
                { venue_id: 'venue-1', venue: { id: 'venue-1', name: 'Central Library', address_line1: '123 Queen St', city: 'Auckland' } },
            ],
            isLoading: false,
        });

        const { getByTestId } = render(<ClubEventEditorScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        fireEvent.changeText(getByTestId('club-event-title'), 'Venue draft event');
        fireEvent.press(getByTestId('club-event-type-hybrid'));
        fireEvent.press(getByTestId('club-event-location-linked'));
        fireEvent.press(getByTestId('event-browse-venues'));

        const pushedUrl = mockRouterPush.mock.calls[0][0] as string;
        expect(pushedUrl).toContain('/clubs/club-1/venues?');
        expect(pushedUrl).toContain('returnTo=event-editor');
        expect(pushedUrl).toContain('draft=');
        const params = new URLSearchParams(pushedUrl.split('?')[1]);
        expect(JSON.parse(params.get('draft') ?? '{}')).toMatchObject({
            title: 'Venue draft event',
            eventType: 'hybrid',
            selectedVenueId: 'venue-1',
            locationMode: 'linked_venue',
        });
    });

    it('shows the manager access gate when the member cannot create events', async () => {
        mockUseClubMembership.mockReturnValue({ data: { role: 'member', status: 'active' }, isLoading: false });
        (profileService.getProfileSummary as jest.Mock).mockResolvedValue({ membership_tier: 'free' });

        const { getByText, queryByTestId } = render(<ClubEventEditorScreen />);

        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));
        expect(getByText('Manager access required')).toBeOnTheScreen();
        expect(queryByTestId('club-event-submit')).toBeNull();
    });

    it('shows error when submitting without a title', async () => {
        const { getByTestId, getByText } = render(<ClubEventEditorScreen />);
        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        fireEvent.press(getByTestId('club-event-start-date'));
        fireEvent(getByTestId('club-event-start-date-picker'), 'onChange', { type: 'set' }, new Date('2026-03-24T09:00:00.000Z'));
        fireEvent.press(getByTestId('club-event-start-time'));
        fireEvent(getByTestId('club-event-start-time-picker'), 'onChange', { type: 'set' }, new Date('2026-03-24T18:30:00.000Z'));
        fireEvent.press(getByTestId('club-event-submit'));

        await waitFor(() => {
            expect(getByText('Event title is required.')).toBeOnTheScreen();
        });
    });

    it('shows error when end time is before start time', async () => {
        const { getByTestId, getByText } = render(<ClubEventEditorScreen />);
        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        fireEvent.changeText(getByTestId('club-event-title'), 'Test event');
        fireEvent.press(getByTestId('club-event-start-date'));
        fireEvent(getByTestId('club-event-start-date-picker'), 'onChange', { type: 'set' }, new Date(2026, 2, 24, 18, 30));
        fireEvent.press(getByTestId('club-event-start-time'));
        fireEvent(getByTestId('club-event-start-time-picker'), 'onChange', { type: 'set' }, new Date(2026, 2, 24, 18, 30));
        fireEvent.press(getByTestId('club-event-end-date'));
        fireEvent(getByTestId('club-event-end-date-picker'), 'onChange', { type: 'set' }, new Date(2026, 2, 24, 12, 0));
        fireEvent.press(getByTestId('club-event-end-time'));
        fireEvent(getByTestId('club-event-end-time-picker'), 'onChange', { type: 'set' }, new Date(2026, 2, 24, 12, 0));
        fireEvent.press(getByTestId('club-event-submit'));

        await waitFor(() => {
            expect(getByText('End time must be after the start time.')).toBeOnTheScreen();
        });
    });

    it('shows error for hybrid event without meeting link', async () => {
        const { getByTestId, getByText } = render(<ClubEventEditorScreen />);
        await waitFor(() => expect(profileService.getProfileSummary).toHaveBeenCalledWith('reader-1'));

        fireEvent.changeText(getByTestId('club-event-title'), 'Hybrid event');
        fireEvent.press(getByTestId('club-event-start-date'));
        fireEvent(getByTestId('club-event-start-date-picker'), 'onChange', { type: 'set' }, new Date('2026-03-24T09:00:00.000Z'));
        fireEvent.press(getByTestId('club-event-start-time'));
        fireEvent(getByTestId('club-event-start-time-picker'), 'onChange', { type: 'set' }, new Date('2026-03-24T18:30:00.000Z'));
        fireEvent.press(getByTestId('club-event-type-hybrid'));
        fireEvent.changeText(getByTestId('club-event-manual-location'), 'Cafe');
        fireEvent.press(getByTestId('club-event-submit'));

        await waitFor(() => {
            expect(getByText('Hybrid events require a meeting link.')).toBeOnTheScreen();
        });
    });

});
