import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { BookButton, BookFeedbackSlot } from '../ui';
import { LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT, LIBRARY_TEXT_BASE } from '../LibraryTypography';
import { categoryLabel, NoteDeckCard } from '@/features/books/notes/manualNoteContract';
import { NOTE_SWIPE } from '@/features/books/notes/noteSwipeConstants';

export function NoteFullNoteSheet({ card, onClose, onOpenNote, onOpenBook, reduced }: {
  card: NoteDeckCard | null; onClose: () => void; onOpenNote: () => void; onOpenBook: () => void; reduced: boolean;
}) {
  const colors = useLibraryAppearance();
  const screen = useWindowDimensions();
  const [atTop, setAtTop] = useState(true);
  const closeRef = useRef<View>(null);
  const cardId = card?.note.id;
  // Reset the scroll flag on every opening so a reopened short note never inherits a stuck not-at-top.
  useEffect(() => { setAtTop(true); }, [cardId]);
  void atTop;
  useEffect(() => {
    if (!card || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [card, onClose]);
  // The header grabber dismisses regardless of the ScrollView position; atTop only tracks the scroll view.
  const pan = Gesture.Pan().minDistance(NOTE_SWIPE.axisLock).runOnJS(true).onEnd(event => {
    const threshold = screen.height * NOTE_SWIPE.verticalFraction;
    if (event.translationY > NOTE_SWIPE.axisLock && (event.translationY >= threshold || event.velocityY > NOTE_SWIPE.velocity)) onClose();
  });
  const scrollNative = Gesture.Native();
  if (!card) return null;
  return <Modal visible transparent animationType={reduced ? 'none' : 'slide'} onRequestClose={onClose}
    onShow={() => { if (Platform.OS === 'web') closeRef.current?.focus(); }}>
    <GestureHandlerRootView style={styles.root}>
      <View style={[styles.scrim, { backgroundColor: colors.overlay }]}>
        <View testID="note-full-sheet" accessibilityViewIsModal aria-modal={true} role={Platform.OS === 'web' ? 'dialog' : undefined} accessibilityLabel="Full note" style={[styles.panel, { backgroundColor: colors.bgRaised }]}>
          <GestureDetector gesture={pan}><View collapsable={false} testID="note-sheet-handle" style={styles.handle}>
            <View testID="note-sheet-grabber" accessible={false} aria-hidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={[styles.grabber, { backgroundColor: colors.controlBorder }]} />
            <BookButton ref={closeRef} label="Close" accessibilityLabel="Close full note" variant="text" labelLineHeight={LIBRARY_TEXT_BASE.label.lineHeight} onPress={onClose} />
          </View></GestureDetector>
          <GestureDetector gesture={scrollNative}><ScrollView style={styles.scroll} contentContainerStyle={styles.content} scrollEventThrottle={16}
            onScroll={event => setAtTop(event.nativeEvent.contentOffset.y <= 0)}>
            <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>{[card.note.tag ? categoryLabel(card.note.tag) : null, card.note.page_number == null ? null : `Page ${card.note.page_number}`].filter(Boolean).join(' · ')}</Text>
            <Text selectable style={[LIBRARY_TEXT.bodySerif, { color: colors.textPrimary }]}>{card.note.content}</Text>
            <Text style={[LIBRARY_TEXT.heading, { color: colors.textPrimary }]}>{card.book.title}</Text>
            <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>{card.book.authors.join(', ')}</Text>
            <BookButton label="Open note" variant="primary" onPress={onOpenNote} />
            <BookButton label="Open book" variant="text" onPress={onOpenBook} />
          </ScrollView></GestureDetector>
          <BookFeedbackSlot />
        </View>
      </View>
    </GestureHandlerRootView>
  </Modal>;
}
const styles = StyleSheet.create({
  root: { flex: 1 }, scrim: { flex: 1, justifyContent: 'flex-end' },
  panel: { maxHeight: '90%', borderTopLeftRadius: LIBRARY_RADIUS.dialog, borderTopRightRadius: LIBRARY_RADIUS.dialog, paddingBottom: LIBRARY_SPACING.lg },
  handle: { minHeight: MIN_TARGET, alignItems: 'center', justifyContent: 'center', paddingHorizontal: LIBRARY_SPACING.sm, gap: LIBRARY_SPACING.xs },
  grabber: { width: 36, height: 4, borderRadius: 2, opacity: 0.6 },
  scroll: { flexShrink: 1 },
  content: { padding: LIBRARY_SPACING.lg, gap: LIBRARY_SPACING.md },
});
