import React, { useState } from 'react';
import {
    View, Text, TouchableOpacity, Modal, TextInput,
    ScrollView, ActivityIndicator, StyleSheet,
    KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAddresses, useCreateAddress } from '@/features/exchange/hooks/useAddresses';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AddressPickerProps {
    userId: string;
    selectedAddressId: string | null;
    onSelect: (addressId: string) => void;
}

interface AddressFormState {
    name: string;
    phone: string;
    line1: string;
    line2: string;
    city: string;
    state: string;
    pincode: string;
    isDefault: boolean;
}

const EMPTY_FORM: AddressFormState = {
    name: '', phone: '', line1: '', line2: '',
    city: '', state: '', pincode: '', isDefault: false,
};

type StringField = keyof Omit<AddressFormState, 'isDefault'>;

const FIELDS: Array<{
    key: StringField;
    label: string;
    placeholder: string;
    keyboardType?: 'phone-pad' | 'numeric';
}> = [
    { key: 'name',    label: 'Full Name *',        placeholder: 'e.g. Priya Sharma' },
    { key: 'phone',   label: 'Phone *',             placeholder: '10-digit mobile', keyboardType: 'phone-pad' },
    { key: 'line1',   label: 'Address Line 1 *',    placeholder: 'House/flat, street' },
    { key: 'line2',   label: 'Address Line 2',      placeholder: 'Area, landmark (optional)' },
    { key: 'city',    label: 'City *',              placeholder: 'e.g. Bengaluru' },
    { key: 'state',   label: 'State *',             placeholder: 'e.g. Karnataka' },
    { key: 'pincode', label: 'Pincode *',           placeholder: '6-digit PIN', keyboardType: 'numeric' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function AddressPicker({ userId, selectedAddressId, onSelect }: AddressPickerProps) {
    const { colors } = useTheme();
    const { data: addresses, isLoading } = useAddresses(userId);
    const createMutation = useCreateAddress();
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<AddressFormState>(EMPTY_FORM);

    const setField = (key: StringField, value: string) =>
        setForm(prev => ({ ...prev, [key]: value }));

    const handleSave = () => {
        const { name, phone, line1, city, state, pincode } = form;
        if (!name || !phone || !line1 || !city || !state || !pincode) {
            Alert.alert('Missing fields', 'Please fill in all required fields (marked *).');
            return;
        }
        createMutation.mutate(
            { userId, ...form },
            {
                onSuccess: (addr) => { setShowForm(false); setForm(EMPTY_FORM); onSelect(addr.id); },
                onError: (err: any) => Alert.alert('Error', err?.message ?? 'Could not save address.'),
            }
        );
    };

    return (
        <View>
            {/* Address List */}
            {isLoading ? (
                <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 8 }} />
            ) : (
                <View style={styles.list}>
                    {(addresses ?? []).map((addr) => {
                        const isSelected = addr.id === selectedAddressId;
                        return (
                            <TouchableOpacity
                                key={addr.id}
                                onPress={() => onSelect(addr.id)}
                                style={[styles.addressRow, {
                                    borderColor: isSelected ? colors.accent : colors.border,
                                    backgroundColor: isSelected ? `${colors.accent}15` : 'transparent',
                                }]}
                            >
                                <View style={[styles.radio, { borderColor: isSelected ? colors.accent : colors.border }]}>
                                    {isSelected && <View style={[styles.radioDot, { backgroundColor: colors.accent }]} />}
                                </View>
                                <View style={styles.addressInfo}>
                                    <Text style={[styles.addrName, { color: colors.textPrimary }]}>{addr.name}</Text>
                                    <Text style={[styles.addrLine, { color: colors.textSecondary }]} numberOfLines={2}>
                                        {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}
                                        {'\n'}{addr.city}, {addr.state} — {addr.pincode}
                                    </Text>
                                    {addr.is_default && (
                                        <View style={[styles.defaultBadge, { backgroundColor: `${colors.accent}20` }]}>
                                            <Text style={[styles.defaultText, { color: colors.accent }]}>Default</Text>
                                        </View>
                                    )}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}

            {/* Add Address Button */}
            <TouchableOpacity onPress={() => setShowForm(true)} style={styles.addBtn}>
                <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                <Text style={[styles.addBtnText, { color: colors.accent }]}>Add new address</Text>
            </TouchableOpacity>

            {/* Add Address Modal */}
            <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
                <KeyboardAvoidingView
                    style={[styles.modal, { backgroundColor: colors.bgPrimary }]}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                        <TouchableOpacity onPress={() => { setShowForm(false); setForm(EMPTY_FORM); }}>
                            <Text style={[styles.cancelBtn, { color: colors.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>New Address</Text>
                        <TouchableOpacity onPress={handleSave} disabled={createMutation.isPending}>
                            {createMutation.isPending
                                ? <ActivityIndicator size="small" color={colors.accent} />
                                : <Text style={[styles.saveBtn, { color: colors.accent }]}>Save</Text>}
                        </TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
                        {FIELDS.map(({ key, label, placeholder, keyboardType }) => (
                            <View key={key} style={styles.field}>
                                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
                                <TextInput
                                    style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.bgCard }]}
                                    placeholder={placeholder}
                                    placeholderTextColor={colors.textTertiary}
                                    value={form[key]}
                                    onChangeText={(v) => setField(key, v)}
                                    keyboardType={keyboardType ?? 'default'}
                                />
                            </View>
                        ))}
                        <TouchableOpacity
                            onPress={() => setForm(prev => ({ ...prev, isDefault: !prev.isDefault }))}
                            style={styles.checkRow}
                        >
                            <View style={[styles.checkbox,
                                { borderColor: form.isDefault ? colors.accent : colors.border },
                                form.isDefault && { backgroundColor: colors.accent }
                            ]}>
                                {form.isDefault && <Ionicons name="checkmark" size={14} color="#FFF" />}
                            </View>
                            <Text style={[styles.checkLabel, { color: colors.textPrimary }]}>Set as default address</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    list: { gap: 8 },
    addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1.5 },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
    radioDot: { width: 10, height: 10, borderRadius: 5 },
    addressInfo: { flex: 1 },
    addrName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
    addrLine: { fontSize: 13, lineHeight: 18 },
    defaultBadge: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    defaultText: { fontSize: 11, fontWeight: '600' },
    addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingVertical: 4 },
    addBtnText: { fontSize: 14, fontWeight: '500' },
    modal: { flex: 1 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 1 },
    cancelBtn: { fontSize: 16 },
    modalTitle: { fontSize: 17, fontWeight: '600' },
    saveBtn: { fontSize: 16, fontWeight: '600' },
    formScroll: { padding: 16, gap: 16 },
    field: { gap: 6 },
    fieldLabel: { fontSize: 13, fontWeight: '500' },
    input: { height: 44, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, fontSize: 15 },
    checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
    checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    checkLabel: { fontSize: 15, fontWeight: '500' },
});

