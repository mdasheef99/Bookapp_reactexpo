import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ListingDetailScreen from '../[listingId]';

const mockReplace = jest.fn();
const mockUseListingDetails = jest.fn();
const mockUseRequestTransaction = jest.fn();
const mockUseApprovedVenues = jest.fn();
const mockMutate = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({
    router: { back: jest.fn(), replace: (...args: unknown[]) => mockReplace(...args) },
    useLocalSearchParams: () => ({ listingId: 'listing-1' }),
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ colors: {
        bgPrimary: '#FFFFFF', bgCard: '#F8FAFC', bgSecondary: '#EEF2FF', border: '#CBD5E1', accent: '#4F46E5', accentLight: '#EEF2FF', textPrimary: '#0F172A', textSecondary: '#475569', textTertiary: '#94A3B8',
    } }),
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({
    useAuth: () => ({ session: { user: { id: 'borrower-1' } } }),
}));
jest.mock('@/features/exchange/hooks/useListings', () => ({
    useListingDetails: (...args: unknown[]) => mockUseListingDetails(...args),
}));
jest.mock('@/features/exchange/hooks/useTransactions', () => ({
    useRequestTransaction: (...args: unknown[]) => mockUseRequestTransaction(...args),
}));
jest.mock('@/features/venues/hooks/useVenues', () => ({
    useApprovedVenues: (...args: unknown[]) => mockUseApprovedVenues(...args),
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockUseRequestTransaction.mockReturnValue({ mutate: mockMutate, isPending: false });
    mockUseApprovedVenues.mockReturnValue({
        data: [
            { id: 'venue-1', name: 'Chapter Cafe', venue_type: 'cafe', city: 'Delhi', address_line1: '12 Market Road', verification_status: 'approved', is_exchange_partner: true },
        ],
        isLoading: false,
        isError: false,
    });
    mockUseListingDetails.mockReturnValue({
        data: {
            id: 'listing-1',
            owner_id: 'lender-1',
            status: 'active',
            delivery_options: ['meetup', 'porter', 'dunzo'],
            condition: 'good',
            condition_notes: null,
            photos: [],
            book: { title: 'Atomic Habits', authors: ['James Clear'], average_rating: 4.2 },
            owner: { display_name: 'Reader One', city: 'Delhi', trust_score: 12, avatar_url: null },
        },
        isLoading: false,
        isError: false,
    });
});

describe('ListingDetailScreen', () => {
    it('requires a pickup venue for meetup requests and sends it with the request', () => {
        const { getByText, queryByText, getByTestId } = render(<ListingDetailScreen />);

        expect(getByText('🤝 Meetup')).toBeOnTheScreen();
        expect(queryByText('🚲 Porter')).toBeNull();
        expect(queryByText('🚗 Dunzo')).toBeNull();
        expect(getByText(/same-city meetup handoffs only/i)).toBeOnTheScreen();

        fireEvent.press(getByTestId('exchange-request-cta'));
        expect(mockMutate).not.toHaveBeenCalled();

        fireEvent.press(getByTestId('venue-card-venue-1'));
        fireEvent.press(getByTestId('exchange-request-cta'));

        expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({
            listingId: 'listing-1', borrowerId: 'borrower-1', deliveryType: 'meetup', pickupVenueId: 'venue-1',
        }), expect.any(Object));
    });

    it('blocks requests when meetup is not available on the listing', () => {
        mockUseListingDetails.mockReturnValue({
            data: {
                id: 'listing-1',
                owner_id: 'lender-1',
                status: 'active',
                delivery_options: ['porter'],
                condition: 'good',
                condition_notes: null,
                photos: [],
                book: { title: 'Atomic Habits', authors: ['James Clear'], average_rating: 4.2 },
                owner: { display_name: 'Reader One', city: 'Delhi', trust_score: 12, avatar_url: null },
            },
            isLoading: false,
            isError: false,
        });

        const { getByText, getByTestId } = render(<ListingDetailScreen />);

        expect(getByText(/meetup isn't available for this listing yet/i)).toBeOnTheScreen();
        expect(getByText('Meetup not available')).toBeOnTheScreen();

        fireEvent.press(getByTestId('exchange-request-cta'));

        expect(mockMutate).not.toHaveBeenCalled();
    });

    it('clears a selected pickup venue when delivery changes away from meetup', async () => {
        const meetupListing = mockUseListingDetails();
        const { getByTestId, rerender } = render(<ListingDetailScreen />);

        fireEvent.press(getByTestId('venue-card-venue-1'));

        mockUseListingDetails.mockReturnValue({
            ...meetupListing,
            data: { ...meetupListing.data, delivery_options: ['porter'] },
        });
        rerender(<ListingDetailScreen />);

        mockUseListingDetails.mockReturnValue(meetupListing);
        rerender(<ListingDetailScreen />);
        fireEvent.press(getByTestId('exchange-request-cta'));

        await waitFor(() => expect(mockMutate).not.toHaveBeenCalled());
    });
});
