import React, { useState } from 'react';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ReadingDatesSlot, noDatesPromptStorageKey } from '../ReadingDatesSlot';
import { canRemoveRead, canReopenRead, EDIT_DATES_SHEET_TITLE, EditDatesSheet } from '../EditDatesSheet';
import { LibraryDateInput } from '../LibraryDateInput';
import { ReadingRead } from '@/features/books/history/readingHistoryContract';
import { ReadDatesPatch } from '@/features/books/history/readingHistoryGateway';
import { BookFeedbackProvider } from '../../ui/BookFeedback';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
jest.mock('@react-native-async-storage/async-storage', () => {
  const backing = new Map<string, string>();
  return {
    getItem: jest.fn((key: string) => Promise.resolve(backing.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      backing.set(key, value);
      return Promise.resolve();
    }),
    __backing: backing,
  };
});

const backing = (AsyncStorage as unknown as { __backing: Map<string, string> }).__backing;

function baseRead(overrides: Partial<ReadingRead> = {}): ReadingRead {
  return {
    id: 'read-1',
    user_book_id: 'book-1',
    user_id: 'actor',
    read_number: 1,
    outcome: 'finished',
    started_at: null,
    ended_at: null,
    started_on: null,
    ended_on: '2026-10-20',
    start_unknown: false,
    end_unknown: false,
    total_pages: null,
    counts_in_stats: true,
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-02T10:00:00.000Z',
    ...overrides,
  };
}

function shortDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

function renderSlot(
  reads: ReadingRead[],
  handlers: {
    onEditDates?: () => void;
    onMarkUnknown?: (readId: string) => void | Promise<unknown>;
    unknownPending?: boolean;
    disabled?: boolean;
    mode?: 'full' | 'text' | 'controls';
  } = {},
) {
  const onEditDates = handlers.onEditDates ?? jest.fn();
  const onMarkUnknown = handlers.onMarkUnknown ?? jest.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const ui = render(
    <QueryClientProvider client={client}>
      <BookFeedbackProvider>
        <ReadingDatesSlot
          actorId="actor"
          reads={reads}
          onEditDates={onEditDates}
          onMarkUnknown={onMarkUnknown}
          unknownPending={handlers.unknownPending}
          disabled={handlers.disabled}
          mode={handlers.mode}
        />
      </BookFeedbackProvider>
    </QueryClientProvider>,
  );
  return { onEditDates, onMarkUnknown, client, ...ui };
}

function renderSheet(
  reads: ReadingRead[],
  options: {
    bookStatus?: 'want_to_read' | 'reading' | 'completed';
    onSave?: (readId: string, patch: ReadDatesPatch) => void | Promise<void>;
    onRemove?: (readId: string) => void | Promise<void>;
    onReopen?: (readId: string) => void | Promise<void>;
  } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const props = {
    visible: true,
    onClose: jest.fn(),
    bookStatus: options.bookStatus ?? ('completed' as const),
    reads,
    onSave: options.onSave ?? jest.fn(),
    onRemove: options.onRemove ?? jest.fn(),
    onReopen: options.onReopen ?? jest.fn(),
  };
  const ui = render(
    <QueryClientProvider client={client}>
      <BookFeedbackProvider>
        <EditDatesSheet {...props} />
      </BookFeedbackProvider>
    </QueryClientProvider>,
  );
  return { client, ...props, ...ui };
}

beforeEach(() => {
  backing.clear();
  jest.clearAllMocks();
});

describe('ReadingDatesSlot', () => {
  // Generous timeout: the first test warms up the suite under the full parallel run.
  it('renders the slot text for a finished read', async () => {
    const ui = renderSlot([baseRead({ outcome: 'finished', ended_on: '2026-10-20' })]);
    try {
      expect(await ui.findByTestId('library-reading-dates-text')).toHaveTextContent(
        `Finished ${shortDay('2026-10-20')}`,
      );
    } finally {
      ui.unmount();
    }
  }, 20000);

  it('renders nothing when there are no reads', () => {
    const ui = renderSlot([]);
    try {
      expect(ui.queryByTestId('library-reading-dates-slot')).toBeNull();
    } finally {
      ui.unmount();
    }
  });

  it('shows the one-time no-dates prompt and dismisses it with Not sure', async () => {
    const saved: { readId: string; patch: ReadDatesPatch }[] = [];
    const ui = renderSlot([baseRead({ outcome: 'finished', started_on: null, started_at: null })], {
      // Mirrors the Book Details wiring: Not sure sets both unknown flags.
      onMarkUnknown: (readId: string) => {
        saved.push({ readId, patch: { start_unknown: true, end_unknown: true } });
      },
    });
    try {
      const prompt = await ui.findByTestId('library-reading-dates-nostart');
      expect(prompt).toBeOnTheScreen();
      fireEvent.press(ui.getByTestId('library-reading-dates-notsure'));
      expect(saved).toEqual([{ readId: 'read-1', patch: { start_unknown: true, end_unknown: true } }]);
      await waitFor(() =>
        expect(ui.queryByTestId('library-reading-dates-nostart')).toBeNull(),
      );
      expect(backing.get(noDatesPromptStorageKey('actor', 'read-1'))).toBe('1');
    } finally {
      ui.unmount();
    }

    // A remount (or an app restart reading the same key) does not show it again.
    // Generous timeout: under the full parallel suite this worker can be starved.
    const again = renderSlot([baseRead({ outcome: 'finished', started_on: null, started_at: null })]);
    try {
      await waitFor(
        () => expect(again.queryByTestId('library-reading-dates-nostart')).toBeNull(),
        { timeout: 10000 },
      );
      expect(again.queryByTestId('library-reading-dates-slot')).toBeOnTheScreen();
    } finally {
      again.unmount();
    }
  });

  it('does not show the prompt when the start is known', async () => {
    const ui = renderSlot([baseRead({ outcome: 'finished', started_on: '2026-10-01' })]);
    try {
      await ui.findByTestId('library-reading-dates-slot');
      await waitFor(() =>
        expect(ui.queryByTestId('library-reading-dates-nostart')).toBeNull(),
      );
    } finally {
      ui.unmount();
    }
  });

  it('does not show the prompt when start is marked unknown', async () => {
    const ui = renderSlot([
      baseRead({ outcome: 'finished', started_on: null, started_at: null, start_unknown: true }),
    ]);
    try {
      await ui.findByTestId('library-reading-dates-slot');
      await waitFor(() =>
        expect(ui.queryByTestId('library-reading-dates-nostart')).toBeNull(),
      );
    } finally {
      ui.unmount();
    }
  });

  it('renders nothing until the dismissal is known', async () => {
    const getItem = AsyncStorage.getItem as jest.Mock;
    getItem.mockImplementationOnce(() => new Promise(() => {}));
    const ui = renderSlot([baseRead({ outcome: 'finished', ended_on: '2026-10-20' })]);
    try {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      expect(ui.queryByTestId('library-reading-dates-slot')).toBeNull();
    } finally {
      ui.unmount();
    }
  });

  it('persists dismissal only after Not sure succeeds', async () => {
    const ok = renderSlot([baseRead({ outcome: 'finished', started_on: null, started_at: null })], {
      onMarkUnknown: () => Promise.resolve({ id: 'read-1' }),
    });
    try {
      fireEvent.press(await ok.findByTestId('library-reading-dates-notsure'));
      await waitFor(() =>
        expect(backing.get(noDatesPromptStorageKey('actor', 'read-1'))).toBe('1'),
      );
    } finally {
      ok.unmount();
    }
    backing.clear();

    const failing = renderSlot(
      [baseRead({ outcome: 'finished', started_on: null, started_at: null })],
      { onMarkUnknown: () => Promise.reject(new Error('history down')) },
    );
    try {
      fireEvent.press(await failing.findByTestId('library-reading-dates-notsure'));
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(backing.get(noDatesPromptStorageKey('actor', 'read-1'))).toBeUndefined();
      expect(failing.queryByTestId('library-reading-dates-nostart')).not.toBeNull();
    } finally {
      failing.unmount();
    }
  });

  it('Add dates opens the sheet without dismissing first', async () => {
    const onEditDates = jest.fn();
    const ui = renderSlot([baseRead({ outcome: 'finished', started_on: null, started_at: null })], {
      onEditDates,
    });
    try {
      fireEvent.press(await ui.findByTestId('library-reading-dates-add'));
      expect(onEditDates).toHaveBeenCalledTimes(1);
      expect(backing.get(noDatesPromptStorageKey('actor', 'read-1'))).toBeUndefined();
      expect(ui.queryByTestId('library-reading-dates-nostart')).not.toBeNull();
    } finally {
      ui.unmount();
    }
  });

  it('disables Edit dates and prompt buttons when offline', async () => {
    const ui = renderSlot([baseRead({ outcome: 'finished', started_on: null, started_at: null })], {
      disabled: true,
    });
    try {
      expect((await ui.findByTestId('library-reading-dates-edit')).props.accessibilityState.disabled).toBe(true);
      await ui.findByTestId('library-reading-dates-nostart');
      expect(ui.getByTestId('library-reading-dates-add').props.accessibilityState.disabled).toBe(true);
      expect(ui.getByTestId('library-reading-dates-notsure').props.accessibilityState.disabled).toBe(true);
    } finally {
      ui.unmount();
    }
  });

  it('double tap on Not sure sends one request', async () => {
    let calls = 0;
    const ui = renderSlot([baseRead({ outcome: 'finished', started_on: null, started_at: null })], {
      onMarkUnknown: () => {
        calls += 1;
        return new Promise<void>((resolve) => setTimeout(resolve, 20));
      },
    });
    try {
      const button = await ui.findByTestId('library-reading-dates-notsure');
      act(() => {
        fireEvent.press(button);
        fireEvent.press(button);
      });
      expect(calls).toBe(1);
      await waitFor(() => expect(calls).toBe(1));
      await waitFor(() =>
        expect(backing.get(noDatesPromptStorageKey('actor', 'read-1'))).toBe('1'),
      );
      expect(calls).toBe(1);
    } finally {
      ui.unmount();
    }
  });

  it('does not reset loaded when only updated_at changes for the same read id', async () => {
    const getItem = AsyncStorage.getItem as jest.Mock;
    const first = [baseRead({ outcome: 'finished', started_on: null, started_at: null, updated_at: '2026-10-02T10:00:00.000Z' })];
    const ui = renderSlot(first);
    try {
      await ui.findByTestId('library-reading-dates-nostart');
      expect(getItem).toHaveBeenCalledTimes(1);
      const updated = [baseRead({ outcome: 'finished', started_on: null, started_at: null, updated_at: '2026-10-03T10:00:00.000Z' })];
      ui.rerender(
        <QueryClientProvider client={ui.client}>
          <BookFeedbackProvider>
            <ReadingDatesSlot
              actorId="actor"
              reads={updated}
              onEditDates={ui.onEditDates}
              onMarkUnknown={ui.onMarkUnknown}
            />
          </BookFeedbackProvider>
        </QueryClientProvider>,
      );
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(getItem).toHaveBeenCalledTimes(1);
      expect(ui.queryByTestId('library-reading-dates-nostart')).not.toBeNull();
    } finally {
      ui.unmount();
    }
  });
});

describe('EditDatesSheet', () => {
  it('opens as a named dialog with labelled start and end controls', async () => {
    const ui = renderSheet([baseRead({ id: 'read-1', read_number: 1 })]);
    try {
      const dialog = await waitFor(() =>
        ui.UNSAFE_root.find(
          (node: any) => node.type === 'View' && node.props.accessibilityViewIsModal === true,
        ),
      );
      expect(dialog.props.accessibilityLabel).toBe(EDIT_DATES_SHEET_TITLE);
      expect(ui.getByLabelText('Start date for read 1')).toBeOnTheScreen();
      expect(ui.getByLabelText('End date for read 1')).toBeOnTheScreen();
    } finally {
      ui.unmount();
    }
  });

  it('lists reads newest first and disables End for an open read', async () => {
    const ui = renderSheet(
      [
        baseRead({ id: 'read-1', read_number: 1, outcome: 'finished', ended_on: '2026-09-01' }),
        baseRead({ id: 'read-2', read_number: 2, outcome: 'reading', started_on: '2026-10-01' }),
      ],
      { bookStatus: 'reading' },
    );
    try {
      const labels = ui.UNSAFE_root.findAll(
        (node: any) =>
          typeof node.type === 'string' &&
          (node.props.children === 'Read 2 · Reading' || node.props.children === 'Read 1 · Finished'),
      ).map((node: any) => node.props.children);
      expect(labels[0]).toBe('Read 2 · Reading');
      expect(ui.getByTestId('library-read-end-read-2').props.accessibilityState.disabled).toBe(true);
      expect(ui.getByTestId('library-read-start-read-2').props.accessibilityState.disabled).toBe(false);
    } finally {
      ui.unmount();
    }
  });

  it('hides Remove for the open read and for the latest read of a Finished book', async () => {
    const openUi = renderSheet(
      [baseRead({ id: 'read-1', read_number: 1, outcome: 'reading', started_on: '2026-10-01' })],
      { bookStatus: 'reading' },
    );
    try {
      await waitFor(() =>
        expect(openUi.queryByTestId('library-read-remove-read-1')).toBeNull(),
      );
    } finally {
      openUi.unmount();
    }

    const finishedUi = renderSheet(
      [baseRead({ id: 'read-1', read_number: 1, outcome: 'finished', ended_on: '2026-10-20' })],
      { bookStatus: 'completed' },
    );
    try {
      await waitFor(() =>
        expect(finishedUi.queryByTestId('library-read-remove-read-1')).toBeNull(),
      );
    } finally {
      finishedUi.unmount();
    }

    const olderUi = renderSheet(
      [
        baseRead({ id: 'read-1', read_number: 1, outcome: 'finished', ended_on: '2026-09-01' }),
        baseRead({ id: 'read-2', read_number: 2, outcome: 'finished', ended_on: '2026-10-20' }),
      ],
      { bookStatus: 'completed' },
    );
    try {
      expect(await olderUi.findByTestId('library-read-remove-read-1')).toBeOnTheScreen();
      expect(olderUi.queryByTestId('library-read-remove-read-2')).toBeNull();
    } finally {
      olderUi.unmount();
    }
  });

  it('calls reopen from Not finished yet on the latest finished read with no open read', async () => {
    const onReopen = jest.fn();
    const ui = renderSheet(
      [baseRead({ id: 'read-1', read_number: 1, outcome: 'finished', ended_on: '2026-10-20' })],
      { bookStatus: 'completed', onReopen },
    );
    try {
      fireEvent.press(await ui.findByTestId('library-read-reopen-read-1'));
      expect(onReopen).toHaveBeenCalledWith('read-1');
    } finally {
      ui.unmount();
    }
  });

  it('saves both unknown flags through the I-don\'t-remember toggles', async () => {
    const onSave = jest.fn();
    const ui = renderSheet(
      [baseRead({ id: 'read-1', read_number: 1, outcome: 'finished', ended_on: '2026-10-20' })],
      { bookStatus: 'completed', onSave },
    );
    try {
      fireEvent.press(await ui.findByTestId('library-read-start-unknown-read-1'));
      fireEvent.press(ui.getByTestId('library-read-end-unknown-read-1'));
      const save = ui.getByTestId('library-read-save-read-1');
      await waitFor(() => expect(save.props.accessibilityState.disabled).toBe(false));
      fireEvent.press(save);
      expect(onSave).toHaveBeenCalledWith('read-1', {
        started_on: null,
        ended_on: null,
        start_unknown: true,
        end_unknown: true,
      });
    } finally {
      ui.unmount();
    }
  });

  it('blocks saving a start after the end', async () => {
    const onSave = jest.fn();
    const ui = renderSheet(
      [
        baseRead({
          id: 'read-1',
          read_number: 1,
          outcome: 'finished',
          started_on: '2026-10-01',
          ended_on: '2026-10-02',
        }),
      ],
      { bookStatus: 'completed', onSave },
    );
    try {
      // The mocked picker always picks 2026-10-05, which is after the 2026-10-02 end.
      // iOS commits on Done, not on every change.
      fireEvent.press(await ui.findByTestId('library-read-start-read-1'));
      await waitFor(() => expect(ui.getByTestId('library-read-start-read-1-picker')).toBeOnTheScreen());
      fireEvent.press(ui.getByTestId('library-read-start-read-1-picker'));
      fireEvent.press(await ui.findByTestId('library-read-start-read-1-done'));
      await waitFor(() =>
        expect(ui.getByTestId('library-read-error-read-1')).toHaveTextContent(
          "The start date can't be after the end date.",
        ),
      );
      expect(ui.getByTestId('library-read-save-read-1').props.accessibilityState.disabled).toBe(true);
      expect(onSave).not.toHaveBeenCalled();
    } finally {
      ui.unmount();
    }
  });

  it('seeds drafts from effective days so trigger-recorded instants are visible', async () => {
    const onSave = jest.fn();
    const ui = renderSheet(
      [
        baseRead({
          id: 'read-1',
          read_number: 1,
          outcome: 'reading',
          started_at: '2026-10-02T10:00:00.000Z',
          started_on: null,
          ended_on: null,
          start_unknown: false,
          end_unknown: false,
        }),
      ],
      { bookStatus: 'reading', onSave },
    );
    try {
      const field = await ui.findByTestId('library-read-start-read-1');
      const expected = new Date(2026, 9, 2, 12).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      expect(field.props.accessibilityValue).toMatchObject({ text: expected });
    } finally {
      ui.unmount();
    }
  });

  it('reseeds a draft when the server row changes and resets drafts on close', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const onSave = jest.fn();
    const first = [baseRead({ id: 'read-1', read_number: 1, updated_at: '2026-10-02T10:00:00.000Z', ended_on: '2026-10-20' })];
    const ui = render(
      <QueryClientProvider client={client}>
        <BookFeedbackProvider>
          <EditDatesSheet
            visible
            onClose={jest.fn()}
            bookStatus="completed"
            reads={first}
            onSave={onSave}
            onRemove={jest.fn()}
            onReopen={jest.fn()}
          />
        </BookFeedbackProvider>
      </QueryClientProvider>,
    );
    try {
      await ui.findByTestId('library-read-save-read-1');
      const updated = [baseRead({ id: 'read-1', read_number: 1, updated_at: '2026-10-21T10:00:00.000Z', ended_on: '2026-10-21' })];
      ui.rerender(
        <QueryClientProvider client={client}>
          <BookFeedbackProvider>
            <EditDatesSheet
              visible
              onClose={jest.fn()}
              bookStatus="completed"
              reads={updated}
              onSave={onSave}
              onRemove={jest.fn()}
              onReopen={jest.fn()}
            />
          </BookFeedbackProvider>
        </QueryClientProvider>,
      );
      await waitFor(() => {
        const field = ui.getByTestId('library-read-end-read-1');
        expect(field.props.accessibilityValue).toMatchObject({
          text: new Date(2026, 9, 21, 12).toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }),
        });
      });
    } finally {
      ui.unmount();
    }
  });

  it('disables Save, Remove and Reopen when offline', async () => {
    const ui = renderSheet(
      [baseRead({ id: 'read-1', read_number: 1, outcome: 'finished', ended_on: '2026-10-20' })],
      { bookStatus: 'completed' },
    );
    try {
      const { rerender } = ui;
      const client = ui.client;
      rerender(
        <QueryClientProvider client={client}>
          <BookFeedbackProvider>
            <EditDatesSheet
              visible
              onClose={ui.onClose}
              bookStatus="completed"
              reads={[baseRead({ id: 'read-1', read_number: 1, outcome: 'finished', ended_on: '2026-10-20' })]}
              onSave={ui.onSave}
              onRemove={ui.onRemove}
              onReopen={ui.onReopen}
              disabled
            />
          </BookFeedbackProvider>
        </QueryClientProvider>,
      );
      fireEvent.press(await ui.findByTestId('library-read-start-unknown-read-1'));
      await waitFor(() =>
        expect(ui.getByTestId('library-read-save-read-1').props.accessibilityState.disabled).toBe(true),
      );
    } finally {
      ui.unmount();
    }
  });

  it('double tap on Save sends one request', async () => {
    let calls = 0;
    const onSave = jest.fn(() => {
      calls += 1;
      return new Promise<void>((resolve) => setTimeout(resolve, 20));
    });
    const ui = renderSheet(
      [baseRead({ id: 'read-1', read_number: 1, outcome: 'finished', started_on: '2026-10-01', ended_on: '2026-10-20' })],
      { bookStatus: 'completed', onSave },
    );
    try {
      fireEvent.press(await ui.findByTestId('library-read-start-unknown-read-1'));
      const save = ui.getByTestId('library-read-save-read-1');
      await waitFor(() => expect(save.props.accessibilityState.disabled).toBe(false));
      fireEvent.press(save);
      fireEvent.press(save);
      await waitFor(() => expect(calls).toBe(1));
      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    } finally {
      ui.unmount();
    }
  });
});

describe('remove/reopen rules', () => {
  const latest = baseRead({ id: 'latest', read_number: 2, outcome: 'finished' });
  const older = baseRead({ id: 'older', read_number: 1, outcome: 'finished' });
  const open = baseRead({ id: 'open', read_number: 3, outcome: 'reading' });

  it('keeps an open read and the latest read of a Finished book', () => {
    expect(canRemoveRead(open, 'open', 'reading')).toBe(false);
    expect(canRemoveRead(latest, 'latest', 'completed')).toBe(false);
    expect(canRemoveRead(latest, 'latest', 'reading')).toBe(true);
    expect(canRemoveRead(older, 'latest', 'completed')).toBe(true);
  });

  it('reopens only the latest finished or stopped read with no open read', () => {
    expect(canReopenRead(latest, 'latest', [older, latest])).toBe(true);
    expect(canReopenRead(latest, 'latest', [older, latest, open])).toBe(false);
    expect(canReopenRead(older, 'latest', [older, latest])).toBe(false);
    expect(canReopenRead(open, 'open', [open])).toBe(false);
  });
});

describe('LibraryDateInput native behaviour', () => {
  function renderInput(props: { value?: string | null; onChange?: (day: string) => void } = {}) {
    const onChange = props.onChange ?? jest.fn();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const ui = render(
      <QueryClientProvider client={client}>
        <BookFeedbackProvider>
          <LibraryDateInput
            label="Start date for read 1"
            value={props.value ?? '2026-10-02'}
            onChange={onChange}
            testID="library-date-test"
          />
        </BookFeedbackProvider>
      </QueryClientProvider>,
    );
    return { onChange, ...ui };
  }

  it('exposes the current day as an accessible value', async () => {
    const ui = renderInput({ value: '2026-10-02' });
    try {
      const field = await ui.findByTestId('library-date-test');
      const expected = new Date(2026, 9, 2, 12).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      expect(field.props.accessibilityValue).toMatchObject({ text: expected });
      expect(field.props.accessibilityLabel).toBe('Start date for read 1');
    } finally {
      ui.unmount();
    }
  });

  it('Android commits only on set and closes on set/dismiss', async () => {
    const prior = Platform.OS;
    Platform.OS = 'android';
    const ui = renderInput();
    const pickerOnChange = (testID: string) => {
      const nodes = ui.UNSAFE_root.findAll(
        (node: any) => typeof node.type === 'function' && node.props.testID === testID,
      );
      expect(nodes.length).toBeGreaterThan(0);
      return nodes[0].props.onChange as (event: { type: string }, date?: Date) => void;
    };
    try {
      fireEvent.press(await ui.findByTestId('library-date-test'));
      await ui.findByTestId('library-date-test-picker');
      const { onChange: committed } = ui as unknown as { onChange: jest.Mock };
      act(() => {
        pickerOnChange('library-date-test-picker')({ type: 'neutralButtonPressed' }, new Date(2026, 9, 5, 12));
      });
      expect(committed).not.toHaveBeenCalled();
      expect(ui.queryByTestId('library-date-test-picker')).not.toBeNull();
      act(() => {
        pickerOnChange('library-date-test-picker')({ type: 'dismissed' }, undefined);
      });
      expect(committed).not.toHaveBeenCalled();
      await waitFor(() => expect(ui.queryByTestId('library-date-test-picker')).toBeNull());
      fireEvent.press(ui.getByTestId('library-date-test'));
      await ui.findByTestId('library-date-test-picker');
      act(() => {
        pickerOnChange('library-date-test-picker')({ type: 'set' }, new Date(2026, 9, 5, 12));
      });
      expect(committed).toHaveBeenCalledWith('2026-10-05');
      await waitFor(() => expect(ui.queryByTestId('library-date-test-picker')).toBeNull());
    } finally {
      Platform.OS = prior;
      ui.unmount();
    }
  });

  it('iOS commits on Done, not on every change', async () => {
    const prior = Platform.OS;
    Platform.OS = 'ios';
    const onChange = jest.fn();
    const ui = renderInput({ onChange });
    try {
      fireEvent.press(await ui.findByTestId('library-date-test'));
      await ui.findByTestId('library-date-test-picker');
      const nodes = ui.UNSAFE_root.findAll(
        (node: any) => typeof node.type === 'function' && node.props.testID === 'library-date-test-picker',
      );
      expect(nodes.length).toBeGreaterThan(0);
      act(() => {
        (nodes[0].props.onChange as (event: { type: string }, date?: Date) => void)(
          { type: 'set' },
          new Date(2026, 9, 5, 12),
        );
      });
      expect(onChange).not.toHaveBeenCalled();
      expect(ui.queryByTestId('library-date-test-picker')).not.toBeNull();
      fireEvent.press(await ui.findByTestId('library-date-test-done'));
      expect(onChange).toHaveBeenCalledWith('2026-10-05');
      await waitFor(() => expect(ui.queryByTestId('library-date-test-picker')).toBeNull());
    } finally {
      Platform.OS = prior;
      ui.unmount();
    }
  });
});
