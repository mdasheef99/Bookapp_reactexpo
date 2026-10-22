import React, { useRef } from 'react';
import { Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { ReadingRead } from '@/features/books/history/readingHistoryContract';
import { useLeaveOutStats } from '@/features/books/history/useLeaveOutStats';
import { LIBRARY_SPACING, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';
import { useBookFeedback } from '../ui';

export interface LeaveOutStatsSwitchProps {
  actorId: string;
  userBookId: string;
  reads: ReadingRead[];
  disabled?: boolean;
}

/**
 * "Leave out of my stats" (SDD-09 §4.7 H-17). Offered only once the book has
 * at least one read. One owner-filtered update sets `counts_in_stats` on
 * every read of the book; later reads copy the flag in the database trigger.
 */
export function LeaveOutStatsSwitch({ actorId, userBookId, reads, disabled = false }: LeaveOutStatsSwitchProps) {
  const colors = useLibraryAppearance();
  const { notify } = useBookFeedback();
  const guard = useRef(false);

  const mutation = useLeaveOutStats(actorId, userBookId);

  const notifyError = (error: unknown, retryValue: boolean) => {
    notify({
      kind: 'error',
      message: error instanceof Error ? error.message : "Couldn't update your reading history.",
      action: {
        label: 'Retry',
        onPress: () => {
          if (guard.current || mutation.isPending) return;
          void run(retryValue);
        },
      },
    });
  };

  const run = (value: boolean) => {
    if (guard.current || mutation.isPending) return Promise.resolve(null);
    guard.current = true;
    return mutation
      .mutateAsync(value)
      .then((saved) => {
        guard.current = false;
        return saved;
      })
      .catch((error: unknown) => {
        guard.current = false;
        notifyError(error, value);
        throw error;
      });
  };

  const onValueChange = (next: boolean) => {
    // Switch ON = leave out (counts_in_stats false for all reads).
    void run(!next).catch(() => {});
  };

  if (!actorId || !userBookId || reads.length === 0) return null;
  // Switch position follows the most recent read (highest `read_number`):
  // the database trigger copies that flag to later reads.
  const latest = reads.reduce((best, read) =>
    read.read_number > best.read_number ? read : best,
  );
  const excluded = latest.counts_in_stats === false;

  return (
    <View testID="library-leave-out-stats" style={styles.wrap}>
      <Text
        nativeID="library-leave-out-stats-label"
        style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}
      >
        Leave out of my stats
      </Text>
      <Switch
        testID="library-leave-out-stats-switch"
        accessibilityLabel="Leave out of my stats"
        aria-label="Leave out of my stats"
        aria-labelledby={Platform.OS === 'web' ? 'library-leave-out-stats-label' : undefined}
        value={excluded}
        disabled={disabled || mutation.isPending}
        onValueChange={onValueChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: LIBRARY_SPACING.sm,
  },
});
