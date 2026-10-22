import type { BookFeedbackApi } from '@/components/library/ui';

/**
 * One shared save-confirmation helper (SDD-09 follow-up).
 * Shows the existing library toast. Announcement is once per platform via
 * existing mechanisms: the toast lives in a `polite` live region (TalkBack
 * on Android, `aria-live` on web) and `BookFeedback` calls
 * `AccessibilityInfo.announceForAccessibility` on iOS. This helper never
 * announces itself, so Android is not announced twice.
 */
export function notifySaveSuccess(
  notify: BookFeedbackApi['notify'],
  message: string,
): void {
  notify({ kind: 'success', message });
}

/**
 * Status-specific confirmation for the Book Details status control.
 * Derived from previous + new status so each transition says exactly once:
 * - `-> completed` is always "Marked as Finished".
 * - `-> reading` is always "Started reading" (the status control never
 *   rereads; "Reading again" is only for the `startReread` path).
 * - `reading -> want_to_read` is "Stopped reading".
 * - any other `-> want_to_read` (from finished/completed) is
 *   "Moved to Want to read".
 */
export function statusSavedMessage(
  previous: 'want_to_read' | 'reading' | 'completed',
  next: 'want_to_read' | 'reading' | 'completed',
): string {
  if (next === 'completed') return 'Marked as Finished';
  if (next === 'reading') return 'Started reading';
  if (previous === 'reading') return 'Stopped reading';
  return 'Moved to Want to read';
}

/** Next-read confirmation (set vs removed). */
export function nextReadSavedMessage(nextBookId: string | null): string {
  return nextBookId === null ? 'Next read removed' : 'Next read set';
}

/** Goal confirmation (save vs remove). */
export function goalSavedMessage(target: number | null): string {
  return target === null ? 'Goal removed' : 'Goal saved';
}

/** Leave-out confirmation (excluded vs back in). */
export function leaveOutSavedMessage(countsInStats: boolean): string {
  return countsInStats ? 'Back in your stats' : 'Left out of your stats';
}

/** Note-prompt confirmation with the exact page. */
export function noteProgressSavedMessage(page: number): string {
  return `Progress updated to p. ${page}`;
}
