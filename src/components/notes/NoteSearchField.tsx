import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import { BookButton } from '@/components/library/ui';

interface NoteSearchFieldProps {
  value: string;
  onChange: (text: string) => void;
}

export interface NoteSearchFieldRef {
  focus: () => void;
}

// SDD-10 Unit A: small library-side search field for one book's notes.
// Stable component (defined at module level) so typing never remounts the
// TextInput. Secondary/text controls only (DP-03 unchanged).
export const NoteSearchField = forwardRef<NoteSearchFieldRef, NoteSearchFieldProps>(function NoteSearchField({ value, onChange }, ref) {
  const colors = useLibraryAppearance();
  const inputRef = useRef<TextInput>(null);
  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
  }), []);
  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };
  return <View style={[styles.row, { backgroundColor: colors.bgCard, borderColor: colors.controlBorder }]}>
    <TextInput
      ref={inputRef}
      accessibilityLabel="Search this book's notes"
      placeholder="Search notes"
      placeholderTextColor={colors.textTertiary}
      value={value}
      onChangeText={onChange}
      returnKeyType="search"
      autoCorrect={false}
      style={[LIBRARY_TEXT.body, styles.input, { color: colors.textPrimary }]}
    />
    {value.length > 0 && <BookButton label="×" accessibilityLabel="Clear search text" variant="text" onPress={handleClear} />}
  </View>;
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LIBRARY_SPACING.xs,
    borderWidth: 1,
    borderRadius: LIBRARY_RADIUS.control,
    paddingLeft: LIBRARY_SPACING.sm,
    paddingRight: LIBRARY_SPACING.xs,
    paddingVertical: LIBRARY_SPACING.xs,
    minHeight: MIN_TARGET,
  },
  input: {
    flex: 1,
    minHeight: MIN_TARGET,
  },
});
