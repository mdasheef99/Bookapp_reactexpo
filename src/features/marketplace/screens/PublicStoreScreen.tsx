import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useTheme } from '@/hooks/useTheme';
import { usePublicStoreProfile } from '../hooks/usePublicStoreProfile';
import { StoreOfferCard } from '../components/StoreOfferCard';
import { MarketplaceDisclosure } from '../components/MarketplaceDisclosure';

interface PublicStoreScreenProps {
    storeId: string;
}

function formatDayLabel(day: string): string {
    return day.charAt(0).toUpperCase() + day.slice(1);
}

function formatOperatingHours(hours: Record<string, unknown>): string[] {
    return Object.entries(hours)
        .map(([day, value]) => {
            if (!value || typeof value !== 'object') {
                return null;
            }

            const entry = value as Record<string, unknown>;
            if (entry.closed === true) {
                return `${formatDayLabel(day)}: Closed`;
            }

            if (typeof entry.open === 'string' && typeof entry.close === 'string') {
                return `${formatDayLabel(day)}: ${entry.open}-${entry.close}`;
            }

            return null;
        })
        .filter((row): row is string => Boolean(row));
}

export default function PublicStoreScreen({ storeId }: PublicStoreScreenProps) {
    const { colors } = useTheme();
    const { profile, listings, isLoading, error } = usePublicStoreProfile(storeId);
    const displayListings = useMemo(
        () =>
            listings.map((offer) => ({
                ...offer,
                storeDisplayName: profile?.displayName ?? offer.storeDisplayName,
            })),
        [listings, profile?.displayName],
    );
    const operatingHours = useMemo(
        () => (profile?.operatingHours ? formatOperatingHours(profile.operatingHours) : []),
        [profile?.operatingHours],
    );

    if (isLoading) {
        return (
            <ScreenBackground>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.accent} />
                </View>
            </ScreenBackground>
        );
    }

    if (error || !profile) {
        return (
            <ScreenBackground>
                <View style={styles.container}>
                    <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>
                        Store unavailable
                    </Text>
                    <Text style={[styles.errorBody, { color: colors.textSecondary }]}>
                        {error ?? 'This bookstore profile could not be loaded.'}
                    </Text>
                </View>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <ScrollView contentContainerStyle={styles.container}>
                {profile.coverUrl ? (
                    <Image source={{ uri: profile.coverUrl }} style={styles.cover} contentFit="cover" />
                ) : null}
                {profile.logoUrl ? (
                    <Image source={{ uri: profile.logoUrl }} style={styles.logo} contentFit="cover" />
                ) : null}

                <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>
                    Bookstore
                </Text>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                    {profile.displayName}
                </Text>

                {profile.description ? (
                    <Text style={[styles.description, { color: colors.textSecondary }]}>
                        {profile.description}
                    </Text>
                ) : null}

                <View style={styles.locationRow}>
                    {profile.city ? (
                        <View style={styles.locationBadge}>
                            <Ionicons name="location-outline" size={12} color={colors.accent} />
                            <Text style={[styles.locationText, { color: colors.accent }]}>
                                {profile.localityName ? `${profile.localityName}, ` : ''}
                                {profile.city}
                                {profile.state ? `, ${profile.state}` : ''}
                            </Text>
                        </View>
                    ) : null}
                </View>

                <View style={styles.fulfillmentRow}>
                    {profile.pickupEnabled ? (
                        <View style={styles.fulfillmentBadge}>
                            <Ionicons name="storefront" size={12} color={colors.accent} />
                            <Text style={[styles.fulfillmentText, { color: colors.accent }]}>Pickup</Text>
                        </View>
                    ) : null}
                    {profile.deliveryEnabled ? (
                        <View style={styles.fulfillmentBadge}>
                            <Ionicons name="bicycle" size={12} color={colors.accent} />
                            <Text style={[styles.fulfillmentText, { color: colors.accent }]}>Delivery</Text>
                        </View>
                    ) : null}
                </View>

                {operatingHours.length > 0 ? (
                    <View style={styles.hoursBlock}>
                        <Text style={[styles.hoursTitle, { color: colors.textPrimary }]}>Hours</Text>
                        {operatingHours.map((row) => (
                            <Text key={row} style={[styles.hoursText, { color: colors.textSecondary }]}>
                                {row}
                            </Text>
                        ))}
                    </View>
                ) : null}

                <MarketplaceDisclosure />

                <Text style={[styles.listingsTitle, { color: colors.textPrimary }]}>
                    Available books ({displayListings.length})
                </Text>

                {displayListings.length === 0 ? (
                    <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
                        No books currently listed.
                    </Text>
                ) : (
                    <View style={styles.listingsList}>
                        {displayListings.map((offer) => (
                            <StoreOfferCard key={offer.id} offer={offer} />
                        ))}
                    </View>
                )}
            </ScrollView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    container: {
        padding: 24,
        paddingBottom: 40,
        gap: 12,
    },
    cover: {
        height: 120,
        borderRadius: 8,
        backgroundColor: '#E7EBF0',
    },
    logo: {
        width: 64,
        height: 64,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        backgroundColor: '#FFFFFF',
        marginTop: -42,
    },
    eyebrow: {
        fontSize: 13,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
    },
    description: {
        fontSize: 14,
        lineHeight: 20,
    },
    locationRow: {
        flexDirection: 'row',
        gap: 10,
    },
    locationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    locationText: {
        fontSize: 12,
        fontWeight: '600',
    },
    fulfillmentRow: {
        flexDirection: 'row',
        gap: 12,
    },
    fulfillmentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    fulfillmentText: {
        fontSize: 12,
        fontWeight: '600',
    },
    hoursBlock: {
        gap: 4,
        paddingTop: 4,
    },
    hoursTitle: {
        fontSize: 14,
        fontWeight: '700',
    },
    hoursText: {
        fontSize: 12,
    },
    listingsTitle: {
        fontSize: 18,
        fontWeight: '800',
        marginTop: 8,
    },
    emptyBody: {
        fontSize: 13,
    },
    listingsList: {
        gap: 8,
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    errorBody: {
        fontSize: 14,
        lineHeight: 20,
        marginTop: 6,
    },
});
