import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ClubVenuePickerScreen from '../ClubVenuePickerScreen';
import { navigateBackOrFallback } from '@/lib/navigation';

const mockUseAuth = jest.fn();
const mockUseTheme = jest.fn();
const mockUseLocalSearchParams = jest.fn();
const mockUseClubPublicDetail = jest.fn();
const mockUseClubEventVenues = jest.fn();
const mockUseApprovedVenues = jest.fn();
const mockUseAddClubVenueLink = jest.fn();
const mockAddClubVenueLink = jest.fn();
const mockRouterBack = jest.fn();
const mockRouterReplace = jest.fn();

jest.mock('@/features/auth/hooks/useAuth', () => ({
    useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: (...args: unknown[]) => mockUseTheme(...args),
}));
jest.mock('expo-router', () => ({
    useLocalSearchParams: (...args: unknown[]) => mockUseLocalSearchParams(...args),
    router: { back: (...args: unknown[]) => mockRouterBack(...args), replace: (...args: unknown[]) => mockRouterReplace(...args) },
}));
jest.mock('@/lib/navigation', () => ({
    navigateBackOrFallback: jest.fn(),
}));
jest.mock('@/features/clubs/hooks/useClubs', () => ({
    useClubPublicDetail: (...args: unknown[]) => mockUseClubPublicDetail(...args),
    useClubEventVenues: (...args: unknown[]) => mockUseClubEventVenues(...args),
    useAddClubVenueLink: (...args: unknown[]) => mockUseAddClubVenueLink(...args),
}));
jest.mock('@/features/venues/hooks/useVenues', () => ({
    useApprovedVenues: (...args: unknown[]) => mockUseApprovedVenues(...args),
}));

const colors = {
    bgPrimary: '#FFFFFF',
    bgCard: '#F8F8F8',
    bgSecondary: '#F0F0F0',
    textPrimary: '#1A1A1A',
    textSecondary: '#666666',
    textTertiary: '#999999',
    accent: '#007AFF',
    accentLight: '#E5F1FF',
    border: '#E5E5E5',
    error: '#EF4444',
};

describe('ClubVenuePickerScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseAuth.mockReturnValue({ user: { id: 'reader-1' } });
        mockUseTheme.mockReturnValue({ colors });
        mockUseLocalSearchParams.mockReturnValue({ clubId: 'club-1', returnTo: 'events' });
        mockUseClubPublicDetail.mockReturnValue({
            data: { id: 'club-1', name: 'Test Club' },
            isLoading: false,
            isError: false,
            error: null,
        });
        mockUseClubEventVenues.mockReturnValue({
            data: [
                {
                    club_id: 'club-1',
                    venue_id: 'venue-1',
                    is_primary: true,
                    venue: { id: 'venue-1', name: 'Central Library', city: 'Auckland', address_line1: '123 Queen St', address_line2: null, verification_status: 'approved' },
                },
                {
                    club_id: 'club-1',
                    venue_id: 'venue-2',
                    is_primary: false,
                    venue: { id: 'venue-2', name: 'Browns Bay Bookstore', city: 'Auckland', address_line1: '45 Beach Rd', address_line2: 'Level 2', verification_status: 'pending' },
                },
            ],
            isLoading: false,
            isError: false,
            error: null,
        });
        mockUseApprovedVenues.mockReturnValue({ data: [], isLoading: false, isError: false, error: null });
        mockUseAddClubVenueLink.mockReturnValue({ mutateAsync: mockAddClubVenueLink, isPending: false });
        mockAddClubVenueLink.mockResolvedValue({ club_id: 'club-1', venue_id: 'venue-9', is_primary: false });
    });

    it('renders venue list with names, addresses, and badges', async () => {
        const { getByText } = render(<ClubVenuePickerScreen />);

        await waitFor(() => expect(getByText('Central Library')).toBeOnTheScreen());
        expect(getByText('Browns Bay Bookstore')).toBeOnTheScreen();
        expect(getByText('Primary')).toBeOnTheScreen();
        expect(getByText('123 Queen St, Auckland')).toBeOnTheScreen();
        expect(getByText('45 Beach Rd, Level 2, Auckland')).toBeOnTheScreen();
    });

    it('navigates back with preselected venue when a venue is tapped', async () => {
        const { getByTestId } = render(<ClubVenuePickerScreen />);

        await waitFor(() => expect(getByTestId('venue-picker-item-venue-1')).toBeOnTheScreen());

        fireEvent.press(getByTestId('venue-picker-item-venue-1'));

        expect(mockRouterReplace).toHaveBeenCalledWith('/clubs/club-1/events?preselectedVenueId=venue-1');
    });

    it('returns to the event editor with manage context when opened from the editor', async () => {
        const draft = JSON.stringify({
            title: 'Draft planning night',
            description: '',
            eventType: 'hybrid',
            startDate: '2026-03-24',
            startTime: '18:30',
            endDate: '',
            endTime: '',
            meetingLink: 'https://meet.example.com/draft-night',
            manualLocation: '',
            selectedVenueId: null,
            locationMode: 'linked_venue',
        });
        mockUseLocalSearchParams.mockReturnValue({
            clubId: 'club-1',
            returnTo: 'event-editor',
            editorMode: 'create',
            editorReturnTo: 'manage',
            manageTab: 'events',
            draft,
        });

        const { getByTestId } = render(<ClubVenuePickerScreen />);

        await waitFor(() => expect(getByTestId('venue-picker-item-venue-1')).toBeOnTheScreen());

        fireEvent.press(getByTestId('venue-picker-item-venue-1'));

        const nextUrl = mockRouterReplace.mock.calls[0][0] as string;
        const params = new URLSearchParams(nextUrl.split('?')[1]);
        expect(nextUrl).toContain('/clubs/club-1/events/create?');
        expect(params.get('preselectedVenueId')).toBe('venue-1');
        expect(params.get('returnTo')).toBe('manage');
        expect(params.get('manageTab')).toBe('events');
        expect(JSON.parse(params.get('draft') ?? '{}')).toMatchObject({
            title: 'Draft planning night',
            eventType: 'hybrid',
        });
    });

    it('shows empty state when no venues are linked', async () => {
        mockUseClubEventVenues.mockReturnValue({ data: [], isLoading: false, isError: false, error: null });

        const { getByText } = render(<ClubVenuePickerScreen />);

        await waitFor(() => expect(getByText('No venues registered')).toBeOnTheScreen());
        expect(getByText('This club does not have any linked venues yet. Admins can add venues from the Manage Club screen.')).toBeOnTheScreen();
    });

    it('links a selected venue when opened from Manage Club venues', async () => {
        mockUseLocalSearchParams.mockReturnValue({ clubId: 'club-1', returnTo: 'manage-venues' });
        mockUseClubEventVenues.mockReturnValue({ data: [], isLoading: false, isError: false, error: null });
        mockUseApprovedVenues.mockReturnValue({
            data: [{ id: 'venue-9', name: 'New Library', venue_type: 'library', city: 'Bengaluru', address_line1: '9 MG Road', verification_status: 'approved' }],
            isLoading: false,
            isError: false,
            error: null,
        });
        mockUseAddClubVenueLink.mockReturnValue({ mutateAsync: mockAddClubVenueLink, isPending: false });

        const { getByTestId } = render(<ClubVenuePickerScreen />);

        await waitFor(() => expect(getByTestId('venue-card-venue-9')).toBeOnTheScreen());

        fireEvent.press(getByTestId('venue-card-venue-9'));

        await waitFor(() => expect(mockAddClubVenueLink).toHaveBeenCalledWith({ clubId: 'club-1', venueId: 'venue-9' }));
        expect(mockRouterReplace).toHaveBeenCalledWith('/clubs/club-1/manage?tab=venues');
    });

    it.each([
        ['duplicate key value violates unique constraint club_venues_pkey', 'This venue is already linked to the club.'],
        ['new row violates row-level security policy for table club_venues', 'You do not have permission to link venues to this club.'],
        ['TypeError: Failed to fetch', 'Unable to connect. Check your network and try again.'],
        ['database exploded', 'Unable to link this venue right now. Please try again.'],
    ])('shows a friendly link error for %s', async (errorMessage, expectedMessage) => {
        mockUseLocalSearchParams.mockReturnValue({ clubId: 'club-1', returnTo: 'manage-venues' });
        mockUseApprovedVenues.mockReturnValue({
            data: [{ id: 'venue-9', name: 'New Library', venue_type: 'library', city: 'Bengaluru', address_line1: '9 MG Road', verification_status: 'approved' }],
            isLoading: false,
            isError: false,
            error: null,
        });
        mockAddClubVenueLink.mockRejectedValueOnce(new Error(errorMessage));

        const { getByTestId, getByText } = render(<ClubVenuePickerScreen />);
        fireEvent.press(getByTestId('venue-card-venue-9'));

        await waitFor(() => expect(getByText(expectedMessage)).toBeOnTheScreen());
        expect(mockRouterReplace).not.toHaveBeenCalled();
    });

    it('prevents duplicate link submissions while the first request is pending', async () => {
        mockUseLocalSearchParams.mockReturnValue({ clubId: 'club-1', returnTo: 'manage-venues' });
        mockUseApprovedVenues.mockReturnValue({
            data: [{ id: 'venue-9', name: 'New Library', venue_type: 'library', city: 'Bengaluru', address_line1: '9 MG Road', verification_status: 'approved' }],
            isLoading: false,
            isError: false,
            error: null,
        });
        let resolveLink!: (value: unknown) => void;
        mockAddClubVenueLink.mockReturnValueOnce(new Promise((resolve) => { resolveLink = resolve; }));

        const { getByTestId } = render(<ClubVenuePickerScreen />);
        fireEvent.press(getByTestId('venue-card-venue-9'));
        fireEvent.press(getByTestId('venue-card-venue-9'));

        expect(mockAddClubVenueLink).toHaveBeenCalledTimes(1);
        resolveLink({ club_id: 'club-1', venue_id: 'venue-9', is_primary: false });
        await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledTimes(1));
    });

    it('shows a loading state initially', () => {
        mockUseClubPublicDetail.mockReturnValue({ data: null, isLoading: true, isError: false, error: null });
        mockUseClubEventVenues.mockReturnValue({ data: null, isLoading: true, isError: false, error: null });

        const { getByTestId } = render(<ClubVenuePickerScreen />);
        expect(getByTestId('venue-picker-loading')).toBeOnTheScreen();
    });

    it('navigates back when the back button is pressed', async () => {
        const { getByTestId } = render(<ClubVenuePickerScreen />);

        await waitFor(() => expect(getByTestId('venue-picker-item-venue-1')).toBeOnTheScreen());

        fireEvent.press(getByTestId('back-button'));
        expect(navigateBackOrFallback).toHaveBeenCalledWith(
            expect.objectContaining({ back: expect.any(Function), replace: expect.any(Function) }),
            '/clubs/club-1',
        );
    });

    it('uses the event editor as the back fallback when opened from the editor', async () => {
        const draft = JSON.stringify({
            title: 'Draft edit event',
            description: '',
            eventType: 'in_person',
            startDate: '2026-03-24',
            startTime: '18:30',
            endDate: '',
            endTime: '',
            meetingLink: '',
            manualLocation: '',
            selectedVenueId: 'venue-1',
            locationMode: 'linked_venue',
        });
        mockUseLocalSearchParams.mockReturnValue({
            clubId: 'club-1',
            returnTo: 'event-editor',
            editorMode: 'edit',
            eventId: 'event-9',
            editorReturnTo: 'manage',
            manageTab: 'events',
            draft,
        });

        const { getByTestId } = render(<ClubVenuePickerScreen />);

        await waitFor(() => expect(getByTestId('venue-picker-item-venue-1')).toBeOnTheScreen());

        fireEvent.press(getByTestId('back-button'));

        const [, fallbackHref] = (navigateBackOrFallback as jest.Mock).mock.calls[0];
        const params = new URLSearchParams((fallbackHref as string).split('?')[1]);
        expect(navigateBackOrFallback).toHaveBeenCalledWith(
            expect.objectContaining({ back: expect.any(Function), replace: expect.any(Function) }),
            expect.any(String),
        );
        expect(fallbackHref).toContain('/clubs/club-1/events/event-9/edit?');
        expect(params.get('returnTo')).toBe('manage');
        expect(params.get('manageTab')).toBe('events');
        expect(JSON.parse(params.get('draft') ?? '{}')).toMatchObject({
            title: 'Draft edit event',
            eventType: 'in_person',
            selectedVenueId: 'venue-1',
        });
    });
});
