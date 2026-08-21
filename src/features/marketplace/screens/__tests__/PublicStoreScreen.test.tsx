import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import PublicStoreScreen from '../PublicStoreScreen';
import { useStorefrontCatalogue } from '../../hooks/useStorefrontCatalogue';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../../hooks/useStorefrontCatalogue', () => ({ useStorefrontCatalogue: jest.fn() }));
jest.mock('../../components/StorefrontTitleGroupCard', () => ({
    StorefrontTitleGroupCard: ({ group, highlighted }: any) => {
        const { Text } = require('react-native');
        return <Text>{highlighted ? 'Highlighted: ' : 'Catalogue: '}{group.safeTitlePresentation.originalTitle}</Text>;
    },
}));
jest.mock('@/components/ui/ScreenBackground', () => ({
    ScreenBackground: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ colors: {
        accent: '#2563eb', border: '#ddd', error: '#b91c1c', textPrimary: '#111',
        textSecondary: '#555',
    } }),
}));

const group = (title: string) => ({
    safeTitlePresentation: {
        originalTitle: title, authors: [], language: 'en', publicIsbn: null,
        cover: '/placeholder.png',
    },
    offers: [{ listingId: title }],
});
const base = {
    profile: {
        publicStoreId: '20000000-0000-4000-8000-000000000001',
        displayName: 'Reader Lane', description: 'Independent bookseller', logo: null,
        cover: null, locality: 'Camp', city: 'Pune', state: 'MH', operatingHours: {},
        pickup: true, delivery: false, returnPolicy: 'no_returns',
    },
    titleCount: 3,
    highlightedTitleGroup: group('Matched Book'),
    titleGroups: [group('Catalogue One'), group('Catalogue Two')],
    matchContextState: 'active',
    nextCursor: 'next-page',
    isLoading: false,
    isLoadingMore: false,
    error: null,
    hasSearchContext: true,
    clearSearch: jest.fn(),
    loadMore: jest.fn(),
    refresh: jest.fn(),
    retry: jest.fn(),
};

describe('PublicStoreScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (useStorefrontCatalogue as jest.Mock).mockReturnValue({ ...base });
    });

    it('shows the complete count, separate highlight, ordinary catalogue, and clear action', () => {
        const clearSearch = jest.fn();
        (useStorefrontCatalogue as jest.Mock).mockReturnValue({ ...base, clearSearch });
        const screen = render(<PublicStoreScreen storeId={base.profile.publicStoreId}
            matchContext="opaque" searchQuery="Matched Book" />);
        expect(screen.getByText('Complete catalogue (3 titles)')).toBeOnTheScreen();
        expect(screen.getByText('Highlighted: Matched Book')).toBeOnTheScreen();
        expect(screen.getByText('Catalogue: Catalogue One')).toBeOnTheScreen();
        const clearButton = screen.getByLabelText('Clear Search and browse all books');
        expect(StyleSheet.flatten(clearButton.props.style).minHeight).toBe(44);
        fireEvent.press(clearButton);
        expect(clearSearch).toHaveBeenCalledTimes(1);
    });

    it('loads another grouped-title page', () => {
        const loadMore = jest.fn();
        (useStorefrontCatalogue as jest.Mock).mockReturnValue({ ...base, loadMore });
        const screen = render(<PublicStoreScreen storeId={base.profile.publicStoreId} />);
        fireEvent.press(screen.getByLabelText('Load more books'));
        expect(loadMore).toHaveBeenCalledTimes(1);
    });

    it('degrades stale context to the complete catalogue message', () => {
        (useStorefrontCatalogue as jest.Mock).mockReturnValue({
            ...base, matchContextState: 'unavailable', highlightedTitleGroup: null,
        });
        const screen = render(<PublicStoreScreen storeId={base.profile.publicStoreId} matchContext="stale" />);
        expect(screen.getByText(/searched title is no longer available/i)).toBeOnTheScreen();
        expect(screen.getByText('Catalogue: Catalogue One')).toBeOnTheScreen();
    });

    it('renders empty and recoverable error states', () => {
        (useStorefrontCatalogue as jest.Mock).mockReturnValue({
            ...base, titleCount: 0, highlightedTitleGroup: null, titleGroups: [],
            nextCursor: null, hasSearchContext: false, error: 'Network unavailable.',
        });
        const screen = render(<PublicStoreScreen storeId={base.profile.publicStoreId} />);
        expect(screen.getByText('No books are currently available.')).toBeOnTheScreen();
        fireEvent.press(screen.getByLabelText('Retry catalogue request'));
        expect(base.retry).toHaveBeenCalledTimes(1);
    });
});
