import { fieldsChanged, ManualNote, noteFields, NoteSubmission, NoteWriteError, validateNote } from '../manualNoteContract';
import { matchesSubmission, NoteSaveAdapter, NoteSaveCoordinator } from '../noteSaveCoordinator';

const submission = (changes: Partial<NoteSubmission> = {}): NoteSubmission => ({ id: 'op1', actorId: 'actor', bookId: 'book', noteId: 'note1', sessionId: 'session1', mode: 'create', origin: 'book', content: 'A note', tag: null, page_number: null, ...changes });
const record = (sent = submission(), changes: Partial<ManualNote> = {}): ManualNote => ({ id: sent.noteId, user_id: sent.actorId, user_book_id: sent.bookId, content: sent.content, tag: sent.tag, page_number: sent.page_number, created_at: '2026-10-09', updated_at: null, ...changes });
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; }
const flush = async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); };

describe('manual note validation and baseline', () => {
  it('starts blank with no category or page; category selection cannot write', () => {
    expect(noteFields()).toEqual({ text: '', category: null, page: '' });
    expect(validateNote({ text: 'Body', category: null, page: '' })).toMatchObject({ valid: true, content: 'Body', pageNumber: null });
  });
  it.each(['0', '-1', '2.1', '24abc', '1e3', 'Infinity', '2147483648'])('rejects the entire supplied page %s', page => {
    expect(validateNote({ text: 'Body', category: 'question', page }).errors.page).toBeDefined();
  });
  it('accepts the integer boundary and retains over-limit text without truncation', () => {
    const text = Array(501).fill('word').join(' ');
    expect(validateNote({ text, category: 'question', page: '2147483647' })).toMatchObject({ valid: false, content: text, pageNumber: 2147483647 });
    expect(validateNote({ text, category: null, page: '' }).errors.text).toContain('Remove 1 word');
  });
  it('detects category/page-only edits and permits explicit clearing', () => {
    const original = record(submission({ tag: 'reflect', page_number: 8 }));
    expect(fieldsChanged(noteFields(original), original)).toBe(false);
    expect(fieldsChanged({ ...noteFields(original), page: '' }, original)).toBe(true);
    expect(fieldsChanged({ ...noteFields(original), category: null }, original)).toBe(true);
  });
});

describe('account-scoped save coordinator (simulated adapter, no persistence proof)', () => {
  let adapter: NoteSaveAdapter; let coordinator: NoteSaveCoordinator;
  beforeEach(() => { jest.useFakeTimers(); adapter = { write: jest.fn(), reconcile: jest.fn().mockResolvedValue(null) }; coordinator = new NoteSaveCoordinator(adapter); coordinator.setActor('actor'); });
  afterEach(() => { coordinator.setActor(null); jest.useRealTimers(); });
  it('freezes one payload and blocks duplicate taps while allowing another note', async () => {
    const pending = deferred<ManualNote>(); (adapter.write as jest.Mock).mockReturnValue(pending.promise);
    const draft = submission(); coordinator.start(draft); draft.content = 'Changed outside';
    coordinator.start(submission({ id: 'duplicate' }));
    coordinator.start(submission({ id: 'op2', sessionId: 'session2', noteId: 'note2' }));
    expect(adapter.write).toHaveBeenCalledTimes(2);
    expect(coordinator.get('op1')?.submission.content).toBe('A note');
    expect(Object.isFrozen(coordinator.get('op1')?.submission)).toBe(true);
  });
  it('becomes unknown, performs one bounded automatic read, and retains a discoverable submission', async () => {
    const write = deferred<ManualNote>(); const read = deferred<ManualNote | null>();
    (adapter.write as jest.Mock).mockReturnValue(write.promise); (adapter.reconcile as jest.Mock).mockReturnValue(read.promise);
    coordinator.start(submission()); jest.advanceTimersByTime(15000); await flush();
    expect(coordinator.get('op1')).toMatchObject({ status: 'unknown', checking: true });
    jest.advanceTimersByTime(10000); await flush();
    expect(coordinator.forBook('actor', 'book')[0]).toMatchObject({ status: 'unknown', checking: false });
    write.reject(new Error('Transport lost')); await flush();
    expect(adapter.reconcile).toHaveBeenCalledTimes(1);
    coordinator.forget('op1'); expect(coordinator.get('op1')).toBeDefined();
  });
  it('an absent row remains unknown; explicit recheck never redispatches', async () => {
    (adapter.write as jest.Mock).mockRejectedValue(new Error('Network failure'));
    coordinator.start(submission()); await flush(); await coordinator.check('op1');
    expect(coordinator.get('op1')?.status).toBe('unknown'); expect(adapter.write).toHaveBeenCalledTimes(1);
  });
  it.each(['create', 'edit'] as const)('confirms a positive simulated %s status read without another write', async mode => {
    const sent = submission({ mode, expectedVersion: mode === 'edit' ? 1 : undefined });
    (adapter.write as jest.Mock).mockRejectedValue(new Error('Transport uncertain'));
    (adapter.reconcile as jest.Mock).mockResolvedValue(record(sent, { version: 2, last_operation_id: sent.id }));
    coordinator.start(sent); await flush();
    expect(coordinator.get('op1')?.status).toBe('confirmed'); expect(adapter.write).toHaveBeenCalledTimes(1);
  });
  it('a rejected status read preserves unknown status and payload without replay', async () => {
    (adapter.write as jest.Mock).mockRejectedValue(new Error('Transport uncertain'));
    (adapter.reconcile as jest.Mock).mockRejectedValue(new Error('Status read failed'));
    coordinator.start(submission()); await flush();
    expect(coordinator.get('op1')).toMatchObject({ status: 'unknown', checking: false, submission: { content: 'A note' } });
    expect(adapter.write).toHaveBeenCalledTimes(1);
  });
  it('accepts a matching late confirmation after leave without opening a route', async () => {
    const write = deferred<ManualNote>(); (adapter.write as jest.Mock).mockReturnValue(write.promise);
    coordinator.start(submission()); jest.advanceTimersByTime(15000); await flush();
    write.resolve(record()); await flush();
    expect(coordinator.get('op1')).toMatchObject({ status: 'confirmed', record: record() });
  });
  it.each([{ user_id: 'other' }, { user_book_id: 'other' }, { content: 'wrong payload' }, { id: 'wrong' }])('does not accept a mismatched result %p', async changes => {
    (adapter.write as jest.Mock).mockResolvedValue(record(submission(), changes));
    coordinator.start(submission()); await flush(); expect(coordinator.get('op1')?.status).toBe('unknown');
  });
  it('clears account memory and ignores a former-account completion', async () => {
    const write = deferred<ManualNote>(); (adapter.write as jest.Mock).mockReturnValue(write.promise);
    coordinator.start(submission()); coordinator.setActor('other'); write.resolve(record()); await flush();
    expect(coordinator.forBook('actor', 'book')).toEqual([]); expect(coordinator.get('op1')).toBeUndefined();
    expect(() => coordinator.start(submission())).toThrow('Sign in again');
  });
  it('a new coordinator after restart has no recovered submission or replay', () => {
    const restarted = new NoteSaveCoordinator(adapter); restarted.setActor('actor');
    expect(restarted.forBook('actor', 'book')).toEqual([]); expect(adapter.write).not.toHaveBeenCalled();
  });
  it('keeps definite failure distinct from unknown, with the submitted payload intact', async () => {
    (adapter.write as jest.Mock).mockRejectedValue(new NoteWriteError('definite', 'Rejected'));
    coordinator.start(submission()); await flush();
    expect(coordinator.get('op1')).toMatchObject({ status: 'failed', message: 'Rejected', submission: { content: 'A note' } });
    expect(adapter.reconcile).not.toHaveBeenCalled();
  });
  it('preserves the draft on both conflict races and submits replacement against the compared version', async () => {
    const first = submission({ mode: 'edit', expectedVersion: 1 });
    (adapter.write as jest.Mock).mockRejectedValueOnce(new NoteWriteError('conflict', 'Changed', record(first, { content: 'Saved V2', version: 2 })))
      .mockRejectedValueOnce(new NoteWriteError('conflict', 'Changed again', record(first, { content: 'Saved V3', version: 3 })));
    coordinator.start(first); await flush();
    expect(coordinator.get('op1')).toMatchObject({ status: 'conflict', compared: { version: 2 }, submission: { content: 'A note' } });
    coordinator.start({ ...first, id: 'replace', expectedVersion: 2 }); await flush();
    expect(adapter.write).toHaveBeenLastCalledWith(expect.objectContaining({ expectedVersion: 2, content: 'A note' }));
    expect(coordinator.get('replace')).toMatchObject({ status: 'conflict', compared: { version: 3 }, submission: { content: 'A note' } });
  });
  it('restricts an unresolved edit to that note, not other notes', async () => {
    (adapter.write as jest.Mock).mockReturnValue(new Promise(() => {}));
    coordinator.start(submission({ mode: 'edit' }));
    coordinator.start(submission({ mode: 'edit', id: 'duplicate', sessionId: 'new-session' }));
    coordinator.start(submission({ mode: 'edit', id: 'other-note', noteId: 'note2', sessionId: 'session2' }));
    expect(adapter.write).toHaveBeenCalledTimes(2);
    expect(coordinator.pendingEdit('actor', 'book', 'note1')?.submission.id).toBe('op1');
  });
});
