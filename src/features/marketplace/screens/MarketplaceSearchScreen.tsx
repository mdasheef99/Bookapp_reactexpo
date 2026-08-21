import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { SearchBar } from '@/components/search/SearchBar';
import { useTheme } from '@/hooks/useTheme';
import { useMarketplaceSearch } from '../hooks/useMarketplaceSearch';
import { BookstoreResultCard } from '../components/BookstoreResultCard';
import { MarketplaceDisclosure } from '../components/MarketplaceDisclosure';

export default function MarketplaceSearchScreen() {
    const { colors } = useTheme();
    const [query, setQuery] = useState('');
    const {
        results, bookstoreCount, nextCursor, isLoading, isLoadingMore,
        error, searchNow, retry, loadMore,
    } = useMarketplaceSearch(query);

    const handleSubmit = () => {
        const trimmed = query.trim();
        if (trimmed) void searchNow(trimmed);
    };

    return (
        <ScreenBackground>
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>Bookstore marketplace</Text>
                <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>
                    Find a local bookstore carrying your book
                </Text>
                <View style={styles.commerceLinks}>
                    <Pressable accessibilityRole="button" accessibilityLabel="Open cart"
                        onPress={() => router.push('/(tabs)/marketplace/cart' as never)} style={styles.touchTarget}>
                        <Text style={[styles.link, { color: colors.accent }]}>Cart</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="Open order requests"
                        onPress={() => router.push('/(tabs)/marketplace/requests' as never)} style={styles.touchTarget}>
                        <Text style={[styles.link, { color: colors.accent }]}>Order requests</Text>
                    </Pressable>
                </View>
                <SearchBar query={query} onQueryChange={setQuery} onSubmit={handleSubmit}
                    onClear={() => setQuery('')} loading={isLoading} autoFocus={false}
                    maxLength={200}
                    placeholder="Search by title, author, or ISBN..." />
                <MarketplaceDisclosure />
                {error ? (
                    <View style={styles.messageBlock} accessibilityLiveRegion="polite">
                        <Text style={[styles.message, { color: colors.error }]}>{error}</Text>
                        <Pressable accessibilityRole="button" accessibilityLabel="Retry marketplace search"
                            onPress={() => void retry()} style={styles.touchTarget}>
                            <Text style={[styles.link, { color: colors.accent }]}>Retry</Text>
                        </Pressable>
                    </View>
                ) : null}
                {isLoading ? <View style={styles.loading}><ActivityIndicator size="large" color={colors.accent} /></View> : null}
                {!isLoading && !query.trim() && !error ? (
                    <Text style={[styles.guidance, { color: colors.textSecondary }]}>
                        Search by title, author, or ISBN to compare local bookstore availability. Results are bookstores, each shown once.
                    </Text>
                ) : null}
                {!isLoading && query.trim() && results.length === 0 && !error ? (
                    <View style={styles.messageBlock} accessibilityLiveRegion="polite">
                        <Text accessibilityRole="header" style={[styles.emptyTitle, { color: colors.textPrimary }]}>No bookstores found</Text>
                        <Text style={[styles.message, { color: colors.textSecondary }]}>Try another title, author, or ISBN.</Text>
                    </View>
                ) : null}
                {!isLoading && results.length ? (
                    <View style={styles.results}>
                        <Text accessibilityRole="header" style={[styles.resultsCount, { color: colors.textSecondary }]}>
                            {bookstoreCount} {bookstoreCount === 1 ? 'bookstore' : 'bookstores'} found
                        </Text>
                        {results.map((result) => (
                            <BookstoreResultCard key={result.store.publicStoreId} result={result} searchQuery={query.trim()} />
                        ))}
                        {nextCursor ? (
                            <Pressable accessibilityRole="button" accessibilityLabel="Load more bookstores"
                                disabled={isLoadingMore} onPress={() => void loadMore()}
                                style={[styles.loadMore, { borderColor: colors.border }]}>
                                {isLoadingMore ? <ActivityIndicator color={colors.accent} />
                                    : <Text style={[styles.link, { color: colors.accent }]}>Load more bookstores</Text>}
                            </Pressable>
                        ) : null}
                    </View>
                ) : null}
            </ScrollView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { padding: 24, paddingBottom: 40, gap: 14 },
    eyebrow: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
    title: { fontSize: 26, fontWeight: '800' },
    commerceLinks: { flexDirection: 'row', gap: 18 },
    touchTarget: { minHeight: 44, justifyContent: 'center' },
    link: { fontSize: 13, fontWeight: '800' },
    loading: { paddingVertical: 40, alignItems: 'center' },
    guidance: { paddingVertical: 30, fontSize: 13, lineHeight: 19, textAlign: 'center' },
    messageBlock: { paddingVertical: 24, alignItems: 'center', gap: 8 },
    message: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
    emptyTitle: { fontSize: 18, fontWeight: '700' },
    results: { gap: 10 },
    resultsCount: { fontSize: 13, fontWeight: '700' },
    loadMore: { minHeight: 48, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
