import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import type { OwnerInventoryListItem } from '../api/ownerInventoryReadService';

function rupeesFromMinor(value: number) {
    return Math.round(value / 100);
}

export function InventoryRecoveryCard({
    item,
    onOpenStoreView,
}: {
    item: OwnerInventoryListItem;
    onOpenStoreView: () => void;
}) {
    const { colors } = useTheme();
    const stockLabel = item.quantityAvailable === 0
        ? 'Out of stock'
        : item.quantityAvailable === 1
            ? 'Low stock'
            : `${item.quantityAvailable} available`;

    return (
        <GlassCard padding={16} borderRadius={16}>
            <View style={styles.content}>
                <View style={styles.copy}>
                    <Text selectable style={[styles.title, { color: colors.textPrimary }]}>
                        {item.title}
                    </Text>
                    <Text selectable style={[styles.body, { color: colors.textSecondary }]}>
                        {item.condition} · Rs {rupeesFromMinor(item.sellingPriceMinor)} · {stockLabel}
                    </Text>
                    <Text selectable style={[styles.body, { color: colors.textSecondary }]}>
                        Committed inventory · {item.visibilityStatus}
                    </Text>
                </View>
                <Pressable
                    testID={`inventory-open-store-view-${item.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${item.title} in Store View`}
                    accessibilityHint="Opens the authoritative post-commit management surface"
                    onPress={onOpenStoreView}
                    style={[styles.action, { borderColor: colors.border }]}
                >
                    <Text style={[styles.actionText, { color: colors.textPrimary }]}>Open in Store View</Text>
                </Pressable>
            </View>
        </GlassCard>
    );
}

const styles = StyleSheet.create({
    content: { gap: 12 },
    copy: { gap: 4 },
    title: { fontSize: 16, fontWeight: '800' },
    body: { fontSize: 14, lineHeight: 20 },
    action: {
        minHeight: 44,
        borderWidth: 1,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
    },
    actionText: { fontWeight: '800' },
});
