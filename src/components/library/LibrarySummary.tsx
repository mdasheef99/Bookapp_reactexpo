import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { LIBRARY_SPACING, useLibraryAppearance } from './LibraryAppearance';
import { LIBRARY_TEXT } from './LibraryTypography';

export function LibrarySummary({ count }: { count: number }) {
    const colors = useLibraryAppearance();
    return <Text style={[styles.summary, { color: colors.textSecondary }]} accessibilityLiveRegion="polite">
        {count} {count === 1 ? 'book' : 'books'}
    </Text>;
}

const styles = StyleSheet.create({
    summary: { ...LIBRARY_TEXT.caption, paddingTop: LIBRARY_SPACING.sm, paddingBottom: LIBRARY_SPACING.md },
});
