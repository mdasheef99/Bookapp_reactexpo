import React from 'react';
import { Alert, FlatList } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import SearchBooksScreen from '../search';
import { booksService } from '@/features/books/services/booksService';

const mockRouterBack = jest.fn();
const mockRefreshWishlist = jest.fn().mockResolvedValue(undefined);
const mockSaveRecentSearch = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-linear-gradient', () => {
    const React = require('react');

    return {
        LinearGradient: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    };
});
jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    notificationAsync: jest.fn(),
    ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium' },
    NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));
jest.mock('expo-router', () => ({
    useRouter: () => ({ back: (...args: unknown[]) => mockRouterBack(...args) }),
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            bgPrimary: '#FFFFFF', bgCard: '#F8FAFC', bgSecondary: '#EEF2FF', border: '#CBD5E1', accent: '#4F46E5',
            textPrimary: '#0F172A', textSecondary: '#475569', textTertiary: '#94A3B8', shadow: '#0F172A',
        },
    }),
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({
    useAuth: () => ({ session: { user: { id: 'reader-1' } } }),
}));
jest.mock('@/hooks/useDebounce', () => ({
    useDebounce: (value: string) => value,
}));
jest.mock('@/hooks/useRecentSearches', () => ({
    useRecentSearches: () => ({
        recentSearches: [],
        saveRecentSearch: mockSaveRecentSearch,
        removeRecentSearch: jest.fn(),
    }),
}));
jest.mock('@/hooks/useNetworkStatus', () => ({
    useNetworkStatus: () => ({ isOffline: false }),
}));
jest.mock('@/hooks/useWishlist', () => ({
    useWishlist: () => ({
        wishlistBookIds: new Set(),
        toggleWishlist: jest.fn(),
        refreshWishlist: mockRefreshWishlist,
    }),
}));
jest.mock('@/components/ui/OfflineBanner', () => ({
    OfflineBanner: () => null,
}));
jest.mock('@/components/search', () => {
    const React = require('react');
    const { Text, TextInput, TouchableOpacity } = require('react-native');

    return {
        SkeletonCard: () => null,
        SortModal: () => null,
        RecentSearches: () => null,
        SearchBar: ({ query, onQueryChange, onSubmit }: any) => React.createElement(
            React.Fragment,
            null,
            React.createElement(TextInput, {
                testID: 'library-search-input',
                value: query,
                onChangeText: onQueryChange,
            }),
            React.createElement(
                TouchableOpacity,
                { testID: 'library-search-submit', onPress: onSubmit },
                React.createElement(Text, null, 'Search')
            )
        ),
        SearchSuggestions: () => null,
        FilterModal: ({ visible, onApply, onClose }: any) => visible ? React.createElement(
            React.Fragment,
            null,
            React.createElement(TouchableOpacity, {
                testID: 'test-apply-fiction',
                onPress: () => { onApply({ genre: 'fiction' }); onClose(); },
            }, React.createElement(Text, null, 'Apply Fiction')),
            React.createElement(TouchableOpacity, {
                testID: 'test-apply-free',
                onPress: () => { onApply({ priceType: 'free' }); onClose(); },
            }, React.createElement(Text, null, 'Apply Free')),
        ) : null,
        FilterChips: ({ filters, onRemove }: any) => filters.genre ? React.createElement(TouchableOpacity, {
            testID: 'test-remove-genre', onPress: () => onRemove('genre'),
        }, React.createElement(Text, null, 'Remove genre')) : null,
        SwipeableBookCard: () => null,
        ManualEntryModal: ({ visible, title, author, onTitleChange, onAuthorChange, onCancel, onSave }: any) => (
            visible ? React.createElement(
                React.Fragment,
                null,
                React.createElement(TextInput, {
                    testID: 'library-manual-entry-title',
                    value: title,
                    onChangeText: onTitleChange,
                }),
                React.createElement(TextInput, {
                    testID: 'library-manual-entry-author',
                    value: author,
                    onChangeText: onAuthorChange,
                }),
                React.createElement(
                    TouchableOpacity,
                    { testID: 'library-manual-entry-cancel', onPress: onCancel },
                    React.createElement(Text, null, 'Cancel')
                ),
                React.createElement(
                    TouchableOpacity,
                    { testID: 'library-manual-entry-save', onPress: onSave },
                    React.createElement(Text, null, 'Save to library')
                )
            ) : null
        ),
    };
});
jest.mock('@/features/books/services/booksService', () => ({
    booksService: {
        searchGoogleBooks: jest.fn(),
        searchGoogleBooksCached: jest.fn(),
        getSearchSuggestions: jest.fn(),
        getUserLibrary: jest.fn(),
        addManualBookToLibrary: jest.fn(),
    },
}));

const renderScreen = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: Infinity },
            mutations: { retry: false, gcTime: Infinity },
        },
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <SearchBooksScreen />
        </QueryClientProvider>
    );
};

describe('SearchBooksScreen manual entry', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (booksService.getSearchSuggestions as jest.Mock).mockResolvedValue([]);
        (booksService.getUserLibrary as jest.Mock).mockResolvedValue([]);
        (booksService.searchGoogleBooks as jest.Mock).mockResolvedValue({ items: [], totalItems: 0, hasMore: false });
        (booksService.searchGoogleBooksCached as jest.Mock).mockResolvedValue({ items: [], totalItems: 0, hasMore: false, fromCache: false });
        (booksService.addManualBookToLibrary as jest.Mock).mockResolvedValue({ id: 'manual-book-1', title: 'Manual Title' });
        jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('refreshes a submitted short query when filters change', async () => {
        (booksService.searchGoogleBooksCached as jest.Mock).mockResolvedValue({
            items: [{ id: 'it', volumeInfo: { title: 'It' } }], totalItems: 1, hasMore: false,
        });
        const screen = renderScreen();
        fireEvent.changeText(screen.getByTestId('library-search-input'), 'It');
        fireEvent.press(screen.getByTestId('library-search-submit'));
        await waitFor(() => expect(screen.getByLabelText('Filter results')).toBeOnTheScreen());
        fireEvent.press(screen.getByLabelText('Filter results'));
        fireEvent.press(screen.getByTestId('test-apply-fiction'));
        await waitFor(() => expect(booksService.searchGoogleBooksCached).toHaveBeenCalledWith('It', 0, 20, { genre: 'fiction' }));
        fireEvent.press(screen.getByTestId('test-remove-genre'));
        await waitFor(() => expect(booksService.searchGoogleBooksCached).toHaveBeenCalledTimes(3));
        expect(booksService.searchGoogleBooksCached).toHaveBeenLastCalledWith('It', 0, 20, {});
    });

    it('passes the first page provider and cursor to subsequent pages', async () => {
        (booksService.searchGoogleBooksCached as jest.Mock).mockResolvedValue({
            items: [{ id: 'ol', volumeInfo: { title: 'Dune' } }], totalItems: 40, hasMore: true,
            nextStartIndex: 20, providerUsed: 'openLibrary', fallbackUsed: true,
        });
        const screen = renderScreen();
        fireEvent.changeText(screen.getByTestId('library-search-input'), 'Dune');
        await waitFor(() => expect(screen.getByText('40 results')).toBeOnTheScreen());
        fireEvent(screen.UNSAFE_getByType(FlatList), 'onEndReached');
        await waitFor(() => expect(booksService.searchGoogleBooksCached).toHaveBeenCalledWith('Dune', 20, 20, {}, 'openLibrary'));
    });

    it('explains unsupported fallback filters even when no books are returned', async () => {
        (booksService.searchGoogleBooksCached as jest.Mock)
            .mockResolvedValueOnce({ items: [{ id: 'b', volumeInfo: { title: 'Dune' } }], totalItems: 1, hasMore: false })
            .mockResolvedValueOnce({ items: [], totalItems: 0, hasMore: false, providerUsed: 'openLibrary', fallbackUsed: true, unsupportedFilters: ['priceType'] });
        const screen = renderScreen();
        fireEvent.changeText(screen.getByTestId('library-search-input'), 'Dune');
        await waitFor(() => expect(screen.getByLabelText('Filter results')).toBeOnTheScreen());
        fireEvent.press(screen.getByLabelText('Filter results'));
        fireEvent.press(screen.getByTestId('test-apply-free'));
        await waitFor(() => expect(screen.getByText('No books found')).toBeOnTheScreen());
        expect(screen.getByText(/Free\/Paid filter was not applied/)).toBeOnTheScreen();
    });

    it('opens the manual-entry modal from no-results and saves a manual book to the library', async () => {
        const { getByTestId, queryByTestId } = renderScreen();

        fireEvent.changeText(getByTestId('library-search-input'), 'Manual Title');
        fireEvent.press(getByTestId('library-search-submit'));

        await waitFor(() => expect(booksService.searchGoogleBooksCached).toHaveBeenCalledWith('Manual Title', 0, 20, {}));

        await waitFor(() => expect(getByTestId('library-manual-entry-open')).toBeOnTheScreen());
        fireEvent.press(getByTestId('library-manual-entry-open'));

        expect(getByTestId('library-manual-entry-title').props.value).toBe('Manual Title');
        fireEvent.changeText(getByTestId('library-manual-entry-author'), 'Manual Author');
        fireEvent.press(getByTestId('library-manual-entry-save'));

        await waitFor(() => expect(booksService.addManualBookToLibrary).toHaveBeenCalledWith('reader-1', {
            title: 'Manual Title',
            author: 'Manual Author',
        }));
        await waitFor(() => expect(mockRefreshWishlist).toHaveBeenCalled());
        await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Added!', '"Manual Title" is now in your library'));
        await waitFor(() => expect(queryByTestId('library-manual-entry-title')).toBeNull());
    });

    it('shows an Open Library fallback notice when the provider fallback is used', async () => {
        (booksService.searchGoogleBooksCached as jest.Mock).mockResolvedValue({
            items: [{
                id: 'ol-1',
                volumeInfo: {
                    title: 'Fallback Title',
                    authors: ['Fallback Author'],
                },
            }],
            totalItems: 1,
            hasMore: false,
            fromCache: false,
            providerUsed: 'openLibrary',
            fallbackUsed: true,
        });

        const { getByTestId, getByText } = renderScreen();

        fireEvent.changeText(getByTestId('library-search-input'), 'Fallback Title');
        fireEvent.press(getByTestId('library-search-submit'));

        await waitFor(() => expect(booksService.searchGoogleBooksCached).toHaveBeenCalled());
        expect(getByText('Showing results from Open Library while Google Books is unavailable.')).toBeOnTheScreen();
    });

    it('requeries once with the applied filters and explains pricing unavailable in Open Library', async () => {
        const book = { id: 'fallback-filtered', volumeInfo: { title: 'Filtered Dune', authors: ['A. Reader'] } };
        (booksService.searchGoogleBooksCached as jest.Mock)
            .mockResolvedValueOnce({ items: [book], totalItems: 48254, hasMore: true, fromCache: false })
            .mockResolvedValueOnce({
                items: [book], totalItems: 48254, totalItemsExact: true, hasMore: true, fromCache: false,
                providerUsed: 'openLibrary', fallbackUsed: true, unsupportedFilters: ['priceType'],
            });
        const screen = renderScreen();

        fireEvent.changeText(screen.getByTestId('library-search-input'), 'Dune');
        await waitFor(() => expect(screen.getByText('48,254 results')).toBeOnTheScreen());
        (booksService.searchGoogleBooksCached as jest.Mock).mockClear();
        fireEvent.press(screen.getByLabelText('Filter results'));
        fireEvent.press(screen.getByTestId('test-apply-free'));

        await waitFor(() => expect(booksService.searchGoogleBooksCached).toHaveBeenCalledTimes(1));
        expect(booksService.searchGoogleBooksCached).toHaveBeenCalledWith('Dune', 0, 20, { priceType: 'free' });
        expect(screen.getByText('1 shown')).toBeOnTheScreen();
        expect(screen.getByText(/does not provide book pricing.*Free\/Paid filter was not applied/i)).toBeOnTheScreen();
    });

    it('does not repeat the same auto-search when the reader submits the query', async () => {
        (booksService.searchGoogleBooksCached as jest.Mock).mockResolvedValue({
            items: [{ id: 'submitted-once', volumeInfo: { title: 'Dune' } }], totalItems: 1, hasMore: false,
        });
        const screen = renderScreen();

        fireEvent.changeText(screen.getByTestId('library-search-input'), 'Dune');
        await waitFor(() => expect(booksService.searchGoogleBooksCached).toHaveBeenCalledTimes(1));
        fireEvent.press(screen.getByTestId('library-search-submit'));
        expect(booksService.searchGoogleBooksCached).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(mockSaveRecentSearch).toHaveBeenCalledWith('Dune'));
    });

    it('ignores an older search response after a newer query completes', async () => {
        const pending: Array<(value: any) => void> = [];
        (booksService.searchGoogleBooksCached as jest.Mock).mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
        const screen = renderScreen();

        fireEvent.changeText(screen.getByTestId('library-search-input'), 'Dune');
        await waitFor(() => expect(booksService.searchGoogleBooksCached).toHaveBeenCalledTimes(1));
        fireEvent.changeText(screen.getByTestId('library-search-input'), 'Dune update');
        await waitFor(() => expect(booksService.searchGoogleBooksCached).toHaveBeenCalledTimes(2));

        await act(async () => pending[1]({ items: [{ id: 'new', volumeInfo: { title: 'Newest' } }], totalItems: 7, hasMore: false }));
        await waitFor(() => expect(screen.getByText('7 results')).toBeOnTheScreen());
        await act(async () => pending[0]({ items: [{ id: 'old', volumeInfo: { title: 'Older' } }], totalItems: 3, hasMore: false }));

        expect(screen.getByText('7 results')).toBeOnTheScreen();
        expect(screen.queryByText('3 results')).toBeNull();
    });

    it('does not show old results or a false no-results state while the query is too short', async () => {
        let finishSearch!: (value: any) => void;
        (booksService.searchGoogleBooksCached as jest.Mock).mockImplementation(() => new Promise((resolve) => { finishSearch = resolve; }));
        const screen = renderScreen();

        fireEvent.changeText(screen.getByTestId('library-search-input'), 'Dune');
        await waitFor(() => expect(booksService.searchGoogleBooksCached).toHaveBeenCalledTimes(1));
        fireEvent.changeText(screen.getByTestId('library-search-input'), 'Du');
        expect(screen.getByText('Keep typing to search')).toBeOnTheScreen();
        expect(screen.queryByText('No books found')).toBeNull();
        await act(async () => finishSearch({ items: [{ id: 'late', volumeInfo: { title: 'Late result' } }], totalItems: 1, hasMore: false }));
        expect(screen.getByText('Keep typing to search')).toBeOnTheScreen();
        expect(screen.queryByText('1 result')).toBeNull();
    });
});
