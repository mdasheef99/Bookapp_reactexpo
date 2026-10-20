import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLibraryTypography } from './LibraryTypography';
import { LIBRARY_RADIUS, useLibraryAppearance } from './LibraryAppearance';

type BentoProps = {
    currentBook?: { title: string; author: string; progress?: number } | null;
    booksCount: number;
    wishlistCount: number;
    onCurrentBookPress?: () => void;
    onWishlistPress?: () => void;
};

export function LibraryBentoGrid({ currentBook, booksCount, wishlistCount, onCurrentBookPress, onWishlistPress }: BentoProps) {
    const fonts = useLibraryTypography();
    const colors = useLibraryAppearance();
    const progress = currentBook?.progress;
    return (
        <View style={styles.grid}>
            <Pressable style={[styles.card, styles.currentCard, { backgroundColor: colors.bgCard, borderColor: colors.border, shadowColor: colors.shadow }]} onPress={onCurrentBookPress}
                disabled={!currentBook || !onCurrentBookPress} accessibilityRole={currentBook ? 'button' : undefined}
                accessibilityLabel={currentBook ? `Continue reading ${currentBook.title}` : 'No current read'}>
                <View style={[styles.cardDecor, { backgroundColor: colors.bgSecondary }]} pointerEvents="none" />
                <Text style={[styles.labelPill, { fontFamily: fonts.label, backgroundColor: colors.tagBackground, color: colors.tagText }]}>Current Read</Text>
                <Text style={[styles.headlineMd, { fontFamily: fonts.heading, color: colors.textPrimary }]} numberOfLines={2}>{currentBook?.title ?? 'Your next chapter awaits'}</Text>
                <Text style={[styles.bodyMd, { fontFamily: fonts.body, color: colors.textSecondary }]} numberOfLines={2}>{currentBook?.author ?? 'Choose a book from your shelf to start reading.'}</Text>
                {typeof progress === 'number' ? (
                    <View style={styles.progressRow}>
                        <View style={[styles.progressTrack, { backgroundColor: colors.bgSecondary }]}>
                            <View style={[styles.progressFill, { backgroundColor: colors.accent, width: `${Math.max(0, Math.min(100, progress))}%` }]} />
                        </View>
                        <Text style={[styles.progressLabel, { fontFamily: fonts.label, color: colors.textSecondary }]}>{progress}%</Text>
                    </View>
                ) : currentBook ? <Text style={[styles.readingLabel, { fontFamily: fonts.label, color: colors.textSecondary }]}>Currently reading · Open book →</Text> : null}
            </Pressable>
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
    card: {
        borderRadius: LIBRARY_RADIUS.card, padding: 24, shadowOpacity: 0.08,
        shadowRadius: 8, elevation: 3, borderWidth: 1, overflow: 'hidden',
    },
    currentCard: { width: '100%', minHeight: 179 },
    cardDecor: { position: 'absolute', right: -48, top: -48, width: 192, height: 192, borderRadius: 96, opacity: 0.4 },
    smallCard: { flex: 1, minWidth: 120, borderRadius: LIBRARY_RADIUS.card, padding: 16, borderWidth: 1, justifyContent: 'space-between', minHeight: 116 },
    labelPill: { fontSize: 12, lineHeight: 16, letterSpacing: 0.6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start', overflow: 'hidden' },
    headlineMd: { fontSize: 24, lineHeight: 32, marginTop: 16 },
    bodyMd: { fontSize: 14, lineHeight: 22, marginTop: 4 },
    progressRow: { marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 12 },
    progressTrack: { flex: 1, height: 8, borderRadius: 999, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 999 },
    progressLabel: { fontSize: 12 },
    readingLabel: { marginTop: 18, fontSize: 12 },
    count: { fontSize: 24, lineHeight: 28, marginTop: 8 },
    labelSm: { fontSize: 12, lineHeight: 16, letterSpacing: 0.4, marginTop: 4 },
});
