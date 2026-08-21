import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { BookstoreSearchResult } from '../types';

const formatPrice = (minor: number) => `₹${(minor / 100).toFixed(0)}`;
const label = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export function BookstoreResultCard({ result, searchQuery }: {
    result: BookstoreSearchResult;
    searchQuery: string;
}) {
    const { colors } = useTheme();
    const { store, matchedBook, offerSummary } = result;
    const location = [store.locality, store.city].filter(Boolean).join(', ');
    const damage = offerSummary.damageSummary.hasDamagedOffers
        ? offerSummary.damageSummary.hasUndamagedOffers
            ? 'Damaged and undamaged copies available'
            : 'Damage disclosed on available copies'
        : 'Undamaged copies available';

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${store.displayName}, matched ${matchedBook.originalTitle}`}
            accessibilityHint="Shows the complete catalogue and highlights this title"
            onPress={() => router.push({
                pathname: '/marketplace/store/[storeId]',
                params: { storeId: store.publicStoreId, matchContext: matchedBook.matchContext, searchQuery },
            })}
            style={({ pressed }) => [
                styles.card,
                { borderColor: colors.border, backgroundColor: colors.bgCard },
                pressed && styles.pressed,
            ]}
        >
            <View style={styles.storeRow}>
                <View style={styles.storeText}>
                    <Text style={[styles.storeName, { color: colors.textPrimary }]}>{store.displayName}</Text>
                    {location ? <Text style={[styles.meta, { color: colors.textSecondary }]}>{location}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.accent} />
            </View>
            <View style={styles.bookRow}>
                <Image source={{ uri: matchedBook.cover }} style={styles.cover} contentFit="cover" />
                <View style={styles.bookText}>
                    <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
                        {matchedBook.originalTitle}
                    </Text>
                    {matchedBook.authors.length ? (
                        <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                            {matchedBook.authors.join(', ')}
                        </Text>
                    ) : null}
                    <Text style={[styles.price, { color: colors.accent }]}>
                        From {formatPrice(offerSummary.lowestPriceMinor)} · {offerSummary.offerCount}{' '}
                        {offerSummary.offerCount === 1 ? 'offer' : 'offers'}
                    </Text>
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>
                        {label(offerSummary.conditionSummary.best)} to {label(offerSummary.conditionSummary.worst)}
                    </Text>
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>{damage}</Text>
                </View>
            </View>
            <View style={styles.badges}>
                {offerSummary.fulfillmentSummary.pickupOfferCount > 0
                    ? <Text style={[styles.badge, { color: colors.accent }]}>Pickup</Text> : null}
                {offerSummary.fulfillmentSummary.deliveryOfferCount > 0
                    ? <Text style={[styles.badge, { color: colors.accent }]}>Delivery</Text> : null}
                <Text style={[styles.badge, { color: colors.textSecondary }]}>
                    {label(offerSummary.availabilityBand)}
                </Text>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 12, minHeight: 48 },
    pressed: { opacity: 0.82 },
    storeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    storeText: { flex: 1, gap: 2 },
    storeName: { fontSize: 17, fontWeight: '800' },
    bookRow: { flexDirection: 'row', gap: 12 },
    cover: { width: 58, height: 86, borderRadius: 6, backgroundColor: '#E7EBF0' },
    bookText: { flex: 1, gap: 3 },
    title: { fontSize: 16, fontWeight: '700' },
    price: { fontSize: 14, fontWeight: '800' },
    meta: { fontSize: 12, lineHeight: 17 },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    badge: { fontSize: 12, fontWeight: '700' },
});
