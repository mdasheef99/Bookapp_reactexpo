import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { BookstoreResultCard } from '../BookstoreResultCard';
import { StorefrontTitleGroupCard } from '../StorefrontTitleGroupCard';
import type { BookstoreSearchResult, StorefrontTitleGroup } from '../../types';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router');
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ colors: {
        accent: '#2563eb', bgCard: '#fff', border: '#ddd', textPrimary: '#111',
        textSecondary: '#555', textTertiary: '#777',
    } }),
}));

const storeId = '20000000-0000-4000-8000-000000000001';
const listingId = '10000000-0000-4000-8000-000000000001';
const result: BookstoreSearchResult = {
    store: {
        publicStoreId: storeId, displayName: 'Reader Lane Books', logo: null,
        locality: 'Camp', city: 'Pune', state: 'MH', pickup: true, delivery: false,
        returnPolicy: 'no_returns',
    },
    matchedBook: {
        matchContext: 'opaque-context', originalTitle: 'The Bookshop',
        authors: ['Penelope Fitzgerald'], language: 'en', publicIsbn: null,
        cover: '/placeholder.png', boundedMatchKind: 'original_title_exact',
    },
    offerSummary: {
        offerCount: 2, lowestPriceMinor: 35000, currency: 'INR',
        conditionSummary: { best: 'good', worst: 'acceptable', distinct: ['good', 'acceptable'] },
        damageSummary: { hasUndamagedOffers: true, hasDamagedOffers: true },
        fulfillmentSummary: { pickupOfferCount: 2, deliveryOfferCount: 0 },
        availabilityBand: 'available', confirmationBeforePayment: true,
    },
};
const group: StorefrontTitleGroup = {
    safeTitlePresentation: {
        originalTitle: 'The Bookshop', authors: ['Penelope Fitzgerald'], language: 'en',
        publicIsbn: '9780306406157', cover: '/placeholder.png',
    },
    offers: [{
        listingId, priceMinor: 35000, currency: 'INR', condition: 'good', hasDamage: false,
        publicDamageNote: null, damageTypes: [], availabilityStatus: 'available',
        fulfillmentOptions: ['pickup'], confirmationBeforePayment: true,
    }],
};

describe('Unit 8C discovery cards', () => {
    beforeEach(() => jest.clearAllMocks());

    it('opens one bookstore result with its opaque match context', () => {
        const screen = render(<BookstoreResultCard result={result} searchQuery="The Bookshop" />);
        expect(screen.getByText('Damaged and undamaged copies available')).toBeOnTheScreen();
        fireEvent.press(screen.getByLabelText('Open Reader Lane Books, matched The Bookshop'));
        expect(router.push).toHaveBeenCalledWith({
            pathname: '/marketplace/store/[storeId]',
            params: { storeId, matchContext: 'opaque-context', searchQuery: 'The Bookshop' },
        });
    });

    it('labels the highlighted group and opens the selected public listing identity', () => {
        const screen = render(<StorefrontTitleGroupCard group={group} highlighted />);
        expect(screen.getByText('Matched title from your search')).toBeOnTheScreen();
        fireEvent.press(screen.getByLabelText('View Good copy for ₹350'));
        expect(router.push).toHaveBeenCalledWith({
            pathname: '/marketplace/book/[listingId]', params: { listingId },
        });
    });
});
