import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { navigateBackOrFallback } from '@/lib/navigation';
import { useApprovedVenues } from '../hooks/useVenues';
import { VenueCard } from '../components/VenueCard';

const colors = {
    bgPrimary: '#F7F3EB',
    bgCard: '#FFFDFA',
    textPrimary: '#302522',
    textSecondary: '#716763',
    textTertiary: '#978C86',
    accent: '#793E46',
    accentLight: '#F3E7E7',
    border: '#E8DFD5',
} as const;

const VENUE_TYPE_FILTERS: Array<{ label: string; value?: string }> = [
    { label: 'All places' },
    { label: 'Libraries', value: 'library' },
    { label: 'Bookstores', value: 'bookstore' },
    { label: 'Cafes', value: 'cafe' },
    { label: 'Coworking', value: 'coworking' },
    { label: 'Other', value: 'other' },
];

export default function VenuesBrowseScreen() {
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
                accessibilityRole="button"
                accessibilityLabel={`Show ${label.toLowerCase()} venues`}
                accessibilityState={{ selected }}
                style={[styles.filterChip, { backgroundColor: selected ? colors.accent : colors.bgCard, borderColor: selected ? colors.accent : colors.border }]}
                testID={`venues-filter-type-${value ?? 'all'}`}
            >
                <Text style={[styles.filterText, { color: selected ? colors.bgCard : colors.textPrimary }]}>{label}</Text>
            </TouchableOpacity>
        );
    };

    if (isLoading && venues.length === 0) {
        return (
            <View accessibilityLiveRegion="polite" style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}>
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
                        <View style={styles.backRow}>
                            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to Clubs" onPress={() => navigateBackOrFallback(router, '/(tabs)/clubs')} style={styles.backButton} testID="back-button">
                                <View style={[styles.backIcon, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                                    <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
                                </View>
                                <Text style={[styles.backLabel, { color: colors.textSecondary }]}>Back to Clubs</Text>
                            </TouchableOpacity>
                        </View>
                        <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>Club venues</Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Find libraries, bookstores, cafes, and community spaces where book clubs can gather.</Text>
                        <View style={[styles.searchShell, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                            <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
                            <TextInput
                                accessibilityLabel="Search by venue, city, or address"
                                value={search}
                                onChangeText={setSearch}
                                placeholder="Search by venue, city, or address"
                                placeholderTextColor={colors.textSecondary}
                                style={[styles.searchInput, { color: colors.textPrimary }]}
                                returnKeyType="search"
                                testID="venues-search-input"
                            />
                        </View>
                        <ScrollView horizontal accessibilityLabel="Filter venues by type" showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
                            {VENUE_TYPE_FILTERS.map(renderFilter)}
                        </ScrollView>
                        {isError ? (
                            <View accessibilityRole="alert" style={[styles.feedbackCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
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
                        variant="editorial"
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
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 13 },
    loadingText: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 20 },
    content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 15, paddingBottom: 112 },
    header: { marginBottom: 12 },
    backRow: { marginBottom: 6 },
    backButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 9, paddingRight: 10 },
    backIcon: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    backLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 18 },
    title: { fontFamily: 'Newsreader_500Medium', fontSize: 32, lineHeight: 35, letterSpacing: -0.7 },
    subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 17 },
    searchShell: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderWidth: 1,
        borderRadius: 15,
        paddingHorizontal: 14,
        minHeight: 48,
        marginBottom: 13,
        shadowColor: '#402B25',
        shadowOpacity: 0.025,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
    },
    searchInput: { flex: 1, minHeight: 46, paddingVertical: 0, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
    filterScroll: { marginHorizontal: -18 },
    filterRow: { gap: 7, paddingHorizontal: 18, paddingBottom: 4 },
    filterChip: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12 },
    filterText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 18 },
    feedbackCard: { borderWidth: 1, borderRadius: 17, padding: 17, marginTop: 0, marginBottom: 14, shadowColor: '#402B25', shadowOpacity: 0.025, shadowRadius: 12, shadowOffset: { width: 0, height: 3 } },
    feedbackTitle: { fontFamily: 'Newsreader_500Medium', fontSize: 20, lineHeight: 24, marginBottom: 6 },
    feedbackBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 },
});
