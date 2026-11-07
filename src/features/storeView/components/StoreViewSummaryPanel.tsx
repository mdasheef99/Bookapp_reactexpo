import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import type { StoreViewFilter } from '../contracts/storeViewContracts';
import type { StoreViewSummary } from '../contracts/storeViewSummaryContracts';

type SummaryTile = Readonly<{
    id: string;
    label: string;
    select: (summary: StoreViewSummary) => number;
    filter: StoreViewFilter;
}>;

export const STORE_VIEW_SUMMARY_TILES: readonly SummaryTile[] = [
    { id: 'all', label: 'All', select: s => s.counts.all, filter: 'all' },
    { id: 'private', label: 'Private', select: s => s.counts.private, filter: 'private' },
    { id: 'live', label: 'Live', select: s => s.counts.live, filter: 'live' },
    { id: 'paused', label: 'Paused', select: s => s.counts.paused, filter: 'paused' },
    { id: 'needsAttention', label: 'Needs attention', select: s => s.counts.needsAttention, filter: 'needs_attention' },
    { id: 'outOfStock', label: 'Out of stock', select: s => s.counts.outOfStock, filter: 'out_of_stock' },
];

/** Integer paise never pass through Number, including values beyond bigint. */
export function formatStockValueMinor(value: string): string {
    const minor = BigInt(value);
    const rupees = (minor / BigInt(100)).toString();
    const leading = rupees.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    const grouped = leading ? `${leading},${rupees.slice(-3)}` : rupees;
    return `₹${grouped}.${(minor % BigInt(100)).toString().padStart(2, '0')}`;
}

export function StoreViewSummaryPanel({ data, pending, paused, error, onRetry, onSelect, tiles = STORE_VIEW_SUMMARY_TILES }: {
    data?: StoreViewSummary;
    pending: boolean;
    paused?: boolean;
    error: boolean;
    onRetry: () => void;
    onSelect: (filter: StoreViewFilter) => void;
    tiles?: readonly SummaryTile[];
}) {
    const { colors } = useTheme();
    return (
        <View testID="store-view-summary-panel">
            <GlassCard padding={16} borderRadius={16}>
                {paused && !data ? <View style={{ gap: 8 }}>
                    <Text style={{ color: colors.textSecondary }}>You are offline. Summary will load when you are back online.</Text>
                    <Pressable testID="store-view-summary-retry" accessibilityRole="button" onPress={onRetry} style={{ minHeight: 44, justifyContent: 'center' }}>
                        <Text style={{ color: colors.accent, fontWeight: '700' }}>Retry</Text>
                    </Pressable>
                </View> : pending ? <View accessibilityRole="progressbar" style={{ gap: 8 }}>
                    <ActivityIndicator color={colors.accent} />
                    <Text style={{ color: colors.textSecondary }}>Loading summary…</Text>
                </View> : error || !data ? <View style={{ gap: 8 }}>
                    <Text accessibilityRole="alert" style={{ color: colors.textSecondary }}>Summary could not be loaded.</Text>
                    <Pressable testID="store-view-summary-retry" accessibilityRole="button" onPress={onRetry} style={{ minHeight: 44, justifyContent: 'center' }}>
                        <Text style={{ color: colors.accent, fontWeight: '700' }}>Retry</Text>
                    </Pressable>
                </View> : <View style={{ gap: 16 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {tiles.map(tile => {
                            const count = tile.select(data);
                            return <Pressable key={tile.id} testID={`store-view-summary-tile-${tile.id}`}
                                accessibilityRole="button" accessibilityLabel={`${tile.label}, ${count} ${count === 1 ? 'book' : 'books'}, filter`}
                                onPress={() => onSelect(tile.filter)}
                                style={{ flexBasis: '30%', flexGrow: 1, padding: 12, minHeight: 72, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard }}>
                                <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 24 }}>{count}</Text>
                                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{tile.label}</Text>
                            </Pressable>;
                        })}
                    </View>
                    <View style={{ gap: 4 }}>
                        <Text style={{ color: colors.textSecondary }}>Stock value (asking price)</Text>
                        <Text testID="store-view-summary-value" selectable style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '800' }}>
                            {formatStockValueMinor(data.availableStockValueMinor)}
                        </Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>All books, including private and paused</Text>
                    </View>
                </View>}
            </GlassCard>
        </View>
    );
}
