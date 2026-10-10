import { View, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';

interface SearchBarProps {
    query: string;
    onQueryChange: (query: string) => void;
    onSubmit: () => void;
    onClear: () => void;
    loading: boolean;
    autoFocus?: boolean;
    placeholder?: string;
    onFocus?: () => void;
    onBlur?: () => void;
    maxLength?: number;
    paletteOverride?: ThemeColors;
    compact?: boolean;
}

export const SearchBar = ({
    query,
    onQueryChange,
    onSubmit,
    onClear,
    loading,
    autoFocus = true,
    placeholder = "Search books, authors...",
    onFocus,
    onBlur,
    maxLength,
    paletteOverride,
    compact = false,
}: SearchBarProps) => {
    const { colors: themeColors } = useTheme();
    const colors = paletteOverride ?? themeColors;
    const handleClear = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onClear();
    };

    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.bgCard,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: compact ? 14 : 20,
                height: compact ? 54 : 60,
                paddingHorizontal: compact ? 14 : 20,
                marginBottom: compact ? 0 : 16,
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 5,
            }}
        >
            <Ionicons name="search" size={compact ? 20 : 24} color={colors.textSecondary} />
            <TextInput
                style={{
                    flex: 1,
                    marginLeft: compact ? 8 : 12,
                    fontSize: compact ? 14 : 17,
                    fontWeight: '500',
                    fontFamily: compact ? 'Inter_400Regular' : undefined,
                    color: colors.textPrimary,
                }}
                placeholder={placeholder}
                placeholderTextColor={colors.textTertiary}
                value={query}
                onChangeText={onQueryChange}
                onSubmitEditing={onSubmit}
                onFocus={onFocus}
                onBlur={onBlur}
                returnKeyType="search"
                autoFocus={autoFocus}
                maxLength={maxLength}
                accessibilityLabel="Search books"
                accessibilityHint="Enter a book title or author to search"
            />
            {query.length > 0 && !loading && (
                <TouchableOpacity
                    onPress={handleClear}
                    style={{
                        backgroundColor: colors.bgSecondary,
                        borderRadius: 12,
                        padding: 6,
                        minWidth: 44,
                        minHeight: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                    accessibilityHint="Clears the search input"
                >
                    <Ionicons name="close" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
            )}
            {loading && (
                <ActivityIndicator size="small" color={colors.accent} />
            )}
        </View>
    );
};
