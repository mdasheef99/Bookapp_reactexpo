import { type ReactNode, useState } from 'react';
import { useRouter } from 'expo-router';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import InventoryFilterPanel from '@/features/stores/components/InventoryFilterPanel';
import { useTheme } from '@/hooks/useTheme';
import {
    OwnerInventoryReadError,
    type OwnerInventoryCondition,
    type OwnerInventoryDateAdded,
    type OwnerInventoryEntryMethod,
    type OwnerInventoryFilters,
    type OwnerInventoryQuantityState,
    type OwnerInventoryVisibilityStatus,
} from '../api/ownerInventoryReadService';
import { InventoryRecoveryCard } from '../components/InventoryRecoveryCard';
import { useOwnerInventoryRead } from '../queries/ownerInventoryReadQueries';
import type { ImageInventoryIdentity } from '../queries/ownerUxQueries';
import {
    OwnerInventoryStateCard,
    ownerInventoryErrorCopy,
} from '../components/OwnerInventoryPresentation';
import { storeViewRoutes } from '@/features/storeView/navigation/storeViewRoutes';

type Props = {
    identity: ImageInventoryIdentity;
    scanHeader?: ReactNode;
};

const INITIAL_FILTERS: Required<OwnerInventoryFilters> = {
    query: '',
    condition: 'all',
    visibilityStatus: 'all',
    quantityState: 'all',
    entryMethod: 'all',
    dateAdded: 'all',
    publicationStatus: 'all',
};

export function OwnerInventoryReadScreen({ identity, scanHeader }: Props) {
    const { colors } = useTheme();
    const router = useRouter();
    const [filters, setFilters] = useState(INITIAL_FILTERS);
    const inventory = useOwnerInventoryRead(identity, filters);
    const error = inventory.error instanceof OwnerInventoryReadError ? inventory.error : null;
    const initialError = inventory.isError && inventory.items.length === 0;
    const initialLoading = inventory.isPending && inventory.items.length === 0;
    const successfulEmpty = inventory.isSuccess
        && !inventory.isError
        && !inventory.isRefreshError
        && inventory.items.length === 0;
    const copy = ownerInventoryErrorCopy(error);
    const resetFiltersAndPagination = async () => {
        setFilters(INITIAL_FILTERS);
        await inventory.resetPagination();
    };
    const isUnauthorized = error?.category === 'unauthorized';
    const initialAction = isUnauthorized
        ? undefined
        : error?.category === 'invalid_cursor'
            ? inventory.resetPagination
            : error?.category === 'invalid_request'
                ? resetFiltersAndPagination
                : inventory.refresh;
    const partialTitle = isUnauthorized
        ? 'Inventory access changed'
        : inventory.isRefreshError
            ? 'Inventory refresh failed'
            : 'More inventory could not be loaded';
    const partialBody = isUnauthorized
        ? 'Active Store Owner access is required. Previously loaded items remain visible but may be stale.'
        : `${copy.body} Previously loaded items remain visible.`;
    const partialAction = isUnauthorized
        ? undefined
        : () => void (
            inventory.isRefreshError
                ? inventory.refresh()
                : error?.category === 'invalid_cursor'
                    ? inventory.resetPagination()
                    : error?.category === 'invalid_request'
                        ? resetFiltersAndPagination()
                        : inventory.loadNextPage()
        );
    return (
        <ScreenBackground>
            <ScrollView
                contentInsetAdjustmentBehavior="automatic"
                contentContainerStyle={styles.container}
            >
                <View style={styles.headingRow}>
                    <View style={{ flex: 1 }}>
                        <Text selectable style={[styles.eyebrow, { color: colors.textSecondary }]}>Store inventory</Text>
                        <Text selectable accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>Inventory</Text>
                    </View>
                    {!isUnauthorized ? (
                        <Pressable
                            testID="owner-inventory-refresh"
                            accessibilityRole="button"
                            disabled={inventory.isRefreshing}
                            onPress={() => void inventory.refresh()}
                            style={[styles.refreshAction, { borderColor: colors.border }]}
                        >
                            <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Refresh</Text>
                        </Pressable>
                    ) : null}
                </View>

                {scanHeader}

                <Text selectable style={[styles.readOnlyNote, { color: colors.textSecondary }]}>
                    Scan, review, and recovery stay here. Committed items are managed in Store View.
                </Text>
                <TextInput
                    testID="owner-inventory-search"
                    accessibilityLabel="Search inventory"
                    placeholder="Search title, author, ISBN..."
                    value={filters.query}
                    onChangeText={(query) => setFilters((current) => ({ ...current, query }))}
                    style={[styles.searchInput, { borderColor: colors.border, color: colors.textPrimary }]}
                />
                <InventoryFilterPanel
                    mode="ownerRead"
                    conditionFilter={filters.condition}
                    setConditionFilter={(condition) => setFilters((current) => ({
                        ...current,
                        condition: condition as OwnerInventoryCondition | 'all',
                    }))}
                    statusFilter={filters.visibilityStatus}
                    setStatusFilter={(visibilityStatus) => setFilters((current) => ({
                        ...current,
                        visibilityStatus: visibilityStatus as OwnerInventoryVisibilityStatus | 'all',
                    }))}
                    quantityFilter={filters.quantityState}
                    setQuantityFilter={(quantityState) => setFilters((current) => ({
                        ...current,
                        quantityState: quantityState as OwnerInventoryQuantityState | 'all',
                    }))}
                    sourceFilter={filters.entryMethod}
                    setSourceFilter={(entryMethod) => setFilters((current) => ({
                        ...current,
                        entryMethod: entryMethod as OwnerInventoryEntryMethod | 'all',
                    }))}
                    dateFilter={filters.dateAdded}
                    setDateFilter={(dateAdded) => setFilters((current) => ({
                        ...current,
                        dateAdded: dateAdded as OwnerInventoryDateAdded | 'all',
                    }))}
                />

                {initialLoading ? (
                    <GlassCard padding={18} borderRadius={16}>
                        <ActivityIndicator color={colors.accent} />
                        <Text selectable style={[styles.centerText, { color: colors.textSecondary }]}>Loading inventory…</Text>
                    </GlassCard>
                ) : null}

                {initialError ? (
                    <OwnerInventoryStateCard
                        title={copy.title}
                        body={copy.body}
                        action={initialAction ? () => void initialAction() : undefined}
                        actionLabel={error?.category === 'invalid_cursor'
                            ? 'Restart pagination'
                            : error?.category === 'invalid_request'
                                ? 'Reset filters'
                                : 'Try again'}
                        testID={error?.category === 'invalid_cursor'
                            ? 'owner-inventory-reset-pagination'
                            : error?.category === 'invalid_request'
                                ? 'owner-inventory-reset-filters'
                                : 'owner-inventory-retry'}
                    />
                ) : null}

                {successfulEmpty ? (
                    <OwnerInventoryStateCard
                        title="No inventory items found"
                        body="The inventory request succeeded, but no items match these filters."
                    />
                ) : null}

                {inventory.items.length > 0 ? (
                    <View style={styles.list}>
                        <Text selectable style={[styles.sectionTitle, { color: colors.textPrimary }]}>Inventory ({inventory.items.length})</Text>
                        {inventory.items.map((item) => (
                            <InventoryRecoveryCard
                                key={item.id}
                                item={item}
                                onOpenStoreView={() => router.push(storeViewRoutes.detail(item.id))}
                            />
                        ))}
                    </View>
                ) : null}

                {(inventory.isNextPageError || inventory.isRefreshError) && inventory.items.length > 0 ? (
                    <OwnerInventoryStateCard
                        title={partialTitle}
                        body={partialBody}
                        action={partialAction}
                        actionLabel={isUnauthorized
                            ? undefined
                            : error?.category === 'invalid_cursor' && !inventory.isRefreshError
                            ? 'Restart pagination'
                            : error?.category === 'invalid_request' && !inventory.isRefreshError
                                ? 'Reset filters'
                                : 'Try again'}
                        testID={isUnauthorized
                            ? undefined
                            : inventory.isRefreshError
                            ? 'owner-inventory-retry-refresh'
                            : error?.category === 'invalid_cursor'
                                ? 'owner-inventory-reset-pagination'
                                : error?.category === 'invalid_request'
                                    ? 'owner-inventory-reset-filters'
                                    : 'owner-inventory-retry-next'}
                    />
                ) : null}

                {inventory.hasMore && !inventory.isNextPageError && !inventory.isRefreshError ? (
                    <Pressable
                        testID="owner-inventory-load-more"
                        accessibilityRole="button"
                        disabled={inventory.isFetchingNextPage}
                        onPress={() => void inventory.loadNextPage()}
                        style={[styles.primaryAction, { backgroundColor: colors.accent }]}
                    >
                        {inventory.isFetchingNextPage ? <ActivityIndicator color="#FFFFFF" /> : null}
                        <Text style={styles.primaryActionText}>
                            {inventory.isFetchingNextPage ? 'Loading…' : 'Load more'}
                        </Text>
                    </Pressable>
                ) : null}
            </ScrollView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { padding: 24, paddingBottom: 40, gap: 14 },
    headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    eyebrow: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
    title: { fontSize: 26, fontWeight: '800' },
    readOnlyNote: { fontSize: 14, lineHeight: 20 },
    searchInput: { minHeight: 46, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, backgroundColor: '#FFFFFF' },
    refreshAction: { minHeight: 40, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
    body: { fontSize: 14, lineHeight: 20, marginTop: 8 },
    centerText: { textAlign: 'center', marginTop: 10 },
    list: { gap: 10 },
    sectionTitle: { fontSize: 18, fontWeight: '800' },
    primaryAction: { minHeight: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
    primaryActionText: { color: '#FFFFFF', fontWeight: '800' },
});
