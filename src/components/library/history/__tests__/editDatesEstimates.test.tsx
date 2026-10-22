import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { EditDatesSheet } from '../EditDatesSheet';
import { LibraryDateInput as LibraryDateInputWeb } from '../LibraryDateInput.web';
import { ReadingRead } from '@/features/books/history/readingHistoryContract';
import { ReadDatesPatch } from '@/features/books/history/readingHistoryGateway';
import { BookFeedbackProvider } from '../../ui/BookFeedback';
import { estimateDay, todayDay } from '@/features/books/history/estimateDay';

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

function renderSheet(
  reads: ReadingRead[],
  options: {
    onSave?: (readId: string, patch: ReadDatesPatch) => void | Promise<void>;
    timeZone?: string;
  } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const props = {
    visible: true,
    onClose: jest.fn(),
    bookStatus: 'completed' as const,
    reads,
    onSave: options.onSave ?? jest.fn(),
    onRemove: jest.fn(),
    onReopen: jest.fn(),
    timeZone: options.timeZone,
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
  jest.clearAllMocks();
});

describe('EditDatesSheet approximate dates', () => {
  it('shows Roughly when? only when I do not remember is checked', async () => {
    const ui = renderSheet([baseRead({ started_on: '2026-10-01', ended_on: '2026-10-20' })]);
    try {
      expect(ui.queryByLabelText(/Roughly when/)).toBeNull();
      fireEvent.press(await ui.findByTestId('library-read-start-unknown-read-1'));
      expect(await ui.findByLabelText(/Roughly when did you start read 1/)).toBeOnTheScreen();
      expect(ui.queryByLabelText(/Roughly when did you finish/)).toBeNull();
      fireEvent.press(ui.getByTestId('library-read-end-unknown-read-1'));
      expect(await ui.findByLabelText(/Roughly when did you finish read 1/)).toBeOnTheScreen();
    } finally {
      ui.unmount();
    }
  });

  it('labels start estimates before I finished when the end is known', async () => {
    const ui = renderSheet([baseRead({ started_on: '2026-10-01', ended_on: '2026-10-20' })]);
    try {
      fireEvent.press(await ui.findByTestId('library-read-start-unknown-read-1'));
      const group = await ui.findByLabelText(/Roughly when did you start read 1/);
      expect(group).toBeOnTheScreen();
      expect(ui.getByRole('radio', { name: 'Not sure' })).toBeOnTheScreen();
      expect(ui.getByRole('radio', { name: /About a week before I finished/ })).toBeOnTheScreen();
      expect(ui.getByRole('radio', { name: /About 2 weeks before I finished/ })).toBeOnTheScreen();
      expect(ui.getByRole('radio', { name: /About a month before I finished/ })).toBeOnTheScreen();
      expect(ui.getByRole('radio', { name: /About 3 months before I finished/ })).toBeOnTheScreen();
    } finally {
      ui.unmount();
    }
  });

  it('labels end estimates after I started when the start is known', async () => {
    const ui = renderSheet([baseRead({ started_on: '2026-10-01', ended_on: '2026-10-20' })]);
    try {
      fireEvent.press(await ui.findByTestId('library-read-end-unknown-read-1'));
      expect(await ui.findByRole('radio', { name: /About a week after I started/ })).toBeOnTheScreen();
      expect(ui.getByRole('radio', { name: /About 2 weeks after I started/ })).toBeOnTheScreen();
    } finally {
      ui.unmount();
    }
  });

  it('labels otherwise estimates as ago when the other date is unknown too', async () => {
    const ui = renderSheet([
      baseRead({ started_on: null, ended_on: null, start_unknown: true, end_unknown: true }),
    ]);
    try {
      const startGroup = await ui.findByLabelText(/Roughly when did you start read 1/);
      expect(startGroup).toBeOnTheScreen();
      const endGroup = await ui.findByLabelText(/Roughly when did you finish read 1/);
      expect(endGroup).toBeOnTheScreen();
      // Both sides fall back to today-minus-N with an "ago" suffix.
      expect(ui.getAllByRole('radio', { name: /About a week ago/ })).toHaveLength(2);
      expect(ui.getAllByRole('radio', { name: /About 2 weeks ago/ })).toHaveLength(2);
      expect(within(startGroup).getByRole('radio', { name: /About a week ago/ })).toBeOnTheScreen();
    } finally {
      ui.unmount();
    }
  });

  it('labels an open read start as ago', async () => {
    const ui = renderSheet([
      baseRead({ outcome: 'reading', started_on: '2026-10-01', ended_on: null, end_unknown: false }),
    ]);
    try {
      fireEvent.press(await ui.findByTestId('library-read-start-unknown-read-1'));
      expect(await ui.findByRole('radio', { name: /About a week ago/ })).toBeOnTheScreen();
    } finally {
      ui.unmount();
    }
  });

  it.each([
    [7, '2026-10-13'],
    [14, '2026-10-06'],
    [30, '2026-09-20'],
    [90, '2026-07-22'],
  ])('fills the start input with end minus %i days (%s) and clears unknown', async (days, expected) => {
    const onSave = jest.fn();
    const ui = renderSheet([baseRead({ started_on: '2026-10-01', ended_on: '2026-10-20' })], { onSave });
    try {
      fireEvent.press(await ui.findByTestId('library-read-start-unknown-read-1'));
      const patterns: Record<number, RegExp> = {
        7: /About a week before I finished/,
        14: /About 2 weeks before I finished/,
        30: /About a month before I finished/,
        90: /About 3 months before I finished/,
      };
      fireEvent.press(ui.getByRole('radio', { name: patterns[days] }));
      // The date input is visible, editable and holds the computed day.
      const field = await ui.findByTestId('library-read-start-read-1');
      expect(field.props.accessibilityState.disabled).toBe(false);
      const expectedText = new Date(
        Number(expected.slice(0, 4)),
        Number(expected.slice(5, 7)) - 1,
        Number(expected.slice(8, 10)),
        12,
      ).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
      expect(field.props.accessibilityValue).toMatchObject({ text: expectedText });
      // The unknown toggle is cleared.
      expect(ui.getByTestId('library-read-start-unknown-read-1').props.accessibilityState.checked).toBe(false);
      const save = ui.getByTestId('library-read-save-read-1');
      await waitFor(() => expect(save.props.accessibilityState.disabled).toBe(false));
      fireEvent.press(save);
      expect(onSave).toHaveBeenCalledWith('read-1', {
        started_on: expected,
        ended_on: '2026-10-20',
        start_unknown: false,
        end_unknown: false,
      });
    } finally {
      ui.unmount();
    }
  });

  it('fills the end input with start plus N clamped to today', async () => {
    const onSave = jest.fn();
    const today = todayDay(undefined);
    // Start is yesterday so start + 7 would be in the future and must clamp to today.
    const yesterdayMillis = Date.now() - 24 * 60 * 60 * 1000;
    const yesterday = todayDay(undefined, new Date(yesterdayMillis));
    const ui = renderSheet(
      [baseRead({ started_on: yesterday, ended_on: '2026-10-20', end_unknown: true, start_unknown: false })],
      { onSave },
    );
    try {
      await ui.findByLabelText(/Roughly when did you finish read 1/);
      fireEvent.press(ui.getByRole('radio', { name: /About a week after I started/ }));
      const expected = estimateDay(yesterday, 7, 'after', today);
      expect(expected).toBe(today);
      const field = await ui.findByTestId('library-read-end-read-1');
      expect(field.props.accessibilityState.disabled).toBe(false);
      const save = ui.getByTestId('library-read-save-read-1');
      await waitFor(() => expect(save.props.accessibilityState.disabled).toBe(false));
      fireEvent.press(save);
      expect(onSave).toHaveBeenCalledWith('read-1', {
        started_on: yesterday,
        ended_on: today,
        start_unknown: false,
        end_unknown: false,
      });
    } finally {
      ui.unmount();
    }
  });

  it('fills otherwise estimates from today minus N', async () => {
    const onSave = jest.fn();
    const today = todayDay(undefined);
    const ui = renderSheet(
      [baseRead({ started_on: null, ended_on: null, start_unknown: true, end_unknown: true })],
      { onSave },
    );
    try {
      const startGroup = await ui.findByLabelText(/Roughly when did you start read 1/);
      fireEvent.press(within(startGroup).getByRole('radio', { name: /About 2 weeks ago/ }));
      const expected = estimateDay(today, 14, 'before', today);
      // Start is now known; end stays unknown until its own estimate.
      const save = await ui.findByTestId('library-read-save-read-1');
      await waitFor(() => expect(save.props.accessibilityState.disabled).toBe(false));
      fireEvent.press(save);
      expect(onSave).toHaveBeenCalledWith('read-1', {
        started_on: expected,
        ended_on: null,
        start_unknown: false,
        end_unknown: true,
      });
    } finally {
      ui.unmount();
    }
  });

  it('Not sure keeps the date unknown in the saved payload', async () => {
    const onSave = jest.fn();
    const ui = renderSheet([baseRead({ started_on: '2026-10-01', ended_on: '2026-10-20' })], { onSave });
    try {
      fireEvent.press(await ui.findByTestId('library-read-start-unknown-read-1'));
      fireEvent.press(ui.getByRole('radio', { name: 'Not sure' }));
      // Still unknown; the date input stays disabled with no value.
      expect(ui.getByTestId('library-read-start-unknown-read-1').props.accessibilityState.checked).toBe(true);
      const save = ui.getByTestId('library-read-save-read-1');
      await waitFor(() => expect(save.props.accessibilityState.disabled).toBe(false));
      fireEvent.press(save);
      expect(onSave).toHaveBeenCalledWith('read-1', {
        started_on: null,
        ended_on: '2026-10-20',
        start_unknown: true,
        end_unknown: false,
      });
    } finally {
      ui.unmount();
    }
  });

  it('preserves start <= end after estimates', async () => {
    const onSave = jest.fn();
    const ui = renderSheet([baseRead({ started_on: '2026-10-01', ended_on: '2026-10-20' })], { onSave });
    try {
      fireEvent.press(await ui.findByTestId('library-read-start-unknown-read-1'));
      fireEvent.press(ui.getByRole('radio', { name: /About a week before I finished/ }));
      const save = ui.getByTestId('library-read-save-read-1');
      await waitFor(() => expect(save.props.accessibilityState.disabled).toBe(false));
      expect(ui.queryByTestId('library-read-error-read-1')).toBeNull();
      fireEvent.press(save);
      const patch = onSave.mock.calls[0][1] as { started_on: string; ended_on: string };
      expect(patch.started_on <= patch.ended_on).toBe(true);
    } finally {
      ui.unmount();
    }
  });

  it('keeps the chosen estimate as the group value', async () => {
    const ui = renderSheet([baseRead({ started_on: '2026-10-01', ended_on: '2026-10-20' })]);
    try {
      fireEvent.press(await ui.findByTestId('library-read-start-unknown-read-1'));
      const group = await ui.findByLabelText(/Roughly when did you start read 1/);
      // Initially Not sure is checked.
      expect(within(group).getByRole('radio', { name: 'Not sure' }).props.accessibilityState.checked).toBe(true);
      fireEvent.press(within(group).getByRole('radio', { name: /About 2 weeks before I finished/ }));
      // Choosing an estimate fills the date, clears unknown and hides the group.
      const field = await ui.findByTestId('library-read-start-read-1');
      expect(field.props.accessibilityState.disabled).toBe(false);
      expect(ui.getByTestId('library-read-start-unknown-read-1').props.accessibilityState.checked).toBe(false);
      expect(ui.queryByLabelText(/Roughly when did you start read 1/)).toBeNull();
    } finally {
      ui.unmount();
    }
  });

  it('checking I do not remember again clears the picked date and resets to Not sure', async () => {
    const onSave = jest.fn();
    const ui = renderSheet([baseRead({ started_on: '2026-10-01', ended_on: '2026-10-20' })], { onSave });
    try {
      fireEvent.press(await ui.findByTestId('library-read-start-unknown-read-1'));
      fireEvent.press(ui.getByRole('radio', { name: /About a week before I finished/ }));
      await ui.findByTestId('library-read-start-read-1');
      expect(ui.getByTestId('library-read-start-unknown-read-1').props.accessibilityState.checked).toBe(false);
      // Check "I don't remember" again: picked date is cleared, group resets to Not sure.
      fireEvent.press(ui.getByTestId('library-read-start-unknown-read-1'));
      expect(ui.getByTestId('library-read-start-unknown-read-1').props.accessibilityState.checked).toBe(true);
      const regroup = await ui.findByLabelText(/Roughly when did you start read 1/);
      expect(within(regroup).getByRole('radio', { name: 'Not sure' }).props.accessibilityState.checked).toBe(true);
      const save = ui.getByTestId('library-read-save-read-1');
      await waitFor(() => expect(save.props.accessibilityState.disabled).toBe(false));
      fireEvent.press(save);
      expect(onSave).toHaveBeenCalledWith('read-1', {
        started_on: null,
        ended_on: '2026-10-20',
        start_unknown: true,
        end_unknown: false,
      });
    } finally {
      ui.unmount();
    }
  });

  it('checking I do not remember again clears the picked end date and resets to Not sure', async () => {
    const onSave = jest.fn();
    const ui = renderSheet([baseRead({ started_on: '2026-10-01', ended_on: '2026-10-20' })], { onSave });
    try {
      fireEvent.press(await ui.findByTestId('library-read-end-unknown-read-1'));
      fireEvent.press(ui.getByRole('radio', { name: /About a week after I started/ }));
      await ui.findByTestId('library-read-end-read-1');
      expect(ui.getByTestId('library-read-end-unknown-read-1').props.accessibilityState.checked).toBe(false);
      fireEvent.press(ui.getByTestId('library-read-end-unknown-read-1'));
      expect(ui.getByTestId('library-read-end-unknown-read-1').props.accessibilityState.checked).toBe(true);
      const regroup = await ui.findByLabelText(/Roughly when did you finish read 1/);
      expect(within(regroup).getByRole('radio', { name: 'Not sure' }).props.accessibilityState.checked).toBe(true);
      const save = ui.getByTestId('library-read-save-read-1');
      await waitFor(() => expect(save.props.accessibilityState.disabled).toBe(false));
      fireEvent.press(save);
      expect(onSave).toHaveBeenCalledWith('read-1', {
        started_on: '2026-10-01',
        ended_on: null,
        start_unknown: false,
        end_unknown: true,
      });
    } finally {
      ui.unmount();
    }
  });

  it('each estimate option hints its computed day and clamped estimates say (today)', async () => {
    const today = todayDay(undefined);
    const yesterday = todayDay(undefined, new Date(Date.now() - 24 * 60 * 60 * 1000));
    const ui = renderSheet(
      [baseRead({ started_on: yesterday, ended_on: '2026-10-20', end_unknown: true, start_unknown: false })],
      {},
    );
    try {
      await ui.findByLabelText(/Roughly when did you finish read 1/);
      const week = ui.getByRole('radio', { name: /About a week after I started/ });
      const weekName = String(week.props.accessibilityLabel ?? '');
      // start + 7 clamps to today, so the hint is (today).
      expect(weekName).toContain('(today)');
      const startUi = renderSheet([baseRead({ started_on: '2026-10-01', ended_on: '2026-10-20' })]);
      try {
        fireEvent.press(await startUi.findByTestId('library-read-start-unknown-read-1'));
        const startWeek = await startUi.findByRole('radio', { name: /About a week before I finished/ });
        const startName = String(startWeek.props.accessibilityLabel ?? startWeek.props.children ?? '');
        // 2026-10-20 minus 7 is 2026-10-13, hint is "13 Oct".
        expect(startName).toContain('13 Oct');
        expect(startName).not.toContain('(today)');
      } finally {
        startUi.unmount();
      }
      expect(today).toBeTruthy();
    } finally {
      ui.unmount();
    }
  });
});

describe('LibraryDateInput.web receives the computed value', () => {
  function renderWeb(value: string | null) {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const ui = render(
      <QueryClientProvider client={client}>
        <BookFeedbackProvider>
          <LibraryDateInputWeb label="Start date for read 1" value={value} onChange={jest.fn()} testID="library-read-start-read-1" />
        </BookFeedbackProvider>
      </QueryClientProvider>,
    );
    return ui;
  }

  it('renders the estimated day in the native date input', async () => {
    const computed = estimateDay('2026-10-20', 14, 'before', todayDay(undefined));
    expect(computed).toBe('2026-10-06');
    const ui = renderWeb(computed);
    try {
      // The wrapper carries the testID; the DOM <input type="date"> inside
      // carries the computed value (visible and editable on web).
      const wrapper = await ui.findByTestId('library-read-start-read-1-wrapper');
      expect(wrapper).toBeOnTheScreen();
      const serialized = JSON.stringify(ui.toJSON());
      expect(serialized).toContain('2026-10-06');
      // The labelled web input exposes the same day as its value.
      const labelled = ui.getByLabelText('Start date for read 1');
      expect(labelled.props.value ?? labelled.props.defaultValue).toBe('2026-10-06');
    } finally {
      ui.unmount();
    }
  });
});
