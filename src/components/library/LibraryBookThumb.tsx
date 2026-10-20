import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LIBRARY_RADIUS, useLibraryAppearance } from './LibraryAppearance';
import { LIBRARY_TEXT } from './LibraryTypography';
import { bookTitleInitials } from './bookDetails/BookCover';

const THUMB_WIDTH = 56;
const THUMB_HEIGHT = 84;

export function LibraryBookThumb({ title, coverUrl }: { title: string; coverUrl?: string | null }) {
    const colors = useLibraryAppearance();
    // expo-image drops an empty alt on web, so the decorative cover is hidden from assistive tech instead.
    if (coverUrl) return <View testID="library-book-thumb-cover" accessible={false} aria-hidden importantForAccessibility="no-hide-descendants">
        <Image source={{ uri: coverUrl }} accessible={false}
            {...(Platform.OS === 'web' ? { alt: '' } : {})} contentFit="cover" style={styles.thumb} />
    </View>;

    return <View testID="library-book-thumb-placeholder" accessible={false} aria-hidden importantForAccessibility="no-hide-descendants"
        style={[styles.thumb, { backgroundColor: colors.coverPlaceholder }]}>
        <Text style={[LIBRARY_TEXT.heading, { color: colors.coverPlaceholderInk }]}>{bookTitleInitials(title)}</Text>
    </View>;
}

const styles = StyleSheet.create({
    thumb: { width: THUMB_WIDTH, height: THUMB_HEIGHT, borderRadius: LIBRARY_RADIUS.control, flexShrink: 0, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
