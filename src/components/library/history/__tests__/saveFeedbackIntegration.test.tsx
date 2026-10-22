import React, { useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { EditDatesSheet } from '../EditDatesSheet';
import { BookFeedbackProvider, useBookFeedback } from '../../ui/BookFeedback';
import { notifySaveSuccess } from '@/features/books/history/saveConfirmation';
import { ReadingRead } from '@/features/books/history/readingHistoryContract';

jest.setTimeout(20000);

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return function MockDateTimePicker(props: any) {
    return (
      <Pressable
        testID={props.testID}
        accessibilityLabel="Mock date picker"
        onPress={() => props.onChange({ type: 'set' }, new Date(2026, 9, 5, 12))}
      >
        <Text>MockPicker</Text>
      </Pressable>
    );
  };
});

function baseRead(): ReadingRead {
  return {
    id: 'read-1',
    user_book_id: 'book-1',
    user_id: 'actor',
    read_number: 1,
    outcome: 'finished',
    started_at: null,
    ended_at: null,
    started_on: '2026-10-01',
    ended_on: '2026-10-20',
    start_unknown: false,
    end_unknown: false,
    total_pages: null,
    counts_in_stats: true,
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-02T10:00:00.000Z',
  };
}

function Harness() {
  const { notify } = useBookFeedback();
  const [visible, setVisible] = useState(true);
  return (
    <EditDatesSheet
      visible={visible}
      onClose={() => setVisible(false)}
      bookStatus="completed"
      reads={[baseRead()]}
      onSave={() => {
        notifySaveSuccess(notify, 'Dates saved');
        return Promise.resolve({ id: 'read-1' });
      }}
      onRemove={() => Promise.resolve(true)}
      onReopen={() => Promise.resolve(undefined)}
    />
  );
}

function renderReal() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <BookFeedbackProvider>
        <Harness />
      </BookFeedbackProvider>
    </QueryClientProvider>,
  );
}

describe('save feedback integration (real provider + sheet)', () => {
  it('saves, shows the toast once, keeps it after close, announces exactly once', async () => {
    const priorOS = Platform.OS;
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
    const ui = renderReal();
    try {
      // Make the draft dirty via the unknown toggle, then save.
      fireEvent.press(await ui.findByTestId('library-read-start-unknown-read-1'));
      const save = ui.getByTestId('library-read-save-read-1');
      await waitFor(() => expect(save.props.accessibilityState.disabled).toBe(false));
      fireEvent.press(save);
      // Toast text is present exactly once (slot xor host, never duplicated).
      await waitFor(() => expect(ui.getByText('Dates saved')).toBeOnTheScreen());
      expect(ui.getAllByText('Dates saved')).toHaveLength(1);
      // The visible toast lives in a polite live region.
      expect(ui.getByTestId('book-feedback-live-region').props.accessibilityLiveRegion).toBe('polite');
      // Exactly one announcement for the current platform:
      // iOS via the provider, Android/web via the polite live region (no helper double).
      if (priorOS === 'ios') {
        expect(announce).toHaveBeenCalledTimes(1);
        expect(announce).toHaveBeenCalledWith('Dates saved');
      } else {
        expect(announce).not.toHaveBeenCalled();
        expect(ui.getByTestId('book-feedback-live-region')).toBeOnTheScreen();
      }
      // The sheet closes; the toast must still be visible (host takes over from the slot).
      fireEvent.press(ui.getByTestId('library-read-dates-close'));
      await waitFor(() => expect(ui.getByText('Dates saved')).toBeOnTheScreen());
      expect(ui.getAllByText('Dates saved')).toHaveLength(1);
      if (priorOS === 'ios') {
        expect(announce).toHaveBeenCalledTimes(1);
      } else {
        expect(announce).not.toHaveBeenCalled();
      }
    } finally {
      ui.unmount();
      announce.mockRestore();
      Platform.OS = priorOS;
    }
  });
});
