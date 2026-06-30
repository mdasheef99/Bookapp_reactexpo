import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useStoreOwnerGate } from '../hooks/useStoreOwnerGate';
import { useStoreInventory } from '../hooks/useStoreInventory';
import AddInventoryForm from '../components/AddInventoryForm';
import InventoryItem from '../components/InventoryItem';
import EditModal from '../components/EditModal';

const FILTER_GROUPS = [
    {
        label: 'Condition',
        testPrefix: 'filter-condition',
        options: [
            ['all', 'All'],
            ['new', 'New'],
            ['like_new', 'Like new'],
            ['good', 'Good'],
            ['fair', 'Fair'],
            ['damaged', 'Damaged'],
        ],
    },
    {
        label: 'Status',
        testPrefix: 'filter-status',
        options: [
            ['all', 'All'],
            ['draft', 'Draft'],
            ['published', 'Published'],
            ['paused', 'Paused'],
        ],
    },
    {
        label: 'Quantity',
        testPrefix: 'filter-quantity',
        options: [
            ['all', 'All'],
            ['available', 'Available'],
            ['low_stock', 'Low stock'],
            ['out_of_stock', 'Out'],
        ],
    },
    {
        label: 'Source',
        testPrefix: 'filter-source',
        options: [
            ['all', 'All'],
            ['manual', 'Manual'],
            ['image_extraction', 'Image'],
        ],
    },
    {
        label: 'Date',
        testPrefix: 'filter-date',
        options: [
            ['all', 'All'],
            ['last_7_days', '7 days'],
            ['last_30_days', '30 days'],
        ],
    },
] as const;

export default function StoreInventoryScreen() {
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
                        <View style={styles.listHeader}>
                            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                                Inventory ({inventory.filteredItems.length})
                            </Text>
                            {inventory.selectedIds.size > 0 ? (
                                <TouchableOpacity
                                    testID="clear-selection"
                                    onPress={inventory.clearSelection}
                                >
                                    <Text style={[styles.linkText, { color: colors.accent }]}>
                                        Clear ({inventory.selectedIds.size})
                                    </Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    testID="select-all"
                                    onPress={inventory.selectAll}
                                >
                                    <Text style={[styles.linkText, { color: colors.accent }]}>Select all</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <TextInput
                            testID="inventory-search"
                            style={[styles.searchInput, { borderColor: colors.border, color: colors.textPrimary }]}
                            placeholder="Search title, author, ISBN..."
                            value={inventory.searchQuery}
                            onChangeText={inventory.setSearchQuery}
                        />
                        <View style={styles.filterPanel}>
                            <FilterGroup
                                label={FILTER_GROUPS[0].label}
                                testPrefix={FILTER_GROUPS[0].testPrefix}
                                options={FILTER_GROUPS[0].options}
                                value={inventory.conditionFilter}
                                onChange={inventory.setConditionFilter}
                                colors={colors}
                            />
                            <FilterGroup
                                label={FILTER_GROUPS[1].label}
                                testPrefix={FILTER_GROUPS[1].testPrefix}
                                options={FILTER_GROUPS[1].options}
                                value={inventory.statusFilter}
                                onChange={inventory.setStatusFilter}
                                colors={colors}
                            />
                            <FilterGroup
                                label={FILTER_GROUPS[2].label}
                                testPrefix={FILTER_GROUPS[2].testPrefix}
                                options={FILTER_GROUPS[2].options}
                                value={inventory.quantityFilter}
                                onChange={inventory.setQuantityFilter}
                                colors={colors}
                            />
                            <FilterGroup
                                label={FILTER_GROUPS[3].label}
                                testPrefix={FILTER_GROUPS[3].testPrefix}
                                options={FILTER_GROUPS[3].options}
                                value={inventory.sourceFilter}
                                onChange={inventory.setSourceFilter}
                                colors={colors}
                            />
                            <FilterGroup
                                label={FILTER_GROUPS[4].label}
                                testPrefix={FILTER_GROUPS[4].testPrefix}
                                options={FILTER_GROUPS[4].options}
                                value={inventory.dateFilter}
                                onChange={inventory.setDateFilter}
                                colors={colors}
                            />
                        </View>

                        {inventory.selectedIds.size > 0 ? (
                            <View style={styles.bulkActions}>
                                <TouchableOpacity
                                    testID="bulk-publish"
                                    style={[styles.bulkAction, { backgroundColor: colors.accent }]}
                                    onPress={inventory.bulkPublish}
                                >
                                    <Text style={styles.bulkActionText}>Publish selected</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    testID="bulk-pause"
                                    style={[styles.bulkActionSecondary, { borderColor: colors.border }]}
                                    onPress={inventory.bulkPause}
                                >
                                    <Text style={[styles.bulkActionText, { color: colors.textPrimary }]}>
                                        Pause selected
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ) : null}

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

function FilterGroup({
    label,
    testPrefix,
    options,
    value,
    onChange,
    colors,
}: {
    label: string;
    testPrefix: string;
    options: readonly (readonly [string, string])[];
    value: string;
    onChange: (value: string) => void;
    colors: ReturnType<typeof useTheme>['colors'];
}) {
    return (
        <View style={styles.filterGroup}>
            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>{label}</Text>
            <View style={styles.filterOptions}>
                {options.map(([optionValue, optionLabel]) => {
                    const isActive = value === optionValue;
                    return (
                        <TouchableOpacity
                            key={optionValue}
                            testID={`${testPrefix}-${optionValue}`}
                            style={[
                                styles.filterChip,
                                {
                                    borderColor: isActive ? colors.accent : colors.border,
                                    backgroundColor: isActive ? colors.accent : '#FFFFFF',
                                },
                            ]}
                            onPress={() => onChange(optionValue)}
                        >
                            <Text style={[
                                styles.filterChipText,
                                { color: isActive ? '#FFFFFF' : colors.textPrimary },
                            ]}>
                                {optionLabel}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
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
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    linkText: { fontSize: 14, fontWeight: '600' },
    searchInput: {
        minHeight: 44,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        marginBottom: 10,
        backgroundColor: '#FFFFFF',
    },
    filterPanel: { gap: 10, marginBottom: 10 },
    filterGroup: { gap: 6 },
    filterLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
    filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    filterChip: {
        minHeight: 34,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterChipText: { fontSize: 12, fontWeight: '700' },
    bulkActions: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    bulkAction: {
        minHeight: 40,
        borderRadius: 8,
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bulkActionSecondary: {
        minHeight: 40,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bulkActionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
