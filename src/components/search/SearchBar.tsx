import { View, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ThemeColors } from '@/hooks/useTheme';

interface SearchBarProps {
    query: string;
    onQueryChange: (query: string) => void;
    onSubmit: () => void;
    onClear: () => void;
    loading: boolean;
    colors: ThemeColors;
    autoFocus?: boolean;
    placeholder?: string;
}

export const SearchBar = ({
    query,
    onQueryChange,
    onSubmit,
    onClear,
    loading,
    colors,
    autoFocus = true,
    placeholder = "Search books, authors...",
}: SearchBarProps) => {
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
                borderRadius: 20,
                height: 60,
                paddingHorizontal: 20,
                marginBottom: 16,
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 5,
            }}
        >
            <Ionicons name="search" size={24} color={colors.textSecondary} />
            <TextInput
                style={{
                    flex: 1,
                    marginLeft: 12,
                    fontSize: 17,
                    fontWeight: '500',
                    color: colors.textPrimary,
                }}
                placeholder={placeholder}
                placeholderTextColor={colors.textTertiary}
                value={query}
                onChangeText={onQueryChange}
                onSubmitEditing={onSubmit}
                returnKeyType="search"
                autoFocus={autoFocus}
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
                    }}
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
