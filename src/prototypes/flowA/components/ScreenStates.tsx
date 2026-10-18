import React from 'react';
import { Text, View } from 'react-native';
import { styles, usePrototypeText } from '../prototypeTokens';
import type { Appearance } from '../prototypeTokens';
import { PrimaryButton } from './PrimaryButton';

export function ScreenStates({ state, colors }: { state: 'loading' | 'error' | 'not-found'; colors: Appearance }) {
    const text = usePrototypeText();
    if (state === 'loading') return <View accessible accessibilityLabel="Loading book" accessibilityLiveRegion="polite" role="status">
        <View accessible={false} aria-hidden importantForAccessibility="no-hide-descendants">
            <View style={styles.skeletonRow}>
                <View style={[styles.cover, { backgroundColor: colors.coverPlaceholder }]} />
                <View style={styles.titleBlock}>
                    <View style={[styles.skeletonTitle, { backgroundColor: colors.bgSecondary }]} />
                    <View style={[styles.skeletonAuthor, { backgroundColor: colors.bgSecondary }]} />
                </View>
            </View>
            <View style={[styles.skeletonTrack, { backgroundColor: colors.bgSecondary }]} />
        </View>
    </View>;
    const missing = state === 'not-found';
    return <View style={styles.state}>
        <Text style={[text.heading, { color: colors.textPrimary }]}>{missing ? "This book isn't in your library." : "Couldn't load this book."}</Text>
        <PrimaryButton label={missing ? 'Back to Library' : 'Try again'} colors={colors}
            onPress={() => console.info(missing ? '[FA-P1] would go back' : '[FA-P1] would retry book')} />
    </View>;
}
