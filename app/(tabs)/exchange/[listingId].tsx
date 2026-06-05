import React, { useState } from 'react';
import {
    View, Text, ScrollView, Image, TouchableOpacity,
    ActivityIndicator, Alert, StyleSheet, Dimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useListingDetails } from '@/features/exchange/hooks/useListings';
import { useRequestTransaction } from '@/features/exchange/hooks/useTransactions';
import {
    DELIVERY_OPTION_META,
    getDefaultRequestDeliveryOption,
    isDeliveryOptionEnabled,
} from '@/features/exchange/config/exchangeConfig';
import { VenueCard } from '@/features/venues/components/VenueCard';
import { useApprovedVenues } from '@/features/venues/hooks/useVenues';
import { navigateBackOrFallback } from '@/lib/navigation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CONDITION_LABELS: Record<string, string> = {
    new: '✨ New',
    like_new: '⭐ Like New',
    good: '👍 Good',
    acceptable: '👌 Okay',
    poor: '📦 Poor',
};

export default function ListingDetailScreen() {
    const { listingId } = useLocalSearchParams<{ listingId: string }>();
    const { colors } = useTheme();
    const { session } = useAuth();
    const currentUserId = session?.user?.id ?? null;

    const { data: listing, isLoading, isError } = useListingDetails(listingId ?? null);
    const { data: pickupVenues = [], isLoading: isPickupVenuesLoading, isError: isPickupVenuesError } = useApprovedVenues({
        city: listing?.city ?? undefined,
        isExchangePartner: true,
        limit: 20,
        offset: 0,
    });
    const requestMutation = useRequestTransaction();

    const [photoIndex, setPhotoIndex] = useState(0);
    const [selectedPickupVenueId, setSelectedPickupVenueId] = useState<string | null>(null);

    const isOwner = currentUserId === listing?.owner_id;
    const isActive = listing?.status === 'active';
    const selectedDelivery = getDefaultRequestDeliveryOption(listing?.delivery_options ?? []);
    const requestDeliveryAvailable = selectedDelivery !== null;
    const selectedPickupVenue = pickupVenues.find(venue => venue.id === selectedPickupVenueId) ?? null;
    const pickupVenueRequired = selectedDelivery === 'meetup';
    const pickupVenueReady = !pickupVenueRequired || Boolean(selectedPickupVenueId);
    const hasUnsupportedDeliveryOptions = (listing?.delivery_options ?? []).some(
        option => !isDeliveryOptionEnabled(option)
    );
    const canRequest = !isOwner && isActive && requestDeliveryAvailable && pickupVenueReady && !requestMutation.isPending;

    const handleRequest = () => {
        if (!currentUserId || !listing || !selectedDelivery) return;
        requestMutation.mutate(
            {
                listingId: listing.id,
                borrowerId: currentUserId,
                deliveryType: selectedDelivery,
                pickupVenueId: selectedPickupVenueId ?? undefined,
            },
            {
                onSuccess: (txn) => {
                    Alert.alert('📚 Request sent!', 'The owner has been notified.', [
                        {
                            text: 'View Request',
                            onPress: () => router.replace(`/(tabs)/exchange/transaction/${txn.id}`),
                        },
                    ]);
                },
                onError: (err: any) => {
                    Alert.alert('Request failed', err?.message ?? 'Please try again.');
                },
            }
        );
    };

    // ── Loading / Error ─────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <View style={[styles.center, { backgroundColor: colors.bgPrimary }]}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        );
    }

    if (isError || !listing) {
        return (
            <View style={[styles.center, { backgroundColor: colors.bgPrimary }]}>
                <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
                <Text style={[styles.errorText, { color: colors.textSecondary }]}>
                    Listing not found
                </Text>
                <TouchableOpacity onPress={() => navigateBackOrFallback(router, '/(tabs)/exchange')} style={[styles.backBtn, { backgroundColor: colors.accent }]}>
                    <Text style={styles.backBtnText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const book = listing.book;
    const owner = listing.owner;
    const photos = listing.photos ?? [];

    return (
        <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigateBackOrFallback(router, '/(tabs)/exchange')} style={styles.headerBack}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {book?.title ?? 'Listing'}
                </Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Photo Carousel */}
                <View style={styles.photoSection}>
                    {photos.length > 0 ? (
                        <>
                            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                                onMomentumScrollEnd={e => {
                                    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                                    setPhotoIndex(idx);
                                }}>
                                {photos.map((uri, i) => (
                                    <Image key={i} source={{ uri }} style={styles.photo} resizeMode="cover" />
                                ))}
                            </ScrollView>
                            {photos.length > 1 && (
                                <View style={styles.dots}>
                                    {photos.map((_, i) => (
                                        <View key={i} style={[styles.dot,
                                            { backgroundColor: i === photoIndex ? colors.accent : colors.border }]} />
                                    ))}
                                </View>
                            )}
                        </>
                    ) : (
                        <View style={[styles.photoPlaceholder, { backgroundColor: colors.bgCard }]}>
                            <Ionicons name="image-outline" size={48} color={colors.textTertiary} />
                        </View>
                    )}
                </View>

                {/* Book Info */}
                <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Text style={[styles.bookTitle, { color: colors.textPrimary }]}>{book?.title ?? 'Unknown Title'}</Text>
                    {book?.authors?.length ? (
                        <Text style={[styles.bookAuthors, { color: colors.textSecondary }]}>
                            {book.authors.join(', ')}
                        </Text>
                    ) : null}
                    {book?.average_rating != null && (
                        <Text style={[styles.rating, { color: colors.textTertiary }]}>⭐ {book.average_rating.toFixed(1)}</Text>
                    )}
                </View>

                {/* Owner Card */}
                {owner && (
                    <View style={[styles.card, styles.ownerCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                        {owner.avatar_url ? (
                            <Image source={{ uri: owner.avatar_url }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.bgSecondary }]}>
                                <Ionicons name="person" size={20} color={colors.textTertiary} />
                            </View>
                        )}
                        <View style={styles.ownerInfo}>
                            <Text style={[styles.ownerName, { color: colors.textPrimary }]}>{owner.display_name}</Text>
                            <Text style={[styles.ownerCity, { color: colors.textTertiary }]}>📍 {owner.city}</Text>
                        </View>
                        {owner.trust_score != null && (
                            <View style={[styles.trustBadge, { backgroundColor: colors.accentLight }]}>
                                <Text style={styles.trustScore}>⚡ {owner.trust_score}</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Condition */}
                <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Condition</Text>
                    <View style={[styles.conditionBadge, { backgroundColor: colors.accentLight }]}>
                        <Text style={[styles.conditionText, { color: colors.accent }]}>
                            {CONDITION_LABELS[listing.condition] ?? listing.condition}
                        </Text>
                    </View>
                    {listing.condition_notes ? (
                        <Text style={[styles.conditionNotes, { color: colors.textSecondary }]}>
                            {listing.condition_notes}
                        </Text>
                    ) : null}
                </View>

                {/* Delivery */}
                <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
                        {isOwner ? 'Delivery Option' : 'Exchange Method'}
                    </Text>
                    {selectedDelivery ? (
                        <View style={styles.chipRow}>
                            <View
                                testID="exchange-meetup-chip"
                                style={[styles.chip, { borderColor: colors.accent, backgroundColor: colors.accent }]}
                            >
                                <Text style={[styles.chipText, { color: '#FFF' }]}>
                                    {DELIVERY_OPTION_META[selectedDelivery].filterLabel}
                                </Text>
                            </View>
                        </View>
                    ) : (
                        <Text style={[styles.hint, { color: colors.textSecondary }]}>
                            Meetup isn&apos;t available for this listing yet, so it can&apos;t be requested in-app right now.
                        </Text>
                    )}
                    <Text style={[styles.hint, { color: colors.textTertiary }]}> 
                        BookTalks Exchange currently supports same-city meetup handoffs only.
                    </Text>
                    {hasUnsupportedDeliveryOptions && (
                        <Text style={[styles.hint, { color: colors.textTertiary }]}> 
                            Porter and delivery-based flows will return once they are fully supported end to end.
                        </Text>
                    )}
                </View>

                {requestDeliveryAvailable && selectedDelivery === 'meetup' ? (
                    <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                        <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Pickup venue</Text>
                        <Text style={[styles.hint, { color: colors.textTertiary }]}>
                            Choose an approved pickup partner for this same-city meetup.
                        </Text>
                        {isPickupVenuesLoading ? (
                            <ActivityIndicator color={colors.accent} style={styles.venueLoader} />
                        ) : isPickupVenuesError ? (
                            <Text style={[styles.hint, { color: colors.textSecondary }]}>
                                Pickup venues could not be loaded. Please try again later.
                            </Text>
                        ) : pickupVenues.length === 0 ? (
                            <Text style={[styles.hint, { color: colors.textSecondary }]}>
                                No exchange pickup venues are available in this listing city yet.
                            </Text>
                        ) : (
                            <View style={styles.venueList}>
                                {pickupVenues.map(venue => (
                                    <VenueCard
                                        key={venue.id}
                                        venue={venue}
                                        colors={colors}
                                        rightLabel={selectedPickupVenueId === venue.id ? 'Selected' : 'Choose'}
                                        onPress={() => setSelectedPickupVenueId(venue.id)}
                                    />
                                ))}
                            </View>
                        )}
                        {selectedPickupVenue ? (
                            <Text style={[styles.hint, { color: colors.textSecondary }]}>
                                Selected: {selectedPickupVenue.name}
                            </Text>
                        ) : (
                            <Text style={[styles.hint, { color: colors.textSecondary }]}>
                                Select a pickup venue before requesting this exchange.
                            </Text>
                        )}
                    </View>
                ) : null}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* CTA */}
            <View style={[styles.cta, { backgroundColor: colors.bgCard, borderTopColor: colors.border }]}>
                {isOwner ? (
                    <View style={[styles.ctaBtn, { backgroundColor: colors.border }]}>
                        <Text style={[styles.ctaBtnText, { color: colors.textTertiary }]}>This is your listing</Text>
                    </View>
                ) : !isActive ? (
                    <View style={[styles.ctaBtn, { backgroundColor: colors.border }]}>
                        <Text style={[styles.ctaBtnText, { color: colors.textTertiary }]}>No longer available</Text>
                    </View>
                ) : (
                    <TouchableOpacity testID="exchange-request-cta" onPress={handleRequest} disabled={!canRequest}
                        style={[styles.ctaBtn, { backgroundColor: canRequest ? colors.accent : colors.border }]}>
                        {requestMutation.isPending ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={[styles.ctaBtnText, { color: canRequest ? '#FFF' : colors.textTertiary }]}>
                                {canRequest
                                    ? '📚 Request Meetup Exchange'
                                    : requestDeliveryAvailable
                                        ? 'Meetup exchange only'
                                        : 'Meetup not available'}
                            </Text>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 1 },
    headerBack: { padding: 4, marginRight: 12 },
    headerTitle: { flex: 1, fontSize: 17, fontWeight: '600' },
    scrollContent: { paddingBottom: 24 },
    photoSection: { position: 'relative' },
    photo: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.75 },
    photoPlaceholder: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.75, alignItems: 'center', justifyContent: 'center' },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 },
    dot: { width: 7, height: 7, borderRadius: 3.5 },
    card: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 12, borderWidth: 1 },
    bookTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
    bookAuthors: { fontSize: 14, marginBottom: 4 },
    rating: { fontSize: 13 },
    ownerCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 44, height: 44, borderRadius: 22 },
    avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    ownerInfo: { flex: 1 },
    ownerName: { fontSize: 15, fontWeight: '600' },
    ownerCity: { fontSize: 13, marginTop: 2 },
    trustBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    trustScore: { fontSize: 13, fontWeight: '600', color: '#4F46E5' },
    sectionLabel: { fontSize: 15, fontWeight: '600', marginBottom: 10 },
    conditionBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, marginBottom: 8 },
    conditionText: { fontSize: 14, fontWeight: '600' },
    conditionNotes: { fontSize: 13, lineHeight: 18 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
    chipText: { fontSize: 14, fontWeight: '500' },
    hint: { fontSize: 12, marginTop: 8 },
    venueLoader: { alignSelf: 'flex-start', marginTop: 12 },
    venueList: { marginTop: 12 },
    cta: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 32, borderTopWidth: 1 },
    ctaBtn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
    ctaBtnText: { fontSize: 16, fontWeight: '700' },
    errorText: { fontSize: 16, marginTop: 8 },
    backBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
    backBtnText: { color: '#FFF', fontWeight: '600' },
    bgSecondary: {},
});
