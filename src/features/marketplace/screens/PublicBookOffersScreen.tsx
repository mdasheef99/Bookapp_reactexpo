import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useTheme } from '@/hooks/useTheme';
import { MarketplaceDisclosure } from '../components/MarketplaceDisclosure';
import { StoreOfferCard } from '../components/StoreOfferCard';
import { usePublicBookOffers } from '../hooks/usePublicBookOffers';

export default function PublicBookOffersScreen({ listingId }: { listingId: string }) {
    const { colors } = useTheme();
    const { result, isLoading, error, retry } = usePublicBookOffers(listingId);

    if (isLoading) {
        return <ScreenBackground><View style={styles.centered}><ActivityIndicator color={colors.accent} /></View></ScreenBackground>;
    }
    if (error || !result) {
        return (
            <ScreenBackground>
                <View style={styles.container}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Book unavailable</Text>
                    <Text style={{ color: colors.textSecondary }}>{error ?? 'No public offers were found.'}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel="Retry book availability" onPress={() => void retry()}>
                        <Text style={[styles.retry, { color: colors.accent }]}>Retry</Text>
                    </Pressable>
                </View>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>{result.title}</Text>
                {result.authors?.length ? <Text style={{ color: colors.textSecondary }}>{result.authors.join(', ')}</Text> : null}
                <MarketplaceDisclosure />
                <Text style={[styles.heading, { color: colors.textPrimary }]}>Available from {result.offerCount} {result.offerCount === 1 ? 'store' : 'stores'}</Text>
                {result.offers.map((offer) => <StoreOfferCard key={offer.id} offer={offer} />)}
            </ScrollView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    container: { padding: 24, paddingBottom: 40, gap: 12 },
    title: { fontSize: 26, fontWeight: '800' },
    heading: { fontSize: 18, fontWeight: '700' },
    retry: { fontSize: 13, fontWeight: '700' },
});
