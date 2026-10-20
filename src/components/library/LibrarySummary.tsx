import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLibraryAppearance } from './LibraryAppearance';
import { useLibraryTypography } from './LibraryTypography';

type LibrarySummaryProps = {
    count: number;
    activeFilterLabel: string;
};

export function LibrarySummary({ count, activeFilterLabel }: LibrarySummaryProps) {
    const colors = useLibraryAppearance();
    const fonts = useLibraryTypography();

    return (
        <View style={styles.summaryRow}>
            <Text style={[styles.summaryValue, { color: colors.textSecondary, fontFamily: fonts.body }]} accessibilityLiveRegion="polite">
                {count} {count === 1 ? 'book' : 'books'}
            </Text>
            <Text style={[styles.summaryMetaText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                Showing {activeFilterLabel.toLowerCase()}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    summaryRow: {
        paddingTop: 12,
        paddingBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    summaryValue: {
        fontSize: 12,
        lineHeight: 18,
    },
    summaryMetaText: {
        fontSize: 12,
        lineHeight: 18,
    },
});
