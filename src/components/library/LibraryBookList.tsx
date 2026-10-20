import React from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LIBRARY_RADIUS, useLibraryAppearance } from './LibraryAppearance';
import { useLibraryTypography } from './LibraryTypography';
import { LibraryBookEntry, LibraryFilter } from '@/features/books/utils/libraryShelf';
import { ownershipLabel, readingStatusLabel } from '@/features/books/utils/libraryLabels';

type LibraryBookRowProps = {
    item: LibraryBookEntry;
    onPress: (item: LibraryBookEntry) => void;
};

export function LibraryBookRow({ item, onPress }: LibraryBookRowProps) {
    const colors = useLibraryAppearance();
    const fonts = useLibraryTypography();

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => onPress(item)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.book.title}${item.book.authors?.[0] ? ` by ${item.book.authors[0]}` : ''}`}
        >
            <View style={[styles.bookCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row' }}>
                    <Image
                        source={{ uri: item.book.cover_url || 'https://via.placeholder.com/100x150' }}
                        style={[styles.bookCover, { backgroundColor: colors.bgSecondary }]}
                        contentFit="cover"
                    />
                    <View style={styles.bookInfo}>
                        <Text style={[styles.bookTitle, { color: colors.textPrimary, fontFamily: fonts.heading }]} numberOfLines={2}>
                            {item.book.title}
                        </Text>
                        <Text style={[styles.bookAuthor, { color: colors.textSecondary, fontFamily: fonts.body }]} numberOfLines={1}>
                            {item.book.authors?.join(', ')}
                        </Text>
                        <View style={styles.tagContainer}>
                            {typeof item.reading_status === 'string' && item.reading_status.length > 0 && <View style={[styles.tag, { backgroundColor: colors.tagBackground }]}>
                                <Text style={[styles.tagText, { color: colors.tagText, fontFamily: fonts.body }]}>
                                    {readingStatusLabel(item.reading_status)}
                                </Text>
                            </View>}
                            {typeof item.ownership === 'string' && item.ownership.length > 0 && <View style={[styles.tag, { backgroundColor: colors.tagBackground }]}>
                                <Text style={[styles.tagText, { color: colors.tagText, fontFamily: fonts.body }]}>
                                    {ownershipLabel(item.ownership)}
                                </Text>
                            </View>}
                        </View>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
}

type LibraryEmptyStateProps = {
    activeFilter: LibraryFilter;
    activeFilterLabel: string;
};

export function LibraryEmptyState({ activeFilter, activeFilterLabel }: LibraryEmptyStateProps) {
    const colors = useLibraryAppearance();
    const fonts = useLibraryTypography();

    return (
        <View style={styles.emptyContainer}>
            <Ionicons name="library" size={64} color={colors.textTertiary} style={{ marginBottom: 16 }} accessibilityLabel="Empty library" />
            <Text style={[styles.emptySubtitle, { color: colors.textPrimary, fontFamily: fonts.heading }]}>
                {activeFilter === 'all' ? 'Your library is empty' : `No ${activeFilterLabel.toLowerCase()} books yet`}
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                {activeFilter === 'all'
                    ? 'Tap the "+ Add Book" button to start building your collection.'
                    : 'Switch shelves or add more books to round out this part of your library.'}
            </Text>
        </View>
    );
}

type LibraryErrorStateProps = {
    message: string;
    onRetry: () => void;
};

export function LibraryErrorState({ message, onRetry }: LibraryErrorStateProps) {
    const colors = useLibraryAppearance();
    const fonts = useLibraryTypography();

    return (
        <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={56} color={colors.error} style={{ marginBottom: 16 }} />
            <Text style={[styles.errorTitle, { color: colors.textPrimary, fontFamily: fonts.heading }]}>Could not load your library</Text>
            <Text style={[styles.errorText, { color: colors.textSecondary, fontFamily: fonts.body }]}>{message}</Text>
            <TouchableOpacity
                onPress={onRetry}
                style={[styles.retryButton, { backgroundColor: colors.accent }]}
                accessibilityLabel="Retry loading library"
                accessibilityHint="Attempts to load your library again"
            >
                <Ionicons name="refresh" size={18} color={colors.onAccent} />
                <Text style={[styles.retryButtonText, { color: colors.onAccent, fontFamily: fonts.label }]}>Try Again</Text>
            </TouchableOpacity>
        </View>
    );
}

export function LibraryLoadingState() {
    const colors = useLibraryAppearance();

    return (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
        </View>
    );
}

type LibraryBookListProps = {
    books: LibraryBookEntry[];
    activeFilter: LibraryFilter;
    activeFilterLabel: string;
    isRefetching: boolean;
    onRefresh: () => void;
    onBookPress: (item: LibraryBookEntry) => void;
    header?: React.ReactElement;
};

export function LibraryBookList({
    books,
    activeFilter,
    activeFilterLabel,
    isRefetching,
    onRefresh,
    onBookPress,
    header,
}: LibraryBookListProps) {
    const colors = useLibraryAppearance();

    return (
        <FlatList
            testID="library-book-list"
            style={styles.list}
            data={books}
            ListHeaderComponent={header}
            keyExtractor={(item) => item.id}
            refreshControl={
                <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.accent} />
            }
            renderItem={({ item }) => (
                <LibraryBookRow item={item} onPress={onBookPress} />
            )}
            ListEmptyComponent={
                <LibraryEmptyState activeFilter={activeFilter} activeFilterLabel={activeFilterLabel} />
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
        />
    );
}

const styles = StyleSheet.create({
    bookCard: { marginBottom: 16, padding: 16, borderRadius: LIBRARY_RADIUS.card, borderWidth: 1 },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    list: { flex: 1 },
    listContent: { paddingBottom: 40, flexGrow: 1 },
    bookCover: {
        width: 80,
        height: 120,
        borderRadius: 12,
    },
    bookInfo: {
        flex: 1,
        marginLeft: 16,
        justifyContent: 'center',
    },
    bookTitle: {
        fontSize: 23,
        lineHeight: 27,
        marginBottom: 6,
        letterSpacing: -0.3,
    },
    bookAuthor: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 12,
    },
    tagContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    tag: {
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 8,
    },
    tagText: {
        fontSize: 12,
        lineHeight: 16,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 100,
        paddingHorizontal: 40,
    },
    emptySubtitle: {
        fontSize: 20,
        marginBottom: 12,
    },
    emptyText: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
    },
    errorContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 96,
        paddingHorizontal: 36,
    },
    errorTitle: {
        fontSize: 20,
        marginBottom: 10,
        textAlign: 'center',
    },
    errorText: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
    },
    retryButton: {
        marginTop: 22,
        borderRadius: 14,
        paddingHorizontal: 18,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    retryButtonText: {
        fontSize: 14,
        fontWeight: '700',
        marginLeft: 8,
    },
});
