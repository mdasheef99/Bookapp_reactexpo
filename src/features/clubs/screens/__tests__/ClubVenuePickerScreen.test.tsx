import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ClubVenuePickerScreen from '../ClubVenuePickerScreen';

const mockUseAuth = jest.fn();
const mockUseTheme = jest.fn();
const mockUseLocalSearchParams = jest.fn();
const mockUseClubPublicDetail = jest.fn();
const mockUseClubEventVenues = jest.fn();
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
jest.mock('@/features/clubs/hooks/useClubs', () => ({
    useClubPublicDetail: (...args: unknown[]) => mockUseClubPublicDetail(...args),
    useClubEventVenues: (...args: unknown[]) => mockUseClubEventVenues(...args),
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

    it('shows empty state when no venues are linked', async () => {
        mockUseClubEventVenues.mockReturnValue({ data: [], isLoading: false, isError: false, error: null });

        const { getByText } = render(<ClubVenuePickerScreen />);

        await waitFor(() => expect(getByText('No venues registered')).toBeOnTheScreen());
        expect(getByText('This club does not have any linked venues yet. Admins can add venues from the Manage Club screen.')).toBeOnTheScreen();
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
        expect(mockRouterBack).toHaveBeenCalled();
    });
});
