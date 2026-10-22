import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBookReadingHistory } from '@/features/books/history/useBookReadingHistory';
import { useReadProgress } from '@/features/books/history/useReadProgress';
import { currentPosition } from '@/features/books/history/progressMath';
import { noteProgressSavedMessage, notifySaveSuccess } from '@/features/books/history/saveConfirmation';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { LIBRARY_SPACING, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';
import { BookButton, useBookFeedback } from '../ui';

export const noteProgressPromptStorageKey = (actorId: string, readId: string) =>
  `library_noteProgressPrompt:v1:${actorId}:${readId}`;

export interface NoteProgressPromptProps {
  actorId: string;
  userBookId: string;
  pageNumber: number | null;
  justSaved?: boolean;
}

/**
 * Inline "You're on p. 142?" prompt (SDD-09 §4.5 H-10).
 * Shown after a note with a `page_number` is saved, only when the book has an
 * open read and the note's page is beyond the read's current page position.
 * A read without any progress (or with only a % position and no total) treats
 * the note's page as ahead, since there is no page position yet.
 * "Not now" is remembered per user and read in AsyncStorage, so the prompt
 * stays off for the rest of that read but returns for a new read.
 * Saving a note is never changed here; Update inserts one page entry.
 */
export function NoteProgressPrompt({
  actorId,
  userBookId,
  pageNumber,
  justSaved = true,
}: NoteProgressPromptProps) {
  const colors = useLibraryAppearance();
  const { notify } = useBookFeedback();
  const { isOffline } = useNetworkStatus();
  const hasPage =
    typeof pageNumber === 'number' && Number.isInteger(pageNumber) && pageNumber > 0;
  const fetchEnabled = justSaved && hasPage;
  const history = useBookReadingHistory(actorId, userBookId, fetchEnabled);
  const openRead =
    (history.reads.data ?? []).find((read) => read.outcome === 'reading') ?? null;
  const readProgress = useReadProgress(actorId, openRead?.id ?? '', fetchEnabled);
  const [dismissed, setDismissed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const updateGuard = useRef(false);
  const notNowGuard = useRef(false);

  const readId = openRead?.id;

  useEffect(() => {
    setDismissed(false);
    setHidden(false);
    setLoaded(false);
    if (!actorId || !readId) {
      setLoaded(true);
      return;
    }
    let live = true;
    void AsyncStorage.getItem(noteProgressPromptStorageKey(actorId, readId))
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

  const readsReady = history.reads.data !== undefined;
  const progressReady = !openRead || readProgress.progress.data !== undefined;
  const progressFailed = history.reads.isError || (openRead !== null && readProgress.progress.isError);

  const position =
    openRead && readProgress.progress.data !== undefined
      ? currentPosition(readProgress.progress.data, openRead.total_pages)
      : null;
  const currentPages = position?.pages ?? null;
  const isAhead =
    hasPage &&
    openRead !== null &&
    (currentPages === null || (pageNumber as number) > currentPages);

  const notifySaveError = useCallback(
    (error: unknown, retry: () => void) => {
      notify({
        kind: 'error',
        message: error instanceof Error ? error.message : "Couldn't update your progress.",
        action: { label: 'Retry', onPress: retry },
      });
    },
    [notify],
  );

  if (!fetchEnabled) return null;
  if (!loaded || !readsReady || !progressReady || progressFailed) return null;
  if (hidden || dismissed || !isAhead || !openRead || !hasPage) return null;

  const busy = readProgress.addProgress.isPending;
  const controlsDisabled = isOffline || busy;

  const handleUpdate = () => {
    if (updateGuard.current) return;
    updateGuard.current = true;
    const attempt = () =>
      readProgress.addProgress.mutateAsync({ page: pageNumber as number }).then(
        (saved) => {
          updateGuard.current = false;
          setHidden(true);
          notifySaveSuccess(notify, noteProgressSavedMessage(pageNumber as number));
          return saved;
        },
        (error: unknown) => {
          updateGuard.current = false;
          notifySaveError(error, () => {
            if (updateGuard.current) return;
            handleUpdate();
          });
          throw error;
        },
      );
    void attempt().catch(() => {
      updateGuard.current = false;
    });
  };

  const handleNotNow = () => {
    if (notNowGuard.current) return;
    notNowGuard.current = true;
    setDismissed(true);
    setHidden(true);
    if (actorId && readId) {
      void AsyncStorage.setItem(noteProgressPromptStorageKey(actorId, readId), '1')
        .catch(() => {})
        .finally(() => {
          notNowGuard.current = false;
        });
    } else {
      notNowGuard.current = false;
    }
  };

  return (
    <View testID="library-note-progress-prompt" style={styles.prompt}>
      <Text testID="library-note-progress-text" style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}>
        {`You're on p. ${pageNumber}?`}
      </Text>
      <View style={styles.actions}>
        <BookButton
          label="Update"
          variant="secondary"
          disabled={controlsDisabled}
          onPress={handleUpdate}
          testID="library-note-progress-update"
        />
        <BookButton
          label="Not now"
          variant="text"
          disabled={busy}
          onPress={handleNotNow}
          testID="library-note-progress-not-now"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: {
    gap: LIBRARY_SPACING.xs,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: LIBRARY_SPACING.xs,
  },
});
