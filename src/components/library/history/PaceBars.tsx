import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DailyPagesDay } from '@/features/books/history/progressMath';
import { formatDailyPagesSummary } from '@/features/books/history/progressMath';
import { LIBRARY_SPACING, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';

export interface PaceBarsProps {
  days: readonly DailyPagesDay[];
  estimateText?: string | null;
}

/**
 * Pace bars (SDD-09 §4.5 H-11): up to 14 thin plain-view bars.
 * Bars are hidden from screen readers; the text equivalent carries the meaning.
 * Neutral tokens only, never alert colours (DP-04, D09-11). No deadline wording.
 */
export function PaceBars({ days, estimateText }: PaceBarsProps) {
  const colors = useLibraryAppearance();
  if (days.length === 0 && !estimateText) return null;
  const max = Math.max(1, ...days.map((item) => item.pages));
  const summary = formatDailyPagesSummary(days);

  return (
    <View testID="library-progress-pace" style={styles.wrap}>
      <View
        testID="library-progress-pace-bars"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        aria-hidden
        style={styles.bars}
      >
        {days.map((item) => {
          const heightPercent = Math.max(0, Math.min(100, (item.pages / max) * 100));
          return (
            <View
              key={item.day}
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              aria-hidden
              style={[styles.barTrack, { backgroundColor: colors.bgSecondary }]}
            >
              <View style={[styles.barSpacer, { flex: 1 - heightPercent / 100 }]} />
              <View
                style={[
                  styles.barFill,
                  { flex: heightPercent / 100, backgroundColor: colors.textSecondary },
                ]}
              />
            </View>
          );
        })}
      </View>
      <Text testID="library-progress-pace-text" style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>
        {summary}
      </Text>
      {estimateText ? (
        <Text testID="library-progress-estimate" style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}>
          {estimateText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: LIBRARY_SPACING.xs,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: LIBRARY_SPACING.xxs,
  },
  barTrack: {
    flex: 1,
    height: 40,
    borderRadius: 2,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  barSpacer: {
    minHeight: 0,
  },
  barFill: {
    minHeight: 0,
  },
});
