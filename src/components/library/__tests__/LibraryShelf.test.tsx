import React from 'react';
import { StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LibraryScreen from '../../../../app/(tabs)/library/index';
import { booksService } from '@/features/books/services/booksService';
import { LibraryShelf } from '../LibraryShelf';
import { LibraryHorizontalShelf } from '../LibraryHorizontalShelf';
import { LibraryBookRow } from '../LibraryBookList';
import { LibraryBookQuickLook } from '../LibraryBookQuickLook';
import { BookFeedbackProvider } from '../ui';

jest.mock('expo-image', () => ({ Image: 'Image' }));
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
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(() => Promise.resolve()), ImpactFeedbackStyle: { Light: 'Light' } }));
jest.mock('expo-audio', () => ({
    createAudioPlayer: jest.fn(() => ({ play: jest.fn(), pause: jest.fn(), remove: jest.fn(), seekTo: jest.fn(), volume: 0.3 })),
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    return {
        ...Reanimated,
        useReducedMotion: jest.fn(() => false),
        useSharedValue: jest.fn((v: any) => ({ value: v })),
        useAnimatedStyle: jest.fn((fn: any) => fn()),
        withSpring: jest.fn((v: any) => v),
        withTiming: jest.fn((v: any) => v),
        withDelay: jest.fn((_: number, v: any) => v),
        Easing: { bezier: () => (t: number) => t, linear: (t: number) => t },
    };
});
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
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
    booksService: { getUserLibrary: jest.fn() },
    getHighResCoverUrl: jest.fn((url: string) => url),
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
            <TouchableOpacity onPress={onPress}><Text>{title}</Text></TouchableOpacity>
        ),
    };
});
jest.mock('expo-router', () => {
    const React = require('react');
    const mockCapturedScreens: any[] = [];
    const Stack: any = ({ children }: { children: React.ReactNode }) => <>{children}</>;
    Stack.Screen = (props: any) => {
        mockCapturedScreens.push(props);
        return null;
    };
    return { router: { push: jest.fn() }, useFocusEffect: jest.fn(), Stack, __mockCapturedScreens: mockCapturedScreens };
});

const renderLibraryScreen = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
    return { queryClient, ...render(<QueryClientProvider client={queryClient}><BookFeedbackProvider><LibraryScreen /></BookFeedbackProvider></QueryClientProvider>) };
};

const renderWithLibraryProviders = (ui: React.ReactElement) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
    return { queryClient, ...render(<QueryClientProvider client={queryClient}><BookFeedbackProvider>{ui}</BookFeedbackProvider></QueryClientProvider>) };
};

describe('horizontal browsing and quick look', () => {
    const book = { id: 'quick-1', ownership: 'owned', reading_status: 'reading', rating: 4, review: 'A personal review', condition: 'good', available_for_lending: false,
        book: { title: 'True facts', authors: ['A. Reader'], page_count: 320 } };
    it('waits the full 450ms through the press responder before opening quick look', () => {
        jest.useFakeTimers();
        try {
            const navigate = jest.fn(), screen = renderWithLibraryProviders(<LibraryHorizontalShelf books={[book]} onBookPress={navigate} />);
            const volume = screen.getByTestId('library-horizontal-book-quick-1');
            const event = { currentTarget: 1, target: 1, persist: () => {}, nativeEvent: { pageX: 40, pageY: 100, locationX: 10, locationY: 20, touches: [{ pageX: 40, pageY: 100 }] } };
            fireEvent(volume, 'responderGrant', event);
            act(() => jest.advanceTimersByTime(449));
            expect(screen.queryByTestId('library-book-quick-look')).toBeNull();
            act(() => jest.advanceTimersByTime(1));
            expect(screen.getByTestId('library-book-quick-look')).toBeTruthy();
            fireEvent(volume, 'responderRelease', event);
            expect(navigate).not.toHaveBeenCalled();
            screen.unmount();
        } finally { jest.useRealTimers(); }
    });
    it('opens loaded facts after a hold, suppresses release navigation and routes the details action', () => {
        const navigate = jest.fn(), screen = renderWithLibraryProviders(<LibraryHorizontalShelf books={[book]} onBookPress={navigate} />);
        const volume = screen.getByTestId('library-horizontal-book-quick-1');
        fireEvent(volume, 'pressIn', { nativeEvent: { pageX: 40, pageY: 100 } });
        fireEvent(volume, 'longPress'); fireEvent.press(volume);
        expect(navigate).not.toHaveBeenCalled();
        expect(screen.getByTestId('library-book-quick-look')).toBeTruthy();
        for (const value of ['Reading', 'Owned', '320', 'Good', '4 / 5', 'A personal review']) expect(screen.getByText(value)).toBeTruthy();
        expect(screen.queryByText(/progress|minutes|streak/i)).toBeNull();
        fireEvent.press(screen.getByTestId('library-quick-look-details'));
        expect(navigate).toHaveBeenCalledWith(book); expect(screen.queryByTestId('library-book-quick-look')).toBeNull();
    });
    it('cancels hold and tap after pointer movement and track scrolling', () => {
        const navigate = jest.fn(), screen = renderWithLibraryProviders(<LibraryHorizontalShelf books={[book]} onBookPress={navigate} />);
        let volume = screen.getByTestId('library-horizontal-book-quick-1');
        fireEvent(volume, 'pressIn', { nativeEvent: { pageX: 40, pageY: 100 } });
        fireEvent(volume, 'touchMove', { nativeEvent: { touches: [{ pageX: 65, pageY: 100 }] } });
        fireEvent(volume, 'longPress'); fireEvent.press(volume);
        expect(navigate).not.toHaveBeenCalled(); expect(screen.queryByTestId('library-book-quick-look')).toBeNull();
        fireEvent(volume, 'pressIn', { nativeEvent: { pageX: 40, pageY: 100 } });
        fireEvent.scroll(screen.getByTestId('library-horizontal-scroll-top'), { nativeEvent: { contentOffset: { x: 20 } } });
        volume = screen.getByTestId('library-horizontal-book-quick-1');
        fireEvent(volume, 'longPress'); fireEvent.press(volume);
        expect(navigate).not.toHaveBeenCalled(); expect(screen.queryByTestId('library-book-quick-look')).toBeNull();
    });
    it('retains quick look with reduced motion and applies no transform animation', () => {
        const motion = require('react-native-reanimated');
        motion.useReducedMotion.mockReturnValue(true); motion.withTiming.mockClear();
        try {
            const screen = renderWithLibraryProviders(<LibraryHorizontalShelf books={[book]} onBookPress={jest.fn()} />);
            const volume = screen.getByTestId('library-horizontal-book-quick-1');
            fireEvent(volume, 'hoverIn'); fireEvent(volume, 'longPress');
            expect(screen.getByTestId('library-book-quick-look')).toBeTruthy();
            expect(motion.withTiming).not.toHaveBeenCalled();
            screen.unmount();
        } finally { motion.useReducedMotion.mockReturnValue(false); }
    });
    it('provides a visible chooser alternative, omits missing facts and dismisses with back', () => {
        const unknown = { id: 'unknown', reading_status: null, ownership: null, book: { title: 'Unknown' } };
        const screen = renderWithLibraryProviders(<LibraryHorizontalShelf books={[unknown]} onBookPress={jest.fn()} />);
        fireEvent.press(screen.getByTestId('library-book-picker-open'));
        fireEvent.press(screen.getByTestId('library-book-picker-quick-unknown'));
        expect(screen.getByTestId('library-book-quick-look')).toBeTruthy();
        expect(screen.getAllByText('Not recorded')).toHaveLength(2);
        for (const value of ['Pages', 'Lending', 'Your rating', 'Your review', 'Condition']) expect(screen.queryByText(value)).toBeNull();
        const quickLookModal = screen.UNSAFE_getAllByType(require('react-native').Modal)
            .find((modal: any) => modal.props.accessibilityLabel === 'Book quick look')!;
        fireEvent(quickLookModal, 'requestClose');
        expect(screen.queryByTestId('library-book-quick-look')).toBeNull();
    });
    it('exposes independent overflow controls and updates their boundaries', () => {
        const books = Array.from({ length: 17 }, (_, i) => ({ ...book, id: `overflow-${i}` }));
        const screen = renderWithLibraryProviders(<LibraryHorizontalShelf books={books} onBookPress={jest.fn()} />);
        fireEvent(screen.getByTestId('library-horizontal-shelf'), 'layout', { nativeEvent: { layout: { width: 300 } } });
        expect(screen.getByTestId('library-horizontal-top-previous').props.accessibilityState.disabled).toBe(true);
        expect(screen.getByTestId('library-horizontal-top-next').props.accessibilityState.disabled).toBe(false);
        fireEvent.scroll(screen.getByTestId('library-horizontal-scroll-top'), { nativeEvent: { contentOffset: { x: 548 } } });
        expect(screen.getByTestId('library-horizontal-top-next').props.accessibilityState.disabled).toBe(true);
        expect(screen.getByTestId('library-horizontal-bottom-previous').props.accessibilityState.disabled).toBe(true);
    });
});

describe('D07-08 / D07-13 home and quick-look labels', () => {
    it('omits the lendable home tag even when lending is available', () => {
        const item = { id: 'home', ownership: 'owned', reading_status: 'reading', available_for_lending: true, book: { title: 'A book' } };
        const ui = render(<LibraryBookRow item={item} onPress={jest.fn()} />);
        expect(ui.queryByText(/lend/i)).toBeNull();
    });
    it.each([['completed', 'Finished'], ['want_to_read', 'Want to read']])('labels home status %s and lent_out', (reading_status, label) => {
        const item = { id: 'home', ownership: 'lent_out', reading_status, book: { title: 'A book' } };
        const ui = render(<LibraryBookRow item={item} onPress={jest.fn()} />);
        expect(ui.getByText(`${label} · Lent out`)).toBeOnTheScreen();
    });
    it.each([true, false])('omits every Lending fact for available_for_lending=%s and uses shared labels', available_for_lending => {
        const book = { id: 'quick', ownership: 'lent_out', reading_status: 'completed', condition: 'acceptable', available_for_lending,
            book: { title: 'A book' } };
        const ui = renderWithLibraryProviders(<LibraryBookQuickLook book={book} onClose={jest.fn()} onDetails={jest.fn()} />);
        expect(ui.queryByText('Lending')).toBeNull();
        expect(ui.queryByText('Available to lend')).toBeNull();
        expect(ui.queryByText('Not available to lend')).toBeNull();
        for (const label of ['Finished', 'Lent out', 'Fair']) expect(ui.getByText(label)).toBeOnTheScreen();
    });
    it.each([null, ''])('keeps Not recorded for missing status/ownership %s and omits an empty condition', missing => {
        const book = { id: 'quick', ownership: missing, reading_status: missing, condition: '', book: { title: 'A book' } };
        const ui = renderWithLibraryProviders(<LibraryBookQuickLook book={book} onClose={jest.fn()} onDetails={jest.fn()} />);
        expect(ui.getAllByText('Not recorded')).toHaveLength(2);
        expect(ui.queryByText('Condition')).toBeNull();
    });
});

describe('horizontal Shelf layout checkpoint', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => Promise.resolve(key === 'library_viewMode' ? 'shelf' : null));
    });
    it('switches only Shelf style, retains the shared draft, and cancels moves in either style', async () => {
        const books = ['One', 'Two', 'Three'].map((title, index) => ({ id: `style-${index}`, ownership: 'owned', reading_status: 'want_to_read', book: { title } }));
        (booksService.getUserLibrary as jest.Mock).mockResolvedValue(books);
        const screen = renderLibraryScreen();
        await waitFor(() => expect(screen.getByTestId('library-shelf')).toBeTruthy());
        fireEvent.press(screen.getByTestId('library-arrange-arrange-shelf'));
        fireEvent.press(screen.getByTestId('library-shelf-style-horizontal'));
        expect(screen.getByTestId('library-horizontal-shelf')).toBeTruthy();
        expect(screen.getByTestId('library-arrange-save')).toBeTruthy();
        fireEvent.press(screen.getByTestId('library-horizontal-book-style-0'));
        fireEvent.press(screen.getByTestId('library-arrange-later'));
        expect(screen.getAllByTestId(/^library-horizontal-book-/).map((node) => node.props.testID))
            .toEqual(['library-horizontal-book-style-1', 'library-horizontal-book-style-0', 'library-horizontal-book-style-2']);
        fireEvent.press(screen.getByTestId('library-shelf-style-vertical'));
        expect(screen.getByTestId('library-arrange-save')).toBeTruthy();
        fireEvent.press(screen.getByTestId('library-arrange-cancel'));
        fireEvent.press(screen.getByTestId('library-shelf-style-horizontal'));
        expect(screen.getAllByTestId(/^library-horizontal-book-/).map((node) => node.props.testID))
            .toEqual(books.map((book) => `library-horizontal-book-${book.id}`));
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('library_shelfStyle:v1', 'horizontal');
        expect(AsyncStorage.setItem).not.toHaveBeenCalledWith('library_shelfOrder:v1:reader-1', expect.anything());
        screen.unmount(); screen.queryClient.clear();
    });
    it('restores Horizontal preference, routes real IDs, filters the same data, and keeps the selector out of List', async () => {
        (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => Promise.resolve(key === 'library_viewMode' ? 'shelf' : key === 'library_shelfStyle:v1' ? 'horizontal' : null));
        (booksService.getUserLibrary as jest.Mock).mockResolvedValue([
            { id: 'actual-id', ownership: 'owned', reading_status: 'reading', book: { title: 'Equal title' } },
            { id: 'wanted-id', ownership: 'wishlist', reading_status: 'want_to_read', book: { title: 'Equal title' } },
        ]);
        const screen = renderLibraryScreen();
        await waitFor(() => expect(screen.getByTestId('library-horizontal-shelf')).toBeTruthy());
        fireEvent.press(screen.getByTestId('library-horizontal-book-actual-id'));
        expect(require('expo-router').router.push).toHaveBeenCalledWith('/(tabs)/library/actual-id');
        fireEvent.press(screen.getByLabelText('Wishlist, 1 book'));
        expect(screen.queryByTestId('library-horizontal-book-actual-id')).toBeNull();
        expect(screen.getByTestId('library-horizontal-book-wanted-id')).toBeTruthy();
        fireEvent.press(screen.getByTestId('library-view-list'));
        expect(screen.queryByTestId('library-shelf-style-control')).toBeNull();
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('library_viewMode', 'list');
        screen.unmount(); screen.queryClient.clear();
    });
    it.each(['unknown', 'read-error'])('falls back to Vertical for %s style preference', async (value) => {
        (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => key === 'library_shelfStyle:v1' && value === 'read-error'
            ? Promise.reject(new Error('storage unavailable')) : Promise.resolve(key === 'library_viewMode' ? 'shelf' : value));
        (booksService.getUserLibrary as jest.Mock).mockResolvedValue([]);
        const screen = renderLibraryScreen();
        await waitFor(() => expect(screen.getByTestId('library-shelf')).toBeTruthy());
        expect(screen.queryByTestId('library-horizontal-shelf')).toBeNull();
        screen.unmount(); screen.queryClient.clear();
    });
    it('does not let a late saved style overwrite an explicit selection', async () => {
        let finishRead!: (value: string) => void;
        (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => key === 'library_shelfStyle:v1'
            ? new Promise<string>((resolve) => { finishRead = resolve; }) : Promise.resolve(key === 'library_viewMode' ? 'shelf' : null));
        (booksService.getUserLibrary as jest.Mock).mockResolvedValue([]);
        const screen = renderLibraryScreen();
        await waitFor(() => expect(screen.getByTestId('library-shelf')).toBeTruthy());
        fireEvent.press(screen.getByTestId('library-shelf-style-horizontal'));
        await act(async () => { finishRead('vertical'); });
        expect(screen.getByTestId('library-horizontal-shelf')).toBeTruthy();
        screen.unmount(); screen.queryClient.clear();
    });
    it('renders separate overflow tracks with fixed planks outside them and no duplicate IDs', () => {
        const books = Array.from({ length: 17 }, (_, index) => ({ id: `pile-${index}`, ownership: 'owned', reading_status: 'want_to_read', book: { title: 'Pile book' } }));
        const screen = renderWithLibraryProviders(<LibraryHorizontalShelf books={books} onBookPress={jest.fn()} />);
        fireEvent(screen.getByTestId('library-horizontal-shelf'), 'layout', { nativeEvent: { layout: { width: 342 } } });
        const upper = screen.getByTestId('library-horizontal-scroll-top');
        const lower = screen.getByTestId('library-horizontal-scroll-bottom');
        expect(upper.props.showsHorizontalScrollIndicator).toBe(false);
        expect(lower.props.showsHorizontalScrollIndicator).toBe(false);
        expect(upper.props.contentContainerStyle.width).toBeGreaterThan(lower.props.contentContainerStyle.width);
        expect(screen.getAllByTestId(/^library-horizontal-book-/)).toHaveLength(17);
        for (const row of ['top', 'bottom']) {
            let node = screen.getByTestId(`library-horizontal-plank-${row}`).parent;
            while (node) {
                expect(node.props.testID).not.toBe(`library-horizontal-scroll-${row}`);
                node = node.parent;
            }
        }
    });
});

describe('LibraryShelf single shelf SDD-04', () => {
    beforeEach(() => jest.clearAllMocks());

    it('renders classic upright text spines and opens the selected entry', () => {
        const books = [
            { id: 'ub-1', reading_status: 'reading', ownership: 'owned', book: { title: 'Atomic Habits', authors: ['James Clear'], cover_url: 'https://example.com/cover.jpg', page_count: 100 } },
            { id: 'ub-2', reading_status: 'reading', ownership: 'owned', book: { title: 'Sapiens', authors: ['Yuval Harari'], cover_url: null, page_count: 500 } },
        ];
        const onPress = jest.fn();
        const { getByTestId, getByText } = render(<LibraryShelf books={books as any} onBookPress={onPress} />);
        expect(getByTestId('library-shelf')).toBeTruthy();
        expect(getByTestId('library-shelf-scroll')).toBeTruthy();
        expect(getByText('Atomic Habits')).toBeTruthy();
        expect(getByText('Sapiens')).toBeTruthy();
        expect(StyleSheet.flatten(getByTestId('library-shelf-spine-ub-1').props.style).width).toBe(24);
        expect(StyleSheet.flatten(getByTestId('library-shelf-spine-ub-2').props.style).width).toBe(40);
        // spine has accessible label Open <title>
        fireEvent.press(getByTestId('library-shelf-spine-ub-1'));
        expect(onPress).toHaveBeenCalledWith(books[0]);
        // shelf-gradient walnut-deep via LinearGradient mocked but shelf container exists
        expect(getByTestId('library-shelf')).toBeTruthy();
    });

    it('shows the full book title and available author while pressed, then preserves book routing', () => {
        const title = 'Sand Dune Stabilization, Shelterbelts and Afforestation in Dry Zones';
        const book = { id: 'caption-book', reading_status: 'reading', ownership: 'owned', book: { title, authors: ['A. Reader', 'B. Scholar'] } };
        const onPress = jest.fn();
        const { getByTestId, queryByTestId } = render(<LibraryShelf books={[book]} onBookPress={onPress} />);
        const spine = getByTestId('library-shelf-spine-caption-book');
        const caption = () => getByTestId('library-active-book-caption-title');

        expect(queryByTestId('library-active-book-caption')).toBeNull();
        fireEvent(spine, 'pressIn');
        expect(caption().props.children).toBe(title);
        expect(caption().props.numberOfLines).toBeUndefined();
        expect(getByTestId('library-active-book-caption-author').props.children).toBe('A. Reader, B. Scholar');
        expect(onPress).not.toHaveBeenCalled();
        fireEvent(spine, 'pressOut');
        expect(queryByTestId('library-active-book-caption')).toBeNull();

        fireEvent.press(spine);
        expect(onPress).toHaveBeenCalledWith(book);
    });

    it('omits the author caption when the saved entry has no authors', () => {
        const book = { id: 'caption-no-author', reading_status: 'reading', ownership: 'owned', book: { title: 'Unknown Author', authors: null } };
        const { getByTestId, queryByTestId } = render(<LibraryShelf books={[book]} onBookPress={jest.fn()} />);
        fireEvent(getByTestId('library-shelf-spine-caption-no-author'), 'pressIn');
        expect(getByTestId('library-active-book-caption-title').props.children).toBe('Unknown Author');
        expect(queryByTestId('library-active-book-caption-author')).toBeNull();
    });

    it('keeps the label region opaque and removes competing expanded spine hit regions', () => {
        const book = { id: 'contrast1', reading_status: 'reading', ownership: 'owned', book: { title: 'Ikigai', page_count: 63 } };
        const { getByTestId, getByText } = render(<LibraryShelf books={[book]} onBookPress={jest.fn()} />);
        expect(getByTestId('library-shelf-spine-contrast1').props.hitSlop).toBeUndefined();
        const label = getByText('Ikigai');
        expect(StyleSheet.flatten(label.props.style).opacity ?? 1).toBe(1);
        expect(StyleSheet.flatten(getByTestId('library-shelf-label-contrast1').props.style).backgroundColor).toBe('#bd7a42');
        expect(getByTestId('library-shelf-spine-ridge-upper-contrast1', { includeHiddenElements: true })).toBeTruthy();
    });

    it('offers non-overlapping title buttons for the same filtered books without changing presentation', async () => {
        const wanted = { id: 'wanted', reading_status: 'reading', ownership: 'wishlist', book: { title: 'Wanted title', authors: ['A'] } };
        (booksService.getUserLibrary as jest.Mock).mockResolvedValueOnce([
            wanted, { id: 'owned', reading_status: 'completed', ownership: 'owned', book: { title: 'Owned title' } },
        ]);
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('shelf');
        const { getByTestId, getByLabelText, queryByTestId, queryClient, unmount } = renderLibraryScreen();
        await waitFor(() => expect(getByTestId('library-shelf')).toBeTruthy());
        fireEvent.press(getByLabelText('Wishlist, 1 book'));
        fireEvent.press(getByTestId('library-book-picker-open'));
        const choice = getByTestId('library-book-picker-entry-wanted');
        expect(StyleSheet.flatten(choice.props.style).minHeight).toBeGreaterThanOrEqual(44);
        expect(queryByTestId('library-book-picker-entry-owned')).toBeNull();
        fireEvent.press(choice);
        expect(require('expo-router').router.push).toHaveBeenCalledWith('/(tabs)/library/wanted');
        expect(queryByTestId('library-book-picker-entry-wanted')).toBeNull();
        expect(getByTestId('library-shelf')).toBeTruthy();
        unmount();
        queryClient.clear();
    });

    it('toggles shelf/list and persists viewMode to AsyncStorage default list', async () => {
        (booksService.getUserLibrary as jest.Mock).mockResolvedValueOnce([
            { id: 'ub-1', reading_status: 'reading', ownership: 'owned', book: { title: 'Vault Book', authors: ['A'], cover_url: null } },
        ]);
        // first load returns null -> default list
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

        const { getByTestId, getByText, getAllByText, queryByTestId, queryClient, unmount } = renderLibraryScreen();
        await waitFor(() => expect(getByText('Vault Book')).toBeOnTheScreen());
        // default list shows LibraryBookRow, not shelf
        expect(queryByTestId('library-shelf')).toBeNull();

        // Explicit labeled choices keep the current presentation visible.
        const shelfChoice = getByTestId('library-view-shelf');
        const listChoice = getByTestId('library-view-list');
        expect(listChoice.props.accessibilityState).toEqual(expect.objectContaining({ selected: true, disabled: false }));
        fireEvent.press(shelfChoice);
        await waitFor(() => expect(getByTestId('library-shelf')).toBeTruthy());
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('library_viewMode', 'shelf');
        expect(getByTestId('library-view-shelf').props.accessibilityState).toEqual(expect.objectContaining({ selected: true, disabled: false }));
        const savedCalls = (AsyncStorage.setItem as jest.Mock).mock.calls.length;
        fireEvent.press(getByTestId('library-view-shelf'));
        expect(AsyncStorage.setItem).toHaveBeenCalledTimes(savedCalls);
        expect(getByText('Add a book')).toBeTruthy();
        expect(getAllByText('Vault Book').length).toBeGreaterThanOrEqual(1); // shelf spine + bento current read

        // toggle back to list
        fireEvent.press(getByTestId('library-view-list'));
        await waitFor(() => expect(queryByTestId('library-shelf')).toBeNull());
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('library_viewMode', 'list');

        unmount();
        queryClient.clear();
    });

    it('arranges the whole collection by entry ID, with one-step Undo, Cancel and explicit Save', async () => {
        const entries = ['a', 'b', 'c'].map((id) => ({
            id, ownership: id === 'c' ? 'wishlist' : 'owned', reading_status: 'to_read',
            book: { title: 'Same title', authors: ['An Author'] },
        }));
        (booksService.getUserLibrary as jest.Mock).mockResolvedValueOnce(entries);
        (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => Promise.resolve(key === 'library_viewMode' ? 'shelf' : null));
        const { getByTestId, getByLabelText, getAllByTestId, queryClient, unmount } = renderLibraryScreen();
        const order = () => getAllByTestId(/^library-shelf-spine-/).map((spine) => spine.props.testID.replace('library-shelf-spine-', ''));
        await waitFor(() => expect(getByTestId('library-arrange-arrange-shelf')).toBeEnabled());
        fireEvent.press(getByLabelText('Wishlist, 1 book'));
        expect(order()).toEqual(['c']);
        fireEvent.press(getByTestId('library-arrange-arrange-shelf'));
        expect(order()).toEqual(['a', 'b', 'c']);
        expect(getByTestId('library-view-list')).toBeDisabled();
        expect(getByLabelText('Wishlist, 1 book')).toBeDisabled();
        expect(getByLabelText('Add a book')).toBeDisabled();
        expect(getByTestId('library-arrange-undo')).toBeDisabled();
        fireEvent.press(getByTestId('library-book-picker-open'));
        expect(getByTestId('library-book-picker-entry-c').props.accessibilityLabel).toBe('Select Same title by An Author');
        fireEvent.press(getByTestId('library-book-picker-entry-c'));
        expect(require('expo-router').router.push).not.toHaveBeenCalled();
        fireEvent.press(getByTestId('library-arrange-earlier'));
        expect(order()).toEqual(['a', 'c', 'b']);
        fireEvent.press(getByTestId('library-arrange-undo'));
        expect(order()).toEqual(['a', 'b', 'c']);
        expect(getByTestId('library-arrange-undo')).toBeDisabled();
        fireEvent.press(getByTestId('library-arrange-earlier'));
        fireEvent.press(getByTestId('library-arrange-cancel'));
        expect(order()).toEqual(['a', 'b', 'c']);
        expect(AsyncStorage.setItem).not.toHaveBeenCalled();
        fireEvent.press(getByTestId('library-arrange-arrange-shelf'));
        fireEvent.press(getByTestId('library-shelf-spine-c'));
        fireEvent.press(getByTestId('library-arrange-earlier'));
        fireEvent.press(getByTestId('library-arrange-save'));
        await waitFor(() => expect(getByTestId('library-arrange-arrange-shelf')).toBeTruthy());
        expect(order()).toEqual(['a', 'c', 'b']);
        expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('library_shelfOrder:v2:reader-1',
            JSON.stringify({ version: 2, ids: ['a', 'c', 'b'], tiers: { top: ['a', 'b'], bottom: ['c'] } }));
        expect(getByTestId('library-view-list')).toBeEnabled();
        unmount();
        queryClient.clear();
        (AsyncStorage.getItem as jest.Mock).mockImplementation(() => Promise.resolve(null));
    });

    it('keeps filters and the actual filtered count before the collection in both modes', async () => {
        (booksService.getUserLibrary as jest.Mock).mockResolvedValueOnce([
            { id: 'ub-1', reading_status: 'completed', ownership: 'owned', book: { title: 'Control Book', authors: ['A'], cover_url: null } },
        ]);
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('shelf');
        const { getByTestId, getByLabelText, getByText, toJSON, queryClient, unmount } = renderLibraryScreen();
        await waitFor(() => expect(getByTestId('library-shelf')).toBeTruthy());
        const controls = getByTestId('library-collection-controls');
        expect(controls.findByProps({ accessibilityLabel: 'Wishlist, 0 books' })).toBeTruthy();
        expect(getByText('1 book')).toBeTruthy();
        const order: string[] = [];
        const visit = (node: any) => {
            if (!node || typeof node !== 'object') return;
            if (Array.isArray(node)) { node.forEach(visit); return; }
            if (node.props?.testID) order.push(node.props.testID);
            node.children?.forEach(visit);
        };
        visit(toJSON());
        expect(order.indexOf('library-collection-controls')).toBeLessThan(order.indexOf('library-shelf'));
        fireEvent.press(getByLabelText('Add a book'));
        expect(require('expo-router').router.push).toHaveBeenCalledWith('/(tabs)/library/search');
        fireEvent.press(getByTestId('library-view-list'));
        expect(getByTestId('library-collection-controls')).toBeTruthy();
        expect(getByText('1 book')).toBeTruthy();
        unmount();
        queryClient.clear();
    });

    it('retains the 440px cabinet with a slimmer middle board and both book rows grounded on their boards', () => {
        const { getByTestId } = render(<LibraryShelf books={[]} onBookPress={jest.fn()} />);
        const grain = getByTestId('library-shelf-wood-grain', { includeHiddenElements: true });
        expect(grain.props.source.uri).toMatch(/^data:image\/svg\+xml/);
        expect(grain.props.accessible).toBe(false);
        expect(grain.props.pointerEvents).toBe('none');
        expect(StyleSheet.flatten(getByTestId('library-shelf-frame').props.style).height).toBe(440);
        expect(getByTestId('library-shelf-top-cap')).toBeTruthy();
        const innerBoard = StyleSheet.flatten(getByTestId('library-shelf-inner-ledge').props.style);
        const bottomBoard = StyleSheet.flatten(getByTestId('library-shelf-bottom-ledge').props.style);
        const topRow = StyleSheet.flatten(getByTestId('library-shelf-row-top').props.style);
        const bottomRow = StyleSheet.flatten(getByTestId('library-shelf-row-bottom').props.style);
        expect(innerBoard.height).toBe(18);
        expect(topRow.top + topRow.height).toBe(innerBoard.top);
        expect(bottomRow.top + bottomRow.height).toBe(bottomBoard.top);
        expect(innerBoard.top + innerBoard.height).toBe(bottomRow.top);
        expect(bottomBoard.top + bottomBoard.height).toBe(440);
    });

    it('renders every spine during the shelf entrance', async () => {
        const books = [
            { id: 'ub-1', reading_status: 'reading', ownership: 'owned', book: { title: 'Book One', authors: ['A'], cover_url: null } },
            { id: 'ub-2', reading_status: 'reading', ownership: 'owned', book: { title: 'Book Two', authors: ['B'], cover_url: null } },
            { id: 'ub-3', reading_status: 'reading', ownership: 'owned', book: { title: 'Book Three', authors: ['C'], cover_url: null } },
        ];
        const { getByTestId } = render(<LibraryShelf books={books as any} onBookPress={jest.fn()} />);
        // Shelf container retains its entrance translation — mocked via withTiming.
        expect(getByTestId('library-shelf')).toBeTruthy();
        // Upright neutral spines remain present throughout the entrance.
        expect(getByTestId('library-shelf-spine-ub-1')).toBeTruthy();
        expect(getByTestId('library-shelf-spine-ub-2')).toBeTruthy();
        expect(getByTestId('library-shelf-spine-ub-3')).toBeTruthy();
        // Reanimated withSpring/withTiming mocked to immediate, so no throw and shelf visible
        await waitFor(() => expect(getByTestId('library-shelf-scroll')).toBeTruthy());
    });

    it.each([0, 0.5, 0.75, 1])('keeps the shelf fully opaque at entrance progress %s', (progress) => {
        const reanimated = require('react-native-reanimated');
        const originalTiming = reanimated.withTiming.getMockImplementation();
        reanimated.withTiming.mockImplementation((target: number, config?: { duration?: number }) =>
            config?.duration === 800 ? (target === 1 ? progress : 20 * (1 - progress)) : target);
        try {
            const books = [{ id: 'dune', reading_status: 'reading', ownership: 'owned', book: { title: 'The Science of Dune' } }];
            const { getByTestId } = render(<LibraryShelf books={books as any} onBookPress={jest.fn()} />);
            // Read the captured style after effects update the paused shared values.
            const entranceStyle = reanimated.useAnimatedStyle.mock.calls[0][0]();
            expect(entranceStyle.opacity ?? 1).toBe(1);
            expect(entranceStyle.transform).toEqual([{ translateY: 20 * (1 - progress) }]);
            expect(StyleSheet.flatten(getByTestId('library-shelf-label-dune').props.style).opacity ?? 1).toBe(1);
        } finally {
            reanimated.withTiming.mockImplementation(originalTiming);
        }
    });

    it('starts fully opaque and stationary with reduced motion', () => {
        const reanimated = require('react-native-reanimated');
        reanimated.useReducedMotion.mockReturnValueOnce(true);
        const { getByTestId } = render(<LibraryShelf books={[]} onBookPress={jest.fn()} />);
        const firstFrameStyle = StyleSheet.flatten(getByTestId('library-shelf').props.style);
        expect(firstFrameStyle.opacity ?? 1).toBe(1);
        expect(firstFrameStyle.transform).toEqual([{ translateY: 0 }]);
        expect(reanimated.withTiming).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ duration: 800 }));
    });

    it('plays tak 80ms wood and Haptics Light on spine press with debounce 100ms', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-10-21T12:00:00Z'));
        const originalUseRef = React.useRef;
        let audioRef: React.RefObject<any> | undefined;
        const refSpy = jest.spyOn(React, 'useRef').mockImplementationOnce(() => {
            const ref = originalUseRef(null);
            audioRef = ref;
            return ref;
        });
        try {
            const Haptics = require('expo-haptics');
            const audio = require('expo-audio');
            const books = [{ id: 'ub-1', reading_status: 'reading', ownership: 'owned', book: { title: 'Tap Book', authors: ['A'], cover_url: null } }];
            const onPress = jest.fn();
            const ui = render(<LibraryShelf books={books} onBookPress={onPress} />);
            refSpy.mockRestore();
            const flush = async () => { await act(async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); }); };
            await flush();
            // Jest cannot execute the native dynamic import; seed the loaded-player ref.
            const player = audio.createAudioPlayer();
            expect(audioRef).toBeDefined();
            audioRef!.current = player;
            const spine = ui.getByTestId('library-shelf-spine-ub-1');
            expect(player.play).toHaveBeenCalledTimes(0);
            expect(Haptics.impactAsync).toHaveBeenCalledTimes(0);
            fireEvent(spine, 'pressIn'); await flush();
            expect(player.seekTo).toHaveBeenLastCalledWith(0);
            expect(player.play).toHaveBeenCalledTimes(1);
            expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
            expect(Haptics.impactAsync).toHaveBeenLastCalledWith(Haptics.ImpactFeedbackStyle.Light);
            fireEvent(spine, 'pressOut');
            act(() => jest.advanceTimersByTime(50));
            fireEvent(spine, 'pressIn'); await flush();
            // Only audio is debounced; BookSpine fires Light haptics on every press-in.
            expect(player.play).toHaveBeenCalledTimes(1);
            expect(player.seekTo).toHaveBeenCalledTimes(1);
            expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);
            fireEvent(spine, 'pressOut');
            act(() => jest.advanceTimersByTime(50));
            fireEvent(spine, 'pressIn'); await flush();
            expect(player.play).toHaveBeenCalledTimes(2);
            expect(player.seekTo).toHaveBeenCalledTimes(2);
            expect(Haptics.impactAsync.mock.calls).toEqual([['Light'], ['Light'], ['Light']]);
            fireEvent.press(spine);
            expect(onPress).toHaveBeenCalledTimes(1);
            expect(onPress).toHaveBeenCalledWith(books[0]);
            ui.unmount();
        } finally { refSpy.mockRestore(); jest.useRealTimers(); }
    });

    describe('F2 pull-out press contract (SDD-05 §3)', () => {
        const oneBook = [
            { id: 'ub-1', reading_status: 'reading', ownership: 'owned', book: { title: 'Pull Book', authors: ['A'], cover_url: null } },
        ];

        it('pressIn drives scale 1.15, translateY −18, rotateY 6° over 220ms', async () => {
            const reanimated = require('react-native-reanimated');
            const onPress = jest.fn();
            const { getByTestId } = render(<LibraryShelf books={oneBook as any} onBookPress={onPress} />);
            fireEvent(getByTestId('library-shelf-spine-ub-1'), 'pressIn');
            expect(reanimated.withTiming).toHaveBeenCalledWith(1.15, expect.objectContaining({ duration: 220 }));
            expect(reanimated.withTiming).toHaveBeenCalledWith(-18, expect.objectContaining({ duration: 220 }));
            expect(reanimated.withTiming).toHaveBeenCalledWith(6, expect.objectContaining({ duration: 220 }));
        });

        it('routes only on release — pressIn alone never calls onBookPress', () => {
            const onPress = jest.fn();
            const { getByTestId } = render(<LibraryShelf books={oneBook as any} onBookPress={onPress} />);
            const spine = getByTestId('library-shelf-spine-ub-1');
            fireEvent(spine, 'pressIn');
            expect(onPress).not.toHaveBeenCalled();
            fireEvent.press(spine);
            expect(onPress).toHaveBeenCalledTimes(1);
        });

        it('reduced motion: pressIn applies no transform targets but release still routes', () => {
            const reanimated = require('react-native-reanimated');
            (reanimated.useReducedMotion as jest.Mock).mockReturnValueOnce(true);
            const onPress = jest.fn();
            const { getByTestId } = render(<LibraryShelf books={oneBook as any} onBookPress={onPress} />);
            const spine = getByTestId('library-shelf-spine-ub-1');
            fireEvent(spine, 'pressIn');
            expect(reanimated.withTiming).not.toHaveBeenCalledWith(1.15, expect.anything());
            expect(reanimated.withTiming).not.toHaveBeenCalledWith(-18, expect.anything());
            expect(reanimated.withTiming).not.toHaveBeenCalledWith(6, expect.anything());
            fireEvent.press(spine);
            expect(onPress).toHaveBeenCalledTimes(1);
        });
    });

    it('uses actual Home counts and keeps Current Read routed to its entry after Wishlist filtering', async () => {
        const entries = [
            { id: 'reading-entry', reading_status: 'reading', ownership: 'owned', book: { title: 'Actual Reading Book', authors: ['Reader Author'], cover_url: null } },
            { id: 'wishlist-entry', reading_status: 'want_to_read', ownership: 'wishlist', book: { title: 'Wanted Book', authors: null, cover_url: null } },
        ];
        (booksService.getUserLibrary as jest.Mock).mockResolvedValueOnce(entries);
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('shelf');
        // SDD-09 H-12: the Current Read display is the shared ContinueReadingCard
        // (gateway-driven), not the bento prop, so this test feeds the new source.
        const { readingHistoryGateway } = require('@/features/books/history/readingHistoryGateway');
        const openReadsSpy = jest.spyOn(readingHistoryGateway, 'openReadsWithProgress').mockResolvedValue([
            {
                read: {
                    id: 'read-1', user_book_id: 'reading-entry', user_id: 'reader-1', read_number: 1,
                    outcome: 'reading', started_at: '2026-10-01T10:00:00.000Z', ended_at: null,
                    started_on: null, ended_on: null, start_unknown: false, end_unknown: false,
                    total_pages: 320, counts_in_stats: true, created_at: '2026-10-01T10:00:00.000Z',
                    updated_at: '2026-10-20T10:00:00.000Z',
                },
                bookTitle: 'Actual Reading Book',
                latestProgress: null,
            },
        ]);
        try {
            const { getByLabelText, getByTestId, getByText, queryByText, queryByTestId, queryClient, unmount } = renderLibraryScreen();
            await waitFor(() => expect(getByTestId('library-shelf-spine-reading-entry')).toBeTruthy());
            expect(getByText('In your library')).toBeTruthy();
            expect(getByLabelText('All, 2 books')).toBeTruthy();
            expect(getByLabelText('Show wishlist, 1 books')).toBeTruthy();
            expect(queryByText('New Notes')).toBeNull();
            expect(queryByText('65%')).toBeNull();
            expect(queryByText('148')).toBeNull();
            fireEvent.press(getByLabelText('Show wishlist, 1 books'));
            expect(getByTestId('library-shelf-spine-wishlist-entry')).toBeTruthy();
            expect(queryByTestId('library-shelf-spine-reading-entry')).toBeNull();
            fireEvent.press(getByLabelText('Continue reading Actual Reading Book'));
            expect(require('expo-router').router.push).toHaveBeenCalledWith('/(tabs)/library/reading-entry');
            unmount();
            queryClient.clear();
        } finally {
            openReadsSpy.mockRestore();
        }
    });

    describe('F2 [bookId] route transition (SDD-05 §3)', () => {
        it('uses fade for [bookId]; index/search keep slide_from_right; notes family opts out of animation', () => {
            const routerModule = require('expo-router');
            const LibraryLayout = require('../../../../app/(tabs)/library/_layout').default;
            routerModule.__mockCapturedScreens.length = 0;
            render(<LibraryLayout />);
            const captured = routerModule.__mockCapturedScreens as Array<{ name: string; options?: any }>;
            const bookIdScreen = captured.find((s) => s.name === '[bookId]');
            expect(bookIdScreen).toBeDefined();
            expect(bookIdScreen!.options).toEqual({ animation: 'fade' });
            for (const name of ['index', 'search']) {
                const sibling = captured.find((s) => s.name === name);
                expect(sibling).toBeDefined();
                expect(sibling!.options).toBeUndefined();
            }
            // SDD-06 notes collection, reader and composer swap in place; the composer also blocks swipe-dismiss.
            expect(captured.find((s) => s.name === 'notes')!.options).toEqual({ animation: 'none' });
            expect(captured.find((s) => s.name === 'note')!.options).toEqual({ animation: 'none' });
            expect(captured.find((s) => s.name === 'note-compose')!.options).toEqual({ gestureEnabled: false, animation: 'none' });
        });
    });

    describe('SDD-05 §3.1 continuation', () => {
        const fiveBooks = ['v1', 'v2', 'v3', 'v4', 'v5'].map((id) => ({
            id,
            reading_status: 'reading',
            ownership: 'owned',
            book: { title: `Row Book ${id}`, authors: ['A'], cover_url: null },
        }));

        it('C1: renders two boards with inner ledge and all spines across rows', () => {
            const { getByTestId } = render(<LibraryShelf books={fiveBooks as any} onBookPress={jest.fn()} />);
            expect(getByTestId('library-shelf-inner-ledge')).toBeTruthy();
            expect(getByTestId('library-shelf-bookend-top', { includeHiddenElements: true })).toBeTruthy();
            expect(getByTestId('library-shelf-bookend-bottom', { includeHiddenElements: true })).toBeTruthy();
            for (const id of ['v1', 'v2', 'v3', 'v4', 'v5']) {
                expect(getByTestId(`library-shelf-spine-${id}`)).toBeTruthy();
            }
        });

        it('C1: single book still renders inner ledge with empty bottom row', () => {
            const one = [fiveBooks[0]];
            const { getByTestId, queryByTestId } = render(<LibraryShelf books={one as any} onBookPress={jest.fn()} />);
            expect(getByTestId('library-shelf-inner-ledge')).toBeTruthy();
            expect(getByTestId('library-shelf-spine-v1')).toBeTruthy();
            expect(getByTestId('library-shelf-bookend-top', { includeHiddenElements: true })).toBeTruthy();
            expect(queryByTestId('library-shelf-bookend-bottom', { includeHiddenElements: true })).toBeNull();
        });

        it('C2: classic text spines — spine cover pipeline is never invoked', () => {
            const covers = require('@/features/books/services/booksService');
            const withCover = [{ ...fiveBooks[0], book: { ...fiveBooks[0].book, cover_url: 'https://example.com/x.jpg' } }];
            render(<LibraryShelf books={withCover as any} onBookPress={jest.fn()} />);
            expect(covers.getHighResCoverUrl).not.toHaveBeenCalled();
        });
    });
});
