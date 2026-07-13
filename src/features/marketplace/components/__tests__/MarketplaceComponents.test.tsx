import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { GroupedBookCard } from '../GroupedBookCard';
import { MarketplaceDisclosure } from '../MarketplaceDisclosure';
import { StoreOfferCard } from '../StoreOfferCard';
import type { GroupedBookResult, MarketplaceListingOffer } from '../../types';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router');
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            accent: '#2563eb',
            bgCard: '#ffffff',
            bgSecondary: '#f8fafc',
            border: '#e5e7eb',
            textPrimary: '#111827',
            textSecondary: '#4b5563',
            textTertiary: '#6b7280',
        },
    }),
}));

const offer: MarketplaceListingOffer = {
    id: 'listing-1',
    storeId: 'store-1',
    canonicalEditionId: 'edition-1',
    publicTitle: 'The Bookshop',
    publicAuthors: ['Penelope Fitzgerald'],
    publicCoverUrl: 'https://covers.example/bookshop.jpg',
    isbn10: '0006543545',
    isbn13: '9780006543541',
    condition: 'like_new',
    publicConditionNotes: 'Clean copy with a small owner inscription.',
    sellingPriceMinor: 35000,
    availabilityStatus: 'low_stock',
    fulfillmentOptions: ['pickup', 'delivery'],
    storeCity: 'Bengaluru',
    storeLocalityName: 'Indiranagar',
    pickupAvailable: true,
    deliveryAvailable: true,
    storeDisplayName: 'Reader Lane Books',
};

const grouped: GroupedBookResult = {
    groupingKey: 'edition:edition-1',
    title: 'The Bookshop',
    authors: ['Penelope Fitzgerald'],
    isbn13: '9780006543541',
    coverUrl: 'https://covers.example/bookshop.jpg',
    offerCount: 1,
    lowestPriceMinor: 35000,
    offers: [offer],
};

describe('MarketplaceDisclosure', () => {
    it('shows the availability disclaimer along with marketplace support copy', () => {
        const screen = render(<MarketplaceDisclosure />);

        expect(screen.getByText(/availability is not guaranteed until the store confirms/i)).toBeOnTheScreen();
        expect(screen.getByText(/BookConnect facilitates the marketplace/i)).toBeOnTheScreen();
    });
});

describe('StoreOfferCard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('shows availability status, condition notes, and navigates to the public store page', () => {
        const screen = render(<StoreOfferCard offer={offer} />);

        expect(screen.getByText('Low stock')).toBeOnTheScreen();
        expect(screen.getByText('Clean copy with a small owner inscription.')).toBeOnTheScreen();

        fireEvent.press(screen.getByLabelText('View Reader Lane Books public store page'));

        expect(router.push).toHaveBeenCalledWith({
            pathname: '/marketplace/store/[storeId]',
            params: { storeId: 'store-1' },
        });
    });
});

describe('GroupedBookCard', () => {
    it('renders the book cover when a cover URL is available', () => {
        const screen = render(<GroupedBookCard result={grouped} />);

        expect(screen.getByTestId('marketplace-book-cover')).toBeOnTheScreen();
    });
});
