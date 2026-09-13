import { useEffect, useState } from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import {
    CONDITION_CHOICES,
    LANGUAGE_OPTIONS,
    PRICE_PRESET_MINOR_OPTIONS,
    PUBLICATION_CHOICES,
    formatInrFromMinor,
    rupeesToPriceMinor,
    type ScanSetupFormState,
} from '../scanSetup/scanSetupForm';
import {
    SetupChoiceChip,
    SetupFieldLabel,
    SetupPicker,
    SetupSection,
} from './ScanSetupControls';

type ScanSetupFormProps = Readonly<{
    form: ScanSetupFormState;
    onChange: (next: ScanSetupFormState) => void;
}>;

const QUICK_PRICE_MINOR_OPTIONS: ReadonlyArray<number | null> = [null, 2500, 5000, 10000, 15000, 20000];
const LOCATION_LETTERS: ReadonlyArray<Readonly<{ value: string | null; label: string }>> =
    Array.from({ length: 26 }, (_, index) => {
        const value = String.fromCharCode(65 + index);
        return { value, label: value };
    });
const LOCATION_NUMBERS: ReadonlyArray<Readonly<{ value: string | null; label: string }>> =
    Array.from({ length: 9 }, (_, index) => {
        const value = String(index + 1);
        return { value, label: value };
    });

function LocationField({ form, onChange }: ScanSetupFormProps) {
    const { colors } = useTheme();
    const initialCode = /^([A-Z])([1-9])$/u.exec(form.location.trim().toUpperCase());
    const [letter, setLetter] = useState<string | null>(initialCode?.[1] ?? null);
    const [number, setNumber] = useState<string | null>(initialCode?.[2] ?? null);

    useEffect(() => {
        const code = /^([A-Z])([1-9])$/u.exec(form.location.trim().toUpperCase());
        if (code) {
            setLetter(code[1]);
            setNumber(code[2]);
        } else if (form.location.trim()) {
            setLetter(null);
            setNumber(null);
        }
    }, [form.location]);

    return (
        <>
            <SetupFieldLabel label="Shelf location" />
            <Text selectable style={[styles.helper, { color: colors.textSecondary }]}>Choose a shelf code or enter any location below.</Text>
            <View style={styles.locationSelectors}>
                <SetupPicker
                    label="Letter"
                    value={letter}
                    options={LOCATION_LETTERS}
                    onSelect={(nextLetter) => {
                        setLetter(nextLetter);
                        if (nextLetter && number) onChange({ ...form, location: `${nextLetter}${number}` });
                    }}
                    testID="setup-location-letter"
                    compact
                />
                <SetupPicker
                    label="Number"
                    value={number}
                    options={LOCATION_NUMBERS}
                    onSelect={(nextNumber) => {
                        setNumber(nextNumber);
                        if (letter && nextNumber) onChange({ ...form, location: `${letter}${nextNumber}` });
                    }}
                    testID="setup-location-number"
                    compact
                />
            </View>
            <Text selectable style={[styles.locationOr, { color: colors.textTertiary }]}>OR ENTER A LOCATION</Text>
            <TextInput
                testID="setup-location"
                accessibilityLabel="Shelf location"
                value={form.location}
                onChangeText={(location) => onChange({ ...form, location })}
                placeholder="e.g. Front shelf or Warehouse corner"
                placeholderTextColor={colors.textTertiary}
                maxLength={120}
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
            />
            <Text selectable style={[styles.helper, { color: colors.textSecondary }]}>Used as the default for every detected book.</Text>
        </>
    );
}

function PriceField({ form, onChange }: ScanSetupFormProps) {
    const { colors } = useTheme();
    const [expanded, setExpanded] = useState(false);
    const [customPrice, setCustomPrice] = useState('');

    return (
        <View style={styles.fieldGroup}>
            <SetupFieldLabel label="Default price" optional />
            <View style={styles.chipRow}>
                {QUICK_PRICE_MINOR_OPTIONS.map((minor) => (
                    <SetupChoiceChip
                        key={`price-${minor ?? 'unset'}`}
                        label={minor === null ? 'Not set' : formatInrFromMinor(minor)}
                        selected={form.priceMinor === minor}
                        onPress={() => {
                            setCustomPrice('');
                            onChange({ ...form, priceMinor: minor });
                        }}
                        testID={`setup-price-${minor ?? 'unset'}`}
                    />
                ))}
            </View>
            <Pressable
                testID="setup-price-selector"
                accessibilityRole="button"
                accessibilityLabel="More price options and custom price"
                accessibilityState={{ expanded }}
                onPress={() => setExpanded((current) => !current)}
                style={({ pressed }) => [
                    styles.selector,
                    {
                        backgroundColor: colors.bgSecondary,
                        borderColor: expanded ? colors.accent : colors.border,
                        opacity: pressed ? 0.75 : 1,
                    },
                ]}
            >
                <View>
                    <Text selectable style={[styles.selectorValue, { color: colors.textPrimary }]}>
                        {expanded ? 'Hide more prices' : 'More prices and custom'}
                    </Text>
                    <Text selectable style={[styles.selectorHint, { color: colors.textSecondary }]}>Current: {formatInrFromMinor(form.priceMinor)}</Text>
                </View>
                <Text selectable accessibilityElementsHidden style={[styles.chevron, { color: colors.accent }]}>
                    {expanded ? '−' : '+'}
                </Text>
            </Pressable>
            <View
                testID="setup-price-options"
                accessibilityElementsHidden={!expanded}
                importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}
                style={[styles.priceOptions, !expanded && styles.priceOptionsCollapsed]}
            >
                <TextInput
                    testID="setup-price-custom"
                    accessibilityLabel="Custom whole-rupee price"
                    value={customPrice}
                    onChangeText={(value) => {
                        setCustomPrice(value);
                        const parsed = /^\d+$/u.test(value) ? Number(value) : Number.NaN;
                        onChange({
                            ...form,
                            priceMinor: Number.isSafeInteger(parsed) ? rupeesToPriceMinor(parsed) : null,
                        });
                    }}
                    placeholder="Enter a custom price"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                    style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                />
                <View style={styles.chipRow}>
                    {PRICE_PRESET_MINOR_OPTIONS.filter((minor) => !QUICK_PRICE_MINOR_OPTIONS.includes(minor)).map((minor) => (
                        <SetupChoiceChip
                            key={`price-${minor ?? 'unset'}`}
                            label={minor === null ? 'Not set' : formatInrFromMinor(minor)}
                            selected={form.priceMinor === minor}
                            onPress={() => {
                                setCustomPrice('');
                                onChange({ ...form, priceMinor: minor });
                                setExpanded(false);
                            }}
                            testID={`setup-price-${minor ?? 'unset'}`}
                        />
                    ))}
                </View>
            </View>
        </View>
    );
}

export function ScanSetupForm({ form, onChange }: ScanSetupFormProps) {
    const { colors } = useTheme();
    const inputStyle = [styles.input, { borderColor: colors.border, color: colors.textPrimary }];

    return (
        <View style={styles.form}>
            <SetupSection title="Batch" eyebrow="OPTIONAL ORGANIZATION">
                <SetupFieldLabel label="Batch label" optional />
                <TextInput
                    testID="setup-batch-label"
                    accessibilityLabel="Optional batch label"
                    value={form.batchLabel}
                    onChangeText={(batchLabel) => onChange({ ...form, batchLabel })}
                    placeholder="e.g. Box 7 or Saturday intake"
                    placeholderTextColor={colors.textTertiary}
                    maxLength={80}
                    style={inputStyle}
                />
            </SetupSection>

            <SetupSection title="Location" eyebrow="REQUIRED">
                <LocationField form={form} onChange={onChange} />
            </SetupSection>

            <SetupSection title="Book defaults" eyebrow="APPLIED TO THIS SCAN">
                <View style={styles.fieldGroup}>
                    <SetupFieldLabel label="Language hint" />
                    <SetupPicker
                        label="Language"
                        value={form.languageHint}
                        options={LANGUAGE_OPTIONS}
                        onSelect={(languageHint) => onChange({ ...form, languageHint })}
                        testID="setup-language"
                        searchable
                    />
                    <Text selectable style={[styles.helper, { color: colors.textSecondary }]}>Hint only — detected language wins when available.</Text>
                </View>

                <View style={styles.fieldGroup}>
                    <SetupFieldLabel label="Default condition" optional />
                    <SetupPicker
                        label="Select condition"
                        value={form.condition}
                        options={CONDITION_CHOICES}
                        onSelect={(condition) => onChange({ ...form, condition })}
                        testID="setup-condition"
                    />
                </View>

                <PriceField form={form} onChange={onChange} />
            </SetupSection>

            <SetupSection title="Publication" eyebrow="INTENT ONLY">
                <View style={[styles.segmented, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                    {PUBLICATION_CHOICES.map((choice) => (
                        <SetupChoiceChip
                            key={choice.value}
                            label={choice.label}
                            selected={form.publication === choice.value}
                            onPress={() => onChange({ ...form, publication: choice.value })}
                            testID={`setup-publication-${choice.value}`}
                            style={styles.segment}
                        />
                    ))}
                </View>
                <Text selectable style={[styles.helper, { color: colors.textSecondary }]}>Books are committed privately in this milestone.</Text>
            </SetupSection>
        </View>
    );
}

export function ScanSetupSummary({ form }: Readonly<{ form: ScanSetupFormState }>) {
    const { colors } = useTheme();
    const language = LANGUAGE_OPTIONS.find((option) => option.value === form.languageHint)?.label ?? form.languageHint;
    const condition = CONDITION_CHOICES.find((choice) => choice.value === form.condition)?.label ?? 'Not set';
    const publication = PUBLICATION_CHOICES.find((choice) => choice.value === form.publication)?.label ?? 'Private';
    return (
        <View testID="setup-summary" style={styles.summary}>
            <Text selectable numberOfLines={2} style={[styles.summaryMain, { color: colors.textPrimary }]}>
                {form.location.trim() || 'Location required'} · {language} · {condition} · {formatInrFromMinor(form.priceMinor)}
            </Text>
            <Text selectable style={[styles.summarySub, { color: colors.textSecondary }]}>{publication} · 1 copy per detected book</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    form: { gap: 16 },
    fieldGroup: { gap: 9 },
    input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
    helper: { fontSize: 12, lineHeight: 17 },
    locationSelectors: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    locationOr: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textAlign: 'center' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    selector: { minHeight: 58, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    selectorValue: { fontSize: 15, fontWeight: '800' },
    selectorHint: { fontSize: 12, marginTop: 2 },
    chevron: { fontSize: 22, fontWeight: '500' },
    priceOptions: { gap: 10, marginTop: 2 },
    priceOptionsCollapsed: { display: 'none' },
    segmented: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 4, gap: 4 },
    segment: { flex: 1, alignItems: 'center', borderRadius: 10 },
    summary: { gap: 3 },
    summaryMain: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
    summarySub: { fontSize: 12, lineHeight: 16 },
});
