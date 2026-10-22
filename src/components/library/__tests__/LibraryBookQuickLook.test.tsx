import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { LibraryBookQuickLook } from '../LibraryBookQuickLook';
import { BookFeedbackProvider } from '../ui';
import { booksService } from '@/features/books/services/booksService';
import { readingHistoryGateway } from '@/features/books/history/readingHistoryGateway';

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ session: { user: { id: 'actor' } } }),
}));
jest.mock('@/features/books/services/booksService', () => ({
  booksService: { updateReadingStatus: jest.fn() },
}));
jest.mock('@/features/books/history/readingHistoryGateway', () => ({
  readingHistoryGateway: { startReread: jest.fn() },
}));

const updateStatus = booksService.updateReadingStatus as jest.Mock;
const startReread = readingHistoryGateway.startReread as jest.Mock;

function bookWith(status: string | null) {
  return {
    id: 'user-book-1', ownership: 'owned', reading_status: status, rating: null, review: null, condition: null,
    book: { title: 'Walden', authors: ['Thoreau'], page_count: 100 },
  } as any;
}

function setup(book: any) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  const ui = render(
    <QueryClientProvider client={client}>
      <BookFeedbackProvider>
        <LibraryBookQuickLook book={book} onClose={jest.fn()} onDetails={jest.fn()} />
      </BookFeedbackProvider>
    </QueryClientProvider>,
  );
  return { client, ...ui };
}

beforeEach(() => {
  jest.clearAllMocks();
  updateStatus.mockResolvedValue({});
  startReread.mockResolvedValue('read-2');
});

describe('LibraryBookQuickLook start reading (SDD-09 H-05)', () => {
  it('shows Start reading for want_to_read and writes reading through the library status service', async () => {
    const ui = setup(bookWith('want_to_read'));
    try {
      expect(await ui.findByText('Start reading')).toBeTruthy();
      fireEvent.press(await ui.findByTestId('library-quick-look-start-reading'));
      await waitFor(() => expect(updateStatus).toHaveBeenCalledWith('user-book-1', 'reading'));
      expect(startReread).not.toHaveBeenCalled();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('reads Read again for a finished book and calls startReread instead of the status service', async () => {
    const ui = setup(bookWith('completed'));
    try {
      expect(await ui.findByText('Read again')).toBeTruthy();
      fireEvent.press(await ui.findByTestId('library-quick-look-start-reading'));
      await waitFor(() => expect(startReread).toHaveBeenCalledWith('actor', 'user-book-1'));
      expect(updateStatus).not.toHaveBeenCalled();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('shows no start button while reading', async () => {
    const ui = setup(bookWith('reading'));
    try {
      await ui.findByTestId('library-book-quick-look');
      await act(async () => {});
      expect(ui.queryByTestId('library-quick-look-start-reading')).toBeNull();
      expect(ui.queryByText('Start reading')).toBeNull();
      expect(ui.queryByText('Read again')).toBeNull();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('invalidates the library, the book reads and the open-read set after starting', async () => {
    const ui = setup(bookWith('want_to_read'));
    try {
      const invalidate = jest.spyOn(ui.client, 'invalidateQueries');
      fireEvent.press(await ui.findByTestId('library-quick-look-start-reading'));
      await waitFor(() => expect(updateStatus).toHaveBeenCalled());
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['library'] });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['library-history-reads-book', 'actor', 'user-book-1'],
      });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['library-history-reads-user', 'actor'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['library-history-open-reads', 'actor'] });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('renders the error toast inside the Quick Look modal, not the host', async () => {
    updateStatus.mockRejectedValueOnce(new Error('start down'));
    const ui = setup(bookWith('want_to_read'));
    try {
      fireEvent.press(await ui.findByTestId('library-quick-look-start-reading'));
      await waitFor(() => expect(updateStatus).toHaveBeenCalledTimes(1));
      const slot = ui.getByTestId('book-feedback-slot');
      expect(within(slot).getByText('start down')).toBeOnTheScreen();
      expect(
        within(ui.getByTestId('book-feedback-host', { includeHiddenElements: true })).queryByText('start down', {
          includeHiddenElements: true,
        }),
      ).toBeNull();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('shows an error toast with Retry which re-runs the same start', async () => {
    updateStatus.mockRejectedValueOnce(new Error('start down'));
    const ui = setup(bookWith('want_to_read'));
    try {
      fireEvent.press(await ui.findByTestId('library-quick-look-start-reading'));
      await waitFor(() => expect(updateStatus).toHaveBeenCalledTimes(1));
      const retry = await ui.findByRole('button', { name: 'Retry' });
      expect(retry).toBeTruthy();
      updateStatus.mockResolvedValueOnce({});
      fireEvent.press(retry);
      await waitFor(() => expect(updateStatus).toHaveBeenCalledTimes(2));
      expect(updateStatus).toHaveBeenNthCalledWith(2, 'user-book-1', 'reading');
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('retries a failed Read again through the toast', async () => {
    startReread.mockRejectedValueOnce(new Error('reread down'));
    const ui = setup(bookWith('completed'));
    try {
      fireEvent.press(await ui.findByTestId('library-quick-look-start-reading'));
      await waitFor(() => expect(startReread).toHaveBeenCalledTimes(1));
      const retry = await ui.findByRole('button', { name: 'Retry' });
      startReread.mockResolvedValueOnce('read-9');
      fireEvent.press(retry);
      await waitFor(() => expect(startReread).toHaveBeenCalledTimes(2));
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});
