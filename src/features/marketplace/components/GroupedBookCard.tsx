import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import type { GroupedBookResult } from '../types';
import { StoreOfferCard } from './StoreOfferCard';

interface GroupedBookCardProps {
    result: GroupedBookResult;
}

function formatPrice(minor: number): string {
    return `₹${(minor / 100).toFixed(0)}`;
}

export function GroupedBookCard({ result }: GroupedBookCardProps) {
    const { colors } = useTheme();
    const [expanded, setExpanded] = useState(false);

    return (
        <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
            <Pressable
                style={styles.header}
                onPress={() => setExpanded((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel={`Toggle offers for ${result.title}`}
            >
                {result.coverUrl ? (
                    <Image
                        testID="marketplace-book-cover"
                        source={{ uri: result.coverUrl }}
                        style={styles.cover}
                        contentFit="cover"
                    />
                ) : null}
                <View style={styles.bookInfo}>
                    <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
                        {result.title}
                    </Text>
                    {result.authors && result.authors.length > 0 ? (
                        <Text style={[styles.authors, { color: colors.textSecondary }]} numberOfLines={1}>
                            {result.authors.join(', ')}
                        </Text>
                    ) : null}
                    {result.isbn13 ? (
                        <Text style={[styles.isbn, { color: colors.textTertiary }]}>
                            ISBN: {result.isbn13}
                        </Text>
                    ) : null}
                </View>

                <View style={styles.offerSummary}>
                    <Text style={[styles.offerCount, { color: colors.accent }]}>
                        {result.offerCount} {result.offerCount === 1 ? 'store' : 'stores'}
                    </Text>
                    <Text style={[styles.lowestPrice, { color: colors.accent }]}>
                        from {formatPrice(result.lowestPriceMinor)}
                    </Text>
                    <Ionicons
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={colors.textSecondary}
                    />
                </View>
            </Pressable>

            {expanded ? (
                <View style={styles.offersList}>
                    {result.offers.map((offer) => (
                        <StoreOfferCard key={offer.id} offer={offer} />
                    ))}
                </View>
            ) : null}
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View availability for ${result.title}`}
                onPress={() => router.push({
                    pathname: '/marketplace/book/[listingId]',
                    params: { listingId: result.offers[0].id },
                })}
                style={styles.detailsLink}
            >
                <Text style={[styles.detailsLinkText, { color: colors.accent }]}>View availability</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        gap: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    cover: {
        width: 52,
        height: 78,
        borderRadius: 4,
        backgroundColor: '#E7EBF0',
        marginRight: 10,
    },
    bookInfo: {
        flex: 1,
        marginRight: 12,
        gap: 2,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
    },
    authors: {
        fontSize: 13,
    },
    isbn: {
        fontSize: 11,
    },
    offerSummary: {
        alignItems: 'flex-end',
        gap: 2,
    },
    offerCount: {
        fontSize: 12,
        fontWeight: '700',
    },
    lowestPrice: {
        fontSize: 13,
        fontWeight: '800',
    },
    offersList: {
        gap: 8,
    },
    detailsLink: {
        alignSelf: 'flex-start',
        paddingVertical: 4,
    },
    detailsLinkText: {
        fontSize: 12,
        fontWeight: '700',
    },
});
