jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

import { render } from '@testing-library/react-native';
import VenueDetailScreen from '../VenueDetailScreen';

const mockUseLocalSearchParams = jest.fn();
const mockUseVenueDetail = jest.fn();

jest.mock('expo-router', () => ({
    useLocalSearchParams: (...args: unknown[]) => mockUseLocalSearchParams(...args),
    router: { back: jest.fn(), replace: jest.fn() },
}));

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
    useVenueDetail: (...args: unknown[]) => mockUseVenueDetail(...args),
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocalSearchParams.mockReturnValue({ venueId: 'venue-1' });
    mockUseVenueDetail.mockReturnValue({
        data: {
            id: 'venue-1',
            name: 'Central Library',
            venue_type: 'library',
            description: 'Quiet reading rooms and weekend events.',
            address_line1: '12 Main St',
            address_line2: null,
            city: 'Bengaluru',
            state: 'Karnataka',
            pincode: '560001',
            amenities: ['Wi-Fi', 'Reading room'],
            max_capacity: 40,
            booking_required: true,
            verification_status: 'approved',
        },
        isLoading: false,
        isError: false,
        error: null,
    });
});

describe('VenueDetailScreen', () => {
    it('renders venue identity, address, amenities, and capacity', () => {
        const { getByText } = render(<VenueDetailScreen />);

        expect(getByText('Central Library')).toBeOnTheScreen();
        expect(getByText('Quiet reading rooms and weekend events.')).toBeOnTheScreen();
        expect(getByText('12 Main St, Bengaluru, Karnataka 560001')).toBeOnTheScreen();
        expect(getByText('Wi-Fi')).toBeOnTheScreen();
        expect(getByText('Reading room')).toBeOnTheScreen();
        expect(getByText('Up to 40 people')).toBeOnTheScreen();
        expect(getByText('Booking required')).toBeOnTheScreen();
    });

    it('shows an error state when venue detail fails', () => {
        mockUseVenueDetail.mockReturnValue({ data: null, isLoading: false, isError: true, error: new Error('nope') });

        const { getByText } = render(<VenueDetailScreen />);

        expect(getByText('Unable to load venue')).toBeOnTheScreen();
        expect(getByText('Try returning to club venues and opening this place again.')).toBeOnTheScreen();
    });
});
