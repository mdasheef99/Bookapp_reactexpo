import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MIN_TARGET, useLibraryAppearance } from '@/components/library/LibraryAppearance';

export interface BookScreenHeaderProps {
  title: string;
  backLabel: string;
  onBack: () => void;
  bookTitle?: string;
}

export function BookScreenHeader({ title, backLabel, onBack, bookTitle }: BookScreenHeaderProps) {
  const colors = useLibraryAppearance();
  const insets = useSafeAreaInsets();

  return <View style={[styles.header, { paddingTop: insets.top + 8, borderColor: colors.divider }]}>
    <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={backLabel} style={styles.back}>
      <Text style={[styles.link, { color: colors.accent }]}>‹ {backLabel}</Text>
    </Pressable>
    <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
    {!!bookTitle && <Text style={[styles.book, { color: colors.textSecondary }]}>{bookTitle}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, gap: 8 },
  back: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 25, fontWeight: '700' },
  book: { fontSize: 16, lineHeight: 24 },
});
