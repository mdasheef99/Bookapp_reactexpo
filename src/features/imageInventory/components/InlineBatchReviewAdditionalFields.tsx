import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import type { OwnerCandidateReview } from '../contracts/ownerUxReviewSchema';
import type { CompactReviewDisplay, CompactReviewEdits } from '../review/compactReviewDraft';
import {
    LANGUAGE_OPTIONS,
    PUBLICATION_CHOICES,
    type ScanSetupFormState,
} from '../scanSetup/scanSetupForm';
import { FieldSummary } from './BatchReviewFieldSummary';

type DamageType = OwnerCandidateReview['damageDisclosure']['damageTypes'][number];
type AdditionalSection = 'language' | 'location' | 'publication' | 'damage' | null;

const DAMAGE_TYPES: ReadonlyArray<Readonly<{ value: DamageType; label: string }>> = [
    { value: 'cover', label: 'Cover' },
    { value: 'binding', label: 'Binding' },
    { value: 'pages', label: 'Pages' },
    { value: 'water', label: 'Water' },
    { value: 'staining', label: 'Staining' },
    { value: 'writing', label: 'Writing' },
    { value: 'missing_parts', label: 'Missing parts' },
    { value: 'mould_or_contamination', label: 'Mould or contamination' },
    { value: 'other', label: 'Other' },
];

type Props = Readonly<{
    display: CompactReviewDisplay;
    defaults: ScanSetupFormState;
    sourceCodes: Readonly<{
        language: string;
        location: string;
        publication: string;
        damage: string;
    }>;
    localFields: Readonly<{
        language: boolean;
        location: boolean;
        publication: boolean;
        damage: boolean;
    }>;
    errorFields: ReadonlySet<string>;
    disabled: boolean;
    onChange: (patch: CompactReviewEdits) => void;
}>;

export function InlineBatchReviewAdditionalFields({
    display, defaults, sourceCodes, localFields, errorFields, disabled, onChange,
}: Props) {
    const { colors } = useTheme();
    const [open, setOpen] = useState<AdditionalSection>(null);
    const [languageSearch, setLanguageSearch] = useState('');
    const [customLocation, setCustomLocation] = useState(display.location);

    useEffect(() => {
        if (open !== 'location') setCustomLocation(display.location);
    }, [display.location, open]);

    const toggle = (section: Exclude<AdditionalSection, null>) => {
        if (open === section) {
            setOpen(null);
            return;
        }
        if (section === 'language') setLanguageSearch('');
        if (section === 'location') setCustomLocation(display.location);
        setOpen(section);
    };
    const panelStyle = {
        gap: 8,
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.bgSecondary,
    } as const;
    const inputStyle = {
        color: colors.textPrimary,
        borderWidth: 1,
        borderColor: colors.accent,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        minHeight: 44,
        backgroundColor: colors.bgCard,
    } as const;
    const normalizedLanguageSearch = languageSearch.trim().toLocaleLowerCase();
    const visibleLanguages = LANGUAGE_OPTIONS.filter((choice) => (
        !normalizedLanguageSearch
        || choice.label.toLocaleLowerCase().includes(normalizedLanguageSearch)
        || choice.value.toLocaleLowerCase().includes(normalizedLanguageSearch)
    ));
    const damage = display.damage;
    const updateDamage = (patch: Partial<OwnerCandidateReview['damageDisclosure']>) => {
        const next = { ...damage, ...patch };
        if (!next.hasDamage) {
            next.damageTypes = [];
            next.damageNote = null;
        }
        onChange({ damageDisclosure: next });
    };
    const damageTypeLabels = damage.damageTypes.map((value) => (
        DAMAGE_TYPES.find((choice) => choice.value === value)?.label ?? value
    ));

    return (
        <View testID="card-location-sources" style={{ gap: 8, paddingBottom: 8 }}>
            <View style={{ gap: 6 }}>
                <FieldSummary label="Location" value={display.location || 'Not set'}
                    sourceCode={sourceCodes.location} local={localFields.location}
                    testSuffix="location" error={errorFields.has('shelfLocation')}
                    onPress={() => toggle('location')} disabled={disabled} />
                {open === 'location' ? (
                    <View testID="card-location-picker" style={panelStyle}>
                        <Button title="Use batch location" variant="secondary" onPress={() => {
                            onChange({ shelfLocation: defaults.location });
                            setOpen(null);
                        }} disabled={disabled} />
                        <TextInput accessibilityLabel="Custom location" testID="card-custom-location"
                            value={customLocation} maxLength={120} onChangeText={setCustomLocation}
                            editable={!disabled} style={inputStyle} />
                        <Button title="Use custom location" onPress={() => {
                            const shelfLocation = customLocation.trim();
                            if (!shelfLocation) return;
                            onChange({ shelfLocation });
                            setOpen(null);
                        }} disabled={disabled || customLocation.trim().length === 0} />
                    </View>
                ) : null}
            </View>

            <View style={{ gap: 6 }}>
                <FieldSummary label="Publication"
                    value={display.publication === 'publish' ? 'Prepare to publish' : 'Private'}
                    sourceCode={sourceCodes.publication} local={localFields.publication}
                    testSuffix="publication" error={errorFields.has('publicationIntent')}
                    onPress={() => toggle('publication')} disabled={disabled} />
                {open === 'publication' ? (
                    <View testID="card-publication-picker" style={panelStyle}>
                        {PUBLICATION_CHOICES.map((choice) => (
                            <Button key={choice.value}
                                title={`${display.publication === choice.value ? '✓ ' : ''}${choice.label}`}
                                accessibilityLabel={`${choice.label}${display.publication === choice.value ? ', selected' : ''}`}
                                variant="secondary" onPress={() => {
                                    onChange({ publicationIntent: choice.value });
                                    setOpen(null);
                                }} disabled={disabled} />
                        ))}
                        <Text selectable style={{ color: colors.textSecondary }}>
                            Adding always creates private inventory.
                        </Text>
                    </View>
                ) : null}
            </View>

            <View style={{ gap: 6 }}>
                <FieldSummary label="Language" value={display.language || 'Not set'}
                    sourceCode={sourceCodes.language} local={localFields.language}
                    testSuffix="language" error={errorFields.has('originalLanguage')}
                    onPress={() => toggle('language')} disabled={disabled} />
                {open === 'language' ? (
                    <View testID="card-language-picker" style={panelStyle}>
                        <TextInput accessibilityLabel="Search languages" testID="card-language-search"
                            value={languageSearch} maxLength={80} onChangeText={setLanguageSearch}
                            editable={!disabled} style={inputStyle} />
                        {visibleLanguages.map((choice) => (
                            <Button key={choice.value} title={choice.label} variant="secondary"
                                onPress={() => {
                                    onChange({ originalLanguage: choice.value });
                                    setOpen(null);
                                }} disabled={disabled} />
                        ))}
                        {visibleLanguages.length === 0 ? (
                            <Text selectable style={{ color: colors.textSecondary }}>No languages found.</Text>
                        ) : null}
                    </View>
                ) : null}
            </View>

            <View style={{ gap: 6 }}>
                <FieldSummary label="Damage" value={damage.hasDamage ? 'Has damage' : 'No damage'}
                    sourceCode={sourceCodes.damage} local={localFields.damage}
                    testSuffix="damage" error={errorFields.has('damageDisclosure')}
                    onPress={() => toggle('damage')} disabled={disabled} />
                {damage.hasDamage ? (
                    <View testID="card-damage-details" style={{ gap: 3 }}>
                        <Text selectable style={{ color: colors.textSecondary }}>
                            Types: {damageTypeLabels.join(', ') || 'Not set'}
                        </Text>
                        <Text selectable style={{ color: colors.textSecondary }}>
                            Note: {damage.damageNote || 'Not set'}
                        </Text>
                        <Text selectable style={{ color: colors.textSecondary }}>
                            Complete, readable, and safe: {damage.completeReadableSafe ? 'Yes' : 'No'}
                        </Text>
                        <Text selectable style={{ color: colors.textSecondary }}>
                            Sellable copy: {damage.isSellable ? 'Yes' : 'No'}
                        </Text>
                    </View>
                ) : null}
                {open === 'damage' ? (
                    <View testID="card-damage-picker" style={panelStyle}>
                        <Button title={`${!damage.hasDamage ? '✓ ' : ''}No damage`}
                            accessibilityLabel={`No damage${!damage.hasDamage ? ', selected' : ''}`}
                            variant="secondary" onPress={() => updateDamage({ hasDamage: false })}
                            disabled={disabled} />
                        <Button title={`${damage.hasDamage ? '✓ ' : ''}Has damage`}
                            accessibilityLabel={`Has damage${damage.hasDamage ? ', selected' : ''}`}
                            variant="secondary" onPress={() => updateDamage({ hasDamage: true })}
                            disabled={disabled} />
                        {damage.hasDamage ? DAMAGE_TYPES.map((choice) => {
                            const selected = damage.damageTypes.includes(choice.value);
                            return (
                                <Button key={choice.value} testID={`card-damage-type-${choice.value}`}
                                    title={`${selected ? '✓ ' : ''}${choice.label}`}
                                    accessibilityLabel={`${choice.label}${selected ? ', selected' : ''}`}
                                    variant="secondary" onPress={() => updateDamage({
                                        damageTypes: selected
                                            ? damage.damageTypes.filter((value) => value !== choice.value)
                                            : [...damage.damageTypes, choice.value],
                                    })} disabled={disabled} />
                            );
                        }) : null}
                        {damage.hasDamage ? (
                            <TextInput accessibilityLabel="Damage note" testID="card-damage-note"
                                value={damage.damageNote ?? ''} maxLength={1000}
                                onChangeText={(damageNote) => updateDamage({ damageNote })}
                                editable={!disabled} style={inputStyle} />
                        ) : null}
                        <Button
                            title={`Complete, readable, and safe: ${damage.completeReadableSafe ? 'Yes' : 'No'}`}
                            variant="secondary" onPress={() => updateDamage({
                                completeReadableSafe: !damage.completeReadableSafe,
                            })} disabled={disabled} />
                        <Button title={`Sellable copy: ${damage.isSellable ? 'Yes' : 'No'}`}
                            variant="secondary" onPress={() => updateDamage({
                                isSellable: !damage.isSellable,
                            })} disabled={disabled} />
                    </View>
                ) : null}
            </View>
        </View>
    );
}
