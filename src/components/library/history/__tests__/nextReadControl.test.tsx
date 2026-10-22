import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NextReadControl } from '../NextReadControl';
import { readingHistoryGateway } from '@/features/books/history/readingHistoryGateway';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/features/books/history/readingHistoryGateway', () => ({
  readingHistoryGateway: { userBookTitle: jest.fn() },
}));

const gateway = readingHistoryGateway as unknown as { userBookTitle: jest.Mock };

function renderControl(props: Partial<React.ComponentProps<typeof NextReadControl>> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  const ui = render(
    <QueryClientProvider client={client}>
      <NextReadControl
        actorId="actor"
        userBookId="book-1"
        bookStatus="want_to_read"
        settingsData={null}
        onSetNextRead={jest.fn()}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { client, ...ui };
}

beforeEach(() => {
  jest.clearAllMocks();
  gateway.userBookTitle.mockResolvedValue('Dune');
});

describe('NextReadControl', () => {
  it('hides for reading and finished books', () => {
    const reading = renderControl({ bookStatus: 'reading' });
    expect(reading.queryByTestId('library-next-read')).toBeNull();
    reading.unmount();
    reading.client.clear();

    const finished = renderControl({ bookStatus: 'completed' });
    expect(finished.queryByTestId('library-next-read')).toBeNull();
    finished.unmount();
    finished.client.clear();
  });

  it('shows Make for no next read and calls with this book', async () => {
    const onSetNextRead = jest.fn();
    const ui = renderControl({ settingsData: null, onSetNextRead });
    try {
      const make = await ui.findByTestId('library-next-read-make');
      fireEvent.press(make);
      expect(onSetNextRead).toHaveBeenCalledWith('book-1');
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('puts Replaces into the button label, not a plain hint', async () => {
    const ui = renderControl({
      settingsData: { user_id: 'actor', next_read_user_book_id: 'book-2', updated_at: '2026-10-01T00:00:00.000Z' },
    });
    try {
      await waitFor(() =>
        expect(ui.getByTestId('library-next-read-make').props.accessibilityLabel).toMatch(/replaces Dune/i),
      );
      expect(ui.queryByTestId('library-next-read-replaces')).toBeNull();
      expect(gateway.userBookTitle).toHaveBeenCalledWith('actor', 'book-2', expect.anything());
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('disables Make while the current next-read title is loading', async () => {
    gateway.userBookTitle.mockImplementationOnce(() => new Promise(() => {}));
    const ui = renderControl({
      settingsData: { user_id: 'actor', next_read_user_book_id: 'book-2', updated_at: '2026-10-01T00:00:00.000Z' },
    });
    try {
      const make = await ui.findByTestId('library-next-read-make');
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      expect(make.props.accessibilityState.disabled).toBe(true);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('shows Your next read with Remove for this book', async () => {
    const onSetNextRead = jest.fn();
    const ui = renderControl({
      settingsData: { user_id: 'actor', next_read_user_book_id: 'book-1', updated_at: '2026-10-01T00:00:00.000Z' },
      onSetNextRead,
    });
    try {
      expect(await ui.findByTestId('library-next-read-current')).toHaveTextContent('Your next read');
      fireEvent.press(ui.getByTestId('library-next-read-remove'));
      expect(onSetNextRead).toHaveBeenCalledWith(null);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('guards double taps to one request', async () => {
    const onSetNextRead = jest.fn(() => new Promise(() => {}));
    const ui = renderControl({ settingsData: null, onSetNextRead });
    try {
      const make = await ui.findByTestId('library-next-read-make');
      fireEvent.press(make);
      fireEvent.press(make);
      expect(onSetNextRead).toHaveBeenCalledTimes(1);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});
