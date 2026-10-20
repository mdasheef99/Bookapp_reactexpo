import React from 'react';
import { StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { VaultPagesList } from '../VaultPagesList';
import { BookFeedbackProvider } from '../ui/BookFeedback';
import { getLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';
import { userBookPagesService } from '@/features/books/services/userBookPagesService';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/features/books/services/userBookPagesService', () => ({
  userBookPagesService: {
    getPagesForBook: jest.fn(),
    deletePage: jest.fn(),
  },
}));

const samplePage = {
  id: 'page-42',
  user_id: 'reader-1',
  user_book_id: 'book-1',
  page_number: 42,
  content_excerpt: 'First line of the saved page.\nSecond line stays hidden.',
  full_text: 'First line of the saved page.\nSecond line stays hidden.',
  word_count: 10,
  created_at: '2026-10-12T12:00:00Z',
  updated_at: '2026-10-12T12:00:00Z',
};

function renderList(props: { userBookId?: string; disabled?: boolean } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  const ui = render(
    <QueryClientProvider client={client}>
      <BookFeedbackProvider>
        <VaultPagesList userBookId={props.userBookId ?? 'book-1'} disabled={props.disabled} />
      </BookFeedbackProvider>
    </QueryClientProvider>,
  );
  return { client, ...ui };
}

describe('VaultPagesList', () => {
  const colors = getLibraryAppearance('daylight');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders "Page 42" caption and first-line serif excerpt with no card fill', async () => {
    (userBookPagesService.getPagesForBook as jest.Mock).mockResolvedValue([samplePage]);
    const ui = renderList();
    try {
      const caption = await ui.findByText('Page 42');
      const excerpt = ui.getByText('First line of the saved page.');
      expect(ui.queryByText(/Second line stays hidden/)).toBeNull();
      expect(StyleSheet.flatten(caption.props.style)).toMatchObject({
        ...LIBRARY_TEXT.caption,
        color: colors.textSecondary,
      });
      expect(StyleSheet.flatten(excerpt.props.style)).toMatchObject({
        ...LIBRARY_TEXT.bodySerif,
        color: colors.textPrimary,
      });
      expect(StyleSheet.flatten(excerpt.parent?.props.style)?.backgroundColor).toBeUndefined();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('confirms before deleting a page and invalidates vault-pages on confirm', async () => {
    (userBookPagesService.getPagesForBook as jest.Mock).mockResolvedValueOnce([samplePage]).mockResolvedValue([]);
    (userBookPagesService.deletePage as jest.Mock).mockResolvedValue(undefined);
    const ui = renderList();
    try {
      await ui.findByText('Page 42');
      fireEvent.press(ui.getByRole('button', { name: 'Delete page 42' }));
      expect(userBookPagesService.deletePage).not.toHaveBeenCalled();
      expect(ui.getByText('Delete page 42?')).toBeOnTheScreen();
      expect(ui.getByText('This will remove the saved page from your vault.')).toBeOnTheScreen();

      fireEvent.press(within(ui.getByTestId('book-confirm-card')).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(ui.queryByText('Delete page 42?')).toBeNull());
      expect(userBookPagesService.deletePage).not.toHaveBeenCalled();

      fireEvent.press(ui.getByRole('button', { name: 'Delete page 42' }));
      fireEvent.press(within(ui.getByTestId('book-confirm-card')).getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(userBookPagesService.deletePage).toHaveBeenCalledTimes(1));
      expect(userBookPagesService.deletePage).toHaveBeenCalledWith('page-42');
      await waitFor(() => expect(ui.queryByText('Page 42')).toBeNull());
      expect(userBookPagesService.getPagesForBook).toHaveBeenCalledTimes(2);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('disables Delete page button when disabled prop is true or while deleting', async () => {
    (userBookPagesService.getPagesForBook as jest.Mock).mockResolvedValue([samplePage]);
    const ui = renderList({ disabled: true });
    try {
      await ui.findByText('Page 42');
      const btn = ui.getByRole('button', { name: 'Delete page 42' });
      expect(btn.props.accessibilityState.disabled).toBe(true);
      fireEvent.press(btn);
      expect(ui.queryByText('Delete page 42?')).toBeNull();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
    (userBookPagesService.deletePage as jest.Mock).mockImplementation(() => new Promise(() => {}));
    const pendingUi = renderList({ disabled: false });
    try {
      await pendingUi.findByText('Page 42');
      expect(pendingUi.getByRole('button', { name: 'Delete page 42' }).props.accessibilityState.disabled).toBe(false);
      fireEvent.press(pendingUi.getByRole('button', { name: 'Delete page 42' }));
      fireEvent.press(within(pendingUi.getByTestId('book-confirm-card')).getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(userBookPagesService.deletePage).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(pendingUi.getByRole('button', { name: 'Delete page 42' }).props.accessibilityState.disabled).toBe(true));
      expect(pendingUi.client.isMutating()).toBe(1);
    } finally { pendingUi.unmount(); pendingUi.client.clear(); }
  });

  it('keeps pages and shows quiet refresh-error line with Try again when refetch fails', async () => {
    (userBookPagesService.getPagesForBook as jest.Mock).mockResolvedValue([samplePage]);
    const ui = renderList();
    try {
      await ui.findByText('Page 42');
      (userBookPagesService.getPagesForBook as jest.Mock).mockRejectedValueOnce(new Error('network error'));
      await act(async () => {
        await ui.client.refetchQueries({ queryKey: ['vault-pages', 'book-1'] });
      });
      const errText = await ui.findByText("Couldn't refresh saved pages.");
      expect(StyleSheet.flatten(errText.props.style)).toMatchObject({
        ...LIBRARY_TEXT.body,
        color: colors.textSecondary,
      });
      expect(ui.getByText('Page 42')).toBeOnTheScreen();
      const before = (userBookPagesService.getPagesForBook as jest.Mock).mock.calls.length;
      fireEvent.press(ui.getByRole('button', { name: 'Try again' }));
      await waitFor(() => expect((userBookPagesService.getPagesForBook as jest.Mock).mock.calls.length).toBeGreaterThan(before));
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});

describe('Flow A fix round 1 saved pages', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('R4 rechecks latest disabled after an already open confirmation resolves true', async () => {
    (userBookPagesService.getPagesForBook as jest.Mock).mockResolvedValue([samplePage]);
    const ui = renderList();
    try {
      await ui.findByText('Page 42');
      fireEvent.press(ui.getByRole('button', { name: 'Delete page 42' }));
      expect(ui.getByText('Delete page 42?')).toBeTruthy();
      ui.rerender(
        <QueryClientProvider client={ui.client}>
          <BookFeedbackProvider><VaultPagesList userBookId="book-1" disabled /></BookFeedbackProvider>
        </QueryClientProvider>,
      );
      fireEvent.press(within(ui.getByTestId('book-confirm-card')).getByRole('button', { name: 'Delete' }));
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
      expect(userBookPagesService.deletePage).not.toHaveBeenCalled();
      expect(ui.getByText('Page 42')).toBeTruthy();
    } finally { ui.unmount(); ui.client.clear(); }
  });

  it('R10 announces the saved-pages refresh error politely', async () => {
    (userBookPagesService.getPagesForBook as jest.Mock).mockResolvedValue([samplePage]);
    const ui = renderList();
    try {
      await ui.findByText('Page 42');
      (userBookPagesService.getPagesForBook as jest.Mock).mockRejectedValue(new Error('refresh down'));
      await act(async () => { await ui.client.refetchQueries({ queryKey: ['vault-pages', 'book-1'] }); });
      expect((await ui.findByText("Couldn't refresh saved pages.")).props.accessibilityLiveRegion).toBe('polite');
    } finally { ui.unmount(); ui.client.clear(); }
  });
});
