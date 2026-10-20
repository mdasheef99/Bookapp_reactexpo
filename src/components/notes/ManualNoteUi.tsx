import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import { BookButton, BookLoading, BookScreenHeader } from '@/components/library/ui';
import type { BookLoadingVariant } from '@/components/library/ui';
import { COLUMN_MAX_WIDTH, CONTROL_DISABLED_OPACITY, CONTROL_FOCUS_RING, DIALOG_MAX_WIDTH } from '@/components/library/bookDetails/bookDetailsTokens';
import { NOTE_CATEGORIES, NoteCategory, NoteFields, validateNote } from '@/features/books/notes/manualNoteContract';
import { getWordCount, NOTE_WORD_LIMIT } from '@/features/books/utils/ocrWordCap';

// SDD-07 FU-1b: the notes screens read the book-section palette directly. Each former
// colour source names the token it replaced, so the merge stays auditable:
//   screen surface ............ bgPrimary        selected chip fill ........ chipSelectedBackground
//   card / input surface ...... bgCard           selected chip ink ......... chipSelectedText
//   body / title ink ......... textPrimary      secondary ink ............. textSecondary
//   spinner .................. accent            error ink .................. error
//   input / chip boundary .... controlBorder     footer hairline ........... divider
//   dialog surface ........... bgRaised          dialog scrim .............. overlay
// SDD-07 FU-4a: the button (accent fill, textOnAccent ink, controlBorder boundary) and the
// header (accent back link, divider hairline) are painted by BookButton and BookScreenHeader
// in src/components/library/ui; NoteButton and the NoteScreen header only delegate to them.
// SDD-07 Flow B: NoteDialog Keep is a secondary BookButton and the confirm variant comes
// from the spec; NoteLoading delegates to BookLoading; all type comes from LIBRARY_TEXT.
export function NoteButton({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <BookButton label={label} variant={secondary ? 'secondary' : 'primary'} onPress={onPress} disabled={disabled} />;
}
export function NoteScreen({ title, bookTitle, backLabel, backAccessibilityLabel, onBack, children, footer, scrollChrome = false }: { title?: string; bookTitle?: string; backLabel: string; backAccessibilityLabel?: string; onBack: () => void; footer?: React.ReactNode; scrollChrome?: boolean; children?: React.ReactNode | ((header: React.ReactNode, footer: React.ReactNode) => React.ReactNode) }) {
  const colors = useLibraryAppearance(); const insets = useSafeAreaInsets();
  const header = <BookScreenHeader title={title} bookTitle={bookTitle} backLabel={backLabel} backAccessibilityLabel={backAccessibilityLabel} onBack={onBack} />;
  const actions = footer ? <View style={[ui.footer, { backgroundColor: colors.bgPrimary, borderColor: colors.divider, paddingBottom: Math.max(insets.bottom, LIBRARY_SPACING.sm) }]}>{footer}</View> : null;
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bgPrimary }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    {!scrollChrome && header}
    <View style={{ flex: 1 }}>{typeof children === 'function' ? children(scrollChrome ? header : null, scrollChrome ? actions : null) : children}</View>
    {!scrollChrome && actions}
  </KeyboardAvoidingView>;
}
export function NoteMessage({ message, error = false, caption = false }: { message: string; error?: boolean; caption?: boolean }) {
  const colors = useLibraryAppearance();
  return <Text accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[caption ? LIBRARY_TEXT.caption : LIBRARY_TEXT.body, { color: error ? colors.error : colors.textSecondary }]}>{message}</Text>;
}
// SDD-07 Flow B (D07-04): one chip radio group everywhere a category is chosen or filtered. The
// group is a radiogroup with a single tab stop (the checked chip); arrow keys move and select,
// like Flow A's ChoiceRadioGroup. "No category" replaces the former Skip / Change category controls.
export function CategoryPicker({ selected, onChange, includeAll = false, includeNone = false, label, disabled = false }: {
  selected: NoteCategory | null; onChange: (category: NoteCategory | null) => void; includeAll?: boolean; includeNone?: boolean; label?: string; disabled?: boolean;
}) {
  const colors = useLibraryAppearance();
  const [focused, setFocused] = useState<number | null>(null);
  const refs = useRef<(View | null)[]>([]);
  const lead = includeAll ? [{ value: null, label: 'All' }] : includeNone ? [{ value: null, label: 'No category' }] : [];
  const choices: readonly { value: NoteCategory | null; label: string }[] = [...lead, ...NOTE_CATEGORIES];
  const checkedIndex = choices.findIndex(choice => choice.value === selected);
  const tabStop = checkedIndex < 0 ? 0 : checkedIndex;
  const groupLabel = label ?? (includeAll ? 'Filter notes' : 'Category, optional');
  const choose = (value: NoteCategory | null) => { if (!disabled) onChange(value); };
  return <View style={[ui.categories, disabled && { opacity: CONTROL_DISABLED_OPACITY }]} accessibilityRole="radiogroup" accessibilityLabel={groupLabel}
    accessibilityState={{ disabled }} aria-disabled={disabled}>
    {choices.map((choice, index) => {
      const checked = selected === choice.value;
      const onKeyDown = (event: { key?: string; nativeEvent?: { key: string }; target?: unknown; currentTarget?: unknown; repeat?: boolean; preventDefault: () => void }) => {
        const key = event.nativeEvent?.key ?? event.key;
        if (disabled) return;
        // RN Web's responder handles Enter, but only handles Space for button roles.
        if (key === ' ' && event.target === event.currentTarget) {
          event.preventDefault();
          if (!event.repeat) choose(choice.value);
          return;
        }
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key ?? '')) return;
        event.preventDefault();
        const next = (index + (key === 'ArrowRight' || key === 'ArrowDown' ? 1 : choices.length - 1)) % choices.length;
        choose(choices[next].value);
        refs.current[next]?.focus();
      };
      return <Pressable key={choice.value ?? 'none'} ref={node => { refs.current[index] = node; }} accessibilityRole="radio" accessibilityLabel={choice.label}
        aria-checked={checked} {...(disabled ? { "aria-disabled": true } : {})} accessibilityState={{ selected: checked, checked, ...(disabled ? { disabled } : {}) }} {...(disabled ? { disabled } : {})}
        tabIndex={!disabled && index === tabStop ? 0 : -1} onPress={() => choose(choice.value)}
        onFocus={() => setFocused(index)} onBlur={() => setFocused(null)}
        {...(Platform.OS === 'web' ? { onKeyDown } : {})}
        style={[ui.category, { backgroundColor: checked ? colors.chipSelectedBackground : colors.bgCard, borderColor: colors.controlBorder },
          Platform.OS === 'web' && focused === index && [CONTROL_FOCUS_RING, { outlineColor: colors.focusRing }]]}>
        <Text style={[LIBRARY_TEXT.label, { color: checked ? colors.chipSelectedText : colors.textPrimary }]}>{checked ? '✓ ' : ''}{choice.label}</Text>
      </Pressable>;
    })}
  </View>;
}
// Live word count under the note text (SDD-07 §6 Flow B): the limit is visible before Save.
// The count and changing overflow copy stay quiet; NoteForm announces threshold crossings.
export function NoteWordCount({ text }: { text: string }) {
  const colors = useLibraryAppearance();
  const words = getWordCount(text);
  const over = words > NOTE_WORD_LIMIT;
  return <Text testID="note-word-count" style={[LIBRARY_TEXT.caption, { color: over ? colors.error : colors.textSecondary }]}>
    {words} / {NOTE_WORD_LIMIT} words
  </Text>;
}
export function NoteForm({ fields, onChange, locked, showErrors, saveAttempt = showErrors ? 1 : 0, inputRef, pageRef, onFocusField, onSelectionChange, selection }: {
  fields: NoteFields; onChange: (fields: NoteFields) => void; locked: boolean; showErrors: boolean; inputRef?: React.Ref<TextInput>;
  saveAttempt?: number;
  pageRef?: React.Ref<TextInput>; onFocusField?: (field: 'text' | 'page') => void;
  onSelectionChange?: (selection: { start: number; end: number }) => void; selection?: { start: number; end: number };
}) {
  const colors = useLibraryAppearance(); const validation = validateNote(fields);
  const overLimit = getWordCount(fields.text) > NOTE_WORD_LIMIT;
  const wasOverLimit = useRef(false);
  const previousSaveAttempt = useRef(0);
  const [overflowAnnouncement, setOverflowAnnouncement] = useState('');
  useEffect(() => {
    if (overLimit && (!wasOverLimit.current || saveAttempt !== previousSaveAttempt.current) && validation.errors.text) {
      setOverflowAnnouncement(validation.errors.text);
      if (Platform.OS !== 'web' && !showErrors) AccessibilityInfo.announceForAccessibility(validation.errors.text);
    } else if (!overLimit) setOverflowAnnouncement('');
    wasOverLimit.current = overLimit;
    previousSaveAttempt.current = saveAttempt;
  }, [overLimit, showErrors, saveAttempt, validation.errors.text]);
  return <View style={ui.form}>
    <Text style={[ui.label, { color: colors.textPrimary }]}>Category (optional)</Text>
    <CategoryPicker selected={fields.category} includeNone disabled={locked} onChange={category => onChange({ ...fields, category })} />
    <Text style={[ui.label, { color: colors.textPrimary }]}>Note text</Text>
    {locked ? <Text selectable accessibilityLabel="Submitted note text" style={[ui.input, ui.textArea, { color: colors.textPrimary, backgroundColor: colors.bgCard, borderColor: colors.controlBorder }]}>{fields.text}</Text>
      : <TextInput ref={inputRef} accessibilityLabel="Note text" multiline value={fields.text} onChangeText={text => onChange({ ...fields, text })}
        onFocus={() => onFocusField?.('text')} selection={selection} onSelectionChange={event => onSelectionChange?.(event.nativeEvent.selection)}
        style={[ui.input, ui.textArea, { color: colors.textPrimary, backgroundColor: colors.bgCard, borderColor: colors.controlBorder }]} textAlignVertical="top" />}
    {!locked && <NoteWordCount text={fields.text} />}
    {/* Latch live copy on crossings and Save attempts; changing visible counts stay quiet. */}
    {(Platform.OS === 'web' || (showErrors && overLimit)) && <Text key={saveAttempt} testID="note-overflow-announcement" accessibilityRole={showErrors && overLimit ? 'alert' : undefined} accessibilityLiveRegion="polite" style={ui.announcement}>{overflowAnnouncement}</Text>}
    {validation.errors.text && (overLimit ? <Text style={[LIBRARY_TEXT.body, { color: colors.error }]}>{validation.errors.text}</Text>
      : showErrors && <NoteMessage message={validation.errors.text} error />)}
    <Text style={[ui.label, { color: colors.textPrimary }]}>Page (optional)</Text>
    {locked ? <Text selectable style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}>{fields.page || 'No page specified'}</Text>
      : <TextInput ref={pageRef} accessibilityLabel="Page, optional" value={fields.page} keyboardType="number-pad" onFocus={() => onFocusField?.('page')} onChangeText={page => onChange({ ...fields, page })}
        style={[ui.input, { color: colors.textPrimary, backgroundColor: colors.bgCard, borderColor: colors.controlBorder }]} />}
    {showErrors && validation.errors.page && <NoteMessage message={validation.errors.page} error />}
  </View>;
}
export interface NoteDialogSpec { title: string; message: string; keep: string; confirm: string; confirmVariant?: 'primary' | 'destructive'; action: () => void }
export function NoteDialog({ spec, onKeep, onDismiss, confirmDisabled = false }: { spec: NoteDialogSpec | null; onKeep: () => void; onDismiss?: () => void; confirmDisabled?: boolean }) {
  const colors = useLibraryAppearance(); const keepRef = useRef<View>(null);
  return <Modal visible={!!spec} transparent animationType="none"
    {...(Platform.OS === 'web' ? { accessible: true, role: 'dialog' as const, 'aria-modal': true, accessibilityLabel: spec?.title } : {})}
    onRequestClose={onKeep} onDismiss={onDismiss} onShow={() => {
    if (Platform.OS !== 'web') { const node = findNodeHandle(keepRef.current); if (node) AccessibilityInfo.setAccessibilityFocus(node); }
  }}>
    <Pressable style={[ui.shade, { backgroundColor: colors.overlay }]} onPress={onKeep} accessible={false}>
      <Pressable accessibilityViewIsModal accessibilityLabel={spec?.title} onPress={event => event.stopPropagation()} style={[ui.dialog, { backgroundColor: colors.bgRaised }]}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: LIBRARY_SPACING.sm }}>
        <Text accessibilityRole="header" style={[ui.title, { color: colors.textPrimary }]}>{spec?.title}</Text>
        <NoteMessage message={spec?.message ?? ''} />
        <BookButton ref={keepRef} label={spec?.keep ?? ''} variant="secondary" onPress={onKeep} />
        <BookButton label={spec?.confirm ?? ''} variant={spec?.confirmVariant ?? 'primary'} disabled={confirmDisabled} onPress={() => { if (!confirmDisabled) spec?.action(); }} />
        </ScrollView>
      </Pressable>
    </Pressable>
  </Modal>;
}
export function NoteLoading({ variant = 'note' }: { variant?: BookLoadingVariant } = {}) {
  return <BookLoading variant={variant} label={variant === 'list' ? 'Loading notes' : 'Loading note'} />;
}
export { ScrollView };
export const ui = StyleSheet.create({
  title: { ...LIBRARY_TEXT.heading },
  footer: { padding: LIBRARY_SPACING.md, gap: LIBRARY_SPACING.xs, borderTopWidth: 1 }, form: { gap: LIBRARY_SPACING.sm }, metadata: { flexDirection: 'row', flexWrap: 'wrap', gap: LIBRARY_SPACING.xs, alignItems: 'center' },
  label: { ...LIBRARY_TEXT.label }, input: { minHeight: MIN_TARGET, borderRadius: LIBRARY_RADIUS.control, borderWidth: 1, padding: LIBRARY_SPACING.sm, ...LIBRARY_TEXT.body }, textArea: { minHeight: 240, ...LIBRARY_TEXT.bodySerif },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: LIBRARY_SPACING.xs }, category: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, paddingHorizontal: LIBRARY_SPACING.sm, paddingVertical: LIBRARY_SPACING.xs, borderWidth: 1, borderRadius: LIBRARY_RADIUS.chip, justifyContent: 'center' },
  content: { width: '100%', maxWidth: COLUMN_MAX_WIDTH, alignSelf: 'center', padding: LIBRARY_SPACING.lg, gap: LIBRARY_SPACING.md, paddingBottom: LIBRARY_SPACING.xl }, message: { ...LIBRARY_TEXT.body }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: LIBRARY_SPACING.lg, gap: LIBRARY_SPACING.sm },
  announcement: { position: 'absolute', width: StyleSheet.hairlineWidth, height: StyleSheet.hairlineWidth, overflow: 'hidden' },
  shade: { flex: 1, justifyContent: 'center', padding: LIBRARY_SPACING.lg }, dialog: { padding: LIBRARY_SPACING.lg, borderRadius: LIBRARY_RADIUS.dialog, gap: LIBRARY_SPACING.sm, maxHeight: '90%', width: '100%', maxWidth: DIALOG_MAX_WIDTH, alignSelf: 'center' },
});
