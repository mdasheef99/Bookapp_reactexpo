import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useApprovedVenues } from '../hooks/useVenues';
import { VenueCard } from '../components/VenueCard';

const VENUE_TYPE_FILTERS: Array<{ label: string; value?: string }> = [
    { label: 'All places' },
    { label: 'Libraries', value: 'library' },
    { label: 'Bookstores', value: 'bookstore' },
    { label: 'Cafes', value: 'cafe' },
    { label: 'Coworking', value: 'coworking' },
    { label: 'Other', value: 'other' },
];

export default function VenuesBrowseScreen() {
    const { colors } = useTheme();
    const [search, setSearch] = useState('');
    const [selectedType, setSelectedType] = useState<string | undefined>(undefined);
    const filters = useMemo(() => ({
        search: search.trim() || undefined,
        venueType: selectedType,
        limit: 20,
        offset: 0,
    }), [search, selectedType]);
    const { data: venues = [], isLoading, isError, refetch, isRefetching } = useApprovedVenues(filters);

    const renderFilter = ({ label, value }: { label: string; value?: string }) => {
        const selected = selectedType === value || (!selectedType && !value);
        return (
            <TouchableOpacity
                key={label}
                onPress={() => setSelectedType(value)}
                style={[styles.filterChip, { backgroundColor: selected ? colors.accent : colors.bgCard, borderColor: selected ? colors.accent : colors.border }]}
                testID={`venues-filter-type-${value ?? 'all'}`}
            >
                <Text style={[styles.filterText, { color: selected ? '#FFFFFF' : colors.textPrimary }]}>{label}</Text>
            </TouchableOpacity>
        );
    };

    if (isLoading && venues.length === 0) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Finding club venues...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
            <FlatList
                data={venues}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}
                ListHeaderComponent={
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>Club venues</Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Find libraries, bookstores, cafes, and community spaces where book clubs can gather.</Text>
                        <View style={[styles.searchShell, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                            <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
                            <TextInput
                                value={search}
                                onChangeText={setSearch}
                                placeholder="Search by venue, city, or address"
                                placeholderTextColor={colors.textTertiary}
                                style={[styles.searchInput, { color: colors.textPrimary }]}
                                testID="venues-search-input"
                            />
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                            {VENUE_TYPE_FILTERS.map(renderFilter)}
                        </ScrollView>
                        {isError ? (
                            <View style={[styles.feedbackCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                                <Text style={[styles.feedbackTitle, { color: colors.textPrimary }]}>Could not load venues</Text>
                                <Text style={[styles.feedbackBody, { color: colors.textSecondary }]}>Try refreshing to fetch approved club venues again.</Text>
                            </View>
                        ) : null}
                    </View>
                }
                renderItem={({ item }) => (
                    <VenueCard
                        venue={item}
                        colors={colors}
                        onPress={(venue) => router.push(`/(tabs)/clubs/venues/${venue.id}`)}
                    />
                )}
                ListEmptyComponent={
                    isError ? null : (
                        <View style={[styles.feedbackCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                            <Text style={[styles.feedbackTitle, { color: colors.textPrimary }]}>No venues matched this search</Text>
                            <Text style={[styles.feedbackBody, { color: colors.textSecondary }]}>Try another venue type, city, or search term.</Text>
                        </View>
                    )
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontSize: 14, fontWeight: '500' },
    content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 120 },
    header: { marginBottom: 12 },
    title: { fontSize: 30, fontWeight: '800', marginBottom: 8 },
    subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
    searchShell: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 14,
    },
    searchInput: { flex: 1, fontSize: 15 },
    filterRow: { gap: 10, paddingBottom: 8 },
    filterChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
    filterText: { fontSize: 13, fontWeight: '700' },
    feedbackCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 4, marginBottom: 14 },
    feedbackTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
    feedbackBody: { fontSize: 14, lineHeight: 20 },
});
