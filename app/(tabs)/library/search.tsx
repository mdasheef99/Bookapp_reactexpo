import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    Alert,
    Share,
    Linking,
    RefreshControl,
    StyleSheet,
    Modal,
    KeyboardAvoidingView,
    Platform,
    TextInput,
} from 'react-native';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { booksService, GoogleBook, SearchFilters, PaginatedResult } from '@/features/books/services/booksService';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useDebounce } from '@/hooks/useDebounce';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useWishlist } from '@/hooks/useWishlist';
import * as Haptics from 'expo-haptics';
import { SortOption } from '@/lib/constants';
import { LinearGradient } from 'expo-linear-gradient';

// Import components
import {
    SkeletonCard,
    SortModal,
    RecentSearches,
    SearchBar,
    SearchSuggestions,
    FilterModal,
    FilterChips,
    SwipeableBookCard,
} from '@/components/search';
import { OfflineBanner } from '@/components/ui/OfflineBanner';

// Loading footer for pagination
const LoadingFooter = ({ loading, colors }: { loading: boolean; colors: any }) => {
    if (!loading) return null;
    return (
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Loading more...</Text>
        </View>
    );
};

export default function SearchBooksScreen() {
    const router = useRouter();
    const { session } = useAuth();
    const { colors } = useTheme();
    const queryClient = useQueryClient();
    const { isOffline } = useNetworkStatus();

    // Search state
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<GoogleBook[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [addingId, setAddingId] = useState<string | null>(null);

    // Pagination
    const [startIndex, setStartIndex] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [totalItems, setTotalItems] = useState(0);

    // Sort & Filter
    const [sortBy, setSortBy] = useState<SortOption>('relevance');
    const [showSortModal, setShowSortModal] = useState(false);
    const [filters, setFilters] = useState<SearchFilters>({});
    const [showFilterModal, setShowFilterModal] = useState(false);

    // Suggestions
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    // Hooks
    const debouncedQuery = useDebounce(query, 500);
    const debouncedSuggestionQuery = useDebounce(query, 300);
    const { recentSearches, saveRecentSearch, removeRecentSearch } = useRecentSearches();
    const { wishlistBookIds, toggleWishlist, refreshWishlist } = useWishlist(session?.user?.id);

    // Wishlist state
    const [wishlistTogglingId, setWishlistTogglingId] = useState<string | null>(null);
    const [showManualEntryModal, setShowManualEntryModal] = useState(false);
    const [manualTitle, setManualTitle] = useState('');
    const [manualAuthor, setManualAuthor] = useState('');
    const [manualSubmitting, setManualSubmitting] = useState(false);

    // Fetch suggestions
    useEffect(() => {
        if (debouncedSuggestionQuery.trim().length >= 2 && isFocused) {
            booksService.getSearchSuggestions(debouncedSuggestionQuery).then(setSuggestions);
        } else {
            setSuggestions([]);
        }
    }, [debouncedSuggestionQuery, isFocused]);

    // Auto-search when debounced query changes
    useEffect(() => {
        if (debouncedQuery.trim().length >= 3 && !isOffline) {
            performSearch(debouncedQuery, 0, false);
        }
    }, [debouncedQuery, filters, isOffline]);

    // Fetch user's library
    const { data: userLibrary } = useQuery({
        queryKey: ['library', session?.user?.id],
        queryFn: () => session?.user ? booksService.getUserLibrary(session.user.id) : Promise.resolve([]),
        enabled: !!session?.user,
    });

    const libraryBookIds = useMemo(() => new Set(
        userLibrary
            ?.filter((ub: any) => ub.ownership !== 'wishlist')
            .map((ub: any) => ub.book?.google_books_id)
            .filter(Boolean) || []
    ), [userLibrary]);

    // Search function
    const performSearch = useCallback(async (searchQuery: string, index: number = 0, saveToRecent: boolean = true) => {
        if (!searchQuery.trim() || isOffline) return;

        if (index === 0) {
            setLoading(true);
            setResults([]);
        } else {
            setLoadingMore(true);
        }
        setError(null);
        setShowSuggestions(false);

        try {
            const result: PaginatedResult = await booksService.searchGoogleBooks(searchQuery, index, 20, filters);

            if (index === 0) {
                setResults(result.items);
            } else {
                setResults(prev => [...prev, ...result.items]);
            }

            setHasMore(result.hasMore);
            setTotalItems(result.totalItems);
            setStartIndex(index + result.items.length);

            if (saveToRecent && result.items.length > 0 && index === 0) {
                saveRecentSearch(searchQuery);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to search. Please try again.');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [isOffline, filters, saveRecentSearch]);

    const handleSearch = useCallback(() => {
        if (!isOffline) {
            performSearch(query, 0, true);
        }
    }, [isOffline, query, performSearch]);

    const handleLoadMore = useCallback(() => {
        if (!loadingMore && hasMore && !isOffline) {
            performSearch(query, startIndex, false);
        }
    }, [loadingMore, hasMore, isOffline, query, startIndex, performSearch]);

    const handleRefresh = useCallback(async () => {
        if (!query.trim() || isOffline) return;
        setRefreshing(true);
        await performSearch(query, 0, false);
        setRefreshing(false);
    }, [query, isOffline, performSearch]);

    const handleClear = useCallback(() => {
        setQuery('');
        setResults([]);
        setStartIndex(0);
        setHasMore(false);
        setSuggestions([]);
    }, []);

    const closeManualEntryModal = useCallback(() => {
        setShowManualEntryModal(false);
        setManualTitle('');
        setManualAuthor('');
    }, []);

    const openManualEntryModal = useCallback(() => {
        setManualTitle(query.trim());
        setManualAuthor('');
        setShowManualEntryModal(true);
    }, [query]);

    const handleSuggestionSelect = useCallback((suggestion: string) => {
        setQuery(suggestion);
        setShowSuggestions(false);
        performSearch(suggestion, 0, true);
    }, [performSearch]);

    const handleFilterApply = useCallback((newFilters: SearchFilters) => {
        setFilters(newFilters);
        if (query.trim()) {
            performSearch(query, 0, false);
        }
    }, [query, performSearch]);

    const handleFilterRemove = useCallback((key: keyof SearchFilters) => {
        const newFilters = { ...filters };
        delete newFilters[key];
        setFilters(newFilters);
        if (query.trim()) {
            performSearch(query, 0, false);
        }
    }, [filters, query, performSearch]);

    // Sort results
    const sortedResults = useMemo(() => {
        if (sortBy === 'relevance') return results;
        return [...results].sort((a, b) => {
            switch (sortBy) {
                case 'rating':
                    return (b.volumeInfo.averageRating || 0) - (a.volumeInfo.averageRating || 0);
                case 'newest':
                    return (b.volumeInfo.publishedDate || '0000').localeCompare(a.volumeInfo.publishedDate || '0000');
                case 'title':
                    return a.volumeInfo.title.localeCompare(b.volumeInfo.title);
                default:
                    return 0;
            }
        });
    }, [results, sortBy]);

    // Book actions
    const handleAddBook = useCallback(async (book: GoogleBook) => {
        if (!session?.user) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setAddingId(book.id);
        try {
            await booksService.addToLibrary(session.user.id, book);
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['library'] }),
                refreshWishlist(),
            ]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Added!', `"${book.volumeInfo.title}" is now in your library`);
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Oops!', error.message);
        } finally {
            setAddingId(null);
        }
    }, [session, queryClient, refreshWishlist]);

    const handleManualAddBook = useCallback(async () => {
        if (!session?.user) return;

        const trimmedTitle = manualTitle.trim();
        const trimmedAuthor = manualAuthor.trim();

        if (!trimmedTitle) {
            Alert.alert('Title required', 'Enter a book title to add it manually.');
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setManualSubmitting(true);

        try {
            const bookData = await booksService.addManualBookToLibrary(session.user.id, {
                title: trimmedTitle,
                author: trimmedAuthor || undefined,
            });

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['library'] }),
                refreshWishlist(),
            ]);

            closeManualEntryModal();
            handleClear();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Added!', `"${bookData.title}" is now in your library`);
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Oops!', error.message || 'Failed to add book manually.');
        } finally {
            setManualSubmitting(false);
        }
    }, [session, manualTitle, manualAuthor, queryClient, refreshWishlist, closeManualEntryModal, handleClear]);

    const handlePreview = useCallback(async (previewLink?: string) => {
        if (!previewLink) {
            Alert.alert('No Preview', 'Preview is not available for this book.');
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            await Linking.openURL(previewLink);
        } catch (err) {
            Alert.alert('Error', 'Could not open preview link.');
        }
    }, []);

    const handleShare = useCallback(async (book: GoogleBook) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            await Share.share({
                message: `Check out "${book.volumeInfo.title}" by ${book.volumeInfo.authors?.[0] || 'Unknown Author'}!\n\n${book.volumeInfo.infoLink || ''}`,
                title: book.volumeInfo.title,
            });
        } catch (err) { }
    }, []);

    const handleWishlistToggle = useCallback(async (book: GoogleBook) => {
        if (!session?.user) return;

        if (libraryBookIds.has(book.id) && !wishlistBookIds.has(book.id)) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Already in Library', 'This book is already in your library.');
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setWishlistTogglingId(book.id);

        try {
            const success = await toggleWishlist(book);

            if (!success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                Alert.alert('Oops!', 'Failed to update wishlist');
                return;
            }

            await queryClient.invalidateQueries({ queryKey: ['library'] });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Oops!', error.message || 'Failed to update wishlist');
        } finally {
            setWishlistTogglingId(null);
        }
    }, [session, libraryBookIds, wishlistBookIds, toggleWishlist, queryClient]);

    // Render book card using extracted component
    const renderItem = useCallback(({ item, index }: { item: GoogleBook; index: number }) => (
        <SwipeableBookCard
            book={item}
            index={index}
            isInLibrary={libraryBookIds.has(item.id)}
            isAdding={addingId === item.id}
            isInWishlist={wishlistBookIds.has(item.id)}
            isTogglingWishlist={wishlistTogglingId === item.id}
            colors={colors}
            onSwipeAddToLibrary={handleAddBook}
            onSwipeAddToWishlist={handleWishlistToggle}
            onPreview={handlePreview}
            onShare={handleShare}
        />
    ), [libraryBookIds, addingId, wishlistBookIds, wishlistTogglingId, colors, handleAddBook, handlePreview, handleShare, handleWishlistToggle]);

    // Render helpers
    const renderSkeletons = () => (
        <View>
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} colors={colors} />)}
        </View>
    );

    const renderError = () => (
        <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 80, paddingHorizontal: 32 }}>
            <View style={{ width: 80, height: 80, backgroundColor: '#FEE2E2', borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '600', textAlign: 'center' }}>Something went wrong</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 8 }}>{error}</Text>
            <TouchableOpacity
                onPress={handleSearch}
                style={{ backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, marginTop: 20, flexDirection: 'row', alignItems: 'center' }}
                accessibilityLabel="Try Again"
                accessibilityHint="Retry the failed search"
            >
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 8 }}>Try Again</Text>
            </TouchableOpacity>
        </View>
    );

    const renderEmptyState = () => (
        <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 40, opacity: 0.8 }}>
            <View style={{ width: 100, height: 100, backgroundColor: colors.bgCard, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
                <Ionicons name="library-outline" size={48} color={colors.accent} />
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>Discover Books</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
                Search for your favorite titles, authors, or genres
            </Text>
        </View>
    );

    const renderNoResults = () => (
        <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 80, paddingHorizontal: 32 }}>
            <View style={{ width: 80, height: 80, backgroundColor: colors.bgCard, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
                <Ionicons name="search-outline" size={36} color={colors.textTertiary} />
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 18, fontWeight: '600', textAlign: 'center' }}>No books found</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 15, textAlign: 'center', marginTop: 8 }}>
                Try a different search term or adjust filters
            </Text>
            <TouchableOpacity
                testID="library-manual-entry-open"
                onPress={openManualEntryModal}
                style={{
                    marginTop: 20,
                    backgroundColor: colors.accent,
                    paddingHorizontal: 18,
                    paddingVertical: 12,
                    borderRadius: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                }}
                accessibilityLabel="Add book manually"
                accessibilityHint="Opens a form to add a book without Google Books results"
            >
                <Ionicons name="create-outline" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 8 }}>
                    Add it manually
                </Text>
            </TouchableOpacity>
            <Text style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center', marginTop: 10 }}>
                Can’t find the book? Save a basic title and optional author to your library.
            </Text>
        </View>
    );

    const activeFiltersCount = [
        filters.genre && filters.genre !== 'all',
        filters.language && filters.language !== 'all',
        filters.priceType && filters.priceType !== 'all',
    ].filter(Boolean).length;

    return (
        <View style={{ flex: 1 }}>
            {/* Whimsical gradient background */}
            <LinearGradient
                colors={['#d9f99d', '#fef08a', '#bae6fd']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            {/* Offline Banner */}
            <OfflineBanner visible={isOffline} />

            <View style={{ flex: 1, paddingTop: isOffline ? 60 : 60, paddingHorizontal: 16 }}>
                {/* Header with Back Button */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: 'rgba(255,255,255,0.9)',
                            justifyContent: 'center',
                            alignItems: 'center',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 4,
                            elevation: 3,
                        }}
                    >
                        <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 24, fontWeight: '700', color: '#1A1A1A', marginLeft: 12 }}>
                        Search Books
                    </Text>
                </View>

                {/* Search Bar */}
                <View style={{ position: 'relative', zIndex: 100 }}>
                    <SearchBar
                        query={query}
                        onQueryChange={(text) => {
                            setQuery(text);
                            if (text.length >= 2) setShowSuggestions(true);
                        }}
                        onSubmit={handleSearch}
                        onClear={handleClear}
                        loading={loading}
                        colors={colors}
                    />

                    {/* Suggestions Dropdown */}
                    <SearchSuggestions
                        suggestions={suggestions}
                        recentSearches={recentSearches}
                        onSelect={handleSuggestionSelect}
                        visible={showSuggestions && isFocused && query.length >= 2}
                        colors={colors}
                    />
                </View>

                {/* Filter Chips */}
                <FilterChips filters={filters} onRemove={handleFilterRemove} colors={colors} />

                {/* Recent Searches */}
                {results.length === 0 && !loading && !query && (
                    <RecentSearches
                        searches={recentSearches}
                        onSearch={(q) => {
                            setQuery(q);
                            performSearch(q, 0, true);
                        }}
                        onRemove={removeRecentSearch}
                        colors={colors}
                    />
                )}

                {/* Results Header with Sort & Filter */}
                {results.length > 0 && !loading && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <Text style={{ fontSize: 14, color: colors.textSecondary, fontWeight: '500' }}>
                            {totalItems > 0 ? `${totalItems.toLocaleString()} results` : `${results.length} results`}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {/* Filter Button */}
                            <TouchableOpacity
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setShowFilterModal(true);
                                }}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: activeFiltersCount > 0 ? colors.accent : colors.bgCard,
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: activeFiltersCount > 0 ? colors.accent : colors.border,
                                }}
                                accessibilityLabel="Filter results"
                                accessibilityHint="Opens filter options"
                            >
                                <Ionicons name="filter" size={16} color={activeFiltersCount > 0 ? '#fff' : colors.textSecondary} />
                                {activeFiltersCount > 0 && (
                                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', marginLeft: 4 }}>
                                        {activeFiltersCount}
                                    </Text>
                                )}
                            </TouchableOpacity>

                            {/* Sort Button */}
                            <TouchableOpacity
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setShowSortModal(true);
                                }}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: colors.bgCard,
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                }}
                                accessibilityLabel="Sort results"
                                accessibilityHint="Opens sort options"
                            >
                                <Ionicons name="swap-vertical" size={16} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Content */}
                {error ? (
                    renderError()
                ) : loading ? (
                    renderSkeletons()
                ) : (
                    <FlatList
                        data={sortedResults}
                        keyExtractor={(item, index) => `${item.id}-${index}`}
                        renderItem={renderItem}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                        onEndReached={handleLoadMore}
                        onEndReachedThreshold={0.5}
                        ListFooterComponent={<LoadingFooter loading={loadingMore} colors={colors} />}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={handleRefresh}
                                tintColor={colors.accent}
                                colors={[colors.accent]}
                            />
                        }
                        ListEmptyComponent={query ? renderNoResults() : renderEmptyState()}
                    />
                )}
            </View>

            {/* Modals */}
            <SortModal
                visible={showSortModal}
                onClose={() => setShowSortModal(false)}
                currentSort={sortBy}
                onSelect={setSortBy}
                colors={colors}
            />

            <FilterModal
                visible={showFilterModal}
                onClose={() => setShowFilterModal(false)}
                filters={filters}
                onApply={handleFilterApply}
                colors={colors}
            />

            <Modal
                visible={showManualEntryModal}
                transparent
                animationType="fade"
                onRequestClose={closeManualEntryModal}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{
                        flex: 1,
                        justifyContent: 'center',
                        padding: 24,
                        backgroundColor: 'rgba(15, 23, 42, 0.45)',
                    }}
                >
                    <View
                        style={{
                            backgroundColor: colors.bgCard,
                            borderRadius: 24,
                            padding: 20,
                            borderWidth: 1,
                            borderColor: colors.border,
                        }}
                    >
                        <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '700' }}>
                            Add book manually
                        </Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 8 }}>
                            Add a basic library entry when search doesn’t return the title you need.
                        </Text>

                        <View style={{ marginTop: 18 }}>
                            <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
                                Title
                            </Text>
                            <TextInput
                                testID="library-manual-entry-title"
                                value={manualTitle}
                                onChangeText={setManualTitle}
                                placeholder="Enter the book title"
                                placeholderTextColor={colors.textTertiary}
                                style={{
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    borderRadius: 14,
                                    paddingHorizontal: 14,
                                    paddingVertical: 12,
                                    fontSize: 15,
                                    color: colors.textPrimary,
                                    backgroundColor: colors.bgPrimary,
                                }}
                            />
                        </View>

                        <View style={{ marginTop: 14 }}>
                            <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
                                Author (optional)
                            </Text>
                            <TextInput
                                testID="library-manual-entry-author"
                                value={manualAuthor}
                                onChangeText={setManualAuthor}
                                placeholder="Enter the author name"
                                placeholderTextColor={colors.textTertiary}
                                style={{
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    borderRadius: 14,
                                    paddingHorizontal: 14,
                                    paddingVertical: 12,
                                    fontSize: 15,
                                    color: colors.textPrimary,
                                    backgroundColor: colors.bgPrimary,
                                }}
                            />
                        </View>

                        <View style={{ flexDirection: 'row', marginTop: 22, gap: 12 }}>
                            <TouchableOpacity
                                testID="library-manual-entry-cancel"
                                onPress={closeManualEntryModal}
                                style={{
                                    flex: 1,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    borderRadius: 14,
                                    paddingVertical: 12,
                                    alignItems: 'center',
                                    backgroundColor: colors.bgPrimary,
                                }}
                            >
                                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>
                                    Cancel
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                testID="library-manual-entry-save"
                                onPress={handleManualAddBook}
                                disabled={manualSubmitting}
                                style={{
                                    flex: 1,
                                    borderRadius: 14,
                                    paddingVertical: 12,
                                    alignItems: 'center',
                                    backgroundColor: manualSubmitting ? colors.textTertiary : colors.accent,
                                }}
                            >
                                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                                    {manualSubmitting ? 'Saving...' : 'Save to library'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

