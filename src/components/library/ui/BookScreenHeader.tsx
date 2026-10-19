import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MIN_TARGET, useLibraryAppearance } from '@/components/library/LibraryAppearance';

export interface BookScreenHeaderProps {
  // Omit the title for a Back-only header (no title text, no bottom border).
  title?: string;
  backLabel: string;
  // Accessible name for Back when it should differ from the visible label.
  backAccessibilityLabel?: string;
  onBack: () => void;
  bookTitle?: string;
  backTestID?: string;
}

export function BookScreenHeader({ title, backLabel, backAccessibilityLabel, onBack, bookTitle, backTestID }: BookScreenHeaderProps) {
  const colors = useLibraryAppearance();
  const insets = useSafeAreaInsets();
  const hasTitle = title !== undefined;

  return <View style={[styles.header, { paddingTop: insets.top + 8, borderColor: colors.divider }, !hasTitle && styles.backOnly]}>
    <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={backAccessibilityLabel ?? backLabel} testID={backTestID} style={styles.back}>
      <Text style={[styles.link, { color: colors.accent }]}>‹ {backLabel}</Text>
    </Pressable>
    {hasTitle && <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>}
    {hasTitle && !!bookTitle && <Text style={[styles.book, { color: colors.textSecondary }]}>{bookTitle}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, gap: 8 },
  backOnly: { borderBottomWidth: 0 },
  back: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 25, fontWeight: '700' },
  book: { fontSize: 16, lineHeight: 24 },
});
