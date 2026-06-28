import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useStoreOwnerGate } from '../hooks/useStoreOwnerGate';
import { storeInventoryService } from '../services/storeInventoryService';
import type { MarketplaceBookCondition, StoreInventoryItem } from '../types';
const DEFAULT_CONDITION: MarketplaceBookCondition = 'good';
const CONDITION_OPTIONS: MarketplaceBookCondition[] = ['new', 'like_new', 'good', 'fair', 'damaged'];

function toMinorUnits(value: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.round(parsed * 100);
}

function toQuantity(value: string) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return 0;
    return parsed;
}

function rupeesFromMinor(value: number) {
    return Math.round(value / 100);
}

export default function StoreInventoryScreen() {
    const { user } = useAuth();
    const { colors } = useTheme();
    const gateQuery = useStoreOwnerGate(user?.id ?? null);
    const gateState = gateQuery.data;
    const isActiveOwner = gateState?.state === 'active_owner';
    const storeId = isActiveOwner ? gateState.storeId : null;
    const [title, setTitle] = useState('');
    const [author, setAuthor] = useState('');
    const [isbn13, setIsbn13] = useState('');
    const [price, setPrice] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [condition, setCondition] = useState<MarketplaceBookCondition>(DEFAULT_CONDITION);
    const [publicNotes, setPublicNotes] = useState('');
    const [shelfLocation, setShelfLocation] = useState('');
    const [inventoryItems, setInventoryItems] = useState<StoreInventoryItem[]>([]);
    const [editValues, setEditValues] = useState<Record<string, { price: string; quantity: string }>>({});
    const [duplicates, setDuplicates] = useState<StoreInventoryItem[]>([]);
    const [message, setMessage] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!storeId) return;
        storeInventoryService.listStoreInventory(storeId)
            .then(setInventoryItems)
            .catch(() => undefined);
    }, [storeId]);

    async function checkDuplicates() {
        if (!storeId) return;
        const matches = await storeInventoryService.findPotentialDuplicates({
            storeId,
            isbn13,
            title,
            authors: author ? [author] : [],
        });
        setDuplicates(matches);
    }

    async function saveDraft() {
        if (!storeId) return;
        setIsSaving(true);
        setMessage(null);
        try {
            await storeInventoryService.createManualInventoryItem({
                storeId,
                title,
                authors: author ? [author] : [],
                isbn13: isbn13 || null,
                condition,
                quantityAvailable: toQuantity(quantity),
                sellingPriceMinor: toMinorUnits(price),
                publicNotes: publicNotes || null,
                shelfLocation: shelfLocation || null,
                visibilityStatus: 'draft',
            });
            setMessage('Inventory draft saved.');
            storeInventoryService.listStoreInventory(storeId).then(setInventoryItems).catch(() => undefined);
            setTitle('');
            setAuthor('');
            setIsbn13('');
            setPrice('');
            setQuantity('1');
            setCondition(DEFAULT_CONDITION);
            setPublicNotes('');
            setShelfLocation('');
            setDuplicates([]);
        } catch {
            setMessage('Could not save inventory draft.');
        } finally {
            setIsSaving(false);
        }
    }

    async function publishItem(inventoryId: string) {
        if (!storeId) return;
        setMessage(null);
        try {
            await storeInventoryService.publishInventoryItem({ storeId, inventoryId });
            setMessage('Inventory published.');
            storeInventoryService.listStoreInventory(storeId).then(setInventoryItems).catch(() => undefined);
        } catch {
            setMessage('Could not publish inventory item.');
        }
    }

    async function pauseItem(inventoryId: string) {
        if (!storeId) return;
        setMessage(null);
        try {
            await storeInventoryService.pauseInventoryItem({ storeId, inventoryId });
            setMessage('Inventory paused.');
            storeInventoryService.listStoreInventory(storeId).then(setInventoryItems).catch(() => undefined);
        } catch {
            setMessage('Could not pause inventory item.');
        }
    }

    async function saveItemEdits(item: StoreInventoryItem) {
        if (!storeId) return;
        const edits = editValues[item.id] ?? {
            price: String(rupeesFromMinor(item.selling_price_minor)),
            quantity: String(item.quantity_available),
        };
        setMessage(null);
        try {
            await storeInventoryService.updateInventoryItem({
                storeId,
                inventoryId: item.id,
                sellingPriceMinor: toMinorUnits(edits.price),
                quantityAvailable: toQuantity(edits.quantity),
            });
            setMessage('Inventory updated.');
            storeInventoryService.listStoreInventory(storeId).then(setInventoryItems).catch(() => undefined);
        } catch {
            setMessage('Could not update inventory item.');
        }
    }

    function updateEditValue(item: StoreInventoryItem, key: 'price' | 'quantity', value: string) {
        setEditValues((current) => ({
            ...current,
            [item.id]: {
                price: current[item.id]?.price ?? String(rupeesFromMinor(item.selling_price_minor)),
                quantity: current[item.id]?.quantity ?? String(item.quantity_available),
                [key]: value,
            },
        }));
    }

    if (gateQuery.isLoading) {
        return (
            <ScreenBackground>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.accent} />
                </View>
            </ScreenBackground>
        );
    }

    if (!isActiveOwner) {
        return (
            <ScreenBackground>
                <View style={styles.container}>
                    <GlassCard padding={20} borderRadius={16}>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>Inventory</Text>
                        <Text style={[styles.body, { color: colors.textSecondary }]}>
                            Complete store setup before adding inventory.
                        </Text>
                    </GlassCard>
                </View>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>Store inventory</Text>
                <Text style={[styles.title, { color: colors.textPrimary }]}>{gateState.storeName}</Text>

                <GlassCard padding={18} borderRadius={16}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="book-outline" size={22} color={colors.accent} />
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Manual book entry</Text>
                    </View>
                    <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]} placeholder="Title" value={title} onChangeText={setTitle} />
                    <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]} placeholder="Author" value={author} onChangeText={setAuthor} />
                    <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]} placeholder="ISBN-13" value={isbn13} onChangeText={setIsbn13} keyboardType="number-pad" />
                    <View style={styles.conditionRow}>
                        {CONDITION_OPTIONS.map((option) => (
                            <TouchableOpacity
                                key={option}
                                testID={`condition-${option}`}
                                style={[
                                    styles.conditionChip,
                                    {
                                        borderColor: condition === option ? colors.accent : colors.border,
                                        backgroundColor: condition === option ? colors.accent : '#FFFFFF',
                                    },
                                ]}
                                onPress={() => setCondition(option)}
                            >
                                <Text style={[
                                    styles.conditionText,
                                    { color: condition === option ? '#FFFFFF' : colors.textPrimary },
                                ]}>
                                    {option.replace('_', ' ')}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={styles.row}>
                        <TextInput style={[styles.input, styles.rowInput, { borderColor: colors.border, color: colors.textPrimary }]} placeholder="Price in rupees" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
                        <TextInput style={[styles.input, styles.rowInput, { borderColor: colors.border, color: colors.textPrimary }]} placeholder="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />
                    </View>
                    <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]} placeholder="Public notes" value={publicNotes} onChangeText={setPublicNotes} />
                    <TextInput style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]} placeholder="Shelf location" value={shelfLocation} onChangeText={setShelfLocation} />

                    <TouchableOpacity
                        testID="check-duplicates"
                        style={[styles.secondaryAction, { borderColor: colors.border }]}
                        onPress={checkDuplicates}
                    >
                        <Text style={[styles.secondaryText, { color: colors.textPrimary }]}>Check duplicates</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        testID="save-inventory-draft"
                        style={[styles.primaryAction, { backgroundColor: colors.accent }]}
                        onPress={saveDraft}
                        disabled={isSaving}
                    >
                        <Text style={styles.primaryText}>{isSaving ? 'Saving...' : 'Save draft'}</Text>
                    </TouchableOpacity>
                    {message ? <Text style={[styles.body, { color: colors.textSecondary }]}>{message}</Text> : null}
                </GlassCard>

                {duplicates.length > 0 ? (
                    <View style={styles.duplicates}>
                        {duplicates.map((item) => (
                            <Text key={item.id} style={[styles.duplicateText, { color: colors.textPrimary }]}>
                                Potential duplicate: {item.title}
                            </Text>
                        ))}
                    </View>
                ) : null}

                {inventoryItems.length > 0 ? (
                    <View style={styles.inventoryList}>
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Inventory drafts</Text>
                        {inventoryItems.map((item) => (
                            <View key={item.id} style={[styles.inventoryRow, { borderColor: colors.border }]}>
                                <View style={styles.inventoryText}>
                                    <Text style={[styles.duplicateText, { color: colors.textPrimary }]}>{item.title}</Text>
                                    <Text style={[styles.body, { color: colors.textSecondary }]}>
                                        {item.visibility_status} - {item.listing_quality_status}
                                    </Text>
                                    <Text style={[styles.body, { color: colors.textSecondary }]}>
                                        {item.condition} - Rs {rupeesFromMinor(item.selling_price_minor)} - Qty {item.quantity_available}
                                    </Text>
                                    <View style={styles.row}>
                                        <TextInput
                                            testID={`edit-price-${item.id}`}
                                            style={[styles.input, styles.rowInput, { borderColor: colors.border, color: colors.textPrimary }]}
                                            value={editValues[item.id]?.price ?? String(rupeesFromMinor(item.selling_price_minor))}
                                            onChangeText={(value) => updateEditValue(item, 'price', value)}
                                            keyboardType="decimal-pad"
                                        />
                                        <TextInput
                                            testID={`edit-quantity-${item.id}`}
                                            style={[styles.input, styles.rowInput, { borderColor: colors.border, color: colors.textPrimary }]}
                                            value={editValues[item.id]?.quantity ?? String(item.quantity_available)}
                                            onChangeText={(value) => updateEditValue(item, 'quantity', value)}
                                            keyboardType="number-pad"
                                        />
                                    </View>
                                </View>
                                <View style={styles.rowActions}>
                                    <TouchableOpacity
                                        testID={`save-edit-${item.id}`}
                                        style={[styles.inlineSecondaryAction, { borderColor: colors.border }]}
                                        onPress={() => saveItemEdits(item)}
                                    >
                                        <Text style={[styles.inlineSecondaryText, { color: colors.textPrimary }]}>Save</Text>
                                    </TouchableOpacity>
                                    {item.visibility_status === 'published' ? (
                                        <TouchableOpacity
                                            testID={`pause-${item.id}`}
                                            style={[styles.inlineSecondaryAction, { borderColor: colors.border }]}
                                            onPress={() => pauseItem(item.id)}
                                        >
                                            <Text style={[styles.inlineSecondaryText, { color: colors.textPrimary }]}>Pause</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                    {item.visibility_status !== 'published' && item.listing_quality_status === 'ready' ? (
                                        <TouchableOpacity testID={`publish-${item.id}`} style={[styles.inlineAction, { backgroundColor: colors.accent }]} onPress={() => publishItem(item.id)}>
                                            <Text style={styles.inlineActionText}>Publish</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                            </View>
                        ))}
                    </View>
                ) : null}
            </ScrollView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    container: { padding: 24, paddingBottom: 40 },
    eyebrow: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
    title: { fontSize: 26, fontWeight: '800', marginBottom: 16 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    sectionTitle: { fontSize: 18, fontWeight: '800' },
    body: { fontSize: 14, lineHeight: 20, marginTop: 10 },
    row: { flexDirection: 'row', gap: 10 },
    conditionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
    conditionChip: { minHeight: 34, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
    conditionText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
    rowInput: { flex: 1 },
    input: { minHeight: 48, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, marginBottom: 10, backgroundColor: '#FFFFFF' },
    primaryAction: { minHeight: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
    primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
    secondaryAction: { minHeight: 46, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    secondaryText: { fontSize: 15, fontWeight: '700' },
    duplicates: { marginTop: 16, gap: 8 },
    duplicateText: { fontSize: 14, fontWeight: '700' },
    inventoryList: { marginTop: 20, gap: 10 },
    inventoryRow: { minHeight: 62, borderWidth: 1, borderRadius: 8, padding: 12, gap: 10 },
    inventoryText: { flex: 1 },
    rowActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    inlineAction: { minHeight: 36, borderRadius: 8, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
    inlineActionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
    inlineSecondaryAction: { minHeight: 36, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
    inlineSecondaryText: { fontSize: 13, fontWeight: '800' },
});
