import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { SearchBar } from '@/components/search/SearchBar';
import { useTheme } from '@/hooks/useTheme';
import { useMarketplaceSearch } from '../hooks/useMarketplaceSearch';
import { GroupedBookCard } from '../components/GroupedBookCard';
import { MarketplaceDisclosure } from '../components/MarketplaceDisclosure';

export default function MarketplaceSearchScreen() {
    const { colors } = useTheme();
    const [query, setQuery] = useState('');
    const { results, storeResults = [], isLoading, error, searchNow, retry } = useMarketplaceSearch(query);

    const handleSubmit = () => {
        const trimmed = query.trim();
        if (trimmed) {
            void searchNow(trimmed);
        }
    };

    return (
        <ScreenBackground>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>
                    Bookstore marketplace
                </Text>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                    Find books from local bookstores
                </Text>

                <SearchBar
                    query={query}
                    onQueryChange={setQuery}
                    onSubmit={handleSubmit}
                    onClear={() => setQuery('')}
                    loading={isLoading}
                    autoFocus={false}
                    placeholder="Search by title, author, or ISBN..."
                />

                <MarketplaceDisclosure />

                {error ? (
                    <View style={styles.errorBlock}>
                        <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Retry marketplace search"
                            onPress={() => void retry()}
                        >
                            <Text style={[styles.retry, { color: colors.accent }]}>Retry</Text>
                        </Pressable>
                    </View>
                ) : null}

                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.accent} />
                    </View>
                ) : null}

                {!isLoading && !query.trim() && !error ? (
                    <View style={styles.emptyContainer}>
                        <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
                            Search by title, author, or ISBN to compare local bookstore availability.
                        </Text>
                    </View>
                ) : null}

                {!isLoading && query.trim() && results.length === 0 && storeResults.length === 0 && !error ? (
                    <View style={styles.emptyContainer}>
                        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                            No results found
                        </Text>
                        <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
                            Try a different title, author, or ISBN.
                        </Text>
                    </View>
                ) : null}

                {!isLoading && storeResults.length > 0 ? (
                    <View style={styles.resultsList}>
                        <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>Bookstores</Text>
                        {storeResults.map((store) => (
                            <Pressable
                                key={store.storeId}
                                accessibilityRole="button"
                                accessibilityLabel={`View ${store.displayName} public store page`}
                                onPress={() => router.push({
                                    pathname: '/marketplace/store/[storeId]',
                                    params: { storeId: store.storeId },
                                })}
                                style={[styles.storeResult, { borderColor: colors.border }]}
                            >
                                <Text style={[styles.storeResultName, { color: colors.textPrimary }]}>
                                    {store.displayName}
                                </Text>
                                <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
                                    {[store.localityName, store.city].filter(Boolean).join(', ')}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                ) : null}

                {!isLoading && results.length > 0 ? (
                    <View style={styles.resultsList}>
                        <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
                            {results.length} {results.length === 1 ? 'book' : 'books'} found
                        </Text>
                        {results.map((result) => (
                            <GroupedBookCard key={result.groupingKey} result={result} />
                        ))}
                    </View>
                ) : null}
            </ScrollView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 24,
        paddingBottom: 40,
        gap: 14,
    },
    eyebrow: {
        fontSize: 13,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
    },
    loadingContainer: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    error: {
        fontSize: 13,
    },
    errorBlock: {
        gap: 6,
    },
    retry: {
        fontSize: 13,
        fontWeight: '700',
    },
    emptyContainer: {
        paddingVertical: 30,
        alignItems: 'center',
        gap: 6,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    emptyBody: {
        fontSize: 13,
        textAlign: 'center',
    },
    resultsList: {
        gap: 10,
    },
    resultsCount: {
        fontSize: 12,
    },
    storeResult: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        gap: 2,
    },
    storeResultName: {
        fontSize: 14,
        fontWeight: '700',
    },
});
