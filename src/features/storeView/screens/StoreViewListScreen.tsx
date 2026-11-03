import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import type { ImageInventoryIdentity } from '@/features/imageInventory/queries/ownerUxQueries';
import { useTheme } from '@/hooks/useTheme';
import { StoreViewCard } from '../components/StoreViewCard';
import { FILTER_LABELS } from '../components/storeViewPresentation';
import { STORE_VIEW_FILTERS, type StoreViewFilter } from '../contracts/storeViewContracts';
import { storeViewKeys, useStoreViewPage } from '../queries/storeViewQueries';
import { StoreViewAccessBoundary } from './StoreViewAccessBoundary';
import { createStoreViewFilterSession, createStoreViewSummarySession } from '../state/storeViewFilterPreference';
import { StoreViewSummaryPanel } from '../components/StoreViewSummaryPanel';
import { storeViewSummaryKeys, useStoreViewSummary } from '../queries/storeViewSummaryQueries';
import { isEditAccessLost } from '../state/storeViewEditRebase';

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
    // Remount local selection immediately on identity changes, before any stored read.
    return <StoreViewIdentityList key={JSON.stringify([identity.userId, identity.storeId])} identity={identity} />;
}

function StoreViewIdentityList({ identity }: { identity: ImageInventoryIdentity }) {
    const { colors } = useTheme();
    const [filter, setFilter] = useState<StoreViewFilter>('all');
    const [preference] = useState(() => createStoreViewFilterSession(identity));
    const tapped = useRef(false);
    const [summaryOpen, setSummaryOpen] = useState(false);
    const [summaryPreference] = useState(() => createStoreViewSummarySession(identity));
    const summaryToggled = useRef(false);
    const [accessLost, setAccessLost] = useState(false);
    useEffect(() => {
        let active = true;
        void preference.read().then((stored) => { if (active && !tapped.current) setFilter(stored); });
        return () => { active = false; };
    }, [preference]);
    useEffect(() => {
        let active = true;
        void summaryPreference.read().then(stored => {
            if (active && !summaryToggled.current) setSummaryOpen(stored);
        });
        return () => { active = false; };
    }, [summaryPreference]);
    const selectFilter = (value: StoreViewFilter) => {
        tapped.current = true;
        setFilter(value);
        void preference.write(value);
    };
    const query = useStoreViewPage(identity, filter);
    const summary = useStoreViewSummary(identity);
    const { refetch: refetchSummary } = summary;
    const { refetch: refetchPage } = query;
    const firstFocus = useRef(true);
    useFocusEffect(useCallback(() => {
        // The mount fetch is already in flight; only refetch on later focuses
        // so the counts and the cached list cannot disagree.
        if (firstFocus.current) { firstFocus.current = false; return; }
        void refetchSummary();
        void refetchPage();
    }, [refetchSummary, refetchPage]));
    const initialLoading = query.isPending && query.items.length === 0;
    const initialError = query.isError && query.items.length === 0;
    // The screen can render without a QueryClient in unit tests; the
    // access-lost removal below simply skips when none is available.
    let queryClient: ReturnType<typeof useQueryClient> | null = null;
    try {
        queryClient = useQueryClient();
    } catch {
        queryClient = null;
    }
    const handleStoreViewAccessLost = () => {
        // Cached owner-only rows must not linger after the owner loses
        // store access. Same removal path as the detail screen, scoped to
        // the list caches (every server filter page plus the summary).
        for (const value of STORE_VIEW_FILTERS) {
            queryClient?.removeQueries({ queryKey: storeViewKeys.page(identity, value) });
        }
        queryClient?.removeQueries({ queryKey: storeViewSummaryKeys.summary(identity) });
        setAccessLost(true);
    };
    // Access loss on either the page or the summary read — initial or
    // background — routes to the access-lost path. Temporary errors keep
    // the current behaviour (the last good data stays on screen).
    // This effect (and the handler above) must stay before the early
    // return: when access is lost the next render takes the unavailable
    // branch, and hooks after an early return would break hook order.
    const pageError = query.error as { code?: unknown; httpStatus?: unknown } | null | undefined;
    const summaryError = summary.error as { code?: unknown; httpStatus?: unknown } | null | undefined;
    useEffect(() => {
        for (const queryError of [pageError, summaryError]) {
            if (!queryError) continue;
            const code = typeof queryError.code === 'string' ? queryError.code : null;
            const rawStatus = queryError.httpStatus;
            if (isEditAccessLost({
                code,
                httpStatus: typeof rawStatus === 'number' ? rawStatus : null,
            })) {
                handleStoreViewAccessLost();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageError, summaryError]);
    if (accessLost) {
        return (
            <ScreenBackground>
                <View style={{ padding: 20 }}>
                    <StateCard
                        title="Store View unavailable"
                        body="Active Store Owner access is required. No private inventory details were shown."
                    />
                </View>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <FlatList
                refreshing={Boolean(query.isRefetching || summary.isRefetching)}
                onRefresh={() => { void query.refetch(); void refetchSummary(); }}
                contentInsetAdjustmentBehavior="automatic"
                data={query.items}
                keyExtractor={(item) => item.identity.inventoryId}
                renderItem={({ item }) => <StoreViewCard item={item} />}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
                ListHeaderComponent={(
                    <View style={{ gap: 14, paddingBottom: 14 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '800' }}>Store View</Text>
                            <Pressable testID="store-view-summary-button" accessibilityRole="button"
                                accessibilityLabel={summaryOpen ? 'Hide summary' : 'Summary'} accessibilityState={{ expanded: summaryOpen }}
                                onPress={() => {
                                    summaryToggled.current = true;
                                    setSummaryOpen(!summaryOpen);
                                    void summaryPreference.write(!summaryOpen);
                                }} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 }}>
                                <Text style={{ color: colors.accent, fontWeight: '700' }}>{summaryOpen ? 'Hide summary' : 'Summary'}</Text>
                            </Pressable>
                        </View>
                        <Text selectable style={{ color: colors.textSecondary, lineHeight: 20 }}>
                            Manage committed books. Filters are applied by the server before pagination.
                        </Text>
                        {summaryOpen ? <StoreViewSummaryPanel data={summary.data} pending={summary.isPending}
                            paused={summary.fetchStatus === 'paused'} error={summary.isError} onRetry={() => void refetchSummary()} onSelect={selectFilter} /> : null}
                        <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {STORE_VIEW_FILTERS.map((value) => {
                                const selected = value === filter;
                                return (
                                    <Pressable
                                        key={value}
                                        testID={`store-view-filter-${value}`}
                                        accessibilityRole="tab"
                                        accessibilityState={{ selected }}
                                        onPress={() => selectFilter(value)}
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
