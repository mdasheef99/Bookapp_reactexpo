import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BookButton } from '../ui';
import { LIBRARY_SPACING, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';
export function LibraryLabelFilter({ name, visible, disabled, error, isOffline, onOpen, onClear, onRetry, triggerRef }: {
  name?: string; visible: boolean; disabled: boolean; error: boolean; isOffline?: boolean;
  onOpen: () => void; onClear: () => void; onRetry: () => void;
  triggerRef?: React.RefObject<View | null>;
}) {
  const colors = useLibraryAppearance();
  const retry = isOffline
    ? <><Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>You&apos;re offline.</Text><BookButton label="Try labels again" variant="text" disabled onPress={onRetry} /></>
    : <BookButton label="Try labels again" variant="text" onPress={onRetry} />;
  if (!visible) return error ? retry : null;
  return <View style={styles.row}>
    <BookButton ref={triggerRef} label={name ?? 'Labels'} accessibilityLabel={name ? `Labels: ${name}` : 'Filter books by label'} variant="text" selected={!!name} disabled={disabled} onPress={onOpen} />
    {!!name && <BookButton label="×" accessibilityLabel="Clear label filter" variant="text" disabled={disabled} onPress={onClear} />}
    {error && retry}
  </View>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: LIBRARY_SPACING.xs } });
