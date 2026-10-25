import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from './LibraryAppearance';
import { LIBRARY_TEXT } from './LibraryTypography';
import { LibraryBookThumb } from './LibraryBookThumb';
import { BookButton, BookEmpty, BookLoading } from './ui';
import { BookLoadErrorKind } from './bookDetails/classifyBookLoadError';
import { LibraryBookEntry, LibraryFilter } from '@/features/books/utils/libraryShelf';
import { ownershipLabel, readingStatusLabel } from '@/features/books/utils/libraryLabels';

type LibraryBookRowProps = {
    item: LibraryBookEntry;
    onPress: (item: LibraryBookEntry) => void;
};

export function LibraryBookRow({ item, onPress }: LibraryBookRowProps) {
    const colors = useLibraryAppearance();
    const caption = [
        item.reading_status ? readingStatusLabel(item.reading_status) : null,
        item.ownership ? ownershipLabel(item.ownership) : null,
    ].filter(Boolean).join(' · ');

    return <TouchableOpacity activeOpacity={0.9} onPress={() => onPress(item)} accessibilityRole="button"
        accessibilityLabel={`Open ${item.book.title}${item.book.authors?.[0] ? ` by ${item.book.authors[0]}` : ''}`}
        style={[styles.bookRow, { borderColor: colors.divider }]}>
        <LibraryBookThumb title={item.book.title} coverUrl={item.book.cover_url} />
        <View style={styles.bookInfo}>
            <Text style={[LIBRARY_TEXT.heading, { color: colors.textPrimary }]} numberOfLines={2} ellipsizeMode="tail">{item.book.title}</Text>
            {!!item.book.authors?.length && <Text style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]} numberOfLines={1} ellipsizeMode="tail">{item.book.authors.join(', ')}</Text>}
            {!!caption && <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>{caption}</Text>}
        </View>
    </TouchableOpacity>;
}

type LibraryEmptyStateProps = {
    activeFilter: LibraryFilter;
    activeFilterLabel: string;
    labelName?: string;
    onShowAll: () => void;
};

export function LibraryEmptyState({ activeFilter, activeFilterLabel, labelName, onShowAll }: LibraryEmptyStateProps) {
    return <View style={styles.state}>
        <BookEmpty title={labelName ? `No ${labelName} books` : activeFilter === 'all' ? 'Your library is empty' : `No ${activeFilterLabel.toLowerCase()} books`}
            message={!labelName && activeFilter === 'all' ? 'Add a book to start your shelf.' : undefined} />
        {(!!labelName || activeFilter !== 'all') && <BookButton label="Show all books" variant="text" onPress={onShowAll} />}
    </View>;
}

type LibraryErrorStateProps = {
    kind: BookLoadErrorKind;
    onRetry: () => void;
};

export function LibraryErrorState({ kind, onRetry }: LibraryErrorStateProps) {
    return <View accessibilityRole="alert" style={styles.state}>
        <BookEmpty title={kind === 'offline' ? "You're offline." : "Couldn't load your library."}
            message={kind === 'offline' ? 'Your library will load when you reconnect.' : 'Try again in a moment.'}
            actionLabel="Try again" onAction={onRetry} />
    </View>;
}

export function LibraryLoadingState() {
    return <BookLoading variant="list" label="Loading library" />;
}

type LibraryBookListProps = {
    books: LibraryBookEntry[];
    activeFilter: LibraryFilter;
    activeFilterLabel: string;
    labelName?: string;
    isRefetching: boolean;
    onRefresh: () => void;
    onBookPress: (item: LibraryBookEntry) => void;
    onShowAll: () => void;
    header?: React.ReactElement;
};

export function LibraryBookList({ books, activeFilter, activeFilterLabel, labelName, isRefetching, onRefresh, onBookPress, onShowAll, header }: LibraryBookListProps) {
    const colors = useLibraryAppearance();

    return <FlatList testID="library-book-list" style={styles.list} data={books} ListHeaderComponent={header}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.accent} />}
        renderItem={({ item }) => <LibraryBookRow item={item} onPress={onBookPress} />}
        ListEmptyComponent={<LibraryEmptyState activeFilter={activeFilter} activeFilterLabel={activeFilterLabel} labelName={labelName} onShowAll={onShowAll} />}
        contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} />;
}

const styles = StyleSheet.create({
    bookRow: { minHeight: MIN_TARGET, padding: LIBRARY_SPACING.md, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: LIBRARY_SPACING.md },
    bookInfo: { flex: 1, minWidth: 0, justifyContent: 'center', gap: LIBRARY_SPACING.xs },
    state: { paddingVertical: LIBRARY_SPACING.xl, gap: LIBRARY_SPACING.md, alignItems: 'center' },
    list: { flex: 1 },
    listContent: { paddingBottom: LIBRARY_SPACING.xl, flexGrow: 1 },
});
