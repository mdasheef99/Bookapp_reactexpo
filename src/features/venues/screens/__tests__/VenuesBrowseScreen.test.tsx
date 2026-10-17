jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({
    router: {
        push: (...args: unknown[]) => mockRouterPush(...args),
        replace: (...args: unknown[]) => mockRouterReplace(...args),
    },
    useLocalSearchParams: () => mockSearchParams,
}));

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { RefreshControl } from 'react-native';
import VenuesBrowseScreen from '../VenuesBrowseScreen';

const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
const mockUseApprovedVenues = jest.fn();
let mockSearchParams: { clubOrigin?: string } = {};

jest.mock('@/features/venues/hooks/useVenues', () => ({
    useApprovedVenues: (...args: unknown[]) => mockUseApprovedVenues(...args),
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = {};
    mockUseApprovedVenues.mockReturnValue({
        data: [
            { id: 'venue-1', name: 'Central Library', venue_type: 'library', address_line1: '12 Main St', address_line2: null, city: 'Bengaluru', verification_status: 'approved', amenities: ['Wi-Fi'], booking_required: false },
            { id: 'venue-2', name: 'Chapter Cafe', venue_type: 'cafe', address_line1: '8 Park Road', address_line2: 'First floor', city: 'Bengaluru', verification_status: 'approved', amenities: [], booking_required: true },
        ],
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
        isRefetching: false,
    });
});

describe('VenuesBrowseScreen', () => {
    it('renders approved venue cards and opens venue detail', async () => {
        const { getByText, getByTestId } = render(<VenuesBrowseScreen />);

        await waitFor(() => expect(getByText('Central Library')).toBeOnTheScreen());
        expect(getByText('Club venues')).toBeOnTheScreen();
        expect(getByText('Chapter Cafe')).toBeOnTheScreen();

        fireEvent.press(getByTestId('venue-card-venue-1'));

        expect(mockRouterPush).toHaveBeenCalledWith('/(tabs)/clubs/venues/venue-1');
    });

    it.each(['my-clubs', 'archived'])('keeps %s context when opening a venue detail', async (clubOrigin) => {
        mockSearchParams = { clubOrigin };
        const { getByTestId, getByText } = render(<VenuesBrowseScreen />);

        await waitFor(() => expect(getByText('Central Library')).toBeOnTheScreen());
        fireEvent.press(getByTestId('venue-card-venue-1'));

        expect(mockRouterPush).toHaveBeenCalledWith(`/(tabs)/clubs/venues/venue-1?clubOrigin=${clubOrigin}`);
    });

    it('passes search and venue type filters to the venue hook', async () => {
        const { getByTestId } = render(<VenuesBrowseScreen />);

        expect(getByTestId('venues-filter-type-all').props.accessibilityState).toEqual({ selected: true });
        fireEvent.changeText(getByTestId('venues-search-input'), 'library');
        fireEvent.press(getByTestId('venues-filter-type-library'));

        await waitFor(() => expect(mockUseApprovedVenues).toHaveBeenLastCalledWith(expect.objectContaining({
            search: 'library',
            venueType: 'library',
            limit: 20,
            offset: 0,
        })));
        expect(getByTestId('venues-filter-type-library').props.accessibilityState).toEqual({ selected: true });
    });

    it('shows the existing loading and error feedback states', () => {
        mockUseApprovedVenues.mockReturnValue({ data: [], isLoading: true, isError: false, refetch: jest.fn(), isRefetching: false });
        const loading = render(<VenuesBrowseScreen />);

        expect(loading.getByText('Finding club venues...')).toBeOnTheScreen();

        loading.unmount();
        mockUseApprovedVenues.mockReturnValue({ data: [], isLoading: false, isError: true, refetch: jest.fn(), isRefetching: false });
        const error = render(<VenuesBrowseScreen />);

        expect(error.getByText('Could not load venues')).toBeOnTheScreen();
        expect(error.getByText('Try refreshing to fetch approved club venues again.')).toBeOnTheScreen();
        expect(error.queryByText('No venues matched this search')).toBeNull();
    });

    it('shows an empty state when no venues match', () => {
        mockUseApprovedVenues.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false });

        const { getByText } = render(<VenuesBrowseScreen />);

        expect(getByText('No venues matched this search')).toBeOnTheScreen();
        expect(getByText('Try another venue type, city, or search term.')).toBeOnTheScreen();
    });

    it('retains the pull-to-refresh handler and refreshing state', () => {
        const refetch = jest.fn();
        mockUseApprovedVenues.mockReturnValue({ data: [], isLoading: false, isError: false, refetch, isRefetching: true });
        const { UNSAFE_getByType } = render(<VenuesBrowseScreen />);
        const refreshControl = UNSAFE_getByType(RefreshControl);

        expect(refreshControl.props.refreshing).toBe(true);
        fireEvent(refreshControl, 'refresh');

        expect(refetch).toHaveBeenCalledTimes(1);
    });

    it('returns to Clubs when the back button is pressed', () => {
        const { getByRole } = render(<VenuesBrowseScreen />);

        fireEvent.press(getByRole('button', { name: 'Back to Clubs' }));

        expect(mockRouterReplace).toHaveBeenCalledWith('/(tabs)/clubs');
    });

    it.each([
        ['my-clubs', '/(tabs)/clubs?scope=mine'],
        ['archived', '/(tabs)/clubs?scope=archived'],
    ])('returns to the originating %s directory from venues', (clubOrigin, expectedHref) => {
        mockSearchParams = { clubOrigin };
        const { getByRole } = render(<VenuesBrowseScreen />);

        fireEvent.press(getByRole('button', { name: 'Back to Clubs' }));

        expect(mockRouterReplace).toHaveBeenCalledWith(expectedHref);
    });
});
