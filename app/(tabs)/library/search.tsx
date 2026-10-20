import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    Share,
    Linking,
    RefreshControl,
    StyleSheet,
} from 'react-native';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import { booksService, GoogleBook, SearchFilters, PaginatedResult } from '@/features/books/services/booksService';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useDebounce } from '@/hooks/useDebounce';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useWishlist } from '@/hooks/useWishlist';
import * as Haptics from 'expo-haptics';
import { SortOption } from '@/lib/constants';
import { navigateBackOrFallback } from '@/lib/navigation';
import { useLibraryTypography } from '@/components/library/LibraryTypography';
import { useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { useBookFeedback } from '@/components/library/ui';
import { sortSearchResults } from '@/features/books/utils/searchResults';

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
    ManualEntryModal,
} from '@/components/search';
import { OfflineBanner } from '@/components/ui/OfflineBanner';

// Loading footer for pagination
const LoadingFooter = ({ loading }: { loading: boolean }) => {
    const colors = useLibraryAppearance();
    const fonts = useLibraryTypography();
    if (!loading) return null;
    return (
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <Text style={{ color: colors.textTertiary, fontSize: 12, fontFamily: fonts.body }}>Loading more...</Text>
        </View>
    );
};

const getSearchSignature = (searchQuery: string, filters: SearchFilters) =>
    JSON.stringify([searchQuery.trim(), filters]);

export default function SearchBooksScreen() {
    // FU-2: fonts come from app/(tabs)/library/_layout.tsx (LibraryTypographyProvider).
    return <SearchBooksScreenContent />;
}

function SearchBooksScreenContent() {
    const { notify } = useBookFeedback();
    const router = useRouter();
    const { session } = useAuth();
    const colors = useLibraryAppearance();
    const fonts = useLibraryTypography();
    const queryClient = useQueryClient();
    const { isOffline } = useNetworkStatus();
    const browserLocation = typeof window !== 'undefined'
        ? window.location
        : typeof globalThis !== 'undefined'
            ? globalThis.location
            : undefined;
    const locationText = `${browserLocation?.hostname ?? ''} ${browserLocation?.href ?? ''}`;
    const isLocalPreview = /(^|\s|\/\/)(localhost|127\.0\.0\.1|\[::1\]|::1)(:|\/|\s|$)/.test(locationText);
    const searchIsOffline = isOffline && !isLocalPreview;

    // Search state
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<GoogleBook[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [addingId, setAddingId] = useState<string | null>(null);
    const [showCachedResultsNotice, setShowCachedResultsNotice] = useState(false);
    const [showOpenLibraryFallbackNotice, setShowOpenLibraryFallbackNotice] = useState(false);

    // Pagination
    const [startIndex, setStartIndex] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [totalItems, setTotalItems] = useState(0);
    const [totalItemsExact, setTotalItemsExact] = useState(true);
    const [providerUnsupportedFilters, setProviderUnsupportedFilters] = useState<Array<keyof SearchFilters>>([]);
    const searchRequestId = useRef(0);
    const lastSearchSignature = useRef<string | null>(null);
    const pendingRecentSearchSignature = useRef<string | null>(null);
    const selectedProvider = useRef<'google' | 'openLibrary' | undefined>(undefined);
    const submittedQuery = useRef<string | null>(null);

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
        if ((debouncedQuery.trim().length >= 3 || (debouncedQuery.trim() && submittedQuery.current === debouncedQuery.trim())) && !searchIsOffline) {
            const signature = getSearchSignature(debouncedQuery, filters);
            if (lastSearchSignature.current === signature) return;
            lastSearchSignature.current = signature;
            performSearch(debouncedQuery, 0, false);
        }
    }, [debouncedQuery, filters, searchIsOffline]);

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
        if (!searchQuery.trim() || searchIsOffline) return;
        const requestId = ++searchRequestId.current;

        if (index === 0) {
            selectedProvider.current = undefined;
            setLoading(true);
            setResults([]);
        } else {
            setLoadingMore(true);
        }
        setError(null);
        setShowSuggestions(false);
        setShowCachedResultsNotice(false);
        setShowOpenLibraryFallbackNotice(false);
        setProviderUnsupportedFilters([]);

        try {
            const result = index === 0
                ? await booksService.searchGoogleBooksCached(searchQuery, index, 20, filters)
                : await booksService.searchGoogleBooksCached(searchQuery, index, 20, filters, selectedProvider.current);
            if (requestId !== searchRequestId.current) return;
            selectedProvider.current = result.providerUsed ?? 'google';

            if (index === 0) {
                setResults(result.items);
            } else {
                setResults(prev => [...prev, ...result.items]);
            }

            setHasMore(result.hasMore);
            setTotalItems(result.totalItems);
            setTotalItemsExact(result.totalItemsExact ?? true);
            setProviderUnsupportedFilters(result.unsupportedFilters ?? []);
            setStartIndex(result.nextStartIndex ?? index + result.items.length);
            setShowCachedResultsNotice(result.fromCache && index === 0);
            setShowOpenLibraryFallbackNotice(
                result.fallbackUsed === true && result.providerUsed === 'openLibrary'
            );

            const searchSignature = getSearchSignature(searchQuery, filters);
            const explicitSubmitWasPending = pendingRecentSearchSignature.current === searchSignature;
            if ((saveToRecent || explicitSubmitWasPending) && result.items.length > 0 && index === 0) {
                saveRecentSearch(searchQuery);
                if (explicitSubmitWasPending) pendingRecentSearchSignature.current = null;
            }
        } catch (err) {
            if (requestId !== searchRequestId.current) return;
            const message = err instanceof Error ? err.message : 'Failed to search. Please try again.';
            setError(message);
        } finally {
            if (requestId === searchRequestId.current) {
                setLoading(false);
                setLoadingMore(false);
            }
        }
    }, [searchIsOffline, filters, saveRecentSearch]);

    const handleSearch = useCallback(() => {
        if (!searchIsOffline) {
            submittedQuery.current = query.trim();
            const signature = getSearchSignature(query, filters);
            if (lastSearchSignature.current === signature && !error) {
                if (results.length > 0) {
                    saveRecentSearch(query);
                } else if (loading) {
                    pendingRecentSearchSignature.current = signature;
                }
                return;
            }
            lastSearchSignature.current = signature;
            performSearch(query, 0, true);
        }
    }, [searchIsOffline, query, filters, error, results.length, loading, saveRecentSearch, performSearch]);

    const handleLoadMore = useCallback(() => {
        if (!loadingMore && hasMore && !searchIsOffline) {
            performSearch(query, startIndex, false);
        }
    }, [loadingMore, hasMore, searchIsOffline, query, startIndex, performSearch]);

    const handleRefresh = useCallback(async () => {
        if (!query.trim() || searchIsOffline) return;
        setRefreshing(true);
        await performSearch(query, 0, false);
        setRefreshing(false);
    }, [query, searchIsOffline, performSearch]);

    const handleClear = useCallback(() => {
        submittedQuery.current = null;
        selectedProvider.current = undefined;
        searchRequestId.current += 1;
        lastSearchSignature.current = null;
        pendingRecentSearchSignature.current = null;
        setQuery('');
        setResults([]);
        setLoading(false);
        setLoadingMore(false);
        setError(null);
        setStartIndex(0);
        setHasMore(false);
        setSuggestions([]);
        setShowCachedResultsNotice(false);
        setShowOpenLibraryFallbackNotice(false);
        setTotalItems(0);
        setTotalItemsExact(true);
        setProviderUnsupportedFilters([]);
    }, []);

    const handleQueryChange = useCallback((text: string) => {
        if (text !== query) {
            submittedQuery.current = null;
            selectedProvider.current = undefined;
            searchRequestId.current += 1;
            lastSearchSignature.current = null;
            pendingRecentSearchSignature.current = null;
            setResults([]);
            setLoading(false);
            setLoadingMore(false);
            setStartIndex(0);
            setHasMore(false);
            setTotalItems(0);
            setTotalItemsExact(true);
            setProviderUnsupportedFilters([]);
            setShowCachedResultsNotice(false);
            setShowOpenLibraryFallbackNotice(false);
            setError(null);
        }
        setQuery(text);
        setShowSuggestions(text.length >= 2);
    }, [query]);

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
        submittedQuery.current = suggestion.trim();
        setQuery(suggestion);
        setShowSuggestions(false);
        const signature = getSearchSignature(suggestion, filters);
        if (lastSearchSignature.current !== signature) {
            lastSearchSignature.current = signature;
            performSearch(suggestion, 0, true);
        }
    }, [filters, performSearch]);

    const handleFilterApply = useCallback((newFilters: SearchFilters) => {
        pendingRecentSearchSignature.current = null;
        setFilters(newFilters);
    }, []);

    const handleFilterRemove = useCallback((key: keyof SearchFilters) => {
        const newFilters = { ...filters };
        delete newFilters[key];
        pendingRecentSearchSignature.current = null;
        setFilters(newFilters);
    }, [filters]);

    // Sort results
    const sortedResults = useMemo(() => sortSearchResults(results, sortBy), [results, sortBy]);

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
            notify({ kind: 'success', message: `"${book.volumeInfo.title}" is now in your library` });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to add book. Please try again.';
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            notify({ kind: 'error', message });
        } finally {
            setAddingId(null);
        }
    }, [session, queryClient, refreshWishlist, notify]);

    const handleManualAddBook = useCallback(async () => {
        if (!session?.user) return;

        const trimmedTitle = manualTitle.trim();
        const trimmedAuthor = manualAuthor.trim();

        if (!trimmedTitle) {
            notify({ kind: 'error', message: 'Enter a book title to add it manually.' });
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
            notify({ kind: 'success', message: `"${bookData.title}" is now in your library` });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to add book manually.';
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            notify({ kind: 'error', message });
        } finally {
            setManualSubmitting(false);
        }
    }, [session, manualTitle, manualAuthor, queryClient, refreshWishlist, closeManualEntryModal, handleClear, notify]);

    const handlePreview = useCallback(async (previewLink?: string) => {
        if (!previewLink) {
            notify({ kind: 'info', message: 'Preview is not available for this book.' });
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            await Linking.openURL(previewLink);
        } catch (err) {
            notify({ kind: 'error', message: 'Could not open preview link.' });
        }
    }, [notify]);

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
            notify({ kind: 'info', message: 'This book is already in your library.' });
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setWishlistTogglingId(book.id);

        try {
            const success = await toggleWishlist(book);

            if (!success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                notify({ kind: 'error', message: 'Failed to update wishlist' });
                return;
            }

            await queryClient.invalidateQueries({ queryKey: ['library'] });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update wishlist';
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            notify({ kind: 'error', message });
        } finally {
            setWishlistTogglingId(null);
        }
    }, [session, libraryBookIds, wishlistBookIds, toggleWishlist, queryClient, notify]);

    // Render book card using extracted component
    const renderItem = useCallback(({ item, index }: { item: GoogleBook; index: number }) => (
        <SwipeableBookCard
            book={item}
            index={index}
            isInLibrary={libraryBookIds.has(item.id)}
            isAdding={addingId === item.id}
            isInWishlist={wishlistBookIds.has(item.id)}
            isTogglingWishlist={wishlistTogglingId === item.id}
            onSwipeAddToLibrary={handleAddBook}
            onSwipeAddToWishlist={handleWishlistToggle}
            onPreview={handlePreview}
            onShare={handleShare}
        />
    ), [libraryBookIds, addingId, wishlistBookIds, wishlistTogglingId, handleAddBook, handlePreview, handleShare, handleWishlistToggle]);

    // Render helpers
    const renderSkeletons = () => (
        <View>
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </View>
    );

    const renderError = () => (
        <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 64, paddingHorizontal: 32 }}>
            <View style={{ width: 68, height: 68, backgroundColor: colors.bgSecondary, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
                <Ionicons name="alert-circle-outline" size={34} color={colors.error} />
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: 22, fontFamily: fonts.heading, textAlign: 'center' }}>Search couldn’t finish</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, fontFamily: fonts.body, textAlign: 'center', marginTop: 8 }}>{error}</Text>
            <TouchableOpacity
                onPress={handleSearch}
                style={{ backgroundColor: colors.accent, paddingHorizontal: 18, minHeight: 44, borderRadius: 12, marginTop: 20, flexDirection: 'row', alignItems: 'center' }}
                accessibilityLabel="Try Again"
                accessibilityHint="Retry the failed search"
            >
                <Ionicons name="refresh" size={18} color={colors.onAccent} />
                <Text style={{ color: colors.onAccent, fontSize: 14, fontFamily: fonts.label, marginLeft: 8 }}>Try Again</Text>
            </TouchableOpacity>
        </View>
    );

    const renderEmptyState = () => (
        <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 54, paddingHorizontal: 32 }}>
            <View style={{ width: 82, height: 82, backgroundColor: colors.bgCard, borderRadius: 41, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
                <Ionicons name="book-outline" size={38} color={colors.accent} />
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: 26, fontFamily: fonts.heading, textAlign: 'center', marginBottom: 6 }}>Find your next read</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, fontFamily: fonts.body, textAlign: 'center', lineHeight: 21 }}>
                Search books, authors, or ISBNs. Add a title to your shelf or wishlist.
            </Text>
        </View>
    );

    const renderNoResults = () => (
        <View style={styles.noResultsContainer}>
            <View style={[styles.noResultsIconCircle, { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border }]}>
                <Ionicons name="search-outline" size={36} color={colors.textTertiary} />
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: 22, fontFamily: fonts.heading, textAlign: 'center' }}>
                {searchIsOffline ? 'Search unavailable offline' : 'No books found'}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, fontFamily: fonts.body, textAlign: 'center', marginTop: 8, lineHeight: 21 }}>
                {searchIsOffline
                    ? 'Reconnect to the internet to search book catalogues.'
                    : 'Try a different search term or adjust filters'}
            </Text>
            {!searchIsOffline && showOpenLibraryFallbackNotice && (
                <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary, fontSize: 12, fontFamily: fonts.body, textAlign: 'center', marginTop: 12, lineHeight: 18 }}>
                    {providerNotice}
                </Text>
            )}
            {!searchIsOffline && <TouchableOpacity
                testID="library-manual-entry-open"
                onPress={openManualEntryModal}
                style={[styles.manualEntryButton, { backgroundColor: colors.accent }]}
                accessibilityRole="button"
                accessibilityLabel="Add book manually"
                accessibilityHint="Opens a form to add a book without Google Books results"
            >
                <Ionicons name="create-outline" size={18} color={colors.onAccent} />
                <Text style={[styles.manualEntryButtonText, { color: colors.onAccent, fontFamily: fonts.label }]}>
                    Add it manually
                </Text>
            </TouchableOpacity>}
            {!searchIsOffline && <Text style={{ color: colors.textTertiary, fontSize: 12, fontFamily: fonts.body, textAlign: 'center', marginTop: 10 }}>
                Can’t find the book? Save a basic title and optional author to your library.
            </Text>}
        </View>
    );

    const renderShortQuery = () => (
        <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 40 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 21, fontFamily: fonts.heading, textAlign: 'center' }}>
                Keep typing to search
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, fontFamily: fonts.body, textAlign: 'center', marginTop: 8 }}>
                Enter at least 3 characters to search the catalogues.
            </Text>
        </View>
    );

    const activeFiltersCount = [
        filters.genre && filters.genre !== 'all',
        filters.language && filters.language !== 'all',
        filters.priceType && filters.priceType !== 'all',
    ].filter(Boolean).length;
    const displayedResultCount = totalItems > 0 ? totalItems : results.length;
    const fallbackFiltersNotApplied = showOpenLibraryFallbackNotice && providerUnsupportedFilters.length > 0;
    const resultsCountLabel = fallbackFiltersNotApplied
        ? `${results.length} shown`
        : `${totalItemsExact ? '' : 'About '}${displayedResultCount.toLocaleString()} ${displayedResultCount === 1 ? 'result' : 'results'}`;
    const providerNotice = providerUnsupportedFilters.includes('priceType')
        ? 'Showing results from Open Library. It does not provide book pricing, so the Free/Paid filter was not applied.'
        : providerUnsupportedFilters.length > 0
            ? `Showing Open Library results. It cannot apply the ${providerUnsupportedFilters.join(' and ')} filter${providerUnsupportedFilters.length === 1 ? '' : 's'}.`
        : 'Showing results from Open Library while Google Books is unavailable.';

    return (
        <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
            {/* Offline Banner */}
            <OfflineBanner visible={searchIsOffline} variant="library" />

            <View style={{ flex: 1, paddingTop: 56, paddingHorizontal: 18, width: '100%', maxWidth: 1000, alignSelf: 'center' }}>
                {/* Header with Back Button */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                    <TouchableOpacity
                        onPress={() => navigateBackOrFallback(router, '/(tabs)/library')}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            backgroundColor: colors.bgCard,
                            borderWidth: 1,
                            borderColor: colors.border,
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Back to Library"
                    >
                        <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <View style={{ marginLeft: 12, flex: 1, minWidth: 0 }}>
                        <Text accessibilityRole="header" style={{ fontSize: 27, lineHeight: 31, fontFamily: fonts.heading, color: colors.textPrimary }}>
                            Find books
                        </Text>
                        <Text style={{ fontSize: 12, fontFamily: fonts.body, color: colors.textSecondary, marginTop: 1 }}>
                            Search the catalogue by title, author, or ISBN
                        </Text>
                    </View>
                </View>

                {/* Search Bar */}
                <View style={{ position: 'relative', zIndex: 100 }}>
                    <SearchBar
                        query={query}
                        onQueryChange={handleQueryChange}
                        onSubmit={handleSearch}
                        onClear={handleClear}
                        loading={loading}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                    />

                    {/* Suggestions Dropdown */}
                    <SearchSuggestions
                        suggestions={suggestions}
                        recentSearches={recentSearches}
                        onSelect={handleSuggestionSelect}
                        visible={showSuggestions && isFocused && query.length >= 2}
                    />
                </View>

                {/* Filter Chips */}
                <FilterChips filters={filters} onRemove={handleFilterRemove} />

                {/* Recent Searches */}
                {results.length === 0 && !loading && !query && (
                    <RecentSearches
                        searches={recentSearches}
                        onSearch={(q) => {
                            submittedQuery.current = q.trim();
                            setQuery(q);
                            performSearch(q, 0, true);
                        }}
                        onRemove={removeRecentSearch}
                    />
                )}

                {/* Results Header with Sort & Filter */}
                {results.length > 0 && !loading && (
                    <>
                        {showCachedResultsNotice && (
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    marginBottom: 12,
                                    paddingHorizontal: 12,
                                    paddingVertical: 10,
                                    borderRadius: 14,
                                    backgroundColor: colors.bgCard,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                }}
                            >
                                <Ionicons name="cloud-offline-outline" size={16} color={colors.textSecondary} />
                                <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: fonts.body, marginLeft: 8, flex: 1 }}>
                                    Showing recent cached Google Books results.
                                </Text>
                            </View>
                        )}
                        {showOpenLibraryFallbackNotice && (
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    marginBottom: 12,
                                    paddingHorizontal: 12,
                                    paddingVertical: 10,
                                    borderRadius: 14,
                                    backgroundColor: colors.bgCard,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                }}
                            >
                                <Ionicons name="library-outline" size={16} color={colors.textSecondary} />
                                <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: fonts.body, marginLeft: 8, flex: 1 }}>
                                    {providerNotice}
                                </Text>
                            </View>
                        )}

                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <Text accessibilityLiveRegion="polite" style={{ fontSize: 13, color: colors.textSecondary, fontFamily: fonts.body }}>
                                {resultsCountLabel}
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
                                        justifyContent: 'center',
                                        minHeight: 44,
                                        minWidth: 88,
                                        backgroundColor: activeFiltersCount > 0 ? colors.accent : colors.bgCard,
                                        paddingHorizontal: 12,
                                        borderRadius: 12,
                                        borderWidth: 1,
                                        borderColor: activeFiltersCount > 0 ? colors.accent : colors.border,
                                    }}
                                    accessibilityLabel="Filter results"
                                    accessibilityHint="Opens filter options"
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: activeFiltersCount > 0, expanded: showFilterModal }}
                                >
                                    <Ionicons name="filter-outline" size={16} color={activeFiltersCount > 0 ? colors.onAccent : colors.textSecondary} />
                                    <Text style={{ color: activeFiltersCount > 0 ? colors.onAccent : colors.textPrimary, fontSize: 12, fontFamily: fonts.label, marginLeft: 5 }}>Filter</Text>
                                    {activeFiltersCount > 0 && (
                                        <Text style={{ color: colors.onAccent, fontSize: 11, fontFamily: fonts.label, marginLeft: 4 }}>
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
                                        justifyContent: 'center',
                                        minHeight: 44,
                                        minWidth: 78,
                                        backgroundColor: colors.bgCard,
                                        paddingHorizontal: 12,
                                        borderRadius: 12,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                    }}
                                    accessibilityLabel="Sort results"
                                    accessibilityHint="Opens sort options"
                                    accessibilityRole="button"
                                    accessibilityState={{ expanded: showSortModal }}
                                >
                                    <Ionicons name="swap-vertical" size={16} color={colors.textSecondary} />
                                    <Text style={{ color: colors.textPrimary, fontSize: 12, fontFamily: fonts.label, marginLeft: 5 }}>Sort</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </>
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
                        ListFooterComponent={<LoadingFooter loading={loadingMore} />}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={handleRefresh}
                                tintColor={colors.accent}
                                colors={[colors.accent]}
                            />
                        }
                        ListEmptyComponent={searchIsOffline && query
                            ? renderNoResults()
                            : query.trim().length > 0 && query.trim().length < 3 && submittedQuery.current !== query.trim()
                                ? renderShortQuery()
                                : query
                                    ? renderNoResults()
                                    : renderEmptyState()}
                    />
                )}
            </View>

            {/* Modals */}
            <SortModal
                visible={showSortModal}
                onClose={() => setShowSortModal(false)}
                currentSort={sortBy}
                onSelect={setSortBy}
            />

            <FilterModal
                visible={showFilterModal}
                onClose={() => setShowFilterModal(false)}
                filters={filters}
                onApply={handleFilterApply}
            />

            <ManualEntryModal
                visible={showManualEntryModal}
                title={manualTitle}
                author={manualAuthor}
                submitting={manualSubmitting}
                onTitleChange={setManualTitle}
                onAuthorChange={setManualAuthor}
                onCancel={closeManualEntryModal}
                onSave={handleManualAddBook}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    noResultsContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 80,
        paddingHorizontal: 32,
    },
    noResultsIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    manualEntryButton: {
        marginTop: 20,
        paddingHorizontal: 18,
        minHeight: 44,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
    },
    manualEntryButtonText: {
        fontSize: 14,
        marginLeft: 8,
    },
});
