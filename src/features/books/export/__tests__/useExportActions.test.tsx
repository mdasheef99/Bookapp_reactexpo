import { act, renderHook } from '@testing-library/react-native';
import { useLibraryCsvExport, useNotesExport } from '../useExportActions';
import { loadAllNotesForExport, loadBookNotesForExport, loadLibraryForExport } from '../loaders';
import { preparePdf, printPreparedPdf, disposePreparedPdf, deliverTextFile } from '../deliver';
import type { ExportLibraryRow, ExportNotesBook } from '../types';

let mockOffline = false;
let mockAvailable = true;
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOffline: mockOffline }) }));
jest.mock('../loaders', () => ({ loadLibraryForExport: jest.fn(), loadBookNotesForExport: jest.fn(), loadAllNotesForExport: jest.fn() }));
jest.mock('../deliver', () => ({ deliverTextFile: jest.fn(), preparePdf: jest.fn(), printPreparedPdf: jest.fn(),
  disposePreparedPdf: jest.fn(), exportDeliveryAvailable: () => mockAvailable }));
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
  mockOffline = false; mockAvailable = true;
  (loadLibraryForExport as jest.Mock).mockResolvedValue(library);
  (loadBookNotesForExport as jest.Mock).mockResolvedValue(notes);
  (loadAllNotesForExport as jest.Mock).mockResolvedValue(notes);
  (deliverTextFile as jest.Mock).mockResolvedValue('saved');
  (preparePdf as jest.Mock).mockReturnValue({ print: jest.fn(), dispose: jest.fn() });
});
afterEach(() => jest.useRealTimers());

it('reads fresh library rows, sends a dated UTF-8 CSV and gives inline saved feedback', async () => {
  const { result } = renderHook(() => useLibraryCsvExport('actor'));
  expect(result.current.feedback).toBeNull();
  await act(async () => { await result.current.run(); });
  expect(loadLibraryForExport).toHaveBeenCalledWith('actor', expect.any(AbortSignal));
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
