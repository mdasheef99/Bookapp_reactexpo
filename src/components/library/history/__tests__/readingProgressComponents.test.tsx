import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ProgressSheet, PROGRESS_SHEET_TITLE } from '../ProgressSheet';
import { PageEdgeBar } from '../PageEdgeBar';
import { PaceBars } from '../PaceBars';
import { BookFeedbackProvider } from '../../ui/BookFeedback';
import type { ProgressValue } from '@/features/books/history/readingHistoryGateway';
import { currentPosition, formatProgressText } from '@/features/books/history/progressMath';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'Light' },
}));

function renderSheet(
  options: {
    totalPages?: number | null;
    fallbackTotalPages?: number | null;
    currentPages?: number | null;
    currentPercent?: number | null;
    onSaveProgress?: (value: ProgressValue) => void | Promise<unknown>;
    onSaveTotalPages?: (total: number | null) => void | Promise<unknown>;
    pending?: boolean;
    disabled?: boolean;
  } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const props = {
    visible: true,
    onClose: jest.fn(),
    totalPages: options.totalPages !== undefined ? options.totalPages : 320,
    fallbackTotalPages: options.fallbackTotalPages ?? null,
    currentPages:
      options.currentPages !== undefined ? options.currentPages : 142,
    currentPercent: options.currentPercent !== undefined ? options.currentPercent : null,
    onSaveProgress: options.onSaveProgress ?? jest.fn(),
    onSaveTotalPages: options.onSaveTotalPages ?? jest.fn(),
    pending: options.pending,
    disabled: options.disabled,
  };
  const ui = render(
    <QueryClientProvider client={client}>
      <BookFeedbackProvider>
        <ProgressSheet {...props} />
      </BookFeedbackProvider>
    </QueryClientProvider>,
  );
  return { ...props, ...ui };
}

function renderBars() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const ui = render(
    <QueryClientProvider client={client}>
      <BookFeedbackProvider>
        <>
          <PageEdgeBar pages={142} totalPages={320} />
          <PaceBars
            days={[
              { day: '2026-09-27', pages: 0 },
              { day: '2026-10-10', pages: 20 },
            ]}
            estimateText="About 6 days at your recent pace"
          />
        </>
      </BookFeedbackProvider>
    </QueryClientProvider>,
  );
  return ui;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PageEdgeBar', () => {
  it('shows the bar text carrying the meaning while the bar is hidden from screen readers', () => {
    const ui = renderBars();
    try {
      expect(ui.getByTestId('library-progress-bar-text')).toHaveTextContent('142 of 320 pages, 44%');
      const bar = ui.getByTestId('library-progress-bar', { includeHiddenElements: true });
      expect(bar.props.accessibilityElementsHidden).toBe(true);
      expect(bar.props.importantForAccessibility).toBe('no-hide-descendants');
      expect(bar.props['aria-hidden']).toBe(true);
    } finally {
      ui.unmount();
    }
  });

  it('shows percent-only text without a total', () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const ui = render(
      <QueryClientProvider client={client}>
        <BookFeedbackProvider>
          <PageEdgeBar pages={null} totalPages={null} percent={44} />
        </BookFeedbackProvider>
      </QueryClientProvider>,
    );
    try {
      expect(ui.getByTestId('library-progress-bar-text')).toHaveTextContent('44%');
    } finally {
      ui.unmount();
    }
  });
});

describe('PaceBars', () => {
  it('hides bars from screen readers with a text equivalent and the estimate', () => {
    const ui = renderBars();
    try {
      const bars = ui.getByTestId('library-progress-pace-bars', { includeHiddenElements: true });
      expect(bars.props.accessibilityElementsHidden).toBe(true);
      expect(bars.props.importantForAccessibility).toBe('no-hide-descendants');
      expect(bars.props['aria-hidden']).toBe(true);
      expect(ui.getByTestId('library-progress-pace-text')).toHaveTextContent(
        /Pages per day, last 14 days:/,
      );
      expect(ui.getByTestId('library-progress-estimate')).toHaveTextContent(
        'About 6 days at your recent pace',
      );
    } finally {
      ui.unmount();
    }
  });

  it('never uses deadline wording', () => {
    const ui = renderBars();
    try {
      expect(ui.queryByText(/deadline/i)).toBeNull();
      expect(ui.queryByText(/behind/i)).toBeNull();
      expect(ui.queryByText(/late/i)).toBeNull();
    } finally {
      ui.unmount();
    }
  });
});

describe('ProgressSheet', () => {
  it('opens as a named dialog with labelled controls', async () => {
    const ui = renderSheet();
    try {
      const dialog = await waitFor(() =>
        ui.UNSAFE_root.find(
          (node: unknown) =>
            typeof node === 'object' &&
            node !== null &&
            (node as { type?: unknown }).type === 'View' &&
            (node as { props?: { accessibilityViewIsModal?: boolean } }).props?.accessibilityViewIsModal === true,
        ),
      );
      expect(
        (dialog as unknown as { props: { accessibilityLabel?: string } }).props.accessibilityLabel,
      ).toBe(PROGRESS_SHEET_TITLE);
      expect(ui.getByLabelText('Current page')).toBeOnTheScreen();
      expect(ui.getByTestId('library-progress-save')).toBeOnTheScreen();
    } finally {
      ui.unmount();
    }
  });

  it('-10 floors at 0 in page mode', async () => {
    const onSaveProgress = jest.fn();
    const ui = renderSheet({ totalPages: 320, currentPages: 5, onSaveProgress });
    try {
      fireEvent.press(await ui.findByTestId('library-progress-minus-10'));
      const input = ui.getByTestId('library-progress-input');
      expect(input.props.value).toBe('0');
      fireEvent.press(ui.getByTestId('library-progress-save'));
      expect(onSaveProgress).toHaveBeenCalledWith({ page: 0 });
    } finally {
      ui.unmount();
    }
  });

  it('cannot exceed the total in page mode', async () => {
    const onSaveProgress = jest.fn();
    const ui = renderSheet({ totalPages: 320, currentPages: 315, onSaveProgress });
    try {
      fireEvent.press(await ui.findByTestId('library-progress-plus-10'));
      expect(ui.getByTestId('library-progress-input').props.value).toBe('320');
      fireEvent.changeText(ui.getByTestId('library-progress-input'), '400');
      await waitFor(() =>
        expect(ui.getByTestId('library-progress-save').props.accessibilityState.disabled).toBe(true),
      );
      expect(ui.getByTestId('library-progress-error')).toBeOnTheScreen();
      expect(onSaveProgress).not.toHaveBeenCalled();
    } finally {
      ui.unmount();
    }
  });

  it('uses % mode with +5/+10 when there is no total', async () => {
    const onSaveProgress = jest.fn();
    const ui = renderSheet({ totalPages: null, currentPages: null, currentPercent: 40, onSaveProgress });
    try {
      expect(await ui.findByLabelText('Current percent')).toBeOnTheScreen();
      expect(ui.getByTestId('library-progress-plus-5')).toBeOnTheScreen();
      expect(ui.getByTestId('library-progress-plus-10')).toBeOnTheScreen();
      fireEvent.press(ui.getByTestId('library-progress-plus-5'));
      expect(ui.getByTestId('library-progress-input').props.value).toBe('45');
      fireEvent.press(ui.getByTestId('library-progress-save'));
      expect(onSaveProgress).toHaveBeenCalledWith({ percent: 45 });
    } finally {
      ui.unmount();
    }
  });

  it('clamps % entries to 0-100', async () => {
    const ui = renderSheet({ totalPages: null, currentPages: null, currentPercent: 98 });
    try {
      fireEvent.press(await ui.findByTestId('library-progress-plus-10'));
      expect(ui.getByTestId('library-progress-input').props.value).toBe('100');
      fireEvent.changeText(ui.getByTestId('library-progress-input'), '120');
      await waitFor(() =>
        expect(ui.getByTestId('library-progress-save').props.accessibilityState.disabled).toBe(true),
      );
    } finally {
      ui.unmount();
    }
  });

  it('changing the total switches modes', async () => {
    const onSaveTotalPages = jest.fn();
    const ui = renderSheet({ totalPages: 320, currentPages: 142, onSaveTotalPages });
    try {
      fireEvent.press(await ui.findByTestId('library-progress-total-toggle'));
      fireEvent.changeText(await ui.findByTestId('library-progress-total-input'), '');
      fireEvent.press(ui.getByTestId('library-progress-total-save'));
      expect(onSaveTotalPages).toHaveBeenCalledWith(null);
    } finally {
      ui.unmount();
    }

    const removeUi = renderSheet({ totalPages: 320, currentPages: 142 });
    try {
      fireEvent.press(await removeUi.findByTestId('library-progress-total-toggle'));
      expect(await removeUi.findByTestId('library-progress-total-remove')).toBeOnTheScreen();
    } finally {
      removeUi.unmount();
    }
  });

  it('offline disables Save', async () => {
    const ui = renderSheet({ disabled: true });
    try {
      expect((await ui.findByTestId('library-progress-save')).props.accessibilityState.disabled).toBe(true);
    } finally {
      ui.unmount();
    }
  });

  it('plays a light haptic after a successful save on native', async () => {
    const onSaveProgress = jest.fn().mockResolvedValue({ id: 'progress-1' });
    const ui = renderSheet({ onSaveProgress });
    try {
      const Haptics = require('expo-haptics');
      fireEvent.press(await ui.findByTestId('library-progress-save'));
      await waitFor(() => expect(onSaveProgress).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(Haptics.impactAsync).toHaveBeenCalledWith('Light'));
    } finally {
      ui.unmount();
    }
  });

  it('double tap on Save sends one request', async () => {
    let calls = 0;
    const onSaveProgress = jest.fn(() => {
      calls += 1;
      return new Promise<unknown>((resolve) => setTimeout(resolve, 20));
    });
    const ui = renderSheet({ onSaveProgress });
    try {
      const save = await ui.findByTestId('library-progress-save');
      fireEvent.press(save);
      fireEvent.press(save);
      await waitFor(() => expect(calls).toBe(1));
      expect(onSaveProgress).toHaveBeenCalledTimes(1);
    } finally {
      ui.unmount();
    }
  });

  it('keeps a page position when there is no total (page input, not percent)', async () => {
    const onSaveProgress = jest.fn().mockResolvedValue({ id: 'progress-2' });
    const ui = renderSheet({ totalPages: null, currentPages: 142, currentPercent: null, onSaveProgress });
    try {
      expect(await ui.findByTestId('library-progress-header')).toHaveTextContent(
        'Currently on page 142 (no total pages)',
      );
      expect(ui.getByLabelText('Current page')).toBeOnTheScreen();
      expect(ui.getByTestId('library-progress-input').props.value).toBe('142');
      fireEvent.press(await ui.findByTestId('library-progress-save'));
      await waitFor(() => expect(onSaveProgress).toHaveBeenCalledWith({ page: 142 }));
    } finally {
      ui.unmount();
    }
  });

  it('seeds a percent position when there is no total and never seeds 0', async () => {
    const onSaveProgress = jest.fn().mockResolvedValue({ id: 'progress-2' });
    const ui = renderSheet({ totalPages: null, currentPages: null, currentPercent: 44, onSaveProgress });
    try {
      expect(ui.getByTestId('library-progress-input').props.value).toBe('44');
      fireEvent.press(await ui.findByTestId('library-progress-save'));
      await waitFor(() => expect(onSaveProgress).toHaveBeenCalledWith({ percent: 44 }));
    } finally {
      ui.unmount();
    }
  });

  it('shows an earlier total as the default when the open read has none', async () => {
    const ui = renderSheet({
      totalPages: null,
      currentPages: 142,
      currentPercent: null,
      fallbackTotalPages: 400,
    });
    try {
      expect(await ui.findByTestId('library-progress-header')).toHaveTextContent('Page 142 of 400');
      expect(ui.getByLabelText('Current page')).toBeOnTheScreen();
    } finally {
      ui.unmount();
    }
  });

  it('ignores a fallback when the read already has a total', async () => {
    const ui = renderSheet({
      totalPages: 320,
      currentPages: 142,
      fallbackTotalPages: 400,
    });
    try {
      expect(await ui.findByTestId('library-progress-header')).toHaveTextContent('Page 142 of 320');
    } finally {
      ui.unmount();
    }
  });

  it('header follows the draft: Page 152 of 320 after +10 with one header line', async () => {
    const ui = renderSheet({ totalPages: 320, currentPages: 142 });
    try {
      expect(await ui.findByTestId('library-progress-header')).toHaveTextContent('Page 142 of 320');
      fireEvent.press(await ui.findByTestId('library-progress-plus-10'));
      expect(ui.getByTestId('library-progress-header')).toHaveTextContent('Page 152 of 320');
      expect(ui.getAllByTestId('library-progress-header')).toHaveLength(1);
      expect(ui.queryByText(/Currently 0%/)).toBeNull();
    } finally {
      ui.unmount();
    }
  });

  it('a step button with an invalid draft applies to the saved position, not 0', async () => {
    const ui = renderSheet({ totalPages: 320, currentPages: 142 });
    try {
      fireEvent.changeText(await ui.findByTestId('library-progress-input'), 'oops');
      fireEvent.press(await ui.findByTestId('library-progress-plus-10'));
      expect(ui.getByTestId('library-progress-input').props.value).toBe('152');
      expect(ui.getByTestId('library-progress-header')).toHaveTextContent('Page 152 of 320');
    } finally {
      ui.unmount();
    }
  });

  it('does not overwrite the draft when props refetch while open', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const onSaveProgress = jest.fn();
    const onSaveTotalPages = jest.fn();
    const first = render(
      <QueryClientProvider client={client}>
        <BookFeedbackProvider>
          <ProgressSheet
            visible
            onClose={jest.fn()}
            totalPages={320}
            currentPages={142}
            currentPercent={null}
            onSaveProgress={onSaveProgress}
            onSaveTotalPages={onSaveTotalPages}
          />
        </BookFeedbackProvider>
      </QueryClientProvider>,
    );
    try {
      fireEvent.changeText(await first.findByTestId('library-progress-input'), '150');
      first.rerender(
        <QueryClientProvider client={client}>
          <BookFeedbackProvider>
            <ProgressSheet
              visible
              onClose={jest.fn()}
              totalPages={320}
              currentPages={200}
              currentPercent={null}
              onSaveProgress={onSaveProgress}
              onSaveTotalPages={onSaveTotalPages}
            />
          </BookFeedbackProvider>
        </QueryClientProvider>,
      );
      expect(first.getByTestId('library-progress-input').props.value).toBe('150');
    } finally {
      first.unmount();
    }
  });

  it('unmounting during a save skips resets without crashing', async () => {
    let release!: (value: unknown) => void;
    const gate = new Promise<unknown>((resolve) => {
      release = resolve;
    });
    const onSaveProgress = jest.fn(() => gate);
    const ui = renderSheet({ onSaveProgress });
    try {
      fireEvent.press(await ui.findByTestId('library-progress-save'));
      await waitFor(() => expect(onSaveProgress).toHaveBeenCalledTimes(1));
      ui.unmount();
      release({ id: 'progress-2' });
      await new Promise((resolve) => setTimeout(resolve, 10));
    } finally {
      // Already unmounted; releasing the gate must not throw or warn.
    }
    expect(onSaveProgress).toHaveBeenCalledTimes(1);
  });

  it('PageEdgeBar matches the single formatProgressText formatter', () => {
    const position = currentPosition(
      [{ id: 'a', read_id: 'r', user_id: 'u', page: 142, percent: null, recorded_at: '2026-10-10T12:00:00.000Z' }],
      320,
    );
    expect(formatProgressText(position)).toBe('142 of 320 pages, 44%');
  });
});
