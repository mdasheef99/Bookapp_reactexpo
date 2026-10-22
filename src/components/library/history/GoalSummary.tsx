import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useReadingGoal } from '@/features/books/history/useReadingGoal';
import { yearBooksFinishedCount } from '@/features/books/history/readingStats';
import { LIBRARY_SPACING, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';

export interface GoalSummaryProps {
  actorId: string;
  year?: number;
  timeZone?: string;
  onOpenStats?: () => void;
}

/**
 * Home yearly-goal line (SDD-09 §4.7 H-16).
 * DP-04: plain text only — no ring, bar, colour coding or "behind/ahead"
 * wording. With a goal: "14 of 24 books in 2026" linking to the stats
 * screen. Without one: a quiet "Reading stats" link to the same screen.
 */
export function GoalSummary({ actorId, year, timeZone, onOpenStats }: GoalSummaryProps) {
  const colors = useLibraryAppearance();
  const targetYear = year ?? new Date().getFullYear();
  // Single goal source (typed hook). While pending the quiet link keeps the
  // stats screen always reachable (§4.7); never return null.
  const { goal, reads } = useReadingGoal(actorId, targetYear, !!actorId);

  if (!actorId) {
    return (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Reading stats"
        onPress={() => {
          if (onOpenStats) {
            onOpenStats();
            return;
          }
          router.push('/(tabs)/library/stats');
        }}
        testID="library-goal-summary-link"
        style={styles.link}
      >
        <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>Reading stats</Text>
      </Pressable>
    );
  }
  if (goal.isPending || reads.isPending) {
    return (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Reading stats"
        onPress={() => {
          if (onOpenStats) {
            onOpenStats();
            return;
          }
          router.push('/(tabs)/library/stats');
        }}
        testID="library-goal-summary-link"
        style={styles.link}
      >
        <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>Reading stats</Text>
      </Pressable>
    );
  }

  const openStats = () => {
    if (onOpenStats) {
      onOpenStats();
      return;
    }
    router.push('/(tabs)/library/stats');
  };

  // Errors still leave the stats screen reachable through the quiet link.
  if (goal.isError || reads.isError || !goal.data) {
    return (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Reading stats"
        onPress={openStats}
        testID="library-goal-summary-link"
        style={styles.link}
      >
        <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>Reading stats</Text>
      </Pressable>
    );
  }

  const count = yearBooksFinishedCount(reads.data ?? [], targetYear, timeZone);
  const text = `${count} of ${goal.data.target_books} books in ${targetYear}`;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={text}
      onPress={openStats}
      testID="library-goal-summary-link"
      style={styles.link}
    >
      <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    paddingTop: LIBRARY_SPACING.xs,
    paddingBottom: LIBRARY_SPACING.xs,
    alignSelf: 'flex-start',
  },
});
