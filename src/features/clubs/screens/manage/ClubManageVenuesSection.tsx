import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ClubVenueLink } from '@/features/clubs/services/clubsService';
import type { ThemeColors } from '@/hooks/useTheme';

export function ClubManageVenuesSection({
    venues,
    isLoading,
    isSaving,
    colors,
    onAddVenue,
    onRemoveVenue,
    onSetPrimaryVenue,
}: {
    venues: ClubVenueLink[];
    isLoading: boolean;
    isSaving: boolean;
    colors: ThemeColors;
    onAddVenue: () => void;
    onRemoveVenue: (venueId: string) => void;
    onSetPrimaryVenue: (venueId: string) => void;
}) {
    return (
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.headerRow}>
                <View style={styles.headerText}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Linked venues</Text>
                    <Text style={[styles.body, { color: colors.textSecondary }]}>Choose approved venues this club can use for in-person or hybrid events.</Text>
                </View>
                <TouchableOpacity onPress={onAddVenue} style={[styles.addButton, { borderColor: colors.accent }]} testID="manage-venues-add">
                    <Text style={[styles.addButtonText, { color: colors.accent }]}>Add</Text>
                </TouchableOpacity>
            </View>
            {isLoading ? <ActivityIndicator color={colors.accent} /> : null}
            {!isLoading && venues.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No venues are linked yet. Events can still use manual meetup locations.</Text>
            ) : null}
            {venues.map((venueLink) => {
                const venue = venueLink.venue;
                const venueId = venueLink.venue_id ?? venue?.id;
                if (!venue || !venueId) return null;
                return (
                    <View key={venueId} style={[styles.venueRow, { borderColor: colors.border }]}>
                        <View style={styles.venueBody}>
                            <Text style={[styles.venueName, { color: colors.textPrimary }]}>{venue.name}</Text>
                            <Text style={[styles.venueMeta, { color: colors.textSecondary }]}>{[venue.address_line1, venue.city].filter(Boolean).join(', ')}</Text>
                            {venueLink.is_primary ? <Text style={[styles.primaryText, { color: colors.accent }]}>Primary</Text> : null}
                        </View>
                        {!venueLink.is_primary ? (
                            <TouchableOpacity disabled={isSaving} onPress={() => onSetPrimaryVenue(venueId)} style={styles.textButton}>
                                <Text style={[styles.textButtonLabel, { color: colors.accent }]}>Primary</Text>
                            </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity disabled={isSaving} onPress={() => onRemoveVenue(venueId)} style={styles.textButton}>
                            <Text style={[styles.textButtonLabel, { color: colors.error }]}>Remove</Text>
                        </TouchableOpacity>
                    </View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14 },
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
    headerText: { flex: 1 },
    title: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
    body: { fontSize: 14, lineHeight: 20 },
    addButton: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
    addButtonText: { fontSize: 13, fontWeight: '800' },
    emptyText: { fontSize: 14, lineHeight: 20 },
    venueRow: { borderTopWidth: 1, paddingTop: 12, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
    venueBody: { flex: 1 },
    venueName: { fontSize: 15, fontWeight: '800', marginBottom: 3 },
    venueMeta: { fontSize: 13, lineHeight: 18 },
    primaryText: { fontSize: 12, fontWeight: '800', marginTop: 4 },
    textButton: { paddingHorizontal: 4, paddingVertical: 6 },
    textButtonLabel: { fontSize: 12, fontWeight: '800' },
});
