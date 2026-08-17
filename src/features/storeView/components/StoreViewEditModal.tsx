import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { StoreViewDetail } from '../contracts/storeViewContracts';
import type { StoreViewChanges } from '../contracts/storeViewManagementContracts';
import {
    buildStoreViewChanges,
    createStoreViewEditDraft,
    validateStoreViewEditDraft,
    type StoreViewEditDraft,
} from '../forms/storeViewEditForm';

const CONDITIONS = ['new', 'like_new', 'very_good', 'good', 'acceptable'] as const;
const DAMAGE_TYPES = [
    'cover', 'binding', 'pages', 'water', 'staining', 'writing',
    'missing_parts', 'mould_or_contamination', 'other',
] as const;

function Input({
    label, value, onChangeText, testID, ownerOnly = false, multiline = false,
}: {
    label: string; value: string; onChangeText: (value: string) => void;
    testID: string; ownerOnly?: boolean; multiline?: boolean;
}) {
    const { colors } = useTheme();
    return (
        <View style={{ gap: 6 }}>
            <Text selectable style={{ color: ownerOnly ? colors.accent : colors.textSecondary, fontWeight: '700' }}>
                {`${label}${ownerOnly ? ' · Owner only' : ''}`}
            </Text>
            <TextInput
                testID={testID}
                accessibilityLabel={label}
                value={value}
                onChangeText={onChangeText}
                multiline={multiline}
                style={{
                    minHeight: multiline ? 84 : 46, borderWidth: 1, borderColor: colors.border,
                    borderRadius: 10, padding: 12, color: colors.textPrimary,
                    textAlignVertical: multiline ? 'top' : 'center',
                }}
            />
        </View>
    );
}

export function StoreViewEditModal({
    visible, detail, submitting, error, onDismiss, onSave,
}: {
    visible: boolean;
    detail: StoreViewDetail;
    submitting: boolean;
    error: string | null;
    onDismiss: () => void;
    onSave: (changes: StoreViewChanges) => void;
}) {
    const { colors } = useTheme();
    const [draft, setDraft] = useState<StoreViewEditDraft>(() => createStoreViewEditDraft(detail));
    const [localError, setLocalError] = useState<string | null>(null);
    useEffect(() => {
        if (visible) {
            setDraft(createStoreViewEditDraft(detail));
            setLocalError(null);
        }
    }, [detail, visible]);
    const changes = useMemo(() => buildStoreViewChanges(detail, draft), [detail, draft]);
    const hasChanges = Object.keys(changes).length > 0;
    const update = (value: Partial<StoreViewEditDraft>) => {
        setDraft((current) => ({ ...current, ...value }));
        setLocalError(null);
    };
    const submit = () => {
        const validation = validateStoreViewEditDraft(draft);
        if (validation) return setLocalError(validation);
        if (!hasChanges) return setLocalError('There are no changes to save.');
        onSave(changes);
    };
    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onDismiss}>
            <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}>
                <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '800' }}>Edit book</Text>
                <Text selectable style={{ color: colors.textSecondary }}>Save Changes updates this committed inventory item. Public and Owner-only fields are labeled separately.</Text>
                <Input label="Title" testID="store-view-edit-title" value={draft.title} onChangeText={(title) => update({ title })} />
                <Input label="Authors (comma separated)" testID="store-view-edit-authors" value={draft.authors} onChangeText={(authors) => update({ authors })} />
                <Input label="Language" testID="store-view-edit-language" value={draft.language} onChangeText={(language) => update({ language })} />
                <Input multiline label="Public description" testID="store-view-edit-public-description" value={draft.publicDescription} onChangeText={(publicDescription) => update({ publicDescription })} />
                <Input label="Selling price in paise" testID="store-view-edit-price-minor" value={draft.sellingPriceMinor} onChangeText={(sellingPriceMinor) => update({ sellingPriceMinor })} />
                <View style={{ gap: 8 }}>
                    <Text selectable style={{ color: colors.textSecondary, fontWeight: '700' }}>Condition</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {CONDITIONS.map((condition) => (
                            <Pressable key={condition} testID={`store-view-condition-${condition}`} onPress={() => update({ condition })} style={{ borderWidth: 1, borderColor: draft.condition === condition ? colors.accent : colors.border, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 }}>
                                <Text style={{ color: colors.textPrimary }}>{condition.replaceAll('_', ' ')}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>
                <Input multiline label="Public condition note" testID="store-view-edit-public-condition-note" value={draft.publicConditionNote} onChangeText={(publicConditionNote) => update({ publicConditionNote })} />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <Text selectable style={{ color: colors.textPrimary, fontWeight: '700' }}>Has damage</Text>
                    <Switch testID="store-view-edit-has-damage" value={draft.hasDamage} onValueChange={(hasDamage) => update({ hasDamage, ...(hasDamage ? {} : { damageTypes: [], damageNote: '' }) })} />
                </View>
                {draft.hasDamage ? (
                    <View style={{ gap: 10 }}>
                        <Text selectable style={{ color: colors.textSecondary, fontWeight: '700' }}>Damage types</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {DAMAGE_TYPES.map((damageType) => {
                                const selected = draft.damageTypes.includes(damageType);
                                return (
                                    <Pressable key={damageType} testID={`store-view-damage-${damageType}`} onPress={() => update({ damageTypes: selected ? draft.damageTypes.filter((value) => value !== damageType) : [...draft.damageTypes, damageType] })} style={{ borderWidth: 1, borderColor: selected ? colors.accent : colors.border, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 }}>
                                        <Text style={{ color: colors.textPrimary }}>{damageType.replaceAll('_', ' ')}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                        <Input multiline label="Damage note" testID="store-view-edit-damage-note" value={draft.damageNote} onChangeText={(damageNote) => update({ damageNote })} />
                    </View>
                ) : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <Text selectable style={{ color: colors.textPrimary, fontWeight: '700' }}>Sellable</Text>
                    <Switch testID="store-view-edit-sellable" value={draft.isSellable} onValueChange={(isSellable) => update({ isSellable })} />
                </View>
                <Input label="Shelf / location" ownerOnly testID="store-view-edit-shelf-location" value={draft.shelfLocation} onChangeText={(shelfLocation) => update({ shelfLocation })} />
                <Input multiline label="Internal notes" ownerOnly testID="store-view-edit-internal-notes" value={draft.internalNotes} onChangeText={(internalNotes) => update({ internalNotes })} />
                {localError || error ? <Text testID="store-view-edit-error" selectable style={{ color: colors.error, fontWeight: '700' }}>{localError ?? error}</Text> : null}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable accessibilityRole="button" disabled={submitting} onPress={onDismiss} style={{ flex: 1, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Cancel</Text></Pressable>
                    <Pressable testID="store-view-save-changes" accessibilityRole="button" accessibilityState={{ disabled: submitting || !hasChanges }} disabled={submitting || !hasChanges} onPress={submit} style={{ flex: 1, minHeight: 48, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: submitting || !hasChanges ? 0.5 : 1 }}>
                        {submitting ? <ActivityIndicator color="#fff" /> : null}
                        <Text style={{ color: '#fff', fontWeight: '800' }}>{submitting ? 'Saving…' : 'Save Changes'}</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </Modal>
    );
}
