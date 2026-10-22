import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatProgressText } from '@/features/books/history/progressMath';
import { LIBRARY_SPACING, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';

export interface PageEdgeBarProps {
  pages: number | null;
  totalPages: number | null;
  percent?: number | null;
}

/**
 * Display-only page-edge bar (SDD-09 §4.5 H-09).
 * The bar itself is hidden from screen readers; the visible text carries the meaning.
 */
export function PageEdgeBar({ pages, totalPages, percent }: PageEdgeBarProps) {
  const colors = useLibraryAppearance();
  const text = formatProgressText({
    entry: { id: 'edge', read_id: '', user_id: '', page: pages, percent: percent ?? null, recorded_at: '' },
    kind: pages !== null ? 'page' : 'percent',
    pages,
    percent: percent ?? null,
    totalPages,
  });
  if (!text) return null;
  const fillPercent =
    pages !== null && totalPages !== null && totalPages > 0
      ? Math.max(0, Math.min(100, (pages / totalPages) * 100))
      : percent !== null && percent !== undefined
        ? Math.max(0, Math.min(100, percent))
        : 0;

  return (
    <View testID="library-progress-edge" style={styles.wrap}>
      <Text testID="library-progress-bar-text" style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}>
        {text}
      </Text>
      <View
        testID="library-progress-bar"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        aria-hidden
        style={[styles.track, { backgroundColor: colors.bgSecondary, borderColor: colors.controlBorder }]}
      >
        <View style={[styles.fill, { width: `${fillPercent}%`, backgroundColor: colors.textSecondary }]} />
        <View
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
          style={[styles.edge, { backgroundColor: colors.bgCard, borderColor: colors.divider }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: LIBRARY_SPACING.xs,
  },
  track: {
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  fill: {
    height: '100%',
  },
  edge: {
    width: 6,
    borderLeftWidth: 1,
  },
});
