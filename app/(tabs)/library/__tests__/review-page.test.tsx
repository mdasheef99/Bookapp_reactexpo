import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import ReviewScreen from '../review';
import { useAuthStore } from '@/features/auth/store/authStore';
import { booksService } from '@/features/books/services/booksService';
import { bookReviewService } from '@/features/books/services/bookReviewService';
import { expectSinglePrimary } from '@/test-utils/bookSection';

let mockOffline = false;
let mockUserBook: any;
let mockBookError: any = null;
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockDismiss = jest.fn();
const mockDispatch = jest.fn();
const mockNotify = jest.fn();
let mockConfirmImpl: (spec: any) => Promise<boolean> = async () => false;
const mockConfirm = jest.fn((spec: any) => mockConfirmImpl(spec));
const mockPreventRemove = jest.fn();

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name, ...props }: any) => <Text {...props}>{name}</Text> };
});
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ bookId: 'user-book-1' }),
  useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace, dismiss: mockDismiss, canGoBack: () => true }),
  useNavigation: () => ({ dispatch: mockDispatch, canGoBack: () => true, getState: () => undefined, isFocused: () => true }),
}));
jest.mock('@react-navigation/native', () => ({
  usePreventRemove: (...args: any[]) => mockPreventRemove(...args),
}));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight', colors: {} }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => {
    const { useAuthStore: store } = require('@/features/auth/store/authStore');
    const session = store((state: any) => state.session);
    return { user: session?.user, session };
  },
}));
jest.mock('@/features/books/services/booksService', () => ({
  booksService: {
    getBookDetails: jest.fn(),
    getPublicReviewsForBook: jest.fn(),
    updateReadingStatus: jest.fn(),
    updateOwnership: jest.fn(),
    updateCondition: jest.fn(),
    toggleLendingAvailability: jest.fn(),
    removeFromLibrary: jest.fn(),
  },
}));
jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isConnected: !mockOffline, isOffline: mockOffline }),
}));
jest.mock('@/components/library/ui/BookFeedback', () => ({
  ...jest.requireActual('@/components/library/ui/BookFeedback'),
  BookFeedbackSlot: () => null,
  useBookFeedback: () => ({ notify: mockNotify, confirm: mockConfirm }),
}));

function makeBook(overrides: any = {}) {
  return {
    id: 'user-book-1',
    user_id: 'reader-1',
    book_id: 'book-1',
    rating: 3,
    review: 'First line\nSecond line',
    review_is_public: true,
    reading_status: 'reading',
    ownership: 'owned',
    condition: 'good',
    available_for_lending: false,
    ...overrides,
    book: {
      title: 'Walden',
      authors: ['Henry David Thoreau'],
      cover_url: null,
      page_count: 357,
      publisher: 'Ticknor and Fields',
      published_date: '1854-08-09',
      isbn_13: '9780140390445',
      description: 'Life in the woods.',
      ...(overrides.book ?? {}),
    },
  };
}

function renderReview() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  const ui = render(
    <QueryClientProvider client={client}>
      <ReviewScreen />
    </QueryClientProvider>,
  );
  return { client, ...ui };
}

// Navigating from Book Details leaves the book in the query cache, so the
// page mounts with synchronous data instead of a loading state.
function renderReviewCached() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  client.setQueryData(['book', 'reader-1', 'user-book-1'], mockUserBook);
  const ui = render(
    <QueryClientProvider client={client}>
      <ReviewScreen />
    </QueryClientProvider>,
  );
  return { client, ...ui };
}

async function settled(client: QueryClient) {
  await waitFor(() => expect(client.isMutating()).toBe(0));
}

function setVisibility(ui: { getByTestId: (id: string) => any }, value: boolean) {
  fireEvent(ui.getByTestId('library-review-visibility'), 'valueChange', value);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOffline = false;
  mockBookError = null;
  mockConfirmImpl = async () => false;
  useAuthStore.setState({
    session: { user: { id: 'reader-1' }, access_token: 'token-reader-1' } as any,
    status: 'authenticated',
  });
  mockUserBook = makeBook();
  (booksService.getBookDetails as jest.Mock).mockImplementation(async () => {
    if (mockBookError) throw mockBookError;
    return mockUserBook;
  });
  jest.spyOn(bookReviewService, 'update').mockImplementation(async (_actor, entryId, patch) => {
    mockUserBook = { ...mockUserBook, ...patch };
    const { rating, review, review_is_public } = mockUserBook;
    return { id: entryId, user_id: 'reader-1', rating, review, review_is_public };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  useAuthStore.setState({ session: null, status: 'unauthenticated' });
});

describe('Review page prefill and Save enablement', () => {
  it('prefills the saved review and visibility, with Save disabled until changed', async () => {
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      const input = await ui.findByTestId('library-review-text');
      expect(input.props.value).toBe('First line\nSecond line');
      expect(input.props.accessibilityLabel).toBe('Your review');
      // The book card carries the title; the header must not repeat it.
      expect(ui.getAllByText('Walden')).toHaveLength(1);
      expect(ui.getByText('Public review')).toBeOnTheScreen();
      expect(ui.getByText('Anyone can read this review.')).toBeOnTheScreen();
      const save = ui.getByTestId('library-review-save');
      expect(save.props.accessibilityState.disabled).toBe(true);

      fireEvent.changeText(input, 'First line\nSecond line');
      expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(true);

      fireEvent.changeText(input, 'Edited review');
      expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(false);

      fireEvent.changeText(input, 'First line\nSecond line');
      expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(true);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('visibility change alone enables Save', async () => {
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(true);
      setVisibility(ui, false);
      expect(ui.getByTestId('library-review-visibility').props.value).toBe(false);
      expect(ui.getByText('Public review')).toBeOnTheScreen();
      expect(ui.getByText('Only you can read this review.')).toBeOnTheScreen();
      expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(false);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('shows Private prefill when the saved review is private', async () => {
    mockUserBook = makeBook({ review: 'Quiet book', review_is_public: false });
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      expect(ui.getByTestId('library-review-text').props.value).toBe('Quiet book');
      expect(ui.getByTestId('library-review-visibility').props.value).toBe(false);
      expect(ui.getByText('Public review')).toBeOnTheScreen();
      expect(ui.getByText('Only you can read this review.')).toBeOnTheScreen();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});

describe('Review page save', () => {
  it('saves edited text with "Review saved" and returns to Book Details', async () => {
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      fireEvent.changeText(ui.getByTestId('library-review-text'), 'Brand new thoughts');
      fireEvent.press(ui.getByTestId('library-review-save'));
      await waitFor(() => expect(bookReviewService.update).toHaveBeenCalledTimes(1));
      expect((bookReviewService.update as jest.Mock).mock.calls[0][2]).toEqual({ review: 'Brand new thoughts' });
      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith({ kind: 'success', message: 'Review saved' }),
      );
      await settled(ui.client);
      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(ui.client.getQueryData<any>(['book', 'reader-1', 'user-book-1']).review).toBe('Brand new thoughts');
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('saves visibility alone with "Review saved"', async () => {
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      setVisibility(ui, false);
      fireEvent.press(ui.getByTestId('library-review-save'));
      await waitFor(() => expect(bookReviewService.update).toHaveBeenCalledTimes(1));
      expect((bookReviewService.update as jest.Mock).mock.calls[0][2]).toEqual({ review_is_public: false });
      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith({ kind: 'success', message: 'Review saved' }),
      );
      expect(mockUserBook.review_is_public).toBe(false);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('failure keeps the text and offers "Try again"', async () => {
    (bookReviewService.update as jest.Mock).mockRejectedValueOnce(new Error('review down'));
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      fireEvent.changeText(ui.getByTestId('library-review-text'), 'Unsaved thoughts');
      fireEvent.press(ui.getByTestId('library-review-save'));
      await waitFor(() => expect(bookReviewService.update).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith(
          expect.objectContaining({ kind: 'error', message: 'review down' }),
        ),
      );
      const errorCall = mockNotify.mock.calls.find(([input]: any) => input?.kind === 'error');
      expect(errorCall[0].action?.label).toBe('Try again');
      expect(ui.getByTestId('library-review-text').props.value).toBe('Unsaved thoughts');
      expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(false);
      expect(mockBack).not.toHaveBeenCalled();

      (bookReviewService.update as jest.Mock).mockImplementationOnce(async (_actor, entryId, patch) => {
        mockUserBook = { ...mockUserBook, ...patch };
        return { id: entryId, user_id: 'reader-1', rating: mockUserBook.rating, review: mockUserBook.review, review_is_public: mockUserBook.review_is_public };
      });
      errorCall[0].action.onPress();
      await waitFor(() => expect(bookReviewService.update).toHaveBeenCalledTimes(2));
      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith({ kind: 'success', message: 'Review saved' }),
      );
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('empty text asks "Remove your review?" and clears text with "Review removed" on confirm', async () => {
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      fireEvent.changeText(ui.getByTestId('library-review-text'), '');
      expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(false);
      fireEvent.press(ui.getByTestId('library-review-save'));
      await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
      expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Remove your review?', confirm: 'Remove review' }),
      );
      expect(bookReviewService.update).not.toHaveBeenCalled();

      mockConfirmImpl = async () => true;
      fireEvent.press(ui.getByTestId('library-review-save'));
      await waitFor(() => expect(bookReviewService.update).toHaveBeenCalledTimes(1));
      expect((bookReviewService.update as jest.Mock).mock.calls[0][2]).toEqual({ review: '' });
      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith({ kind: 'success', message: 'Review removed' }),
      );
      expect(mockUserBook.rating).toBe(3);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('stale actor never saves: switching users resets the draft and saves for the new user', async () => {
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      fireEvent.changeText(ui.getByTestId('library-review-text'), 'Reader one dirty');
      expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(false);

      mockUserBook = makeBook({ id: 'user-book-1', user_id: 'reader-2', review: 'Reader two saved', review_is_public: false, rating: 1 });
      await act(async () => {
        useAuthStore.setState({
          session: { user: { id: 'reader-2' }, access_token: 'token-reader-2' } as any,
          status: 'authenticated',
        });
      });
      await waitFor(() =>
        expect(ui.getByTestId('library-review-text').props.value).toBe('Reader two saved'),
      );
      expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(true);

      fireEvent.changeText(ui.getByTestId('library-review-text'), 'Reader two edited');
      fireEvent.press(ui.getByTestId('library-review-save'));
      await waitFor(() => expect(bookReviewService.update).toHaveBeenCalledTimes(1));
      const [, entryId, patch] = (bookReviewService.update as jest.Mock).mock.calls[0];
      expect(entryId).toBe('user-book-1');
      expect(patch).toEqual({ review: 'Reader two edited' });
      expect(mockUserBook.review).toBe('Reader two edited');
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});

describe('Review page guards and states', () => {
  it('registers a discard guard when dirty and none when clean', async () => {
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      expect(mockPreventRemove).toHaveBeenCalled();
      const cleanCall = mockPreventRemove.mock.calls.at(-1);
      expect(cleanCall[0]).toBe(false);

      fireEvent.changeText(ui.getByTestId('library-review-text'), 'Dirty text');
      await waitFor(() => {
        const last = mockPreventRemove.mock.calls.at(-1);
        expect(last[0]).toBe(true);
      });

      fireEvent.changeText(ui.getByTestId('library-review-text'), 'First line\nSecond line');
      await waitFor(() => {
        const last = mockPreventRemove.mock.calls.at(-1);
        expect(last[0]).toBe(false);
      });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('Back without changes leaves without asking', async () => {
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      fireEvent.press(ui.getByTestId('library-review-back'));
      await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
      expect(mockConfirm).not.toHaveBeenCalled();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('Back with changes asks "Discard changes?" and only leaves on confirm', async () => {
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      fireEvent.changeText(ui.getByTestId('library-review-text'), 'Dirty text');
      fireEvent.press(ui.getByTestId('library-review-back'));
      await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
      expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Discard changes?', confirm: 'Discard changes' }),
      );
      expect(mockBack).not.toHaveBeenCalled();

      mockConfirmImpl = async () => true;
      fireEvent.press(ui.getByTestId('library-review-back'));
      await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('offline disables Save with the offline caption and keeps the text', async () => {
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      fireEvent.changeText(ui.getByTestId('library-review-text'), 'Offline thoughts');
      mockOffline = true;
      ui.rerender(
        <QueryClientProvider client={ui.client}>
          <ReviewScreen />
        </QueryClientProvider>,
      );
      await ui.findByText('Saving needs a connection. Your text stays here.');
      const save = ui.getByTestId('library-review-save');
      expect(save.props.accessibilityState.disabled).toBe(true);
      fireEvent.press(save);
      expect(bookReviewService.update).not.toHaveBeenCalled();
      expect(ui.getByTestId('library-review-text').props.value).toBe('Offline thoughts');
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('not-found shows the classified error and never saves', async () => {
    mockBookError = { code: 'PGRST116', message: 'No rows' } as any;
    const ui = renderReview();
    try {
      await ui.findByText("We can't find this book.");
      expect(ui.queryByTestId('library-review-text')).toBeNull();
      expect(ui.queryByTestId('library-review-save')).toBeNull();
      expect(bookReviewService.update).not.toHaveBeenCalled();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

describe('Fix 1: whitespace-only text counts as empty', () => {
  it('whitespace-only with no saved review leaves Save disabled and sends nothing', async () => {
    mockUserBook = makeBook({ review: null });
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      fireEvent.changeText(ui.getByTestId('library-review-text'), '   \n  ');
      expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(true);
      fireEvent.press(ui.getByTestId('library-review-save'));
      expect(bookReviewService.update).not.toHaveBeenCalled();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('whitespace-only with visibility changed saves only the visibility', async () => {
    mockUserBook = makeBook({ review: null });
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      fireEvent.changeText(ui.getByTestId('library-review-text'), '   ');
      setVisibility(ui, false);
      expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(false);
      fireEvent.press(ui.getByTestId('library-review-save'));
      await waitFor(() => expect(bookReviewService.update).toHaveBeenCalledTimes(1));
      expect((bookReviewService.update as jest.Mock).mock.calls[0][2]).toEqual({ review_is_public: false });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('whitespace-only over a saved review asks removal and clears with { review: "" }', async () => {
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      fireEvent.changeText(ui.getByTestId('library-review-text'), '   ');
      fireEvent.press(ui.getByTestId('library-review-save'));
      await waitFor(() => expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Remove your review?', confirm: 'Remove review' }),
      ));
      expect(bookReviewService.update).not.toHaveBeenCalled();

      mockConfirmImpl = async () => true;
      fireEvent.press(ui.getByTestId('library-review-save'));
      await waitFor(() => expect(bookReviewService.update).toHaveBeenCalledTimes(1));
      expect((bookReviewService.update as jest.Mock).mock.calls[0][2]).toEqual({ review: '' });
      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith({ kind: 'success', message: 'Review removed' }),
      );
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});

describe('Fix 1: signed-out session shows the error state, never a spinner', () => {
  it('signed out from the start shows the classified error, not a loading spinner', async () => {
    await act(async () => {
      useAuthStore.setState({ session: null, status: 'unauthenticated' });
    });
    const ui = renderReview();
    try {
      await ui.findByText("Couldn't load this book.");
      expect(ui.queryByLabelText('Loading review')).toBeNull();
      expect(ui.queryByTestId('library-review-text')).toBeNull();
      expect(ui.queryByTestId('library-review-save')).toBeNull();
      expect(bookReviewService.update).not.toHaveBeenCalled();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('signing out mid-edit shows the error without saving, and the new user never gets the old draft', async () => {
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      fireEvent.changeText(ui.getByTestId('library-review-text'), 'Unsaved draft');
      await act(async () => {
        useAuthStore.setState({ session: null, status: 'unauthenticated' });
      });
      await ui.findByText("Couldn't load this book.");
      expect(ui.queryByLabelText('Loading review')).toBeNull();
      expect(bookReviewService.update).not.toHaveBeenCalled();
      expect(mockUserBook.review).toBe('First line\nSecond line');

      mockUserBook = makeBook({ id: 'user-book-1', user_id: 'reader-2', review: 'Reader two saved', review_is_public: false, rating: 1 });
      await act(async () => {
        useAuthStore.setState({
          session: { user: { id: 'reader-2' }, access_token: 'token-2' } as any,
          status: 'authenticated',
        });
      });
      await waitFor(() =>
        expect(ui.getByTestId('library-review-text').props.value).toBe('Reader two saved'),
      );
      fireEvent.changeText(ui.getByTestId('library-review-text'), 'Reader two edited');
      fireEvent.press(ui.getByTestId('library-review-save'));
      await waitFor(() => expect(bookReviewService.update).toHaveBeenCalledTimes(1));
      const [actorArg, , patch] = (bookReviewService.update as jest.Mock).mock.calls[0];
      expect(actorArg).toMatchObject({ id: 'reader-2' });
      expect(patch).toEqual({ review: 'Reader two edited' });
      expect(mockUserBook.review).toBe('Reader two edited');
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});

describe('Fix 1: one toast per Save', () => {
  it('text + visibility in one Save shows exactly one "Review saved"', async () => {
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      fireEvent.changeText(ui.getByTestId('library-review-text'), 'New thoughts');
      setVisibility(ui, false);
      fireEvent.press(ui.getByTestId('library-review-save'));
      await waitFor(() => expect(bookReviewService.update).toHaveBeenCalledTimes(2));
      await settled(ui.client);
      const success = mockNotify.mock.calls.filter(([input]: any) => input?.kind === 'success');
      expect(success).toHaveLength(1);
      expect(success[0][0]).toEqual({ kind: 'success', message: 'Review saved' });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('visibility + removal in one Save shows exactly one "Review removed"', async () => {
    mockConfirmImpl = async () => true;
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      setVisibility(ui, false);
      fireEvent.changeText(ui.getByTestId('library-review-text'), '   ');
      fireEvent.press(ui.getByTestId('library-review-save'));
      await waitFor(() => expect(bookReviewService.update).toHaveBeenCalledTimes(2));
      expect((bookReviewService.update as jest.Mock).mock.calls.map(([, , patch]) => patch)).toEqual([
        { review_is_public: false },
        { review: '' },
      ]);
      await settled(ui.client);
      const success = mockNotify.mock.calls.filter(([input]: any) => input?.kind === 'success');
      expect(success).toHaveLength(1);
      expect(success[0][0]).toEqual({ kind: 'success', message: 'Review removed' });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});

describe('Fix 1: Try again uses the current draft', () => {
  it('retry after a failed text save sends the edited text, not the stale one', async () => {
    (bookReviewService.update as jest.Mock).mockRejectedValueOnce(new Error('review down'));
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      fireEvent.changeText(ui.getByTestId('library-review-text'), 'First attempt');
      fireEvent.press(ui.getByTestId('library-review-save'));
      await waitFor(() => expect(bookReviewService.update).toHaveBeenCalledTimes(1));
      expect((bookReviewService.update as jest.Mock).mock.calls[0][2]).toEqual({ review: 'First attempt' });
      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith(
          expect.objectContaining({ kind: 'error', message: 'review down' }),
        ),
      );
      const errorCall = mockNotify.mock.calls.find(([input]: any) => input?.kind === 'error');
      expect(errorCall[0].action?.label).toBe('Try again');

      fireEvent.changeText(ui.getByTestId('library-review-text'), 'Second attempt');
      errorCall[0].action.onPress();
      await waitFor(() => expect(bookReviewService.update).toHaveBeenCalledTimes(2));
      expect((bookReviewService.update as jest.Mock).mock.calls[1][2]).toEqual({ review: 'Second attempt' });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});

describe('Fix 2: cached book initializes on mount', () => {
  it('prefills from cache, typing enables Save, dirty Back asks "Discard changes?"', async () => {
    const ui = renderReviewCached();
    try {
      await ui.findByTestId('library-review-header');
      expect(ui.getByTestId('library-review-text').props.value).toBe('First line\nSecond line');
      fireEvent.changeText(ui.getByTestId('library-review-text'), 'Cached draft edit');
      expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(false);
      fireEvent.press(ui.getByTestId('library-review-back'));
      await waitFor(() => expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Discard changes?', confirm: 'Discard changes' }),
      ));
      expect(mockBack).not.toHaveBeenCalled();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});

describe('Fix 1: discard guard invocation', () => {
  it('accepting the recorded guard dispatches the held action; refusing does not', async () => {
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      fireEvent.changeText(ui.getByTestId('library-review-text'), 'Dirty');
      const recorded = mockPreventRemove.mock.calls.at(-1);
      expect(recorded[0]).toBe(true);
      const heldAction = { type: 'GO_BACK_TEST' };
      mockConfirmImpl = async () => true;
      recorded[1]({ data: { action: heldAction } });
      await waitFor(() => expect(mockDispatch).toHaveBeenCalledWith(heldAction));
    } finally {
      ui.unmount();
      ui.client.clear();
    }

    jest.clearAllMocks();
    mockConfirmImpl = async () => false;
    const ui2 = renderReview();
    try {
      await ui2.findByTestId('library-review-header');
      fireEvent.changeText(ui2.getByTestId('library-review-text'), 'Dirty again');
      const recorded = mockPreventRemove.mock.calls.at(-1);
      expect(recorded[0]).toBe(true);
      recorded[1]({ data: { action: { type: 'GO_BACK_TEST' } } });
      await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(mockDispatch).not.toHaveBeenCalled();
      expect(mockBack).not.toHaveBeenCalled();
    } finally {
      ui2.unmount();
      ui2.client.clear();
    }
  });

  it('web wires the browser-history guard for Back outside the router', async () => {
    const previousOS = Platform.OS;
    Platform.OS = 'web' as any;
    // This jest env has no window.addEventListener; stub the DOM surface the
    // web guard needs so the guardComposerHistory path runs as in a browser.
    const addWindowListener = jest.fn();
    const removeWindowListener = jest.fn();
    (window as any).addEventListener = addWindowListener;
    (window as any).removeEventListener = removeWindowListener;
    const addNavigate = jest.fn();
    const removeNavigate = jest.fn();
    (window as any).navigation = { addEventListener: addNavigate, removeEventListener: removeNavigate, currentEntry: null };
    try {
      const ui = renderReview();
      await ui.findByTestId('library-review-header');
      expect(addWindowListener).toHaveBeenCalledWith('popstate', expect.any(Function), true);
      expect(addNavigate).toHaveBeenCalledWith('navigate', expect.any(Function));
      ui.unmount();
      expect(removeNavigate).toHaveBeenCalledWith('navigate', expect.any(Function));
    } finally {
      delete (window as any).navigation;
      delete (window as any).addEventListener;
      delete (window as any).removeEventListener;
      Platform.OS = previousOS;
    }
  });
});

  it('uses library type, flexible text containers and 48px targets with exactly one primary', async () => {
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      const { LIBRARY_TEXT } = require('@/components/library/LibraryTypography');
      const input = ui.getByTestId('library-review-text');
      expect(input.props.scrollEnabled).toBe(false);
      expect(input.props.placeholder).toBe('What did you think?');
      const flat = StyleSheet.flatten(input.props.style);
      expect(flat.height).toBe(160);
      expect(flat.minHeight).toBeGreaterThanOrEqual(48);
      expect(flat.fontSize).toBe(LIBRARY_TEXT.bodySerif.fontSize);
      expect(flat.lineHeight).toBe(LIBRARY_TEXT.bodySerif.lineHeight);
      expect(flat.backgroundColor).toBe(require('@/components/library/LibraryAppearance').getLibraryAppearance('daylight').bgCard);
      fireEvent(input, 'contentSizeChange', { nativeEvent: { contentSize: { height: 300, width: 100 } } });
      expect(StyleSheet.flatten(ui.getByTestId('library-review-text').props.style).height).toBe(300);

      const save = ui.getByTestId('library-review-save');
      expect(StyleSheet.flatten(save.props.style)?.minHeight).toBeGreaterThanOrEqual(48);
      expectSinglePrimary(ui);

      fireEvent.changeText(input, 'Dirty for primary check');
      expectSinglePrimary(ui);

      mockOffline = true;
      ui.rerender(
        <QueryClientProvider client={ui.client}>
          <ReviewScreen />
        </QueryClientProvider>,
      );
      await ui.findByText('Saving needs a connection. Your text stays here.');
      expectSinglePrimary(ui);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});

describe('Fix 3: rating on the review page', () => {
  it('prefills the saved rating with the matching star checked', async () => {
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      const group = ui.getByLabelText('Your rating');
      expect(group.props.accessibilityRole).toBe('radiogroup');
      expect(
        within(group).getByRole('radio', { name: '3 stars' }).props.accessibilityState.checked,
      ).toBe(true);
      expect(
        within(group).getByRole('radio', { name: '5 stars' }).props.accessibilityState.checked,
      ).toBe(false);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('changing the stars enables Save and sends the rating with "Review saved"', async () => {
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(true);
      fireEvent.press(within(ui.getByLabelText('Your rating')).getByRole('radio', { name: '5 stars' }));
      expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(false);
      fireEvent.press(ui.getByTestId('library-review-save'));
      await waitFor(() => expect(bookReviewService.update).toHaveBeenCalledTimes(1));
      expect((bookReviewService.update as jest.Mock).mock.calls[0][2]).toEqual({ rating: 5 });
      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith({ kind: 'success', message: 'Review saved' }),
      );
      expect(mockNotify).not.toHaveBeenCalledWith({ kind: 'success', message: 'Rating saved' });
      await settled(ui.client);
      expect(mockBack).toHaveBeenCalledTimes(1);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('rating-only save works with empty text', async () => {
    mockUserBook = makeBook({ review: null, rating: null });
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      fireEvent.press(within(ui.getByLabelText('Your rating')).getByRole('radio', { name: '4 stars' }));
      expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(false);
      fireEvent.press(ui.getByTestId('library-review-save'));
      await waitFor(() => expect(bookReviewService.update).toHaveBeenCalledTimes(1));
      expect((bookReviewService.update as jest.Mock).mock.calls[0][2]).toEqual({ rating: 4 });
      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith({ kind: 'success', message: 'Review saved' }),
      );
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('offline: a changed rating keeps Save disabled and sends no write', async () => {
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      fireEvent.press(within(ui.getByLabelText('Your rating')).getByRole('radio', { name: '5 stars' }));
      mockOffline = true;
      ui.rerender(
        <QueryClientProvider client={ui.client}>
          <ReviewScreen />
        </QueryClientProvider>,
      );
      const save = ui.getByTestId('library-review-save');
      await waitFor(() => expect(save.props.accessibilityState.disabled).toBe(true));
      fireEvent.press(save);
      expect(bookReviewService.update).not.toHaveBeenCalled();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('retries a rejected rating save on the next Save with the current stars', async () => {
    (bookReviewService.update as jest.Mock).mockRejectedValueOnce(new Error('review down'));
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      fireEvent.press(within(ui.getByLabelText('Your rating')).getByRole('radio', { name: '4 stars' }));
      fireEvent.press(ui.getByTestId('library-review-save'));
      await waitFor(() => expect(bookReviewService.update).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error', message: 'review down' })),
      );
      await settled(ui.client);
      fireEvent.press(ui.getByTestId('library-review-save'));
      await waitFor(() => expect(bookReviewService.update).toHaveBeenCalledTimes(2));
      expect((bookReviewService.update as jest.Mock).mock.calls[1][2]).toEqual({ rating: 4 });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('removal keeps the saved rating unless the stars changed in the same draft', async () => {
    mockConfirmImpl = async () => true;
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      fireEvent.changeText(ui.getByTestId('library-review-text'), '   ');
      fireEvent.press(ui.getByTestId('library-review-save'));
      await waitFor(() => expect(bookReviewService.update).toHaveBeenCalledTimes(1));
      expect((bookReviewService.update as jest.Mock).mock.calls[0][2]).toEqual({ review: '' });
      expect(mockUserBook.rating).toBe(3);
    } finally {
      ui.unmount();
      ui.client.clear();
    }

    jest.clearAllMocks();
    mockConfirmImpl = async () => true;
    mockUserBook = makeBook();
    const ui2 = renderReview();
    try {
      await ui2.findByTestId('library-review-header');
      fireEvent.press(within(ui2.getByLabelText('Your rating')).getByRole('radio', { name: '5 stars' }));
      fireEvent.changeText(ui2.getByTestId('library-review-text'), '   ');
      fireEvent.press(ui2.getByTestId('library-review-save'));
      await waitFor(() => expect(bookReviewService.update).toHaveBeenCalledTimes(2));
      expect((bookReviewService.update as jest.Mock).mock.calls.map(([, , patch]) => patch)).toEqual([
        { rating: 5 },
        { review: '' },
      ]);
      expect(mockUserBook.rating).toBe(5);
      await settled(ui2.client);
      const success = mockNotify.mock.calls.filter(([input]: any) => input?.kind === 'success');
      expect(success).toHaveLength(1);
      expect(success[0][0]).toEqual({ kind: 'success', message: 'Review removed' });
    } finally {
      ui2.unmount();
      ui2.client.clear();
    }
  });

  it('Back with only a rating change asks "Discard changes?"', async () => {
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      fireEvent.press(within(ui.getByLabelText('Your rating')).getByRole('radio', { name: '1 star' }));
      fireEvent.press(ui.getByTestId('library-review-back'));
      await waitFor(() => expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Discard changes?', confirm: 'Discard changes' }),
      ));
      expect(mockBack).not.toHaveBeenCalled();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});

describe('Fix 3: visible Switch', () => {
  it('renders a real switch with token colours that toggles and is sent', async () => {
    const { Switch } = require('react-native');
    const { getLibraryAppearance } = require('@/components/library/LibraryAppearance');
    const colors = getLibraryAppearance('daylight');
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      const toggle = ui.UNSAFE_getByType(Switch);
      expect(toggle.props.accessibilityRole).toBe('switch');
      expect(toggle.props.testID).toBe('library-review-visibility');
      expect(toggle.props.value).toBe(true);
      expect(toggle.props.trackColor).toEqual({ false: colors.controlBorder, true: colors.accent });
      expect(toggle.props.thumbColor).toBe(colors.textOnAccent);
      expect(ui.getByText('Public review')).toBeOnTheScreen();
      setVisibility(ui, false);
      expect(ui.UNSAFE_getByType(Switch).props.value).toBe(false);
      expect(ui.UNSAFE_getByType(Switch).props.thumbColor).toBe(colors.textSecondary);
      expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(false);
      fireEvent.press(ui.getByTestId('library-review-save'));
      await waitFor(() => expect(bookReviewService.update).toHaveBeenCalledTimes(1));
      expect((bookReviewService.update as jest.Mock).mock.calls[0][2]).toEqual({ review_is_public: false });
      let row: any = ui.getByTestId('library-review-visibility');
      while (row && StyleSheet.flatten(row.props.style)?.minHeight === undefined) row = row.parent;
      expect(row).toBeTruthy();
      expect(StyleSheet.flatten(row.props.style).minHeight).toBeGreaterThanOrEqual(48);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});

describe('Fix 4: review page look', () => {
  it('shows the header card with serif title, author and a muted placeholder cover', async () => {
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      expect(ui.getByTestId('library-review-header')).toBeTruthy();
      const { LIBRARY_TEXT } = require('@/components/library/LibraryTypography');
      const { getLibraryAppearance } = require('@/components/library/LibraryAppearance');
      const colors = getLibraryAppearance('daylight');
      expect(ui.getByRole('header', { name: 'Walden' })).toBeOnTheScreen();
      expect(ui.getByText('Henry David Thoreau')).toBeOnTheScreen();
      const placeholder = ui.getByTestId('library-review-cover-placeholder', { includeHiddenElements: true });
      expect(StyleSheet.flatten(placeholder.props.style).backgroundColor).toBe(colors.coverPlaceholder);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('shows a cover thumbnail when the book has one', async () => {
    mockUserBook = makeBook({ book: { cover_url: 'https://example.com/cover.jpg' } });
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      expect(ui.getByTestId('library-review-cover')).toBeTruthy();
      expect(ui.queryByTestId('library-review-cover-placeholder')).toBeNull();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('shows "Tap to rate" with no rating and the value label follows the stars', async () => {
    mockUserBook = makeBook({ rating: null });
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      expect(ui.getByTestId('library-rating-value')).toHaveTextContent('Tap to rate');
      fireEvent.press(within(ui.getByLabelText('Your rating')).getByRole('radio', { name: '4 stars' }));
      expect(ui.getByTestId('library-rating-value')).toHaveTextContent('Great');
      expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(false);
      fireEvent.press(within(ui.getByLabelText('Your rating')).getByRole('radio', { name: '2 stars' }));
      expect(ui.getByTestId('library-rating-value')).toHaveTextContent('Fair');
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('uses large 40px stars on the review page', async () => {
    const { RatingInput } = require('@/components/library/RatingInput');
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      expect(ui.UNSAFE_getByType(RatingInput).props.size).toBe(40);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('shows a quiet character count that follows the draft', async () => {
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      const count = ui.getByTestId('library-review-count');
      expect(count).toHaveTextContent('22 characters');
      expect(StyleSheet.flatten(count.props.style).fontSize).toBe(
        require('@/components/library/LibraryTypography').LIBRARY_TEXT.caption.fontSize,
      );
      fireEvent.changeText(ui.getByTestId('library-review-text'), 'Hi');
      expect(ui.getByTestId('library-review-count')).toHaveTextContent('2 characters');
      fireEvent.changeText(ui.getByTestId('library-review-text'), 'Hey');
      expect(ui.getByTestId('library-review-count')).toHaveTextContent('3 characters');
      fireEvent.changeText(ui.getByTestId('library-review-text'), 'H');
      expect(ui.getByTestId('library-review-count')).toHaveTextContent('1 character');
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('the whole visibility row toggles the switch', async () => {
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      expect(ui.UNSAFE_getByType(require('react-native').Switch).props.value).toBe(true);
      fireEvent.press(ui.getByTestId('library-review-visibility-row'));
      expect(ui.UNSAFE_getByType(require('react-native').Switch).props.value).toBe(false);
      expect(ui.getByTestId('library-review-save').props.accessibilityState.disabled).toBe(false);
      fireEvent.press(ui.getByTestId('library-review-visibility-row'));
      expect(ui.UNSAFE_getByType(require('react-native').Switch).props.value).toBe(true);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('keeps exactly one primary with the header card, stars, visibility card and Save', async () => {
    const ui = renderReview();
    try {
      await ui.findByTestId('library-review-header');
      expect(ui.getByTestId('library-review-header')).toBeTruthy();
      expect(ui.getByTestId('library-rating-value')).toBeTruthy();
      expect(ui.getByTestId('library-review-visibility-row')).toBeTruthy();
      fireEvent.changeText(ui.getByTestId('library-review-text'), 'Dirty');
      expectSinglePrimary(ui);
      // The Save button is the single full-width primary at the end: neither
      // it nor the body container centres content.
      const save = ui.getByTestId('library-review-save');
      expect(StyleSheet.flatten(save.props.style).alignSelf).toBeUndefined();
      expect(StyleSheet.flatten(ui.getByTestId('library-review-body').props.style).alignItems).toBeUndefined();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});
