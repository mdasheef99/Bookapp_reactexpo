import React, { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ReadingSettings } from '@/features/books/history/readingHistoryContract';
import { readingHistoryGateway } from '@/features/books/history/readingHistoryGateway';
import { ReadingStatus } from '../StatusSelector';
import { LIBRARY_SPACING, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';
import { BookButton } from '../ui';

export interface NextReadControlProps {
  actorId: string;
  userBookId: string;
  bookStatus: ReadingStatus;
  settingsData?: ReadingSettings | null;
  settingsError?: boolean;
  onRetrySettings?: () => void;
  onSetNextRead: (nextBookId: string | null) => void | Promise<unknown>;
  setNextReadPending?: boolean;
  disabled?: boolean;
}

/**
 * Your next read control (SDD-09 §4.6 H-15).
 * Shown only for books not being read and not finished.
 * - No next read: "Make this my next read".
 * - This book is next: "Your next read" + Remove.
 * - Another book is next: Make button with "Replaces {title}".
 */
export function NextReadControl({
  actorId,
  userBookId,
  bookStatus,
  settingsData,
  settingsError = false,
  onRetrySettings,
  onSetNextRead,
  setNextReadPending = false,
  disabled = false,
}: NextReadControlProps) {
  const colors = useLibraryAppearance();
  const guard = useRef(false);

  if (bookStatus === 'reading' || bookStatus === 'completed') return null;

  if (settingsError) {
    return (
      <View testID="library-next-read" style={styles.wrap}>
        <Text style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>
          Couldn&apos;t load your next read.
        </Text>
        <BookButton
          label="Try again"
          variant="text"
          onPress={() => onRetrySettings?.()}
          testID="library-next-read-retry"
        />
      </View>
    );
  }

  if (settingsData === undefined) return null;

  const nextId = settingsData?.next_read_user_book_id ?? null;

  const run = (next: string | null) => {
    if (guard.current || setNextReadPending) return;
    guard.current = true;
    let result: void | Promise<unknown>;
    try {
      result = onSetNextRead(next);
    } catch {
      guard.current = false;
      return;
    }
    void Promise.resolve(result).then(
      () => {
        guard.current = false;
      },
      () => {
        guard.current = false;
      },
    );
  };

  if (nextId === null) {
    return (
      <View testID="library-next-read" style={styles.wrap}>
        <BookButton
          label="Make this my next read"
          variant="secondary"
          disabled={disabled || setNextReadPending}
          onPress={() => run(userBookId)}
          testID="library-next-read-make"
        />
      </View>
    );
  }

  if (nextId === userBookId) {
    return (
      <View testID="library-next-read" style={styles.wrap}>
        <Text testID="library-next-read-current" style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}>
          Your next read
        </Text>
        <BookButton
          label="Remove"
          variant="text"
          disabled={disabled || setNextReadPending}
          onPress={() => run(null)}
          testID="library-next-read-remove"
        />
      </View>
    );
  }

  return (
    <NextReadReplaces
      actorId={actorId}
      userBookId={userBookId}
      nextId={nextId}
      disabled={disabled}
      pending={setNextReadPending}
      onMake={() => run(userBookId)}
    />
  );
}

function NextReadReplaces({
  actorId,
  userBookId,
  nextId,
  disabled,
  pending,
  onMake,
}: {
  actorId: string;
  userBookId: string;
  nextId: string;
  disabled: boolean;
  pending: boolean;
  onMake: () => void;
}) {
  const colors = useLibraryAppearance();
  const title = useQuery({
    queryKey: ['library-history-next-read-title', actorId, nextId],
    queryFn: ({ signal }) => readingHistoryGateway.userBookTitle(actorId, nextId, signal),
    enabled: !!actorId && !!nextId,
    retry: false,
  });

  if (title.isPending) {
    return (
      <View testID="library-next-read" style={styles.wrap}>
        <BookButton
          label="Make this my next read"
          variant="secondary"
          disabled
          onPress={onMake}
          testID="library-next-read-make"
        />
      </View>
    );
  }

  if (title.isError || !title.data) {
    return (
      <View testID="library-next-read" style={styles.wrap}>
        <BookButton
          label="Make this my next read"
          variant="secondary"
          disabled={disabled || pending}
          onPress={onMake}
          testID="library-next-read-make"
        />
        <View style={styles.replacesRow}>
          <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>
            Couldn&apos;t load the current next read.
          </Text>
          <BookButton
            label="Try again"
            variant="text"
            onPress={() => {
              void title.refetch();
            }}
            testID="library-next-read-title-retry"
          />
        </View>
      </View>
    );
  }

  return (
    <View testID="library-next-read" style={styles.wrap}>
      <BookButton
        label={`Make this my next read, replaces ${title.data}`}
        variant="secondary"
        disabled={disabled || pending}
        onPress={onMake}
        testID="library-next-read-make"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: LIBRARY_SPACING.xs,
  },
  replacesRow: {
    gap: LIBRARY_SPACING.xs,
  },
});
