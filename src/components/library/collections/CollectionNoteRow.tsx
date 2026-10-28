import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NotePassageLink } from '@/components/notes/NotePassageLink';
import type { NoteDeckCard } from '@/features/books/notes/manualNoteContract';
import { LIBRARY_SPACING, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';
import { BookButton } from '../ui';

export function CollectionNoteRow({ card, index, pending, offline, onOpen, onRemove }: { card: NoteDeckCard; index: number; pending: boolean; offline: boolean; onOpen: () => void; onRemove: () => void }) {
  const colors = useLibraryAppearance();
  return <View style={styles.row}>
    <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>{card.book.title}</Text>
    <NotePassageLink note={card.note} onPress={onOpen} testID={`collection-note-${card.note.id}`} />
    <BookButton label={pending ? 'Removing…' : 'Remove'} accessibilityLabel={`Remove note ${index + 1} from collection: ${card.book.title}. ${card.note.content}`} variant="text" disabled={pending || offline} onPress={onRemove} />
  </View>;
}
const styles = StyleSheet.create({ row: { gap: LIBRARY_SPACING.xs, paddingBottom: LIBRARY_SPACING.md } });
