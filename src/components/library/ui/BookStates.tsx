import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';

import { BookButton } from './BookButton';

export type BookLoadingVariant = 'list' | 'details' | 'note';

export interface BookLoadingProps {
  variant?: BookLoadingVariant;
  label?: string;
}

export interface BookEmptyProps {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: 'primary' | 'secondary';
}

export type BookErrorKind = 'server' | 'offline' | 'notFound';

export interface BookErrorProps {
  kind: BookErrorKind;
  subject: string;
  onRetry?: () => void;
  backLabel?: string;
  onBack?: () => void;
}

export interface BookOfflineProps {
  message?: string;
}

export function BookLoading({ variant, label = 'Loading' }: BookLoadingProps) {
  const colors = useLibraryAppearance();

  return <View role="status" accessibilityLiveRegion="polite" accessible accessibilityLabel={label} style={styles.container}>
    <View accessible={false} aria-hidden importantForAccessibility="no-hide-descendants" style={styles.skeleton}>
      {variant === undefined && <ActivityIndicator size="large" color={colors.accent} />}
      {(variant === 'list' || variant === 'details') && Array.from({ length: variant === 'list' ? 5 : 1 }, (_, index) => (
        <View key={index} testID={variant === 'list' ? 'book-loading-row' : undefined} style={styles.row}>
          <View style={[styles.cover, { backgroundColor: colors.coverPlaceholder }]} />
          <View style={styles.column}>
            <View style={[styles.headingBar, { width: '90%', backgroundColor: colors.bgSecondary }]} />
            <View style={[styles.bodyBar, { width: variant === 'list' ? '60%' : '70%', backgroundColor: colors.bgSecondary }]} />
          </View>
        </View>
      ))}
      {variant === 'details' && <>
        <View style={[styles.statusBar, { backgroundColor: colors.bgSecondary }]} />
        {(['100%', '95%', '60%'] as const).map((width, index) => (
          <View key={index} style={[styles.bodyBar, { width, backgroundColor: colors.bgSecondary }]} />
        ))}
      </>}
      {variant === 'note' && <>
        <View style={[styles.headingBar, { width: '70%', backgroundColor: colors.bgSecondary }]} />
        {(['100%', '96%', '100%', '92%', '55%'] as const).map((width, index) => (
          <View key={index} testID="book-loading-line" style={[styles.bodyBar, { width, backgroundColor: colors.bgSecondary }]} />
        ))}
      </>}
    </View>
  </View>;
}

export function BookEmpty({ title, message, actionLabel, onAction, actionVariant = 'primary' }: BookEmptyProps) {
  const colors = useLibraryAppearance();

  return <View accessibilityLiveRegion="polite" style={styles.container}>
    <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
    {message !== undefined && <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>}
    {!!actionLabel && !!onAction && <BookButton label={actionLabel} variant={actionVariant} onPress={onAction} />}
  </View>;
}

export function BookError({ kind, subject, onRetry, backLabel, onBack }: BookErrorProps) {
  const colors = useLibraryAppearance();
  const copy = {
    server: { title: `Couldn't load ${subject}.`, message: 'Something went wrong on our side. Please try again.' },
    offline: { title: "You're offline.", message: `Reconnect to the internet to load ${subject}, then try again.` },
    notFound: { title: `We can't find ${subject}.`, message: 'It may have been removed.' },
  }[kind];

  return <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.container}>
    <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{copy.title}</Text>
    <Text style={[styles.message, { color: colors.textSecondary }]}>{copy.message}</Text>
    {kind === 'notFound'
      ? !!backLabel && !!onBack && <BookButton label={backLabel} variant="primary" onPress={onBack} />
      : !!onRetry && <BookButton label="Try again" variant="primary" onPress={onRetry} />}
  </View>;
}

export function BookOffline({ message }: BookOfflineProps) {
  const colors = useLibraryAppearance();

  return <View role="status" accessibilityLiveRegion="polite" style={[styles.offline, { backgroundColor: colors.infoSurface }]}>
    <Text style={[styles.message, { color: colors.info }]}>
      {message ?? "You're offline. Some things may not load or save until you reconnect."}
    </Text>
  </View>;
}

const styles = StyleSheet.create({
  container: {
    width: '100%', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: LIBRARY_SPACING.lg, gap: LIBRARY_SPACING.md,
  },
  skeleton: { width: '100%', alignItems: 'center', gap: LIBRARY_SPACING.md },
  row: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: LIBRARY_SPACING.md },
  column: { flex: 1, gap: LIBRARY_SPACING.md },
  cover: {
    width: LIBRARY_SPACING.xxl, height: LIBRARY_SPACING.xxl + LIBRARY_SPACING.lg,
    borderRadius: LIBRARY_RADIUS.control,
  },
  headingBar: { height: LIBRARY_TEXT.heading.lineHeight, borderRadius: LIBRARY_RADIUS.control },
  bodyBar: { height: LIBRARY_TEXT.body.lineHeight, borderRadius: LIBRARY_RADIUS.control },
  statusBar: { width: '100%', height: MIN_TARGET, borderRadius: LIBRARY_RADIUS.control },
  title: { ...LIBRARY_TEXT.heading, textAlign: 'center' },
  message: { ...LIBRARY_TEXT.body, textAlign: 'center' },
  offline: {
    width: '100%', alignItems: 'center', justifyContent: 'center', gap: LIBRARY_SPACING.md,
    padding: LIBRARY_SPACING.md, borderRadius: LIBRARY_RADIUS.control,
  },
});
