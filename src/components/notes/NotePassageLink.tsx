import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import { bookNoteDate } from '@/components/library/bookDetails/NotePassages';
import { NOTE_PREVIEW_LINES } from '@/components/library/bookDetails/bookDetailsTokens';
import { categoryLabel, type ManualNote } from '@/features/books/notes/manualNoteContract';

interface NotePassageLinkProps {
  note: ManualNote;
  onPress: () => void;
  testID?: string;
}

/** Flow B reading passage: one pressable serif passage per note (role=link). */
export function NotePassageLink({ note, onPress, testID }: NotePassageLinkProps) {
  const colors = useLibraryAppearance();
  const [focused, setFocused] = useState(false);
  const meta = [
    note.tag ? categoryLabel(note.tag) : null,
    note.page_number == null ? null : `p. ${note.page_number}`,
    bookNoteDate(note.created_at),
  ]
    .filter(Boolean)
    .join(' · ');
  const label = `${note.tag ? categoryLabel(note.tag) : 'Note'}${note.page_number == null ? '' : `, page ${note.page_number}`}, ${bookNoteDate(note.created_at)}: ${note.content.slice(0, 80)}`;

  return (
    <View style={[styles.row, { borderColor: colors.divider }]}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        onPress={onPress}
        onLongPress={onPress}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        testID={testID}
        style={[
          styles.passage,
          Platform.OS === 'web' && focused && [styles.focusRing, { outlineColor: colors.focusRing }],
        ]}
      >
        <Text testID={testID ? `${testID}-meta` : undefined} style={[LIBRARY_TEXT.caption, { color: colors.textTertiary }]}>
          {meta}
        </Text>
        <Text
          testID={testID ? `${testID}-body` : undefined}
          numberOfLines={NOTE_PREVIEW_LINES}
          ellipsizeMode="tail"
          style={[LIBRARY_TEXT.bodySerif, { color: colors.textPrimary }]}
        >
          {note.tag === 'quote' ? `“${note.content}”` : note.content}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  passage: {
    minHeight: MIN_TARGET,
    minWidth: MIN_TARGET,
    gap: LIBRARY_SPACING.xxs,
    paddingVertical: LIBRARY_SPACING.sm,
    borderRadius: LIBRARY_RADIUS.control,
  },
  focusRing: {
    outlineWidth: 2,
    outlineOffset: 2,
    outlineStyle: 'solid',
  },
});
