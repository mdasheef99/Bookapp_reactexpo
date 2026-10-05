import { View, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { useLibraryTypography } from '@/components/library/LibraryTypography';

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
}

export const SearchBar = ({
    query,
    onQueryChange,
    onSubmit,
    onClear,
    loading,
    autoFocus = true,
    placeholder = 'Title, author, or ISBN',
    onFocus,
    onBlur,
}: SearchBarProps) => {
    const colors = useLibraryAppearance();
    const fonts = useLibraryTypography();
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
                borderRadius: 14,
                minHeight: 56,
                paddingHorizontal: 12,
                marginBottom: 12,
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 6,
                elevation: 2,
            }}
        >
            <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
            <TextInput
                style={{
                    flex: 1,
                    marginLeft: 10,
                    fontSize: 16,
                    fontFamily: fonts.body,
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
                accessibilityLabel="Search books"
                accessibilityHint="Enter a book title or author to search"
            />
            {query.length > 0 && !loading && (
                <TouchableOpacity
                    onPress={handleClear}
                    style={{
                        backgroundColor: colors.bgSecondary,
                        borderRadius: 22,
                        width: 44,
                        height: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                    accessibilityHint="Clears the search input"
                >
                    <Ionicons name="close" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
            )}
            {loading && (
                <ActivityIndicator size="small" color={colors.accent} />
            )}
        </View>
    );
};
