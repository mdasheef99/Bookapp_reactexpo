import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useTheme } from '@/hooks/useTheme';
import { useStorefrontCatalogue } from '../hooks/useStorefrontCatalogue';
import { MarketplaceDisclosure } from '../components/MarketplaceDisclosure';
import { StorefrontTitleGroupCard } from '../components/StorefrontTitleGroupCard';

const returnPolicyLabel: Record<string, string> = {
    no_returns: 'No returns',
    no_returns_except_wrong_item: 'Returns only for a wrong item',
    returns_within_3_days: 'Returns within 3 days',
    returns_within_7_days: 'Returns within 7 days',
};

export default function PublicStoreScreen({
    storeId,
    matchContext = null,
    searchQuery = null,
}: {
    storeId: string;
    matchContext?: string | null;
    searchQuery?: string | null;
}) {
    const { colors } = useTheme();
    const catalogue = useStorefrontCatalogue(storeId, matchContext);
    const { profile } = catalogue;

    if (catalogue.isLoading && !profile) {
        return <ScreenBackground><View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={{ color: colors.textSecondary }}>Loading bookstore catalogue…</Text>
        </View></ScreenBackground>;
    }
    if (!profile) {
        return <ScreenBackground><View style={styles.errorPage}>
            <Text accessibilityRole="header" style={[styles.errorTitle, { color: colors.textPrimary }]}>Store unavailable</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
                {catalogue.error ?? 'This bookstore is not currently public.'}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Retry bookstore catalogue"
                onPress={() => void catalogue.retry()} style={styles.touchTarget}>
                <Text style={[styles.action, { color: colors.accent }]}>Retry</Text>
            </Pressable>
        </View></ScreenBackground>;
    }

    const location = [profile.locality, profile.city, profile.state].filter(Boolean).join(', ');
    return (
        <ScreenBackground>
            <ScrollView
                contentContainerStyle={styles.container}
                refreshControl={<RefreshControl
                    refreshing={catalogue.isLoading && profile !== null}
                    onRefresh={() => void catalogue.refresh()}
                    tintColor={colors.accent}
                />}
            >
                {profile.cover ? <Image source={{ uri: profile.cover }} style={styles.hero} contentFit="cover" /> : null}
                {profile.logo ? <Image source={{ uri: profile.logo }} style={styles.logo} contentFit="cover" /> : null}
                <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>Bookstore</Text>
                <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{profile.displayName}</Text>
                {profile.description ? <Text style={[styles.body, { color: colors.textSecondary }]}>{profile.description}</Text> : null}
                {location ? <View style={styles.inline}>
                    <Ionicons name="location-outline" size={16} color={colors.accent} />
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>{location}</Text>
                </View> : null}
                <View style={styles.badges}>
                    {profile.pickup ? <Text style={[styles.badge, { color: colors.accent }]}>Pickup</Text> : null}
                    {profile.delivery ? <Text style={[styles.badge, { color: colors.accent }]}>Delivery</Text> : null}
                    <Text style={[styles.badge, { color: colors.textSecondary }]}>
                        {returnPolicyLabel[profile.returnPolicy] ?? 'Store return policy applies'}
                    </Text>
                </View>
                <MarketplaceDisclosure />

                {catalogue.hasSearchContext ? <View style={[styles.searchContext, { borderColor: colors.border }]}>
                    <View style={styles.searchText}>
                        <Text style={[styles.searchTitle, { color: colors.textPrimary }]}>Search context</Text>
                        <Text style={[styles.meta, { color: colors.textSecondary }]}>
                            {catalogue.matchContextState === 'unavailable'
                                ? 'The searched title is no longer available. The complete catalogue is shown.'
                                : `Matched title highlighted${searchQuery ? ` for “${searchQuery}”` : ''}.`}
                        </Text>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel="Clear Search and browse all books"
                        onPress={() => void catalogue.clearSearch()} style={styles.touchTarget}>
                        <Text style={[styles.action, { color: colors.accent }]}>Clear Search</Text>
                    </Pressable>
                </View> : null}

                <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    Complete catalogue ({catalogue.titleCount} {catalogue.titleCount === 1 ? 'title' : 'titles'})
                </Text>
                {catalogue.highlightedTitleGroup
                    ? <StorefrontTitleGroupCard group={catalogue.highlightedTitleGroup} highlighted />
                    : null}
                {catalogue.titleGroups.length === 0 && !catalogue.highlightedTitleGroup ? (
                    <Text style={[styles.body, { color: colors.textSecondary }]}>No books are currently available.</Text>
                ) : catalogue.titleGroups.map((group) => (
                    <StorefrontTitleGroupCard key={group.offers[0].listingId} group={group} />
                ))}

                {catalogue.error && profile ? <View style={styles.inlineError} accessibilityLiveRegion="polite">
                    <Text style={[styles.meta, { color: colors.error }]}>{catalogue.error}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel="Retry catalogue request"
                        onPress={() => void catalogue.retry()} style={styles.touchTarget}>
                        <Text style={[styles.action, { color: colors.accent }]}>Retry</Text>
                    </Pressable>
                </View> : null}
                {catalogue.nextCursor ? <Pressable accessibilityRole="button" accessibilityLabel="Load more books"
                    disabled={catalogue.isLoadingMore} onPress={() => void catalogue.loadMore()}
                    style={[styles.loadMore, { borderColor: colors.border }]}>
                    {catalogue.isLoadingMore ? <ActivityIndicator color={colors.accent} />
                        : <Text style={[styles.action, { color: colors.accent }]}>Load more books</Text>}
                </Pressable> : null}
            </ScrollView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    errorPage: { padding: 24, gap: 10 },
    container: { padding: 24, paddingBottom: 48, gap: 12 },
    hero: { height: 130, borderRadius: 10, backgroundColor: '#E7EBF0' },
    logo: { width: 68, height: 68, marginTop: -48, marginLeft: 12, borderRadius: 10, backgroundColor: '#FFFFFF' },
    eyebrow: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
    title: { fontSize: 28, fontWeight: '800' },
    body: { fontSize: 14, lineHeight: 21 },
    meta: { fontSize: 12, lineHeight: 18 },
    inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    badge: { fontSize: 12, fontWeight: '700' },
    searchContext: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' },
    searchText: { flex: 1, gap: 2 },
    searchTitle: { fontSize: 13, fontWeight: '800' },
    touchTarget: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
    action: { fontSize: 13, fontWeight: '800' },
    sectionTitle: { fontSize: 19, fontWeight: '800', marginTop: 8 },
    inlineError: { gap: 4, alignItems: 'flex-start' },
    loadMore: { minHeight: 48, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    errorTitle: { fontSize: 21, fontWeight: '800' },
});
