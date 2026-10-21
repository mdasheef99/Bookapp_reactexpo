import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import { ICON_SIZE } from '@/components/library/bookDetails/bookDetailsTokens';
interface RecentSearchItemProps {
    query: string;
    onPress: () => void;
    onRemove: () => void;
}
const RecentSearchItem = ({ query, onPress, onRemove }: RecentSearchItemProps) => {
    const colors = useLibraryAppearance();
    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingLeft: LIBRARY_SPACING.sm,
                marginRight: LIBRARY_SPACING.sm,
                borderRadius: LIBRARY_RADIUS.control,
            }}
        >
            <View style={{ marginLeft: LIBRARY_SPACING.xs }}>
                <Ionicons name="time-outline" size={ICON_SIZE} color={colors.textTertiary} />
            </View>
            <TouchableOpacity
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={`Search for ${query}`}
                style={{ minWidth: MIN_TARGET, minHeight: MIN_TARGET, justifyContent: 'center', paddingHorizontal: LIBRARY_SPACING.xs }}
            >
                <Text style={{ color: colors.textSecondary, ...LIBRARY_TEXT.body }} numberOfLines={1}>{query}</Text>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={onRemove}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${query} from recent searches`}
                style={{ minWidth: MIN_TARGET, minHeight: MIN_TARGET, alignItems: 'center', justifyContent: 'center' }}
            >
                <Ionicons name="close" size={ICON_SIZE} color={colors.textTertiary} />
            </TouchableOpacity>
        </View>
    );
};
interface RecentSearchesProps {
    searches: string[];
    onSearch: (query: string) => void;
    onRemove: (query: string) => void;
}
export const RecentSearches = ({ searches, onSearch, onRemove }: RecentSearchesProps) => {
    const colors = useLibraryAppearance();
    if (searches.length === 0) return null;
    return (
        <View style={{ marginBottom: LIBRARY_SPACING.md }}>
            <Text style={{ color: colors.textSecondary, ...LIBRARY_TEXT.caption, marginBottom: LIBRARY_SPACING.xs }}>
                Recent Searches
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {searches.map((search, i) => (
                    <RecentSearchItem
                        key={i}
                        query={search}
                        onPress={() => onSearch(search)}
                        onRemove={() => onRemove(search)}
                    />
                ))}
            </ScrollView>
        </View>
    );
};
