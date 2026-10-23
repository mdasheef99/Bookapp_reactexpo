import React, { useEffect, useMemo, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { historyKeys } from '@/features/books/history/readingHistoryContract';
import { readingHistoryGateway } from '@/features/books/history/readingHistoryGateway';
import { todayDay } from '@/features/books/history/estimateDay';
import { findOnThisDay } from '@/features/books/history/onThisDay';
import type { LibraryBookEntry } from '@/features/books/utils/libraryShelf';
import { LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';
import { BookButton } from '../ui';

export interface OnThisDayLineProps {
  actorId: string;
  books: LibraryBookEntry[];
  booksLoaded: boolean;
  hidden?: boolean;
  onOpenBook: (userBookId: string) => void;
  /** Test override: explicit IANA zone instead of the device zone. */
  timeZone?: string;
  /** Test override: explicit YYYY-MM-DD instead of the midnight-refreshing today. */
  today?: string;
}

function deviceZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (typeof zone === 'string' && zone.length > 0) return zone;
  } catch {
    // Fall through to UTC when the device zone is unavailable.
  }
  return 'UTC';
}

/**
 * Milliseconds until the next local midnight in `zone` (copies the
 * NoteSwipeHomeTile pattern instead of importing it, so the history line
 * never depends on the swipe section; 23/25-hour DST days included).
 */
function nextDayDelay(zone: string, now: Date): number {
  const day = todayDay(zone, now);
  const start = now.getTime();
  let low = start;
  let high = start + 27 * 60 * 60 * 1000;
  while (high - low > 1000) {
    const middle = Math.floor((low + high) / 2);
    if (todayDay(zone, new Date(middle)) === day) low = middle;
    else high = middle;
  }
  return Math.max(1000, high - start);
}

function sentenceFor(year: number, title: string): string {
  return `On this day in ${year} you finished ${title}.`;
}

/**
 * "On this day" line for Library home (SDD-10 Unit D §4.4, D10-12).
 * Passive text only: one Pressable line for the first match plus at most one
 * text button ("and N more" / "Show fewer"). No primary, no loading/error/
 * empty states — renders nothing unless both queries are loaded, visible,
 * and at least one read matches. Shares the existing readsForUser cache.
 */
export function OnThisDayLine({
  actorId,
  books,
  booksLoaded,
  hidden = false,
  onOpenBook,
  timeZone,
  today,
}: OnThisDayLineProps) {
  const colors = useLibraryAppearance();
  const [expanded, setExpanded] = useState(false);
  const [liveCalendar, setLiveCalendar] = useState(() => {
    const zone = timeZone ?? deviceZone();
    return { day: today ?? todayDay(zone, new Date()), zone };
  });

  useEffect(() => {
    if (today !== undefined) {
      setLiveCalendar({ day: today, zone: timeZone ?? deviceZone() });
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      const zone = timeZone ?? deviceZone();
      const now = new Date();
      setLiveCalendar({ day: todayDay(zone, now), zone });
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(refresh, nextDayDelay(zone, now));
    };
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const onFocus = () => refresh();
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus);
    }
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      subscription?.remove?.();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus);
      }
    };
  }, [today, timeZone]);

  useEffect(() => {
    setExpanded(false);
  }, [liveCalendar.day, liveCalendar.zone, today, actorId]);

  const reads = useQuery({
    queryKey: historyKeys.readsForUser(actorId),
    queryFn: ({ signal }) => readingHistoryGateway.readsForUser(actorId, signal),
    enabled: !!actorId,
    retry: false,
  });

  const titles = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of books ?? []) {
      if (!entry || typeof entry.id !== 'string') continue;
      const raw = entry.book?.title;
      if (typeof raw !== 'string') continue;
      const trimmed = raw.trim();
      if (!trimmed) continue;
      if (!map.has(entry.id)) map.set(entry.id, trimmed);
    }
    return map;
  }, [books]);

  const resolvedToday = today ?? liveCalendar.day;
  const resolvedZone = timeZone ?? liveCalendar.zone;

  const matches = useMemo(() => {
    if (!booksLoaded) return [];
    if (!reads.data) return [];
    try {
      return findOnThisDay(reads.data, resolvedToday, resolvedZone, titles);
    } catch {
      return [];
    }
  }, [booksLoaded, reads.data, resolvedToday, resolvedZone, titles]);

  if (!actorId) return null;
  if (hidden) return null;
  if (!booksLoaded) return null;
  if (reads.isPending || reads.isError || !reads.data) return null;
  if (matches.length === 0) return null;

  const [first, ...rest] = matches;
  const firstName = sentenceFor(first.year, first.title);

  return (
    <View testID="library-on-this-day" style={styles.wrap}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={firstName}
        onPress={() => onOpenBook(first.userBookId)}
        testID="library-on-this-day-open"
        style={styles.line}
      >
        <Text style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>
          <Text>{`On this day in ${first.year} you finished `}</Text>
          <Text style={styles.title}>{first.title}</Text>
          <Text>.</Text>
        </Text>
      </Pressable>
      {rest.length > 0 && !expanded ? (
        <BookButton
          label={rest.length === 1 ? 'and 1 more' : `and ${rest.length} more`}
          accessibilityLabel={rest.length === 1 ? 'and 1 more' : `and ${rest.length} more`}
          variant="text"
          expanded={expanded}
          onPress={() => setExpanded(true)}
          testID="library-on-this-day-more"
        />
      ) : null}
      {expanded
        ? rest.map((match) => {
            const name = sentenceFor(match.year, match.title);
            return (
              <Pressable
                key={`${match.userBookId}|${match.year}`}
                accessibilityRole="link"
                accessibilityLabel={name}
                onPress={() => onOpenBook(match.userBookId)}
                testID={`library-on-this-day-open-${match.userBookId}-${match.year}`}
                style={styles.line}
              >
                <Text style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>
                  <Text>{`On this day in ${match.year} you finished `}</Text>
                  <Text style={styles.title}>{match.title}</Text>
                  <Text>.</Text>
                </Text>
              </Pressable>
            );
          })
        : null}
      {expanded && rest.length > 0 ? (
        <BookButton
          label="Show fewer"
          variant="text"
          expanded={expanded}
          onPress={() => setExpanded(false)}
          testID="library-on-this-day-fewer"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: LIBRARY_SPACING.xs,
    gap: LIBRARY_SPACING.xs,
  },
  line: {
    minHeight: MIN_TARGET,
    justifyContent: 'center',
  },
  title: {
    fontStyle: 'italic',
  },
});
