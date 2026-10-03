import { View, StyleSheet, ScrollView } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLibraryBooks } from '@/features/books/hooks/useLibraryBooks';
import { useShelfArrangement } from '@/features/books/hooks/useShelfArrangement';
import { LibraryArrangeControls } from '@/components/library/LibraryArrangeControls';
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
import { LibraryTypographyProvider } from '@/components/library/LibraryTypography';
import { LIBRARY_SPACING, useLibraryAppearance } from '@/components/library/LibraryAppearance';

const LIBRARY_VIEW_MODE_KEY = 'library_viewMode';
export type LibraryViewMode = 'shelf' | 'list';

function LibraryPageBackground({ children }: { children: ReactNode }) {
    const colors = useLibraryAppearance();
    return <View testID="library-page" style={[styles.page, { backgroundColor: colors.bgPrimary }]}>{children}</View>;
}

export default function LibraryScreen() {
    return <LibraryTypographyProvider><LibraryHome /></LibraryTypographyProvider>;
}

function LibraryHome() {
    const { session } = useAuth();
    const [activeFilter, setActiveFilter] = useState<LibraryFilter>('all');
    const [viewMode, setViewMode] = useState<LibraryViewMode>('list');
    const [focusSelectedView, setFocusSelectedView] = useState(false);
    const isShelf = viewMode === 'shelf';
    const { data: books = [], error, isError, isLoading, isRefetching, refetch } = useLibraryBooks(session?.user?.id);
    const [shelfDragging, setShelfDragging] = useState(false);

    useEffect(() => {
        let mounted = true;
        void AsyncStorage.getItem(LIBRARY_VIEW_MODE_KEY).then((saved) => {
            if (mounted && (saved === 'shelf' || saved === 'list')) setViewMode(saved);
        }).catch(() => {});
        return () => { mounted = false; };
    }, []);

    const arrangement = useShelfArrangement(session?.user?.id, books);
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
    const collection = isShelf ? arrangement.orderedBooks : books;
    const filteredBooks = useMemo(() => filterLibraryBooks(collection, activeFilter), [activeFilter, collection]);
    const activeFilterLabel = getLibraryFilterLabel(filterChips, activeFilter);
    const currentBook = books.find((book) => book.reading_status === 'reading' && book.ownership !== 'wishlist');
    const wishlistCount = filterChips.find((chip) => chip.key === 'wishlist')?.count ?? 0;
    const openSearch = () => router.push('/(tabs)/library/search');
    const openBook = (item: LibraryBookEntry) => router.push(`/(tabs)/library/${item.id}`);

    if (isLoading) return <LibraryPageBackground><LibraryLoadingState /></LibraryPageBackground>;
    if (isError) {
        const errorMessage = error instanceof Error ? error.message : 'Please try again in a moment.';
        return (
            <LibraryPageBackground>
                <View style={styles.content}>
                    <LibraryHeader showAddButton={false} onSearch={openSearch} viewMode={viewMode} onViewModeChange={handleViewModeChange} />
                    <LibraryErrorState message={errorMessage} onRetry={refetch} />
                </View>
            </LibraryPageBackground>
        );
    }

    const collectionHeader = (
        <View>
            <LibraryHeader onSearch={openSearch} viewMode={viewMode} onViewModeChange={handleViewModeChange} focusSelectedView={focusSelectedView} disabled={arrangement.active} />
            <View testID="library-collection-controls">
                <LibraryFilterBar chips={filterChips} activeFilter={activeFilter} onChange={setActiveFilter} disabled={arrangement.active} />
                <LibrarySummary count={filteredBooks.length} activeFilterLabel={activeFilterLabel} />
            </View>
        </View>
    );

    return (
        <LibraryPageBackground>
            {isShelf ? (
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} style={styles.scrollView} scrollEnabled={!shelfDragging}>
                    <View style={styles.content}>
                        {collectionHeader}
                        <LibraryArrangeControls arrangement={arrangement} bookCount={books.length} dragging={shelfDragging}
                            onEnter={() => { setActiveFilter('all'); arrangement.enter(); }} />
                        <LibraryShelf books={filteredBooks} onBookPress={openBook} arrangement={arrangement} onDraggingChange={setShelfDragging} />
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
                        isRefetching={isRefetching} onRefresh={refetch} onBookPress={openBook} header={collectionHeader} />
                </View>
            )}
        </LibraryPageBackground>
    );
}

const styles = StyleSheet.create({
    page: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: 40, flexGrow: 1 },
    content: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: LIBRARY_SPACING.large },
    listViewport: { flex: 1 },
});
