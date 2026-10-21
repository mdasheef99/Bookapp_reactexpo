import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PressableStateCallbackType } from 'react-native';
import { LIBRARY_RADIUS, LIBRARY_SPACING, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';
import { ChoiceRadioGroup } from '../bookDetails/ChoiceRadioGroup';
import { DIALOG_MAX_WIDTH } from '../bookDetails/bookDetailsTokens';
import { BookButton, BookFeedbackSlot } from '../ui';
import type { NotesExportChoice } from '@/features/books/export/useExportActions';

const DESCRIPTION_ID = 'export-notes-description';
const DESCRIPTION = 'Includes private notes. Notes still saving are not included.';
const FORMATS = [{ value: 'markdown', label: 'Markdown file' }, { value: 'pdf', label: 'PDF' }] as const;
const SCOPES = [{ value: 'book', label: 'This book' }, { value: 'all', label: 'All books' }] as const;

/** Keep BookButton's variants/targets while adding semantics its public props lack.
 * The rendered Pressable is cloned, so there is still just one keyboard target. */
export function ExportButton({ accessibilityLabel, busy = false, ...props }: React.ComponentProps<typeof BookButton> & {
  accessibilityLabel?: string; busy?: boolean;
}) {
  const button = BookButton(props);
  return React.cloneElement(button, {
    accessibilityLabel: accessibilityLabel ?? props.label,
    accessibilityState: { ...button.props.accessibilityState, busy },
    'aria-busy': busy,
    style: (state: PressableStateCallbackType) => [
      typeof button.props.style === 'function' ? button.props.style(state) : button.props.style, styles.exportButton,
    ],
  });
}

export interface ExportNotesDialogProps {
  visible: boolean;
  busy: boolean;
  disabled?: boolean;
  ready?: boolean;
  onClose: () => void;
  onExport: (choice: NotesExportChoice) => void;
  onPrint?: () => void;
  onDispose?: () => void;
}

export function ExportNotesDialog({ visible, busy, disabled = false, ready = false, onClose, onExport, onPrint, onDispose }: ExportNotesDialogProps) {
  const colors = useLibraryAppearance();
  const cancelRef = useRef<View>(null);
  const [format, setFormat] = useState<NotesExportChoice['format']>('markdown');
  const [scope, setScope] = useState<NotesExportChoice['scope']>('book');
  useEffect(() => { if (visible) { setFormat('markdown'); setScope('book'); } }, [visible]);
  useEffect(() => {
    if (!visible) onDispose?.();
    return () => onDispose?.();
  }, [visible, onDispose]);
  return <Modal visible={visible} transparent animationType="fade" accessible role="dialog" aria-modal
    accessibilityLabel="Export notes" aria-describedby={DESCRIPTION_ID}
    onRequestClose={() => { if (!busy) onClose(); }}
    onShow={() => {
      if (Platform.OS === 'web') cancelRef.current?.focus();
      else {
        const node = findNodeHandle(cancelRef.current);
        if (node) AccessibilityInfo.setAccessibilityFocus(node);
      }
    }}>
    <View style={[styles.scrim, { backgroundColor: colors.overlay }]}>
      <View accessibilityViewIsModal accessibilityLabel="Export notes" aria-describedby={DESCRIPTION_ID}
        style={[styles.dialog, { backgroundColor: colors.bgRaised }]}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <BookFeedbackSlot />
          <Text accessibilityRole="header" style={[LIBRARY_TEXT.heading, { color: colors.textPrimary }]}>Export notes</Text>
          {ready ? <Text accessibilityLiveRegion="polite" style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}>Your PDF is ready. Choose Print, then Save as PDF.</Text> : <>
            <ChoiceRadioGroup label="Format" value={format} options={FORMATS} onChange={setFormat} disabled={busy} />
            <ChoiceRadioGroup label="Scope" value={scope} options={SCOPES} onChange={setScope} disabled={busy} />
          </>}
          <Text nativeID={DESCRIPTION_ID} style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>{DESCRIPTION}</Text>
          {disabled && !ready && <Text accessibilityLiveRegion="polite" style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>Export needs a connection.</Text>}
          <View style={styles.buttons}>
            {ready ? <ExportButton label="Print" variant="primary" onPress={() => { onPrint?.(); }} />
              : <ExportButton label={busy ? 'Exporting…' : 'Export'} accessibilityLabel="Export" variant="primary" busy={busy}
                disabled={busy || disabled} onPress={() => { if (!busy && !disabled) onExport({ format, scope }); }} />}
            <BookButton ref={cancelRef} label="Cancel" variant="secondary" disabled={busy} onPress={() => { if (!busy) onClose(); }} />
          </View>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  exportButton: { maxWidth: '100%', flexShrink: 1 },
  scrim: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: LIBRARY_SPACING.md },
  dialog: { width: '100%', maxHeight: '90%', alignSelf: 'center', maxWidth: DIALOG_MAX_WIDTH,
    borderRadius: LIBRARY_RADIUS.dialog, padding: LIBRARY_SPACING.lg },
  content: { gap: LIBRARY_SPACING.md },
  buttons: { gap: LIBRARY_SPACING.xs },
});
