import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { StoreViewDetail } from '../contracts/storeViewContracts';

export function StoreViewStockModal({
    visible, detail, submitting, error, onDismiss, onSave,
}: {
    visible: boolean; detail: StoreViewDetail; submitting: boolean; error: string | null;
    onDismiss: () => void; onSave: (delta: number) => void;
}) {
    const { colors } = useTheme();
    const [delta, setDelta] = useState('');
    const [localError, setLocalError] = useState<string | null>(null);
    useEffect(() => {
        if (visible) { setDelta(''); setLocalError(null); }
    }, [visible]);
    const submit = () => {
        if (!/^-?\d+$/u.test(delta)) return setLocalError('Enter a whole-number stock change.');
        const parsed = Number(delta);
        if (!Number.isSafeInteger(parsed) || parsed === 0 || Math.abs(parsed) > 10_000) {
            return setLocalError('Enter a nonzero stock change between -10000 and 10000.');
        }
        if (detail.stock.quantityAvailable + parsed < 0) {
            return setLocalError('This change would make available stock negative.');
        }
        onSave(parsed);
    };
    return (
        <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onDismiss}>
            <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}>
                <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '800' }}>Adjust Stock</Text>
                <Text selectable style={{ color: colors.textSecondary }}>Current available stock: {detail.stock.quantityAvailable}</Text>
                <Text selectable style={{ color: colors.textSecondary }}>Total {detail.stock.quantityTotal}</Text>
                <Text selectable style={{ color: colors.textSecondary }}>Reserved {detail.stock.quantityReserved} · Sold {detail.stock.quantitySold} · Removed {detail.stock.quantityRemoved}</Text>
                <Text selectable style={{ color: colors.textSecondary }}>Enter a positive number to add copies or a negative number to remove available copies. The server confirms the final state.</Text>
                <TextInput testID="store-view-stock-delta" accessibilityLabel="Stock change" keyboardType="numbers-and-punctuation" value={delta} onChangeText={(value) => { setDelta(value); setLocalError(null); }} style={{ minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, color: colors.textPrimary }} />
                {localError || error ? <Text testID="store-view-stock-error" selectable style={{ color: colors.error, fontWeight: '700' }}>{localError ?? error}</Text> : null}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable accessibilityRole="button" disabled={submitting} onPress={onDismiss} style={{ flex: 1, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Cancel</Text></Pressable>
                    <Pressable testID="store-view-apply-stock" accessibilityRole="button" disabled={submitting} onPress={submit} style={{ flex: 1, minHeight: 48, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: submitting ? 0.5 : 1 }}>
                        {submitting ? <ActivityIndicator color="#fff" /> : null}
                        <Text style={{ color: '#fff', fontWeight: '800' }}>{submitting ? 'Applying…' : 'Apply Stock Change'}</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </Modal>
    );
}
