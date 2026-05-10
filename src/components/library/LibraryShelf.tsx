import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import { LibraryBookEntry, LibraryFilter, LibraryFilterChip } from '@/features/books/utils/libraryShelf';

type LibraryHeaderProps = {
    showAddButton?: boolean;
    onSearch: () => void;
    onAdd?: () => void;
};

export function LibraryHeader({ showAddButton = true, onSearch, onAdd = onSearch }: LibraryHeaderProps) {
    const { colors } = useTheme();

    return (
        <View style={styles.header}>
            <Text style={styles.title}>My Library</Text>
            <View style={styles.headerActions}>
                <TouchableOpacity
                    onPress={onSearch}
                    style={[styles.iconButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                    accessibilityLabel="Search books"
                    accessibilityHint="Open search to add or discover books"
                >
                    <Ionicons name="search-outline" size={18} color={colors.textPrimary} />
                </TouchableOpacity>
                {showAddButton && (
                    <View style={styles.addButton}>
                        <Button
                            title="+ Add Book"
                            onPress={onAdd}
                            variant="primary"
                            size="sm"
                            accessibilityLabel="Add a new book to your library"
                        />
                    </View>
                )}
            </View>
        </View>
    );
}

type LibrarySummaryProps = {
    count: number;
    activeFilterLabel: string;
};

export function LibrarySummary({ count, activeFilterLabel }: LibrarySummaryProps) {
    const { colors } = useTheme();

    return (
        <View style={[styles.summaryCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Current shelf</Text>
                <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
                    {count} {count === 1 ? 'book' : 'books'}
                </Text>
            </View>
            <View style={styles.summaryMeta}>
                <Text style={[styles.summaryMetaText, { color: colors.textSecondary }]}>
                    Showing {activeFilterLabel.toLowerCase()}
                </Text>
            </View>
        </View>
    );
}

type LibraryFilterBarProps = {
    chips: LibraryFilterChip[];
    activeFilter: LibraryFilter;
    onChange: (filter: LibraryFilter) => void;
};

export function LibraryFilterBar({ chips, activeFilter, onChange }: LibraryFilterBarProps) {
    const { colors } = useTheme();

    return (
        <View style={styles.filterRow}>
            {chips.map((chip) => {
                const isActive = chip.key === activeFilter;

                return (
                    <TouchableOpacity
                        key={chip.key}
                        onPress={() => onChange(chip.key)}
                        style={[
                            styles.filterChip,
                            {
                                backgroundColor: isActive ? colors.accent : colors.bgCard,
                                borderColor: isActive ? colors.accent : colors.border,
                            },
                        ]}
                    >
                        <Text
                            style={[
                                styles.filterChipText,
                                { color: isActive ? '#FFFFFF' : colors.textSecondary },
                            ]}
                        >
                            {chip.label}
                        </Text>
                        <View
                            style={[
                                styles.filterChipCount,
                                { backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : colors.bgSecondary },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.filterChipCountText,
                                    { color: isActive ? '#FFFFFF' : colors.textPrimary },
                                ]}
                            >
                                {chip.count}
                            </Text>
                        </View>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

type LibraryBookRowProps = {
    item: LibraryBookEntry;
    onPress: (item: LibraryBookEntry) => void;
};

export function LibraryBookRow({ item, onPress }: LibraryBookRowProps) {
    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => onPress(item)}
        >
            <GlassCard style={{ marginBottom: 16 }} padding={16} borderRadius={20}>
                <View style={{ flexDirection: 'row' }}>
                    <Image
                        source={{ uri: item.book.cover_url || 'https://via.placeholder.com/100x150' }}
                        style={styles.bookCover}
                        contentFit="cover"
                    />
                    <View style={styles.bookInfo}>
                        <Text style={styles.bookTitle} numberOfLines={2}>
                            {item.book.title}
                        </Text>
                        <Text style={styles.bookAuthor} numberOfLines={1}>
                            {item.book.authors?.join(', ')}
                        </Text>
                        <View style={styles.tagContainer}>
                            <View style={styles.tag}>
                                <Text style={styles.tagText}>
                                    {item.reading_status?.replace(/_/g, ' ')}
                                </Text>
                            </View>
                            <View style={styles.tag}>
                                <Text style={styles.tagText}>
                                    {item.ownership}
                                </Text>
                            </View>
                            {item.available_for_lending && (
                                <View style={[styles.tag, styles.lendingTag]}>
                                    <Text style={[styles.tagText, styles.lendingTagText]}>
                                        lendable
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </GlassCard>
        </TouchableOpacity>
    );
}

type LibraryEmptyStateProps = {
    activeFilter: LibraryFilter;
    activeFilterLabel: string;
};

export function LibraryEmptyState({ activeFilter, activeFilterLabel }: LibraryEmptyStateProps) {
    const { colors } = useTheme();

    return (
        <View style={styles.emptyContainer}>
            <Ionicons name="library" size={64} color={colors.textTertiary} style={{ marginBottom: 16 }} accessibilityLabel="Empty library" />
            <Text style={styles.emptySubtitle}>
                {activeFilter === 'all' ? 'Your library is empty' : `No ${activeFilterLabel.toLowerCase()} books yet`}
            </Text>
            <Text style={styles.emptyText}>
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
    const { colors } = useTheme();

    return (
        <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={56} color="#EF4444" style={{ marginBottom: 16 }} />
            <Text style={styles.errorTitle}>Could not load your library</Text>
            <Text style={styles.errorText}>{message}</Text>
            <TouchableOpacity
                onPress={onRetry}
                style={[styles.retryButton, { backgroundColor: colors.accent }]}
                accessibilityLabel="Retry loading library"
                accessibilityHint="Attempts to load your library again"
            >
                <Ionicons name="refresh" size={18} color="#FFFFFF" />
                <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
        </View>
    );
}

export function LibraryLoadingState() {
    const { colors } = useTheme();

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
};

export function LibraryBookList({
    books,
    activeFilter,
    activeFilterLabel,
    isRefetching,
    onRefresh,
    onBookPress,
}: LibraryBookListProps) {
    const { colors } = useTheme();

    return (
        <FlatList
            data={books}
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    addButton: {
        width: 116,
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        color: '#1A1A1A',
        letterSpacing: -0.5,
    },
    summaryCard: {
        borderRadius: 20,
        borderWidth: 1,
        padding: 16,
        marginBottom: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    summaryLabel: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 24,
        fontWeight: '800',
    },
    summaryMeta: {
        alignItems: 'flex-end',
    },
    summaryMetaText: {
        fontSize: 13,
        fontWeight: '500',
    },
    filterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 18,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    filterChipText: {
        fontSize: 13,
        fontWeight: '700',
    },
    filterChipCount: {
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        marginLeft: 8,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    filterChipCountText: {
        fontSize: 12,
        fontWeight: '700',
    },
    listContent: {
        paddingBottom: 100,
    },
    bookCover: {
        width: 80,
        height: 120,
        borderRadius: 12,
        backgroundColor: '#E8E8E8',
    },
    bookInfo: {
        flex: 1,
        marginLeft: 16,
        justifyContent: 'center',
    },
    bookTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A1A',
        marginBottom: 6,
        letterSpacing: -0.3,
    },
    bookAuthor: {
        fontSize: 14,
        fontWeight: '500',
        color: '#666666',
        marginBottom: 12,
    },
    tagContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    tag: {
        backgroundColor: 'rgba(145, 197, 94, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(145, 197, 94, 0.3)',
    },
    tagText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#84cc16',
        textTransform: 'capitalize',
    },
    lendingTag: {
        backgroundColor: 'rgba(59, 130, 246, 0.12)',
        borderColor: 'rgba(59, 130, 246, 0.2)',
    },
    lendingTagText: {
        color: '#2563EB',
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 100,
        paddingHorizontal: 40,
    },
    emptySubtitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1A1A1A',
        marginBottom: 12,
    },
    emptyText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#666666',
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
        fontWeight: '700',
        color: '#1A1A1A',
        marginBottom: 10,
        textAlign: 'center',
    },
    errorText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#666666',
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
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
        marginLeft: 8,
    },
});
