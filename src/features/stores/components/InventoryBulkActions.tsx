import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export interface InventoryBulkActionsProps {
    filteredCount: number;
    selectedCount: number;
    onSelectAll: () => void;
    onClearSelection: () => void;
    onBulkPublish: () => void;
    onBulkPause: () => void;
}

export default function InventoryBulkActions({
    filteredCount,
    selectedCount,
    onSelectAll,
    onClearSelection,
    onBulkPublish,
    onBulkPause,
}: InventoryBulkActionsProps) {
    const { colors } = useTheme();

    return (
        <View>
            <View style={styles.listHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    Inventory ({filteredCount})
                </Text>
                {selectedCount > 0 ? (
                    <TouchableOpacity
                        testID="clear-selection"
                        onPress={onClearSelection}
                    >
                        <Text style={[styles.linkText, { color: colors.accent }]}>
                            Clear ({selectedCount})
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        testID="select-all"
                        onPress={onSelectAll}
                    >
                        <Text style={[styles.linkText, { color: colors.accent }]}>Select all</Text>
                    </TouchableOpacity>
                )}
            </View>

            {selectedCount > 0 ? (
                <View style={styles.bulkActions}>
                    <TouchableOpacity
                        testID="bulk-publish"
                        style={[styles.bulkAction, { backgroundColor: colors.accent }]}
                        onPress={onBulkPublish}
                    >
                        <Text style={styles.bulkActionText}>Publish selected</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        testID="bulk-pause"
                        style={[styles.bulkActionSecondary, { borderColor: colors.border }]}
                        onPress={onBulkPause}
                    >
                        <Text style={[styles.bulkActionText, { color: colors.textPrimary }]}>
                            Pause selected
                        </Text>
                    </TouchableOpacity>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    sectionTitle: { fontSize: 18, fontWeight: '800' },
    linkText: { fontSize: 14, fontWeight: '600' },
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