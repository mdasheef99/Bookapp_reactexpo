import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BookButton } from '../ui';
import { LIBRARY_SPACING } from '../LibraryAppearance';
export function LibraryLabelFilter({ name, visible, disabled, error, onOpen, onClear, onRetry, triggerRef }: {
  name?: string; visible: boolean; disabled: boolean; error: boolean;
  onOpen: () => void; onClear: () => void; onRetry: () => void;
  triggerRef?: React.RefObject<View | null>;
}) {
  if (!visible) return error ? <BookButton label="Try labels again" variant="text" onPress={onRetry} /> : null;
  return <View style={styles.row}>
    <BookButton ref={triggerRef} label={name ?? 'Labels'} accessibilityLabel={name ? `Labels: ${name}` : 'Filter books by label'} variant="text" selected={!!name} disabled={disabled} onPress={onOpen} />
    {!!name && <BookButton label="×" accessibilityLabel="Clear label filter" variant="text" disabled={disabled} onPress={onClear} />}
  </View>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: LIBRARY_SPACING.xs } });
