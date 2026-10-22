import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { ReadingRead } from '@/features/books/history/readingHistoryContract';
import { nthBookCount, ordinal } from '@/features/books/history/readingTimeline';
import { readingHistoryGateway } from '@/features/books/history/readingHistoryGateway';
import { useStartReading } from '@/features/books/history/useStartReading';
import { noteSaves } from '@/features/books/notes/manualNotesGateway';
import { useNoteOperations } from '@/features/books/notes/useManualNotes';
import { getWordCount, NOTE_WORD_LIMIT } from '@/features/books/utils/ocrWordCap';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { LIBRARY_SPACING, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';
import { BookButton, useBookFeedback } from '../ui';
import { RatingInput } from '../RatingInput';

export const finishPanelStorageKey = (actorId: string, readId: string) =>
  `library_finishPanel:v1:${actorId}:${readId}`;

export interface FinishPanelProps {
  actorId: string;
  userBookId: string;
  read: ReadingRead;
  allReads: ReadingRead[];
  justFinished: boolean;
  rating: number;
  onRate: (rating: number) => void;
  disabled?: boolean;
  timeZone?: string;
  nextReadUserBookId?: string | null;
}

function headingText(count: number | null): string {
  if (count === null) return 'Finished.';
  return `Finished. Your ${ordinal(count)} book this year.`;
}

/**
 * Finish moment panel (SDD-09 §4.6 H-14).
 * Inline (not a modal), shown only when the read became finished in this
 * session and not yet dismissed for this user + read.
 */
export function FinishPanel({
  actorId,
  userBookId,
  read,
  allReads,
  justFinished,
  rating,
  onRate,
  disabled = false,
  timeZone,
  nextReadUserBookId,
}: FinishPanelProps) {
  const colors = useLibraryAppearance();
  const { notify } = useBookFeedback();
  const { isOffline } = useNetworkStatus();
  const [dismissed, setDismissed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [thought, setThought] = useState('');
  const [thoughtSaved, setThoughtSaved] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const thoughtGuard = useRef(false);
  const dismissGuard = useRef(false);
  const toastedFailureRef = useRef<string | null>(null);

  // One session per panel mount: the coordinator dedupes a double tap by
  // session, so a pending save + second press still sends once.
  const sessionId = useMemo(() => randomUUID(), []);
  const operations = useNoteOperations(actorId, userBookId) ?? [];
  const thoughtOp = operations.find((op) => op.submission.sessionId === sessionId) ?? null;
  const thoughtStatus = thoughtOp?.status ?? null;
  const thoughtPending = thoughtStatus === 'saving' || thoughtStatus === 'unknown';
  const thoughtConfirmed = thoughtStatus === 'confirmed';

  const { start: startNextRead } = useStartReading(actorId);

  const readId = read.id;

  useEffect(() => {
    setDismissed(false);
    setLoaded(false);
    setThought('');
    setThoughtSaved(false);
    toastedFailureRef.current = null;
    if (!actorId || !readId) {
      setLoaded(true);
      return;
    }
    let live = true;
    void AsyncStorage.getItem(finishPanelStorageKey(actorId, readId))
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
  }, [actorId, readId]);

  useEffect(() => {
    let live = true;
    const check = async () => {
      try {
        const enabled =
          typeof (AccessibilityInfo as unknown as { isReduceMotionEnabled?: () => Promise<boolean> })
            .isReduceMotionEnabled === 'function'
            ? await (
                AccessibilityInfo as unknown as { isReduceMotionEnabled: () => Promise<boolean> }
              ).isReduceMotionEnabled()
            : false;
        if (live) {
          setReduceMotion(!!enabled);
          opacity.setValue(enabled ? 1 : 0);
          if (!enabled) {
            Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
          }
        }
      } catch {
        if (live) {
          setReduceMotion(false);
          opacity.setValue(0);
          Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
        }
      }
    };
    opacity.setValue(0);
    void check();
    return () => {
      live = false;
    };
  }, [opacity, readId]);

  // Hold the count until the full user read set has loaded and contains this read.
  const hasTargetRead = allReads.some((candidate) => candidate.id === read.id);
  const count = useMemo(
    () => (hasTargetRead ? nthBookCount(allReads, read.id, timeZone) : null),
    [allReads, hasTargetRead, read.id, timeZone],
  );

  const showNextUp = !!nextReadUserBookId && nextReadUserBookId !== userBookId;
  const nextTitle = useQuery({
    queryKey: ['library-history-next-read-title', actorId, nextReadUserBookId ?? ''],
    queryFn: ({ signal }) =>
      readingHistoryGateway.userBookTitle(actorId, nextReadUserBookId as string, signal),
    enabled: !!actorId && showNextUp,
    retry: false,
  });

  const notifyError = useCallback(
    (error: unknown, retry: () => void) => {
      notify({
        kind: 'error',
        message: error instanceof Error ? error.message : "Couldn't update your reading.",
        action: { label: 'Retry', onPress: retry },
      });
    },
    [notify],
  );

  const handleDismiss = useCallback(() => {
    if (dismissGuard.current) return;
    dismissGuard.current = true;
    setDismissed(true);
    if (actorId && readId) {
      void AsyncStorage.setItem(finishPanelStorageKey(actorId, readId), '1')
        .catch(() => {})
        .finally(() => {
          dismissGuard.current = false;
        });
    } else {
      dismissGuard.current = false;
    }
  }, [actorId, readId]);

  const thoughtRef = useRef(thought);
  thoughtRef.current = thought;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const offlineRef = useRef(isOffline);
  offlineRef.current = isOffline;
  const saveRefs = useRef({ actorId, userBookId, sessionId, notifyError });
  saveRefs.current = { actorId, userBookId, sessionId, notifyError };

  const handleThoughtSave = useCallback(() => {
    if (thoughtGuard.current) return;
    const content = thoughtRef.current.trim();
    if (!content) return;
    if (getWordCount(content) > NOTE_WORD_LIMIT) return;
    if (disabledRef.current || offlineRef.current) return;
    const { actorId: saveActor, userBookId: saveBook, sessionId: saveSession, notifyError: notifySaveError } =
      saveRefs.current;
    thoughtGuard.current = true;
    try {
      const submissionId = randomUUID();
      const noteId = randomUUID();
      noteSaves.start({
        id: submissionId,
        actorId: saveActor,
        bookId: saveBook,
        noteId,
        sessionId: saveSession,
        mode: 'create',
        origin: 'book',
        content,
        tag: 'reflect',
        page_number: null,
      });
    } catch (error) {
      thoughtGuard.current = false;
      notifySaveError(error, () => {
        handleThoughtSave();
      });
    }
  }, []);

  // Once per read: remember the first show, not only dismiss, so a remount
  // without a dismiss still hides the panel.
  const panelVisible = justFinished && read.outcome === 'finished' && loaded && !dismissed;
  useEffect(() => {
    if (!panelVisible || !actorId || !readId) return;
    void AsyncStorage.setItem(finishPanelStorageKey(actorId, readId), '1').catch(() => {});
  }, [panelVisible, actorId, readId]);

  // Truthful save state: Saving… until confirmed, then Thought saved.
  // On failed/unknown keep the typed text and show Retry. The double-tap
  // guard is released only on a terminal coordinator status.
  useEffect(() => {
    if (!thoughtOp) return;
    if (thoughtOp.status === 'confirmed') {
      thoughtGuard.current = false;
      toastedFailureRef.current = null;
      setThought('');
      setThoughtSaved(true);
      return;
    }
    if (thoughtOp.status === 'failed' || thoughtOp.status === 'unknown' || thoughtOp.status === 'conflict') {
      thoughtGuard.current = false;
      const key = `${thoughtOp.submission.id}:${thoughtOp.status}`;
      if (toastedFailureRef.current === key) return;
      toastedFailureRef.current = key;
      const failure = new Error(thoughtOp.message ?? "Couldn't update your reading.");
      notifyError(failure, () => {
        handleThoughtSave();
      });
    }
  }, [thoughtOp, notifyError, handleThoughtSave]);

  const handleStartNext = useCallback(() => {
    if (!nextReadUserBookId) return;
    void startNextRead(nextReadUserBookId);
  }, [nextReadUserBookId, startNextRead]);

  if (!justFinished) return null;
  if (read.outcome !== 'finished') return null;
  if (!loaded || dismissed) return null;

  const thoughtWords = getWordCount(thought.trim());
  const thoughtTooLong = thoughtWords > NOTE_WORD_LIMIT;
  const thoughtEmpty = thought.trim().length === 0;
  const thoughtDisabled = disabled || isOffline || thoughtEmpty || thoughtTooLong || thoughtPending;

  const showSaved = thoughtSaved || thoughtConfirmed;

  return (
    <Animated.View
      testID="library-finish-panel"
      style={[styles.panel, { backgroundColor: colors.bgCard, borderColor: colors.border, opacity }]}
    >
      <Text testID="library-finish-heading" style={[LIBRARY_TEXT.heading, { color: colors.textPrimary }]}>
        {headingText(count)}
      </Text>
      <RatingInput rating={rating} onChange={onRate} disabled={disabled || isOffline} />
      <View style={styles.thought}>
        <Text style={[LIBRARY_TEXT.label, { color: colors.textPrimary }]}>One thought on this book?</Text>
        <TextInput
          testID="library-finish-thought-input"
          accessibilityLabel="One thought on this book"
          placeholder="A single line…"
          placeholderTextColor={colors.textTertiary}
          value={thought}
          onChangeText={(value) => {
            setThought(value);
            setThoughtSaved(false);
          }}
          editable={!disabled && !isOffline}
          style={[
            LIBRARY_TEXT.body,
            styles.input,
            { backgroundColor: colors.bgSecondary, color: colors.textPrimary, borderColor: colors.controlBorder },
          ]}
        />
        {thoughtTooLong ? (
          <Text
            testID="library-finish-thought-error"
            style={[LIBRARY_TEXT.caption, { color: colors.error }]}
          >
            {`Keep it under ${NOTE_WORD_LIMIT} words.`}
          </Text>
        ) : null}
        {thoughtPending ? (
          <Text testID="library-finish-thought-saving" style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>
            Saving…
          </Text>
        ) : null}
        {showSaved && !thoughtPending ? (
          <Text testID="library-finish-thought-saved" style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>
            Thought saved.
          </Text>
        ) : null}
        <BookButton
          label="Save thought"
          variant="secondary"
          disabled={thoughtDisabled}
          onPress={handleThoughtSave}
          testID="library-finish-thought-save"
        />
      </View>
      {showNextUp ? (
        <View testID="library-finish-next-up" style={styles.nextUp}>
          {nextTitle.isPending ? (
            <Text style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>Loading your next read…</Text>
          ) : nextTitle.isError || !nextTitle.data ? (
            <View style={styles.nextUpRow}>
              <Text style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>
                Couldn&apos;t load your next read.
              </Text>
              <BookButton
                label="Try again"
                variant="text"
                onPress={() => {
                  void nextTitle.refetch();
                }}
                testID="library-finish-next-up-retry"
              />
            </View>
          ) : (
            <>
              <Text
                testID="library-finish-next-up-text"
                style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}
              >
                {`Next up: ${nextTitle.data}`}
              </Text>
              <BookButton
                label="Start reading"
                variant="secondary"
                disabled={disabled || isOffline}
                onPress={handleStartNext}
                testID="library-finish-next-start"
              />
            </>
          )}
        </View>
      ) : null}
      <BookButton label="Dismiss" variant="text" onPress={handleDismiss} testID="library-finish-dismiss" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderRadius: 14,
    padding: LIBRARY_SPACING.md,
    gap: LIBRARY_SPACING.xs,
  },
  thought: {
    gap: LIBRARY_SPACING.xxs,
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: LIBRARY_SPACING.sm,
    paddingVertical: LIBRARY_SPACING.xs,
    borderWidth: 1,
  },
  nextUp: {
    gap: LIBRARY_SPACING.xs,
  },
  nextUpRow: {
    gap: LIBRARY_SPACING.xs,
  },
});
