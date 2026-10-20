import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { useLibraryTypography } from '@/components/library/LibraryTypography';

interface SearchSuggestionsProps {
    suggestions: string[];
    recentSearches: string[];
    onSelect: (query: string) => void;
    visible: boolean;
}

export const SearchSuggestions = ({
    suggestions,
    recentSearches,
    onSelect,
    visible,
}: SearchSuggestionsProps) => {
    const colors = useLibraryAppearance();
    const fonts = useLibraryTypography();
    if (!visible) return null;

    const hasContent = suggestions.length > 0 || recentSearches.length > 0;
    if (!hasContent) return null;

    return (
        <View
            style={{
                position: 'absolute',
                top: 70,
                left: 0,
                right: 0,
                zIndex: 100,
                backgroundColor: colors.bgCard,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 12,
                elevation: 8,
                maxHeight: 300,
            }}
        >
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                {/* Recent searches - Always show top 3 if available */}
                {recentSearches.length > 0 && (
                    <View style={{ paddingTop: 8, paddingBottom: 4 }}>
                        <Text style={{
                            color: colors.textTertiary,
                            fontSize: 11,
                            fontFamily: fonts.label,
                            paddingHorizontal: 16,
                            paddingBottom: 4,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                        }}>
                            Recent
                        </Text>
                        {recentSearches.slice(0, 3).map((search, i) => (
                            <TouchableOpacity
                                key={`recent-${i}`}
                                onPress={() => onSelect(search)}
                                accessibilityRole="button"
                                accessibilityLabel={`Search for ${search}`}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    minHeight: 44,
                                    paddingVertical: 8,
                                    paddingHorizontal: 16,
                                }}
                            >
                                <Ionicons name="time-outline" size={16} color={colors.textTertiary} />
                                <Text
                                    style={{
                                        color: colors.textPrimary,
                                        fontSize: 15,
                                        fontFamily: fonts.body,
                                        marginLeft: 12,
                                        flex: 1,
                                    }}
                                    numberOfLines={1}
                                >
                                    {search}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Suggestions from API */}
                {suggestions.length > 0 && (
                    <View style={{ paddingTop: recentSearches.length > 0 ? 4 : 8, paddingBottom: 8 }}>
                        {recentSearches.length > 0 && (
                            <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 16, marginBottom: 8 }} />
                        )}
                        <Text style={{
                            color: colors.textTertiary,
                            fontSize: 11,
                            fontFamily: fonts.label,
                            paddingHorizontal: 16,
                            paddingBottom: 4,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                        }}>
                            Suggestions
                        </Text>
                        {suggestions.map((suggestion, i) => (
                            <TouchableOpacity
                                key={`sug-${i}`}
                                onPress={() => onSelect(suggestion)}
                                accessibilityRole="button"
                                accessibilityLabel={`Search for ${suggestion}`}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    minHeight: 44,
                                    paddingVertical: 8,
                                    paddingHorizontal: 16,
                                }}
                            >
                                <Ionicons name="search" size={16} color={colors.textTertiary} />
                                <Text
                                    style={{
                                        color: colors.textPrimary,
                                        fontSize: 15,
                                        fontFamily: fonts.body,
                                        marginLeft: 12,
                                        flex: 1,
                                    }}
                                    numberOfLines={1}
                                >
                                    {suggestion}
                                </Text>
                                <Ionicons name="arrow-up-outline" size={14} color={colors.textTertiary} style={{ transform: [{ rotate: '45deg' }] }} />
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </ScrollView>
        </View>
    );
};
