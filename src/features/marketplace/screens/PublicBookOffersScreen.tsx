import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useTheme } from '@/hooks/useTheme';
import { AddToCartButton } from '../commerce/components/AddToCartButton';
import { MarketplaceDisclosure } from '../components/MarketplaceDisclosure';
import { usePublicListingDetail } from '../hooks/usePublicListingDetail';

const label = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatPrice = (minor: number) => `₹${(minor / 100).toFixed(0)}`;

export default function PublicBookOffersScreen({ listingId }: { listingId: string }) {
    const { colors } = useTheme();
    const { detail, isLoading, error, retry } = usePublicListingDetail(listingId);

    if (isLoading) {
        return <ScreenBackground><View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={{ color: colors.textSecondary }}>Checking current availability…</Text>
        </View></ScreenBackground>;
    }
    if (!detail) {
        return <ScreenBackground><View style={styles.errorPage}>
            <Text accessibilityRole="header" style={[styles.errorTitle, { color: colors.textPrimary }]}>Book unavailable</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
                {error ?? 'This listing is no longer public or available.'}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Retry book details"
                onPress={() => void retry()} style={styles.touchTarget}>
                <Text style={[styles.action, { color: colors.accent }]}>Retry</Text>
            </Pressable>
        </View></ScreenBackground>;
    }

    return (
        <ScreenBackground>
            <ScrollView contentContainerStyle={styles.container}>
                <Image source={{ uri: detail.cover }} style={styles.cover} contentFit="contain" />
                <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{detail.title}</Text>
                {detail.authors.length
                    ? <Text style={[styles.authors, { color: colors.textSecondary }]}>{detail.authors.join(', ')}</Text>
                    : null}
                <View style={styles.primaryRow}>
                    <Text style={[styles.price, { color: colors.accent }]}>{formatPrice(detail.priceMinor)}</Text>
                    <Text style={[styles.condition, { color: colors.textPrimary }]}>{label(detail.condition)}</Text>
                </View>
                <Text style={[styles.status, { color: colors.textSecondary }]}>
                    {label(detail.availabilityStatus)} · Store confirmation required before payment
                </Text>

                <Pressable accessibilityRole="button"
                    accessibilityLabel={`Open ${detail.store.displayName} complete catalogue`}
                    onPress={() => router.push({
                        pathname: '/marketplace/store/[storeId]',
                        params: { storeId: detail.store.publicStoreId },
                    })}
                    style={[styles.storeCard, { borderColor: colors.border }]}>
                    <Text style={[styles.storeName, { color: colors.textPrimary }]}>{detail.store.displayName}</Text>
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>
                        {[detail.store.locality, detail.store.city].filter(Boolean).join(', ')}
                    </Text>
                </Pressable>

                <View style={styles.section}>
                    <Text accessibilityRole="header" style={[styles.heading, { color: colors.textPrimary }]}>Copy details</Text>
                    <Text style={[styles.body, { color: colors.textSecondary }]}>
                        {detail.hasDamage ? 'Damage disclosed' : 'No damage disclosed'}
                    </Text>
                    {detail.publicDamageNote
                        ? <Text style={[styles.body, { color: colors.textSecondary }]}>{detail.publicDamageNote}</Text>
                        : null}
                    {detail.damageTypes.length
                        ? <Text style={[styles.meta, { color: colors.textSecondary }]}>Damage: {detail.damageTypes.map(label).join(', ')}</Text>
                        : null}
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>Fulfillment: {detail.fulfillmentOptions.map(label).join(', ')}</Text>
                </View>

                {detail.gallery.length ? <View style={styles.section}>
                    <Text accessibilityRole="header" style={[styles.heading, { color: colors.textPrimary }]}>Approved copy photos</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
                        {detail.gallery.map((item) => (
                            <View key={`${item.role}-${item.order}`} style={styles.galleryItem}>
                                <Image source={{ uri: item.url }} style={styles.galleryImage} contentFit="cover"
                                    accessibilityLabel={`${label(item.role)} photo ${item.order}`} />
                                <Text style={[styles.galleryLabel, { color: colors.textSecondary }]}>{label(item.role)}</Text>
                            </View>
                        ))}
                    </ScrollView>
                </View> : null}

                <View style={styles.section}>
                    <Text accessibilityRole="header" style={[styles.heading, { color: colors.textPrimary }]}>Edition information</Text>
                    {detail.description ? <Text style={[styles.body, { color: colors.textSecondary }]}>{detail.description}</Text> : null}
                    {detail.language ? <Text style={[styles.meta, { color: colors.textSecondary }]}>Language: {detail.language}</Text> : null}
                    {detail.editionStatement ? <Text style={[styles.meta, { color: colors.textSecondary }]}>Edition: {detail.editionStatement}</Text> : null}
                    {detail.format ? <Text style={[styles.meta, { color: colors.textSecondary }]}>Format: {detail.format}</Text> : null}
                    {detail.isbn13 || detail.isbn10
                        ? <Text style={[styles.meta, { color: colors.textSecondary }]}>ISBN: {detail.isbn13 ?? detail.isbn10}</Text>
                        : null}
                </View>
                <MarketplaceDisclosure />
                <AddToCartButton listingId={detail.listingId} title={detail.title} />
            </ScrollView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    errorPage: { padding: 24, gap: 10 },
    container: { padding: 24, paddingBottom: 48, gap: 12 },
    cover: { width: '100%', height: 240, borderRadius: 10, backgroundColor: '#E7EBF0' },
    title: { fontSize: 28, fontWeight: '800' },
    authors: { fontSize: 15, lineHeight: 21 },
    primaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    price: { fontSize: 22, fontWeight: '900' },
    condition: { fontSize: 14, fontWeight: '800' },
    status: { fontSize: 12, lineHeight: 18 },
    storeCard: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 3, minHeight: 48 },
    storeName: { fontSize: 16, fontWeight: '800' },
    section: { gap: 6, marginTop: 4 },
    heading: { fontSize: 18, fontWeight: '800' },
    body: { fontSize: 14, lineHeight: 21 },
    meta: { fontSize: 12, lineHeight: 18 },
    gallery: { gap: 10 },
    galleryItem: { gap: 4 },
    galleryImage: { width: 150, height: 180, borderRadius: 8, backgroundColor: '#E7EBF0' },
    galleryLabel: { fontSize: 11, fontWeight: '700' },
    touchTarget: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-start' },
    action: { fontSize: 13, fontWeight: '800' },
    errorTitle: { fontSize: 22, fontWeight: '800' },
});
