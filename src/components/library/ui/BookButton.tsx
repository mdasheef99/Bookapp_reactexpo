import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from '@/components/library/LibraryAppearance';

export type BookButtonVariant = 'primary' | 'secondary' | 'text' | 'destructive';

export interface BookButtonProps {
  label: string;
  variant: BookButtonVariant;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  ref?: React.Ref<View>;
}

export function BookButton({ label, variant, onPress, disabled = false, testID, ref }: BookButtonProps) {
  const colors = useLibraryAppearance();
  const variants = {
    primary: { backgroundColor: colors.accent, borderColor: colors.controlBorder, color: colors.textOnAccent },
    secondary: { backgroundColor: colors.bgCard, borderColor: colors.controlBorder, color: colors.textPrimary },
    text: { backgroundColor: 'transparent', borderColor: 'transparent', color: colors.accent },
    destructive: { backgroundColor: colors.error, borderColor: colors.error, color: colors.onErrorSurface },
  };
  const { color, ...surface } = variants[variant];

  return <Pressable ref={ref} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} testID={testID}
    style={({ pressed }) => [styles.button, surface, { opacity: disabled ? 0.55 : pressed ? 0.8 : 1 }]}>
    <Text style={[styles.label, { color }]}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TARGET,
    minWidth: MIN_TARGET,
    paddingHorizontal: LIBRARY_SPACING.md,
    paddingVertical: LIBRARY_SPACING.sm,
    borderRadius: LIBRARY_RADIUS.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
