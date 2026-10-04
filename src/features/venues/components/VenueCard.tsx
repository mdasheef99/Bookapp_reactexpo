import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Venue } from '../services/venuesService.types';
import { formatVenueType, VenueTypeBadge } from './VenueTypeBadge';

type VenueCardColors = {
    bgCard: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    accent: string;
    accentLight: string;
};

type VenueCardVariant = 'default' | 'editorial';

export function VenueCard({
    venue,
    colors,
    onPress,
    rightLabel,
    variant = 'default',
}: {
    venue: Partial<Venue> & { id: string; name: string };
    colors: VenueCardColors;
    onPress?: (venue: Partial<Venue> & { id: string; name: string }) => void;
    rightLabel?: string;
    variant?: VenueCardVariant;
}) {
    const address = [venue.address_line1, venue.address_line2, venue.city].filter(Boolean).join(', ');
    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onPress?.(venue)}
            disabled={!onPress}
            accessibilityRole="button"
            accessibilityLabel={variant === 'editorial' ? [venue.name, address, formatVenueType(venue.venue_type), venue.booking_required ? 'Booking required' : null].filter(Boolean).join(', ') : undefined}
            accessibilityHint={onPress && variant === 'editorial' ? 'Opens venue details' : undefined}
            style={[styles.card, variant === 'editorial' && styles.editorialCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
            testID={`venue-card-${venue.id}`}
        >
            <View style={styles.headerRow}>
                <View style={styles.titleBlock}>
                    <Text style={[styles.name, variant === 'editorial' && styles.editorialName, { color: colors.textPrimary }]}>{venue.name}</Text>
                    {address ? <Text style={[styles.address, variant === 'editorial' && styles.editorialAddress, { color: colors.textSecondary }]}>{address}</Text> : null}
                </View>
                {rightLabel ? <Text style={[styles.rightLabel, { color: colors.accent }]}>{rightLabel}</Text> : null}
            </View>
            <View style={[styles.footerRow, variant === 'editorial' && styles.editorialFooterRow]}>
                <VenueTypeBadge type={venue.venue_type} colors={colors} variant={variant} />
                {venue.booking_required ? (
                    <View style={styles.metaPill}>
                        <Ionicons name="calendar-outline" size={13} color={colors.textTertiary} />
                        <Text style={[styles.metaText, variant === 'editorial' && styles.editorialMetaText, { color: variant === 'editorial' ? colors.textSecondary : colors.textTertiary }]}>Booking required</Text>
                    </View>
                ) : null}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
    editorialCard: { padding: 12, paddingTop: 13, marginBottom: 9, shadowColor: '#402B25', shadowOpacity: 0.025, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
    headerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    titleBlock: { flex: 1 },
    name: { fontSize: 16, fontWeight: '800', marginBottom: 5 },
    editorialName: { fontFamily: 'Newsreader_500Medium', fontSize: 19, lineHeight: 23, fontWeight: '500', letterSpacing: -0.2, marginBottom: 0 },
    address: { fontSize: 13, lineHeight: 18 },
    editorialAddress: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 5 },
    rightLabel: { fontSize: 12, fontWeight: '800', marginTop: 2 },
    footerRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    editorialFooterRow: { gap: 7, marginTop: 9 },
    metaPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 12, fontWeight: '700' },
    editorialMetaText: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18, fontWeight: '500' },
});
