/** Connected interaction scaffolding. All records/writes below are simulated. */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import NoteComposeScreen from '../../../../app/(tabs)/library/note-compose';
import NotesScreen from '../../../../app/(tabs)/library/notes';
import { manualNoteSaveAdapter, noteSaves } from '@/features/books/notes/manualNotesGateway';
import { ManualNote, NoteSubmission, NoteWriteError } from '@/features/books/notes/manualNoteContract';
import { registerNoteContext } from '@/features/books/notes/noteNavigation';

let mockParams: Record<string, string>;
let mockRecord: ManualNote | null;
let mockCollection: ManualNote[];
let mockBookError = false;
let mockRefetchError = false;
let mockId = 0;
let mockNavigationState: any;
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismiss: jest.fn(), canGoBack: jest.fn(() => true) };
const mockRefresh = jest.fn();
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockId}` }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, useRouter: () => mockRouter, useNavigation: () => ({ dispatch: jest.fn(), getState: () => {
  if (mockNavigationState) return mockNavigationState;
  const routes = [{ name: '[bookId]', params: { bookId: 'book' } }];
  if (mockParams.noteId) routes.push({ name: 'note', params: { bookId: 'book', noteId: mockParams.noteId } } as any);
  routes.push({ name: 'note-compose', params: { bookId: 'book' } }); return { index: routes.length - 1, routes };
} }) }));
jest.mock('@react-navigation/native', () => ({ usePreventRemove: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }) }));
// SDD-07 FU-1b: the notes routes resolve every colour from the book-section palette, which
// useLibraryAppearance derives from `phase` alone.
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight', colors: {} }) }));
jest.mock('@tanstack/react-query', () => ({ useQuery: (options: any) => ({ data: options.queryKey[0] === 'notes' ? mockCollection : mockRecord, isPending: false, isError: false, refetch: jest.fn(async () => ({ data: mockRecord, isError: mockRefetchError })) }) }));
jest.mock('@/features/books/notes/manualNotesGateway', () => {
  const { NoteSaveCoordinator } = require('@/features/books/notes/noteSaveCoordinator');
  const adapter = { write: jest.fn(), reconcile: jest.fn().mockResolvedValue(null) };
  return { noteSaves: new NoteSaveCoordinator(adapter), manualNoteSaveAdapter: adapter, manualNotesGateway: { record: jest.fn() } };
});
jest.mock('@/features/books/notes/useManualNotes', () => ({
  useNoteContext: () => ({ actorId: 'actor', book: { data: mockBookError ? undefined : { id: 'book', title: 'A long selected book title' }, isPending: false, isError: mockBookError, refetch: jest.fn() } }),
  useNoteRefresh: () => mockRefresh,
  useNoteOperations: () => {
    const { useSyncExternalStore } = require('react'); const { noteSaves: coordinator } = require('@/features/books/notes/manualNotesGateway');
    useSyncExternalStore(coordinator.subscribe, coordinator.snapshot, coordinator.snapshot);
    return coordinator.forBook('actor', 'book');
  },
}));
function saved(sent: NoteSubmission): ManualNote { return { id: sent.noteId, user_id: sent.actorId, user_book_id: sent.bookId, content: sent.content, tag: sent.tag, page_number: sent.page_number, created_at: '2026-10-09', updated_at: null, version: 1 }; }
const flush = async () => { await act(async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); }); };
beforeEach(() => {
  jest.clearAllMocks(); noteSaves.setActor(null); noteSaves.setActor('actor'); mockRecord = null; mockCollection = []; mockBookError = false; mockRefetchError = false;
  mockNavigationState = undefined;
  mockParams = { bookId: 'book', contextId: registerNoteContext({ actorId: 'actor', bookId: 'book', origin: 'book', canBack: true }) };
  (manualNoteSaveAdapter.write as jest.Mock).mockImplementation(async sent => saved(sent));
});
afterEach(() => noteSaves.setActor(null));

it('allows writing without classification, preserves fields on retained Back, and exposes No category plus five categories', () => {
  render(<NoteComposeScreen />);
  expect(screen.getAllByRole('radio')).toHaveLength(6);
  expect(screen.getByRole('radio', { name: 'Question' }).props.accessibilityState.checked).toBe(false);
  fireEvent.press(screen.getByRole('button', { name: 'Write note' }));
  expect(screen.getByLabelText('Note text').props.value).toBe('');
  expect(screen.getByLabelText('Page, optional').props.value).toBe('');
  fireEvent.changeText(screen.getByLabelText('Note text'), 'My draft');
  fireEvent.press(screen.getByRole('button', { name: 'Back to options' }));
  fireEvent.press(screen.getByRole('radio', { name: 'Question' }));
  fireEvent.press(screen.getByRole('button', { name: 'Write note' }));
  expect(screen.getByLabelText('Note text').props.value).toBe('My draft');
  expect(screen.getByRole('radio', { name: 'Question' }).props.accessibilityState.checked).toBe(true);
  expect(manualNoteSaveAdapter.write).not.toHaveBeenCalled();
});
it('validates page without coercion and saves null metadata into one simulated confirmed reader', async () => {
  render(<NoteComposeScreen />); fireEvent.press(screen.getByRole('button', { name: 'Write note' }));
  fireEvent.changeText(screen.getByLabelText('Note text'), 'My complete note'); fireEvent.changeText(screen.getByLabelText('Page, optional'), '24abc');
  fireEvent.press(screen.getByRole('button', { name: 'Save note' }));
  expect(screen.getByText('Enter a positive whole page number, or leave it blank.')).toBeTruthy();
  expect(manualNoteSaveAdapter.write).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Page, optional'), ''); fireEvent.press(screen.getByRole('button', { name: 'Save note' })); await flush();
  expect(manualNoteSaveAdapter.write).toHaveBeenCalledWith(expect.objectContaining({ content: 'My complete note', tag: null, page_number: null, origin: 'book' }));
  expect(mockRouter.replace).toHaveBeenCalledTimes(1); expect(mockRouter.replace.mock.calls[0][0].pathname).toBe('/(tabs)/library/note');
  expect(mockRouter.back).not.toHaveBeenCalled();
});
it('returns from the write step to the chooser without losing the draft text, category or page', () => {
  render(<NoteComposeScreen />); fireEvent.press(screen.getByRole('button', { name: 'Write note' }));
  fireEvent.changeText(screen.getByLabelText('Note text'), 'Retained while changing category');
  fireEvent.changeText(screen.getByLabelText('Page, optional'), '24');
  fireEvent.press(screen.getByRole('radio', { name: 'Question' }));
  fireEvent.press(screen.getByRole('button', { name: 'Back to options' }));
  expect(screen.getByRole('button', { name: 'Write note' })).toBeTruthy();
  expect(screen.queryByText('Change category', { exact: true })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Close category choices' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Write note' }));
  expect(screen.getByLabelText('Note text').props.value).toBe('Retained while changing category');
  expect(screen.getByLabelText('Page, optional').props.value).toBe('24');
  expect(screen.getByRole('radio', { name: 'Question' }).props.accessibilityState.checked).toBe(true);
  expect(mockRouter.back).not.toHaveBeenCalled();
});
it('keeps fields and focus context on Keep editing; confirmed discard leaves without writing', async () => {
  render(<NoteComposeScreen />); fireEvent.press(screen.getByRole('button', { name: 'Write note' })); fireEvent.changeText(screen.getByLabelText('Note text'), 'Unsaved');
  fireEvent.press(screen.getByRole('button', { name: 'Cancel note' })); expect(screen.getByText('Discard this note?')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Keep editing' })); expect(screen.getByLabelText('Note text').props.value).toBe('Unsaved'); expect(mockRouter.back).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Cancel note' })); fireEvent.press(screen.getByRole('button', { name: 'Discard note' })); await flush();
  expect(mockRouter.back).toHaveBeenCalledTimes(1); expect(manualNoteSaveAdapter.write).not.toHaveBeenCalled();
});
it('does not overwrite a dirty edit on refetch; both conflicts preserve the draft and refresh comparison', async () => {
  mockRecord = { ...saved({ actorId: 'actor', bookId: 'book', noteId: 'note', content: 'Original', tag: 'reflect', page_number: null } as NoteSubmission), version: 1 };
  mockParams = { bookId: 'book', noteId: 'note', contextId: registerNoteContext({ actorId: 'actor', bookId: 'book', origin: 'collection', canBack: true, readerReturn: true }) };
  const rendered = render(<NoteComposeScreen />); fireEvent.changeText(screen.getByLabelText('Note text'), 'My changes');
  mockRecord = { ...mockRecord, content: 'Saved V2', version: 2 }; rendered.rerender(<NoteComposeScreen />);
  expect(screen.getByLabelText('Note text').props.value).toBe('My changes');
  (manualNoteSaveAdapter.write as jest.Mock).mockRejectedValueOnce(new NoteWriteError('conflict', 'Changed', mockRecord)).mockRejectedValueOnce(new NoteWriteError('conflict', 'Changed again', { ...mockRecord, content: 'Saved V3', version: 3 }));
  fireEvent.press(screen.getByRole('button', { name: 'Save changes' })); await flush();
  expect(screen.getByText('Saved V2')).toBeTruthy(); fireEvent.press(screen.getByRole('button', { name: 'Replace saved version' }));
  fireEvent.press(screen.getAllByRole('button', { name: 'Replace saved version' }).slice(-1)[0]); await flush();
  expect(manualNoteSaveAdapter.write).toHaveBeenLastCalledWith(expect.objectContaining({ expectedVersion: 2, content: 'My changes', noteId: 'note' }));
  expect(screen.getByText('Saved V3')).toBeTruthy(); expect(screen.getByLabelText('Note text').props.value).toBe('My changes');
  expect(mockRouter.replace).not.toHaveBeenCalled(); expect(mockRouter.back).not.toHaveBeenCalled();
});
it('returns to the existing reader after a simulated successful edit without pushing another reader', async () => {
  mockRecord = saved({ actorId: 'actor', bookId: 'book', noteId: 'note', content: 'Original', tag: 'reflect', page_number: null } as NoteSubmission);
  mockParams = { bookId: 'book', noteId: 'note', contextId: registerNoteContext({ actorId: 'actor', bookId: 'book', origin: 'collection', canBack: true, readerReturn: true }) };
  render(<NoteComposeScreen />); fireEvent.changeText(screen.getByLabelText('Note text'), 'Edited');
  fireEvent.press(screen.getByRole('button', { name: 'Save changes' })); await flush();
  expect(mockRouter.back).toHaveBeenCalledTimes(1); expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
});
it('protects Use saved version with confirmation and performs no replacement write', async () => {
  mockRecord = { ...saved({ actorId: 'actor', bookId: 'book', noteId: 'note', content: 'Original', tag: 'reflect', page_number: null } as NoteSubmission), version: 1 };
  mockParams = { bookId: 'book', noteId: 'note', contextId: registerNoteContext({ actorId: 'actor', bookId: 'book', origin: 'collection', canBack: true, readerReturn: true }) };
  render(<NoteComposeScreen />); fireEvent.changeText(screen.getByLabelText('Note text'), 'My draft');
  mockRecord = { ...mockRecord, content: 'Current saved body', version: 2 };
  (manualNoteSaveAdapter.write as jest.Mock).mockRejectedValueOnce(new NoteWriteError('conflict', 'Changed', mockRecord));
  fireEvent.press(screen.getByRole('button', { name: 'Save changes' })); await flush();
  fireEvent.press(screen.getByRole('button', { name: 'Use saved version' }));
  expect(screen.getByText('Use saved version?')).toBeTruthy(); expect(screen.getByLabelText('Note text').props.value).toBe('My draft');
  expect(mockRouter.back).not.toHaveBeenCalled();
  fireEvent.press(screen.getAllByRole('button', { name: 'Use saved version' }).slice(-1)[0]); await flush();
  expect(mockRouter.back).toHaveBeenCalledTimes(1); expect(manualNoteSaveAdapter.write).toHaveBeenCalledTimes(1);
  expect(mockRefresh).toHaveBeenCalledWith(expect.objectContaining({ content: 'Current saved body', version: 2 }));
});
it('preserves the conflict draft when the protected saved-version read fails', async () => {
  mockRecord = { ...saved({ actorId: 'actor', bookId: 'book', noteId: 'note', content: 'Original', tag: 'reflect', page_number: null } as NoteSubmission), version: 1 };
  mockParams = { bookId: 'book', noteId: 'note' };
  render(<NoteComposeScreen />); fireEvent.changeText(screen.getByLabelText('Note text'), 'My retained draft');
  (manualNoteSaveAdapter.write as jest.Mock).mockRejectedValueOnce(new NoteWriteError('conflict', 'Changed', { ...mockRecord, version: 2 }));
  fireEvent.press(screen.getByRole('button', { name: 'Save changes' })); await flush();
  mockRefetchError = true; fireEvent.press(screen.getByRole('button', { name: 'Use saved version' }));
  fireEvent.press(screen.getAllByRole('button', { name: 'Use saved version' }).slice(-1)[0]); await flush();
  expect(screen.getByText("Couldn't load the saved version. Your changes are still here.")).toBeTruthy();
  expect(screen.getByLabelText('Note text').props.value).toBe('My retained draft');
  expect(mockRouter.back).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(manualNoteSaveAdapter.write).toHaveBeenCalledTimes(1);
});
it('cancels replacement and keeps editing a conflict without writing or losing its fields', async () => {
  mockRecord = { ...saved({ actorId: 'actor', bookId: 'book', noteId: 'note', content: 'Original', tag: 'reflect', page_number: 8 } as NoteSubmission), version: 1 };
  mockParams = { bookId: 'book', noteId: 'note' }; render(<NoteComposeScreen />); fireEvent.changeText(screen.getByLabelText('Note text'), 'My conflict draft');
  (manualNoteSaveAdapter.write as jest.Mock).mockRejectedValueOnce(new NoteWriteError('conflict', 'Changed', { ...mockRecord, content: 'Saved V2', version: 2 }));
  fireEvent.press(screen.getByRole('button', { name: 'Save changes' })); await flush(); fireEvent.press(screen.getByRole('button', { name: 'Replace saved version' }));
  fireEvent.press(screen.getAllByRole('button', { name: 'Keep editing' }).slice(-1)[0]); expect(manualNoteSaveAdapter.write).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Saved V2')).toBeTruthy(); fireEvent.press(screen.getByRole('button', { name: 'Keep editing' }));
  expect(screen.queryByText('Saved V2')).toBeNull(); expect(screen.getByLabelText('Note text').props.value).toBe('My conflict draft'); expect(screen.getByLabelText('Page, optional').props.value).toBe('8');
  expect(manualNoteSaveAdapter.write).toHaveBeenCalledTimes(1); expect(mockRouter.back).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('preserves Thought and its matching result while a Question increases the simulated total', async () => {
  mockParams = { userBookId: 'book' };
  mockCollection = [saved({ actorId: 'actor', bookId: 'book', noteId: 'thought', content: 'Thought body', tag: 'reflect', page_number: null } as NoteSubmission)];
  const rendered = render(<NotesScreen />); fireEvent.press(screen.getByRole('radio', { name: 'Thought' }));
  mockCollection = [...mockCollection, saved({ actorId: 'actor', bookId: 'book', noteId: 'question', content: 'Question body', tag: 'question', page_number: null } as NoteSubmission)];
  rendered.rerender(<NotesScreen />);
  expect(screen.getByText('2 notes')).toBeTruthy(); expect(screen.getByText('Thought body')).toBeTruthy(); expect(screen.queryByText('Question body')).toBeNull();
  expect(screen.getByRole('radio', { name: 'Thought' }).props.accessibilityState.checked).toBe(true);
  fireEvent.press(screen.getByRole('radio', { name: 'All' })); expect(screen.getByText('Question body')).toBeTruthy();
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 60)); });
});
it('keeps a pending submission readable and discoverable even when the book status read fails', async () => {
  (manualNoteSaveAdapter.write as jest.Mock).mockRejectedValue(new Error('Network lost'));
  const sent = { id: 'pending', actorId: 'actor', bookId: 'book', noteId: 'new-note', sessionId: 'session', mode: 'create', origin: 'book', content: 'Retained submission', tag: null, page_number: null } as NoteSubmission;
  noteSaves.start(sent); await flush(); mockBookError = true;
  mockParams = { userBookId: 'book' }; const collection = render(<NotesScreen />);
  expect(screen.getByRole('button', { name: 'Open pending submission' })).toBeTruthy(); collection.unmount();
  mockParams = { bookId: 'book', operationId: 'pending' }; render(<NoteComposeScreen />);
  expect(screen.getByLabelText('Submitted note text').props.children).toBe('Retained submission'); expect(screen.getByRole('button', { name: 'Check status' })).toBeTruthy();
  expect(manualNoteSaveAdapter.write).toHaveBeenCalledTimes(1);
});
it('honors informed Leave when confirmation reaches the same render, without reopening the reader', async () => {
  let confirm!: (note: ManualNote) => void;
  let submitted!: NoteSubmission;
  (manualNoteSaveAdapter.write as jest.Mock).mockImplementation(sent => {
    submitted = sent; return new Promise<ManualNote>(resolve => { confirm = resolve; });
  });
  render(<NoteComposeScreen />); fireEvent.press(screen.getByRole('button', { name: 'Write note' }));
  fireEvent.changeText(screen.getByLabelText('Note text'), 'Submission retained after leaving');
  fireEvent.press(screen.getByRole('button', { name: 'Save note' })); await flush();
  fireEvent.press(screen.getByRole('button', { name: 'Leave' }));
  await act(async () => {
    fireEvent.press(screen.getAllByRole('button', { name: 'Leave' }).slice(-1)[0]);
    confirm(saved(submitted));
    for (let index = 0; index < 8; index++) await Promise.resolve();
  });
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(noteSaves.get(submitted.id)?.status).toBe('confirmed');
  expect(screen.getByRole('button', { name: 'Save note' }).props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByRole('button', { name: 'Save note' }));
  expect(manualNoteSaveAdapter.write).toHaveBeenCalledTimes(1);
});

it('keeps a reopened preview-origin edit and its exact reader through conflict Keep editing and retry', async () => {
  mockRecord = { ...saved({ actorId: 'actor', bookId: 'book', noteId: 'note', content: 'Original', tag: 'reflect', page_number: 8 } as NoteSubmission), version: 1 };
  const originalSession = registerNoteContext({ actorId: 'actor', bookId: 'book', origin: 'book', canBack: true, readerKey: 'original-reader' });
  (manualNoteSaveAdapter.write as jest.Mock).mockRejectedValueOnce(new NoteWriteError('conflict', 'Changed', { ...mockRecord, content: 'Saved V2', version: 2 }));
  noteSaves.start({ id: 'reopened-edit', actorId: 'actor', bookId: 'book', noteId: 'note', sessionId: originalSession, mode: 'edit', origin: 'book', content: 'Retained draft', tag: 'reflect', page_number: 8, expectedVersion: 1 });
  await flush();
  mockParams = { bookId: 'book', noteId: 'note', operationId: 'reopened-edit', contextId: registerNoteContext({ actorId: 'actor', bookId: 'book', origin: 'collection', canBack: true }) };
  mockNavigationState = { index: 4, routes: [
    { name: '[bookId]', key: 'book', params: { bookId: 'book' } },
    { name: 'note', key: 'original-reader', params: { bookId: 'book', noteId: 'note' } },
    { name: 'notes', key: 'collection', params: { userBookId: 'book' } },
    { name: 'note', key: 'other-normal-reader', params: { bookId: 'book', noteId: 'note' } },
    { name: 'note-compose', key: 'editor', params: { bookId: 'book', noteId: 'note' } },
  ] };
  render(<NoteComposeScreen />); fireEvent.press(screen.getByRole('button', { name: 'Keep editing' }));
  expect(screen.getByLabelText('Note text').props.value).toBe('Retained draft');
  fireEvent.press(screen.getByRole('button', { name: 'Save changes' })); await flush();
  expect(manualNoteSaveAdapter.write).toHaveBeenLastCalledWith(expect.objectContaining({ noteId: 'note', content: 'Retained draft', origin: 'book' }));
  expect(mockRouter.dismiss).toHaveBeenCalledWith(3); expect(mockRouter.back).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
});
