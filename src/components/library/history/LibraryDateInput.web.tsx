import React, { type ChangeEvent, type CSSProperties } from 'react';
import { StyleSheet, View } from 'react-native';
import { LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';

export interface LibraryDateInputProps {
  label: string;
  value: string | null;
  onChange: (day: string) => void;
  disabled?: boolean;
  testID?: string;
}

export function LibraryDateInput({ label, value, onChange, disabled = false, testID }: LibraryDateInputProps) {
  const colors = useLibraryAppearance();
  const now = new Date();
  const max = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const webInputStyle: CSSProperties = {
    width: '100%',
    minHeight: MIN_TARGET,
    border: 'none',
    backgroundColor: 'transparent',
    color: colors.textPrimary,
    fontFamily: LIBRARY_TEXT.body.fontFamily,
    fontSize: LIBRARY_TEXT.body.fontSize,
    padding: LIBRARY_SPACING.sm,
    boxSizing: 'border-box',
  };

  return (
    <View
      testID={testID ? `${testID}-wrapper` : undefined}
      style={[styles.field, { backgroundColor: colors.bgSecondary, borderColor: colors.controlBorder }]}
    >
      <input
        aria-label={label}
        data-testid={testID}
        type="date"
        value={value ?? ''}
        max={max}
        disabled={disabled}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const next = event.currentTarget.value;
          if (next) onChange(next);
        }}
        style={webInputStyle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: MIN_TARGET,
    justifyContent: 'center',
    paddingHorizontal: LIBRARY_SPACING.sm,
    borderRadius: LIBRARY_RADIUS.control,
    borderWidth: 1,
  },
});
