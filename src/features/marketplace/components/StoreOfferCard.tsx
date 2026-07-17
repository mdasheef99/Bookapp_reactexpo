import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { MarketplaceListingOffer } from '../types';
import { CONFIRMATION_BEFORE_PAYMENT_MESSAGE } from '../constants/disclosures';
import { AddToCartButton } from '../commerce/components/AddToCartButton';

interface StoreOfferCardProps {
    offer: MarketplaceListingOffer;
}

function formatPrice(minor: number): string {
    return `Rs ${(minor / 100).toFixed(0)}`;
}

function formatCondition(condition: string): string {
    return condition
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatAvailabilityStatus(status: MarketplaceListingOffer['availabilityStatus']): string {
    const label = status.replace(/_/g, ' ');
    return label.charAt(0).toUpperCase() + label.slice(1);
}

export function StoreOfferCard({ offer }: StoreOfferCardProps) {
    const { colors } = useTheme();

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${offer.storeDisplayName ?? 'Bookstore'} public store page`}
            onPress={() =>
                router.push({
                    pathname: '/marketplace/store/[storeId]',
                    params: { storeId: offer.storeId },
                })
            }
            style={({ pressed }) => [
                styles.container,
                { borderColor: colors.border, backgroundColor: colors.bgCard },
                pressed && styles.pressed,
            ]}
        >
            <View style={styles.header}>
                <Text style={[styles.storeName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {offer.storeDisplayName ?? 'Bookstore'}
                </Text>
                <Text style={[styles.price, { color: colors.accent }]}>
                    {formatPrice(offer.sellingPriceMinor)}
                </Text>
            </View>

            <View style={styles.details}>
                <Text style={[styles.detail, { color: colors.textSecondary }]}>
                    Condition: {formatCondition(offer.condition)}
                </Text>
                <Text style={[styles.detail, { color: colors.textSecondary }]}>
                    {formatAvailabilityStatus(offer.availabilityStatus)}
                </Text>
                {offer.storeCity ? (
                    <Text style={[styles.detail, { color: colors.textSecondary }]}>
                        {offer.storeLocalityName ? `${offer.storeLocalityName}, ` : ''}{offer.storeCity}
                    </Text>
                ) : null}
            </View>

            <View style={styles.fulfillmentRow}>
                {offer.pickupAvailable ? (
                    <View style={styles.fulfillmentBadge}>
                        <Ionicons name="storefront" size={12} color={colors.accent} />
                        <Text style={[styles.fulfillmentText, { color: colors.accent }]}>Pickup</Text>
                    </View>
                ) : null}
                {offer.deliveryAvailable ? (
                    <View style={styles.fulfillmentBadge}>
                        <Ionicons name="bicycle" size={12} color={colors.accent} />
                        <Text style={[styles.fulfillmentText, { color: colors.accent }]}>Delivery</Text>
                    </View>
                ) : null}
            </View>

            {offer.publicConditionNotes ? (
                <Text style={[styles.conditionNotes, { color: colors.textSecondary }]}>
                    {offer.publicConditionNotes}
                </Text>
            ) : null}

            <Text style={[styles.confirmation, { color: colors.textTertiary }]}>
                {CONFIRMATION_BEFORE_PAYMENT_MESSAGE}
            </Text>
            <AddToCartButton listingId={offer.id} title={offer.publicTitle} />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        gap: 6,
    },
    pressed: {
        opacity: 0.82,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    storeName: {
        fontSize: 14,
        fontWeight: '700',
        flex: 1,
        marginRight: 8,
    },
    price: {
        fontSize: 16,
        fontWeight: '800',
    },
    details: {
        gap: 2,
    },
    detail: {
        fontSize: 12,
    },
    fulfillmentRow: {
        flexDirection: 'row',
        gap: 10,
    },
    fulfillmentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    fulfillmentText: {
        fontSize: 11,
        fontWeight: '600',
    },
    conditionNotes: {
        fontSize: 12,
        lineHeight: 17,
    },
    confirmation: {
        fontSize: 10,
        fontStyle: 'italic',
    },
});
