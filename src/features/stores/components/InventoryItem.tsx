import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

function rupeesFromMinor(value: number) {
    return Math.round(value / 100);
}

export interface InventoryItemViewModel {
    id: string;
    title: string;
    condition: string;
    quantity_available: number;
    selling_price_minor: number;
    visibility_status: string;
    listing_quality_status: string;
    publication_status?: string;
    publication_retryable?: boolean;
    publication_failure_reason?: string | null;
}

export interface InventoryItemProps<TItem extends InventoryItemViewModel = InventoryItemViewModel> {
    item: TItem;
    selected?: boolean;
    onSelect?: (item: TItem) => void;
    onPublish?: (inventoryId: string) => void;
    onPause?: (inventoryId: string) => void;
    onPrivate?: (inventoryId: string) => void;
    onRetryPublication?: (inventoryId: string) => void;
    onManagePublicMedia?: (inventoryId: string) => void;
    onEdit?: (item: TItem) => void;
    onSaveEdits?: (inventoryId: string, price: string, quantity: string) => void;
    editPrice?: string;
    editQuantity?: string;
    onEditPriceChange?: (item: TItem, value: string) => void;
    onEditQuantityChange?: (item: TItem, value: string) => void;
}

export default function InventoryItem<TItem extends InventoryItemViewModel>({
    item,
    selected = false,
    onSelect,
    onPublish,
    onPause,
    onPrivate,
    onRetryPublication,
    onManagePublicMedia,
    onEdit,
    onSaveEdits,
    editPrice,
    editQuantity,
    onEditPriceChange,
    onEditQuantityChange,
}: InventoryItemProps<TItem>) {
    const { colors } = useTheme();
    const isLowStock = item.quantity_available === 1;
    const isOutOfStock = item.quantity_available === 0;
    const canPublish = item.visibility_status !== 'published'
        && item.visibility_status !== 'blocked'
        && !item.publication_retryable;
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
                {item.publication_status ? (
                    <Text testID={`publication-status-${item.id}`} style={[styles.body, { color: colors.textSecondary }]}>
                        Publication: {item.publication_status}
                    </Text>
                ) : null}
                {item.publication_retryable ? (
                    <View testID={`publication-failed-${item.id}`} style={[styles.badge, { backgroundColor: '#FEE2E2' }]}>
                        <Text style={[styles.badgeText, { color: '#B91C1C' }]}>Publication failed temporarily</Text>
                    </View>
                ) : null}
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
                {(item.visibility_status !== 'draft' || item.publication_status === 'publication_failed') && onPrivate ? (
                    <TouchableOpacity
                        testID={`private-${item.id}`}
                        style={[styles.inlineSecondaryAction, { borderColor: colors.border }]}
                        onPress={() => onPrivate(item.id)}
                    >
                        <Text style={[styles.inlineSecondaryText, { color: colors.textPrimary }]}>Make private</Text>
                    </TouchableOpacity>
                ) : null}
                {item.publication_retryable && onRetryPublication ? (
                    <TouchableOpacity
                        testID={`retry-publication-${item.id}`}
                        style={[styles.inlineAction, { backgroundColor: colors.accent }]}
                        onPress={() => onRetryPublication(item.id)}
                    >
                        <Text style={styles.inlineActionText}>Retry publication</Text>
                    </TouchableOpacity>
                ) : null}
                {onManagePublicMedia ? (
                    <TouchableOpacity
                        testID={`manage-public-media-${item.id}`}
                        style={[styles.inlineSecondaryAction, { borderColor: colors.border }]}
                        onPress={() => onManagePublicMedia(item.id)}
                    >
                        <Text style={[styles.inlineSecondaryText, { color: colors.textPrimary }]}>Manage public photos</Text>
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
