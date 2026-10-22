import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLibraryTypography } from './LibraryTypography';
import { LIBRARY_RADIUS, useLibraryAppearance } from './LibraryAppearance';

type BentoProps = {
    booksCount: number;
    wishlistCount: number;
    onWishlistPress?: () => void;
};

/**
 * SDD-09 H-12: the bento no longer renders its own Current Read card.
 * The shared `ContinueReadingCard` under the Home controls is the single
 * Current Read display, so the bento keeps only the library counts.
 */
export function LibraryBentoGrid({ booksCount, wishlistCount, onWishlistPress }: BentoProps) {
    const fonts = useLibraryTypography();
    const colors = useLibraryAppearance();
    return (
        <View style={styles.grid}>
            <View style={[styles.smallCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Ionicons name="library-outline" size={20} color={colors.textPrimary} />
                <View>
                    <Text style={[styles.count, { fontFamily: fonts.heading, color: colors.textPrimary }]}>{booksCount}</Text>
                    <Text style={[styles.labelSm, { fontFamily: fonts.label, color: colors.textSecondary }]}>In your library</Text>
                </View>
            </View>
            <Pressable style={[styles.smallCard, { backgroundColor: colors.accent, borderColor: colors.accent }]}
                onPress={onWishlistPress} accessibilityRole="button" accessibilityLabel={`Show wishlist, ${wishlistCount} books`}>
                <Ionicons name="bookmark" size={20} color={colors.onAccent} />
                <View>
                    <Text style={[styles.count, { color: colors.onAccent, fontFamily: fonts.heading }]}>{wishlistCount}</Text>
                    <Text style={[styles.labelSm, { color: colors.onAccent, fontFamily: fonts.label }]}>Wishlist</Text>
                </View>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    smallCard: { flex: 1, minWidth: 120, borderRadius: LIBRARY_RADIUS.card, padding: 16, borderWidth: 1, justifyContent: 'space-between', minHeight: 116 },
    count: { fontSize: 24, lineHeight: 28, marginTop: 8 },
    labelSm: { fontSize: 12, lineHeight: 16, letterSpacing: 0.4, marginTop: 4 },
});
