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
import {
  ROUGH_ESTIMATE_DAYS,
  estimateDay,
  roughEstimateLabel,
  todayDay,
} from '@/features/books/history/estimateDay';
import { ChoiceRadioGroup } from '../bookDetails/ChoiceRadioGroup';
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
  timeZone?: string;
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

const ESTIMATE_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Short day hint for an estimated YYYY-MM-DD, e.g. "15 Oct". Locale-stable. */
export function formatEstimateHint(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  const month = Number(match[2]);
  const date = Number(match[3]);
  if (month < 1 || month > 12) return day;
  return `${date} ${ESTIMATE_MONTHS[month - 1]}`;
}

/** Option label with the computed day; clamped-to-today estimates say "(today)". */
export function estimateOptionLabel(base: string, estimated: string, today: string): string {
  if (estimated === today) return `${base} (today)`;
  return `${base} (${formatEstimateHint(estimated)})`;
}

function draftError(draft: DateDraft, today: string): string | null {
  for (const day of [draft.started_on, draft.ended_on]) {
    if (day === null) continue;
    if (!isRealDay(day)) return 'Enter a real calendar date (YYYY-MM-DD).';
    if (day > today) return "Reading dates can't be in the future.";
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
  timeZone,
}: EditDatesSheetProps) {
  const colors = useLibraryAppearance();
  const closeRef = useRef<View>(null);
  const [drafts, setDrafts] = useState<Record<string, DateDraft>>({});
  const [roughStart, setRoughStart] = useState<Record<string, string>>({});
  const [roughEnd, setRoughEnd] = useState<Record<string, string>>({});
  const [localPending, setLocalPending] = useState<ReadonlySet<string>>(new Set());
  const pendingRef = useRef<Set<string>>(new Set());
  const seedVersions = useRef<Record<string, string>>(Object.create(null));

  useEffect(() => {
    if (!visible) {
      setDrafts((current) => (Object.keys(current).length === 0 ? current : {}));
      setRoughStart((current) => (Object.keys(current).length === 0 ? current : {}));
      setRoughEnd((current) => (Object.keys(current).length === 0 ? current : {}));
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

  const today = todayDay(timeZone);
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
            <Text accessibilityRole="header" style={[LIBRARY_TEXT.heading, { color: colors.textPrimary }]}>
              {EDIT_DATES_SHEET_TITLE}
            </Text>
            {sorted.map((read) => {
              const seed = draftOf(read);
              const draft = drafts[read.id] ?? seed;
              const error = draftError(draft, today);
              const dirty = isDirty(seed, draft);
              const pending = pendingReadId === read.id || localPending.has(read.id);
              const openRead = read.outcome === 'reading';
              const controlsDisabled = disabled || pending;
              const endKnownForStart =
                !draft.end_unknown && draft.ended_on !== null && isRealDay(draft.ended_on);
              const startReference = endKnownForStart ? (draft.ended_on as string) : today;
              const startSuffix = endKnownForStart ? 'before I finished' : 'ago';
              const startKnownForEnd =
                !draft.start_unknown && draft.started_on !== null && isRealDay(draft.started_on);
              const endReference = startKnownForEnd ? (draft.started_on as string) : today;
              const endSuffix = startKnownForEnd ? 'after I started' : 'ago';
              const endDirection = startKnownForEnd ? 'after' : 'before';
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
                    onPress={() => {
                      if (!draft.start_unknown) {
                        setRoughStart((current) => ({ ...current, [read.id]: 'unsure' }));
                        patchDraft(read.id, { start_unknown: true, started_on: null });
                      } else {
                        patchDraft(read.id, { start_unknown: false });
                      }
                    }}
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
                  {draft.start_unknown ? (
                    <ChoiceRadioGroup
                      label={`Roughly when did you start read ${read.read_number}?`}
                      value={roughStart[read.id] ?? 'unsure'}
                      options={[
                        { value: 'unsure', label: 'Not sure' },
                        ...ROUGH_ESTIMATE_DAYS.map((days) => {
                          const estimated = estimateDay(startReference, days, 'before', today);
                          const base = `${roughEstimateLabel(days)} ${startSuffix}`;
                          return {
                            value: String(days),
                            label: estimateOptionLabel(base, estimated, today),
                          };
                        }),
                      ]}
                      onChange={(value) => {
                        if (value === 'unsure') {
                          setRoughStart((current) => ({ ...current, [read.id]: 'unsure' }));
                          return;
                        }
                        const estimated = estimateDay(startReference, Number(value), 'before', today);
                        setRoughStart((current) => ({ ...current, [read.id]: value }));
                        patchDraft(read.id, { started_on: estimated, start_unknown: false });
                      }}
                      disabled={controlsDisabled}
                      testID={`library-read-start-rough-${read.id}`}
                    />
                  ) : null}
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
                    onPress={() => {
                      if (!draft.end_unknown) {
                        setRoughEnd((current) => ({ ...current, [read.id]: 'unsure' }));
                        patchDraft(read.id, { end_unknown: true, ended_on: null });
                      } else {
                        patchDraft(read.id, { end_unknown: false });
                      }
                    }}
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
                  {draft.end_unknown && !openRead ? (
                    <ChoiceRadioGroup
                      label={`Roughly when did you finish read ${read.read_number}?`}
                      value={roughEnd[read.id] ?? 'unsure'}
                      options={[
                        { value: 'unsure', label: 'Not sure' },
                        ...ROUGH_ESTIMATE_DAYS.map((days) => {
                          const estimated = estimateDay(
                            endReference,
                            days,
                            endDirection as 'before' | 'after',
                            today,
                          );
                          const base = `${roughEstimateLabel(days)} ${endSuffix}`;
                          return {
                            value: String(days),
                            label: estimateOptionLabel(base, estimated, today),
                          };
                        }),
                      ]}
                      onChange={(value) => {
                        if (value === 'unsure') {
                          setRoughEnd((current) => ({ ...current, [read.id]: 'unsure' }));
                          return;
                        }
                        const estimated = estimateDay(
                          endReference,
                          Number(value),
                          endDirection as 'before' | 'after',
                          today,
                        );
                        setRoughEnd((current) => ({ ...current, [read.id]: value }));
                        patchDraft(read.id, { ended_on: estimated, end_unknown: false });
                      }}
                      disabled={controlsDisabled}
                      testID={`library-read-end-rough-${read.id}`}
                    />
                  ) : null}
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
          <View pointerEvents="box-none" style={styles.feedbackOverlay}>
            <BookFeedbackSlot />
          </View>
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
  feedbackOverlay: {
    position: 'absolute',
    top: LIBRARY_SPACING.sm,
    left: LIBRARY_SPACING.sm,
    right: LIBRARY_SPACING.sm,
    zIndex: 1,
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
