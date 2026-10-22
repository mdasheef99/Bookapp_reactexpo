import { AccessibilityInfo, Platform } from 'react-native';
import {
  goalSavedMessage,
  leaveOutSavedMessage,
  nextReadSavedMessage,
  noteProgressSavedMessage,
  notifySaveSuccess,
  statusSavedMessage,
} from '../saveConfirmation';

describe('saveConfirmation messages', () => {
  it('marks Finished for every transition to completed', () => {
    expect(statusSavedMessage('reading', 'completed')).toBe('Marked as Finished');
    expect(statusSavedMessage('want_to_read', 'completed')).toBe('Marked as Finished');
    expect(statusSavedMessage('completed', 'completed')).toBe('Marked as Finished');
  });

  it('starts reading for every transition to reading', () => {
    expect(statusSavedMessage('want_to_read', 'reading')).toBe('Started reading');
    expect(statusSavedMessage('reading', 'reading')).toBe('Started reading');
    // From finished via the status control the path does not reread,
    // so it still says Started reading (Reading again is only for startReread).
    expect(statusSavedMessage('completed', 'reading')).toBe('Started reading');
  });

  it('stops reading only from reading to want_to_read', () => {
    expect(statusSavedMessage('reading', 'want_to_read')).toBe('Stopped reading');
  });

  it('moves to Want to read from finished or other to want_to_read', () => {
    expect(statusSavedMessage('completed', 'want_to_read')).toBe('Moved to Want to read');
    expect(statusSavedMessage('want_to_read', 'want_to_read')).toBe('Moved to Want to read');
  });

  it('maps next-read set vs removed', () => {
    expect(nextReadSavedMessage('book-1')).toBe('Next read set');
    expect(nextReadSavedMessage(null)).toBe('Next read removed');
  });

  it('maps goal save vs remove', () => {
    expect(goalSavedMessage(24)).toBe('Goal saved');
    expect(goalSavedMessage(null)).toBe('Goal removed');
  });

  it('maps leave-out vs back-in', () => {
    expect(leaveOutSavedMessage(false)).toBe('Left out of your stats');
    expect(leaveOutSavedMessage(true)).toBe('Back in your stats');
  });

  it('includes the page in the note-prompt message', () => {
    expect(noteProgressSavedMessage(70)).toBe('Progress updated to p. 70');
  });
});

describe('notifySaveSuccess', () => {
  const priorOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    Platform.OS = priorOS;
  });

  it('notifies once with a success toast and never announces itself', () => {
    Platform.OS = 'android';
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
    const notify = jest.fn();
    try {
      notifySaveSuccess(notify as never, 'Progress saved');
      expect(notify).toHaveBeenCalledTimes(1);
      expect(notify).toHaveBeenCalledWith({ kind: 'success', message: 'Progress saved' });
      // The toast lives in a polite live region (TalkBack) and BookFeedback
      // announces on iOS; the helper must not double-announce on Android.
      expect(announce).not.toHaveBeenCalled();
    } finally {
      announce.mockRestore();
    }
  });

  it('relies on the live region and the provider on every platform', () => {
    const notify = jest.fn();
    for (const os of ['android', 'web', 'ios'] as const) {
      Platform.OS = os;
      const announce = jest
        .spyOn(AccessibilityInfo, 'announceForAccessibility')
        .mockImplementation(() => {});
      try {
        notifySaveSuccess(notify as never, 'Dates saved');
        // Android: polite live region; iOS: provider announces; web: aria-live.
        expect(announce).not.toHaveBeenCalled();
      } finally {
        announce.mockRestore();
      }
    }
  });
});
