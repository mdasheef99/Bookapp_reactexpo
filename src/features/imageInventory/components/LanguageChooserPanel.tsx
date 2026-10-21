import { Text, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import { LANGUAGE_OPTIONS } from '../scanSetup/scanSetupForm';

// SDD-1 §6 (4a): shared panel only; each caller owns the value row and open/search state.
export function LanguageChooserPanel({ search, onSearchChange, onSelect, disabled }: {
    search: string; onSearchChange: (value: string) => void;
    onSelect: (language: string) => void; disabled: boolean;
}) {
    const { colors } = useTheme();
    const panelStyle = { gap: 8, padding: 10, borderRadius: 10, borderWidth: 1,
        borderColor: colors.border, backgroundColor: colors.bgSecondary } as const;
    const inputStyle = { color: colors.textPrimary, borderWidth: 1, borderColor: colors.accent,
        borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, minHeight: 44,
        backgroundColor: colors.bgCard } as const;
    const normalizedLanguageSearch = search.trim().toLocaleLowerCase();
    const visibleLanguages = LANGUAGE_OPTIONS.filter((choice) => (
        !normalizedLanguageSearch
        || choice.label.toLocaleLowerCase().includes(normalizedLanguageSearch)
        || choice.value.toLocaleLowerCase().includes(normalizedLanguageSearch)
    ));
    return (
        <View testID="card-language-picker" style={panelStyle}>
            <TextInput accessibilityLabel="Search languages" testID="card-language-search"
                value={search} maxLength={80} onChangeText={onSearchChange}
                editable={!disabled} style={inputStyle} />
            {visibleLanguages.map((choice) => (
                <Button key={choice.value} title={choice.label} variant="secondary"
                    onPress={() => onSelect(choice.value)} disabled={disabled} />
            ))}
            {visibleLanguages.length === 0 ? (
                <Text selectable style={{ color: colors.textSecondary }}>No languages found.</Text>
            ) : null}
        </View>
    );
}
