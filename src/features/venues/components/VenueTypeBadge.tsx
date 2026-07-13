import { StyleSheet, Text, View } from 'react-native';

export function formatVenueType(value?: string | null) {
    if (!value) return 'Venue';
    return value
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

export function VenueTypeBadge({
    type,
    colors,
}: {
    type?: string | null;
    colors: { accent: string; accentLight: string };
}) {
    return (
        <View style={[styles.badge, { backgroundColor: colors.accentLight }]}>
            <Text style={[styles.badgeText, { color: colors.accent }]}>{formatVenueType(type)}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    badgeText: { fontSize: 12, fontWeight: '800' },
});
