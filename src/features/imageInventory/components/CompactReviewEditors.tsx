import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import type { OwnerCandidateReview } from '../contracts/ownerUxReviewSchema';
import type {
    CompactReviewDisplay,
    CompactReviewEdits,
} from '../review/compactReviewDraft';
import {
    CONDITION_CHOICES,
    LANGUAGE_OPTIONS,
    PRICE_PRESET_MINOR_OPTIONS,
    PUBLICATION_CHOICES,
    formatInrFromMinor,
    rupeesToPriceMinor,
    type ScanSetupFormState,
} from '../scanSetup/scanSetupForm';

const DAMAGE_TYPES: ReadonlyArray<Readonly<[string, string]>> = [
    ['cover', 'Cover'], ['binding', 'Binding'], ['pages', 'Pages'],
    ['water', 'Water'], ['staining', 'Staining'], ['writing', 'Writing'],
    ['missing_parts', 'Missing parts'],
    ['mould_or_contamination', 'Mould or contamination'], ['other', 'Other'],
];

type Section = 'identity' | 'language' | 'condition' | 'price'
    | 'quantity' | 'location' | 'publication' | 'damage' | null;

export function CompactReviewEditors({
    values,
    defaults,
    disabled,
    forceIdentityOpen,
    onIdentityOpened,
    onChange,
}: {
    values: CompactReviewDisplay;
    defaults: ScanSetupFormState;
    disabled: boolean;
    forceIdentityOpen: boolean;
    onIdentityOpened: () => void;
    onChange: (patch: CompactReviewEdits) => void;
}) {
    const { colors } = useTheme();
    const [open, setOpen] = useState<Section>(null);
    const [customRupees, setCustomRupees] = useState('');
    const [customLocation, setCustomLocation] = useState(values.location);
    useEffect(() => {
        if (!forceIdentityOpen) return;
        setOpen('identity');
        onIdentityOpened();
    }, [forceIdentityOpen, onIdentityOpened]);
    const identityOpen = open === 'identity';
    const choose = (section: Section) => setOpen((current) => current === section ? null : section);
    const inputStyle = {
        color: colors.textPrimary,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        padding: 10,
        minHeight: 44,
    } as const;
    const damage = values.damage;
    const updateDamage = (patch: Partial<OwnerCandidateReview['damageDisclosure']>) => {
        const next = { ...damage, ...patch };
        if (!next.hasDamage) {
            next.damageTypes = [];
            next.damageNote = null;
        }
        onChange({ damageDisclosure: next });
    };
    return (
        <View style={{ gap: 8, marginTop: 10 }}>
            <Button title="Edit title and authors" variant="secondary"
                onPress={() => choose('identity')} disabled={disabled} />
            {identityOpen ? (
                <View style={{ gap: 8 }} testID="compact-identity-editor">
                    <TextInput
                        accessibilityLabel="Compact title"
                        testID="compact-title"
                        value={values.title}
                        maxLength={512}
                        onChangeText={(originalTitle) => onChange({ originalTitle })}
                        editable={!disabled}
                        style={inputStyle}
                    />
                    {values.authors.map((author, index) => (
                        <View key={`compact-author-${index}`} style={{ gap: 6 }}>
                            <TextInput
                                accessibilityLabel={`Compact author ${index + 1}`}
                                testID={`compact-author-${index}`}
                                value={author}
                                maxLength={256}
                                onChangeText={(value) => onChange({
                                    authors: values.authors.map((item, itemIndex) => (
                                        itemIndex === index ? value : item
                                    )),
                                })}
                                editable={!disabled}
                                style={inputStyle}
                            />
                            <Button title={`Remove author ${index + 1}`} variant="ghost" onPress={() => onChange({
                                authors: values.authors.filter((_, itemIndex) => itemIndex !== index),
                            })} disabled={disabled} />
                        </View>
                    ))}
                    {values.authors.length < 20 ? (
                        <Button title="Add author" variant="secondary" onPress={() => onChange({
                            authors: [...values.authors, ''],
                        })} disabled={disabled} />
                    ) : null}
                </View>
            ) : null}

            <Button title="Edit language" variant="secondary" onPress={() => choose('language')} disabled={disabled} />
            {open === 'language' ? (
                <View style={{ gap: 6 }}>
                    {LANGUAGE_OPTIONS.map((choice) => (
                        <Button key={choice.value} title={choice.label} variant="secondary" onPress={() => {
                            onChange({ originalLanguage: choice.value });
                            setOpen(null);
                        }} disabled={disabled} />
                    ))}
                </View>
            ) : null}

            <Button title="Edit condition" testID="card-condition-open" variant="secondary" onPress={() => choose('condition')} disabled={disabled} />
            {open === 'condition' ? (
                <View style={{ gap: 6 }}>
                    {CONDITION_CHOICES.filter((choice) => choice.value !== null).map((choice) => (
                        <Button key={choice.value} title={choice.label} variant="secondary" onPress={() => {
                            onChange({ baseCondition: choice.value! });
                            setOpen(null);
                        }} disabled={disabled} />
                    ))}
                </View>
            ) : null}

            <Button title="Edit price" variant="secondary" onPress={() => choose('price')} disabled={disabled} />
            {open === 'price' ? (
                <View style={{ gap: 6 }} testID="compact-price-picker">
                    {PRICE_PRESET_MINOR_OPTIONS.map((value) => (
                        <Button key={value ?? 'not-set'} title={formatInrFromMinor(value)} variant="secondary" onPress={() => {
                            onChange({ priceMinor: value });
                            setOpen(null);
                        }} disabled={disabled} />
                    ))}
                    <TextInput
                        accessibilityLabel="Custom whole rupees"
                        testID="compact-custom-rupees"
                        value={customRupees}
                        keyboardType="number-pad"
                        onChangeText={setCustomRupees}
                        editable={!disabled}
                        style={inputStyle}
                    />
                    <Button title="Use custom price" onPress={() => {
                        const normalized = customRupees.trim();
                        if (normalized === '') {
                            onChange({ priceMinor: null });
                            setOpen(null);
                            return;
                        }
                        const minor = rupeesToPriceMinor(Number(normalized));
                        if (minor !== null) {
                            onChange({ priceMinor: minor });
                            setOpen(null);
                        }
                    }} disabled={disabled} />
                </View>
            ) : null}

            <Button title="Edit quantity" variant="secondary" onPress={() => choose('quantity')} disabled={disabled} />
            {open === 'quantity' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Button title="Decrease quantity" variant="secondary" onPress={() => onChange({
                        quantity: Math.max(1, values.quantity - 1),
                    })} disabled={disabled || values.quantity <= 1} />
                    <TextInput
                        accessibilityLabel="Compact quantity"
                        testID="compact-quantity"
                        value={String(values.quantity)}
                        keyboardType="number-pad"
                        onChangeText={(raw) => {
                            const next = Number(raw);
                            if (Number.isInteger(next) && next >= 1 && next <= 10_000) {
                                onChange({ quantity: next });
                            }
                        }}
                        editable={!disabled}
                        style={[inputStyle, { minWidth: 64 }]}
                    />
                    <Button title="Increase quantity" variant="secondary" onPress={() => onChange({
                        quantity: Math.min(10_000, values.quantity + 1),
                    })} disabled={disabled || values.quantity >= 10_000} />
                </View>
            ) : null}

            <Button title="Edit location" variant="secondary" onPress={() => choose('location')} disabled={disabled} />
            {open === 'location' ? (
                <View style={{ gap: 6 }}>
                    <Button title="Use batch location" variant="secondary" onPress={() => {
                        onChange({ shelfLocation: defaults.location });
                        setOpen(null);
                    }} disabled={disabled} />
                    <TextInput accessibilityLabel="Custom location" testID="compact-location" value={customLocation} maxLength={120} onChangeText={setCustomLocation} editable={!disabled} style={inputStyle} />
                    <Button title="Use custom location" onPress={() => {
                        const shelfLocation = customLocation.trim();
                        if (shelfLocation) {
                            onChange({ shelfLocation });
                            setOpen(null);
                        }
                    }} disabled={disabled} />
                </View>
            ) : null}

            <Button title="Edit publication" variant="secondary" onPress={() => choose('publication')} disabled={disabled} />
            {open === 'publication' ? (
                <View style={{ gap: 6 }}>
                    {PUBLICATION_CHOICES.map((choice) => (
                        <Button key={choice.value} title={choice.label} variant="secondary" onPress={() => {
                            onChange({ publicationIntent: choice.value });
                            setOpen(null);
                        }} disabled={disabled} />
                    ))}
                    <Text selectable style={{ color: colors.textSecondary }}>Adding always creates private inventory.</Text>
                </View>
            ) : null}

            <Button title="Edit damage" variant="secondary" onPress={() => choose('damage')} disabled={disabled} />
            {open === 'damage' ? (
                <View style={{ gap: 6 }}>
                    <Button title="No damage" variant="secondary" onPress={() => updateDamage({ hasDamage: false })} disabled={disabled} />
                    <Button title="Has damage" variant="secondary" onPress={() => updateDamage({ hasDamage: true })} disabled={disabled} />
                    {damage.hasDamage ? DAMAGE_TYPES.map(([value, label]) => (
                        <Button key={value} title={label} variant="secondary" onPress={() => updateDamage({
                            damageTypes: damage.damageTypes.includes(value as never)
                                ? damage.damageTypes.filter((item) => item !== value)
                                : [...damage.damageTypes, value as never],
                        })} disabled={disabled} />
                    )) : null}
                    {damage.hasDamage ? (
                        <TextInput accessibilityLabel="Damage note" testID="compact-damage-note" value={damage.damageNote ?? ''} maxLength={1000} onChangeText={(damageNote) => updateDamage({ damageNote })} editable={!disabled} style={inputStyle} />
                    ) : null}
                    <Button title="Complete, readable, and safe" variant="secondary" onPress={() => updateDamage({ completeReadableSafe: !damage.completeReadableSafe })} disabled={disabled} />
                    <Button title="Sellable copy" variant="secondary" onPress={() => updateDamage({ isSellable: !damage.isSellable })} disabled={disabled} />
                </View>
            ) : null}
        </View>
    );
}
