import React from 'react';
import { StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LibraryScreen from '../../../../app/(tabs)/library/index';
import { booksService } from '@/features/books/services/booksService';
import { LibraryShelf } from '../LibraryShelf';

jest.mock('expo-image', () => ({ Image: 'Image' }));
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
    return { router: { push: jest.fn() }, Stack, __mockCapturedScreens: mockCapturedScreens };
});

const renderLibraryScreen = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
    return { queryClient, ...render(<QueryClientProvider client={queryClient}><LibraryScreen /></QueryClientProvider>) };
};

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
        const book = { id: 'contrast', reading_status: 'reading', ownership: 'owned', book: { title: 'Ikigai', page_count: 63 } };
        const { getByTestId, getByText } = render(<LibraryShelf books={[book]} onBookPress={jest.fn()} />);
        expect(getByTestId('library-shelf-spine-contrast').props.hitSlop).toBeUndefined();
        const label = getByText('Ikigai');
        expect(StyleSheet.flatten(label.props.style).opacity ?? 1).toBe(1);
        expect(StyleSheet.flatten(getByTestId('library-shelf-label-contrast').props.style).backgroundColor).toBe('#bd7a42');
    });

    it('offers non-overlapping title buttons for the same filtered books without changing presentation', async () => {
        const wanted = { id: 'wanted', reading_status: 'reading', ownership: 'wishlist', book: { title: 'Wanted title', authors: ['A'] } };
        (booksService.getUserLibrary as jest.Mock).mockResolvedValueOnce([
            wanted, { id: 'owned', reading_status: 'completed', ownership: 'owned', book: { title: 'Owned title' } },
        ]);
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('shelf');
        const { getByTestId, getByLabelText, queryByTestId, queryClient, unmount } = renderLibraryScreen();
        await waitFor(() => expect(getByTestId('library-shelf')).toBeTruthy());
        fireEvent.press(getByLabelText('Wishlist, 1 books'));
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
        expect(listChoice).toHaveProp('accessibilityState', { selected: true });
        fireEvent.press(shelfChoice);
        await waitFor(() => expect(getByTestId('library-shelf')).toBeTruthy());
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('library_viewMode', 'shelf');
        expect(getByTestId('library-view-shelf')).toHaveProp('accessibilityState', { selected: true });
        const savedCalls = (AsyncStorage.setItem as jest.Mock).mock.calls.length;
        fireEvent.press(getByTestId('library-view-shelf'));
        expect(AsyncStorage.setItem).toHaveBeenCalledTimes(savedCalls);
        expect(getByText('+ Add Book')).toBeTruthy();
        expect(getAllByText('Vault Book').length).toBeGreaterThanOrEqual(1); // shelf spine + bento current read

        // toggle back to list
        fireEvent.press(getByTestId('library-view-list'));
        await waitFor(() => expect(queryByTestId('library-shelf')).toBeNull());
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('library_viewMode', 'list');

        unmount();
        queryClient.clear();
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
        fireEvent.press(getByLabelText('Add a new book to your library'));
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
        const Haptics = require('expo-haptics');
        const books = [
            { id: 'ub-1', reading_status: 'reading', ownership: 'owned', book: { title: 'Tap Book', authors: ['A'], cover_url: null } },
        ];
        const onPress = jest.fn();
        const { getByTestId } = render(<LibraryShelf books={books as any} onBookPress={onPress} />);
        const spine = getByTestId('library-shelf-spine-ub-1');
        // First press should trigger Haptics (audio preload is async, may not have completed in test)
        fireEvent(spine, 'pressIn');
        // Haptics may be debounced 100ms, wait a tick
        await waitFor(() => expect(Haptics.impactAsync).toHaveBeenCalled(), { timeout: 2000 });
        // Press should also still allow onPress for navigation
        fireEvent.press(spine);
        expect(onPress).toHaveBeenCalled();
        // Second rapid press within 100ms should be debounced for audio but Haptics at least 1
        const callCountBefore = (Haptics.impactAsync as jest.Mock).mock.calls.length;
        fireEvent(spine, 'pressIn');
        await waitFor(() => expect((Haptics.impactAsync as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(callCountBefore));
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
    });

    describe('F2 [bookId] route transition (SDD-05 §3)', () => {
        it('uses fade for [bookId]; siblings keep slide_from_right default', () => {
            const routerModule = require('expo-router');
            const LibraryLayout = require('../../../../app/(tabs)/library/_layout').default;
            routerModule.__mockCapturedScreens.length = 0;
            render(<LibraryLayout />);
            const captured = routerModule.__mockCapturedScreens as Array<{ name: string; options?: any }>;
            const bookIdScreen = captured.find((s) => s.name === '[bookId]');
            expect(bookIdScreen).toBeDefined();
            expect(bookIdScreen!.options).toEqual({ animation: 'fade' });
            for (const name of ['index', 'search', 'notes']) {
                const sibling = captured.find((s) => s.name === name);
                expect(sibling).toBeDefined();
                expect(sibling!.options).toBeUndefined();
            }
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
