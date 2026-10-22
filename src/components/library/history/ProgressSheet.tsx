import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import type { ProgressValue } from '@/features/books/history/readingHistoryGateway';
import { LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';
import { DIALOG_MAX_WIDTH } from '../bookDetails/bookDetailsTokens';
import { BookButton, BookFeedbackSlot } from '../ui';

export const PROGRESS_SHEET_TITLE = 'Update progress';

export interface ProgressSheetProps {
  visible: boolean;
  onClose: () => void;
  totalPages: number | null;
  currentPages: number | null;
  currentPercent: number | null;
  onSaveProgress: (value: ProgressValue) => void | Promise<unknown>;
  onSaveTotalPages: (total: number | null) => void | Promise<unknown>;
  pending?: boolean;
  disabled?: boolean;
}

function parseIntegerInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value)) return null;
  return value;
}

export function ProgressSheet({
  visible,
  onClose,
  totalPages,
  currentPages,
  currentPercent,
  onSaveProgress,
  onSaveTotalPages,
  pending = false,
  disabled = false,
}: ProgressSheetProps) {
  const colors = useLibraryAppearance();
  const closeRef = useRef<View>(null);
  const hasTotal = totalPages !== null && totalPages > 0;
  const hasPagePosition = currentPages !== null && currentPages !== undefined;
  const hasPercentPosition = currentPercent !== null && currentPercent !== undefined;
  // Page input when there is a total, or when the latest entry is pages and no
  // total has been added yet. Otherwise % input.
  const isPageInput = hasTotal || hasPagePosition;
  const [draft, setDraft] = useState('');
  const [totalOpen, setTotalOpen] = useState(false);
  const [totalDraft, setTotalDraft] = useState('');
  const [localPending, setLocalPending] = useState(false);
  const pendingRef = useRef(false);
  const mountedRef = useRef(true);
  const seedRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      if (mountedRef.current) {
        setTotalOpen(false);
        setLocalPending(false);
      }
      pendingRef.current = false;
      seedRef.current = null;
      return;
    }
    const modeKey = hasTotal ? 'total' : 'no-total';
    if (seedRef.current === modeKey) return;
    seedRef.current = modeKey;
    if (isPageInput) {
      setDraft(hasPagePosition ? String(currentPages) : '0');
    } else {
      setDraft(hasPercentPosition ? String(currentPercent) : '0');
    }
    setTotalDraft(hasTotal && totalPages !== null ? String(totalPages) : '');
  }, [visible, hasTotal, isPageInput, hasPagePosition, hasPercentPosition, currentPages, currentPercent, totalPages]);

  if (!visible) return null;

  const busy = pending || localPending;
  const controlsDisabled = disabled || busy;
  const parsed = parseIntegerInput(draft);
  const max = hasTotal ? (totalPages as number) : isPageInput ? Number.POSITIVE_INFINITY : 100;
  const draftValid =
    parsed !== null && parsed >= 0 && (hasTotal || !isPageInput ? parsed <= (max as number) : true);
  const draftError =
    parsed === null
      ? isPageInput
        ? 'Enter a whole page number of 0 or more.'
        : 'Enter a whole percent between 0 and 100.'
      : hasTotal && parsed > (totalPages as number)
        ? `Enter a page between 0 and ${totalPages}.`
        : !isPageInput && parsed > 100
          ? 'Enter a whole percent between 0 and 100.'
          : null;

  const clampDraft = (value: number) =>
    hasTotal || !isPageInput ? Math.max(0, Math.min(max as number, value)) : Math.max(0, value);

  const savedPosition = isPageInput ? (currentPages ?? 0) : (currentPercent ?? 0);
  const step = (delta: number) => {
    const base = parsed ?? savedPosition;
    setDraft(String(clampDraft(base + delta)));
  };

  const runGuarded = (fn: () => void | Promise<unknown>) => {
    if (pendingRef.current || pending) return;
    pendingRef.current = true;
    if (mountedRef.current) setLocalPending(true);
    let result: void | Promise<unknown>;
    try {
      result = fn();
    } catch {
      pendingRef.current = false;
      if (mountedRef.current) setLocalPending(false);
      return;
    }
    void Promise.resolve(result).then(
      () => {
        pendingRef.current = false;
        if (mountedRef.current) setLocalPending(false);
      },
      () => {
        pendingRef.current = false;
        if (mountedRef.current) setLocalPending(false);
      },
    );
  };

  const handleSave = () => {
    if (!draftValid || controlsDisabled) return;
    const value: ProgressValue =
      isPageInput && parsed !== null ? { page: parsed } : { percent: parsed as number };
    const capturedPlatform = Platform.OS;
    runGuarded(() =>
      Promise.resolve(onSaveProgress(value)).then(() => {
        if (!mountedRef.current) return;
        if (capturedPlatform !== 'web') {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      }),
    );
  };

  const totalParsed = totalDraft.trim() === '' ? null : parseIntegerInput(totalDraft);
  const totalValid = totalDraft.trim() === '' ? true : totalParsed !== null && totalParsed > 0;
  const totalError =
    totalValid || totalDraft.trim() === ''
      ? null
      : 'Total pages must be a whole number above 0.';

  const handleSaveTotal = () => {
    if (!totalValid || controlsDisabled) return;
    const next = totalDraft.trim() === '' ? null : (totalParsed as number);
    runGuarded(() => onSaveTotalPages(next));
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
          accessibilityLabel={PROGRESS_SHEET_TITLE}
          style={[styles.dialog, { backgroundColor: colors.bgRaised }]}
        >
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.dialogContent}>
            <BookFeedbackSlot />
            <Text accessibilityRole="header" style={[LIBRARY_TEXT.heading, { color: colors.textPrimary }]}>
              {PROGRESS_SHEET_TITLE}
            </Text>
            {hasTotal ? (
              <Text
                testID="library-progress-header"
                style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}
              >
                {`Page ${parsed !== null ? parsed : (currentPages ?? 0)} of ${totalPages}`}
              </Text>
            ) : isPageInput ? (
              <Text
                testID="library-progress-header"
                style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}
              >
                {`Currently on page ${parsed !== null ? parsed : (currentPages ?? 0)} (no total pages)`}
              </Text>
            ) : (
              <Text
                testID="library-progress-header"
                style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}
              >
                {`Currently ${parsed !== null ? parsed : (currentPercent ?? 0)}% (no total pages yet)`}
              </Text>
            )}
            <View style={styles.stepRow}>
              {isPageInput ? (
                <>
                  <BookButton
                    label="-10"
                    variant="secondary"
                    disabled={controlsDisabled}
                    onPress={() => step(-10)}
                    testID="library-progress-minus-10"
                  />
                  <BookButton
                    label="+10"
                    variant="secondary"
                    disabled={controlsDisabled}
                    onPress={() => step(10)}
                    testID="library-progress-plus-10"
                  />
                  <BookButton
                    label="+25"
                    variant="secondary"
                    disabled={controlsDisabled}
                    onPress={() => step(25)}
                    testID="library-progress-plus-25"
                  />
                </>
              ) : (
                <>
                  <BookButton
                    label="-5"
                    variant="secondary"
                    disabled={controlsDisabled}
                    onPress={() => step(-5)}
                    testID="library-progress-minus-5"
                  />
                  <BookButton
                    label="+5"
                    variant="secondary"
                    disabled={controlsDisabled}
                    onPress={() => step(5)}
                    testID="library-progress-plus-5"
                  />
                  <BookButton
                    label="+10"
                    variant="secondary"
                    disabled={controlsDisabled}
                    onPress={() => step(10)}
                    testID="library-progress-plus-10"
                  />
                </>
              )}
            </View>
            <Text style={[LIBRARY_TEXT.label, { color: colors.textPrimary }]}>
              {isPageInput ? 'Current page' : 'Current percent'}
            </Text>
            <TextInput
              testID="library-progress-input"
              accessibilityLabel={isPageInput ? 'Current page' : 'Current percent'}
              accessibilityState={{ disabled: controlsDisabled }}
              keyboardType="number-pad"
              inputMode="numeric"
              editable={!controlsDisabled}
              value={draft}
              onChangeText={setDraft}
              style={[
                LIBRARY_TEXT.body,
                styles.input,
                { backgroundColor: colors.bgSecondary, color: colors.textPrimary, borderColor: colors.controlBorder },
              ]}
            />
            {draftError ? (
              <Text
                testID="library-progress-error"
                accessibilityLiveRegion="polite"
                style={[LIBRARY_TEXT.body, { color: colors.error }]}
              >
                {draftError}
              </Text>
            ) : null}
            <BookButton
              label={busy ? 'Saving…' : 'Save progress'}
              variant="primary"
              disabled={!draftValid || controlsDisabled}
              onPress={handleSave}
              testID="library-progress-save"
            />
            <BookButton
              label={totalOpen ? 'Hide total pages' : 'Change total pages'}
              variant="text"
              disabled={controlsDisabled}
              onPress={() => setTotalOpen((open) => !open)}
              testID="library-progress-total-toggle"
            />
            {totalOpen ? (
              <View style={styles.totalSection}>
                <Text style={[LIBRARY_TEXT.label, { color: colors.textPrimary }]}>Total pages</Text>
                <TextInput
                  testID="library-progress-total-input"
                  accessibilityLabel="Total pages"
                  accessibilityState={{ disabled: controlsDisabled }}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  editable={!controlsDisabled}
                  value={totalDraft}
                  onChangeText={setTotalDraft}
                  placeholder="No total"
                  placeholderTextColor={colors.textTertiary}
                  style={[
                    LIBRARY_TEXT.body,
                    styles.input,
                    { backgroundColor: colors.bgSecondary, color: colors.textPrimary, borderColor: colors.controlBorder },
                  ]}
                />
                {totalError ? (
                  <Text
                    testID="library-progress-total-error"
                    accessibilityLiveRegion="polite"
                    style={[LIBRARY_TEXT.body, { color: colors.error }]}
                  >
                    {totalError}
                  </Text>
                ) : null}
                <BookButton
                  label="Save total"
                  variant="secondary"
                  disabled={!totalValid || controlsDisabled}
                  onPress={handleSaveTotal}
                  testID="library-progress-total-save"
                />
                {totalPages !== null ? (
                  <BookButton
                    label="Remove total pages"
                    variant="text"
                    disabled={controlsDisabled}
                    onPress={() => {
                      runGuarded(() => onSaveTotalPages(null));
                    }}
                    testID="library-progress-total-remove"
                  />
                ) : null}
              </View>
            ) : null}
            <BookButton ref={closeRef} label="Close" variant="secondary" onPress={onClose} testID="library-progress-close" />
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
  stepRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: LIBRARY_SPACING.xs,
  },
  input: {
    minHeight: MIN_TARGET,
    borderRadius: LIBRARY_RADIUS.control,
    paddingHorizontal: LIBRARY_SPACING.sm,
    paddingVertical: LIBRARY_SPACING.xs,
    borderWidth: 1,
  },
  totalSection: {
    gap: LIBRARY_SPACING.xs,
  },
});
