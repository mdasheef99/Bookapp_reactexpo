import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LIBRARY_SPACING, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';
import { categoryLabel, type ManualNote } from '@/features/books/notes/manualNoteContract';
import { BookButton } from '../ui/BookButton';
import { NOTE_PREVIEW_LINES } from './bookDetailsTokens';

export function bookNoteDate(stamp: string): string {
  const date = new Date(stamp);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
  });
}

interface NotePassagesProps {
  notes: ManualNote[] | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function NotePassages({ notes, isPending, isError, onRetry }: NotePassagesProps) {
  const colors = useLibraryAppearance();
  const hasData = notes !== undefined;
  const latest = hasData ? notes.slice(0, 2) : [];

  let body: React.ReactNode;
  if (isPending && !hasData) {
    body = (
      <Text accessibilityLiveRegion="polite" style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>
        Loading notes…
      </Text>
    );
  } else if (isError && !hasData) {
    body = (
      <View>
        <Text accessibilityLiveRegion="polite" style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>Couldn&apos;t load your notes.</Text>
        <BookButton label="Try again" variant="text" onPress={onRetry} />
      </View>
    );
  } else if (!hasData || notes.length === 0) {
    body = (
      <View>
        <Text style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>No notes yet.</Text>
        {isError && (
          <View>
            <Text accessibilityLiveRegion="polite" style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>Couldn&apos;t refresh notes.</Text>
            <BookButton label="Try again" variant="text" onPress={onRetry} />
          </View>
        )}
      </View>
    );
  } else {
    body = (
      <View>
        <View style={styles.passages}>
          {latest.map((note) => {
            const meta = [
              note.tag ? categoryLabel(note.tag) : null,
              note.page_number == null ? null : `p. ${note.page_number}`,
              bookNoteDate(note.created_at),
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <View key={note.id} style={styles.passage}>
                <Text
                  testID={`book-note-${note.id}-meta`}
                  style={[LIBRARY_TEXT.caption, { color: colors.textTertiary }]}
                >
                  {meta}
                </Text>
                <Text
                  testID={`book-note-${note.id}-body`}
                  numberOfLines={NOTE_PREVIEW_LINES}
                  ellipsizeMode="tail"
                  style={[LIBRARY_TEXT.bodySerif, { color: colors.textPrimary }]}
                >
                  {note.tag === 'quote' ? `“${note.content}”` : note.content}
                </Text>
              </View>
            );
          })}
        </View>
        {isError && (
          <View>
            <Text accessibilityLiveRegion="polite" style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>Couldn&apos;t refresh notes.</Text>
            <BookButton label="Try again" variant="text" onPress={onRetry} />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.notes, { borderColor: colors.divider }]}>
      <View testID="book-notes-header" style={styles.notesHeader}>
        <Text role="heading" aria-level={2} accessibilityRole="header" style={[LIBRARY_TEXT.heading, { color: colors.textPrimary }]}>
          Your notes
        </Text>
        {hasData && notes.length > 0 ? (
          <Text style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>
            {`${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`}
          </Text>
        ) : null}
      </View>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  notes: {
    marginTop: LIBRARY_SPACING.lg,
    paddingTop: LIBRARY_SPACING.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  notesHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: LIBRARY_SPACING.xs,
    marginBottom: LIBRARY_SPACING.md,
  },
  passages: {
    gap: LIBRARY_SPACING.lg,
  },
  passage: {
    gap: LIBRARY_SPACING.xxs,
  },
});
