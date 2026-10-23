import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LIBRARY_RADIUS, LIBRARY_SPACING, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';
import { DIALOG_MAX_WIDTH } from '../bookDetails/bookDetailsTokens';
import { BookButton, BookFeedbackSlot } from '../ui';
import { NoteDeckOrder } from '@/features/books/notes/manualNoteContract';

const ORDER_CHOICES: readonly { value: NoteDeckOrder; label: string }[] = [
  { value: 'shuffle', label: 'Shuffle' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
];

export function NoteOrderMenu({ visible, order, onSelect, onClose }: {
  visible: boolean; order: NoteDeckOrder; onSelect: (order: NoteDeckOrder) => void; onClose: () => void;
}) {
  const colors = useLibraryAppearance();
  const closeRef = useRef<View>(null);
  const choicesRef = useRef<(View | null)[]>([]);
  const [tabStop, setTabStop] = useState(order);
  useEffect(() => { setTabStop(order); }, [order, visible]);
  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [visible, onClose]);
  if (!visible) return null;
  return <Modal visible transparent animationType="fade" accessible role="dialog" aria-modal onRequestClose={onClose}
    onShow={() => {
      if (Platform.OS === 'web') {
        closeRef.current?.focus();
      } else {
        const node = findNodeHandle(closeRef.current);
        if (node) AccessibilityInfo.setAccessibilityFocus(node);
      }
    }}>
    <GestureHandlerRootView style={styles.root}>
      <Pressable testID="note-order-backdrop" accessible={false} tabIndex={-1} onPress={onClose} style={[styles.scrim, { backgroundColor: colors.overlay }]}>
        <Pressable accessible={false} focusable={false} tabIndex={-1} accessibilityViewIsModal onPress={event => event.stopPropagation()} style={[styles.dialog, { backgroundColor: colors.bgRaised }]}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text accessibilityRole="header" style={[LIBRARY_TEXT.heading, { color: colors.textPrimary }]}>Order</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel="Order">
              {ORDER_CHOICES.map((choice, index) => {
                const checked = order === choice.value;
                // Capture activation before RN Web's Enter responder, so it cannot
                // select a radio a second time on keyup. Keep BookButton's primary.
                const onKeyDownCapture = (event: { key: string; repeat?: boolean; preventDefault: () => void; stopPropagation: () => void }) => {
                  const key = event.key;
                  if (key === ' ' || key === 'Enter') {
                    event.preventDefault(); event.stopPropagation();
                    if (!event.repeat) onSelect(choice.value);
                  } else if (['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(key)) {
                    event.preventDefault(); event.stopPropagation();
                    const next = (index + (key === 'ArrowDown' || key === 'ArrowRight' ? 1 : ORDER_CHOICES.length - 1)) % ORDER_CHOICES.length;
                    setTabStop(ORDER_CHOICES[next].value);
                    choicesRef.current[next]?.focus();
                  }
                };
                return <View key={choice.value} {...(Platform.OS === 'web' ? { onKeyDownCapture, onFocus: () => setTabStop(choice.value) } : {})}>
                  <BookButton ref={node => {
                    choicesRef.current[index] = node;
                    // On web the native ref is the radio's DOM node. Scope its tab
                    // stop here without changing the shared BookButton contract.
                    if (Platform.OS === 'web' && node) (node as unknown as { tabIndex: number }).tabIndex = tabStop === choice.value ? 0 : -1;
                  }} testID={`note-order-${choice.value}`} label={`${checked ? '✓ ' : ''}${choice.label}`}
                  accessibilityLabel={choice.label} accessibilityRole="radio" checked={checked} selected={checked}
                  variant={checked ? 'primary' : 'secondary'} onPress={() => onSelect(choice.value)} />
                </View>;
              })}
            </View>
            <BookButton ref={closeRef} testID="note-order-close" label="Close" variant="text" onPress={onClose} />
          </ScrollView>
          <BookFeedbackSlot />
        </Pressable>
      </Pressable>
    </GestureHandlerRootView>
  </Modal>;
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  scrim: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: LIBRARY_SPACING.md },
  dialog: { width: '100%', maxHeight: '90%', alignSelf: 'center', maxWidth: DIALOG_MAX_WIDTH, borderRadius: LIBRARY_RADIUS.dialog, padding: LIBRARY_SPACING.lg },
  content: { gap: LIBRARY_SPACING.md },
});
