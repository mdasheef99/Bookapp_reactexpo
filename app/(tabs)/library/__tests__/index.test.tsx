import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { FlatList, ScrollView, StyleSheet } from 'react-native';
import LibraryScreen from '../index';
import { booksService } from '@/features/books/services/booksService';

const mockRouterPush = jest.fn();

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockRouterPush(...args) } }));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            bgPrimary: '#FFFFFF',
            bgCard: '#F8FAFC',
            bgSecondary: '#EEF2FF',
            border: '#CBD5E1',
            accent: '#4F46E5',
            textPrimary: '#0F172A',
            textSecondary: '#475569',
            textTertiary: '#94A3B8',
            shadow: '#0F172A',
        },
    }),
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({
    useAuth: () => ({ session: { user: { id: 'reader-1' } } }),
}));
jest.mock('@/features/books/services/booksService', () => ({
    booksService: {
        getUserLibrary: jest.fn(),
    },
}));
jest.mock('@/components/ui/GlassCard', () => ({
    GlassCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/components/ui/ScreenBackground', () => ({
    ScreenBackground: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/components/ui/Button', () => {
    const React = require('react');
    const { Text, TouchableOpacity } = require('react-native');

    return {
        Button: ({ title, onPress }: { title: string; onPress: () => void }) => (
            <TouchableOpacity onPress={onPress}>
                <Text>{title}</Text>
            </TouchableOpacity>
        ),
    };
});

const renderScreen = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: Infinity },
            mutations: { retry: false, gcTime: Infinity },
        },
    });

    return {
        queryClient,
        ...render(
            <QueryClientProvider client={queryClient}>
                <LibraryScreen />
            </QueryClientProvider>
        ),
    };
};

describe('LibraryScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the full shelf by default and filters wishlist separately from reading shelves', async () => {
        (booksService.getUserLibrary as jest.Mock).mockResolvedValueOnce([
            {
                id: 'ub-reading',
                reading_status: 'reading',
                ownership: 'owned',
                available_for_lending: false,
                book: { title: 'Currently Reading', authors: ['Reader One'], cover_url: null },
            },
            {
                id: 'ub-completed',
                reading_status: 'completed',
                ownership: 'owned',
                available_for_lending: true,
                book: { title: 'Finished Book', authors: ['Reader Two'], cover_url: null },
            },
            {
                id: 'ub-wishlist',
                reading_status: 'want_to_read',
                ownership: 'wishlist',
                available_for_lending: false,
                book: { title: 'Wanted Book', authors: ['Reader Three'], cover_url: null },
            },
        ]);

        const { getByText, queryByText, queryClient, unmount } = renderScreen();

        await waitFor(() => expect(getByText('3 books')).toBeOnTheScreen());
        expect(getByText('Currently Reading')).toBeOnTheScreen();
        expect(getByText('Finished Book')).toBeOnTheScreen();
        expect(getByText('Wanted Book')).toBeOnTheScreen();

        fireEvent.press(getByText('Reading'));

        await waitFor(() => expect(getByText('1 book')).toBeOnTheScreen());
        expect(getByText('Currently Reading')).toBeOnTheScreen();
        expect(queryByText('Finished Book')).toBeNull();
        expect(queryByText('Wanted Book')).toBeNull();

        fireEvent.press(getByText('Wishlist'));

        await waitFor(() => expect(getByText('Wanted Book')).toBeOnTheScreen());
        expect(queryByText('Currently Reading')).toBeNull();
        expect(queryByText('Finished Book')).toBeNull();

        unmount();
        queryClient.clear();
    });

    it('routes both add and search actions to the Library search screen', async () => {
        (booksService.getUserLibrary as jest.Mock).mockResolvedValueOnce([]);

        const { getByLabelText, getByText, queryClient, unmount } = renderScreen();

        await waitFor(() => expect(getByText('Your library is empty')).toBeOnTheScreen());

        fireEvent.press(getByText('+ Add Book'));
        expect(mockRouterPush).toHaveBeenCalledWith('/(tabs)/library/search');

        fireEvent.press(getByLabelText('Search books'));
        expect(mockRouterPush).toHaveBeenCalledWith('/(tabs)/library/search');

        unmount();
        queryClient.clear();
    });

    it('shows a filter-specific empty state when a shelf has no books', async () => {
        (booksService.getUserLibrary as jest.Mock).mockResolvedValueOnce([
            {
                id: 'ub-reading',
                reading_status: 'reading',
                ownership: 'owned',
                available_for_lending: false,
                book: { title: 'Currently Reading', authors: ['Reader One'], cover_url: null },
            },
        ]);

        const { getByText, queryClient, unmount } = renderScreen();

        await waitFor(() => expect(getByText('Currently Reading')).toBeOnTheScreen());

        fireEvent.press(getByText('Completed'));

        await waitFor(() => expect(getByText('No completed books yet')).toBeOnTheScreen());
        expect(getByText('Switch shelves or add more books to round out this part of your library.')).toBeOnTheScreen();

        unmount();
        queryClient.clear();
    });

    it('shows a retryable error state when the library query fails', async () => {
        (booksService.getUserLibrary as jest.Mock).mockRejectedValueOnce(new Error('Network unavailable'));

        const { getByText, queryClient, unmount } = renderScreen();

        await waitFor(() => expect(getByText('Could not load your library')).toBeOnTheScreen());
        expect(getByText('Network unavailable')).toBeOnTheScreen();

        unmount();
        queryClient.clear();
    });

    it('shows an error state instead of spinning forever when the library query hangs', async () => {
        jest.useFakeTimers();
        (booksService.getUserLibrary as jest.Mock).mockImplementationOnce(() => new Promise(() => {}));

        const { getByText, queryClient, unmount } = renderScreen();

        act(() => {
            jest.advanceTimersByTime(8000);
        });

        await waitFor(() => expect(getByText('Could not load your library')).toBeOnTheScreen());
        expect(getByText('Library request timed out. Pull to refresh or try again.')).toBeOnTheScreen();

        unmount();
        queryClient.clear();
        jest.useRealTimers();
    });

    it('uses the bounded FlatList as the sole vertical scroll owner, including the collection controls', async () => {
        (booksService.getUserLibrary as jest.Mock).mockResolvedValueOnce([
            { id: 'one', reading_status: 'reading', ownership: 'owned', book: { title: 'Single scroll owner' } },
        ]);
        const { getByText, UNSAFE_getByType, queryClient, unmount } = renderScreen();
        await waitFor(() => expect(getByText('Single scroll owner')).toBeTruthy());
        const list = UNSAFE_getByType(FlatList);
        expect(list.props.ListHeaderComponent).toBeTruthy();
        expect(StyleSheet.flatten(list.props.style).flex).toBe(1);
        let ancestor = list.parent;
        while (ancestor) {
            expect(ancestor.type).not.toBe(ScrollView);
            ancestor = ancestor.parent;
        }
        expect(list.props.refreshControl.props.onRefresh).toEqual(expect.any(Function));
        unmount();
        queryClient.clear();
    });

    it('refreshes the same query through the List scroll owner and updates its header counts', async () => {
        const entry = { id: 'refresh-one', reading_status: 'reading', ownership: 'owned', book: { title: 'Refresh book' } };
        (booksService.getUserLibrary as jest.Mock).mockResolvedValueOnce([entry]).mockResolvedValueOnce([]);
        const { getByText, UNSAFE_getByType, queryClient, unmount } = renderScreen();
        await waitFor(() => expect(getByText('Refresh book')).toBeTruthy());
        await act(async () => { await UNSAFE_getByType(FlatList).props.refreshControl.props.onRefresh(); });
        await waitFor(() => expect(getByText('0 books')).toBeTruthy());
        expect(getByText('Your library is empty')).toBeTruthy();
        expect(booksService.getUserLibrary).toHaveBeenCalledTimes(2);
        unmount();
        queryClient.clear();
    });
});
