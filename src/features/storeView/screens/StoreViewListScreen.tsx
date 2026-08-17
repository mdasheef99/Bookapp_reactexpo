import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import type { ImageInventoryIdentity } from '@/features/imageInventory/queries/ownerUxQueries';
import { useTheme } from '@/hooks/useTheme';
import { StoreViewCard } from '../components/StoreViewCard';
import { FILTER_LABELS } from '../components/storeViewPresentation';
import { STORE_VIEW_FILTERS, type StoreViewFilter } from '../contracts/storeViewContracts';
import { useStoreViewPage } from '../queries/storeViewQueries';
import { StoreViewAccessBoundary } from './StoreViewAccessBoundary';

function StateCard({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
    const { colors } = useTheme();
    return (
        <GlassCard padding={18} borderRadius={16}>
            <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '800' }}>
                {title}
            </Text>
            <Text selectable style={{ color: colors.textSecondary, paddingTop: 6, lineHeight: 20 }}>
                {body}
            </Text>
            {onRetry ? (
                <Pressable
                    testID="store-view-retry"
                    accessibilityRole="button"
                    onPress={onRetry}
                    style={{ alignSelf: 'flex-start', paddingTop: 12 }}
                >
                    <Text style={{ color: colors.accent, fontWeight: '800' }}>Try again</Text>
                </Pressable>
            ) : null}
        </GlassCard>
    );
}

export function StoreViewListContent({ identity }: { identity: ImageInventoryIdentity }) {
    const { colors } = useTheme();
    const [filter, setFilter] = useState<StoreViewFilter>('all');
    const query = useStoreViewPage(identity, filter);
    const initialLoading = query.isPending && query.items.length === 0;
    const initialError = query.isError && query.items.length === 0;

    return (
        <ScreenBackground>
            <FlatList
                contentInsetAdjustmentBehavior="automatic"
                data={query.items}
                keyExtractor={(item) => item.identity.inventoryId}
                renderItem={({ item }) => <StoreViewCard item={item} />}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
                ListHeaderComponent={(
                    <View style={{ gap: 14, paddingBottom: 14 }}>
                        <Text selectable style={{ color: colors.textSecondary, lineHeight: 20 }}>
                            Manage committed books. Filters are applied by the server before pagination.
                        </Text>
                        <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {STORE_VIEW_FILTERS.map((value) => {
                                const selected = value === filter;
                                return (
                                    <Pressable
                                        key={value}
                                        testID={`store-view-filter-${value}`}
                                        accessibilityRole="tab"
                                        accessibilityState={{ selected }}
                                        onPress={() => setFilter(value)}
                                        style={{ borderWidth: 1, borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accent : colors.bgCard, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }}
                                    >
                                        <Text style={{ color: selected ? '#FFFFFF' : colors.textPrimary, fontWeight: '700', fontSize: 13 }}>
                                            {FILTER_LABELS[value]}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                        {initialLoading ? (
                            <GlassCard padding={18} borderRadius={16}>
                                <ActivityIndicator color={colors.accent} />
                                <Text selectable style={{ color: colors.textSecondary, textAlign: 'center', paddingTop: 8 }}>
                                    Loading Store View…
                                </Text>
                            </GlassCard>
                        ) : null}
                        {initialError ? (
                            <StateCard title="Store View could not be loaded" body="No private inventory details were shown." onRetry={() => void query.refetch()} />
                        ) : null}
                        {!initialLoading && !initialError && query.items.length === 0 ? (
                            <StateCard
                                title={filter === 'all'
                                    ? 'No committed books'
                                    : `No ${FILTER_LABELS[filter].toLowerCase()} books`}
                                body="No committed books match this server filter."
                            />
                        ) : null}
                    </View>
                )}
                ListFooterComponent={query.items.length > 0 ? (
                    <View style={{ paddingTop: 14, gap: 10 }}>
                        {query.isFetchNextPageError ? (
                            <StateCard title="More books could not be loaded" body="Your loaded books remain visible." onRetry={() => void query.fetchNextPage()} />
                        ) : null}
                        {query.hasNextPage && !query.isFetchNextPageError ? (
                            <Pressable
                                testID="store-view-load-more"
                                accessibilityRole="button"
                                disabled={query.isFetchingNextPage}
                                onPress={() => void query.fetchNextPage()}
                                style={{ minHeight: 46, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
                            >
                                {query.isFetchingNextPage ? <ActivityIndicator color="#FFFFFF" /> : null}
                                <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>
                                    {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
                                </Text>
                            </Pressable>
                        ) : null}
                    </View>
                ) : null}
            />
        </ScreenBackground>
    );
}

export function StoreViewListScreen() {
    return <StoreViewAccessBoundary>{(identity) => <StoreViewListContent identity={identity} />}</StoreViewAccessBoundary>;
}
