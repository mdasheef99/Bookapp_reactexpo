import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
    useAddresses,
    useCreateAddress,
    useDeleteAddress,
    useSetDefaultAddress,
    useUpdateAddress,
} from '@/features/exchange/hooks/useAddresses';
import type { Address } from '@/features/exchange/services/addressesService';
import { useTheme } from '@/hooks/useTheme';

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

type AddressField = keyof Omit<AddressFormState, 'isDefault'>;

const EMPTY_FORM: AddressFormState = {
    name: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
    isDefault: false,
};

const FIELDS: Array<{
    key: AddressField;
    label: string;
    placeholder: string;
    keyboardType?: 'default' | 'phone-pad' | 'numeric';
}> = [
    { key: 'name', label: 'Full name', placeholder: 'Priya Sharma' },
    { key: 'phone', label: 'Phone', placeholder: '10-digit mobile', keyboardType: 'phone-pad' },
    { key: 'line1', label: 'Address line 1', placeholder: 'House/flat, street' },
    { key: 'line2', label: 'Address line 2', placeholder: 'Area, landmark' },
    { key: 'city', label: 'City', placeholder: 'Bengaluru' },
    { key: 'state', label: 'State', placeholder: 'Karnataka' },
    { key: 'pincode', label: 'Pincode', placeholder: '560001', keyboardType: 'numeric' },
];

function formFromAddress(address: Address): AddressFormState {
    return {
        name: address.name,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2 ?? '',
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        isDefault: address.is_default,
    };
}

function isFormValid(form: AddressFormState): boolean {
    return Boolean(
        form.name.trim() &&
        form.phone.trim() &&
        form.line1.trim() &&
        form.city.trim() &&
        form.state.trim() &&
        form.pincode.trim()
    );
}

export default function AddressesScreen() {
    const { session } = useAuth();
    const { colors } = useTheme();
    const userId = session?.user?.id ?? null;
    const addressesQuery = useAddresses(userId);
    const createMutation = useCreateAddress();
    const updateMutation = useUpdateAddress();
    const deleteMutation = useDeleteAddress();
    const setDefaultMutation = useSetDefaultAddress();
    const [editingAddress, setEditingAddress] = useState<Address | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<AddressFormState>(EMPTY_FORM);

    const addresses = addressesQuery.data ?? [];
    const isSaving = createMutation.isPending || updateMutation.isPending;
    const canSave = isFormValid(form) && !isSaving && !!userId;

    const emptyText = useMemo(() => {
        if (!userId) return 'Sign in to manage delivery and meetup addresses.';
        if (addressesQuery.isError) return 'Could not load your addresses.';
        return 'Add an address once, then reuse it whenever exchange delivery options need one.';
    }, [addressesQuery.isError, userId]);

    const updateField = (key: AddressField, value: string) => {
        setForm(current => ({ ...current, [key]: value }));
    };

    const openNewForm = () => {
        setEditingAddress(null);
        setForm(EMPTY_FORM);
        setShowForm(true);
    };

    const openEditForm = (address: Address) => {
        setEditingAddress(address);
        setForm(formFromAddress(address));
        setShowForm(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setShowForm(false);
        setEditingAddress(null);
        setForm(EMPTY_FORM);
    };

    const saveAddress = () => {
        if (!canSave || !userId) return;

        const trimmed = {
            name: form.name.trim(),
            phone: form.phone.trim(),
            line1: form.line1.trim(),
            line2: form.line2.trim() || null,
            city: form.city.trim(),
            state: form.state.trim(),
            pincode: form.pincode.trim(),
        };

        if (editingAddress) {
            updateMutation.mutate(
                {
                    id: editingAddress.id,
                    input: {
                        ...trimmed,
                        is_default: form.isDefault,
                    },
                },
                { onSuccess: closeForm }
            );
            return;
        }

        createMutation.mutate(
            {
                userId,
                ...trimmed,
                line2: trimmed.line2 ?? undefined,
                isDefault: form.isDefault,
            },
            { onSuccess: closeForm }
        );
    };

    const setDefault = (addressId: string) => {
        if (!userId) return;
        setDefaultMutation.mutate({ userId, addressId });
    };

    return (
        <ScreenBackground>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.replace('/(tabs)/profile')}
                    style={styles.iconButton}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                >
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Addresses</Text>
                <TouchableOpacity onPress={openNewForm} style={styles.iconButton} accessibilityLabel="Add address">
                    <Ionicons name="add" size={26} color={colors.accent} />
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={addressesQuery.isRefetching}
                        onRefresh={addressesQuery.refetch}
                        tintColor={colors.accent}
                    />
                }
            >
                <GlassCard padding={20} borderRadius={20}>
                    <View style={styles.summaryRow}>
                        <View>
                            <Text style={[styles.summaryTitle, { color: colors.textPrimary }]}>Saved addresses</Text>
                            <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                                {addresses.length} {addresses.length === 1 ? 'address' : 'addresses'}
                            </Text>
                        </View>
                        <Button title="Add address" onPress={openNewForm} variant="secondary" size="sm" style={styles.addButton} />
                    </View>
                </GlassCard>

                {addressesQuery.isLoading ? (
                    <ActivityIndicator color={colors.accent} style={styles.loading} />
                ) : addresses.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No addresses yet</Text>
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{emptyText}</Text>
                        <Button title="Add address" onPress={openNewForm} variant="primary" style={styles.emptyButton} />
                    </View>
                ) : (
                    <View style={styles.addressList}>
                        {addresses.map(address => (
                            <GlassCard key={address.id} padding={18} borderRadius={18}>
                                <View style={styles.cardHeader}>
                                    <View style={styles.cardTitleBlock}>
                                        <Text style={[styles.addressName, { color: colors.textPrimary }]}>
                                            {address.name}
                                        </Text>
                                        {address.is_default && (
                                            <View style={[styles.defaultBadge, { backgroundColor: `${colors.accent}20` }]}>
                                                <Text style={[styles.defaultText, { color: colors.accent }]}>Default</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <Text style={[styles.addressLine, { color: colors.textSecondary }]}>
                                    {address.phone}
                                </Text>
                                <Text style={[styles.addressLine, { color: colors.textSecondary }]}>
                                    {address.line1}{address.line2 ? `, ${address.line2}` : ''}
                                </Text>
                                <Text style={[styles.addressLine, { color: colors.textSecondary }]}>
                                    {address.city}, {address.state} {address.pincode}
                                </Text>

                                <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
                                    {!address.is_default && (
                                        <TouchableOpacity onPress={() => setDefault(address.id)} style={styles.actionButton}>
                                            <Text style={[styles.actionText, { color: colors.accent }]}>Set default</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity onPress={() => openEditForm(address)} style={styles.actionButton}>
                                        <Text style={[styles.actionText, { color: colors.textPrimary }]}>Edit</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => deleteMutation.mutate(address.id)} style={styles.actionButton}>
                                        <Text style={[styles.actionText, { color: colors.error }]}>Delete</Text>
                                    </TouchableOpacity>
                                </View>
                            </GlassCard>
                        ))}
                    </View>
                )}
            </ScrollView>

            <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
                <KeyboardAvoidingView
                    style={[styles.modal, { backgroundColor: colors.bgPrimary }]}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                        <TouchableOpacity onPress={closeForm}>
                            <Text style={[styles.modalAction, { color: colors.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                            {editingAddress ? 'Edit Address' : 'New Address'}
                        </Text>
                        <TouchableOpacity onPress={saveAddress} disabled={!canSave}>
                            {isSaving ? (
                                <ActivityIndicator size="small" color={colors.accent} />
                            ) : (
                                <Text style={[
                                    styles.modalAction,
                                    { color: canSave ? colors.accent : colors.textTertiary },
                                ]}>
                                    Save
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
                        {FIELDS.map(field => (
                            <View key={field.key} style={styles.field}>
                                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{field.label}</Text>
                                <TextInput
                                    style={[
                                        styles.input,
                                        {
                                            borderColor: colors.border,
                                            color: colors.textPrimary,
                                            backgroundColor: colors.bgCard,
                                        },
                                    ]}
                                    placeholder={field.placeholder}
                                    placeholderTextColor={colors.textTertiary}
                                    value={form[field.key]}
                                    keyboardType={field.keyboardType ?? 'default'}
                                    onChangeText={value => updateField(field.key, value)}
                                />
                            </View>
                        ))}
                        <TouchableOpacity
                            onPress={() => setForm(current => ({ ...current, isDefault: !current.isDefault }))}
                            style={styles.defaultToggle}
                        >
                            <View
                                style={[
                                    styles.checkbox,
                                    { borderColor: form.isDefault ? colors.accent : colors.border },
                                    form.isDefault && { backgroundColor: colors.accent },
                                ]}
                            >
                                {form.isDefault && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                            </View>
                            <Text style={[styles.defaultToggleText, { color: colors.textPrimary }]}>
                                Set as default address
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>
                </KeyboardAvoidingView>
            </Modal>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 56,
        paddingBottom: 12,
    },
    iconButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 32,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
    },
    summaryTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    summaryText: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 4,
    },
    addButton: {
        width: 132,
    },
    loading: {
        marginTop: 32,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 44,
        paddingHorizontal: 18,
        gap: 12,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
    },
    emptyText: {
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
    },
    emptyButton: {
        marginTop: 8,
    },
    addressList: {
        gap: 12,
        marginTop: 14,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    cardTitleBlock: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
    },
    addressName: {
        fontSize: 17,
        fontWeight: '700',
    },
    defaultBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    defaultText: {
        fontSize: 11,
        fontWeight: '700',
    },
    addressLine: {
        fontSize: 14,
        lineHeight: 20,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        borderTopWidth: 1,
        marginTop: 14,
        paddingTop: 12,
        gap: 16,
    },
    actionButton: {
        minHeight: 32,
        justifyContent: 'center',
    },
    actionText: {
        fontSize: 14,
        fontWeight: '700',
    },
    modal: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 56,
        paddingBottom: 12,
        borderBottomWidth: 1,
    },
    modalAction: {
        fontSize: 16,
        fontWeight: '700',
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '700',
    },
    formContent: {
        padding: 16,
        gap: 16,
    },
    field: {
        gap: 6,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '700',
    },
    input: {
        minHeight: 46,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 12,
        fontSize: 15,
    },
    defaultToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 4,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 5,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    defaultToggleText: {
        fontSize: 15,
        fontWeight: '600',
    },
});
