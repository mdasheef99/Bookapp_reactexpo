import { useMemo, useState, type ReactNode } from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
    type ViewStyle,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export function SetupSection({
    title,
    eyebrow,
    children,
}: Readonly<{ title: string; eyebrow?: string; children: ReactNode }>) {
    const { colors } = useTheme();
    return (
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.sectionHeading}>
                {eyebrow ? <Text selectable style={[styles.eyebrow, { color: colors.accent }]}>{eyebrow}</Text> : null}
                <Text selectable accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
            </View>
            {children}
        </View>
    );
}

export function SetupChoiceChip({
    label,
    selected,
    onPress,
    testID,
    style,
}: Readonly<{
    label: string;
    selected: boolean;
    onPress: () => void;
    testID?: string;
    style?: ViewStyle;
}>) {
    const { colors } = useTheme();
    return (
        <Pressable
            testID={testID}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={onPress}
            style={({ pressed }) => [
                styles.chip,
                {
                    backgroundColor: selected ? colors.bgSecondary : colors.bgCard,
                    borderColor: selected ? colors.accent : colors.border,
                    opacity: pressed ? 0.72 : 1,
                },
                style,
            ]}
        >
            <Text selectable style={[styles.chipLabel, { color: selected ? colors.accent : colors.textPrimary }]}>{label}</Text>
        </Pressable>
    );
}

export function SetupFieldLabel({ label, optional = false }: Readonly<{ label: string; optional?: boolean }>) {
    const { colors } = useTheme();
    return (
        <View style={styles.fieldLabelRow}>
            <Text selectable style={[styles.fieldLabel, { color: colors.textPrimary }]}>{label}</Text>
            {optional ? <Text selectable style={[styles.optional, { color: colors.textTertiary }]}>Optional</Text> : null}
        </View>
    );
}

export function SetupPicker<T extends string | null>({
    label,
    value,
    options,
    onSelect,
    testID,
    searchable = false,
    compact = false,
}: Readonly<{
    label: string;
    value: T;
    options: ReadonlyArray<Readonly<{ value: T; label: string }>>;
    onSelect: (value: T) => void;
    testID: string;
    searchable?: boolean;
    compact?: boolean;
}>) {
    const { colors } = useTheme();
    const [expanded, setExpanded] = useState(false);
    const [search, setSearch] = useState('');
    const selectedLabel = options.find((option) => option.value === value)?.label ?? label;
    const filtered = useMemo(() => {
        const needle = search.trim().toLocaleLowerCase();
        if (!needle) return options;
        return options.filter((option) => option.label.toLocaleLowerCase().includes(needle));
    }, [options, search]);

    return (
        <View style={[styles.picker, compact && styles.compactPicker]}>
            <Pressable
                testID={`${testID}-selector`}
                accessibilityRole="button"
                accessibilityLabel={`${label}, ${selectedLabel}`}
                accessibilityState={{ expanded }}
                onPress={() => setExpanded((current) => !current)}
                style={({ pressed }) => [
                    styles.selector,
                    compact && styles.compactSelector,
                    {
                        backgroundColor: colors.bgSecondary,
                        borderColor: expanded ? colors.accent : colors.border,
                        opacity: pressed ? 0.75 : 1,
                    },
                ]}
            >
                <Text selectable numberOfLines={1} style={[styles.selectorValue, { color: colors.textPrimary }]}>{selectedLabel}</Text>
                <Text selectable accessibilityElementsHidden style={[styles.chevron, { color: colors.accent }]}>{expanded ? '−' : '+'}</Text>
            </Pressable>
            {expanded ? (
                <View style={[styles.pickerOptions, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                    {searchable ? (
                        <TextInput
                            testID={`${testID}-search`}
                            accessibilityLabel={`Search ${label}`}
                            value={search}
                            onChangeText={setSearch}
                            placeholder={`Search ${label.toLocaleLowerCase()}`}
                            placeholderTextColor={colors.textTertiary}
                            style={[styles.searchInput, { borderColor: colors.border, color: colors.textPrimary }]}
                        />
                    ) : null}
                    <View style={styles.optionRow}>
                        {filtered.map((option) => (
                            <SetupChoiceChip
                                key={`${testID}-${option.value ?? 'unset'}`}
                                label={option.label}
                                selected={option.value === value}
                                onPress={() => {
                                    onSelect(option.value);
                                    setSearch('');
                                    setExpanded(false);
                                }}
                                testID={`${testID}-${option.value ?? 'unset'}`}
                            />
                        ))}
                    </View>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    section: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 14 },
    sectionHeading: { gap: 3 },
    eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 0.9 },
    sectionTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.2 },
    fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    fieldLabel: { fontSize: 14, fontWeight: '700' },
    optional: { fontSize: 12, fontWeight: '600' },
    chip: { minHeight: 40, justifyContent: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 8 },
    chipLabel: { fontSize: 13, fontWeight: '700' },
    picker: { gap: 8 },
    compactPicker: { flex: 1 },
    selector: { minHeight: 52, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    compactSelector: { minHeight: 46 },
    selectorValue: { flex: 1, fontSize: 15, fontWeight: '700' },
    chevron: { fontSize: 20, fontWeight: '500' },
    pickerOptions: { borderWidth: 1, borderRadius: 13, padding: 10, gap: 10 },
    searchInput: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
    optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
