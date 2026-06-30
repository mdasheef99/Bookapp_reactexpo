import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import type { MarketplaceBookCondition, StoreInventoryItem } from '../types';

const CONDITION_OPTIONS: MarketplaceBookCondition[] = ['new', 'like_new', 'good', 'fair', 'damaged'];

export interface EditModalProps {
    visible: boolean;
    item: StoreInventoryItem | null;
    onClose: () => void;
    onSave: (input: {
        inventoryId: string;
        condition: MarketplaceBookCondition;
        publicNotes: string;
        shelfLocation: string;
    }) => void;
}

export default function EditModal({ visible, item, onClose, onSave }: EditModalProps) {
    const { colors } = useTheme();
    const [condition, setCondition] = useState<MarketplaceBookCondition>('good');
    const [publicNotes, setPublicNotes] = useState('');
    const [shelfLocation, setShelfLocation] = useState('');

    useEffect(() => {
        if (!item || !visible) return;
        setCondition(item.condition);
        setPublicNotes(item.public_notes ?? '');
        setShelfLocation(item.shelf_location ?? '');
    }, [item, visible]);

    function handleSave() {
        if (!item) return;
        onSave({
            inventoryId: item.id,
            condition,
            publicNotes,
            shelfLocation,
        });
        setCondition('good');
        setPublicNotes('');
        setShelfLocation('');
    }

    function handleClose() {
        setCondition('good');
        setPublicNotes('');
        setShelfLocation('');
        onClose();
    }

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
            <View style={styles.overlay}>
                <View style={[styles.modalContent, { backgroundColor: colors.bgCard ?? '#FFFFFF' }]}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                            Edit Inventory
                        </Text>
                        <TouchableOpacity testID="edit-modal-close" onPress={handleClose}>
                            <Ionicons name="close-outline" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {item ? (
                        <View>
                            <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>{item.title}</Text>

                            <Text style={[styles.label, { color: colors.textSecondary }]}>Condition</Text>
                            <View style={styles.conditionRow}>
                                {CONDITION_OPTIONS.map((option) => (
                                    <TouchableOpacity
                                        key={option}
                                        testID={`modal-condition-${option}`}
                                        style={[
                                            styles.conditionChip,
                                            {
                                                borderColor: condition === option ? colors.accent : colors.border,
                                                backgroundColor: condition === option ? colors.accent : '#FFFFFF',
                                            },
                                        ]}
                                        onPress={() => setCondition(option)}
                                    >
                                        <Text
                                            style={[
                                                styles.conditionText,
                                                { color: condition === option ? '#FFFFFF' : colors.textPrimary },
                                            ]}
                                        >
                                            {option.replace('_', ' ')}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={[styles.label, { color: colors.textSecondary }]}>Public notes</Text>
                            <TextInput
                                testID="modal-public-notes"
                                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                                placeholder="Public notes"
                                value={publicNotes}
                                onChangeText={setPublicNotes}
                                multiline
                            />

                            <Text style={[styles.label, { color: colors.textSecondary }]}>Shelf location</Text>
                            <TextInput
                                testID="modal-shelf-location"
                                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                                placeholder="Shelf location"
                                value={shelfLocation}
                                onChangeText={setShelfLocation}
                            />

                            <TouchableOpacity
                                testID="edit-modal-save"
                                style={[styles.saveButton, { backgroundColor: colors.accent }]}
                                onPress={handleSave}
                            >
                                <Text style={styles.saveButtonText}>Save changes</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        padding: 16,
    },
    modalContent: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 16,
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: { fontSize: 18, fontWeight: '800' },
    itemTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
    label: { fontSize: 13, fontWeight: '600', marginTop: 8, marginBottom: 4 },
    conditionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
    conditionChip: {
        minHeight: 34,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    conditionText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
    input: {
        minHeight: 48,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        marginBottom: 10,
        backgroundColor: '#FFFFFF',
    },
    saveButton: {
        minHeight: 50,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
    },
    saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
