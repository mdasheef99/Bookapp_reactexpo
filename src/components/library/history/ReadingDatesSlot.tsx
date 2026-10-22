import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReadingRead } from '@/features/books/history/readingHistoryContract';
import { readingSlotText } from '@/features/books/history/readingSlotText';
import { LIBRARY_SPACING, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';
import { BookButton } from '../ui';

export const noDatesPromptStorageKey = (actorId: string, readId: string) =>
  `library_noDatesPrompt:v1:${actorId}:${readId}`;

export type ReadingDatesSlotMode = 'full' | 'text' | 'controls';

export interface ReadingDatesSlotProps {
  actorId: string;
  reads: ReadingRead[];
  onEditDates: () => void;
  onMarkUnknown: (readId: string) => void | Promise<unknown>;
  unknownPending?: boolean;
  disabled?: boolean;
  mode?: ReadingDatesSlotMode;
}

function trulyNoStart(read: ReadingRead): boolean {
  return read.started_at == null && read.started_on == null && !read.start_unknown;
}

export function ReadingDatesSlot({
  actorId,
  reads,
  onEditDates,
  onMarkUnknown,
  unknownPending = false,
  disabled = false,
  mode = 'full',
}: ReadingDatesSlotProps) {
  const colors = useLibraryAppearance();
  const [dismissed, setDismissed] = useState(false);
  const [loaded, setLoaded] = useState(mode === 'text');
  const notSureGuard = React.useRef(false);

  const sorted = [...reads].sort((a, b) => a.read_number - b.read_number);
  const latest = sorted[sorted.length - 1];
  const latestId = latest?.id;

  useEffect(() => {
    if (mode === 'text') return;
    setDismissed(false);
    setLoaded(false);
    if (!actorId || !latestId) {
      setLoaded(true);
      return;
    }
    let live = true;
    void AsyncStorage.getItem(noDatesPromptStorageKey(actorId, latestId))
      .then((stored) => {
        if (!live) return;
        if (stored === '1') setDismissed(true);
        setLoaded(true);
      })
      .catch(() => {
        if (live) setLoaded(true);
      });
    return () => {
      live = false;
    };
  }, [actorId, latestId, mode]);

  if (reads.length === 0 || !latest) return null;

  const text = readingSlotText(sorted);
  const showPrompt = latest.outcome === 'finished' && trulyNoStart(latest) && !dismissed;

  const persistDismissal = () => {
    setDismissed(true);
    if (actorId && latestId) {
      void AsyncStorage.setItem(noDatesPromptStorageKey(actorId, latestId), '1').catch(() => {});
    }
  };

  const handleNotSure = () => {
    if (notSureGuard.current) return;
    notSureGuard.current = true;
    let result: void | Promise<unknown>;
    try {
      result = onMarkUnknown(latest.id);
    } catch {
      notSureGuard.current = false;
      return;
    }
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      void (result as Promise<unknown>).then(
        () => {
          persistDismissal();
          notSureGuard.current = false;
        },
        () => {
          notSureGuard.current = false;
        },
      );
      return;
    }
    persistDismissal();
    void Promise.resolve().then(() => {
      notSureGuard.current = false;
    });
  };

  const handleAddDates = () => {
    onEditDates();
  };

  const editDisabled = disabled;
  const notSureDisabled = disabled || unknownPending;

  if (mode === 'text') {
    if (!text) return null;
    return (
      <View testID="library-reading-dates-slot" style={styles.slot}>
        <Text testID="library-reading-dates-text" style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>
          {text}
        </Text>
      </View>
    );
  }

  if (mode === 'controls') {
    if (!loaded) return null;
    return (
      <View testID="library-reading-dates-actions" style={styles.slot}>
        <BookButton
          label="Edit dates"
          variant="text"
          disabled={disabled}
          onPress={onEditDates}
          testID="library-reading-dates-edit"
        />
        {showPrompt ? (
          <View testID="library-reading-dates-nostart" style={styles.prompt}>
            <Text style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>
              No reading dates yet.
            </Text>
            <View style={styles.promptActions}>
              <BookButton
                label="Add dates"
                variant="secondary"
                disabled={disabled}
                onPress={handleAddDates}
                testID="library-reading-dates-add"
              />
              <BookButton
                label="Not sure"
                variant="text"
                disabled={notSureDisabled}
                onPress={handleNotSure}
                testID="library-reading-dates-notsure"
              />
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  if (!loaded) return null;

  return (
    <View testID="library-reading-dates-slot" style={styles.slot}>
      <View style={styles.line}>
        {text ? (
          <Text
            testID="library-reading-dates-text"
            style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}
          >
            {text}
          </Text>
        ) : null}
        <BookButton
          label="Edit dates"
          variant="text"
          disabled={editDisabled}
          onPress={onEditDates}
          testID="library-reading-dates-edit"
        />
      </View>
      {showPrompt ? (
        <View testID="library-reading-dates-nostart" style={styles.prompt}>
          <Text style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>
            No reading dates yet.
          </Text>
          <View style={styles.promptActions}>
            <BookButton
              label="Add dates"
              variant="secondary"
              disabled={disabled}
              onPress={handleAddDates}
              testID="library-reading-dates-add"
            />
            <BookButton
              label="Not sure"
              variant="text"
              disabled={notSureDisabled}
              onPress={handleNotSure}
              testID="library-reading-dates-notsure"
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    gap: LIBRARY_SPACING.xs,
  },
  line: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: LIBRARY_SPACING.xs,
  },
  prompt: {
    gap: LIBRARY_SPACING.xs,
  },
  promptActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: LIBRARY_SPACING.xs,
  },
});
