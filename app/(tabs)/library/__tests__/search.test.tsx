import React from 'react';
import { Alert } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import SearchBooksScreen from '../search';
import { booksService } from '@/features/books/services/booksService';

const mockRouterBack = jest.fn();
const mockRefreshWishlist = jest.fn().mockResolvedValue(undefined);

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
        saveRecentSearch: jest.fn(),
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
        FilterModal: () => null,
        FilterChips: () => null,
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

    it('opens the manual-entry modal from no-results and saves a manual book to the library', async () => {
        const { getByTestId, queryByTestId } = renderScreen();

        fireEvent.changeText(getByTestId('library-search-input'), 'Manual Title');
        fireEvent.press(getByTestId('library-search-submit'));

        await waitFor(() => expect(booksService.searchGoogleBooksCached).toHaveBeenCalledWith('Manual Title', 0, 20, {}));

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
});
