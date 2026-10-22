import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { historyKeys } from '@/features/books/history/readingHistoryContract';
import {
  OpenReadWithProgress,
  ProgressValue,
  readingHistoryGateway,
} from '@/features/books/history/readingHistoryGateway';
import { compareOpenReads, openReadActivityAt } from '@/features/books/history/openReadActivity';
import { useOpenReadsWithProgress } from '@/features/books/history/useOpenReadsWithProgress';
import { useStartReading } from '@/features/books/history/useStartReading';
import { currentPosition } from '@/features/books/history/progressMath';
import {
  effectiveTotalPages,
  fallbackTotalForRead,
  shouldPersistFallbackTotal,
} from '@/features/books/history/totalPagesFallback';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { LIBRARY_RADIUS, LIBRARY_SPACING, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';
import { BookButton, useBookFeedback } from '../ui';
import { notifySaveSuccess } from '@/features/books/history/saveConfirmation';
import { PageEdgeBar } from './PageEdgeBar';
import { ProgressSheet } from './ProgressSheet';

export interface ContinueReadingCardProps {
  actorId: string;
  onOpenBook?: (userBookId: string) => void;
}

function activityMillis(item: OpenReadWithProgress): number {
  if (typeof item.lastActivityAt === 'string' && item.lastActivityAt.length > 0) {
    const parsed = Date.parse(item.lastActivityAt);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.parse(openReadActivityAt(item.read, item.latestProgress));
}

export function pickMostRecent(items: readonly OpenReadWithProgress[]): OpenReadWithProgress | null {
  if (items.length === 0) return null;
  let best = items[0];
  let bestTime = activityMillis(best);
  for (let index = 1; index < items.length; index += 1) {
    const item = items[index];
    const time = activityMillis(item);
    if (time > bestTime) {
      best = item;
      bestTime = time;
      continue;
    }
    if (time === bestTime) {
      const order = compareOpenReads(
        { ...item, lastActivityAt: new Date(time).toISOString() },
        { ...best, lastActivityAt: new Date(bestTime).toISOString() },
      );
      if (order < 0) {
        best = item;
        bestTime = time;
      }
    }
  }
  return best;
}

function shortProgressText(
  pages: number | null,
  percent: number | null,
  totalPages: number | null,
): string | null {
  if (pages !== null && totalPages !== null && totalPages > 0) return `p. ${pages} of ${totalPages}`;
  if (pages !== null) return `p. ${pages}`;
  if (percent !== null) return `${percent}%`;
  return null;
}

/**
 * Continue-reading card for Home (SDD-09 §4.5 H-12).
 * Shows the most recently updated open read (title, short progress,
 * page-edge bar, Update opening the progress sheet). With no open read and a
 * next read set pointing to a book in the library, shows "Next up".
 * Otherwise renders nothing.
 */
export function ContinueReadingCard({ actorId, onOpenBook }: ContinueReadingCardProps) {
  const colors = useLibraryAppearance();
  const { notify } = useBookFeedback();
  const { isOffline } = useNetworkStatus();
  const client = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const progressGuard = useRef(false);
  const { start: startNextRead, isPending: startReadingPending } = useStartReading(actorId);

  const openReads = useOpenReadsWithProgress(actorId);
  const settings = useQuery({
    queryKey: historyKeys.settings(actorId),
    queryFn: ({ signal }) => readingHistoryGateway.settings(actorId, signal),
    enabled: !!actorId && openReads.isSuccess && (openReads.data?.length ?? 0) === 0,
    retry: false,
  });

  const items = openReads.data ?? [];
  const selected = openReads.isSuccess ? pickMostRecent(items) : null;
  const selectedBookId = selected?.read.user_book_id ?? '';
  const needFallback = !!selected && selected.read.total_pages === null;
  const fallbackReads = useQuery({
    queryKey: [...historyKeys.readsForBook(actorId, selectedBookId), 'fallback-total'],
    queryFn: ({ signal }) => readingHistoryGateway.readsForBook(actorId, selectedBookId, signal),
    enabled: !!actorId && !!selected && needFallback && !!selectedBookId,
    retry: false,
  });
  const nextId =
    openReads.isSuccess && items.length === 0 ? (settings.data?.next_read_user_book_id ?? null) : null;
  const nextTitle = useQuery({
    queryKey: ['library-history-next-read-title', actorId, nextId ?? ''],
    queryFn: ({ signal }) => readingHistoryGateway.userBookTitle(actorId, nextId as string, signal),
    enabled: !!actorId && openReads.isSuccess && items.length === 0 && !!nextId,
    retry: false,
  });

  const invalidateAfterProgress = useCallback(
    (userBookId: string, readId: string) => {
      void client.invalidateQueries({ queryKey: historyKeys.progressForRead(actorId, readId) });
      void client.invalidateQueries({ queryKey: historyKeys.readsForBook(actorId, userBookId) });
      void client.invalidateQueries({ queryKey: historyKeys.readsForUser(actorId) });
      void client.invalidateQueries({ queryKey: historyKeys.openReads(actorId) });
      void client.invalidateQueries({ queryKey: ['library'] });
      void client.invalidateQueries({ queryKey: ['book', actorId] });
    },
    [actorId, client],
  );

  const addProgress = useMutation({
    mutationFn: ({ readId, value }: { readId: string; value: ProgressValue }) =>
      readingHistoryGateway.addProgress(actorId, readId, value),
    onSuccess: (_data, variables) => {
      const match = (openReads.data ?? []).find((item) => item.read.id === variables.readId);
      if (match) invalidateAfterProgress(match.read.user_book_id, variables.readId);
      else {
        void client.invalidateQueries({ queryKey: historyKeys.readsForUser(actorId) });
        void client.invalidateQueries({ queryKey: historyKeys.openReads(actorId) });
        void client.invalidateQueries({ queryKey: ['library'] });
      }
    },
  });

  const setTotalPages = useMutation({
    mutationFn: ({ readId, total }: { readId: string; total: number | null }) =>
      readingHistoryGateway.setTotalPages(actorId, readId, total),
    onSuccess: (_data, variables) => {
      const match = (openReads.data ?? []).find((item) => item.read.id === variables.readId);
      if (match) invalidateAfterProgress(match.read.user_book_id, variables.readId);
      else {
        void client.invalidateQueries({ queryKey: historyKeys.readsForUser(actorId) });
        void client.invalidateQueries({ queryKey: historyKeys.openReads(actorId) });
        void client.invalidateQueries({ queryKey: ['library'] });
      }
    },
  });

  const notifyError = useCallback(
    (error: unknown, retry: () => void) => {
      notify({
        kind: 'error',
        message: error instanceof Error ? error.message : "Couldn't update your reading.",
        action: { label: 'Retry', onPress: retry },
      });
    },
    [notify],
  );

  if (!actorId) return null;
  if (openReads.isPending) return null;

  if (openReads.isError) {
    return (
      <View testID="library-continue-reading-card" style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>
          Couldn&apos;t load your reading.
        </Text>
        <BookButton
          label="Try again"
          variant="text"
          onPress={() => {
            void openReads.refetch();
          }}
          testID="library-continue-reading-retry"
        />
      </View>
    );
  }

  if (selected) {
    const fallbackTotal =
      selected.read.total_pages === null && Array.isArray(fallbackReads.data)
        ? fallbackTotalForRead(fallbackReads.data, selected.read.id)
        : null;
    const total = effectiveTotalPages(selected.read.total_pages, fallbackTotal);
    const position = currentPosition(
      selected.latestProgress ? [selected.latestProgress] : [],
      total,
    );
    const pages = position?.pages ?? null;
    const percent = position?.percent ?? null;
    const short = shortProgressText(pages, percent, total);
    const busy = addProgress.isPending || setTotalPages.isPending;

    const handleSaveProgress = (value: ProgressValue) => {
      if (progressGuard.current) return Promise.resolve(null);
      progressGuard.current = true;
      const persistFirst = shouldPersistFallbackTotal(
        selected.read.total_pages,
        fallbackTotal,
        selected.latestProgress !== null,
      );
      const attempt = () => {
        const saveAll = async () => {
          if (persistFirst && fallbackTotal !== null) {
            await setTotalPages.mutateAsync({ readId: selected.read.id, total: fallbackTotal });
          }
          return addProgress.mutateAsync({ readId: selected.read.id, value });
        };
        return saveAll().then(
          (saved) => {
            progressGuard.current = false;
            notifySaveSuccess(notify, 'Progress saved');
            return saved;
          },
          (error: unknown) => {
            progressGuard.current = false;
            notifyError(error, () => {
              if (progressGuard.current) return;
              void handleSaveProgress(value);
            });
            throw error;
          },
        );
      };
      return attempt().catch(() => {
        progressGuard.current = false;
        return null;
      });
    };

    const handleSaveTotal = (next: number | null) => {
      if (progressGuard.current) return Promise.resolve(null);
      progressGuard.current = true;
      const attempt = () =>
        setTotalPages.mutateAsync({ readId: selected.read.id, total: next }).then(
          (saved) => {
            progressGuard.current = false;
            notifySaveSuccess(notify, 'Total pages saved');
            return saved;
          },
          (error: unknown) => {
            progressGuard.current = false;
            notifyError(error, () => {
              if (progressGuard.current) return;
              void handleSaveTotal(next);
            });
            throw error;
          },
        );
      return attempt().catch(() => {
        progressGuard.current = false;
        return null;
      });
    };

    const title = (
      <Text style={[LIBRARY_TEXT.heading, { color: colors.textPrimary }]} numberOfLines={2}>
        {selected.bookTitle}
      </Text>
    );

    return (
      <View testID="library-continue-reading-card" style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[LIBRARY_TEXT.label, { color: colors.textSecondary }]}>Continue reading</Text>
        {onOpenBook ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Continue reading ${selected.bookTitle}`}
            onPress={() => onOpenBook(selected.read.user_book_id)}
            testID="library-continue-reading-open"
          >
            {title}
          </Pressable>
        ) : (
          <View accessibilityLabel={`Continue reading ${selected.bookTitle}`}>{title}</View>
        )}
        {short ? (
          <Text testID="library-continue-reading-progress" style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>
            {short}
          </Text>
        ) : null}
        <PageEdgeBar
          pages={pages}
          totalPages={total}
          percent={total === null ? (percent ?? undefined) : undefined}
        />
        <BookButton
          label="Update"
          variant="secondary"
          onPress={() => setSheetOpen(true)}
          testID="library-continue-reading-update"
        />
        <ProgressSheet
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          totalPages={selected.read.total_pages}
          fallbackTotalPages={fallbackTotal}
          currentPages={pages}
          currentPercent={percent}
          onSaveProgress={handleSaveProgress}
          onSaveTotalPages={handleSaveTotal}
          pending={busy}
          disabled={isOffline}
        />
      </View>
    );
  }

  if (settings.isPending) return null;
  if (settings.isError) {
    return (
      <View testID="library-continue-reading-card" style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>
          Couldn&apos;t load your reading.
        </Text>
        <BookButton
          label="Try again"
          variant="text"
          onPress={() => {
            void settings.refetch();
          }}
          testID="library-continue-reading-retry"
        />
      </View>
    );
  }
  if (!nextId) return null;
  if (nextTitle.isPending) return null;
  if (nextTitle.isError) {
    return (
      <View testID="library-continue-reading-card" style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>
          Couldn&apos;t load your reading.
        </Text>
        <BookButton
          label="Try again"
          variant="text"
          onPress={() => {
            void nextTitle.refetch();
          }}
          testID="library-continue-reading-retry"
        />
      </View>
    );
  }
  if (!nextTitle.data) return null;

  const handleStart = () => {
    void startNextRead(nextId);
  };

  return (
    <View testID="library-continue-reading-card" style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <Text testID="library-continue-reading-next-up" style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}>
        {`Next up: ${nextTitle.data}`}
      </Text>
      <BookButton
        label={startReadingPending ? 'Starting…' : 'Start reading'}
        variant="secondary"
        disabled={isOffline || startReadingPending}
        onPress={handleStart}
        testID="library-continue-reading-start"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: LIBRARY_RADIUS.card,
    padding: LIBRARY_SPACING.md,
    gap: LIBRARY_SPACING.xs,
  },
});
