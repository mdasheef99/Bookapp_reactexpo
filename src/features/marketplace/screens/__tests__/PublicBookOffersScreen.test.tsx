import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import PublicBookOffersScreen from '../PublicBookOffersScreen';
import { usePublicListingDetail } from '../../hooks/usePublicListingDetail';

jest.mock('expo-router');
jest.mock('../../hooks/usePublicListingDetail', () => ({ usePublicListingDetail: jest.fn() }));
jest.mock('../../commerce/components/AddToCartButton', () => ({
    AddToCartButton: ({ listingId }: { listingId: string }) => {
        const { Text } = require('react-native');
        return <Text>Add {listingId}</Text>;
    },
}));
jest.mock('@/components/ui/ScreenBackground', () => ({
    ScreenBackground: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ colors: {
        accent: '#2563eb', border: '#ddd', textPrimary: '#111', textSecondary: '#555',
    } }),
}));

const storeId = '20000000-0000-4000-8000-000000000001';
const listingId = '10000000-0000-4000-8000-000000000001';
const detail = {
    contractVersion: 'q10-v1', listingId,
    store: {
        publicStoreId: storeId, displayName: 'Reader Lane', description: null,
        logo: null, cover: null, locality: 'Camp', city: 'Pune', state: 'MH',
        pickup: true, delivery: false, returnPolicy: 'no_returns',
    },
    title: 'The Bookshop', authors: ['Penelope Fitzgerald'], language: 'en',
    description: 'A novel', editionStatement: 'First edition', volume: null,
    format: 'paperback', isbn10: null, isbn13: '9780306406157', cover: '/cover.png',
    priceMinor: 35000, currency: 'INR', condition: 'good', hasDamage: true,
    publicDamageNote: 'Small crease', damageTypes: ['cover_crease'],
    availabilityStatus: 'low_stock', fulfillmentOptions: ['pickup'],
    confirmationBeforePayment: true,
    gallery: [1, 2, 3].map((order) => ({
        url: `/public-copy-${order}.jpg`, role: order === 1 ? 'damage' : 'actual_copy',
        order, width: 800, height: 1000,
    })),
};

describe('PublicBookOffersScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (usePublicListingDetail as jest.Mock).mockReturnValue({
            detail, isLoading: false, error: null, retry: jest.fn(),
        });
    });

    it('renders Q10 condition, damage, fulfillment, gallery, and the cart identity', () => {
        const screen = render(<PublicBookOffersScreen listingId={listingId} />);
        expect(screen.getByText('Damage disclosed')).toBeOnTheScreen();
        expect(screen.getByText('Small crease')).toBeOnTheScreen();
        expect(screen.getByText('Fulfillment: Pickup')).toBeOnTheScreen();
        expect(screen.getByLabelText('Damage photo 1')).toBeOnTheScreen();
        expect(screen.getByLabelText('Actual Copy photo 3')).toBeOnTheScreen();
        expect(screen.getByText(`Add ${listingId}`)).toBeOnTheScreen();
    });

    it('opens the complete bookstore catalogue without leaking search context', () => {
        const screen = render(<PublicBookOffersScreen listingId={listingId} />);
        fireEvent.press(screen.getByLabelText('Open Reader Lane complete catalogue'));
        expect(router.push).toHaveBeenCalledWith({
            pathname: '/marketplace/store/[storeId]', params: { storeId },
        });
    });

    it('shows bounded unavailable behavior with retry', () => {
        const retry = jest.fn();
        (usePublicListingDetail as jest.Mock).mockReturnValue({
            detail: null, isLoading: false, error: 'This book is no longer available.', retry,
        });
        const screen = render(<PublicBookOffersScreen listingId={listingId} />);
        expect(screen.getByText('Book unavailable')).toBeOnTheScreen();
        fireEvent.press(screen.getByLabelText('Retry book details'));
        expect(retry).toHaveBeenCalledTimes(1);
    });
});
