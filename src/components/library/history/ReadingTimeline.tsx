import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ReadingRead, effectiveReadDates } from '@/features/books/history/readingHistoryContract';
import { assignNotesToReads } from '@/features/books/history/readingTimeline';
import { categoryLabel, ManualNote, noteKeys } from '@/features/books/notes/manualNoteContract';
import { manualNotesGateway } from '@/features/books/notes/manualNotesGateway';
import { LIBRARY_SPACING, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';
import { BookButton } from '../ui';

export interface ReadingTimelineProps {
  actorId: string;
  userBookId: string;
  reads: ReadingRead[];
  notes?: ManualNote[] | undefined;
  timeZone?: string;
  onOpenNotes?: (readId: string) => void;
}

function formatShortDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

function noteLocalDay(createdAt: string, timeZone?: string): string | null {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value.padStart(4, '0');
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

function firstLine(content: string): string {
  const line = content.split('\n')[0]?.trim() ?? '';
  if (line.length === 0) return '(No text)';
  return line.length > 140 ? `${line.slice(0, 140)}…` : line;
}

function NoteRow({ note, timeZone }: { note: ManualNote; timeZone?: string }) {
  const colors = useLibraryAppearance();
  const day = noteLocalDay(note.created_at, timeZone);
  const dateText = day ? formatShortDay(day) : 'Unknown date';
  return (
    <View testID={`library-timeline-note-${note.id}`} style={styles.note}>
      <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>
        {`${dateText} · ${categoryLabel(note.tag)}`}
      </Text>
      <Text style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}>
        {firstLine(note.content)}
      </Text>
    </View>
  );
}

/**
 * Per-read timeline (SDD-09 §4.6 H-13).
 * Reads newest first with a selector when there is more than one.
 * Notes are assigned by effective local days; progress entries are never shown.
 */
export function ReadingTimeline({
  actorId,
  userBookId,
  reads,
  notes,
  timeZone,
  onOpenNotes,
}: ReadingTimelineProps) {
  const colors = useLibraryAppearance();
  const router = useRouter();
  const sorted = useMemo(() => [...reads].sort((a, b) => b.read_number - a.read_number), [reads]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = sorted.find((read) => read.id === selectedId) ?? sorted[0] ?? null;

  const fallback = useQuery({
    queryKey: noteKeys.collection(actorId, userBookId),
    queryFn: ({ signal }) => manualNotesGateway.list(actorId, userBookId, signal),
    enabled: !!actorId && !!userBookId && notes === undefined,
    retry: false,
  });
  const effectiveNotes = notes ?? fallback.data;

  const assigned = useMemo(() => {
    if (!effectiveNotes) return null;
    return assignNotesToReads(sorted, effectiveNotes, timeZone);
  }, [sorted, effectiveNotes, timeZone]);

  if (sorted.length === 0 || !selected) return null;

  if (notes === undefined && fallback.isPending) {
    return (
      <View testID="library-timeline" style={styles.wrap}>
        <Text style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>Loading your reading story…</Text>
      </View>
    );
  }

  if (notes === undefined && fallback.isError) {
    return (
      <View testID="library-timeline" style={styles.wrap}>
        <Text style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>
          Couldn&apos;t load your notes for this timeline.
        </Text>
        <BookButton
          label="Try again"
          variant="text"
          onPress={() => {
            void fallback.refetch();
          }}
          testID="library-timeline-retry"
        />
      </View>
    );
  }

  if (!assigned || !effectiveNotes) return null;

  const selectedDates = effectiveReadDates(selected, timeZone);
  const selectedNotes = assigned.byReadId[selected.id] ?? [];
  const visibleNotes = selectedNotes.slice(0, 5);
  const otherNotes = assigned.otherNotes;
  const otherVisible = otherNotes.slice(0, 5);

  const openNotes = (readId: string) => {
    if (onOpenNotes) {
      onOpenNotes(readId);
      return;
    }
    router.push({ pathname: '/(tabs)/library/notes', params: { userBookId } });
  };

  return (
    <View testID="library-timeline" style={styles.wrap}>
      {sorted.length > 1 ? (
        <View testID="library-timeline-selector" style={styles.selector}>
          <Text style={[LIBRARY_TEXT.label, { color: colors.textSecondary }]}>Choose a read</Text>
          <View style={styles.selectorRow}>
            {sorted.map((read) => (
              <BookButton
                key={read.id}
                label={
                  read.id === selected.id
                    ? `Read ${read.read_number}, showing`
                    : `Read ${read.read_number}`
                }
                variant="secondary"
                selected={read.id === selected.id}
                onPress={() => setSelectedId(read.id)}
                testID={`library-timeline-select-${read.id}`}
              />
            ))}
          </View>
        </View>
      ) : null}
      <View testID={`library-timeline-read-${selected.id}`} style={styles.read}>
        <Text
          testID={`library-timeline-start-${selected.id}`}
          style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}
        >
          {selectedDates.start ? `Started ${formatShortDay(selectedDates.start)}` : 'Start date unknown'}
        </Text>
        {visibleNotes.length === 0 ? (
          <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>No notes in this read.</Text>
        ) : (
          <View style={styles.notes}>
            {visibleNotes.map((note) => (
              <NoteRow key={note.id} note={note} timeZone={timeZone} />
            ))}
          </View>
        )}
        {selectedNotes.length > 5 ? (
          <BookButton
            label="All notes"
            variant="text"
            onPress={() => openNotes(selected.id)}
            testID={`library-timeline-all-notes-${selected.id}`}
          />
        ) : null}
        {selected.outcome === 'finished' ? (
          <Text
            testID={`library-timeline-end-${selected.id}`}
            style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}
          >
            {selectedDates.end ? `Finished ${formatShortDay(selectedDates.end)}` : 'Finished'}
          </Text>
        ) : null}
        {selected.outcome === 'did_not_finish' ? (
          <Text
            testID={`library-timeline-end-${selected.id}`}
            style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}
          >
            {selectedDates.end ? `Stopped ${formatShortDay(selectedDates.end)}` : 'Stopped'}
          </Text>
        ) : null}
      </View>
      {otherNotes.length > 0 ? (
        <View testID="library-timeline-other-notes" style={styles.other}>
          <Text accessibilityRole="header" style={[LIBRARY_TEXT.label, { color: colors.textSecondary }]}>
            Other notes
          </Text>
          {otherVisible.map((note) => (
            <NoteRow key={note.id} note={note} timeZone={timeZone} />
          ))}
          {otherNotes.length > 5 ? (
            <BookButton
              label="All notes"
              variant="text"
              onPress={() => openNotes(selected.id)}
              testID="library-timeline-all-notes-other"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: LIBRARY_SPACING.sm,
  },
  selector: {
    gap: LIBRARY_SPACING.xs,
  },
  selectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: LIBRARY_SPACING.xs,
  },
  read: {
    gap: LIBRARY_SPACING.xs,
  },
  notes: {
    gap: LIBRARY_SPACING.xs,
  },
  note: {
    gap: LIBRARY_SPACING.xxs,
  },
  other: {
    gap: LIBRARY_SPACING.xs,
  },
});
