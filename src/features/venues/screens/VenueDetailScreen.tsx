import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { navigateBackOrFallback } from '@/lib/navigation';
import { withClubOrigin } from '@/features/clubs/navigation';
import { useVenueDetail } from '../hooks/useVenues';
import { VenueTypeBadge } from '../components/VenueTypeBadge';

const colors = {
    bgPrimary: '#FAF6EE',
    bgCard: '#FFFEFC',
    bgSecondary: '#F4EEE6',
    textPrimary: '#1A1412',
    textSecondary: '#6E645F',
    accent: '#8B322C',
    accentLight: '#F3E7E7',
    border: '#E7DCD1',
} as const;

function formatAddress(venue: {
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
}) {
    return [
        venue.address_line1,
        venue.address_line2,
        venue.city,
        [venue.state, venue.pincode].filter(Boolean).join(' '),
    ].filter(Boolean).join(', ');
}

export default function VenueDetailScreen() {
    const { venueId, clubOrigin } = useLocalSearchParams<{ venueId: string; clubOrigin?: string }>();
    const venuesHref = withClubOrigin('/(tabs)/clubs/venues', clubOrigin);
    const { data: venue, isLoading, isError } = useVenueDetail(venueId ?? null);

    if (isLoading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        );
    }

    if (isError || !venue) {
        return (
            <View style={[styles.stateContainer, { backgroundColor: colors.bgPrimary, paddingHorizontal: 24 }]}>
                <Text accessibilityRole="header" style={[styles.errorTitle, { color: colors.textPrimary }]}>Unable to load venue</Text>
                <Text style={[styles.errorBody, { color: colors.textSecondary }]}>Try returning to club venues and opening this place again.</Text>
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Back to venues"
                    onPress={() => router.replace(venuesHref)}
                    style={[styles.errorButton, { backgroundColor: colors.accent }]}
                    testID="venue-error-back-button"
                >
                    <Text style={styles.errorButtonText}>Back to venues</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Back to venues"
                    onPress={() => navigateBackOrFallback(router, venuesHref)}
                    style={styles.backButton}
                    testID="venue-back-button"
                >
                    <Ionicons name="chevron-back" size={19} color={colors.textSecondary} />
                    <Text style={[styles.backLabel, { color: colors.textSecondary }]}>Club venues</Text>
                </TouchableOpacity>
                <Text accessibilityRole="header" style={[styles.headerTitle, { color: colors.textPrimary }]}>Venue</Text>
            </View>

            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <VenueTypeBadge type={venue.venue_type} colors={colors} variant="editorial" />
                <Text style={[styles.title, { color: colors.textPrimary }]}>{venue.name}</Text>
                {venue.description ? <Text style={[styles.description, { color: colors.textSecondary }]}>{venue.description}</Text> : null}
                <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>{formatAddress(venue)}</Text>
                </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textPrimary }]}>Venue details</Text>
                {venue.max_capacity ? <Text style={[styles.detailLine, { color: colors.textSecondary }]}>Up to {venue.max_capacity} people</Text> : null}
                <Text style={[styles.detailLine, { color: colors.textSecondary }]}>{venue.booking_required ? 'Booking required' : 'Drop-in friendly'}</Text>
                {venue.amenities?.length ? (
                    <View style={styles.amenityRow}>
                        {venue.amenities.map((amenity) => (
                            <View key={amenity} style={[styles.amenityPill, { backgroundColor: colors.bgSecondary }]}>
                                <Text style={[styles.amenityText, { color: colors.textPrimary }]}>{amenity}</Text>
                            </View>
                        ))}
                    </View>
                ) : null}
            </View>

            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textPrimary }]}>Clubs and events</Text>
                <Text style={[styles.description, { color: colors.textSecondary }]}>Club and event relationships will appear here after public venue relationship queries are verified.</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 112 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bgPrimary },
    stateContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { marginBottom: 14 },
    backButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingRight: 12 },
    backLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 19 },
    headerTitle: { fontFamily: 'Newsreader_500Medium', fontSize: 32, lineHeight: 36, letterSpacing: -0.5, marginTop: 2 },
    card: {
        borderWidth: 1,
        borderRadius: 17,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#402B25',
        shadowOpacity: 0.025,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 1,
    },
    title: { fontFamily: 'Newsreader_600SemiBold', fontSize: 25, lineHeight: 31, marginTop: 11, marginBottom: 6 },
    description: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12 },
    infoText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
    sectionTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 21, lineHeight: 27, marginBottom: 9 },
    detailLine: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginBottom: 5 },
    amenityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 7 },
    amenityPill: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 6 },
    amenityText: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17, color: colors.textPrimary },
    errorTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 25, lineHeight: 31, marginBottom: 8, textAlign: 'center' },
    errorBody: { fontFamily: 'Inter_400Regular', fontSize: 14, textAlign: 'center', lineHeight: 21, maxWidth: 320 },
    errorButton: { minHeight: 48, minWidth: 164, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 20, paddingHorizontal: 18 },
    errorButtonText: { color: '#FFFEFC', fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 },
});
