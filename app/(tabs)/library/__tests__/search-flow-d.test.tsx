import React from 'react';
import { FlatList, Linking, StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { BookFeedbackProvider } from '@/components/library/ui/BookFeedback';
import { countPrimaryButtons, expectSinglePrimary } from '@/test-utils/bookSection';
import { getLibraryAppearance } from '@/components/library/LibraryAppearance';
import { booksService } from '@/features/books/services/booksService';
import SearchBooksScreen from '../search';

let mockOffline = false;
const mockToggleWishlist = jest.fn();
const mockRefreshWishlist = jest.fn();
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(), notificationAsync: jest.fn(),
    ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium' },
    NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight', colors: {} }) }));
jest.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: () => ({ session: { user: { id: 'reader' } } }) }));
jest.mock('@/hooks/useDebounce', () => ({ useDebounce: (value: string) => value }));
jest.mock('@/hooks/useRecentSearches', () => ({ useRecentSearches: () => ({
    recentSearches: [], saveRecentSearch: jest.fn(), removeRecentSearch: jest.fn(),
}) }));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOffline: mockOffline }) }));
jest.mock('@/hooks/useWishlist', () => ({ useWishlist: () => ({
    wishlistBookIds: new Set(), toggleWishlist: mockToggleWishlist, refreshWishlist: mockRefreshWishlist,
}) }));
jest.mock('@/components/search', () => {
    const React = require('react');
    const { TextInput } = require('react-native');
    return { SkeletonCard: () => null, SearchBar: ({ query, onQueryChange, onSubmit }: any) => React.createElement(TextInput, {
        testID: 'search-input', value: query, onChangeText: onQueryChange, onSubmitEditing: onSubmit,
    }) };
});
jest.mock('@/components/library/search/SwipeableBookCard', () => ({
    SwipeableBookCard: ({ onSwipeAddToLibrary, onSwipeAddToWishlist, ...props }: any) => {
        const React = require('react');
        const { BookCard } = require('@/components/library/search/BookCard');
        return React.createElement(BookCard, { ...props, onAdd: onSwipeAddToLibrary, onWishlistToggle: onSwipeAddToWishlist });
    },
}));
jest.mock('@/features/books/services/booksService', () => ({ booksService: {
    getSearchSuggestions: jest.fn(), getUserLibrary: jest.fn(), searchGoogleBooksCached: jest.fn(),
    addToLibrary: jest.fn(), addManualBookToLibrary: jest.fn(),
} }));

const book = { id: 'dune', volumeInfo: { title: 'Dune', authors: ['Frank Herbert'], previewLink: 'https://example.test' } };
const page = { items: [book], totalItems: 1, hasMore: false };
const renderScreen = () => render(<QueryClientProvider client={new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
})}><BookFeedbackProvider><SearchBooksScreen /></BookFeedbackProvider></QueryClientProvider>);
const search = (screen: ReturnType<typeof renderScreen>, query = 'Dune') => fireEvent.changeText(screen.getByTestId('search-input'), query);

beforeEach(() => {
    jest.clearAllMocks();
    mockOffline = false;
    mockToggleWishlist.mockResolvedValue(true);
    mockRefreshWishlist.mockResolvedValue(undefined);
    (booksService.getSearchSuggestions as jest.Mock).mockResolvedValue([]);
    (booksService.getUserLibrary as jest.Mock).mockResolvedValue([]);
    (booksService.searchGoogleBooksCached as jest.Mock).mockResolvedValue(page);
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('idle has the Find books heading, plain intro and zero primaries', async () => {
    const screen = renderScreen();
    await act(async () => {});
    expect(screen.getByText('Find books').props).toMatchObject({ accessibilityRole: 'header', role: 'heading', 'aria-level': 1 });
    expect(screen.getByText('Search by title, author or ISBN.')).toBeOnTheScreen();
    expect(screen.getByText('Find your next book')).toBeOnTheScreen();
    expect(screen.getByText('Search books, authors or ISBNs, then add a title to your library or wishlist.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Back to library' })).toBeOnTheScreen();
    expect(countPrimaryButtons(screen)).toBe(0);
});

it('short query explains the three character rule', async () => {
    const screen = renderScreen();
    search(screen, 'Du');
    await act(async () => {});
    expect(screen.getByText('Keep typing')).toBeOnTheScreen();
    expect(screen.getByText('Enter at least 3 characters to search.')).toBeOnTheScreen();
    expect(booksService.searchGoogleBooksCached).not.toHaveBeenCalled();
});

it('loading uses the five-row BookLoading list', async () => {
    (booksService.searchGoogleBooksCached as jest.Mock).mockImplementation(() => new Promise(() => {}));
    const screen = renderScreen();
    search(screen);
    await act(async () => {});
    expect(screen.getAllByTestId('book-loading-row', { includeHiddenElements: true })).toHaveLength(5);
});

it('offline caption and query explain reconnection without offering manual add', async () => {
    mockOffline = true;
    const screen = renderScreen();
    search(screen);
    await act(async () => {});
    expect(screen.getByText('Offline · Search needs a connection.')).toBeOnTheScreen();
    expect(screen.getByText('Search needs a connection')).toBeOnTheScreen();
    expect(screen.getByText('Reconnect to search the catalogues.')).toBeOnTheScreen();
    expect(screen.queryByTestId('library-manual-entry-open')).toBeNull();
    expect(booksService.searchGoogleBooksCached).not.toHaveBeenCalled();
});

it('results have zero primaries and secondary Add remains usable', async () => {
    const screen = renderScreen();
    search(screen);
    await screen.findByText('1 result');
    expect(countPrimaryButtons(screen)).toBe(0);
    const add = screen.getByRole('button', { name: 'Add to library: Dune' });
    const colors = getLibraryAppearance('daylight');
    expect(StyleSheet.flatten(add.props.style).backgroundColor).toBe(colors.bgCard);
    expect(StyleSheet.flatten(within(add).getByText('Add to library').props.style).color).toBe(colors.textPrimary);
    expect(screen.getByText('Filter')).toBeOnTheScreen();
    expect(screen.getByText('Sort')).toBeOnTheScreen();
});

it('no results has one primary manual entry action', async () => {
    (booksService.searchGoogleBooksCached as jest.Mock).mockResolvedValue({ items: [], totalItems: 0, hasMore: false });
    const screen = renderScreen();
    search(screen);
    await screen.findByText('No books found');
    expect(screen.getByText('Try another search or change the filters.')).toBeOnTheScreen();
    expect(screen.getByText("Can't find it? Save a title and author to your library.")).toBeOnTheScreen();
    expectSinglePrimary(screen);
});

it.each([
    [new Error('Google Books API error: 500'), "The book catalogues didn't respond. Try again in a moment."],
    [new Error('Google Books API error: 429'), 'The book catalogues are busy. Try again in a minute.'],
    [new TypeError('Network request failed'), "Couldn't reach the book catalogues. Check your connection and try again."],
])('search error maps %p and retry runs the search again', async (error, message) => {
    (booksService.searchGoogleBooksCached as jest.Mock).mockRejectedValueOnce(error).mockResolvedValueOnce(page);
    const screen = renderScreen();
    search(screen);
    await screen.findByText(message);
    expect(screen.queryByText(error.message)).toBeNull();
    expectSinglePrimary(screen);
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('1 result');
    expect(booksService.searchGoogleBooksCached).toHaveBeenCalledTimes(2);
});

it.each([
    [{ code: '23505', message: 'private unique violation' }, 'This book is already in your library.'],
    [new Error('private add failure'), "Couldn't add this book. Try again."],
])('add failure maps %p into feedback', async (error, message) => {
    (booksService.addToLibrary as jest.Mock).mockRejectedValueOnce(error);
    const screen = renderScreen();
    search(screen);
    fireEvent.press(await screen.findByRole('button', { name: 'Add to library: Dune' }));
    await screen.findByText(message);
    expect(screen.queryByText(error.message)).toBeNull();
});

it.each(['throw', 'false'])('wishlist failure (%s) uses mapped feedback', async mode => {
    if (mode === 'throw') mockToggleWishlist.mockRejectedValueOnce(new Error('private wishlist failure'));
    else mockToggleWishlist.mockResolvedValueOnce(false);
    const screen = renderScreen();
    search(screen);
    fireEvent.press(await screen.findByRole('button', { name: 'Add Dune to wishlist' }));
    await screen.findByText("Couldn't update your wishlist. Try again.");
    expect(screen.queryByText('private wishlist failure')).toBeNull();
});

it.each([
    [new Error('private manual failure'), "Couldn't add this book. Try again."],
    [new Error('Title is required.'), 'Title is required.'],
])('manual entry keeps %p inside the modal and preserves the draft and one primary', async (error, message) => {
    (booksService.searchGoogleBooksCached as jest.Mock).mockResolvedValue({ items: [], totalItems: 0, hasMore: false });
    (booksService.addManualBookToLibrary as jest.Mock).mockRejectedValue(error);
    const screen = renderScreen();
    search(screen);
    fireEvent.press(await screen.findByTestId('library-manual-entry-open'));
    expectSinglePrimary(screen);
    fireEvent.press(screen.getByTestId('library-manual-entry-save'));
    await waitFor(() => expect(within(screen.getByTestId('book-feedback-slot')).getByText(message)).toBeOnTheScreen());
    expect(screen.getByTestId('library-manual-entry-title').props.value).toBe('Dune');
    expect(screen.queryByText('private manual failure')).toBeNull();
    expectSinglePrimary(screen);
});

it('adding keeps other cards usable and success shows the unchanged toast and library status', async () => {
    let finishAdd!: () => void;
    (booksService.searchGoogleBooksCached as jest.Mock).mockResolvedValue({ ...page, items: [book, { id: 'other', volumeInfo: { title: 'Another book' } }] });
    (booksService.addToLibrary as jest.Mock).mockImplementation(() => new Promise<void>(resolve => { finishAdd = resolve; }));
    const screen = renderScreen();
    search(screen);
    fireEvent.press(await screen.findByRole('button', { name: 'Add to library: Dune' }));
    expect(screen.getByText('Adding…')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Adding…: Dune' }).props.accessibilityState.busy).toBe(true);
    expect(screen.getByRole('button', { name: 'Add to library: Another book' })).toBeEnabled();
    (booksService.getUserLibrary as jest.Mock).mockResolvedValue([{ ownership: 'owned', book: { google_books_id: 'dune' } }]);
    await act(async () => finishAdd());
    await screen.findByText('"Dune" is now in your library');
    await screen.findByText('In your library');
    expect(screen.queryByRole('button', { name: 'Add to library: Dune' })).toBeNull();
});

it('pagination announces Loading more results while retaining the list', async () => {
    (booksService.searchGoogleBooksCached as jest.Mock).mockResolvedValueOnce({ ...page, hasMore: true })
        .mockImplementationOnce(() => new Promise(() => {}));
    const screen = renderScreen();
    search(screen);
    await screen.findByText('1 result');
    fireEvent(screen.UNSAFE_getByType(FlatList), 'onEndReached');
    expect(screen.getByLabelText('Loading more results')).toBeOnTheScreen();
    expect(screen.getByText('Dune')).toBeOnTheScreen();
});

it('applied filters show a plain count and results still have no primary', async () => {
    const screen = renderScreen();
    search(screen);
    fireEvent.press(await screen.findByRole('button', { name: 'Filter' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Fiction' }));
    fireEvent.press(screen.getByRole('button', { name: 'Apply filters' }));
    await screen.findByRole('button', { name: 'Filter (1)' });
    expect(countPrimaryButtons(screen)).toBe(0);
});

it('cached results keep the exact notice wording', async () => {
    (booksService.searchGoogleBooksCached as jest.Mock).mockResolvedValue({ ...page, fromCache: true });
    const screen = renderScreen();
    search(screen);
    await screen.findByText('Showing recent cached Google Books results.');
});

it('preview failure uses plain feedback', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValueOnce(new Error('private preview failure'));
    const screen = renderScreen();
    search(screen);
    fireEvent.press(await screen.findByRole('button', { name: 'Preview Dune' }));
    await screen.findByText("Couldn't open the preview.");
});

it('Filter and Sort triggers report their open state, and Filter its active state', async () => {
    const screen = renderScreen();
    search(screen);
    await screen.findByText('1 result');
    // The open sheet hides the screen behind it from role queries, so find the host trigger by its name.
    const trigger = (label: string) => screen.UNSAFE_root.find((node: any) => typeof node.type === 'string'
        && node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label);
    const filter = () => trigger('Filter');
    const sort = () => trigger('Sort');
    expect(filter().props.accessibilityState).toMatchObject({ expanded: false, selected: false });
    expect(sort().props.accessibilityState).toMatchObject({ expanded: false });
    fireEvent.press(filter());
    expect(filter().props.accessibilityState).toMatchObject({ expanded: true });
    expect(sort().props.accessibilityState).toMatchObject({ expanded: false });
});

it('maps the Filter and Sort open state to aria-expanded through the installed RN Web converter', async () => {
    const createDOMProps = require('react-native-web/dist/cjs/modules/createDOMProps') as
        (element: string, props: Record<string, unknown>) => Record<string, unknown>;
    const screen = renderScreen();
    search(screen);
    await screen.findByText('1 result');
    // Outermost instances keep the props BookButton passes before native Pressable normalizes them.
    const trigger = (label: string) => screen.UNSAFE_root.findAll((node: any) => node.props.accessibilityRole === 'button'
        && node.props.accessibilityLabel === label && 'aria-expanded' in node.props, { deep: false })[0];
    const dom = (label: string) => createDOMProps('button', trigger(label).props);
    expect(dom('Filter')['aria-expanded']).toBe(false);
    expect(dom('Sort')['aria-expanded']).toBe(false);
    fireEvent.press(trigger('Sort'));
    expect(dom('Sort')['aria-expanded']).toBe(true);
    expect(dom('Filter')['aria-expanded']).toBe(false);
});
