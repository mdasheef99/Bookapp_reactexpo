import { useState, useMemo } from 'react';
import { router } from 'expo-router';
import {
    View, Text, FlatList, TouchableOpacity,
    StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { profileService } from '@/features/auth/services/profileService';
import { useBrowseListings } from '@/features/exchange/hooks/useListings';
import { ListingCard } from '@/components/exchange/ListingCard';
import {
    DELIVERY_OPTION_META,
    ENABLED_DELIVERY_OPTIONS,
    getEnabledDeliveryOptions,
} from '@/features/exchange/config/exchangeConfig';
import type {
    ListingFilters, BookCondition, DeliveryOption, ListingWithBook,
} from '@/features/exchange/services/listingsService';

// ─── Filter options ──────────────────────────────────────────────────────────

const CONDITIONS: { value: BookCondition | null; label: string }[] = [
    { value: null, label: 'All' },
    { value: 'new', label: 'New' },
    { value: 'like_new', label: 'Like New' },
    { value: 'good', label: 'Good' },
    { value: 'acceptable', label: 'Okay' },
];

const DELIVERY_OPTIONS: { value: DeliveryOption; label: string }[] = ENABLED_DELIVERY_OPTIONS.map(value => ({
    value,
    label: DELIVERY_OPTION_META[value].filterLabel,
}));

// ─── Skeleton card for loading state ─────────────────────────────────────────

const SkeletonListingCard = ({ colors }: { colors: ReturnType<typeof useTheme>['colors'] }) => (
    <View style={[styles.skeletonCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={[styles.skeletonCover, { backgroundColor: colors.bgSecondary }]} />
        <View style={styles.skeletonInfo}>
            <View style={[styles.skeletonLine, { width: '80%', backgroundColor: colors.bgSecondary }]} />
            <View style={[styles.skeletonLine, { width: '55%', backgroundColor: colors.bgSecondary }]} />
            <View style={[styles.skeletonLine, { width: '40%', backgroundColor: colors.bgSecondary }]} />
            <View style={[styles.skeletonLineShort, { backgroundColor: colors.bgSecondary }]} />
        </View>
    </View>
);

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ExchangeScreen() {
    const { session } = useAuth();
    const { colors } = useTheme();

    // Filter state
    const [selectedCondition, setSelectedCondition] = useState<BookCondition | null>(null);
    const [selectedDelivery, setSelectedDelivery] = useState<DeliveryOption | null>(null);

    const filters = useMemo<ListingFilters>(() => ({
        condition: selectedCondition ?? undefined,
        deliveryOption: selectedDelivery ?? undefined,
    }), [selectedCondition, selectedDelivery]);

    // Fetch user profile for city
    const { data: profile, isLoading: profileLoading } = useQuery({
        queryKey: ['profile', session?.user?.id],
        queryFn: () => profileService.getProfile(session!.user.id),
        enabled: !!session?.user?.id,
        retry: 1,   // only retry once — dev bypass will always 401
    });

    // Browse listings (enabled once we know the city)
    const { data: listings, isLoading, isError, refetch, isRefetching } =
        useBrowseListings(profile?.city ?? null, filters);

    const requestableListings = useMemo(
        () => (listings ?? []).filter(listing => getEnabledDeliveryOptions(listing.delivery_options).length > 0),
        [listings]
    );

    const handleListingPress = (listing: ListingWithBook) => {
        router.push(`/(tabs)/exchange/${listing.id}`);
    };

    const handleCreateListing = () => {
        router.push('/(tabs)/exchange/create');
    };

    // ── Profile still loading (not errored) ──────────────────────────────────
    if (profileLoading) {
        return (
            <View style={styles.container}>
                <LinearGradient colors={['#EEF2FF', '#E0E7FF', '#C7D2FE']} style={styles.gradient}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.accent} />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#EEF2FF', '#E0E7FF', '#C7D2FE']} style={styles.gradient}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />

            {/* Decorative elements */}
            <View style={[styles.decor, styles.decor1]} />
            <View style={[styles.decor, styles.decor2]} />

            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>Exchange</Text>
                        {profile?.city && (
                            <Text style={[styles.cityLabel, { color: colors.textSecondary }]}>
                                📍 {profile.city}
                            </Text>
                        )}
                    </View>
                    <View style={styles.headerActions}>
                        <TouchableOpacity
                            onPress={() => router.push('/(tabs)/exchange/my-transactions')}
                            activeOpacity={0.8}
                            style={[styles.myExchangesBtn, { borderColor: colors.accent }]}
                        >
                            <Ionicons name="swap-horizontal-outline" size={18} color={colors.accent} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleCreateListing} activeOpacity={0.85}>
                            <LinearGradient colors={[colors.accent, colors.accentLight]}
                                style={styles.createButton} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                <Ionicons name="add" size={18} color="#FFF" />
                                <Text style={styles.createButtonText}>List Book</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Condition filter chips */}
                <FlatList horizontal showsHorizontalScrollIndicator={false}
                    data={CONDITIONS} keyExtractor={(i) => i.label}
                    renderItem={({ item }) => {
                        const active = item.value === selectedCondition;
                        return (
                            <TouchableOpacity onPress={() => setSelectedCondition(item.value)}
                                style={[styles.chip, { borderColor: colors.border },
                                    active && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                                <Text style={[styles.chipText, { color: colors.textSecondary },
                                    active && { color: '#FFF' }]}>{item.label}</Text>
                            </TouchableOpacity>
                        );
                    }}
                    contentContainerStyle={styles.chipRow}
                />

                {/* Delivery filter chips */}
                <FlatList horizontal showsHorizontalScrollIndicator={false}
                    data={DELIVERY_OPTIONS} keyExtractor={(i) => i.value}
                    renderItem={({ item }) => {
                        const active = item.value === selectedDelivery;
                        return (
                            <TouchableOpacity
                                onPress={() => setSelectedDelivery(active ? null : item.value)}
                                style={[styles.chip, { borderColor: colors.border },
                                    active && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                                <Text style={[styles.chipText, { color: colors.textSecondary },
                                    active && { color: '#FFF' }]}>{item.label}</Text>
                            </TouchableOpacity>
                        );
                    }}
                    contentContainerStyle={[styles.chipRow, { marginTop: 8, marginBottom: 16 }]}
                />

                {/* Listings */}
                {isLoading ? (
                    <View style={styles.skeletonList}>
                        {[1, 2, 3, 4].map((i) => (
                            <SkeletonListingCard key={i} colors={colors} />
                        ))}
                    </View>
                ) : (
                    <FlatList
                        data={requestableListings}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <ListingCard listing={item} colors={colors} onPress={handleListingPress} />
                        )}
                        refreshControl={
                            <RefreshControl refreshing={isRefetching} onRefresh={refetch}
                                tintColor={colors.accent} />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyEmoji}>📦</Text>
                                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                                    No listings yet
                                </Text>
                                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                    {profile?.city
                                        ? `No books available for exchange in ${profile.city} right now. Be the first to list one!`
                                        : 'Set your city in your profile to see books near you.'}
                                </Text>
                                <TouchableOpacity onPress={handleCreateListing} activeOpacity={0.85}>
                                    <LinearGradient colors={[colors.accent, colors.accentLight]}
                                        style={styles.emptyButton} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                        <Text style={styles.emptyButtonText}>List Your First Book</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        }
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                )}

                {/* Error banner */}
                {isError && (
                    <View style={styles.errorBanner}>
                        <Ionicons name="warning-outline" size={16} color="#DC2626" />
                        <Text style={styles.errorText}>Failed to load listings. Pull to retry.</Text>
                    </View>
                )}
            </View>
        </View>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1 },
    gradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    decor: {
        position: 'absolute', backgroundColor: 'rgba(99, 102, 241, 0.08)',
        borderRadius: 12, transform: [{ rotate: '-12deg' }],
    },
    decor1: { width: 120, height: 160, top: 80, left: -40, opacity: 0.5 },
    decor2: { width: 90, height: 130, bottom: 140, right: -25, opacity: 0.4 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { flex: 1, paddingHorizontal: 20, paddingTop: 60 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 20,
    },
    title: { fontSize: 32, fontWeight: '700', color: '#1A1A1A', letterSpacing: -0.5 },
    cityLabel: { fontSize: 14, fontWeight: '500', marginTop: 4 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    myExchangesBtn: {
        width: 40, height: 40, borderRadius: 20,
        borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
    },
    createButton: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 18, paddingVertical: 11, borderRadius: 24,
        shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    },
    createButtonText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
    chipRow: { paddingHorizontal: 2, gap: 8 },
    chip: {
        borderWidth: 1, borderRadius: 20,
        paddingHorizontal: 14, paddingVertical: 7,
    },
    chipText: { fontSize: 13, fontWeight: '600' },
    listContent: { paddingBottom: 100 },
    // Skeleton
    skeletonList: { marginTop: 4 },
    skeletonCard: {
        flexDirection: 'row', borderRadius: 16, padding: 12,
        marginBottom: 12, marginHorizontal: 4, borderWidth: 1,
    },
    skeletonCover: { width: 85, height: 125, borderRadius: 10 },
    skeletonInfo: { flex: 1, marginLeft: 12, justifyContent: 'center', gap: 10 },
    skeletonLine: { height: 14, borderRadius: 6 },
    skeletonLineShort: { height: 14, borderRadius: 6, width: '30%' },
    // Empty
    emptyContainer: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
    emptyEmoji: { fontSize: 56, marginBottom: 16 },
    emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
    emptyText: { fontSize: 15, fontWeight: '500', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
    emptyButton: {
        paddingHorizontal: 24, paddingVertical: 14, borderRadius: 24,
        shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
    },
    emptyButtonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
    // Error
    errorBanner: {
        position: 'absolute', bottom: 100, left: 20, right: 20,
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#FEF2F2', borderRadius: 12,
        padding: 14, borderWidth: 1, borderColor: '#FECACA',
    },
    errorText: { fontSize: 13, fontWeight: '600', color: '#DC2626' },
});

