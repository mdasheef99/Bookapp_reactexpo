/** Flow B build B1: passage link, notes list states, note reader layout, NoteDialog spec. */
import React from 'react';
import { AccessibilityInfo, Clipboard, FlatList, ScrollView, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import NotesScreen from '../../../../app/(tabs)/library/notes';
import NoteReaderScreen from '../../../../app/(tabs)/library/note';
import { NotePassageLink } from '../NotePassageLink';
import { NoteDialog } from '../ManualNoteUi';
import { BookButton, BookFeedbackProvider } from '@/components/library/ui';
import { MIN_TARGET } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import { COLUMN_MAX_WIDTH, DIALOG_MAX_WIDTH } from '@/components/library/bookDetails/bookDetailsTokens';
import { expectSinglePrimary } from '@/test-utils/bookSection';
import type { ManualNote } from '@/features/books/notes/manualNoteContract';
import type { NoteOperation } from '@/features/books/notes/noteSaveCoordinator';
import { registerNoteContext } from '@/features/books/notes/noteNavigation';
import type { ExportFeedback } from '@/features/books/export/useExportActions';

let mockParams: Record<string, string>;
let mockOffline = false;
let mockExportAvailable = false;
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
let mockDeleteAuthorized = true;
let mockBookError = false;
let mockBookData: { id: string; title: string } | undefined;
let mockCollection: ManualNote[] | undefined;
let mockCollectionPending = false;
let mockCollectionError = false;
let mockRecord: ManualNote | null | undefined;
let mockRecordPending = false;
let mockRecordError = false;
let mockOperations: NoteOperation[] = [];
let mockId = 0;
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismiss: jest.fn(), canGoBack: jest.fn(() => true) };
const mockRemoveFromCache = jest.fn(async (_noteId: string) => {});
const mockDelete = jest.fn();
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
    return { data: mockRecord, isPending: mockRecordPending, isError: mockRecordError, refetch: jest.fn(async () => ({})) };
  },
}));
jest.mock('@/features/books/notes/useManualNotes', () => ({
  useNoteContext: () => ({
    actorId: 'actor',
    book: { data: mockBookData, isPending: false, isError: mockBookError, refetch: jest.fn() },
  }),
  useNoteOperations: () => mockOperations,
  useNoteRemovalRefresh: () => mockRemoveFromCache,
}));
jest.mock('@/features/books/notes/manualNotesGateway', () => ({
  manualNotesGateway: { list: jest.fn(), record: jest.fn(), remove: jest.fn() },
  manualNoteDeleteAdapter: { remove: (...args: unknown[]) => mockDelete(...args) },
  isManualNoteDeleteAuthorized: () => mockDeleteAuthorized,
}));

const note = (overrides: Partial<ManualNote> = {}): ManualNote => ({
  id: 'note-1', user_id: 'actor', user_book_id: 'book', content: 'A saved body of text worth reading twice over', tag: 'quote',
  page_number: 42, created_at: '2026-10-14T12:00:00Z', updated_at: null, version: 1, ...overrides,
});
const flush = async () => { await act(async () => { for (let n = 0; n < 8; n++) await Promise.resolve(); }); };

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-20T12:00:00Z'));
  jest.clearAllMocks();
  mockOffline = false; mockDeleteAuthorized = true; mockBookError = false;
  mockBookData = { id: 'book', title: 'Selected book' };
  mockCollection = []; mockCollectionPending = false; mockCollectionError = false;
  mockRecord = undefined; mockRecordPending = false; mockRecordError = false;
  mockOperations = [];
  mockExportAvailable = false; mockExportBusy = false; mockExportFeedback = null;
  mockExportReady = false;
  mockExportRun.mockResolvedValue(undefined);
  mockDelete.mockResolvedValue(undefined);
  mockParams = { userBookId: 'book' };
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

describe('NotePassageLink', () => {
  it('includes the year for a passage created in a prior year', () => {
    render(<NotePassageLink note={note({ created_at: '2025-10-14T12:00:00Z' })} onPress={jest.fn()} />);
    expect(screen.getByRole('link', { name: /Quote, page 42, 14 Oct 2025:/ })).toBeTruthy();
    expect(screen.getByText('Quote · p. 42 · 14 Oct 2025')).toBeTruthy();
  });
  it('exposes one link with the category, page, date and body lead as its name', () => {
    render(<NotePassageLink note={note()} onPress={jest.fn()} />);
    const link = screen.getByRole('link', { name: 'Quote, page 42, 14 Oct: A saved body of text worth reading twice over' });
    expect(link).toBeTruthy();
    expect(screen.getByText('Quote · p. 42 · 14 Oct')).toBeTruthy();
    expect(screen.getByText('“A saved body of text worth reading twice over”')).toBeTruthy();
    expect(screen.getByText('“A saved body of text worth reading twice over”').props.numberOfLines).toBe(4);
  });

  it('press and long-press call the same handler and the target keeps a 48dp minimum', () => {
    const onPress = jest.fn();
    const tree = render(<NotePassageLink note={note({ tag: null, page_number: null })} onPress={onPress} />);
    const link = tree.getByRole('link');
    expect(link.props.accessibilityLabel).toMatch(/^Note, 14 Oct: /);
    expect(link.props.onLongPress).toBe(link.props.onPress);
    fireEvent.press(link);
    expect(onPress).toHaveBeenCalledTimes(1);
    const flattened = require('react-native').StyleSheet.flatten(link.props.style);
    expect(flattened.minHeight).toBe(MIN_TARGET);
  });
});

describe('notes list states', () => {
  it('shows a list skeleton labelled Loading notes with a single primary', () => {
    mockCollection = undefined; mockCollectionPending = true;
    render(<NotesScreen />);
    expect(screen.getByLabelText('Loading notes')).toBeTruthy();
    expect(screen.getAllByTestId('book-loading-row', { includeHiddenElements: true })).toHaveLength(5);
    expectSinglePrimary(screen);
  });

  it('counts notes plainly, links every passage, and navigates on press', async () => {
    mockCollection = [note(), note({ id: 'note-2', tag: 'reflect', content: 'Second body', page_number: null })];
    render(<NotesScreen />);
    expect(await screen.findByText('2 notes')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Quote, page 42/ })).toBeTruthy();
    expect(screen.queryByText(/saved notes/i)).toBeNull();
    expectSinglePrimary(screen);
    expect(StyleSheet.flatten(screen.UNSAFE_getByType(FlatList).props.contentContainerStyle)).toMatchObject({
      width: '100%', maxWidth: COLUMN_MAX_WIDTH, alignSelf: 'center',
    });
    fireEvent.press(screen.getByRole('link', { name: /Second body/ }));
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
    expect(mockRouter.push.mock.calls[0][0].pathname).toBe('/(tabs)/library/note');
    await flush();
  });

  it('shows an empty state with no button and keeps the footer Add note as the one primary', async () => {
    mockCollection = [];
    render(<NotesScreen />);
    expect(await screen.findByText('No notes yet')).toBeTruthy();
    expect(screen.getByText('Add a note for this book.')).toBeTruthy();
    await flush();
    expect(screen.queryByRole('button', { name: 'Add your first note' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add note' })).toBeTruthy();
    expectSinglePrimary(screen);
  });

  it('shows a filter-empty state with a text button that clears the filter', async () => {
    mockCollection = [note({ id: 'thought', tag: 'reflect', content: 'Thought body' })];
    render(<NotesScreen />);
    expect(await screen.findByText('Thought body')).toBeTruthy();
    fireEvent.press(screen.getByRole('radio', { name: 'Action' }));
    expect(await screen.findByText('No Action notes')).toBeTruthy();
    await flush();
    expect(screen.queryByText('Thought body')).toBeNull();
    const clear = screen.getByRole('button', { name: 'Show all notes' });
    expect(clear).toBeTruthy();
    expectSinglePrimary(screen);
    fireEvent.press(clear);
    expect(await screen.findByText('Thought body')).toBeTruthy();
    await flush();
  });

  it('keeps data with a quiet refresh failure and a text Try again', async () => {
    mockCollection = [note()]; mockCollectionError = true;
    render(<NotesScreen />);
    expect(await screen.findByText('Quote · p. 42 · 14 Oct')).toBeTruthy();
    expect(screen.getByText("Couldn't refresh.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.queryByText(/Previously loaded/)).toBeNull();
    await flush();
  });

  it('reports a first-load failure and an offline failure distinctly', async () => {
    mockCollection = undefined; mockCollectionError = true;
    const first = render(<NotesScreen />);
    expect(await first.findByText("Couldn't load your notes.")).toBeTruthy();
    expect(first.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expectSinglePrimary(first);
    expect(first.queryByRole('button', { name: 'Add note' })).toBeNull();
    first.unmount();
    mockOffline = true;
    render(<NotesScreen />);
    expect(await screen.findByText("You're offline.")).toBeTruthy();
    expectSinglePrimary(screen);
    expect(screen.queryByRole('button', { name: 'Add note' })).toBeNull();
    await flush();
  });

  it('offers only Try again when the book is unavailable', () => {
    mockBookError = true; mockBookData = undefined;
    render(<NotesScreen />);
    expect(screen.getByText("This book couldn't be opened.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add note' })).toBeNull();
    expectSinglePrimary(screen);
  });

  it('disables Add note offline behind a connection caption', async () => {
    mockOffline = true; mockCollection = [note()];
    render(<NotesScreen />);
    expect(await screen.findByText('Offline · Showing saved content.')).toBeTruthy();
    expect(screen.getByText('Changes need a connection.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add note' }).props.accessibilityState.disabled).toBe(true);
    expectSinglePrimary(screen);
    await flush();
  });
});

describe('note reader layout', () => {
  beforeEach(() => {
    mockRecord = note();
    mockParams = { bookId: 'book', noteId: 'note', contextId: registerNoteContext({ actorId: 'actor', bookId: 'book', origin: 'collection', canBack: true }) };
  });

  it('has no Read title, shows caption book and meta, and keeps Delete as the trailing text button', async () => {
    render(<NoteReaderScreen />);
    expect(await screen.findByText(/A saved body of text worth reading/)).toBeTruthy();
    expect(screen.getByText('Selected book')).toBeTruthy();
    expect(screen.getByText('Quote · Page 42 · 14 Oct')).toBeTruthy();
    await flush();
    expect(screen.queryByText('Read note')).toBeNull();
    expect(screen.getByText(/A saved body of text worth reading/).props.selectable).toBe(true);
    const buttons = screen.UNSAFE_queryAllByType(BookButton);
    const deletes = buttons.filter(instance => instance.props.label === 'Delete note');
    expect(deletes).toHaveLength(1);
    expect(deletes[0].props.variant).toBe('text');
    expectSinglePrimary(screen);
    expect(StyleSheet.flatten(screen.UNSAFE_getByType(ScrollView).props.contentContainerStyle)).toMatchObject({
      width: '100%', maxWidth: COLUMN_MAX_WIDTH, alignSelf: 'center',
    });
  });

  it('omits absent meta parts instead of printing placeholders', async () => {
    mockRecord = note({ tag: null, page_number: null });
    render(<NoteReaderScreen />);
    expect(await screen.findByText('14 Oct')).toBeTruthy();
    await flush();
    expect(screen.queryByText(/No category/)).toBeNull();
    expect(screen.queryByText(/Page \d/)).toBeNull();
    expect(screen.queryByText(/· Page/)).toBeNull();
  });

  it('keeps the cached note and actions when the note refresh fails', async () => {
    mockRecordError = true;
    render(<NoteReaderScreen />);
    expect(screen.getByText(/A saved body of text worth reading/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy text' }).props.accessibilityState.disabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Edit note' }).props.accessibilityState.disabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Delete note' }).props.accessibilityState.disabled).toBe(false);
    const refreshFailure = screen.getByText("Couldn't refresh.");
    expect(refreshFailure.props.accessibilityLiveRegion).toBe('polite');
    expect(StyleSheet.flatten(refreshFailure.props.style).fontSize).toBe(LIBRARY_TEXT.body.fontSize);
    expect(screen.queryByText("This note is missing or couldn't be opened.")).toBeNull();
    expectSinglePrimary(screen);
    await flush();
  });

  it('keeps the cached note and actions when the book refresh fails', async () => {
    mockBookError = true; mockOffline = true;
    render(<NoteReaderScreen />);
    expect(screen.getByText('Selected book')).toBeTruthy();
    expect(screen.getByText(/A saved body of text worth reading/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy text' }).props.accessibilityState.disabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Edit note' }).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Delete note' }).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Offline · Showing saved content.')).toBeTruthy();
    expect(screen.getByText("Couldn't refresh.")).toBeTruthy();
    expect(screen.queryByText("This note is missing or couldn't be opened.")).toBeNull();
    expectSinglePrimary(screen);
    await flush();
  });

  it('shows unavailable when a failed note query loses its cached data', async () => {
    mockRecordError = true;
    render(<NoteReaderScreen />);
    expect(screen.getByText(/A saved body of text worth reading/)).toBeTruthy();
    mockRecord = undefined;
    screen.rerender(<NoteReaderScreen />);
    expect(screen.getByText("This note is missing or couldn't be opened.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.queryByText(/A saved body of text worth reading/)).toBeNull();
    expect(screen.queryByText("Couldn't refresh.")).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy text' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit note' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete note' })).toBeNull();
    expectSinglePrimary(screen);
    await flush();
  });

  it('disables Edit and Delete offline but leaves Copy enabled', async () => {
    mockOffline = true;
    render(<NoteReaderScreen />);
    expect(await screen.findByText(/A saved body of text worth reading/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit note' }).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Delete note' }).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Copy text' }).props.accessibilityState.disabled).toBe(false);
    expect(screen.getByText('Changes need a connection.')).toBeTruthy();
    expectSinglePrimary(screen);
    await flush();
  });

  it('announces Note deleted after a confirmed delete with the new copy', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    render(<NoteReaderScreen />);
    expect(await screen.findByText(/A saved body of text worth reading/)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Delete note' }));
    expect(screen.getByText('Delete this note?')).toBeTruthy();
    expect(screen.getByText("This note will be deleted. You can't undo this.")).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Keep note' }));
    await flush();
    expect(screen.queryByText('Delete this note?')).toBeNull();
    expect(mockDelete).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Delete note' }));
    fireEvent.press(screen.getAllByRole('button', { name: 'Delete note' }).slice(-1)[0]);
    await screen.findByText('Deleting…');
    await flush();
    expect(mockDelete).toHaveBeenCalledWith('actor', 'book', 'note');
    expect(mockRemoveFromCache).toHaveBeenCalledWith('note');
    expect(announce).toHaveBeenCalledWith('Note deleted.');
    expect(mockRouter.back.mock.calls.length + mockRouter.dismiss.mock.calls.length).toBeGreaterThan(0);
    announce.mockRestore();
  });

  it('blocks an open Delete confirmation and its retained action after going offline, then permits it online', async () => {
    render(<NoteReaderScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Delete note' }));
    const retainedAction = screen.UNSAFE_getByType(NoteDialog).props.spec.action;
    mockOffline = true;
    screen.rerender(<NoteReaderScreen />);
    const confirm = within(screen.UNSAFE_getByType(NoteDialog)).getByRole('button', { name: 'Delete note' });
    expect(confirm.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(confirm, { stopPropagation: jest.fn() });
    act(() => retainedAction());
    await flush();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Delete this note?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Keep note' }).props.accessibilityState.disabled).toBe(false);

    mockOffline = false;
    screen.rerender(<NoteReaderScreen />);
    const onlineConfirm = within(screen.UNSAFE_getByType(NoteDialog)).getByRole('button', { name: 'Delete note' });
    expect(onlineConfirm.props.accessibilityState.disabled).toBe(false);
    fireEvent.press(onlineConfirm);
    await flush();
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it.each([['saving', false], ['saving', true], ['unknown', false], ['unknown', true]] as const)('copies the confirmed body during a %s edit (offline: %s)', async (status, offline) => {
    mockOffline = offline;
    mockOperations = [{ status, checking: false, submission: {
      id: 'pending', actorId: 'actor', bookId: 'book', noteId: 'note', sessionId: 'session',
      mode: 'edit', origin: 'collection', content: 'Unconfirmed edited body', tag: null, page_number: null,
    } }];
    const set = jest.spyOn(Clipboard, 'setString').mockImplementation(() => {});
    jest.spyOn(Clipboard, 'getString').mockResolvedValue(mockRecord!.content);
    render(<NoteReaderScreen />);
    expect(screen.getByRole('button', { name: 'Open pending submission' })).toBeTruthy();
    const copy = screen.getByRole('button', { name: 'Copy text' });
    expect(copy.props.accessibilityState.disabled).toBe(false);
    fireEvent.press(copy);
    await flush();
    expect(set).toHaveBeenCalledWith(mockRecord!.content);
    expect(screen.getByText('Note text copied.')).toBeTruthy();
  });

  it('copies text with inline feedback and reports copy failure as an error', async () => {
    const set = jest.spyOn(Clipboard, 'setString').mockImplementation(() => {});
    const get = jest.spyOn(Clipboard, 'getString').mockResolvedValue('A saved body of text worth reading twice over');
    render(<NoteReaderScreen />);
    expect(await screen.findByText(/A saved body of text worth reading/)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Copy text' }));
    await screen.findByText('Note text copied.');
    expect(set).toHaveBeenCalledWith('A saved body of text worth reading twice over');
    get.mockRejectedValueOnce(new Error('Clipboard unavailable'));
    fireEvent.press(screen.getByRole('button', { name: 'Copy text' }));
    await screen.findByText('Copy failed. You can select the note text to copy it.');
    set.mockRestore(); get.mockRestore();
  });
});

describe('NoteDialog destructive spec', () => {
  it('paints Keep as secondary, the destructive confirm, and caps width at the dialog token', () => {
    const tree = render(<NoteDialog spec={{ title: 'Delete this note?', message: 'Gone.', keep: 'Keep note', confirm: 'Delete note', confirmVariant: 'destructive', action: jest.fn() }} onKeep={jest.fn()} />);
    const buttons = tree.UNSAFE_queryAllByType(BookButton);
    expect(buttons.map(instance => instance.props.label).sort()).toEqual(['Delete note', 'Keep note']);
    expect(buttons.find(instance => instance.props.label === 'Keep note')!.props.variant).toBe('secondary');
    expect(buttons.find(instance => instance.props.label === 'Delete note')!.props.variant).toBe('destructive');
    const styles = require('react-native').StyleSheet.flatten(
      tree.UNSAFE_root.findAll((node: { props: { accessibilityViewIsModal?: boolean } }) => node.props.accessibilityViewIsModal === true, { deep: false })[0].props.style,
    );
    expect(styles.maxWidth).toBe(DIALOG_MAX_WIDTH);
    expect(tree.getByRole('header').props.children).toBe('Delete this note?');
    expect(require('react-native').StyleSheet.flatten(tree.getByRole('header').props.style).fontSize).toBe(LIBRARY_TEXT.heading.fontSize);
  });

  it('defaults an unspecified confirm to primary', () => {
    const tree = render(<NoteDialog spec={{ title: 'Leave?', message: 'Unsaved.', keep: 'Stay here', confirm: 'Leave', action: jest.fn() }} onKeep={jest.fn()} />);
    expect(tree.UNSAFE_queryAllByType(BookButton).find(instance => instance.props.label === 'Leave')!.props.variant).toBe('primary');
  });
});

describe('notes export entry', () => {
  beforeEach(() => { mockExportAvailable = true; });

  it('keeps PDF ready after loading and prints from the final press before closing', async () => {
    mockExportRun.mockResolvedValueOnce(true);
    const ui = render(<BookFeedbackProvider><NotesScreen /></BookFeedbackProvider>);
    const entry = screen.getByRole('button', { name: 'Export notes for Selected book' });
    expect(StyleSheet.flatten(entry.props.style).minHeight).toBeGreaterThanOrEqual(MIN_TARGET);
    expect(screen.getByText('Export')).toBeOnTheScreen();
    fireEvent.press(entry);
    fireEvent.press(screen.getByRole('radio', { name: 'PDF' }));
    fireEvent.press(screen.getByRole('radio', { name: 'All books' }));
    fireEvent.press(screen.getByRole('button', { name: 'Export' }));
    await flush();
    expect(mockExportRun).toHaveBeenCalledWith({ format: 'pdf', scope: 'all' });
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    expect(mockExportPrint).not.toHaveBeenCalled();
    mockExportReady = true;
    ui.rerender(<BookFeedbackProvider><NotesScreen /></BookFeedbackProvider>);
    expect(screen.getByText('Your PDF is ready. Choose Print, then Save as PDF.')).toBeOnTheScreen();
    let promiseResolved = false;
    const pending = Promise.resolve().then(() => { promiseResolved = true; });
    fireEvent.press(screen.getByRole('button', { name: 'Print' }));
    expect(mockExportPrint).toHaveBeenCalledTimes(1);
    expect(promiseResolved).toBe(false);
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(mockExportDispose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Saved to your downloads.')).toBeNull();
    await pending;
  });

  it('closes after a one-step Markdown export', async () => {
    mockExportRun.mockResolvedValueOnce(false);
    render(<BookFeedbackProvider><NotesScreen /></BookFeedbackProvider>);
    fireEvent.press(screen.getByRole('button', { name: 'Export notes for Selected book' }));
    fireEvent.press(screen.getByRole('button', { name: 'Export' }));
    await flush();
    expect(mockExportRun).toHaveBeenCalledWith({ format: 'markdown', scope: 'book' });
    expect(screen.queryByRole('dialog', { name: 'Export notes' })).toBeNull();
    expect(mockExportPrint).not.toHaveBeenCalled();
  });

  it.each(['unavailable', 'no-data'])('hides the export entry when %s', condition => {
    if (condition === 'unavailable') mockExportAvailable = false;
    else { mockCollection = undefined; mockCollectionPending = true; }
    render(<NotesScreen />);
    expect(screen.queryByRole('button', { name: 'Export notes for Selected book' })).toBeNull();
  });

  it('disables export offline with a visible connection caption', () => {
    mockOffline = true;
    render(<NotesScreen />);
    const entry = screen.getByRole('button', { name: 'Export notes for Selected book' });
    expect(entry).toBeDisabled(); fireEvent.press(entry);
    expect(screen.queryByText('Includes private notes. Notes still saving are not included.')).toBeNull();
    expect(screen.getByText('Export needs a connection.').props.accessibilityLiveRegion).toBe('polite');
    expect(mockExportRun).not.toHaveBeenCalled();
  });

  it('announces busy and prevents opening another export', () => {
    mockExportBusy = true;
    render(<NotesScreen />);
    const entry = screen.getByRole('button', { name: 'Export notes for Selected book' });
    expect(entry).toBeDisabled(); expect(entry.props.accessibilityState.busy).toBe(true);
    expect(screen.getByText('Exporting…')).toBeOnTheScreen();
  });

  it.each([
    { kind: 'saved', message: 'Saved to your downloads.' },
    { kind: 'empty', message: 'No notes to export yet.' },
    { kind: 'error', message: "Couldn't export. Try again." },
  ] as const)('announces $kind feedback inline and retries an error', async feedback => {
    mockExportFeedback = feedback;
    render(<NotesScreen />);
    const caption = screen.getByText(feedback.message);
    expect(caption.props.accessibilityLiveRegion).toBe('polite');
    expect(caption.props['aria-live']).toBe('polite');
    expect(StyleSheet.flatten(caption.props.style)).toMatchObject(LIBRARY_TEXT.caption);
    if (feedback.kind === 'error') {
      fireEvent.press(screen.getByRole('button', { name: 'Try again' })); await flush();
      expect(mockExportRun).toHaveBeenCalledWith({ format: 'markdown', scope: 'book' });
    }
  });
});
