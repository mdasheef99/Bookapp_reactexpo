jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({
    router: { push: (...args: unknown[]) => mockRouterPush(...args) },
}));

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import VenuesBrowseScreen from '../VenuesBrowseScreen';

const mockRouterPush = jest.fn();
const mockUseApprovedVenues = jest.fn();

jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            bgPrimary: '#FFFFFF',
            bgCard: '#F8FAFC',
            bgSecondary: '#EEF2FF',
            border: '#CBD5E1',
            accent: '#4F46E5',
            accentLight: '#EEF2FF',
            textPrimary: '#0F172A',
            textSecondary: '#475569',
            textTertiary: '#94A3B8',
            error: '#EF4444',
        },
    }),
}));

jest.mock('@/features/venues/hooks/useVenues', () => ({
    useApprovedVenues: (...args: unknown[]) => mockUseApprovedVenues(...args),
}));

beforeEach(() => {
    jest.clearAllMocks();
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

    it('passes search and venue type filters to the venue hook', async () => {
        const { getByTestId } = render(<VenuesBrowseScreen />);

        fireEvent.changeText(getByTestId('venues-search-input'), 'library');
        fireEvent.press(getByTestId('venues-filter-type-library'));

        await waitFor(() => expect(mockUseApprovedVenues).toHaveBeenLastCalledWith(expect.objectContaining({
            search: 'library',
            venueType: 'library',
            limit: 20,
            offset: 0,
        })));
    });

    it('shows an empty state when no venues match', () => {
        mockUseApprovedVenues.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false });

        const { getByText } = render(<VenuesBrowseScreen />);

        expect(getByText('No venues matched this search')).toBeOnTheScreen();
        expect(getByText('Try another venue type, city, or search term.')).toBeOnTheScreen();
    });
});
