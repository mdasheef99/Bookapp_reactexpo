import type { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useStoreOwnerGate } from '../hooks/useStoreOwnerGate';
import { useStoreInventory } from '../hooks/useStoreInventory';
import AddInventoryForm from '../components/AddInventoryForm';
import InventoryItem from '../components/InventoryItem';
import EditModal from '../components/EditModal';
import InventoryFilterPanel from '../components/InventoryFilterPanel';
import InventoryBulkActions from '../components/InventoryBulkActions';

export default function StoreInventoryScreen({ scanHeader }: { scanHeader?: ReactNode }) {
    const { user } = useAuth();
    const { colors } = useTheme();
    const gateQuery = useStoreOwnerGate(user?.id ?? null);
    const gateState = gateQuery.data;
    const isActiveOwner = gateState?.state === 'active_owner';
    const storeId = isActiveOwner ? gateState.storeId : null;

    const inventory = useStoreInventory(storeId);

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
                {scanHeader}

                <AddInventoryForm
                    onSaveDraft={inventory.saveDraft}
                    onCheckDuplicates={inventory.checkDuplicates}
                    duplicates={inventory.duplicates}
                    isSaving={inventory.isSaving}
                    message={inventory.message}
                    onImageToLLM={() => {
                        // Image-to-LLM placeholder - disabled per spec
                    }}
                />

                {inventory.items.length > 0 ? (
                    <View style={styles.inventoryList}>
                        <InventoryBulkActions
                            filteredCount={inventory.filteredItems.length}
                            selectedCount={inventory.selectedIds.size}
                            onSelectAll={inventory.selectAll}
                            onClearSelection={inventory.clearSelection}
                            onBulkPublish={inventory.bulkPublish}
                            onBulkPause={inventory.bulkPause}
                        />

                        <TextInput
                            testID="inventory-search"
                            style={[styles.searchInput, { borderColor: colors.border, color: colors.textPrimary }]}
                            placeholder="Search title, author, ISBN..."
                            value={inventory.searchQuery}
                            onChangeText={inventory.setSearchQuery}
                        />

                        <InventoryFilterPanel
                            conditionFilter={inventory.conditionFilter}
                            setConditionFilter={inventory.setConditionFilter}
                            statusFilter={inventory.statusFilter}
                            setStatusFilter={inventory.setStatusFilter}
                            quantityFilter={inventory.quantityFilter}
                            setQuantityFilter={inventory.setQuantityFilter}
                            sourceFilter={inventory.sourceFilter}
                            setSourceFilter={inventory.setSourceFilter}
                            dateFilter={inventory.dateFilter}
                            setDateFilter={inventory.setDateFilter}
                        />

                        {inventory.filteredItems.map((item) => (
                            <InventoryItem
                                key={item.id}
                                item={item}
                                selected={inventory.selectedIds.has(item.id)}
                                onSelect={inventory.toggleSelection}
                                onPublish={inventory.publishItem}
                                onPause={inventory.pauseItem}
                                onEdit={inventory.openEditModal}
                                onSaveEdits={inventory.saveItemEdits}
                                editPrice={inventory.editValues[item.id]?.price}
                                editQuantity={inventory.editValues[item.id]?.quantity}
                                onEditPriceChange={(i, v) => inventory.updateEditValue(i, 'price', v)}
                                onEditQuantityChange={(i, v) => inventory.updateEditValue(i, 'quantity', v)}
                            />
                        ))}
                    </View>
                ) : null}
            </ScrollView>

            <EditModal
                visible={inventory.editingItem !== null}
                item={inventory.editingItem}
                onClose={inventory.closeEditModal}
                onSave={inventory.saveModalEdits}
            />
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    container: { padding: 24, paddingBottom: 40 },
    eyebrow: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
    title: { fontSize: 26, fontWeight: '800', marginBottom: 16 },
    sectionTitle: { fontSize: 18, fontWeight: '800' },
    body: { fontSize: 14, lineHeight: 20, marginTop: 10 },
    inventoryList: { marginTop: 20, gap: 10 },
    searchInput: {
        minHeight: 44,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        marginBottom: 10,
        backgroundColor: '#FFFFFF',
    },
});
