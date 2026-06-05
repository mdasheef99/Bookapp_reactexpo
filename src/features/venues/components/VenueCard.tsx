import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Venue } from '../services/venuesService.types';
import { VenueTypeBadge } from './VenueTypeBadge';

type VenueCardColors = {
    bgCard: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    accent: string;
    accentLight: string;
};

export function VenueCard({
    venue,
    colors,
    onPress,
    rightLabel,
}: {
    venue: Partial<Venue> & { id: string; name: string };
    colors: VenueCardColors;
    onPress?: (venue: Partial<Venue> & { id: string; name: string }) => void;
    rightLabel?: string;
}) {
    const address = [venue.address_line1, venue.address_line2, venue.city].filter(Boolean).join(', ');
    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onPress?.(venue)}
            disabled={!onPress}
            style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
            testID={`venue-card-${venue.id}`}
        >
            <View style={styles.headerRow}>
                <View style={styles.titleBlock}>
                    <Text style={[styles.name, { color: colors.textPrimary }]}>{venue.name}</Text>
                    {address ? <Text style={[styles.address, { color: colors.textSecondary }]}>{address}</Text> : null}
                </View>
                {rightLabel ? <Text style={[styles.rightLabel, { color: colors.accent }]}>{rightLabel}</Text> : null}
            </View>
            <View style={styles.footerRow}>
                <VenueTypeBadge type={venue.venue_type} colors={colors} />
                {venue.booking_required ? (
                    <View style={styles.metaPill}>
                        <Ionicons name="calendar-outline" size={13} color={colors.textTertiary} />
                        <Text style={[styles.metaText, { color: colors.textTertiary }]}>Booking required</Text>
                    </View>
                ) : null}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
    headerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    titleBlock: { flex: 1 },
    name: { fontSize: 16, fontWeight: '800', marginBottom: 5 },
    address: { fontSize: 13, lineHeight: 18 },
    rightLabel: { fontSize: 12, fontWeight: '800', marginTop: 2 },
    footerRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    metaPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 12, fontWeight: '700' },
});
