import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { navigateBackOrFallback } from '@/lib/navigation';
import { useTheme } from '@/hooks/useTheme';
import { useVenueDetail } from '../hooks/useVenues';
import { VenueTypeBadge } from '../components/VenueTypeBadge';

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
    const { venueId } = useLocalSearchParams<{ venueId: string }>();
    const { colors } = useTheme();
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
            <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary, paddingHorizontal: 24 }]}>
                <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>Unable to load venue</Text>
                <Text style={[styles.errorBody, { color: colors.textSecondary }]}>Try returning to club venues and opening this place again.</Text>
            </View>
        );
    }

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]} contentContainerStyle={styles.content}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => navigateBackOrFallback(router, '/clubs/venues')} style={[styles.iconButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>Venue</Text>
                <View style={styles.headerSpacer} />
            </View>

            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <VenueTypeBadge type={venue.venue_type} colors={colors} />
                <Text style={[styles.title, { color: colors.textPrimary }]}>{venue.name}</Text>
                {venue.description ? <Text style={[styles.description, { color: colors.textSecondary }]}>{venue.description}</Text> : null}
                <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={16} color={colors.textTertiary} />
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>{formatAddress(venue)}</Text>
                </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Venue details</Text>
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
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Clubs and events</Text>
                <Text style={[styles.description, { color: colors.textSecondary }]}>Club and event relationships will appear here after public venue relationship queries are verified.</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 48 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    iconButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { flex: 1, marginHorizontal: 12, fontSize: 18, fontWeight: '800', textAlign: 'center' },
    headerSpacer: { width: 40 },
    card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14 },
    title: { fontSize: 28, fontWeight: '800', marginTop: 14, marginBottom: 8 },
    description: { fontSize: 14, lineHeight: 21 },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14 },
    infoText: { flex: 1, fontSize: 14, lineHeight: 20 },
    sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
    detailLine: { fontSize: 14, lineHeight: 20, marginBottom: 6 },
    amenityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    amenityPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
    amenityText: { fontSize: 12, fontWeight: '700' },
    errorTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
    errorBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
