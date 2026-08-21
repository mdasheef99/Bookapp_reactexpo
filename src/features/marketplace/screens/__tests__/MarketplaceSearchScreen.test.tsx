import { fireEvent, render } from '@testing-library/react-native';
import MarketplaceSearchScreen from '../MarketplaceSearchScreen';
import { useMarketplaceSearch } from '../../hooks/useMarketplaceSearch';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../../hooks/useMarketplaceSearch', () => ({ useMarketplaceSearch: jest.fn() }));
jest.mock('@/components/ui/ScreenBackground', () => ({
    ScreenBackground: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            accent: '#2563eb',
            bgCard: '#ffffff',
            bgSecondary: '#f8fafc',
            border: '#e5e7eb',
            error: '#b91c1c',
            shadow: '#000000',
            textPrimary: '#111827',
            textSecondary: '#4b5563',
            textTertiary: '#6b7280',
        },
    }),
}));
jest.mock('@/components/search/SearchBar', () => ({
    SearchBar: ({ query, onQueryChange, onSubmit, autoFocus, placeholder, maxLength }: any) => {
        const React = require('react');
        const { Pressable, Text, TextInput } = require('react-native');
        return (
            <>
                <TextInput
                    accessibilityLabel="marketplace-search"
                    placeholder={placeholder}
                    value={query}
                    onChangeText={onQueryChange}
                    testID="marketplace-search-input"
                    data-autofocus={String(autoFocus)}
                    maxLength={maxLength}
                />
                <Pressable accessibilityRole="button" accessibilityLabel="submit-search" onPress={onSubmit}>
                    <Text>Search</Text>
                </Pressable>
            </>
        );
    },
}));

describe('MarketplaceSearchScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (useMarketplaceSearch as jest.Mock).mockReturnValue({
            results: [],
            isLoading: false,
            error: null,
            searchNow: jest.fn(),
            retry: jest.fn(),
        });
    });

    it('shows an initial browse guidance state before the user searches', () => {
        const screen = render(<MarketplaceSearchScreen />);

        expect(screen.getByText(/Search by title, author, or ISBN to compare local bookstore availability/i)).toBeOnTheScreen();
        expect(screen.getByTestId('marketplace-search-input').props['data-autofocus']).toBe('false');
        expect(screen.getByTestId('marketplace-search-input').props.maxLength).toBe(200);
    });

    it('runs an immediate search when the keyboard submit action fires', () => {
        const searchNow = jest.fn();
        (useMarketplaceSearch as jest.Mock).mockReturnValue({
            results: [],
            isLoading: false,
            error: null,
            searchNow,
            retry: jest.fn(),
        });
        const screen = render(<MarketplaceSearchScreen />);

        fireEvent.changeText(screen.getByLabelText('marketplace-search'), 'The Bookshop');
        fireEvent.press(screen.getByLabelText('submit-search'));

        expect(searchNow).toHaveBeenCalledWith('The Bookshop');
    });

    it('advertises author search in initial and empty-result guidance', () => {
        const screen = render(<MarketplaceSearchScreen />);

        expect(screen.getByText(/title, author, or ISBN/i)).toBeOnTheScreen();
        expect(screen.queryByText(/Author search is not yet available/i)).not.toBeOnTheScreen();
    });

    it('offers retry after a search failure', () => {
        const retry = jest.fn();
        (useMarketplaceSearch as jest.Mock).mockReturnValue({
            results: [],
            isLoading: false,
            error: 'Search failed.',
            searchNow: jest.fn(),
            retry,
        });
        const screen = render(<MarketplaceSearchScreen />);

        fireEvent.press(screen.getByLabelText('Retry marketplace search'));
        expect(retry).toHaveBeenCalledTimes(1);
    });
});
