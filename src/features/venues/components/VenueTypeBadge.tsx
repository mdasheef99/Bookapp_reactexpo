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
    variant = 'default',
}: {
    type?: string | null;
    colors: { accent: string; accentLight: string };
    variant?: 'default' | 'editorial';
}) {
    return (
        <View style={[styles.badge, variant === 'editorial' && styles.editorialBadge, { backgroundColor: colors.accentLight }]}>
            <Text style={[styles.badgeText, variant === 'editorial' && styles.editorialBadgeText, { color: colors.accent }]}>{formatVenueType(type)}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    editorialBadge: { minHeight: 24, justifyContent: 'center', paddingHorizontal: 9, paddingVertical: 2 },
    badgeText: { fontSize: 12, fontWeight: '800' },
    editorialBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 16, fontWeight: '600' },
});
