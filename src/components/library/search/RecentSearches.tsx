import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { useLibraryTypography } from '@/components/library/LibraryTypography';

interface RecentSearchItemProps {
    query: string;
    onPress: () => void;
    onRemove: () => void;
}

const RecentSearchItem = ({ query, onPress, onRemove }: RecentSearchItemProps) => {
    const colors = useLibraryAppearance();
    const fonts = useLibraryTypography();
    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.bgCard,
                paddingLeft: 12,
                marginRight: 10,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
            }}
        >
            <View style={{ marginLeft: 8 }}>
                <Ionicons name="time-outline" size={16} color={colors.textTertiary} />
            </View>
            <TouchableOpacity
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={`Search for ${query}`}
                style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}
            >
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: fonts.body }} numberOfLines={1}>{query}</Text>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={onRemove}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${query} from recent searches`}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
                <Ionicons name="close" size={15} color={colors.textTertiary} />
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
    const fonts = useLibraryTypography();
    if (searches.length === 0) return null;

    return (
        <View style={{ marginBottom: 16 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: fonts.label, marginBottom: 8 }}>
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
