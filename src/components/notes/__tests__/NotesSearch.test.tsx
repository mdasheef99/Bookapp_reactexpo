/** SDD-10 Unit A: search inside one book's notes. */
import React from 'react';
import { FlatList, Text, TextInput, View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import NotesScreen from '../../../../app/(tabs)/library/notes';
import { NoteSearchField } from '../NoteSearchField';
import { CategoryPicker } from '../ManualNoteUi';
import { ExportButton } from '@/components/library/export';
import { expectSinglePrimary } from '@/test-utils/bookSection';
import type { ManualNote } from '@/features/books/notes/manualNoteContract';
import type { ExportFeedback } from '@/features/books/export/useExportActions';

let mockParams: Record<string, string>;
let mockOffline = false;
let mockExportAvailable = true;
let mockExportBusy = false;
let mockExportReady = false;
let mockExportFeedback: ExportFeedback = null;
const mockExportRun = jest.fn();
const mockExportPrint = jest.fn();
const mockExportCancel = jest.fn();
const mockExportDispose = jest.fn();
jest.mock('@/features/books/export/deliver', () => ({ exportDeliveryAvailable: () => mockExportAvailable }));
jest.mock('@/features/books/export/useExportActions', () => ({ useNotesExport: () => ({
  run: mockExportRun, busy: mockExportBusy, feedback: mockExportFeedback,
  ready: mockExportReady, print: mockExportPrint, cancel: mockExportCancel, dispose: mockExportDispose,
}) }));
let mockBookError = false;
let mockBookData: { id: string; title: string; authors: string[] } | undefined;
let mockCollection: ManualNote[] | undefined;
let mockCollectionPending = false;
let mockCollectionError = false;
let mockId = 0;
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismiss: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockId}` }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => mockRouter,
  useNavigation: () => ({
    dispatch: jest.fn(),
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
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isConnected: !mockOffline, isOffline: mockOffline }) }));
jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: any) => {
    if (options.queryKey[0] === 'notes') {
      return { data: mockCollection, isPending: mockCollectionPending, isError: mockCollectionError, isRefetching: false, refetch: jest.fn(async () => ({})) };
    }
    return { data: undefined, isPending: false, isError: false, refetch: jest.fn(async () => ({})) };
  },
}));
jest.mock('@/features/books/notes/useManualNotes', () => ({
  useNoteContext: () => ({
    actorId: 'actor',
    book: { data: mockBookData, isPending: false, isError: mockBookError, refetch: jest.fn() },
  }),
  useNoteOperations: () => [],
}));
jest.mock('@/features/books/notes/manualNotesGateway', () => ({
  manualNotesGateway: { list: jest.fn(), record: jest.fn(), remove: jest.fn() },
}));

const note = (overrides: Partial<ManualNote> = {}): ManualNote => ({
  id: 'note-1', user_id: 'actor', user_book_id: 'book', content: 'A saved body',
  tag: 'quote', page_number: 42, created_at: '2026-10-14T12:00:00Z', updated_at: null, version: 1, ...overrides,
});

const fourNotes = (): ManualNote[] => ([
  note({ id: '1', content: 'Hooked on habits', tag: 'quote' }),
  note({ id: '2', content: 'Hooked thought', tag: 'reflect' }),
  note({ id: '3', content: 'Other quote', tag: 'quote' }),
  note({ id: '4', content: 'Unrelated action', tag: 'apply' }),
]);

beforeEach(() => {
  jest.clearAllMocks();
  mockOffline = false; mockBookError = false;
  mockBookData = { id: 'book', title: 'Selected book', authors: [] };
  mockCollection = fourNotes(); mockCollectionPending = false; mockCollectionError = false;
  mockExportAvailable = true; mockExportBusy = false; mockExportFeedback = null; mockExportReady = false;
  mockParams = { userBookId: 'book' };
});

describe('notes search field', () => {
  it('shows the field with its label and placeholder when the book has notes', async () => {
    render(<NotesScreen />);
    expect(await screen.findByText('4 notes')).toBeTruthy();
    const field = screen.getByLabelText("Search this book's notes");
    expect(field.props.placeholder).toBe('Search notes');
    expect(field.props.value).toBe('');
    expectSinglePrimary(screen);
  });

  it('hides the field when the book has no notes', async () => {
    mockCollection = [];
    render(<NotesScreen />);
    expect(await screen.findByText('No notes yet')).toBeTruthy();
    expect(screen.queryByLabelText("Search this book's notes")).toBeNull();
    expectSinglePrimary(screen);
  });

  it('filters the list while typing and keeps the typed text across keystrokes', async () => {
    render(<NotesScreen />);
    expect(await screen.findByText('4 notes')).toBeTruthy();
    const firstInstance = screen.getByLabelText("Search this book's notes");
    fireEvent.changeText(firstInstance, 'hook');
    expect(screen.getByLabelText("Search this book's notes")).toBe(firstInstance);
    expect(screen.getByLabelText("Search this book's notes").props.value).toBe('hook');
    fireEvent.changeText(firstInstance, 'hooked');
    expect(screen.getByLabelText("Search this book's notes")).toBe(firstInstance);
    expect(await screen.findByText('2 of 4 notes')).toBeTruthy();
    expect(screen.getByText('“Hooked on habits”')).toBeTruthy();
    expect(screen.getByText('Hooked thought')).toBeTruthy();
    expect(screen.queryByText('“Other quote”')).toBeNull();
    expect(screen.getByLabelText("Search this book's notes").props.value).toBe('hooked');
    expectSinglePrimary(screen);
  });

  it('counts the search against the current category and uses the singular for one', async () => {
    render(<NotesScreen />);
    expect(await screen.findByText('4 notes')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Search this book's notes"), 'hooked');
    expect(await screen.findByText('2 of 4 notes')).toBeTruthy();
    fireEvent.press(screen.getByRole('radio', { name: 'Thought' }));
    expect(await screen.findByText('1 of 1 note')).toBeTruthy();
    expect(screen.getByText('Hooked thought')).toBeTruthy();
    expect(screen.queryByText('“Hooked on habits”')).toBeNull();
    expect(screen.getByText('Showing Thought notes.')).toBeTruthy();
    expectSinglePrimary(screen);
  });

  it('shows a no-match message whose Clear search keeps the chip', async () => {
    render(<NotesScreen />);
    expect(await screen.findByText('4 notes')).toBeTruthy();
    fireEvent.press(screen.getByRole('radio', { name: 'Thought' }));
    fireEvent.changeText(screen.getByLabelText("Search this book's notes"), 'zzz');
    expect(await screen.findByText('No notes match "zzz".')).toBeTruthy();
    expect(await screen.findByText('0 of 1 note')).toBeTruthy();
    const clear = screen.getByRole('button', { name: 'Clear search' });
    expect(clear).toBeTruthy();
    fireEvent.press(clear);
    expect(screen.getByLabelText("Search this book's notes").props.value).toBe('');
    expect(await screen.findByText('Hooked thought')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Thought' }).props.accessibilityState.checked).toBe(true);
    expectSinglePrimary(screen);
  });

  it('clears the text from the in-field × without touching the chip', async () => {
    render(<NotesScreen />);
    expect(await screen.findByText('4 notes')).toBeTruthy();
    fireEvent.press(screen.getByRole('radio', { name: 'Quote' }));
    fireEvent.changeText(screen.getByLabelText("Search this book's notes"), 'hooked');
    expect(await screen.findByText('1 of 2 notes')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Clear search text' }));
    expect(screen.getByLabelText("Search this book's notes").props.value).toBe('');
    expect(await screen.findByText('“Hooked on habits”')).toBeTruthy();
    expect(await screen.findByText('“Other quote”')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Quote' }).props.accessibilityState.checked).toBe(true);
    expectSinglePrimary(screen);
  });

  it('returns focus to the input after clearing from the in-field ×', async () => {
    render(<NotesScreen />);
    expect(await screen.findByText('4 notes')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Search this book's notes"), 'hooked');
    expect(await screen.findByText('2 of 4 notes')).toBeTruthy();
    const inputNode = screen.UNSAFE_getByType(TextInput);
    const focus = jest.fn();
    (inputNode.instance as unknown as { focus: () => void }).focus = focus;
    fireEvent.press(screen.getByRole('button', { name: 'Clear search text' }));
    expect(screen.getByLabelText("Search this book's notes").props.value).toBe('');
    expect(focus).toHaveBeenCalledTimes(1);
    expectSinglePrimary(screen);
  });

  it('returns focus to the input after clearing from the no-match Clear search', async () => {
    render(<NotesScreen />);
    expect(await screen.findByText('4 notes')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Search this book's notes"), 'zzz');
    expect(await screen.findByText('No notes match "zzz".')).toBeTruthy();
    const inputNode = screen.UNSAFE_getByType(TextInput);
    const focus = jest.fn();
    (inputNode.instance as unknown as { focus: () => void }).focus = focus;
    fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByLabelText("Search this book's notes").props.value).toBe('');
    expect(focus).toHaveBeenCalledTimes(1);
    expectSinglePrimary(screen);
  });

  it('shows 0 notes with no of-count when the book becomes empty while typing', async () => {
    const ui = render(<NotesScreen />);
    expect(await screen.findByText('4 notes')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Search this book's notes"), 'hooked');
    expect(await screen.findByText('2 of 4 notes')).toBeTruthy();
    mockCollection = [];
    ui.rerender(<NotesScreen />);
    expect(await screen.findByText('0 notes')).toBeTruthy();
    expect(await screen.findByText('No notes yet')).toBeTruthy();
    expect(screen.queryByText(/\d+ of \d+/)).toBeNull();
    expectSinglePrimary(screen);
  });

  it('keeps taps on chips and Clear search while the keyboard is open', async () => {
    render(<NotesScreen />);
    expect(await screen.findByText('4 notes')).toBeTruthy();
    expect(screen.UNSAFE_getByType(FlatList).props.keyboardShouldPersistTaps).toBe('handled');
  });

  it('keeps header order: search above count, Export below the chips', async () => {
    render(<NotesScreen />);
    expect(await screen.findByText('4 notes')).toBeTruthy();
    const header = screen.UNSAFE_getByType(FlatList).props.ListHeaderComponent;
    const children = header.props.children;
    const direct: unknown[] = Array.isArray(children) ? children : [children];
    const containsExportButton = (node: unknown): boolean => {
      if (!node || typeof node !== 'object') return false;
      if (Array.isArray(node)) return node.some(containsExportButton);
      const element = node as { type?: unknown; props?: { children?: unknown; accessibilityLabel?: string } };
      if (element.type === ExportButton) return true;
      if (typeof element.props?.accessibilityLabel === 'string' && element.props.accessibilityLabel.startsWith('Export notes for')) return true;
      return containsExportButton(element.props?.children);
    };
    let searchIdx = -1;
    let countIdx = -1;
    let chipsIdx = -1;
    let exportIdx = -1;
    direct.forEach((child, index) => {
      if (!child || typeof child !== 'object' || !('type' in (child as object))) return;
      const element = child as { type?: unknown; props?: { children?: unknown } };
      if (element.type === NoteSearchField && searchIdx < 0) searchIdx = index;
      else if (element.type === Text && typeof element.props?.children === 'string' && /note/.test(element.props.children) && countIdx < 0) countIdx = index;
      else if (element.type === CategoryPicker && chipsIdx < 0) chipsIdx = index;
      else if (element.type === View && containsExportButton(element.props?.children) && exportIdx < 0) exportIdx = index;
    });
    expect(searchIdx).toBeGreaterThanOrEqual(0);
    expect(countIdx).toBeGreaterThanOrEqual(0);
    expect(chipsIdx).toBeGreaterThanOrEqual(0);
    expect(exportIdx).toBeGreaterThanOrEqual(0);
    expect(searchIdx).toBeLessThan(countIdx);
    expect(countIdx).toBeLessThan(chipsIdx);
    expect(chipsIdx).toBeLessThan(exportIdx);
  });

  it('ignores outer spaces and matches through NFKC without folding accents', async () => {
    mockCollection = [
      note({ id: '1', content: 'ＡＢＣ habits', tag: 'quote' }),
      note({ id: '2', content: 'café notes', tag: 'quote' }),
    ];
    render(<NotesScreen />);
    expect(await screen.findByText('2 notes')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Search this book's notes"), '  abc  ');
    expect(await screen.findByText('1 of 2 notes')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Search this book's notes"), 'cafe');
    expect(await screen.findByText('0 of 2 notes')).toBeTruthy();
    expect(await screen.findByText('No notes match "cafe".')).toBeTruthy();
  });
});
