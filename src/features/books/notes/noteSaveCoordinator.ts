import { ManualNote, NoteSubmission, NoteWriteError } from './manualNoteContract';

export type SaveStatus = 'saving' | 'unknown' | 'failed' | 'conflict' | 'confirmed';
export interface NoteOperation {
  readonly submission: Readonly<NoteSubmission>;
  status: SaveStatus;
  checking: boolean;
  message?: string;
  record?: ManualNote;
  compared?: ManualNote;
}
export interface NoteSaveAdapter {
  write(submission: Readonly<NoteSubmission>): Promise<ManualNote>;
  reconcile(submission: Readonly<NoteSubmission>, signal: AbortSignal): Promise<ManualNote | null>;
}

/** Account-scoped memory only. It deliberately has no storage/replay dependency. */
export class NoteSaveCoordinator {
  private operations = new Map<string, NoteOperation>();
  private listeners = new Set<() => void>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private reads = new Map<string, AbortController>();
  private automaticallyChecked = new Set<string>();
  private actorId: string | null = null;
  private revision = 0;
  constructor(private adapter: NoteSaveAdapter, private savingMs = 15000, private checkMs = 10000) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.revision;
  private notify() { this.revision++; this.listeners.forEach(listener => listener()); }
  setActor(actorId: string | null) {
    if (this.actorId === actorId) return;
    this.actorId = actorId;
    this.timers.forEach(clearTimeout); this.timers.clear();
    this.reads.forEach(read => read.abort()); this.reads.clear();
    this.operations.clear(); this.automaticallyChecked.clear(); this.notify();
  }
  get(id?: string) { return id ? this.operations.get(id) : undefined; }
  forBook(actorId: string, bookId: string) {
    return [...this.operations.values()].filter(op => op.submission.actorId === actorId && op.submission.bookId === bookId);
  }
  pendingEdit(actorId: string, bookId: string, noteId: string) {
    return this.forBook(actorId, bookId).find(op => op.submission.mode === 'edit' && op.submission.noteId === noteId && ['saving', 'unknown'].includes(op.status));
  }
  forget(id: string) {
    const op = this.get(id);
    if (op && !['saving', 'unknown'].includes(op.status)) { this.operations.delete(id); this.notify(); }
  }
  private change(id: string, changes: Partial<NoteOperation>) {
    const op = this.get(id);
    if (!op || op.submission.actorId !== this.actorId) return;
    this.operations.set(id, { ...op, ...changes }); this.notify();
  }
  private automaticCheck(id: string) {
    if (this.automaticallyChecked.has(id)) return;
    this.automaticallyChecked.add(id); void this.check(id);
  }
  start(submission: NoteSubmission) {
    if (submission.actorId !== this.actorId) throw new NoteWriteError('definite', 'Sign in again before saving.');
    const duplicate = this.forBook(submission.actorId, submission.bookId).find(op =>
      ['saving', 'unknown'].includes(op.status) && (op.submission.sessionId === submission.sessionId ||
        (submission.mode === 'edit' && op.submission.mode === 'edit' && op.submission.noteId === submission.noteId)));
    if (duplicate) return duplicate.submission.id;
    const frozen = Object.freeze({ ...submission });
    this.operations.set(frozen.id, { submission: frozen, status: 'saving', checking: false }); this.notify();
    this.timers.set(frozen.id, setTimeout(() => {
      this.timers.delete(frozen.id);
      this.change(frozen.id, { status: 'unknown', message: "We couldn't confirm whether your note was saved." });
      this.automaticCheck(frozen.id);
    }, this.savingMs));
    void this.adapter.write(frozen).then(record => {
      if (!matchesSubmission(record, frozen)) throw new NoteWriteError('unknown', "We couldn't confirm this saved result.");
      this.change(frozen.id, { status: 'confirmed', record, checking: false, message: undefined });
    }).catch((error: unknown) => {
      if (this.get(frozen.id)?.status === 'confirmed') return;
      if (error instanceof NoteWriteError && error.kind !== 'unknown') {
        this.change(frozen.id, { status: error.kind === 'conflict' ? 'conflict' : 'failed', message: error.message, compared: error.latest });
      } else {
        this.change(frozen.id, { status: 'unknown', message: "We couldn't confirm whether your note was saved." });
        this.automaticCheck(frozen.id);
      }
    }).finally(() => {
      const timer = this.timers.get(frozen.id); if (timer) clearTimeout(timer);
      this.timers.delete(frozen.id);
    });
    return frozen.id;
  }
  async check(id: string) {
    const op = this.get(id);
    if (!op || op.status === 'confirmed' || op.checking) return;
    const controller = new AbortController(); this.reads.set(id, controller);
    this.change(id, { checking: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        this.adapter.reconcile(op.submission, controller.signal),
        new Promise<null>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(null); }, this.checkMs); }),
      ]);
      if (result && matchesSubmission(result, op.submission)) this.change(id, { status: 'confirmed', record: result, message: undefined });
    } catch { /* A failed/absent status read cannot prove the write failed. */ }
    finally {
      if (timer) clearTimeout(timer); controller.abort();
      if (this.reads.get(id) === controller) this.reads.delete(id);
      this.change(id, { checking: false });
    }
  }
}
export function matchesSubmission(note: ManualNote, submission: Readonly<NoteSubmission>) {
  return note.id === submission.noteId && note.user_id === submission.actorId && note.user_book_id === submission.bookId &&
    note.content === submission.content && note.tag === submission.tag && note.page_number === submission.page_number;
}
