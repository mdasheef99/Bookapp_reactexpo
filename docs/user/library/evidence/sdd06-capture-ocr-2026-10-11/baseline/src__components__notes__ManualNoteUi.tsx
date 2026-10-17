import React, { useRef } from 'react';
import { AccessibilityInfo, ActivityIndicator, findNodeHandle, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { categoryLabel, NOTE_CATEGORIES, NoteCategory, NoteFields, validateNote } from '@/features/books/notes/manualNoteContract';

export function useNoteColors() {
  const { colors, phase } = useTheme();
  return { ...colors, bgPrimary: phase === 'midnight' ? '#13221C' : '#FAF7EF', bgCard: phase === 'midnight' ? '#20342A' : '#FFFFFF',
    accent: phase === 'midnight' ? '#ACE0BD' : '#24543C', textSecondary: phase === 'midnight' ? '#CCDACF' : '#48594C',
    error: phase === 'midnight' ? '#FFA8A0' : '#B42318',
    border: phase === 'midnight' ? '#91A898' : '#819283' };
}
export function NoteButton({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  const colors = useNoteColors();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [ui.button, { backgroundColor: secondary ? colors.bgCard : colors.accent, borderColor: colors.border, opacity: disabled ? 0.55 : pressed ? 0.8 : 1 }]}>
    <Text style={[ui.buttonText, { color: secondary ? colors.textPrimary : colors.bgPrimary }]}>{label}</Text>
  </Pressable>;
}
export function NoteScreen({ title, bookTitle, backLabel, onBack, children, footer }: React.PropsWithChildren<{ title: string; bookTitle?: string; backLabel: string; onBack: () => void; footer?: React.ReactNode }>) {
  const colors = useNoteColors(); const insets = useSafeAreaInsets();
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bgPrimary }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={[ui.header, { paddingTop: insets.top + 8, borderColor: colors.border }]}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={backLabel} style={ui.back}><Text style={[ui.link, { color: colors.accent }]}>‹ {backLabel}</Text></Pressable>
      <Text accessibilityRole="header" style={[ui.title, { color: colors.textPrimary }]}>{title}</Text>
      {!!bookTitle && <Text style={[ui.book, { color: colors.textSecondary }]}>{bookTitle}</Text>}
    </View>
    <View style={{ flex: 1 }}>{children}</View>
    {!!footer && <View style={[ui.footer, { backgroundColor: colors.bgPrimary, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>{footer}</View>}
  </KeyboardAvoidingView>;
}
export function NoteMessage({ message, error = false }: { message: string; error?: boolean }) {
  const colors = useNoteColors();
  return <Text accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[ui.message, { color: error ? colors.error : colors.textSecondary }]}>{message}</Text>;
}
export function CategoryPicker({ selected, onChange, includeAll = false }: { selected: NoteCategory | null; onChange: (category: NoteCategory | null) => void; includeAll?: boolean }) {
  const colors = useNoteColors();
  const choices = includeAll ? [{ value: null, label: 'All' }, ...NOTE_CATEGORIES] : NOTE_CATEGORIES;
  return <View style={ui.categories} accessibilityLabel={includeAll ? 'Filter notes' : 'Category, optional'}>
    {choices.map(choice => <Pressable key={choice.value ?? 'all'} accessibilityRole="radio" accessibilityLabel={choice.label}
      accessibilityState={{ selected: selected === choice.value, checked: selected === choice.value }} onPress={() => onChange(choice.value)}
      style={[ui.category, { backgroundColor: selected === choice.value ? colors.accent : colors.bgCard, borderColor: colors.border }]}>
      <Text style={{ fontSize: 15, fontWeight: '600', color: selected === choice.value ? colors.bgPrimary : colors.textPrimary }}>{selected === choice.value ? '✓ ' : ''}{choice.label}</Text>
    </Pressable>)}
  </View>;
}
export function NoteForm({ fields, onChange, locked, showErrors, onCategory, inputRef }: {
  fields: NoteFields; onChange: (fields: NoteFields) => void; locked: boolean; showErrors: boolean; onCategory: () => void; inputRef?: React.Ref<TextInput>;
}) {
  const colors = useNoteColors(); const validation = validateNote(fields);
  return <View style={ui.form}>
    <View style={ui.metadata}><Text style={{ flex: 1, color: colors.textSecondary, fontSize: 16 }}>Category: {categoryLabel(fields.category)}</Text>
      <NoteButton label="Change category" secondary disabled={locked} onPress={onCategory} />
    </View>
    <Text style={[ui.label, { color: colors.textPrimary }]}>Note text</Text>
    {locked ? <Text selectable accessibilityLabel="Submitted note text" style={[ui.input, ui.textArea, { color: colors.textPrimary, backgroundColor: colors.bgCard, borderColor: colors.border }]}>{fields.text}</Text>
      : <TextInput ref={inputRef} accessibilityLabel="Note text" multiline value={fields.text} onChangeText={text => onChange({ ...fields, text })}
        style={[ui.input, ui.textArea, { color: colors.textPrimary, backgroundColor: colors.bgCard, borderColor: colors.border }]} textAlignVertical="top" />}
    {showErrors && validation.errors.text && <NoteMessage message={validation.errors.text} error />}
    <Text style={[ui.label, { color: colors.textPrimary }]}>Page (optional)</Text>
    {locked ? <Text selectable style={{ color: colors.textPrimary, fontSize: 17 }}>{fields.page || 'No page specified'}</Text>
      : <TextInput accessibilityLabel="Page, optional" value={fields.page} keyboardType="number-pad" onChangeText={page => onChange({ ...fields, page })}
        style={[ui.input, { color: colors.textPrimary, backgroundColor: colors.bgCard, borderColor: colors.border }]} />}
    {showErrors && validation.errors.page && <NoteMessage message={validation.errors.page} error />}
  </View>;
}
export interface NoteDialogSpec { title: string; message: string; keep: string; confirm: string; action: () => void }
export function NoteDialog({ spec, onKeep, onDismiss }: { spec: NoteDialogSpec | null; onKeep: () => void; onDismiss?: () => void }) {
  const colors = useNoteColors(); const keepRef = useRef<View>(null);
  return <Modal visible={!!spec} transparent animationType="none" onRequestClose={onKeep} onDismiss={onDismiss} onShow={() => {
    if (Platform.OS !== 'web') { const node = findNodeHandle(keepRef.current); if (node) AccessibilityInfo.setAccessibilityFocus(node); }
  }}>
    <Pressable style={ui.shade} onPress={onKeep} accessible={false}>
      <Pressable accessibilityViewIsModal onPress={event => event.stopPropagation()} style={[ui.dialog, { backgroundColor: colors.bgCard }]}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>
        <Text accessibilityRole="header" style={[ui.title, { color: colors.textPrimary }]}>{spec?.title}</Text>
        <NoteMessage message={spec?.message ?? ''} />
        <Pressable ref={keepRef} accessibilityRole="button" onPress={onKeep} style={[ui.button, { borderColor: colors.border }]}><Text style={[ui.buttonText, { color: colors.textPrimary }]}>{spec?.keep}</Text></Pressable>
        <NoteButton label={spec?.confirm ?? ''} onPress={() => spec?.action()} />
        </ScrollView>
      </Pressable>
    </Pressable>
  </Modal>;
}
export function NoteLoading() { const colors = useNoteColors(); return <View style={ui.center}><ActivityIndicator accessibilityLabel="Loading notes" color={colors.accent} /></View>; }
export { ScrollView };
export const ui = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, gap: 8 }, back: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { fontSize: 16, fontWeight: '600' }, title: { fontSize: 25, fontWeight: '700' }, book: { fontSize: 16, lineHeight: 24 },
  footer: { padding: 16, gap: 8, borderTopWidth: 1 }, button: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600', textAlign: 'center' }, form: { gap: 12 }, metadata: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  label: { fontSize: 16, fontWeight: '600' }, input: { minHeight: 48, borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 17 }, textArea: { minHeight: 240, lineHeight: 27 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, category: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderRadius: 24, justifyContent: 'center' },
  content: { padding: 20, gap: 18, paddingBottom: 32 }, message: { fontSize: 15, lineHeight: 23, paddingVertical: 6 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  shade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 }, dialog: { padding: 24, borderRadius: 18, gap: 12, maxHeight: '90%' },
});
