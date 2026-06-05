import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { type ListingWithBook, type BookCondition, type DeliveryOption } from '@/features/exchange/services/listingsService';
import { DELIVERY_OPTION_META, getEnabledDeliveryOptions } from '@/features/exchange/config/exchangeConfig';
import { type ThemeColors } from '@/hooks/useTheme';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const CONDITION_LABELS: Record<BookCondition, string> = {
    new: 'New',
    like_new: 'Like New',
    good: 'Good',
    acceptable: 'Okay',
    poor: 'Poor',
};

const CONDITION_COLORS: Record<BookCondition, string> = {
    new: '#10B981',
    like_new: '#34D399',
    good: '#6366F1',
    acceptable: '#F59E0B',
    poor: '#EF4444',
};

interface ListingCardProps {
    listing: ListingWithBook;
    colors: ThemeColors;
    onPress: (listing: ListingWithBook) => void;
}

export const ListingCard = ({ listing, colors, onPress }: ListingCardProps) => {
    const book = listing.book;
    const coverUrl = book?.cover_url || 'https://via.placeholder.com/100x150?text=No+Cover';
    const conditionColor = CONDITION_COLORS[listing.condition];
    const conditionLabel = CONDITION_LABELS[listing.condition];
    const enabledDeliveryOptions = getEnabledDeliveryOptions(listing.delivery_options);

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onPress(listing)}
            style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
        >
            {/* Book Cover */}
            <View style={styles.coverWrapper}>
                <Image
                    source={{ uri: coverUrl }}
                    style={styles.cover}
                    contentFit="cover"
                    transition={200}
                />
                {/* Condition badge overlay */}
                <View style={[styles.conditionBadge, { backgroundColor: conditionColor }]}>
                    <Text style={styles.conditionText}>{conditionLabel}</Text>
                </View>
            </View>

            {/* Info */}
            <View style={styles.info}>
                <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
                    {book?.title ?? 'Unknown Title'}
                </Text>
                <Text style={[styles.author, { color: colors.textSecondary }]} numberOfLines={1}>
                    {book?.authors?.join(', ') ?? 'Unknown Author'}
                </Text>

                {/* Rating */}
                {book?.average_rating != null && (
                    <View style={styles.ratingRow}>
                        <Ionicons name="star" size={13} color="#F59E0B" />
                        <Text style={[styles.ratingText, { color: colors.textTertiary }]}>
                            {book.average_rating.toFixed(1)}
                        </Text>
                    </View>
                )}

                {/* Delivery options */}
                <View style={styles.deliveryRow}>
                    {enabledDeliveryOptions.map((opt) => {
                        const d = DELIVERY_OPTION_META[opt];
                        return (
                            <View key={opt} style={[styles.deliveryChip, { borderColor: colors.border }]}>
                                <Ionicons name={d.icon as any} size={12} color={colors.textTertiary} />
                                <Text style={[styles.deliveryLabel, { color: colors.textTertiary }]}>
                                    {d.label}
                                </Text>
                            </View>
                        );
                    })}
                </View>

                {/* Listing photo count */}
                <View style={styles.photoRow}>
                    <Ionicons name="camera-outline" size={13} color={colors.textTertiary} />
                    <Text style={[styles.photoCount, { color: colors.textTertiary }]}>
                        {listing.photos.length} photos
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        borderRadius: 16,
        padding: 12,
        marginBottom: 12,
        marginHorizontal: 4,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    coverWrapper: { position: 'relative' },
    cover: { width: 85, height: 125, borderRadius: 10, backgroundColor: '#E2E8F0' },
    conditionBadge: {
        position: 'absolute', bottom: 4, left: 4, right: 4,
        borderRadius: 6, paddingVertical: 2, alignItems: 'center',
    },
    conditionText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
    info: { flex: 1, marginLeft: 12, justifyContent: 'center' },
    title: { fontSize: 16, fontWeight: '700', marginBottom: 4, letterSpacing: -0.2 },
    author: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
    ratingText: { fontSize: 12, fontWeight: '600' },
    deliveryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
    deliveryChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    },
    deliveryLabel: { fontSize: 11, fontWeight: '500' },
    photoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    photoCount: { fontSize: 11, fontWeight: '500' },
});

