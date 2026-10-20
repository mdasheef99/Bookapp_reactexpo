import {
    View,
    Text,
    FlatList,
    ActivityIndicator,
    Share,
    Linking,
    RefreshControl,
    StyleSheet,
} from 'react-native';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import { booksService, GoogleBook, SearchFilters } from '@/features/books/services/booksService';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useWishlist } from '@/hooks/useWishlist';
import * as Haptics from 'expo-haptics';
import { SortOption } from '@/lib/constants';
import { navigateBackOrFallback } from '@/lib/navigation';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import { LIBRARY_SPACING, useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { useTheme } from '@/hooks/useTheme';
import { BookButton, BookEmpty, BookLoading, BookScreenHeader, useBookFeedback } from '@/components/library/ui';
import { COLUMN_MAX_WIDTH } from '@/components/library/bookDetails/bookDetailsTokens';
import { addBookErrorMessage, manualAddErrorMessage, searchErrorMessage, wishlistErrorMessage } from '@/features/books/utils/searchErrorCopy';
import { sortSearchResults } from '@/features/books/utils/searchResults';

// Import components
import { SearchBar } from '@/components/search';
import {
    SortModal,
    RecentSearches,
    SearchSuggestions,
    FilterModal,
    FilterChips,
    SwipeableBookCard,
    ManualEntryModal,
} from '@/components/library/search';

// Loading footer for pagination
const LoadingFooter = ({ loading }: { loading: boolean }) => {
    const colors = useLibraryAppearance();
    if (!loading) return null;
    return (
        <View style={styles.loadingFooter}>
            <ActivityIndicator color={colors.accent} accessibilityLabel="Loading more results" />
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
    const { colors: themeColors } = useTheme();
    // The shared SearchBar takes a full theme palette; library colours win.
    const searchPalette = useMemo(() => ({ ...themeColors, ...colors }), [themeColors, colors]);
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
            if (__DEV__) console.warn('Book search failed', err);
            const message = searchErrorMessage(err);
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
            if (__DEV__) console.warn('Add book failed', error);
            const message = addBookErrorMessage(error);
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
            if (__DEV__) console.warn('Manual add failed', error);
            const message = manualAddErrorMessage(error);
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
            notify({ kind: 'error', message: "Couldn't open the preview." });
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
                notify({ kind: 'error', message: wishlistErrorMessage(false) });
                return;
            }

            await queryClient.invalidateQueries({ queryKey: ['library'] });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            if (__DEV__) console.warn('Wishlist update failed', error);
            const message = wishlistErrorMessage(error);
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
    const renderError = () => (
        <View accessibilityRole="alert" style={styles.state}>
            <BookEmpty title="Search couldn’t finish" message={error ?? undefined}
                actionLabel="Try again" onAction={handleSearch} />
        </View>
    );

    const renderEmptyState = () => (
        <View style={styles.state}>
            <Text style={[LIBRARY_TEXT.heading, styles.centerText, { color: colors.textPrimary }]}>Find your next book</Text>
            <Text style={[LIBRARY_TEXT.body, styles.centerText, { color: colors.textSecondary }]}>
                Search books, authors or ISBNs, then add a title to your library or wishlist.
            </Text>
        </View>
    );

    const renderNoResults = () => (
        <View style={styles.state}>
            <BookEmpty title={searchIsOffline ? 'Search needs a connection' : 'No books found'}
                message={searchIsOffline ? 'Reconnect to search the catalogues.' : 'Try another search or change the filters.'} />
            {!searchIsOffline && showOpenLibraryFallbackNotice && (
                <Text accessibilityLiveRegion="polite" style={[LIBRARY_TEXT.caption, styles.centerText, { color: colors.textSecondary }]}>{providerNotice}</Text>
            )}
            {!searchIsOffline && <BookButton testID="library-manual-entry-open" label="Add it manually"
                variant="primary" onPress={openManualEntryModal} />}
            {!searchIsOffline && <Text style={[LIBRARY_TEXT.body, styles.centerText, { color: colors.textSecondary }]}>
                {"Can't find it? Save a title and author to your library."}
            </Text>}
        </View>
    );

    const renderShortQuery = () => (
        <View style={styles.state}>
            <BookEmpty title="Keep typing" message="Enter at least 3 characters to search." />
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
        <View style={[styles.screen, { backgroundColor: colors.bgPrimary }]}>
            <View style={styles.column} aria-hidden={showManualEntryModal || showFilterModal || showSortModal}
                accessibilityElementsHidden={showManualEntryModal || showFilterModal || showSortModal}
                importantForAccessibility={showManualEntryModal || showFilterModal || showSortModal ? 'no-hide-descendants' : 'auto'}>
                <BookScreenHeader backLabel="Back to library" onBack={() => navigateBackOrFallback(router, '/(tabs)/library')} />
                <View style={styles.heading}>
                    <Text accessibilityRole="header" role="heading" aria-level={1} style={[LIBRARY_TEXT.title, { color: colors.textPrimary }]}>Find books</Text>
                    <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>Search by title, author or ISBN.</Text>
                    {searchIsOffline && <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>Offline · Search needs a connection.</Text>}
                </View>

                {/* Search Bar */}
                <View style={styles.search}>
                    <SearchBar
                        query={query}
                        onQueryChange={handleQueryChange}
                        onSubmit={handleSearch}
                        onClear={handleClear}
                        loading={loading}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        paletteOverride={searchPalette}
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
                            <Text style={[LIBRARY_TEXT.caption, styles.notice, { color: colors.textSecondary }]}>Showing recent cached Google Books results.</Text>
                        )}
                        {showOpenLibraryFallbackNotice && (
                            <Text style={[LIBRARY_TEXT.caption, styles.notice, { color: colors.textSecondary }]}>{providerNotice}</Text>
                        )}
                        <View style={styles.resultsHeader}>
                            <Text accessibilityLiveRegion="polite" style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>{resultsCountLabel}</Text>
                            <View style={styles.resultControls}>
                                <BookButton label={activeFiltersCount > 0 ? `Filter (${activeFiltersCount})` : 'Filter'} variant="secondary"
                                    selected={activeFiltersCount > 0} expanded={showFilterModal} onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setShowFilterModal(true);
                                }} />
                                <BookButton label="Sort" variant="secondary" expanded={showSortModal} onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setShowSortModal(true);
                                }} />
                            </View>
                        </View>
                    </>
                )}

                {/* Content */}
                {error ? (
                    renderError()
                ) : loading ? (
                    <BookLoading variant="list" label="Searching books" />
                ) : (
                    <FlatList
                        data={sortedResults}
                        keyExtractor={(item, index) => `${item.id}-${index}`}
                        renderItem={renderItem}
                        contentContainerStyle={styles.results}
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
    screen: { flex: 1 },
    column: { flex: 1, width: '100%', maxWidth: COLUMN_MAX_WIDTH, alignSelf: 'center', paddingHorizontal: LIBRARY_SPACING.md },
    heading: { gap: LIBRARY_SPACING.xs, marginBottom: LIBRARY_SPACING.md },
    search: { position: 'relative', zIndex: 100 },
    resultsHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: LIBRARY_SPACING.xs, marginBottom: LIBRARY_SPACING.sm },
    resultControls: { flexDirection: 'row', gap: LIBRARY_SPACING.xs },
    notice: { marginBottom: LIBRARY_SPACING.sm },
    results: { paddingBottom: LIBRARY_SPACING.xxl },
    state: { alignItems: 'center', paddingVertical: LIBRARY_SPACING.xl, gap: LIBRARY_SPACING.md },
    centerText: { textAlign: 'center' },
    loadingFooter: { paddingVertical: LIBRARY_SPACING.lg, alignItems: 'center' },
});
