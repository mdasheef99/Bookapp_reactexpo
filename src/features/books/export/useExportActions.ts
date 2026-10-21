import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { buildFileName } from './fileName';
import { buildLibraryCsv } from './libraryCsv';
import { buildNotesMarkdown } from './notesMarkdown';
import { buildNotesPrintHtml } from './notesPrintHtml';
import { loadAllNotesForExport, loadBookNotesForExport, loadLibraryForExport } from './loaders';
import { disposePreparedPdf, preparePdf, printPreparedPdf, deliverTextFile, exportDeliveryAvailable } from './deliver';
import type { PreparedPdf } from './deliver';

export type ExportFeedback = null | { kind: 'saved' | 'empty' | 'error'; message: string };
export interface NotesExportChoice { format: 'markdown' | 'pdf'; scope: 'book' | 'all' }
const SAVED: ExportFeedback = { kind: 'saved', message: 'Saved to your downloads.' };

// Shared across mounted entry points; there can be only one export in flight.
let active: AbortController | null = null;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function snapshot() { return active !== null; }
function setActive(controller: AbortController | null) { active = controller; listeners.forEach(listener => listener()); }

function useExportAction(actorId: string | null | undefined, context: string) {
  const { isOffline } = useNetworkStatus();
  const busy = useSyncExternalStore(subscribe, snapshot, snapshot);
  const [feedback, setFeedback] = useState<ExportFeedback>(null);
  const request = useRef<AbortController | null>(null);
  const currentContext = useRef(context);
  currentContext.current = context;
  const abort = useCallback(() => {
    const controller = request.current;
    controller?.abort();
    if (controller && active === controller) setActive(null);
    request.current = null;
  }, []);
  const cancel = useCallback(() => { abort(); setFeedback(null); }, [abort]);
  const reportError = () => setFeedback({ kind: 'error', message: "Couldn't export. Try again." });
  useEffect(() => {
    setFeedback(null);
    return () => {
      const controller = request.current;
      controller?.abort();
      if (controller && active === controller) setActive(null);
    };
  }, [context]);

  const run = useCallback(async (action: (signal: AbortSignal) => Promise<ExportFeedback>) => {
    if (isOffline || !actorId || active || !exportDeliveryAvailable()) return;
    const controller = new AbortController();
    request.current = controller;
    setActive(controller);
    setFeedback(null);
    try {
      const result = await action(controller.signal);
      if (!controller.signal.aborted && currentContext.current === context) setFeedback(result);
    } catch (error) {
      if (!controller.signal.aborted && currentContext.current === context &&
        !(error instanceof Error && error.name === 'AbortError')) {
        setFeedback({ kind: 'error', message: "Couldn't export. Try again." });
      }
    } finally {
      if (active === controller) setActive(null);
      if (request.current === controller) request.current = null;
    }
  }, [actorId, context, isOffline]);
  return { run, busy, feedback, abort, cancel, reportError };
}

export function useLibraryCsvExport(actorId: string | null | undefined) {
  const action = useExportAction(actorId, JSON.stringify([actorId, 'library']));
  const run = () => action.run(async signal => {
    const rows = await loadLibraryForExport(actorId!, signal);
    if (signal.aborted) return null;
    const csv = buildLibraryCsv(rows);
    if (csv.rowCount === 0) return { kind: 'empty', message: 'Your library is empty.' };
    const result = await deliverTextFile({ fileName: buildFileName('library-csv', { kind: 'all' }, new Date()),
      mimeType: 'text/csv;charset=utf-8', text: csv.text });
    return result === 'saved' ? SAVED : null;
  });
  return { ...action, run };
}

export function useNotesExport(actorId: string | null | undefined, userBookId: string) {
  const action = useExportAction(actorId, JSON.stringify([actorId, userBookId]));
  const { abort } = action;
  const prepared = useRef<{ pdf: PreparedPdf; printed: boolean } | null>(null);
  const [ready, setReady] = useState(false);
  const disposePdf = useCallback(() => {
    const current = prepared.current;
    prepared.current = null;
    if (current) {
      disposePreparedPdf(current.pdf);
      setReady(false);
    }
  }, []);
  const dispose = useCallback(() => { abort(); disposePdf(); }, [abort, disposePdf]);
  useEffect(() => {
    setReady(false);
    return dispose;
  }, [actorId, userBookId, dispose]);
  const run = async (choice: NotesExportChoice = { format: 'markdown', scope: 'book' }) => {
    let pdfReady = false;
    await action.run(async signal => {
      disposePdf();
      const books = choice.scope === 'all'
        ? await loadAllNotesForExport(actorId!, signal)
        : await loadBookNotesForExport(actorId!, userBookId, signal);
      if (signal.aborted) return null;
      if (!books.some(book => book.notes.length > 0)) return { kind: 'empty', message: 'No notes to export yet.' };
      const scope = choice.scope === 'all' ? { kind: 'all' } as const : { kind: 'book', title: books[0]?.title ?? null } as const;
      if (choice.format === 'pdf') {
        const pdf = preparePdf({ fileName: buildFileName('notes-pdf', scope, new Date()), html: buildNotesPrintHtml(books) });
        prepared.current = { pdf, printed: false };
        signal.addEventListener('abort', disposePdf, { once: true });
        setReady(true);
        pdfReady = true;
        return null;
      }
      const result = await deliverTextFile({ fileName: buildFileName('notes-md', scope, new Date()),
        mimeType: 'text/markdown;charset=utf-8', text: buildNotesMarkdown(books) });
      return result === 'saved' ? SAVED : null;
    });
    return pdfReady && prepared.current !== null;
  };
  const print = () => {
    const current = prepared.current;
    // A prepared PDF means this hook's load already finished; another screen's export must not block it.
    if (!current || current.printed) return;
    current.printed = true;
    try {
      // No promise boundary: this is called directly by the Print press handler.
      printPreparedPdf(current.pdf);
      setReady(false);
    } catch (error) {
      disposePdf();
      if (!(error instanceof Error && error.name === 'AbortError')) action.reportError();
    }
  };
  const cancel = () => { action.cancel(); disposePdf(); };
  return { ...action, run, ready, print, cancel, dispose };
}
