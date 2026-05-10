import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useLibraryBooks } from '@/features/books/hooks/useLibraryBooks';
import {
    filterLibraryBooks,
    getLibraryFilterChips,
    getLibraryFilterLabel,
    LibraryBookEntry,
    LibraryFilter,
} from '@/features/books/utils/libraryShelf';
import {
    LibraryBookList,
    LibraryErrorState,
    LibraryFilterBar,
    LibraryHeader,
    LibraryLoadingState,
    LibrarySummary,
} from '@/components/library';

export default function LibraryScreen() {
    const { session } = useAuth();
    const [activeFilter, setActiveFilter] = useState<LibraryFilter>('all');

    const { data: books = [], error, isError, isLoading, isRefetching, refetch } = useLibraryBooks(session?.user?.id);

    const filterChips = useMemo(() => {
        return getLibraryFilterChips(books);
    }, [books]);

    const filteredBooks = useMemo(() => {
        return filterLibraryBooks(books, activeFilter);
    }, [activeFilter, books]);

    const activeFilterLabel = getLibraryFilterLabel(filterChips, activeFilter);
    const openSearch = () => router.push('/(tabs)/library/search');
    const openBook = (item: LibraryBookEntry) => router.push(`/(tabs)/library/${item.id}`);

    if (isLoading) {
        return <LibraryLoadingState />;
    }

    if (isError) {
        const errorMessage = error instanceof Error ? error.message : 'Please try again in a moment.';

        return (
            <ScreenBackground>
                <View style={styles.content}>
                    <LibraryHeader showAddButton={false} onSearch={openSearch} />
                    <LibraryErrorState message={errorMessage} onRetry={refetch} />
                </View>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <View style={styles.content}>
                <LibraryHeader onSearch={openSearch} />
                <LibrarySummary count={filteredBooks.length} activeFilterLabel={activeFilterLabel} />
                <LibraryFilterBar chips={filterChips} activeFilter={activeFilter} onChange={setActiveFilter} />
                <LibraryBookList
                    books={filteredBooks}
                    activeFilter={activeFilter}
                    activeFilterLabel={activeFilterLabel}
                    isRefetching={isRefetching}
                    onRefresh={refetch}
                    onBookPress={openBook}
                />
            </View>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 60,
    },
});
