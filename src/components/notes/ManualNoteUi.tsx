import React, { useRef } from 'react';
import { AccessibilityInfo, ActivityIndicator, findNodeHandle, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { BookButton, BookScreenHeader } from '@/components/library/ui';
import { categoryLabel, NOTE_CATEGORIES, NoteCategory, NoteFields, validateNote } from '@/features/books/notes/manualNoteContract';

// SDD-07 FU-1b: the notes screens read the book-section palette directly. Each former
// colour source names the token that replaced it, so the merge stays auditable:
//   screen surface ............ bgPrimary        selected chip fill ........ chipSelectedBackground
//   card / input surface ...... bgCard           selected chip ink ......... chipSelectedText
//   body / title ink ......... textPrimary      secondary ink ............. textSecondary
//   spinner .................. accent            error ink .................. error
//   input / chip boundary .... controlBorder     footer hairline ........... divider
//   dialog surface ........... bgRaised          dialog scrim .............. overlay
// SDD-07 FU-4a: the button (accent fill, textOnAccent ink, controlBorder boundary) and the
// header (accent back link, divider hairline) are painted by BookButton and BookScreenHeader
// in src/components/library/ui; NoteButton and the NoteScreen header only delegate to them.
export function NoteButton({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <BookButton label={label} variant={secondary ? 'secondary' : 'primary'} onPress={onPress} disabled={disabled} />;
}
export function NoteScreen({ title, bookTitle, backLabel, onBack, children, footer, scrollChrome = false }: { title: string; bookTitle?: string; backLabel: string; onBack: () => void; footer?: React.ReactNode; scrollChrome?: boolean; children?: React.ReactNode | ((header: React.ReactNode, footer: React.ReactNode) => React.ReactNode) }) {
  const colors = useLibraryAppearance(); const insets = useSafeAreaInsets();
  const header = <BookScreenHeader title={title} bookTitle={bookTitle} backLabel={backLabel} onBack={onBack} />;
  const actions = footer ? <View style={[ui.footer, { backgroundColor: colors.bgPrimary, borderColor: colors.divider, paddingBottom: Math.max(insets.bottom, 12) }]}>{footer}</View> : null;
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bgPrimary }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    {!scrollChrome && header}
    <View style={{ flex: 1 }}>{typeof children === 'function' ? children(scrollChrome ? header : null, scrollChrome ? actions : null) : children}</View>
    {!scrollChrome && actions}
  </KeyboardAvoidingView>;
}
export function NoteMessage({ message, error = false }: { message: string; error?: boolean }) {
  const colors = useLibraryAppearance();
  return <Text accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[ui.message, { color: error ? colors.error : colors.textSecondary }]}>{message}</Text>;
}
export function CategoryPicker({ selected, onChange, includeAll = false }: { selected: NoteCategory | null; onChange: (category: NoteCategory | null) => void; includeAll?: boolean }) {
  const colors = useLibraryAppearance();
  const choices = includeAll ? [{ value: null, label: 'All' }, ...NOTE_CATEGORIES] : NOTE_CATEGORIES;
  return <View style={ui.categories} accessibilityLabel={includeAll ? 'Filter notes' : 'Category, optional'}>
    {choices.map(choice => <Pressable key={choice.value ?? 'all'} accessibilityRole="radio" accessibilityLabel={choice.label}
      aria-checked={selected === choice.value} accessibilityState={{ selected: selected === choice.value, checked: selected === choice.value }} onPress={() => onChange(choice.value)}
      {...(Platform.OS === 'web' ? { onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        // RN Web's responder handles Enter, but only handles Space for button roles.
        if (event.key === ' ' && event.target === event.currentTarget) {
          event.preventDefault();
          if (!event.repeat) onChange(choice.value);
        }
      } } : {})}
      style={[ui.category, { backgroundColor: selected === choice.value ? colors.chipSelectedBackground : colors.bgCard, borderColor: colors.controlBorder }]}>
      <Text style={{ fontSize: 15, fontWeight: '600', color: selected === choice.value ? colors.chipSelectedText : colors.textPrimary }}>{selected === choice.value ? '✓ ' : ''}{choice.label}</Text>
    </Pressable>)}
  </View>;
}
export function NoteForm({ fields, onChange, locked, showErrors, onCategory, inputRef, pageRef, onFocusField, onSelectionChange, selection }: {
  fields: NoteFields; onChange: (fields: NoteFields) => void; locked: boolean; showErrors: boolean; onCategory: () => void; inputRef?: React.Ref<TextInput>;
  pageRef?: React.Ref<TextInput>; onFocusField?: (field: 'text' | 'page') => void;
  onSelectionChange?: (selection: { start: number; end: number }) => void; selection?: { start: number; end: number };
}) {
  const colors = useLibraryAppearance(); const validation = validateNote(fields);
  return <View style={ui.form}>
    <View style={ui.metadata}><Text style={{ flex: 1, color: colors.textSecondary, fontSize: 16 }}>Category: {categoryLabel(fields.category)}</Text>
      <NoteButton label="Change category" secondary disabled={locked} onPress={onCategory} />
    </View>
    <Text style={[ui.label, { color: colors.textPrimary }]}>Note text</Text>
    {locked ? <Text selectable accessibilityLabel="Submitted note text" style={[ui.input, ui.textArea, { color: colors.textPrimary, backgroundColor: colors.bgCard, borderColor: colors.controlBorder }]}>{fields.text}</Text>
      : <TextInput ref={inputRef} accessibilityLabel="Note text" multiline value={fields.text} onChangeText={text => onChange({ ...fields, text })}
        onFocus={() => onFocusField?.('text')} selection={selection} onSelectionChange={event => onSelectionChange?.(event.nativeEvent.selection)}
        style={[ui.input, ui.textArea, { color: colors.textPrimary, backgroundColor: colors.bgCard, borderColor: colors.controlBorder }]} textAlignVertical="top" />}
    {showErrors && validation.errors.text && <NoteMessage message={validation.errors.text} error />}
    <Text style={[ui.label, { color: colors.textPrimary }]}>Page (optional)</Text>
    {locked ? <Text selectable style={{ color: colors.textPrimary, fontSize: 17 }}>{fields.page || 'No page specified'}</Text>
      : <TextInput ref={pageRef} accessibilityLabel="Page, optional" value={fields.page} keyboardType="number-pad" onFocus={() => onFocusField?.('page')} onChangeText={page => onChange({ ...fields, page })}
        style={[ui.input, { color: colors.textPrimary, backgroundColor: colors.bgCard, borderColor: colors.controlBorder }]} />}
    {showErrors && validation.errors.page && <NoteMessage message={validation.errors.page} error />}
  </View>;
}
export interface NoteDialogSpec { title: string; message: string; keep: string; confirm: string; action: () => void }
export function NoteDialog({ spec, onKeep, onDismiss }: { spec: NoteDialogSpec | null; onKeep: () => void; onDismiss?: () => void }) {
  const colors = useLibraryAppearance(); const keepRef = useRef<View>(null);
  return <Modal visible={!!spec} transparent animationType="none" onRequestClose={onKeep} onDismiss={onDismiss} onShow={() => {
    if (Platform.OS !== 'web') { const node = findNodeHandle(keepRef.current); if (node) AccessibilityInfo.setAccessibilityFocus(node); }
  }}>
    <Pressable style={[ui.shade, { backgroundColor: colors.overlay }]} onPress={onKeep} accessible={false}>
      <Pressable accessibilityViewIsModal onPress={event => event.stopPropagation()} style={[ui.dialog, { backgroundColor: colors.bgRaised }]}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>
        <Text accessibilityRole="header" style={[ui.title, { color: colors.textPrimary }]}>{spec?.title}</Text>
        <NoteMessage message={spec?.message ?? ''} />
        <Pressable ref={keepRef} accessibilityRole="button" onPress={onKeep} style={[ui.button, { borderColor: colors.controlBorder }]}><Text style={[ui.buttonText, { color: colors.textPrimary }]}>{spec?.keep}</Text></Pressable>
        <NoteButton label={spec?.confirm ?? ''} onPress={() => spec?.action()} />
        </ScrollView>
      </Pressable>
    </Pressable>
  </Modal>;
}
export function NoteLoading() { const colors = useLibraryAppearance(); return <View style={ui.center}><ActivityIndicator accessibilityLabel="Loading notes" color={colors.accent} /></View>; }
export { ScrollView };
export const ui = StyleSheet.create({
  title: { fontSize: 25, fontWeight: '700' },
  footer: { padding: 16, gap: 8, borderTopWidth: 1 }, button: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600', textAlign: 'center' }, form: { gap: 12 }, metadata: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  label: { fontSize: 16, fontWeight: '600' }, input: { minHeight: 48, borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 17 }, textArea: { minHeight: 240, lineHeight: 27 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, category: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderRadius: 24, justifyContent: 'center' },
  content: { padding: 20, gap: 18, paddingBottom: 32 }, message: { fontSize: 15, lineHeight: 23, paddingVertical: 6 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  shade: { flex: 1, justifyContent: 'center', padding: 24 }, dialog: { padding: 24, borderRadius: 18, gap: 12, maxHeight: '90%' },
});
