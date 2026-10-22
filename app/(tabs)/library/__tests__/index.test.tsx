import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { FlatList, Platform, ScrollView, StyleSheet } from 'react-native';
import LibraryScreen from '../index';
import { booksService } from '@/features/books/services/booksService';
import { expectSinglePrimary } from '@/test-utils/bookSection';
import { BookButton, BookFeedbackProvider } from '@/components/library/ui';
import { LibraryBookRow } from '@/components/library/LibraryBookList';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import { MIN_TARGET } from '@/components/library/LibraryAppearance';
import type { ExportFeedback } from '@/features/books/export/useExportActions';

const mockRouterPush = jest.fn();
let mockOffline = false;
let mockExportAvailable = false;
let mockExportBusy = false;
let mockExportFeedback: ExportFeedback = null;
const mockExportRun = jest.fn();
const mockExportActor = jest.fn();
jest.mock('@/features/books/export/deliver', () => ({ exportDeliveryAvailable: () => mockExportAvailable }));
jest.mock('@/features/books/export/useExportActions', () => ({ useLibraryCsvExport: (actor: string) => {
    mockExportActor(actor);
    return { run: mockExportRun, busy: mockExportBusy, feedback: mockExportFeedback };
} }));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOffline: mockOffline }) }));

beforeEach(() => { mockExportAvailable = false; mockExportBusy = false; mockExportFeedback = null; });

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockRouterPush(...args) }, useFocusEffect: jest.fn() }));
jest.mock('react-native-gesture-handler', () => ({
    GestureDetector: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Gesture: { Pan: () => {
        const gesture: Record<string, jest.Mock> = {};
        for (const name of ['enabled', 'minDistance', 'maxPointers', 'runOnJS', 'onStart', 'onUpdate', 'onEnd', 'onFinalize']) {
            gesture[name] = jest.fn(() => gesture);
        }
        return gesture;
    } },
}));
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
// SDD-09 H-12: Home renders the gateway-driven continue-reading card. These
// suites stub the new dependency to the empty state so they keep asserting
// the library rows and export wiring without history content.
jest.mock('@/features/books/history/readingHistoryGateway', () => ({
    readingHistoryGateway: {
        openReadsWithProgress: jest.fn(() => Promise.resolve([])),
        openReadBookIds: jest.fn(() => Promise.resolve([])),
        settings: jest.fn(() => Promise.resolve(null)),
        userBookTitle: jest.fn(() => Promise.resolve(null)),
        addProgress: jest.fn(),
        setTotalPages: jest.fn(),
        goal: jest.fn(() => Promise.resolve(null)),
        readsForUser: jest.fn(() => Promise.resolve([])),
        setGoal: jest.fn(),
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

describe('Library CSV export wiring', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockOffline = false; mockExportAvailable = true;
        (booksService.getUserLibrary as jest.Mock).mockReset().mockResolvedValue([{ id: 'saved', book: { title: 'Saved book' } }]);
        mockExportRun.mockResolvedValue(undefined);
    });

    it('passes the actor to the hook and offers a named quiet export beside Add', async () => {
        const ui = renderScreen();
        await ui.findByText('1 book');
        expect(mockExportActor).toHaveBeenCalledWith('reader-1');
        expect(ui.getByText('Export library')).toBeOnTheScreen();
        fireEvent.press(ui.getByRole('button', { name: 'Export library as CSV' }));
        expect(mockExportRun).toHaveBeenCalledTimes(1);
        expectSinglePrimary(ui);
        ui.unmount(); ui.queryClient.clear();
    });

    it('hides export on the native stub', async () => {
        mockExportAvailable = false;
        const ui = renderScreen(); await ui.findByText('1 book');
        expect(ui.queryByRole('button', { name: 'Export library as CSV' })).toBeNull();
        ui.unmount(); ui.queryClient.clear();
    });

    it('disables the entry offline and announces the connection caption below the header', async () => {
        mockOffline = true;
        const ui = renderScreen(); await ui.findByText('1 book');
        expect(ui.getByRole('button', { name: 'Export library as CSV' })).toBeDisabled();
        fireEvent.press(ui.getByRole('button', { name: 'Export library as CSV' }));
        expect(mockExportRun).not.toHaveBeenCalled();
        expect(ui.getByText('Export needs a connection.').props.accessibilityLiveRegion).toBe('polite');
        expect(ui.getByRole('button', { name: 'Add a book' })).toBeEnabled();
        ui.unmount(); ui.queryClient.clear();
    });

    it('shows busy on the disabled export control', async () => {
        mockExportBusy = true;
        const ui = renderScreen(); await ui.findByText('1 book');
        const button = ui.getByRole('button', { name: 'Export library as CSV' });
        expect(button).toBeDisabled(); expect(button.props.accessibilityState.busy).toBe(true);
        expect(ui.getByText('Exporting…')).toBeOnTheScreen();
        ui.unmount(); ui.queryClient.clear();
    });

    it.each([
        { kind: 'saved', message: 'Saved to your downloads.' },
        { kind: 'empty', message: 'Your library is empty.' },
        { kind: 'error', message: "Couldn't export. Try again." },
    ] as const)('announces $kind feedback and provides the error retry', async feedback => {
        mockExportFeedback = feedback;
        const ui = renderScreen(); await ui.findByText('1 book');
        const caption = ui.getByText(feedback.message);
        expect(caption.props.accessibilityLiveRegion).toBe('polite');
        expect(caption.props['aria-live']).toBe('polite');
        expect(StyleSheet.flatten(caption.props.style)).toMatchObject(LIBRARY_TEXT.caption);
        if (feedback.kind === 'error') {
            fireEvent.press(ui.getByRole('button', { name: 'Try again' }));
            expect(mockExportRun).toHaveBeenCalledTimes(1);
        }
        ui.unmount(); ui.queryClient.clear();
    });
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
                {/* SDD-09 H-12: Home renders the continue-reading card, which
                    notifies through the library feedback provider (always
                    present via LibraryLayout in production). */}
                <BookFeedbackProvider>
                    <LibraryScreen />
                </BookFeedbackProvider>
            </QueryClientProvider>
        ),
    };
};

describe('LibraryScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (booksService.getUserLibrary as jest.Mock).mockReset();
        mockOffline = false;
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

        const { getByText, getByRole, queryByText, queryClient, unmount } = renderScreen();

        await waitFor(() => expect(getByText('3 books')).toBeOnTheScreen());
        expect(getByText('Currently Reading')).toBeOnTheScreen();
        expect(getByText('Finished Book')).toBeOnTheScreen();
        expect(getByText('Wanted Book')).toBeOnTheScreen();

        fireEvent.press(getByRole('radio', { name: 'Reading, 1 book' }));

        await waitFor(() => expect(getByText('1 book')).toBeOnTheScreen());
        expect(getByText('Currently Reading')).toBeOnTheScreen();
        expect(queryByText('Finished Book')).toBeNull();
        expect(queryByText('Wanted Book')).toBeNull();

        fireEvent.press(getByRole('radio', { name: 'Wishlist, 1 book' }));

        await waitFor(() => expect(getByText('Wanted Book')).toBeOnTheScreen());
        expect(queryByText('Currently Reading')).toBeNull();
        expect(queryByText('Finished Book')).toBeNull();

        unmount();
        queryClient.clear();
    });

    it('routes the single Add a book action to the Library search screen', async () => {
        (booksService.getUserLibrary as jest.Mock).mockResolvedValueOnce([]);

        const ui = renderScreen();
        const { getByRole, getByText, queryByLabelText, queryClient, unmount } = ui;

        await waitFor(() => expect(getByText('Your library is empty')).toBeOnTheScreen());

        expect(getByText('Add a book to start your shelf.')).toBeOnTheScreen();
        expectSinglePrimary(ui);
        expect(queryByLabelText('Search books')).toBeNull();
        fireEvent.press(getByRole('button', { name: 'Add a book' }));
        expect(mockRouterPush).toHaveBeenCalledWith('/(tabs)/library/search');
        expect(mockRouterPush).toHaveBeenCalledTimes(1);

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

        const ui = renderScreen();
        const { getByText, getByRole, queryClient, unmount } = ui;

        await waitFor(() => expect(getByText('Currently Reading')).toBeOnTheScreen());

        fireEvent.press(getByRole('radio', { name: 'Finished, 0 books' }));

        await waitFor(() => expect(getByText('No finished books')).toBeOnTheScreen());
        expectSinglePrimary(ui);
        expect(ui.UNSAFE_getAllByType(BookButton).find(button => button.props.label === 'Show all books')?.props.variant).toBe('text');
        expect(StyleSheet.flatten(getByRole('button', { name: 'Show all books' }).props.style).minHeight).toBeGreaterThanOrEqual(MIN_TARGET);
        fireEvent.press(getByRole('button', { name: 'Show all books' }));
        expect(getByText('Currently Reading')).toBeOnTheScreen();
        expect(getByRole('radio', { name: 'All, 1 book' }).props.accessibilityState.checked).toBe(true);

        unmount();
        queryClient.clear();
    });

    it.each([false, true])('classifies first-load errors with offline=%s and retries without raw server copy', async (offline) => {
        mockOffline = offline;
        (booksService.getUserLibrary as jest.Mock).mockRejectedValueOnce(new Error('Network unavailable'));
        (booksService.getUserLibrary as jest.Mock).mockResolvedValueOnce([]);

        const ui = renderScreen();
        const { getByText, getByRole, queryByText, queryClient, unmount } = ui;

        await waitFor(() => expect(getByText(offline ? "You're offline." : "Couldn't load your library.")).toBeOnTheScreen());
        expect(getByText(offline ? 'Your library will load when you reconnect.' : 'Try again in a moment.')).toBeOnTheScreen();
        expect(getByRole('heading', { name: 'My Library' })).toBeOnTheScreen();
        expect(queryByText('Network unavailable')).toBeNull();
        expect(ui.queryByRole('button', { name: 'Add a book' })).toBeNull();
        expectSinglePrimary(ui);
        expect(StyleSheet.flatten(getByRole('button', { name: 'Try again' }).props.style).minHeight).toBeGreaterThanOrEqual(MIN_TARGET);
        fireEvent.press(getByRole('button', { name: 'Try again' }));
        await waitFor(() => expect(getByText('Your library is empty')).toBeOnTheScreen());
        expect(booksService.getUserLibrary).toHaveBeenCalledTimes(2);

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

        await waitFor(() => expect(getByText("Couldn't load your library.")).toBeOnTheScreen());
        expect(getByText('Try again in a moment.')).toBeOnTheScreen();

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

    it('renders populated rows as one named target with a status caption and one primary', async () => {
        (booksService.getUserLibrary as jest.Mock).mockResolvedValueOnce([
            { id: 'lent', reading_status: 'reading', ownership: 'lent_out', book: { title: 'The Dispossessed', authors: ['Ursula Le Guin'] } },
        ]);
        const ui = renderScreen();
        await ui.findByText('The Dispossessed');
        expectSinglePrimary(ui);
        const row = ui.getByRole('button', { name: 'Open The Dispossessed by Ursula Le Guin' });
        expect(StyleSheet.flatten(row.props.style)).toMatchObject({ minHeight: MIN_TARGET, borderBottomWidth: StyleSheet.hairlineWidth });
        expect(ui.getByText('Reading · Lent out')).toBeOnTheScreen();
        expect(StyleSheet.flatten(ui.getByText('The Dispossessed').props.style)).toMatchObject(LIBRARY_TEXT.heading);
        expect(ui.getByText('The Dispossessed').props.numberOfLines).toBe(2);
        expect(ui.getByText('Ursula Le Guin').props.numberOfLines).toBe(1);
        expect(StyleSheet.flatten(ui.getByText('Ursula Le Guin').props.style)).toMatchObject(LIBRARY_TEXT.body);
        expect(StyleSheet.flatten(ui.getByText('Reading · Lent out').props.style)).toMatchObject(LIBRARY_TEXT.caption);
        expect(ui.getByText('1 book').props.accessibilityLiveRegion).toBe('polite');
        expect(ui.queryByText(/^Showing /)).toBeNull();
        expect(ui.queryByText('Offline · Showing saved content.')).toBeNull();
        expect(ui.UNSAFE_getAllByType(LibraryBookRow)).toHaveLength(1);
        fireEvent.press(row);
        expect(mockRouterPush).toHaveBeenCalledWith('/(tabs)/library/lent');
        ui.unmount(); ui.queryClient.clear();
    });

    it('keeps the header and Add a book during the five-row skeleton, with disabled view radios and no spinner', async () => {
        let finish!: (books: unknown[]) => void;
        (booksService.getUserLibrary as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const ui = renderScreen();
        expect(ui.getByRole('heading', { name: 'My Library' })).toBeOnTheScreen();
        expect(ui.getByRole('button', { name: 'Add a book' })).toBeEnabled();
        expectSinglePrimary(ui);
        expect(ui.getAllByTestId('book-loading-row', { includeHiddenElements: true })).toHaveLength(5);
        expect(ui.getByLabelText('Loading library')).toBeOnTheScreen();
        expect(ui.queryByTestId('library-book-list')).toBeNull();
        expect(ui.UNSAFE_queryAllByType(require('react-native').ActivityIndicator)).toHaveLength(0);
        for (const radio of ui.getAllByRole('radio')) expect(radio).toBeDisabled();
        await act(async () => { finish([]); });
        await ui.findByText('Your library is empty');
        ui.unmount(); ui.queryClient.clear();
    });

    it.each([false, true])('retains cached data after refresh failure, including an empty saved library=%s', async (empty) => {
        const entry = { id: 'saved', reading_status: 'reading', ownership: 'owned', book: { title: 'Saved book' } };
        (booksService.getUserLibrary as jest.Mock).mockResolvedValueOnce(empty ? [] : [entry])
            .mockRejectedValueOnce(new Error('Raw provider 500')).mockResolvedValueOnce(empty ? [] : [entry]);
        const ui = renderScreen();
        await ui.findByText(empty ? 'Your library is empty' : 'Saved book');
        await act(async () => { await ui.UNSAFE_getByType(FlatList).props.refreshControl.props.onRefresh(); });
        await ui.findByText("Couldn't refresh.");
        expect(ui.getByText(empty ? 'Your library is empty' : 'Saved book')).toBeOnTheScreen();
        expect(ui.queryByText('Raw provider 500')).toBeNull();
        expect(ui.queryByText("Couldn't load your library.")).toBeNull();
        expectSinglePrimary(ui);
        expect(ui.UNSAFE_getAllByType(BookButton).find(button => button.props.label === 'Try again')?.props.variant).toBe('text');
        expect(StyleSheet.flatten(ui.getByText("Couldn't refresh.").props.style)).toMatchObject(LIBRARY_TEXT.caption);
        expect(StyleSheet.flatten(ui.getByRole('button', { name: 'Try again' }).props.style).minHeight).toBeGreaterThanOrEqual(MIN_TARGET);
        await act(async () => {
            fireEvent.press(ui.getByRole('button', { name: 'Try again' }));
            await ui.queryClient.getQueryCache().find({ queryKey: ['library', 'reader-1'] })?.promise;
        });
        expect(booksService.getUserLibrary).toHaveBeenCalledTimes(3);
        expect(ui.queryClient.getQueryState(['library', 'reader-1'])?.status).toBe('success');
        await waitFor(() => expect(ui.queryByText("Couldn't refresh.")).toBeNull(), { timeout: 5000 });
        ui.unmount(); ui.queryClient.clear();
    });

    it('shows the quiet offline caption with saved books and keeps Add a book enabled', async () => {
        mockOffline = true;
        (booksService.getUserLibrary as jest.Mock).mockResolvedValueOnce([
            { id: 'offline', book: { title: 'Saved offline' } },
        ]);
        const ui = renderScreen();
        const notice = await ui.findByText('Offline · Showing saved content.');
        expect(StyleSheet.flatten(notice.props.style)).toMatchObject(LIBRARY_TEXT.caption);
        expect(ui.getByText('Saved offline')).toBeOnTheScreen();
        expect(ui.getByRole('button', { name: 'Add a book' })).toBeEnabled();
        expectSinglePrimary(ui);
        ui.unmount(); ui.queryClient.clear();
    });

    it.each(['web', 'ios'] as const)('announces offline and refresh-failure captions politely on %s', async platform => {
        const previousOS = Platform.OS;
        Platform.OS = platform;
        mockOffline = true;
        const entry = { id: 'saved', book: { title: 'Saved book' } };
        (booksService.getUserLibrary as jest.Mock).mockResolvedValueOnce([entry]).mockRejectedValueOnce(new Error('Refresh failed'));
        const ui = renderScreen();
        try {
            const offline = await ui.findByText('Offline · Showing saved content.');
            expect(offline.props.accessibilityLiveRegion).toBe('polite');
            if (platform === 'web') expect(offline.props).toMatchObject({ 'aria-live': 'polite', role: 'status' });
            await act(async () => { await ui.UNSAFE_getByType(FlatList).props.refreshControl.props.onRefresh(); });
            const refresh = await ui.findByText("Couldn't refresh.");
            expect(refresh.props.accessibilityLiveRegion).toBe('polite');
            if (platform === 'web') expect(refresh.props).toMatchObject({ 'aria-live': 'polite', role: 'status' });
        } finally {
            ui.unmount(); ui.queryClient.clear();
            Platform.OS = previousOS;
        }
    });
});
