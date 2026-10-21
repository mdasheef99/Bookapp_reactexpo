import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import { ICON_SIZE } from '@/components/library/bookDetails/bookDetailsTokens';
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
    if (!visible) return null;
    const hasContent = suggestions.length > 0 || recentSearches.length > 0;
    if (!hasContent) return null;
    return (
        <View
            style={{
                position: 'absolute',
                top: MIN_TARGET + LIBRARY_SPACING.md,
                left: 0,
                right: 0,
                zIndex: 100,
                backgroundColor: colors.bgCard,
                borderRadius: LIBRARY_RADIUS.control,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: LIBRARY_SPACING.sm,
                elevation: 8,
                maxHeight: MIN_TARGET * 6,
            }}
        >
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                {/* Recent searches - Always show top 3 if available */}
                {recentSearches.length > 0 && (
                    <View style={{ paddingTop: LIBRARY_SPACING.xs, paddingBottom: LIBRARY_SPACING.xxs }}>
                        <Text style={{
                            color: colors.textTertiary,
                            ...LIBRARY_TEXT.caption,
                            paddingHorizontal: LIBRARY_SPACING.md,
                            paddingBottom: LIBRARY_SPACING.xxs,
                            textTransform: 'uppercase',
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
                                    minHeight: MIN_TARGET,
                                    paddingVertical: LIBRARY_SPACING.xs,
                                    paddingHorizontal: LIBRARY_SPACING.md,
                                }}
                            >
                                <Ionicons name="time-outline" size={ICON_SIZE} color={colors.textTertiary} />
                                <Text
                                    style={{
                                        color: colors.textPrimary,
                                        ...LIBRARY_TEXT.body,
                                        marginLeft: LIBRARY_SPACING.sm,
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
                    <View style={{ paddingTop: recentSearches.length > 0 ? LIBRARY_SPACING.xxs : LIBRARY_SPACING.xs, paddingBottom: LIBRARY_SPACING.xs }}>
                        {recentSearches.length > 0 && (
                            <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: LIBRARY_SPACING.md, marginBottom: LIBRARY_SPACING.xs }} />
                        )}
                        <Text style={{
                            color: colors.textTertiary,
                            ...LIBRARY_TEXT.caption,
                            paddingHorizontal: LIBRARY_SPACING.md,
                            paddingBottom: LIBRARY_SPACING.xxs,
                            textTransform: 'uppercase',
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
                                    minHeight: MIN_TARGET,
                                    paddingVertical: LIBRARY_SPACING.xs,
                                    paddingHorizontal: LIBRARY_SPACING.md,
                                }}
                            >
                                <Ionicons name="search" size={ICON_SIZE} color={colors.textTertiary} />
                                <Text
                                    style={{
                                        color: colors.textPrimary,
                                        ...LIBRARY_TEXT.body,
                                        marginLeft: LIBRARY_SPACING.sm,
                                        flex: 1,
                                    }}
                                    numberOfLines={1}
                                >
                                    {suggestion}
                                </Text>
                                <Ionicons name="arrow-up-outline" size={ICON_SIZE} color={colors.textTertiary} style={{ transform: [{ rotate: '45deg' }] }} />
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </ScrollView>
        </View>
    );
};
