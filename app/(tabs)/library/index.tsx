import { View, StyleSheet, ScrollView, Text, Platform } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLibraryBooks } from '@/features/books/hooks/useLibraryBooks';
import { useShelfArrangement } from '@/features/books/hooks/useShelfArrangement';
import { LibraryArrangeControls } from '@/components/library/LibraryArrangeControls';
import { LibraryHorizontalShelf } from '@/components/library/LibraryHorizontalShelf';
import { LibraryShelfStyleControl, LibraryShelfStyle, LIBRARY_SHELF_STYLE_KEY } from '@/components/library/LibraryShelfStyleControl';
import {
    filterLibraryBooks,
    getLibraryFilterChips,
    getLibraryFilterLabel,
    LibraryBookEntry,
    LibraryFilter,
} from '@/features/books/utils/libraryShelf';
import {
    LibraryBentoGrid,
    LibraryBookList,
    LibraryErrorState,
    LibraryFilterBar,
    LibraryHeader,
    LibraryLoadingState,
    LibraryShelf,
    LibrarySummary,
} from '@/components/library';
import { LIBRARY_SPACING, useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import { BookButton } from '@/components/library/ui';
import { COLUMN_MAX_WIDTH } from '@/components/library/bookDetails/bookDetailsTokens';
import { classifyBookLoadError } from '@/components/library/bookDetails/classifyBookLoadError';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

const LIBRARY_VIEW_MODE_KEY = 'library_viewMode';
export type LibraryViewMode = 'shelf' | 'list';

function LibraryPageBackground({ children }: { children: ReactNode }) {
    const colors = useLibraryAppearance();
    return <View testID="library-page" style={[styles.page, { backgroundColor: colors.bgPrimary }]}>{children}</View>;
}

export default function LibraryScreen() {
    // FU-2: fonts come from app/(tabs)/library/_layout.tsx (LibraryTypographyProvider).
    return <LibraryHome />;
}

function LibraryHome() {
    const { session } = useAuth();
    const colors = useLibraryAppearance();
    const { isOffline } = useNetworkStatus();
    const [activeFilter, setActiveFilter] = useState<LibraryFilter>('all');
    const [viewMode, setViewMode] = useState<LibraryViewMode>('list');
    const [shelfStyle, setShelfStyle] = useState<LibraryShelfStyle>('vertical');
    const shelfStyleChanged = useRef(false);
    const [focusSelectedView, setFocusSelectedView] = useState(false);
    const isShelf = viewMode === 'shelf';
    const { data, error, isError, isLoading, isRefetching, refetch } = useLibraryBooks(session?.user?.id);
    const books = useMemo(() => data ?? [], [data]);
    const [shelfDragging, setShelfDragging] = useState(false);

    useEffect(() => {
        let mounted = true;
        void AsyncStorage.getItem(LIBRARY_VIEW_MODE_KEY).then((saved) => {
            if (mounted && (saved === 'shelf' || saved === 'list')) setViewMode(saved);
        }).catch(() => {});
        return () => { mounted = false; };
    }, []);

    const arrangement = useShelfArrangement(session?.user?.id, books);
    useEffect(() => {
        let mounted = true;
        void AsyncStorage.getItem(LIBRARY_SHELF_STYLE_KEY).then((saved) => {
            if (mounted && !shelfStyleChanged.current && (saved === 'vertical' || saved === 'horizontal')) setShelfStyle(saved);
        }).catch(() => {});
        return () => { mounted = false; };
    }, []);
    useFocusEffect(useCallback(() => () => {
        arrangement.cancel();
        setShelfDragging(false);
    }, [arrangement.cancel]));

    const handleViewModeChange = (next: LibraryViewMode) => {
        if (viewMode === next) return;
        setFocusSelectedView(true);
        setViewMode(next);
        void AsyncStorage.setItem(LIBRARY_VIEW_MODE_KEY, next).catch(() => {});
    };
    const filterChips = useMemo(() => getLibraryFilterChips(books), [books]);
    const handleShelfStyleChange = (next: LibraryShelfStyle) => {
        if (arrangement.saving || shelfDragging || shelfStyle === next) return;
        shelfStyleChanged.current = true;
        setShelfStyle(next);
        void AsyncStorage.setItem(LIBRARY_SHELF_STYLE_KEY, next).catch(() => {});
    };
    const collection = isShelf ? arrangement.orderedBooks : books;
    const filteredBooks = useMemo(() => filterLibraryBooks(collection, activeFilter), [activeFilter, collection]);
    const activeFilterLabel = getLibraryFilterLabel(filterChips, activeFilter);
    const currentBook = books.find((book) => book.reading_status === 'reading' && book.ownership !== 'wishlist');
    const wishlistCount = filterChips.find((chip) => chip.key === 'wishlist')?.count ?? 0;
    const openSearch = () => router.push('/(tabs)/library/search');
    const openBook = (item: LibraryBookEntry) => router.push(`/(tabs)/library/${item.id}`);

    if (isLoading) return <LibraryPageBackground><View style={styles.content}>
        <LibraryHeader onAdd={openSearch} viewMode={viewMode} onViewModeChange={handleViewModeChange} viewDisabled />
        <LibraryLoadingState />
    </View></LibraryPageBackground>;
    if (isError && data === undefined) {
        return (
            <LibraryPageBackground>
                <View style={styles.content}>
                    <LibraryHeader viewMode={viewMode} onViewModeChange={handleViewModeChange} />
                    <LibraryErrorState kind={classifyBookLoadError(error, isOffline)} onRetry={refetch} />
                </View>
            </LibraryPageBackground>
        );
    }

    const collectionHeader = (
        <View>
            <LibraryHeader onAdd={openSearch} viewMode={viewMode} onViewModeChange={handleViewModeChange} focusSelectedView={focusSelectedView} disabled={arrangement.active} />
            <View testID="library-collection-controls">
                <LibraryFilterBar chips={filterChips} activeFilter={activeFilter} onChange={setActiveFilter} disabled={arrangement.active} />
                <LibrarySummary count={filteredBooks.length} />
                {isOffline && books.length > 0 && <Text accessibilityLiveRegion="polite"
                    {...(Platform.OS === 'web' ? { 'aria-live': 'polite', role: 'status' } as const : {})}
                    style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>Offline · Showing saved content.</Text>}
                {isError && <View style={styles.refreshNotice}>
                    <Text accessibilityLiveRegion="polite"
                        {...(Platform.OS === 'web' ? { 'aria-live': 'polite', role: 'status' } as const : {})}
                        style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>{"Couldn't refresh."}</Text>
                    <BookButton label="Try again" variant="text" onPress={refetch} />
                </View>}
            </View>
        </View>
    );

    return (
        <LibraryPageBackground>
            {isShelf ? (
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} style={styles.scrollView} scrollEnabled={!shelfDragging}>
                    <View style={styles.content}>
                        {collectionHeader}
                        <LibraryShelfStyleControl value={shelfStyle} onChange={handleShelfStyleChange}
                            disabled={arrangement.saving || shelfDragging} />
                        <LibraryArrangeControls arrangement={arrangement} bookCount={books.length} dragging={shelfDragging}
                            interactionHint={shelfStyle === 'horizontal' ? 'Tap a book, then drag it. Hold near an edge to scroll, or use Earlier and Later.' : undefined}
                            onEnter={() => { setActiveFilter('all'); arrangement.enter(); }} />
                        {shelfStyle === 'horizontal'
                            ? <LibraryHorizontalShelf books={filteredBooks} onBookPress={openBook} arrangement={arrangement} onDraggingChange={setShelfDragging} />
                            : <LibraryShelf books={filteredBooks} onBookPress={openBook} arrangement={arrangement} onDraggingChange={setShelfDragging} />}
                        <LibraryBentoGrid
                            currentBook={currentBook ? { title: currentBook.book.title, author: currentBook.book.authors?.[0] ?? '' } : null}
                            booksCount={books.length} wishlistCount={wishlistCount}
                            onCurrentBookPress={currentBook && !arrangement.active ? () => openBook(currentBook) : undefined}
                            onWishlistPress={arrangement.active ? undefined : () => setActiveFilter('wishlist')}
                        />
                    </View>
                </ScrollView>
            ) : (
                <View style={[styles.content, styles.listViewport]}>
                    <LibraryBookList books={filteredBooks} activeFilter={activeFilter} activeFilterLabel={activeFilterLabel}
                        isRefetching={isRefetching} onRefresh={refetch} onBookPress={openBook} onShowAll={() => setActiveFilter('all')} header={collectionHeader} />
                </View>
            )}
        </LibraryPageBackground>
    );
}

const styles = StyleSheet.create({
    page: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: LIBRARY_SPACING.xl, flexGrow: 1 },
    content: { width: '100%', maxWidth: COLUMN_MAX_WIDTH, alignSelf: 'center', paddingHorizontal: LIBRARY_SPACING.large },
    listViewport: { flex: 1 },
    refreshNotice: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: LIBRARY_SPACING.xs },
});
