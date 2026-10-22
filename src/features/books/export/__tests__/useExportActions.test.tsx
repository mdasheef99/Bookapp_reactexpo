import React from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import { useLibraryCsvExport, useNotesExport } from '../useExportActions';
import { loadAllNotesForExport, loadBookNotesForExport, loadLibraryForExport } from '../loaders';
// Mock the explicit native module path; existing saved/ready cases model the web API.
import { preparePdf, printPreparedPdf, disposePreparedPdf, deliverTextFile, deliverPdfFile } from '../deliver';
import type { ExportLibraryRow, ExportNotesBook } from '../types';
import NotesScreen from '../../../../../app/(tabs)/library/notes';
import LibraryScreen from '../../../../../app/(tabs)/library/index';
import { BookFeedbackProvider } from '@/components/library/ui';

let mockOffline = false;
let mockAvailable = true;
let mockPrintStep = true;
let mockNativeDelivery = false;
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOffline: mockOffline }) }));
jest.mock('../loaders', () => ({ loadLibraryForExport: jest.fn(), loadBookNotesForExport: jest.fn(), loadAllNotesForExport: jest.fn() }));
jest.mock('../deliver', () => ({ deliverTextFile: jest.fn(), deliverPdfFile: jest.fn(), preparePdf: jest.fn(), printPreparedPdf: jest.fn(),
  disposePreparedPdf: jest.fn(), pdfNeedsPrintStep: () => mockPrintStep,
  exportDeliveryAvailable: () => mockNativeDelivery ? jest.requireActual('../deliver').exportDeliveryAvailable() : mockAvailable }));
// Native entry tests use the real availability function without loading native modules.
jest.mock('expo-file-system/legacy', () => ({ cacheDirectory: 'file:///cache/' }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({ userBookId: 'book-id' }), useRouter: () => ({ push: jest.fn() }), useNavigation: () => ({}) }));
jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  Gesture: { Pan: () => {
    const gesture: Record<string, jest.Mock> = {};
    for (const name of ['enabled', 'minDistance', 'maxPointers', 'runOnJS', 'onStart', 'onUpdate', 'onEnd', 'onFinalize']) {
      gesture[name] = jest.fn(() => gesture);
    }
    return gesture;
  } },
}));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight', colors: {} }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: () => ({ session: { user: { id: 'actor' } } }) }));
jest.mock('@/features/books/hooks/useLibraryBooks', () => ({ useLibraryBooks: () => ({ data: [], isLoading: false, isError: false, isRefetching: false }) }));
jest.mock('@/features/books/hooks/useShelfArrangement', () => ({ useShelfArrangement: () => ({ active: false, orderedBooks: [], cancel: jest.fn() }) }));
jest.mock('@tanstack/react-query', () => {
  const React = require('react');
  return {
    useQuery: () => ({ data: [], isPending: false, isError: false, isRefetching: false }),
    // SDD-09 H-12: Home renders the continue-reading card, which also uses
    // the client and mutations. The static empty state keeps these suites on
    // the library rows and export wiring.
    useQueryClient: () => ({ invalidateQueries: jest.fn() }),
    useMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
    QueryClient: jest.fn(),
    QueryClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});
jest.mock('@/features/books/notes/useManualNotes', () => ({
  useNoteContext: () => ({ actorId: 'actor', book: { data: { id: 'book-id', title: 'Walden' }, isPending: false, isError: false } }),
  useNoteOperations: () => [],
}));
jest.mock('@/features/books/notes/manualNotesGateway', () => ({ manualNotesGateway: { list: jest.fn() } }));
jest.mock('@/features/books/notes/noteNavigation', () => ({ composeHref: jest.fn(), openNoteComposer: jest.fn(),
  openNoteReader: jest.fn(), registerNoteContext: jest.fn(), returnToBook: jest.fn() }));
const library: ExportLibraryRow[] = [{
  reading_status: 'reading', ownership: 'owned', condition: null, rating: null,
  review: 'Private review', review_is_public: false, created_at: null, completed_at: null,
  book: { title: 'Walden', authors: ['Thoreau'], isbn_13: null, isbn_10: null, publisher: null, published_date: null, page_count: null },
}];
const notes: ExportNotesBook[] = [{ title: 'Walden', authors: ['Thoreau'], notes: [{
  content: 'Saved private note', tag: 'quote', page_number: 42, created_at: null, updated_at: null,
}] }];
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers(); jest.setSystemTime(new Date('2026-10-21T12:00:00Z'));
  mockOffline = false; mockAvailable = true; mockPrintStep = true; mockNativeDelivery = false;
  (loadLibraryForExport as jest.Mock).mockResolvedValue(library);
  (loadBookNotesForExport as jest.Mock).mockResolvedValue(notes);
  (loadAllNotesForExport as jest.Mock).mockResolvedValue(notes);
  (deliverTextFile as jest.Mock).mockResolvedValue('saved');
  (deliverPdfFile as jest.Mock).mockResolvedValue('shared');
  (preparePdf as jest.Mock).mockReturnValue({ print: jest.fn(), dispose: jest.fn() });
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
});
afterEach(() => jest.useRealTimers());

it('reads fresh library rows, sends a dated UTF-8 CSV and gives inline saved feedback', async () => {
  const { result } = renderHook(() => useLibraryCsvExport('actor'));
  expect(result.current.feedback).toBeNull();
  await act(async () => { await result.current.run(); });
  expect(loadLibraryForExport).toHaveBeenCalledWith('actor', expect.any(AbortSignal), { timeZone: expect.any(String) });
  expect(deliverTextFile).toHaveBeenCalledWith({ fileName: 'bookconnect-library-2026-10-21.csv',
    mimeType: 'text/csv;charset=utf-8', text: expect.stringContaining('Private review') });
  expect((deliverTextFile as jest.Mock).mock.calls[0][0].text.startsWith('\uFEFF')).toBe(true);
  expect(result.current.feedback).toEqual({ kind: 'saved', message: 'Saved to your downloads.' });
  expect(result.current.busy).toBe(false);
  await act(async () => { await result.current.run(); });
  expect(loadLibraryForExport).toHaveBeenCalledTimes(2);
});

it.each([{ rows: [] }, { rows: [{ ...library[0], book: null }] }])('makes no file for an empty exportable library (%j)', async ({ rows }) => {
  (loadLibraryForExport as jest.Mock).mockResolvedValue(rows);
  const { result } = renderHook(() => useLibraryCsvExport('actor'));
  await act(async () => { await result.current.run(); });
  expect(result.current.feedback).toEqual({ kind: 'empty', message: 'Your library is empty.' });
  expect(deliverTextFile).not.toHaveBeenCalled();
});

it.each(['book', 'all'] as const)('exports %s notes as Markdown with the correct filename and saved feedback', async scope => {
  const { result } = renderHook(() => useNotesExport('actor', 'book-id'));
  await act(async () => { await result.current.run({ format: 'markdown', scope }); });
  expect(scope === 'all' ? loadAllNotesForExport : loadBookNotesForExport).toHaveBeenCalledWith('actor',
    ...(scope === 'all' ? [] : ['book-id']), expect.any(AbortSignal));
  expect(scope === 'all' ? loadBookNotesForExport : loadAllNotesForExport).not.toHaveBeenCalled();
  expect(deliverTextFile).toHaveBeenCalledWith({ fileName: `bookconnect-notes-${scope === 'all' ? 'all' : 'walden'}-2026-10-21.md`,
    mimeType: 'text/markdown;charset=utf-8', text: expect.stringContaining('Saved private note') });
  expect(result.current.feedback).toEqual({ kind: 'saved', message: 'Saved to your downloads.' });
});

it('prepares PDF with busy only during loading, then prints synchronously without feedback', async () => {
  const pending = deferred<ExportNotesBook[]>();
  (loadAllNotesForExport as jest.Mock).mockReturnValueOnce(pending.promise);
  const { result } = renderHook(() => useNotesExport('actor', 'book-id'));
  let running!: Promise<boolean>;
  act(() => { running = result.current.run({ format: 'pdf', scope: 'all' }); });
  expect(result.current.busy).toBe(true);
  expect(result.current.ready).toBe(false);
  await act(async () => { pending.resolve(notes); expect(await running).toBe(true); });
  expect(preparePdf).toHaveBeenCalledWith({ fileName: 'bookconnect-notes-all-2026-10-21.pdf', html: expect.stringContaining('Saved private note') });
  expect(deliverTextFile).not.toHaveBeenCalled();
  expect(printPreparedPdf).not.toHaveBeenCalled();
  expect(result.current.ready).toBe(true);
  expect(result.current.feedback).toBeNull(); expect(result.current.busy).toBe(false);
  let promiseResolved = false;
  const nextMicrotask = Promise.resolve().then(() => { promiseResolved = true; });
  act(() => {
    result.current.print();
    expect(printPreparedPdf).toHaveBeenCalledWith((preparePdf as jest.Mock).mock.results[0].value);
    expect(promiseResolved).toBe(false);
  });
  expect(result.current.ready).toBe(false);
  expect(result.current.busy).toBe(false);
  expect(result.current.feedback).toBeNull();
  await nextMicrotask;
});

it.each(['book', 'all'] as const)('makes no file for %s with zero saved notes', async scope => {
  (loadBookNotesForExport as jest.Mock).mockResolvedValue([{ ...notes[0], notes: [] }]);
  (loadAllNotesForExport as jest.Mock).mockResolvedValue([]);
  const { result } = renderHook(() => useNotesExport('actor', 'book-id'));
  await act(async () => { await result.current.run({ format: 'pdf', scope }); });
  expect(result.current.feedback).toEqual({ kind: 'empty', message: 'No notes to export yet.' });
  expect(preparePdf).not.toHaveBeenCalled(); expect(printPreparedPdf).not.toHaveBeenCalled(); expect(deliverTextFile).not.toHaveBeenCalled();
});

it.each(['offline', 'unavailable', 'signed-out'])('does not start either kind of export when %s', async condition => {
  mockOffline = condition === 'offline'; mockAvailable = condition !== 'unavailable';
  const actorId = condition === 'signed-out' ? undefined : 'actor';
  const { result } = renderHook(() => ({ csv: useLibraryCsvExport(actorId), notes: useNotesExport(actorId, 'book') }));
  await act(async () => { await result.current.csv.run(); await result.current.notes.run(); });
  expect(loadLibraryForExport).not.toHaveBeenCalled(); expect(loadBookNotesForExport).not.toHaveBeenCalled();
  expect(result.current.csv.feedback).toBeNull(); expect(result.current.notes.feedback).toBeNull();
});

it('ignores same-tick duplicate runs and locks the other entry point while busy', async () => {
  const pending = deferred<ExportLibraryRow[]>();
  (loadLibraryForExport as jest.Mock).mockReturnValue(pending.promise);
  const { result } = renderHook(() => ({ csv: useLibraryCsvExport('actor'), notes: useNotesExport('actor', 'book') }));
  let running!: Promise<void>;
  act(() => {
    running = result.current.csv.run();
    void result.current.csv.run(); void result.current.notes.run();
  });
  expect(result.current.csv.busy).toBe(true); expect(result.current.notes.busy).toBe(true);
  expect(loadLibraryForExport).toHaveBeenCalledTimes(1); expect(loadBookNotesForExport).not.toHaveBeenCalled();
  await act(async () => { pending.resolve(library); await running; });
  expect(result.current.csv.busy).toBe(false); expect(result.current.notes.busy).toBe(false);
  await act(async () => { await result.current.notes.run(); });
  expect(loadBookNotesForExport).toHaveBeenCalledTimes(1);
});

it.each(['csv-read', 'notes-read', 'file', 'pdf'])('sanitizes %s failures and releases busy for a retry', async failure => {
  const error = new Error('private server detail');
  if (failure === 'csv-read') (loadLibraryForExport as jest.Mock).mockRejectedValueOnce(error);
  if (failure === 'notes-read') (loadBookNotesForExport as jest.Mock).mockRejectedValueOnce(error);
  if (failure === 'file') (deliverTextFile as jest.Mock).mockRejectedValueOnce(error);
  if (failure === 'pdf') (preparePdf as jest.Mock).mockImplementationOnce(() => { throw error; });
  const { result } = renderHook(() => ({ csv: useLibraryCsvExport('actor'), notes: useNotesExport('actor', 'book') }));
  const selected = () => failure === 'csv-read' || failure === 'file' ? result.current.csv : result.current.notes;
  const choice = { format: failure === 'pdf' ? 'pdf' : 'markdown', scope: 'book' } as const;
  await act(async () => { await selected().run(choice); });
  expect(selected().feedback).toEqual({ kind: 'error', message: "Couldn't export. Try again." });
  expect(selected().busy).toBe(false);
  await act(async () => { await selected().run(choice); });
  expect(selected().feedback?.kind).not.toBe('error');
});

it('clears old feedback while the next export is loading', async () => {
  const pending = deferred<ExportLibraryRow[]>();
  const { result } = renderHook(() => useLibraryCsvExport('actor'));
  await act(async () => { await result.current.run(); });
  (loadLibraryForExport as jest.Mock).mockReturnValueOnce(pending.promise);
  let running!: Promise<void>;
  act(() => { running = result.current.run(); });
  expect(result.current.feedback).toBeNull(); expect(result.current.busy).toBe(true);
  await act(async () => { pending.resolve(library); await running; });
});

it('cancels on account change, prevents late delivery, and clears the old account feedback', async () => {
  const pending = deferred<ExportLibraryRow[]>();
  (loadLibraryForExport as jest.Mock).mockReturnValueOnce(pending.promise);
  const { result, rerender } = renderHook(({ actor }: { actor: string }) => useLibraryCsvExport(actor), { initialProps: { actor: 'actor' } });
  let running!: Promise<void>;
  act(() => { running = result.current.run(); });
  const signal = (loadLibraryForExport as jest.Mock).mock.calls[0][1] as AbortSignal;
  rerender({ actor: 'other' });
  expect(signal.aborted).toBe(true);
  await act(async () => { pending.resolve(library); await running; });
  expect(deliverTextFile).not.toHaveBeenCalled(); expect(result.current.feedback).toBeNull();
  expect(result.current.busy).toBe(false);
});

it('cancels on unmount without delivering a late file', async () => {
  const pending = deferred<ExportNotesBook[]>();
  (loadBookNotesForExport as jest.Mock).mockReturnValueOnce(pending.promise);
  const { result, unmount } = renderHook(() => useNotesExport('actor', 'book'));
  let running!: Promise<boolean>;
  act(() => { running = result.current.run(); });
  const signal = (loadBookNotesForExport as jest.Mock).mock.calls[0][2] as AbortSignal;
  unmount(); expect(signal.aborted).toBe(true);
  await act(async () => { pending.resolve(notes); await running; });
  expect(deliverTextFile).not.toHaveBeenCalled();
});

it('treats an AbortError as cancellation with no message', async () => {
  (deliverTextFile as jest.Mock).mockRejectedValue(Object.assign(new Error('cancelled'), { name: 'AbortError' }));
  const { result } = renderHook(() => useLibraryCsvExport('actor'));
  await act(async () => { await result.current.run(); });
  expect(result.current.feedback).toBeNull(); expect(result.current.busy).toBe(false);
});

it.each(['cancel', 'close', 'unmount', 'account', 'book'] as const)('disposes a ready PDF on %s', async reason => {
  const { result, unmount, rerender } = renderHook(({ actor, book }: { actor: string; book: string }) => useNotesExport(actor, book),
    { initialProps: { actor: 'actor', book: 'book' } });
  await act(async () => { await result.current.run({ format: 'pdf', scope: 'book' }); });
  const prepared = (preparePdf as jest.Mock).mock.results[0].value;
  expect(result.current.ready).toBe(true);
  expect(result.current.busy).toBe(false);
  if (reason === 'unmount') unmount();
  else if (reason === 'account') rerender({ actor: 'other', book: 'book' });
  else if (reason === 'book') rerender({ actor: 'actor', book: 'other' });
  else act(() => { if (reason === 'cancel') result.current.cancel(); else result.current.dispose(); });
  expect(disposePreparedPdf).toHaveBeenCalledTimes(1);
  expect(disposePreparedPdf).toHaveBeenCalledWith(prepared);
  expect(printPreparedPdf).not.toHaveBeenCalled();
  if (reason !== 'unmount') {
    expect(result.current.ready).toBe(false);
    expect(result.current.feedback).toBeNull();
    act(() => { result.current.print(); });
    expect(printPreparedPdf).not.toHaveBeenCalled();
  }
});

it.each(['cancel', 'close'] as const)('aborts loading on %s without preparing a late PDF', async reason => {
  const pending = deferred<ExportNotesBook[]>();
  (loadBookNotesForExport as jest.Mock).mockReturnValueOnce(pending.promise);
  const { result } = renderHook(() => useNotesExport('actor', 'book'));
  let running!: Promise<boolean>;
  act(() => { running = result.current.run({ format: 'pdf', scope: 'book' }); });
  const signal = (loadBookNotesForExport as jest.Mock).mock.calls[0][2] as AbortSignal;
  act(() => { if (reason === 'cancel') result.current.cancel(); else result.current.dispose(); });
  expect(signal.aborted).toBe(true);
  expect(result.current.busy).toBe(false);
  await act(async () => { pending.resolve(notes); expect(await running).toBe(false); });
  expect(preparePdf).not.toHaveBeenCalled();
  expect(result.current.ready).toBe(false);
  expect(result.current.feedback).toBeNull();
});

it('cleans up and sanitizes a synchronous Print failure', async () => {
  (printPreparedPdf as jest.Mock).mockImplementation(() => { throw new Error('private browser details'); });
  const { result } = renderHook(() => useNotesExport('actor', 'book'));
  await act(async () => { await result.current.run({ format: 'pdf', scope: 'book' }); });
  act(() => { result.current.print(); });
  expect(disposePreparedPdf).toHaveBeenCalledTimes(1);
  expect(result.current.ready).toBe(false);
  expect(result.current.busy).toBe(false);
  expect(result.current.feedback).toEqual({ kind: 'error', message: "Couldn't export. Try again." });
});

it('disposes the prepared iframe handle when its request signal is aborted', async () => {
  const controller = new AbortController();
  const constructor = jest.spyOn(globalThis, 'AbortController').mockImplementationOnce(() => controller);
  try {
    const { result } = renderHook(() => useNotesExport('actor', 'book'));
    await act(async () => { await result.current.run({ format: 'pdf', scope: 'book' }); });
    expect(result.current.ready).toBe(true);
    act(() => { controller.abort(); });
    expect(disposePreparedPdf).toHaveBeenCalledTimes(1);
    expect(disposePreparedPdf).toHaveBeenCalledWith((preparePdf as jest.Mock).mock.results[0].value);
    expect(result.current.ready).toBe(false);
    expect(result.current.feedback).toBeNull();
    expect(printPreparedPdf).not.toHaveBeenCalled();
  } finally { constructor.mockRestore(); }
});

describe('native exports', () => {
  beforeEach(() => {
    mockNativeDelivery = true; mockPrintStep = false;
    (deliverTextFile as jest.Mock).mockResolvedValue('shared');
  });

  it.each(['csv', 'markdown'] as const)('gives no caption after a %s share, including share-sheet dismissal', async format => {
    const { result } = renderHook(() => ({ csv: useLibraryCsvExport('actor'), notes: useNotesExport('actor', 'book-id') }));
    await act(async () => {
      if (format === 'csv') await result.current.csv.run();
      else expect(await result.current.notes.run({ format, scope: 'book' })).toBe(false);
    });
    expect(deliverTextFile).toHaveBeenCalledTimes(1);
    expect(result.current.csv.feedback).toBeNull(); expect(result.current.notes.feedback).toBeNull();
    expect(result.current.notes.ready).toBe(false);
    expect(result.current.csv.busy).toBe(false); expect(result.current.notes.busy).toBe(false);
  });

  it.each(['book', 'all'] as const)('shares %s PDF in one step, stays busy through sharing and never becomes ready', async scope => {
    const loading = deferred<ExportNotesBook[]>(), sharing = deferred<'shared'>();
    ((scope === 'all' ? loadAllNotesForExport : loadBookNotesForExport) as jest.Mock).mockReturnValueOnce(loading.promise);
    (deliverPdfFile as jest.Mock).mockReturnValueOnce(sharing.promise);
    const readyStates: boolean[] = [];
    const { result } = renderHook(() => {
      const exports = useNotesExport('actor', 'book-id'); readyStates.push(exports.ready); return exports;
    });
    let running!: Promise<boolean>;
    act(() => { running = result.current.run({ format: 'pdf', scope }); });
    expect(result.current.busy).toBe(true);
    expect(deliverPdfFile).not.toHaveBeenCalled();
    await act(async () => { loading.resolve(notes); });
    expect(deliverPdfFile).toHaveBeenCalledWith({ fileName: `bookconnect-notes-${scope === 'all' ? 'all' : 'walden'}-2026-10-21.pdf`,
      html: expect.stringContaining('Saved private note') });
    expect(result.current.busy).toBe(true); expect(result.current.ready).toBe(false);
    expect(preparePdf).not.toHaveBeenCalled(); expect(printPreparedPdf).not.toHaveBeenCalled();
    await act(async () => { sharing.resolve('shared'); expect(await running).toBe(false); });
    expect(readyStates).not.toContain(true);
    expect(result.current.busy).toBe(false); expect(result.current.feedback).toBeNull();
    expect(disposePreparedPdf).not.toHaveBeenCalled();
  });

  it.each(['csv', 'markdown', 'pdf'] as const)('shows the unavailable-share-sheet feedback for %s and permits retry', async format => {
    const { ExportUnavailableError } = jest.requireActual('../deliver') as typeof import('../deliver');
    ((format === 'pdf' ? deliverPdfFile : deliverTextFile) as jest.Mock).mockRejectedValueOnce(new ExportUnavailableError());
    const { result } = renderHook(() => ({ csv: useLibraryCsvExport('actor'), notes: useNotesExport('actor', 'book-id') }));
    const run = () => format === 'csv' ? result.current.csv.run() : result.current.notes.run({ format, scope: 'book' });
    const selected = () => format === 'csv' ? result.current.csv : result.current.notes;
    await act(async () => { await run(); });
    expect(selected().feedback).toEqual({ kind: 'error', message: "Sharing isn't available on this device." });
    expect(selected().busy).toBe(false);
    expect(result.current.notes.ready).toBe(false);
    await act(async () => { await run(); });
    expect(selected().feedback).toBeNull();
  });

  it.each(['csv', 'markdown', 'pdf'] as const)('sanitizes a native %s delivery failure', async format => {
    ((format === 'pdf' ? deliverPdfFile : deliverTextFile) as jest.Mock).mockRejectedValueOnce(new Error('private native details'));
    const { result } = renderHook(() => ({ csv: useLibraryCsvExport('actor'), notes: useNotesExport('actor', 'book-id') }));
    await act(async () => {
      if (format === 'csv') await result.current.csv.run();
      else await result.current.notes.run({ format, scope: 'book' });
    });
    expect((format === 'csv' ? result.current.csv : result.current.notes).feedback).toEqual({ kind: 'error', message: "Couldn't export. Try again." });
    expect(result.current.notes.ready).toBe(false);
    expect(result.current.csv.busy).toBe(false); expect(result.current.notes.busy).toBe(false);
  });

  it('does not generate or share a late native PDF after loading is cancelled', async () => {
    const loading = deferred<ExportNotesBook[]>();
    (loadBookNotesForExport as jest.Mock).mockReturnValueOnce(loading.promise);
    const { result } = renderHook(() => useNotesExport('actor', 'book-id'));
    let running!: Promise<boolean>;
    act(() => { running = result.current.run({ format: 'pdf', scope: 'book' }); });
    act(() => { result.current.cancel(); });
    await act(async () => { loading.resolve(notes); expect(await running).toBe(false); });
    expect(deliverPdfFile).not.toHaveBeenCalled(); expect(preparePdf).not.toHaveBeenCalled();
    expect(result.current.feedback).toBeNull(); expect(result.current.ready).toBe(false);
  });

  it.each(['android', 'ios'] as const)('renders the native Library CSV entry on %s and shares without a caption', async platform => {
    const previousOS = Platform.OS; Platform.OS = platform;
    // SDD-09 H-12: Home now renders the continue-reading card, which notifies
    // through the library feedback provider (always present via LibraryLayout).
    const ui = render(<BookFeedbackProvider><LibraryScreen /></BookFeedbackProvider>);
    try {
      const entry = ui.getByRole('button', { name: 'Export library as CSV' });
      expect(entry).toBeEnabled();
      await act(async () => { fireEvent.press(entry); });
      expect(loadLibraryForExport).toHaveBeenCalledWith('actor', expect.any(AbortSignal), { timeZone: expect.any(String) });
      expect(deliverTextFile).toHaveBeenCalledTimes(1);
      expect(ui.queryByText('Saved to your downloads.')).toBeNull();
    } finally { ui.unmount(); Platform.OS = previousOS; }
  });

  it.each(['android', 'ios'] as const)('renders the Notes entry on %s and closes the PDF dialog only after sharing', async platform => {
    const previousOS = Platform.OS; Platform.OS = platform;
    const sharing = deferred<'shared'>();
    (deliverPdfFile as jest.Mock).mockReturnValueOnce(sharing.promise);
    const ui = render(<BookFeedbackProvider><NotesScreen /></BookFeedbackProvider>);
    try {
      fireEvent.press(ui.getByRole('button', { name: 'Export notes for Walden' }));
      fireEvent.press(ui.getByRole('radio', { name: 'PDF' }));
      await act(async () => { fireEvent.press(ui.getByRole('button', { name: 'Export' })); });
      expect(ui.getByRole('dialog', { name: 'Export notes' })).toBeOnTheScreen();
      expect(ui.getByRole('button', { name: 'Export' })).toBeDisabled();
      expect(deliverPdfFile).toHaveBeenCalledTimes(1);
      expect(ui.queryByRole('button', { name: 'Print' })).toBeNull();
      expect(ui.queryByText('Your PDF is ready. Choose Print, then Save as PDF.')).toBeNull();
      await act(async () => { sharing.resolve('shared'); });
      expect(ui.queryByRole('dialog', { name: 'Export notes' })).toBeNull();
      expect(ui.queryByText('Saved to your downloads.')).toBeNull();
      expect(preparePdf).not.toHaveBeenCalled(); expect(printPreparedPdf).not.toHaveBeenCalled();
      expect(disposePreparedPdf).not.toHaveBeenCalled();
    } finally { ui.unmount(); Platform.OS = previousOS; }
  });
});
