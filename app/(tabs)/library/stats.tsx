import React, { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useReadingGoal } from '@/features/books/history/useReadingGoal';
import { useReadingStats } from '@/features/books/history/useReadingStats';
import {
  allTimeStats,
  quotesOfYear,
  yearStats,
} from '@/features/books/history/readingStats';
import { YearCardPreview } from '@/components/library/history/YearCardPreview';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { LIBRARY_SPACING, useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import { BookButton, BookScreenHeader, useBookFeedback } from '@/components/library/ui';
import { goalSavedMessage, notifySaveSuccess } from '@/features/books/history/saveConfirmation';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { navigateBackOrFallback } from '@/lib/navigation';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatRate(rate: number | null): string {
  if (rate === null) return 'Finish rate —';
  return `Finish rate ${Math.round(rate * 100)}%`;
}

function formatAverage(average: number | null): string {
  if (average === null) return 'Average —';
  const rounded = Math.round(average * 10) / 10;
  const label = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  return `Average ${label} ${rounded === 1 ? 'day' : 'days'} per book`;
}

function booksLine(count: number): string {
  return `${count} ${count === 1 ? 'book' : 'books'} finished`;
}

function pagesLine(count: number): string {
  return `${count} ${count === 1 ? 'page' : 'pages'} read`;
}

export interface LibraryStatsScreenProps {
  timeZone?: string;
  initialView?: 'year' | 'all' | string;
  yearOverride?: number;
}

export function normalizeStatsView(value: unknown): 'year' | 'all' {
  return value === 'all' ? 'all' : 'year';
}

export default function LibraryStatsScreen(props: LibraryStatsScreenProps) {
  return <LibraryStatsBody {...props} />;
}

function LibraryStatsBody({ timeZone, initialView = 'year', yearOverride }: LibraryStatsScreenProps) {
  const { user } = useAuth();
  const actorId = user?.id ?? '';
  const colors = useLibraryAppearance();
  const { notify } = useBookFeedback();
  const { isOffline } = useNetworkStatus();
  const router = useRouter();
  const year = yearOverride ?? new Date().getFullYear();
  const [view, setView] = useState<'year' | 'all'>(() => normalizeStatsView(initialView));
  const [goalText, setGoalText] = useState('');
  const [goalSynced, setGoalSynced] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const goalGuard = useRef(false);

  // Single goal source: `useReadingGoal` (shared with `GoalSummary`).
  const stats = useReadingStats(actorId, year, !!actorId);
  const goalState = useReadingGoal(actorId, year, !!actorId);
  const reads = stats.reads.data ?? [];
  const goalValue = goalState.goal.data?.target_books ?? null;

  useEffect(() => {
    if (!goalSynced && goalState.goal.isSuccess) {
      setGoalText(goalValue === null ? '' : String(goalValue));
      setGoalSynced(true);
    }
  }, [goalSynced, goalState.goal.isSuccess, goalValue]);

  useEffect(() => {
    setGoalSynced(false);
  }, [actorId, year]);

  if (!actorId) return null;

  const loading = stats.reads.isPending || goalState.goal.isPending;
  const loadError = stats.reads.isError || goalState.goal.isError;

  const notifyError = (error: unknown, retry: () => void) => {
    notify({
      kind: 'error',
      message: error instanceof Error ? error.message : "Couldn't update your reading history.",
      action: { label: 'Retry', onPress: retry },
    });
  };

  const handleSaveGoal = () => {
    if (goalGuard.current || goalState.setGoal.isPending) return;
    const parsed = Number(goalText.trim());
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 999) {
      notify({ kind: 'error', message: 'Enter a number from 1 to 999.' });
      return;
    }
    goalGuard.current = true;
    const attempt = () =>
      goalState.setGoal.mutateAsync(parsed).then(
        (saved) => {
          goalGuard.current = false;
          setGoalText(saved ? String(saved.target_books) : '');
          notifySaveSuccess(notify, goalSavedMessage(parsed));
          return saved;
        },
        (error: unknown) => {
          goalGuard.current = false;
          notifyError(error, () => {
            if (goalGuard.current || goalState.setGoal.isPending) return;
            void handleSaveGoal();
          });
          throw error;
        },
      );
    void attempt().catch(() => {
      goalGuard.current = false;
    });
  };

  const handleRemoveGoal = () => {
    if (goalGuard.current || goalState.setGoal.isPending) return;
    goalGuard.current = true;
    const attempt = () =>
      goalState.setGoal.mutateAsync(null).then(
        (saved) => {
          goalGuard.current = false;
          setGoalText('');
          notifySaveSuccess(notify, goalSavedMessage(null));
          return saved;
        },
        (error: unknown) => {
          goalGuard.current = false;
          notifyError(error, () => {
            if (goalGuard.current || goalState.setGoal.isPending) return;
            void handleRemoveGoal();
          });
          throw error;
        },
      );
    void attempt().catch(() => {
      goalGuard.current = false;
    });
  };

  const yearSummary = yearStats(reads, year, timeZone);
  const allSummary = allTimeStats(reads, timeZone);
  const shown =
    view === 'year'
      ? {
          heading: `Your ${year}`,
          books: booksLine(yearSummary.books),
          pages: pagesLine(yearSummary.pages),
          unknown: yearSummary.unknownPages,
          rate: formatRate(yearSummary.rate),
          average: formatAverage(yearSummary.averageDays),
        }
      : {
          heading: 'All time',
          books: booksLine(allSummary.books),
          pages: pagesLine(allSummary.pages),
          unknown: allSummary.unknownPages,
          rate: formatRate(allSummary.rate),
          average: formatAverage(allSummary.averageDays),
        };
  const monthsText = MONTH_SHORT.map((name, index) => `${name} ${yearSummary.monthly[index]}`).join(
    ' · ',
  );
  const maxBar = Math.max(1, ...yearSummary.monthly);
  const yearQuotes = quotesOfYear(
    (stats.quotes.data ?? []).map((row) => ({
      id: row.id,
      content: row.content,
      created_at: row.created_at,
      user_book_id: row.user_book_id,
    })),
    year,
    timeZone,
  );
  const showYearCardEntry = view === 'year' && Platform.OS !== 'web';

  return (
    <View style={[styles.page, { backgroundColor: colors.bgPrimary }]}>
      <BookScreenHeader
        backLabel="Library"
        backAccessibilityLabel="Back to Library"
        backTestID="library-stats-back-button"
        onBack={() => navigateBackOrFallback(router, '/(tabs)/library')}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={[LIBRARY_TEXT.heading, { color: colors.textPrimary }]}>
          Reading stats
        </Text>
        <View testID="library-stats-toggle" style={styles.toggle}>
          <BookButton
            label="This year"
            variant="secondary"
            selected={view === 'year'}
            onPress={() => setView('year')}
            testID="library-stats-toggle-year"
          />
          <BookButton
            label="All time"
            variant="secondary"
            selected={view === 'all'}
            onPress={() => setView('all')}
            testID="library-stats-toggle-all"
          />
        </View>
        {loading ? (
          <Text style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>Loading your stats…</Text>
        ) : loadError ? (
          <View style={styles.state}>
            <Text style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>
              Couldn&apos;t load your stats.
            </Text>
            <BookButton
              label="Try again"
              variant="text"
              onPress={() => {
                void stats.reads.refetch();
                void goalState.goal.refetch();
              }}
              testID="library-stats-retry"
            />
          </View>
        ) : (
          <>
            <Text
              accessibilityRole="header"
              testID="library-stats-heading"
              style={[LIBRARY_TEXT.heading, { color: colors.textPrimary }]}
            >
              {shown.heading}
            </Text>
            <Text testID="library-stats-books" style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}>
              {shown.books}
            </Text>
            <Text testID="library-stats-pages" style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}>
              {shown.pages}
            </Text>
            {shown.unknown > 0 ? (
              <Text
                testID="library-stats-pages-note"
                style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}
              >
                {`${shown.unknown} ${shown.unknown === 1 ? 'book' : 'books'} without a page count`}
              </Text>
            ) : null}
            <Text testID="library-stats-rate" style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}>
              {shown.rate}
            </Text>
            <Text testID="library-stats-average" style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}>
              {shown.average}
            </Text>
            {view === 'year' ? (
              <View testID="library-stats-months" style={styles.months}>
                <View
                  testID="library-stats-month-chart"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  aria-hidden
                  style={styles.bars}
                >
                  {yearSummary.monthly.map((count, index) => (
                    <View
                      key={MONTH_SHORT[index]}
                      testID={`library-stats-bar-${MONTH_SHORT[index]}`}
                      style={[
                        styles.bar,
                        {
                          backgroundColor: colors.border,
                          height: 8 + Math.round((count / maxBar) * 56),
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text
                  testID="library-stats-months-text"
                  style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}
                >
                  {`Finished reads per month: ${monthsText}. A book finished twice appears twice.`}
                </Text>
              </View>
            ) : null}
            {showYearCardEntry ? (
              <BookButton
                label="Year card"
                variant="secondary"
                disabled={isOffline}
                onPress={() => setPreviewOpen(true)}
                testID="library-stats-year-card"
              />
            ) : null}
          </>
        )}
        <View testID="library-stats-goal" style={styles.goal}>
          <Text style={[LIBRARY_TEXT.label, { color: colors.textPrimary }]}>Yearly goal</Text>
          <TextInput
            testID="library-stats-goal-input"
            accessibilityLabel="Yearly goal"
            placeholder="e.g. 24"
            placeholderTextColor={colors.textTertiary}
            keyboardType="number-pad"
            value={goalText}
            onChangeText={setGoalText}
            editable={!isOffline}
            style={[
              LIBRARY_TEXT.body,
              styles.input,
              {
                backgroundColor: colors.bgSecondary,
                color: colors.textPrimary,
                borderColor: colors.controlBorder,
              },
            ]}
          />
          <BookButton
            label="Save"
            variant="secondary"
            disabled={isOffline || goalState.setGoal.isPending}
            onPress={handleSaveGoal}
            testID="library-stats-goal-save"
          />
          {goalValue !== null ? (
            <BookButton
              label="Remove"
              variant="text"
              disabled={isOffline || goalState.setGoal.isPending}
              onPress={handleRemoveGoal}
              testID="library-stats-goal-remove"
            />
          ) : null}
        </View>
      </ScrollView>
      {showYearCardEntry ? (
        <YearCardPreview
          visible={previewOpen}
          year={year}
          books={yearSummary.books}
          pages={yearSummary.pages}
          quotes={yearQuotes}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { gap: LIBRARY_SPACING.sm, padding: LIBRARY_SPACING.large },
  toggle: { flexDirection: 'row', gap: LIBRARY_SPACING.xs },
  state: { gap: LIBRARY_SPACING.xs },
  months: { gap: LIBRARY_SPACING.xs },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: LIBRARY_SPACING.xxs },
  bar: { flex: 1, borderRadius: 2, minWidth: 8 },
  goal: { gap: LIBRARY_SPACING.xs },
  input: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: LIBRARY_SPACING.sm,
    paddingVertical: LIBRARY_SPACING.xs,
    borderWidth: 1,
  },
});
