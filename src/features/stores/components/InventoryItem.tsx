import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import type { StoreInventoryItem } from '../types';

function rupeesFromMinor(value: number) {
    return Math.round(value / 100);
}

export interface InventoryItemProps {
    item: StoreInventoryItem;
    selected?: boolean;
    onSelect?: (item: StoreInventoryItem) => void;
    onPublish?: (inventoryId: string) => void;
    onPause?: (inventoryId: string) => void;
    onEdit?: (item: StoreInventoryItem) => void;
    onSaveEdits?: (inventoryId: string, price: string, quantity: string) => void;
    editPrice?: string;
    editQuantity?: string;
    onEditPriceChange?: (item: StoreInventoryItem, value: string) => void;
    onEditQuantityChange?: (item: StoreInventoryItem, value: string) => void;
}

export default function InventoryItem({
    item,
    selected = false,
    onSelect,
    onPublish,
    onPause,
    onEdit,
    onSaveEdits,
    editPrice,
    editQuantity,
    onEditPriceChange,
    onEditQuantityChange,
}: InventoryItemProps) {
    const { colors } = useTheme();
    const isLowStock = item.quantity_available === 1;
    const isOutOfStock = item.quantity_available === 0;
    const canPublish = item.visibility_status !== 'published' && item.visibility_status !== 'blocked';
    const canPause = item.visibility_status === 'published';

    return (
        <View style={[styles.inventoryRow, { borderColor: selected ? colors.accent : colors.border }]}>
            <View style={styles.inventoryText}>
                <View style={styles.titleRow}>
                    {onSelect ? (
                        <TouchableOpacity
                            testID={`select-${item.id}`}
                            onPress={() => onSelect(item)}
                            style={styles.checkbox}
                        >
                            <Ionicons
                                name={selected ? 'checkbox-outline' : 'square-outline'}
                                size={20}
                                color={selected ? colors.accent : colors.textSecondary}
                            />
                        </TouchableOpacity>
                    ) : null}
                    <Text style={[styles.duplicateText, { color: colors.textPrimary }]}>{item.title}</Text>
                </View>
                <Text style={[styles.body, { color: colors.textSecondary }]}>
                    {item.visibility_status} - {item.listing_quality_status}
                </Text>
                <View style={styles.metaRow}>
                    <Text style={[styles.body, { color: colors.textSecondary }]}>
                        {item.condition} - Rs {rupeesFromMinor(item.selling_price_minor)} - Qty {item.quantity_available}
                    </Text>
                    {isLowStock ? (
                        <View style={[styles.badge, { backgroundColor: '#FEF3C7' }]}>
                            <Text style={[styles.badgeText, { color: '#D97706' }]}>Low stock</Text>
                        </View>
                    ) : null}
                    {isOutOfStock ? (
                        <View style={[styles.badge, { backgroundColor: '#FEE2E2' }]}>
                            <Text style={[styles.badgeText, { color: '#B91C1C' }]}>Out of stock</Text>
                        </View>
                    ) : null}
                </View>
                {onEditPriceChange && onEditQuantityChange ? (
                    <View style={styles.row}>
                        <TextInput
                            testID={`edit-price-${item.id}`}
                            style={[styles.input, styles.rowInput, { borderColor: colors.border, color: colors.textPrimary }]}
                            value={editPrice ?? String(rupeesFromMinor(item.selling_price_minor))}
                            onChangeText={(value) => onEditPriceChange(item, value)}
                            keyboardType="decimal-pad"
                        />
                        <TextInput
                            testID={`edit-quantity-${item.id}`}
                            style={[styles.input, styles.rowInput, { borderColor: colors.border, color: colors.textPrimary }]}
                            value={editQuantity ?? String(item.quantity_available)}
                            onChangeText={(value) => onEditQuantityChange(item, value)}
                            keyboardType="number-pad"
                        />
                    </View>
                ) : null}
            </View>
            <View style={styles.rowActions}>
                {onSaveEdits ? (
                    <TouchableOpacity
                        testID={`save-edit-${item.id}`}
                        style={[styles.inlineSecondaryAction, { borderColor: colors.border }]}
                        onPress={() =>
                            onSaveEdits(
                                item.id,
                                editPrice ?? String(rupeesFromMinor(item.selling_price_minor)),
                                editQuantity ?? String(item.quantity_available),
                            )
                        }
                    >
                        <Text style={[styles.inlineSecondaryText, { color: colors.textPrimary }]}>Save</Text>
                    </TouchableOpacity>
                ) : null}
                {onEdit ? (
                    <TouchableOpacity
                        testID={`edit-modal-${item.id}`}
                        style={[styles.inlineSecondaryAction, { borderColor: colors.border }]}
                        onPress={() => onEdit(item)}
                    >
                        <Text style={[styles.inlineSecondaryText, { color: colors.textPrimary }]}>Edit</Text>
                    </TouchableOpacity>
                ) : null}
                {canPause && onPause ? (
                    <TouchableOpacity
                        testID={`pause-${item.id}`}
                        style={[styles.inlineSecondaryAction, { borderColor: colors.border }]}
                        onPress={() => onPause(item.id)}
                    >
                        <Text style={[styles.inlineSecondaryText, { color: colors.textPrimary }]}>Pause</Text>
                    </TouchableOpacity>
                ) : null}
                {canPublish && onPublish ? (
                    <TouchableOpacity
                        testID={`publish-${item.id}`}
                        style={[styles.inlineAction, { backgroundColor: colors.accent }]}
                        onPress={() => onPublish(item.id)}
                    >
                        <Text style={styles.inlineActionText}>Publish</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    inventoryRow: { minHeight: 62, borderWidth: 1, borderRadius: 8, padding: 12, gap: 10 },
    inventoryText: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    checkbox: { padding: 2 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    row: { flexDirection: 'row', gap: 10 },
    rowInput: { flex: 1 },
    input: {
        minHeight: 48,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        marginBottom: 10,
        backgroundColor: '#FFFFFF',
    },
    rowActions: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
    inlineAction: {
        minHeight: 36,
        borderRadius: 8,
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    inlineActionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
    inlineSecondaryAction: {
        minHeight: 36,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    inlineSecondaryText: { fontSize: 13, fontWeight: '800' },
    body: { fontSize: 14, lineHeight: 20, marginTop: 4 },
    duplicateText: { fontSize: 14, fontWeight: '700' },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    badgeText: { fontSize: 11, fontWeight: '700' },
});
