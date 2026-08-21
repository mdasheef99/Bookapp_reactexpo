import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { StorefrontTitleGroup } from '../types';

const formatPrice = (minor: number) => `₹${(minor / 100).toFixed(0)}`;
const label = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export function StorefrontTitleGroupCard({ group, highlighted = false }: {
    group: StorefrontTitleGroup;
    highlighted?: boolean;
}) {
    const { colors } = useTheme();
    const title = group.safeTitlePresentation;
    return (
        <View accessibilityLabel={highlighted ? `Matched title: ${title.originalTitle}` : undefined}
            style={[styles.card, {
                borderColor: highlighted ? colors.accent : colors.border,
                backgroundColor: colors.bgCard,
            }]}>
            {highlighted
                ? <Text style={[styles.highlight, { color: colors.accent }]}>Matched title from your search</Text>
                : null}
            <View style={styles.titleRow}>
                <Image source={{ uri: title.cover }} style={styles.cover} contentFit="cover" />
                <View style={styles.titleText}>
                    <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>
                        {title.originalTitle}
                    </Text>
                    {title.authors.length
                        ? <Text style={[styles.meta, { color: colors.textSecondary }]}>{title.authors.join(', ')}</Text>
                        : null}
                    {title.publicIsbn
                        ? <Text style={[styles.meta, { color: colors.textTertiary }]}>ISBN {title.publicIsbn}</Text>
                        : null}
                </View>
            </View>
            <View style={styles.offers}>
                {group.offers.map((offer) => (
                    <Pressable key={offer.listingId} accessibilityRole="button"
                        accessibilityLabel={`View ${label(offer.condition)} copy for ${formatPrice(offer.priceMinor)}`}
                        onPress={() => router.push({
                            pathname: '/marketplace/book/[listingId]',
                            params: { listingId: offer.listingId },
                        })}
                        style={({ pressed }) => [styles.offer, { borderColor: colors.border }, pressed && styles.pressed]}>
                        <View style={styles.offerTop}>
                            <Text style={[styles.price, { color: colors.accent }]}>{formatPrice(offer.priceMinor)}</Text>
                            <Text style={[styles.condition, { color: colors.textPrimary }]}>{label(offer.condition)}</Text>
                        </View>
                        <Text style={[styles.meta, { color: colors.textSecondary }]}>
                            {offer.hasDamage ? 'Damage disclosed' : 'No damage disclosed'} · {label(offer.availabilityStatus)}
                        </Text>
                        <Text style={[styles.meta, { color: colors.textSecondary }]}>
                            {offer.fulfillmentOptions.map(label).join(' · ')}
                        </Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 12 },
    highlight: { fontSize: 12, fontWeight: '800' },
    titleRow: { flexDirection: 'row', gap: 12 },
    cover: { width: 58, height: 86, borderRadius: 6, backgroundColor: '#E7EBF0' },
    titleText: { flex: 1, gap: 3 },
    title: { fontSize: 17, fontWeight: '800' },
    meta: { fontSize: 12, lineHeight: 17 },
    offers: { gap: 8 },
    offer: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 4, minHeight: 48 },
    offerTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
    price: { fontSize: 15, fontWeight: '800' },
    condition: { fontSize: 13, fontWeight: '700' },
    pressed: { opacity: 0.82 },
});
