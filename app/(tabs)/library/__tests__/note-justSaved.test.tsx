import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import NoteReaderScreen from '../note';
import { useBookReadingHistory } from '@/features/books/history/useBookReadingHistory';
import { useReadProgress } from '@/features/books/history/useReadProgress';

let mockParams: Record<string, string>;
let mockRecord: any;
const mockSetParams = jest.fn();
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  dismiss: jest.fn(),
  canGoBack: jest.fn(() => true),
  setParams: mockSetParams,
};
const mockHistory = useBookReadingHistory as jest.Mock;
const mockProgress = useReadProgress as jest.Mock;

jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid-1' }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => mockRouter,
  useNavigation: () => ({
    dispatch: jest.fn(),
    isFocused: () => true,
    getState: () => ({
      index: 1,
      routes: [
        { name: 'notes', key: 'notes-key', params: { userBookId: 'book' } },
        { name: 'note', key: 'reader-key', params: { bookId: 'book', noteId: 'note' } },
      ],
    }),
  }),
}));
jest.mock('@react-navigation/native', () => ({ usePreventRemove: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }) }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight', colors: {} }) }));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isConnected: true, isOffline: false }) }));
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: mockRecord, isPending: false, isError: false, refetch: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock('@/features/books/notes/useManualNotes', () => ({
  useNoteContext: () => ({
    actorId: 'actor',
    book: { data: { id: 'book', title: 'Selected book', authors: [] }, isPending: false, isError: false, refetch: jest.fn() },
  }),
  useNoteOperations: () => [],
  useNoteRemovalRefresh: () => jest.fn(),
}));
jest.mock('@/features/books/notes/manualNotesGateway', () => ({
  manualNotesGateway: { record: jest.fn() },
  manualNoteDeleteAdapter: { remove: jest.fn() },
  isManualNoteDeleteAuthorized: () => true,
}));
jest.mock('@/features/books/history/useBookReadingHistory', () => ({ useBookReadingHistory: jest.fn() }));
jest.mock('@/features/books/history/useReadProgress', () => ({ useReadProgress: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/components/library/ui/BookFeedback', () => ({
  ...jest.requireActual('@/components/library/ui/BookFeedback'),
  BookFeedbackSlot: () => null,
  useBookFeedback: () => ({ notify: jest.fn(), confirm: jest.fn() }),
}));
jest.mock('@/components/library/export', () => ({ ExportButton: () => null, PassageCardPreview: () => null }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(() => Promise.resolve()), ImpactFeedbackStyle: { Light: 'Light' } }));

function openRead() {
  return {
    id: 'read-1',
    user_book_id: 'book',
    user_id: 'actor',
    read_number: 1,
    outcome: 'reading',
    started_at: '2026-10-01T10:00:00.000Z',
    ended_at: null,
    started_on: null,
    ended_on: null,
    start_unknown: false,
    end_unknown: false,
    total_pages: 320,
    counts_in_stats: true,
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-02T10:00:00.000Z',
  };
}

function setupHistory() {
  mockHistory.mockReturnValue({
    reads: { data: [openRead()], isPending: false, isError: false, refetch: jest.fn() },
  });
  mockProgress.mockReturnValue({
    progress: {
      data: [
        {
          id: 'progress-1',
          read_id: 'read-1',
          user_id: 'actor',
          page: 100,
          percent: null,
          recorded_at: '2026-10-10T12:00:00.000Z',
        },
      ],
      isPending: false,
      isError: false,
      refetch: jest.fn(),
    },
    addProgress: { mutateAsync: jest.fn(), isPending: false },
    setTotalPages: { mutateAsync: jest.fn(), isPending: false },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRecord = {
    id: 'note',
    user_id: 'actor',
    user_book_id: 'book',
    content: 'A saved body',
    tag: 'quote',
    page_number: 142,
    created_at: '2026-10-14T12:00:00Z',
    updated_at: null,
    version: 1,
  };
  mockParams = { bookId: 'book', noteId: 'note' };
  setupHistory();
});

describe('note reader justSaved gating', () => {
  it('does not mount the prompt or fetch history without justSaved', async () => {
    mockHistory.mockClear();
    mockProgress.mockClear();
    const ui = render(<NoteReaderScreen />);
    try {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
      expect(ui.queryByTestId('library-note-progress-prompt')).toBeNull();
      expect(mockHistory).not.toHaveBeenCalled();
      expect(mockProgress).not.toHaveBeenCalled();
      expect(mockSetParams).not.toHaveBeenCalled();
    } finally {
      ui.unmount();
    }
  });

  it('mounts the prompt and clears justSaved after a save', async () => {
    mockParams = { bookId: 'book', noteId: 'note', justSaved: '1' };
    const ui = render(<NoteReaderScreen />);
    try {
      expect(await ui.findByTestId('library-note-progress-prompt')).toBeOnTheScreen();
      expect(mockHistory).toHaveBeenCalled();
      await waitFor(() => expect(mockSetParams).toHaveBeenCalledWith({ justSaved: undefined }));
    } finally {
      ui.unmount();
    }
  });

  it('does not mount the prompt for a page-less note even with justSaved', async () => {
    mockRecord = { ...mockRecord, page_number: null };
    mockParams = { bookId: 'book', noteId: 'note', justSaved: '1' };
    mockHistory.mockClear();
    const ui = render(<NoteReaderScreen />);
    try {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
      expect(ui.queryByTestId('library-note-progress-prompt')).toBeNull();
    } finally {
      ui.unmount();
    }
  });
});
