import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { CONDITION_CHOICES, formatInrFromMinor, rupeesToPriceMinor } from '../scanSetup/scanSetupForm';
import type { CompactReviewDisplay, CompactReviewEdits } from '../review/compactReviewDraft';
import { SourceBadge } from './BatchReviewFieldSummary';

type Props = {
    display: CompactReviewDisplay;
    priceSourceCode: string; quantitySourceCode: string; conditionSourceCode: string;
    priceLocal: boolean; quantityLocal: boolean; conditionLocal: boolean;
    errorFields: ReadonlySet<string>; disabled: boolean;
    onChange: (patch: CompactReviewEdits) => void;
};
const PRICES = [null, 2500, 5000, 10000, 25000, 50000, 100000];

export function InlineReviewValueFields({
    display, priceSourceCode, quantitySourceCode, conditionSourceCode,
    priceLocal, quantityLocal, conditionLocal, errorFields, disabled, onChange,
}: Props) {
    const { colors } = useTheme();
    const [editor, setEditor] = useState<'price' | 'condition' | null>(null);
    const [customRupees, setCustomRupees] = useState('');
    const [error, setError] = useState<string | null>(null);
    const condition = CONDITION_CHOICES.find((item) => item.value === display.condition)?.label ?? 'Not set';
    const toggle = (value: 'price' | 'condition') => {
        if (value === 'price') {
            setCustomRupees(display.priceMinor === null ? '' : String(display.priceMinor / 100));
            setError(null);
        }
        setEditor(editor === value ? null : value);
    };
    const applyPrice = () => {
        const value = customRupees.trim();
        const minor = value === '' ? null : rupeesToPriceMinor(Number(value));
        if (minor === null && value !== '') { setError('Enter a whole-rupee amount.'); return; }
        onChange({ priceMinor: minor });
        setEditor(null);
    };
    const source = (code: string, local: boolean, field: string) => (
        <View style={{ alignSelf: 'flex-start' }}>
            <SourceBadge code={code} local={local} testID={local ? `card-${field}-overlay` : undefined} />
        </View>
    );
    const field = (kind: 'price' | 'condition', label: string, value: string, code: string, local: boolean) => {
        const invalid = errorFields.has(kind === 'price' ? 'priceMinor' : 'baseCondition');
        return (
            <View style={{ flexGrow: 1, flexBasis: 126, gap: 7 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>{label}</Text>
                <Pressable testID={`card-${kind}-field`} accessibilityRole="button"
                    accessibilityLabel={`Edit ${label}`} accessibilityState={{ expanded: editor === kind, disabled }}
                    disabled={disabled} onPress={() => toggle(kind)}
                    style={({ pressed }) => ({
                        minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12,
                        paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8,
                        backgroundColor: pressed || editor === kind ? colors.bgCard : colors.bgSecondary,
                        borderColor: invalid ? colors.error : editor === kind ? colors.accent : colors.border,
                        opacity: disabled ? 0.5 : 1,
                    })}>
                    <Text style={{ flex: 1, color: invalid ? colors.error : colors.textPrimary, fontSize: 16, fontWeight: '700' }}>{value}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{editor === kind ? '⌃' : '⌄'}</Text>
                </Pressable>
                {source(code, local, kind)}
            </View>
        );
    };
    const option = (label: string, selected: boolean, onPress: () => void) => (
        <Pressable key={label} accessibilityRole="button" accessibilityLabel={label}
            accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
            style={({ pressed }) => ({
                minHeight: 44, flexGrow: 1, flexBasis: 92, paddingHorizontal: 12, paddingVertical: 11,
                borderRadius: 10, borderWidth: 1, borderColor: selected ? colors.accent : colors.border,
                backgroundColor: selected || pressed ? colors.bgCard : colors.bgSecondary,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            })}>
            <Text style={{ color: selected ? colors.accent : colors.textPrimary, fontWeight: '600', fontSize: 14 }}>{label}</Text>
            {selected ? <Text style={{ color: colors.accent }}>✓</Text> : null}
        </Pressable>
    );
    return (
        <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
                {field('price', 'Price', formatInrFromMinor(display.priceMinor), priceSourceCode, priceLocal)}
                {field('condition', 'Condition', condition, conditionSourceCode, conditionLocal)}
                <View style={{ flexGrow: 1, flexBasis: 136, gap: 7 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>Quantity</Text>
                    <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', borderWidth: 1,
                        borderColor: errorFields.has('quantity') ? colors.error : colors.border,
                        borderRadius: 12, backgroundColor: colors.bgSecondary, overflow: 'hidden' }}>
                        {([-1, 0, 1] as const).map((step) => {
                            if (step === 0) return <Text key="value" accessibilityLabel={`Quantity: ${display.quantity}`}
                                style={{ flex: 1, textAlign: 'center', color: colors.textPrimary, fontSize: 16,
                                    fontWeight: '700', fontVariant: ['tabular-nums'] }}>{display.quantity}</Text>;
                            const blocked = disabled || (step < 0 ? display.quantity <= 1 : display.quantity >= 10000);
                            return <Pressable key={step} testID={step < 0 ? 'card-quantity-decrease' : 'card-quantity-increase'}
                                accessibilityRole="button" accessibilityLabel={step < 0 ? 'Decrease quantity' : 'Increase quantity'}
                                accessibilityState={{ disabled: blocked }} disabled={blocked}
                                onPress={() => onChange({ quantity: Math.max(1, Math.min(10000, display.quantity + step)) })}
                                style={({ pressed }) => ({ width: 44, minHeight: 46, alignItems: 'center',
                                    justifyContent: 'center', opacity: blocked ? 0.3 : 1,
                                    backgroundColor: pressed ? colors.bgCard : 'transparent' })}>
                                <Text style={{ color: colors.textPrimary, fontSize: 22 }}>{step < 0 ? '−' : '+'}</Text>
                            </Pressable>;
                        })}
                    </View>
                    {source(quantitySourceCode, quantityLocal, 'quantity')}
                </View>
            </View>
            {editor ? (
                <View testID={`card-${editor}-picker`} style={{ padding: 14, gap: 12, borderRadius: 14,
                    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgSecondary }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ flex: 1, color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>
                            {editor === 'price' ? 'Choose a price' : 'Choose condition'}
                        </Text>
                        <Pressable accessibilityRole="button" accessibilityLabel="Close editor" onPress={() => setEditor(null)}
                            style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={{ color: colors.textSecondary, fontSize: 20 }}>×</Text>
                        </Pressable>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {editor === 'price' ? PRICES.map((value) => option(formatInrFromMinor(value), display.priceMinor === value,
                            () => { onChange({ priceMinor: value }); setEditor(null); }))
                            : CONDITION_CHOICES.filter((item) => item.value !== null).map((item) => option(item.label,
                                item.value === display.condition, () => { onChange({ baseCondition: item.value! }); setEditor(null); }))}
                    </View>
                    {editor === 'price' ? (
                        <View style={{ gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Or enter an amount · whole rupees</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                <View style={{ flexGrow: 1, flexBasis: 120, flexDirection: 'row', alignItems: 'center', gap: 8,
                                    minHeight: 48, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1,
                                    borderColor: error ? colors.error : colors.border, backgroundColor: colors.bgCard }}>
                                    <Text style={{ color: colors.textSecondary, fontSize: 16 }}>₹</Text>
                                    <TextInput accessibilityLabel="Custom whole rupees" testID="card-custom-rupees"
                                        value={customRupees} keyboardType="number-pad" editable={!disabled}
                                        placeholder="Amount" placeholderTextColor={colors.textTertiary}
                                        onChangeText={(value) => { setCustomRupees(value); setError(null); }}
                                        onSubmitEditing={applyPrice} returnKeyType="done"
                                        style={{ flex: 1, minWidth: 0, minHeight: 46, color: colors.textPrimary, fontSize: 16 }} />
                                </View>
                                <Pressable accessibilityRole="button" accessibilityLabel="Use custom price" disabled={disabled}
                                    onPress={applyPrice} style={{ minHeight: 48, paddingHorizontal: 18, borderRadius: 10,
                                        backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Apply</Text>
                                </Pressable>
                            </View>
                            {error ? <Text accessibilityLiveRegion="polite" style={{ color: colors.error, fontSize: 12 }}>{error}</Text> : null}
                        </View>
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}
