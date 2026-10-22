import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ReadingStatus } from '../StatusSelector';
import { ReadingRead, effectiveReadDates } from '@/features/books/history/readingHistoryContract';
import { ReadDatesPatch } from '@/features/books/history/readingHistoryGateway';
import { LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';
import { DIALOG_MAX_WIDTH } from '../bookDetails/bookDetailsTokens';
import { BookButton, BookFeedbackSlot } from '../ui';
import { LibraryDateInput } from './LibraryDateInput';

export const EDIT_DATES_SHEET_TITLE = 'Edit reading dates';

export interface EditDatesSheetProps {
  visible: boolean;
  onClose: () => void;
  bookStatus: ReadingStatus;
  reads: ReadingRead[];
  onSave: (readId: string, patch: ReadDatesPatch) => void | Promise<unknown>;
  onRemove: (readId: string) => void | Promise<unknown>;
  onReopen: (readId: string) => void | Promise<unknown>;
  pendingReadId?: string | null;
  disabled?: boolean;
}

interface DateDraft {
  started_on: string | null;
  ended_on: string | null;
  start_unknown: boolean;
  end_unknown: boolean;
}

export function outcomeLabel(outcome: ReadingRead['outcome']): string {
  if (outcome === 'reading') return 'Reading';
  if (outcome === 'finished') return 'Finished';
  return 'Stopped';
}

export function canRemoveRead(
  read: ReadingRead,
  latestId: string | undefined,
  bookStatus: ReadingStatus,
): boolean {
  if (read.outcome === 'reading') return false;
  if (read.id === latestId && bookStatus === 'completed') return false;
  return true;
}

export function canReopenRead(
  read: ReadingRead,
  latestId: string | undefined,
  reads: readonly ReadingRead[],
): boolean {
  if (read.id !== latestId) return false;
  if (read.outcome !== 'finished' && read.outcome !== 'did_not_finish') return false;
  return !reads.some((candidate) => candidate.outcome === 'reading');
}

function toLocalToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isRealDay(day: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return false;
  const check = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return (
    check.getFullYear() === Number(match[1]) &&
    check.getMonth() === Number(match[2]) - 1 &&
    check.getDate() === Number(match[3])
  );
}

function draftError(draft: DateDraft): string | null {
  for (const day of [draft.started_on, draft.ended_on]) {
    if (day === null) continue;
    if (!isRealDay(day)) return 'Enter a real calendar date (YYYY-MM-DD).';
    if (day > toLocalToday()) return "Reading dates can't be in the future.";
  }
  const start = !draft.start_unknown && draft.started_on ? draft.started_on : null;
  const end = !draft.end_unknown && draft.ended_on ? draft.ended_on : null;
  if (start && end && start > end) return "The start date can't be after the end date.";
  return null;
}

function draftOf(read: ReadingRead): DateDraft {
  const effective = effectiveReadDates(read);
  return {
    started_on: effective.start,
    ended_on: effective.end,
    start_unknown: read.start_unknown,
    end_unknown: read.end_unknown,
  };
}

function draftsEqual(a: DateDraft, b: DateDraft): boolean {
  return (
    a.started_on === b.started_on &&
    a.ended_on === b.ended_on &&
    a.start_unknown === b.start_unknown &&
    a.end_unknown === b.end_unknown
  );
}

function isDirty(seed: DateDraft, draft: DateDraft): boolean {
  return !draftsEqual(seed, draft);
}

export function EditDatesSheet({
  visible,
  onClose,
  bookStatus,
  reads,
  onSave,
  onRemove,
  onReopen,
  pendingReadId = null,
  disabled = false,
}: EditDatesSheetProps) {
  const colors = useLibraryAppearance();
  const closeRef = useRef<View>(null);
  const [drafts, setDrafts] = useState<Record<string, DateDraft>>({});
  const [localPending, setLocalPending] = useState<ReadonlySet<string>>(new Set());
  const pendingRef = useRef<Set<string>>(new Set());
  const seedVersions = useRef<Record<string, string>>(Object.create(null));

  useEffect(() => {
    if (!visible) {
      setDrafts((current) => (Object.keys(current).length === 0 ? current : {}));
      seedVersions.current = Object.create(null);
      pendingRef.current = new Set();
      setLocalPending((current) => (current.size === 0 ? current : new Set()));
      return;
    }
    setDrafts((current) => {
      const next: Record<string, DateDraft> = { ...current };
      let changed = false;
      for (const read of reads) {
        const seen = seedVersions.current[read.id];
        if (next[read.id] === undefined || seen !== read.updated_at) {
          const seed = draftOf(read);
          const existing = next[read.id];
          if (!existing || !draftsEqual(existing, seed) || seen !== read.updated_at) {
            next[read.id] = seed;
            changed = true;
          }
          seedVersions.current[read.id] = read.updated_at;
        }
      }
      for (const id of Object.keys(next)) {
        if (!reads.some((read) => read.id === id)) {
          delete next[id];
          delete seedVersions.current[id];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [visible, reads]);

  if (!visible) return null;

  const sorted = [...reads].sort((a, b) => b.read_number - a.read_number);
  const latestId = [...reads].sort((a, b) => a.read_number - b.read_number)[reads.length - 1]?.id;

  const patchDraft = (readId: string, patch: Partial<DateDraft>) => {
    setDrafts((current) => {
      const existing = current[readId];
      if (!existing) return current;
      return { ...current, [readId]: { ...existing, ...patch } };
    });
  };

  const markPending = (readId: string) => {
    if (pendingRef.current.has(readId)) return false;
    pendingRef.current.add(readId);
    setLocalPending(new Set(pendingRef.current));
    return true;
  };

  const clearPending = (readId: string) => {
    pendingRef.current.delete(readId);
    setLocalPending(new Set(pendingRef.current));
  };

  const runGuarded = (readId: string, fn: () => void | Promise<unknown>) => {
    if (pendingRef.current.has(readId) || pendingReadId === readId) return;
    if (!markPending(readId)) return;
    let result: void | Promise<unknown>;
    try {
      result = fn();
    } catch {
      clearPending(readId);
      return;
    }
    void Promise.resolve(result).then(
      () => clearPending(readId),
      () => clearPending(readId),
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      accessible
      role="dialog"
      aria-modal
      onRequestClose={onClose}
      onShow={() => {
        if (Platform.OS === 'web') {
          closeRef.current?.focus();
        } else {
          const node = findNodeHandle(closeRef.current);
          if (node) AccessibilityInfo.setAccessibilityFocus(node);
        }
      }}
    >
      <View style={[styles.scrim, { backgroundColor: colors.overlay }]}>
        <View
          accessibilityViewIsModal
          accessibilityLabel={EDIT_DATES_SHEET_TITLE}
          style={[styles.dialog, { backgroundColor: colors.bgRaised }]}
        >
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.dialogContent}>
            <BookFeedbackSlot />
            <Text accessibilityRole="header" style={[LIBRARY_TEXT.heading, { color: colors.textPrimary }]}>
              {EDIT_DATES_SHEET_TITLE}
            </Text>
            {sorted.map((read) => {
              const seed = draftOf(read);
              const draft = drafts[read.id] ?? seed;
              const error = draftError(draft);
              const dirty = isDirty(seed, draft);
              const pending = pendingReadId === read.id || localPending.has(read.id);
              const openRead = read.outcome === 'reading';
              const controlsDisabled = disabled || pending;
              return (
                <View key={read.id} style={styles.readSection}>
                  <Text style={[LIBRARY_TEXT.label, { color: colors.textPrimary }]}>
                    {`Read ${read.read_number} · ${outcomeLabel(read.outcome)}`}
                  </Text>
                  <Text style={[LIBRARY_TEXT.label, { color: colors.textPrimary }]}>Start</Text>
                  <LibraryDateInput
                    label={`Start date for read ${read.read_number}`}
                    value={draft.start_unknown ? null : draft.started_on}
                    disabled={draft.start_unknown || pending || disabled}
                    onChange={(day) => patchDraft(read.id, { started_on: day })}
                    testID={`library-read-start-${read.id}`}
                  />
                  <Pressable
                    testID={`library-read-start-unknown-${read.id}`}
                    accessibilityRole="checkbox"
                    accessibilityLabel={`I don't remember the start date for read ${read.read_number}`}
                    accessibilityState={{ checked: draft.start_unknown, disabled: pending || disabled }}
                    disabled={pending || disabled}
                    onPress={() => patchDraft(read.id, { start_unknown: !draft.start_unknown })}
                    style={[
                      styles.toggle,
                      {
                        backgroundColor: draft.start_unknown ? colors.bgSecondary : colors.bgCard,
                        borderColor: colors.controlBorder,
                      },
                    ]}
                  >
                    <Text style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}>
                      {draft.start_unknown ? "Start date marked as I don't remember" : "I don't remember the start date"}
                    </Text>
                  </Pressable>
                  <Text style={[LIBRARY_TEXT.label, { color: colors.textPrimary }]}>End</Text>
                  <LibraryDateInput
                    label={`End date for read ${read.read_number}`}
                    value={draft.end_unknown ? null : draft.ended_on}
                    disabled={openRead || draft.end_unknown || pending || disabled}
                    onChange={(day) => patchDraft(read.id, { ended_on: day })}
                    testID={`library-read-end-${read.id}`}
                  />
                  <Pressable
                    testID={`library-read-end-unknown-${read.id}`}
                    accessibilityRole="checkbox"
                    accessibilityLabel={`I don't remember the end date for read ${read.read_number}`}
                    accessibilityState={{ checked: draft.end_unknown, disabled: openRead || pending || disabled }}
                    disabled={openRead || pending || disabled}
                    onPress={() => patchDraft(read.id, { end_unknown: !draft.end_unknown })}
                    style={[
                      styles.toggle,
                      {
                        backgroundColor: draft.end_unknown ? colors.bgSecondary : colors.bgCard,
                        borderColor: colors.controlBorder,
                      },
                    ]}
                  >
                    <Text style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}>
                      {draft.end_unknown ? "End date marked as I don't remember" : "I don't remember the end date"}
                    </Text>
                  </Pressable>
                  {error ? (
                    <Text
                      testID={`library-read-error-${read.id}`}
                      accessibilityLiveRegion="polite"
                      style={[LIBRARY_TEXT.body, { color: colors.error }]}
                    >
                      {error}
                    </Text>
                  ) : null}
                  <BookButton
                    label={pending ? 'Saving…' : 'Save dates'}
                    variant="secondary"
                    disabled={!dirty || !!error || controlsDisabled}
                    onPress={() => {
                      runGuarded(read.id, () =>
                        onSave(read.id, {
                          started_on: draft.start_unknown ? null : draft.started_on,
                          ended_on: draft.end_unknown ? null : draft.ended_on,
                          start_unknown: draft.start_unknown,
                          end_unknown: draft.end_unknown,
                        }),
                      );
                    }}
                    testID={`library-read-save-${read.id}`}
                  />
                  {canRemoveRead(read, latestId, bookStatus) ? (
                    <BookButton
                      label="Remove this read"
                      variant="text"
                      disabled={controlsDisabled}
                      onPress={() => {
                        runGuarded(read.id, () => onRemove(read.id));
                      }}
                      testID={`library-read-remove-${read.id}`}
                    />
                  ) : null}
                  {canReopenRead(read, latestId, reads) ? (
                    <BookButton
                      label="Not finished yet"
                      variant="secondary"
                      disabled={controlsDisabled}
                      onPress={() => {
                        runGuarded(read.id, () => onReopen(read.id));
                      }}
                      testID={`library-read-reopen-${read.id}`}
                    />
                  ) : null}
                </View>
              );
            })}
            <BookButton ref={closeRef} label="Close" variant="primary" onPress={onClose} testID="library-read-dates-close" />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: LIBRARY_SPACING.md,
  },
  dialog: {
    width: '100%',
    maxHeight: '90%',
    alignSelf: 'center',
    maxWidth: DIALOG_MAX_WIDTH,
    borderRadius: LIBRARY_RADIUS.dialog,
    padding: LIBRARY_SPACING.lg,
  },
  dialogContent: {
    gap: LIBRARY_SPACING.md,
  },
  readSection: {
    gap: LIBRARY_SPACING.xs,
  },
  toggle: {
    minHeight: MIN_TARGET,
    justifyContent: 'center',
    paddingHorizontal: LIBRARY_SPACING.sm,
    paddingVertical: LIBRARY_SPACING.xs,
    borderRadius: LIBRARY_RADIUS.control,
    borderWidth: 1,
  },
});
