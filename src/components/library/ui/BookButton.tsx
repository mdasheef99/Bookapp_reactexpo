import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from '@/components/library/LibraryAppearance';

export type BookButtonVariant = 'primary' | 'secondary' | 'text' | 'destructive';

export interface BookButtonProps {
  label: string;
  /** Fuller screen-reader name when the visible label is short (e.g. "Edit"). */
  accessibilityLabel?: string;
  variant: BookButtonVariant;
  onPress: () => void;
  disabled?: boolean;
  /** Disclosure triggers (e.g. a button that opens a sheet) report whether it is open. */
  expanded?: boolean;
  /** Toggle-like triggers report an active state (e.g. Filter with filters applied). */
  selected?: boolean;
  testID?: string;
  ref?: React.Ref<View>;
  /**
   * Optional explicit label line height (e.g. the swipe screen passes the
   * font-scaled label token so 200% labels never clip). Undefined keeps the
   * label on native metrics — byte-identical for every existing caller.
   */
  labelLineHeight?: number;
}

export function BookButton({ label, accessibilityLabel, variant, onPress, disabled = false, expanded, selected, testID, ref, labelLineHeight }: BookButtonProps) {
  const colors = useLibraryAppearance();
  const variants = {
    primary: { backgroundColor: colors.accent, borderColor: colors.controlBorder, color: colors.textOnAccent },
    secondary: { backgroundColor: colors.bgCard, borderColor: colors.controlBorder, color: colors.textPrimary },
    text: { backgroundColor: 'transparent', borderColor: 'transparent', color: colors.accent },
    destructive: { backgroundColor: colors.error, borderColor: colors.error, color: colors.onErrorSurface },
  };
  const { color, ...surface } = variants[variant];
  const accessibilityState = {
    disabled,
    ...(expanded === undefined ? {} : { expanded }),
    ...(selected === undefined ? {} : { selected }),
  };

  // RN Web ignores accessibilityState, so the open state also goes out as aria-expanded.
  // `selected` stays native-only: aria-selected is not valid on a web button.
  return <Pressable ref={ref} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={accessibilityState}
    aria-expanded={expanded} disabled={disabled} onPress={onPress} testID={testID}
    style={({ pressed }) => [styles.button, surface, { opacity: disabled ? 0.55 : pressed ? 0.8 : 1 }]}>
    <Text style={[styles.label, { color }, labelLineHeight === undefined ? null : { lineHeight: labelLineHeight }]}>{label}</Text>
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
