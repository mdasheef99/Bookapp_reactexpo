import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

interface RecentSearchItemProps {
    query: string;
    onPress: () => void;
    onRemove: () => void;
}

const RecentSearchItem = ({ query, onPress, onRemove }: RecentSearchItemProps) => {
    const { colors } = useTheme();
    return (
        <TouchableOpacity
            onPress={onPress}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.bgCard,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 14,
                marginRight: 10,
                borderWidth: 1,
                borderColor: colors.border,
            }}
        >
            <Ionicons name="time-outline" size={16} color={colors.textTertiary} />
            <Text style={{ color: colors.textSecondary, fontSize: 14, marginLeft: 8, fontWeight: '500' }}>{query}</Text>
            <TouchableOpacity onPress={onRemove} style={{ marginLeft: 8, padding: 2 }}>
                <Ionicons name="close" size={14} color={colors.textTertiary} />
            </TouchableOpacity>
        </TouchableOpacity>
    );
};

interface RecentSearchesProps {
    searches: string[];
    onSearch: (query: string) => void;
    onRemove: (query: string) => void;
}

export const RecentSearches = ({ searches, onSearch, onRemove }: RecentSearchesProps) => {
    const { colors } = useTheme();
    if (searches.length === 0) return null;

    return (
        <View style={{ marginBottom: 16 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 10 }}>
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
