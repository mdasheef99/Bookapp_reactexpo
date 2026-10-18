/** Mounted app components + real QueryClient; all transport/clipboard/navigation effects are simulated. */
import React from 'react';
import { ActivityIndicator, Alert, Clipboard, FlatList, KeyboardAvoidingView, Modal, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StackActions, StackRouter } from '@react-navigation/routers';
import NoteComposeScreen from '../../../../app/(tabs)/library/note-compose';
import NoteReaderScreen from '../../../../app/(tabs)/library/note';
import NotesScreen from '../../../../app/(tabs)/library/notes';
import BookDetailScreen from '../../../../app/(tabs)/library/[bookId]';
import { VaultPagesList } from '@/components/library/VaultPagesList';
import { createManualNoteSaveAdapter, createManualNoteDeleteAdapter, manualNoteDeleteAdapter, MANUAL_NOTE_WRITE_GATES, manualNotesGateway, manualNoteSaveAdapter, noteSaves } from '@/features/books/notes/manualNotesGateway';
import * as noteGatewayModule from '@/features/books/notes/manualNotesGateway';
import { ManualNote, NoteSubmission, NoteWriteError, noteKeys } from '@/features/books/notes/manualNoteContract';
import { registerNoteContext } from '@/features/books/notes/noteNavigation';
import { useAuthStore } from '@/features/auth/store/authStore';
import { userBookPagesService } from '@/features/books/services/userBookPagesService';
import { booksService } from '@/features/books/services/booksService';
import { bookReviewService } from '@/features/books/services/bookReviewService';
import { supabase } from '@/lib/supabase';

// RN exports are lazy getters. Load the family's primitives during suite initialization,
// so cold Babel/native-module compilation does not consume the first interaction's timeout.
void [ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Pressable, RefreshControl, ScrollView, TextInput, View];

let mockParams: Record<string, string>;
let mockId = 0;
let mockRemoval: { prevent: boolean; callback: (event: any) => void };
const mockDispatch = jest.fn();
const mockRoutes = () => [
  { key: 'book-route', name: '[bookId]', params: { bookId: 'book' } },
  { key: 'reader-route', name: 'note', params: { bookId: 'book', noteId: 'note' } },
  { key: 'editor-route', name: 'note-compose', params: { bookId: 'book' } },
];
const mockNavigation = { dispatch: mockDispatch, getState: () => ({ index: 2, routes: mockRoutes() }) };
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismiss: jest.fn(), canGoBack: () => true };
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, useRouter: () => mockRouter, useNavigation: () => mockNavigation }));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  usePreventRemove: (prevent: boolean, callback: (event: any) => void) => { mockRemoval = { prevent, callback }; },
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => `journey-${++mockId}` }));
jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: () => {
  const { useAuthStore: store } = require('@/features/auth/store/authStore');
  return { user: store((state: any) => state.session?.user), isLoading: false };
} }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }) }));
// SDD-07 FU-1b/FU-1c: notes and Book Details resolve the book-section palette from
// `phase`; an empty app-theme palette verifies they no longer read its colours.
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight', colors: {} }) }));
jest.mock('@/features/books/services/userBookPagesService', () => ({ userBookPagesService: { getPagesForBook: jest.fn(), deletePage: jest.fn() } }));
jest.mock('@/features/books/services/booksService', () => ({ booksService: { getBookDetails: jest.fn(), getPublicReviewsForBook: jest.fn() } }));
jest.mock('@/features/books/services/bookReviewService', () => ({ ...jest.requireActual('@/features/books/services/bookReviewService'), bookReviewService: { update: jest.fn() } }));
jest.mock('expo-image', () => ({ Image: require('react-native').View }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: require('react-native').View }));
jest.mock('expo-blur', () => ({ BlurView: require('react-native').View }));
jest.mock('@/components/ui/AtmosphericBackground', () => ({ AtmosphericBackground: require('react-native').View }));
jest.mock('@/components/library', () => {
  const { View } = require('react-native');
  return { StatusSelector: View, OwnershipSelector: View, ConditionPicker: View, RatingInput: View, DeleteBookModal: View };
});

const original: ManualNote = { id: 'note', user_id: 'actor', user_book_id: 'book', content: 'Original body', tag: 'reflect', page_number: 8, created_at: '2026-10-10T00:00:00Z', updated_at: null, version: 1 };
const page = { id: 'page', user_id: 'actor', user_book_id: 'book', page_number: 12, content_excerpt: 'Retained saved excerpt', full_text: 'Retained saved excerpt', word_count: 3, created_at: '2026-10-10T00:00:00Z', updated_at: '2026-10-10T00:00:00Z' };
let client: QueryClient;
let noteRecord: ManualNote | null;
const wrap = (element: React.ReactElement) => <QueryClientProvider client={client}>{element}</QueryClientProvider>;
async function settle() { await act(async () => { for (let n = 0; n < 8; n++) await Promise.resolve(); }); }
/** Route simulated deletion through the production adapter with mocked transport. */
function authorizeSimulatedReaderDeletion() {
  const adapter = createManualNoteDeleteAdapter({ ...MANUAL_NOTE_WRITE_GATES, ownedBookWrites: true });
  jest.spyOn(noteGatewayModule, 'isManualNoteDeleteAuthorized').mockReturnValue(true);
  jest.spyOn(manualNoteDeleteAdapter, 'remove').mockImplementation((...args) => adapter.remove(...args));
}
beforeEach(() => {
  jest.clearAllMocks(); client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  useAuthStore.setState({ session: { user: { id: 'actor' } } as any, status: 'authenticated' }); noteRecord = { ...original };
  mockParams = { bookId: 'book', noteId: 'note', contextId: registerNoteContext({ actorId: 'actor', bookId: 'book', origin: 'book', canBack: true, readerReturn: true }) };
  jest.spyOn(manualNotesGateway, 'book').mockResolvedValue({ id: 'book', title: 'Selected book' });
  jest.spyOn(manualNotesGateway, 'record').mockImplementation(async () => noteRecord);
  jest.spyOn(manualNotesGateway, 'list').mockImplementation(async () => noteRecord ? [noteRecord] : []);
  (userBookPagesService.getPagesForBook as jest.Mock).mockResolvedValue([]);
  (booksService.getPublicReviewsForBook as jest.Mock).mockResolvedValue([]);
});
afterEach(() => { cleanup(); client.clear(); useAuthStore.setState({ session: null, status: 'unauthenticated' }); jest.restoreAllMocks(); });

it.each(['record', 'book'] as const)('retains an initialized dirty editor after a %s refresh failure', async resource => {
  render(wrap(<NoteComposeScreen />)); await screen.findByLabelText('Note text');
  fireEvent.changeText(screen.getByLabelText('Note text'), 'Draft survives refresh');
  fireEvent.changeText(screen.getByLabelText('Page, optional'), '42');
  fireEvent.press(screen.getByRole('button', { name: 'Change category' })); fireEvent.press(screen.getByRole('radio', { name: 'Question' }));
  (manualNotesGateway[resource] as jest.Mock).mockRejectedValue(new Error('Offline'));
  await act(async () => { await client.refetchQueries({ queryKey: resource === 'book' ? noteKeys.book('actor', 'book') : noteKeys.record('actor', 'book', 'note') }); });
  expect(screen.getByLabelText('Note text').props.value).toBe('Draft survives refresh');
  expect(screen.getByLabelText('Page, optional').props.value).toBe('42'); expect(screen.getByText('Category: Question')).toBeTruthy();
  expect(screen.queryByText('Note unavailable')).toBeNull(); expect(mockRouter.replace).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Note text'), 'Still editable'); expect(screen.getByLabelText('Note text').props.value).toBe('Still editable');
  expect(screen.getByText(/refresh.*failed/i)).toBeTruthy();
});
it('retains all fields when Save is explicitly held through the mounted editor', async () => {
  delete mockParams.noteId; const write = jest.spyOn(manualNoteSaveAdapter, 'write');
  render(wrap(<NoteComposeScreen />)); await screen.findByRole('button', { name: 'Write note' });
  fireEvent.press(screen.getByRole('radio', { name: 'Question' })); fireEvent.press(screen.getByRole('button', { name: 'Skip category' }));
  fireEvent.press(screen.getByRole('button', { name: 'Write note' }));
  const tooLong = Array(501).fill('word').join(' '); fireEvent.changeText(screen.getByLabelText('Note text'), tooLong);
  fireEvent.press(screen.getByRole('button', { name: 'Save note' })); expect(screen.getByText('Remove 1 word to save. Your text has been kept.')).toBeTruthy();
  expect(screen.getByLabelText('Note text').props.value).toBe(tooLong); expect(write).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Note text'), 'Complete retained draft'); fireEvent.changeText(screen.getByLabelText('Page, optional'), '24');
  write.mockImplementation(createManualNoteSaveAdapter({ ownedBookWrites: false, stableCreateReconciliation: false, optionalFiveCategories: false, serverManagedEditVersion: false }).write);
  fireEvent.press(screen.getByRole('button', { name: 'Save note' })); await screen.findByText("Saving isn't available yet. Your text is still here.");
  expect(screen.getByLabelText('Note text').props.value).toBe('Complete retained draft'); expect(screen.getByLabelText('Page, optional').props.value).toBe('24');
  expect(write).toHaveBeenCalledWith(expect.objectContaining({ tag: null, page_number: 24 })); expect(supabase.from).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
});
it('invokes the system-removal guard; Keep editing retains an edit and confirmed discard dispatches once', async () => {
  render(wrap(<NoteComposeScreen />)); await screen.findByLabelText('Note text'); fireEvent.changeText(screen.getByLabelText('Note text'), 'Dirty edit');
  expect(mockRemoval.prevent).toBe(true); const action = { type: 'GO_BACK' };
  act(() => mockRemoval.callback({ data: { action } })); fireEvent.press(screen.getByRole('button', { name: 'Keep editing' }));
  expect(screen.getByLabelText('Note text').props.value).toBe('Dirty edit'); expect(mockDispatch).not.toHaveBeenCalled();
  act(() => mockRemoval.callback({ data: { action } })); fireEvent.press(screen.getByRole('button', { name: 'Discard changes' })); await settle();
  expect(mockDispatch).toHaveBeenCalledTimes(1); expect(mockDispatch).toHaveBeenCalledWith(action); expect(mockRemoval.prevent).toBe(false);
});
it('mounts the saved reader, omits absent metadata and copies only the confirmed body with failure feedback', async () => {
  noteRecord = { ...original, tag: null, page_number: null }; const set = jest.spyOn(Clipboard, 'setString').mockImplementation(() => {});
  const get = jest.spyOn(Clipboard, 'getString').mockResolvedValue(original.content);
  render(wrap(<NoteReaderScreen />)); await screen.findByText(original.content);
  expect(screen.queryByText('No category')).toBeNull(); expect(screen.queryByText(/Page \d/)).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Copy text' })); await screen.findByText('Note text copied.'); expect(set).toHaveBeenCalledWith(original.content);
  get.mockRejectedValueOnce(new Error('Clipboard unavailable')); fireEvent.press(screen.getByRole('button', { name: 'Copy text' }));
  await screen.findByText('Copy failed. You can select the note text to copy it.'); expect(screen.getByText(original.content).props.selectable).toBe(true);
});
it.each(['missing', 'failed'] as const)('renders the reader %s state without showing stale body', async state => {
  if (state === 'missing') noteRecord = null; else (manualNotesGateway.record as jest.Mock).mockRejectedValue(new Error('Unavailable'));
  render(wrap(<NoteReaderScreen />)); await screen.findByText("This note is missing or couldn't be opened.");
  expect(screen.queryByText(original.content)).toBeNull(); expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
});
it('keeps Delete disabled when capabilities are explicitly held, without dispatching', async () => {
  jest.spyOn(noteGatewayModule, 'isManualNoteDeleteAuthorized').mockReturnValue(false);
  const remove = jest.spyOn(manualNoteDeleteAdapter, 'remove');
  render(wrap(<NoteReaderScreen />)); await screen.findByText(original.content);
  const button = screen.getByRole('button', { name: 'Delete note' });
  expect(button).toBeDisabled();
  fireEvent.press(button);
  expect(screen.queryByText('Delete this note?')).toBeNull();
  expect(remove).not.toHaveBeenCalled(); expect(supabase.from).not.toHaveBeenCalled();
  expect(Object.values(MANUAL_NOTE_WRITE_GATES)).toEqual([true, true, true, true]);
});
it('refreshes the real collection cache after confirmed simulated reader deletion', async () => {
  authorizeSimulatedReaderDeletion();
  mockParams.userBookId = 'book'; jest.spyOn(manualNotesGateway, 'remove').mockImplementation(async () => { noteRecord = null; });
  const alert = jest.spyOn(Alert, 'alert'); render(wrap(<><NotesScreen /><NoteReaderScreen /></>)); await screen.findByText('1 saved note');
  fireEvent.press(screen.getByRole('button', { name: 'Delete note' })); expect(manualNotesGateway.remove).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Keep note' })); expect(manualNotesGateway.remove).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Delete note' })); fireEvent.press(screen.getAllByRole('button', { name: 'Delete note' }).slice(-1)[0]);
  await screen.findByText('0 saved notes'); expect(manualNotesGateway.remove).toHaveBeenCalledWith('actor', 'book', 'note');
  expect(client.getQueryData(noteKeys.collection('actor', 'book'))).toEqual([]); expect(alert).not.toHaveBeenCalled();
});
it('keeps pending submission memory on informed Leave and suppresses late reader navigation after unmount', async () => {
  delete mockParams.noteId; let confirm!: (value: ManualNote) => void; let sent!: NoteSubmission;
  jest.spyOn(manualNoteSaveAdapter, 'write').mockImplementation(submitted => { sent = submitted; return new Promise(resolve => { confirm = resolve; }); });
  const mounted = render(wrap(<NoteComposeScreen />)); await screen.findByRole('button', { name: 'Write note' }); fireEvent.press(screen.getByRole('button', { name: 'Write note' }));
  fireEvent.changeText(screen.getByLabelText('Note text'), 'Pending body'); fireEvent.press(screen.getByRole('button', { name: 'Save note' })); await screen.findByText('Saving…');
  fireEvent.press(screen.getByRole('button', { name: 'Leave' })); fireEvent.press(screen.getAllByRole('button', { name: 'Leave' }).slice(-1)[0]); await settle(); mounted.unmount();
  expect(noteSaves.get(sent.id)?.status).toBe('saving'); mockParams = { userBookId: 'book' }; render(wrap(<NotesScreen />)); await screen.findByRole('button', { name: 'Open pending submission' });
  await act(async () => confirm({ ...original, id: sent.noteId, content: sent.content, tag: sent.tag, page_number: sent.page_number }));
  await screen.findByRole('button', { name: 'Open saved submission' }); expect(mockRouter.replace).not.toHaveBeenCalled();
});
it('clears mounted account-scoped draft/pending memory and ignores a delayed status-read result after account change', async () => {
  let statusResult!: (value: ManualNote) => void;
  jest.spyOn(manualNoteSaveAdapter, 'write').mockRejectedValue(new Error('Uncertain'));
  jest.spyOn(manualNoteSaveAdapter, 'reconcile').mockImplementation(() => new Promise(resolve => { statusResult = resolve; }));
  delete mockParams.noteId; render(wrap(<NoteComposeScreen />)); await screen.findByRole('button', { name: 'Write note' }); fireEvent.press(screen.getByRole('button', { name: 'Write note' }));
  fireEvent.changeText(screen.getByLabelText('Note text'), 'Former account draft'); fireEvent.press(screen.getByRole('button', { name: 'Save note' })); await screen.findByLabelText('Submitted note text');
  const submitted = noteSaves.forBook('actor', 'book')[0].submission;
  (manualNotesGateway.book as jest.Mock).mockRejectedValue(new Error('Not this account'));
  await act(async () => useAuthStore.setState({ session: { user: { id: 'other' } } as any, status: 'authenticated' }));
  await screen.findByText('Note unavailable'); expect(screen.queryByText('Former account draft')).toBeNull(); expect(noteSaves.forBook('actor', 'book')).toEqual([]);
  await act(async () => statusResult({ ...original, id: submitted.noteId, content: submitted.content, tag: submitted.tag, page_number: submitted.page_number }));
  expect(noteSaves.get(submitted.id)).toBeUndefined(); expect(mockRouter.replace).not.toHaveBeenCalled();
});
it('invalidates and refetches the real collection cache while retaining Thought when a simulated new Question is confirmed', async () => {
  delete mockParams.noteId; mockParams.userBookId = 'book';
  mockParams.contextId = registerNoteContext({ actorId: 'actor', bookId: 'book', origin: 'collection', canBack: true });
  const list = manualNotesGateway.list as jest.Mock; list.mockResolvedValue([original]);
  jest.spyOn(manualNoteSaveAdapter, 'write').mockImplementation(async sent => {
    const result = { ...original, id: sent.noteId, content: sent.content, tag: sent.tag, page_number: sent.page_number };
    list.mockResolvedValue([result, original]); return result;
  });
  render(wrap(<><View testID="collection"><NotesScreen /></View><View testID="composer"><NoteComposeScreen /></View></>));
  await screen.findByText('1 saved note'); const collection = within(screen.getByTestId('collection')); const editor = within(screen.getByTestId('composer'));
  fireEvent.press(collection.getByRole('radio', { name: 'Thought' })); fireEvent.press(editor.getByRole('radio', { name: 'Question' }));
  fireEvent.press(editor.getByRole('button', { name: 'Write note' })); fireEvent.changeText(editor.getByLabelText('Note text'), 'New Question body'); fireEvent.press(editor.getByRole('button', { name: 'Save note' }));
  await collection.findByText('2 saved notes'); expect(collection.getByRole('radio', { name: 'Thought' }).props.accessibilityState.checked).toBe(true);
  expect(collection.queryByText('New Question body')).toBeNull(); expect(collection.getByText(original.content)).toBeTruthy(); expect(list.mock.calls.length).toBeGreaterThan(1);
  fireEvent.press(collection.getByRole('radio', { name: 'All' })); expect(collection.getByText('New Question body')).toBeTruthy();
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 60)); });
});
it('reopens a preview-origin uncertain edit from Notes, confirms the same record, and returns to the retained Book Details', async () => {
  const reducer = StackRouter({ initialRouteName: '[bookId]' }); const options = { routeNames: ['[bookId]', 'notes', 'note', 'note-compose'], routeParamList: {}, routeGetIdList: {} };
  let state: any = reducer.getInitialState(options); state.routes[0].params = { bookId: 'book' }; const originalBookKey = state.routes[0].key;
  const dispatch = (action: any) => { state = reducer.getStateForAction(state, action, options) ?? state; };
  jest.spyOn(mockNavigation, 'getState').mockImplementation(() => state);
  jest.spyOn(mockRouter, 'back').mockImplementation(() => dispatch({ type: 'GO_BACK' })); jest.spyOn(mockRouter, 'dismiss').mockImplementation(count => dispatch(StackActions.pop(count)));
  jest.spyOn(mockRouter, 'push').mockImplementation((href: any) => dispatch(StackActions.push(href.pathname.split('/').at(-1), href.params)));
  jest.spyOn(mockRouter, 'replace').mockImplementation((href: any) => dispatch(StackActions.replace(href.pathname.split('/').at(-1), href.params)));
  const readerContext = registerNoteContext({ actorId: 'actor', bookId: 'book', origin: 'book', canBack: true });
  dispatch(StackActions.push('note', { bookId: 'book', noteId: 'note', contextId: readerContext })); mockParams = state.routes.at(-1).params;
  let mounted = render(wrap(<NoteReaderScreen />)); await screen.findByRole('button', { name: 'Edit note' }); fireEvent.press(screen.getByRole('button', { name: 'Edit note' })); mounted.unmount();
  mockParams = state.routes.at(-1).params; let confirmStatus!: (record: ManualNote) => void;
  jest.spyOn(manualNoteSaveAdapter, 'write').mockRejectedValue(new Error('Transport uncertain'));
  jest.spyOn(manualNoteSaveAdapter, 'reconcile').mockImplementation(() => new Promise(resolve => { confirmStatus = resolve; }));
  mounted = render(wrap(<NoteComposeScreen />)); await screen.findByLabelText('Note text'); fireEvent.changeText(screen.getByLabelText('Note text'), 'Retained changed body');
  fireEvent.press(screen.getByRole('button', { name: 'Save changes' })); await screen.findByRole('button', { name: 'Check status' }); const sent = noteSaves.forBook('actor', 'book')[0].submission;
  fireEvent.press(screen.getByRole('button', { name: 'Leave' })); fireEvent.press(screen.getAllByRole('button', { name: 'Leave' }).slice(-1)[0]); await settle(); mounted.unmount();
  expect(state.routes.at(-1).name).toBe('note'); mockParams = state.routes.at(-1).params;
  mounted = render(wrap(<NoteReaderScreen />)); await screen.findByRole('button', { name: 'Book details' }); fireEvent.press(screen.getByRole('button', { name: 'Book details' })); mounted.unmount();
  expect(state.routes).toHaveLength(1); dispatch(StackActions.push('notes', { userBookId: 'book' })); mockParams = state.routes.at(-1).params;
  mounted = render(wrap(<NotesScreen />)); await screen.findByRole('button', { name: 'Open pending submission' }); fireEvent.press(screen.getByRole('button', { name: 'Open pending submission' })); mounted.unmount();
  mockParams = state.routes.at(-1).params; mounted = render(wrap(<NoteComposeScreen />)); await screen.findByLabelText('Submitted note text');
  expect(screen.getByLabelText('Submitted note text').props.children).toBe('Retained changed body');
  noteRecord = { ...original, content: sent.content, version: 2, last_operation_id: sent.id };
  await act(async () => confirmStatus(noteRecord!)); await waitFor(() => expect(state.routes.at(-1).name).toBe('note')); mounted.unmount();
  expect(state.routes.filter((route: any) => route.name === 'note-compose')).toHaveLength(0); expect(state.routes.at(-1).params.noteId).toBe('note');
  mockParams = state.routes.at(-1).params; render(wrap(<NoteReaderScreen />)); await screen.findByText('Retained changed body');
  fireEvent.press(screen.getByRole('button', { name: 'Book details' })); expect(state.routes).toHaveLength(1); expect(state.routes[0].key).toBe(originalBookKey);
  expect(manualNoteSaveAdapter.write).toHaveBeenCalledTimes(1);
});
it('retains the exact original reader after a reopened edit retries, becomes uncertain, leaves and reopens again', async () => {
  const reducer = StackRouter({ initialRouteName: '[bookId]' });
  const options = { routeNames: ['[bookId]', 'notes', 'note', 'note-compose'], routeParamList: {}, routeGetIdList: {} };
  let state: any = reducer.getInitialState(options); state.routes[0].params = { bookId: 'book' };
  const dispatch = (action: any) => { state = reducer.getStateForAction(state, action, options) ?? state; };
  jest.spyOn(mockNavigation, 'getState').mockImplementation(() => state);
  jest.spyOn(mockRouter, 'back').mockImplementation(() => dispatch({ type: 'GO_BACK' }));
  jest.spyOn(mockRouter, 'dismiss').mockImplementation(count => dispatch(StackActions.pop(count)));
  jest.spyOn(mockRouter, 'push').mockImplementation((href: any) => dispatch(StackActions.push(href.pathname.split('/').at(-1), href.params)));
  jest.spyOn(mockRouter, 'replace').mockImplementation((href: any) => dispatch(StackActions.replace(href.pathname.split('/').at(-1), href.params)));
  const readerContext = registerNoteContext({ actorId: 'actor', bookId: 'book', origin: 'book', canBack: true });
  dispatch(StackActions.push('note', { bookId: 'book', noteId: 'note', contextId: readerContext }));
  const originalReaderKey = state.routes.at(-1).key;
  mockParams = state.routes.at(-1).params;
  let mounted = render(wrap(<NoteReaderScreen />)); await screen.findByRole('button', { name: 'Edit note' });
  fireEvent.press(screen.getByRole('button', { name: 'Edit note' })); mounted.unmount();
  let rejectFirst!: (error: Error) => void;
  const write = jest.spyOn(manualNoteSaveAdapter, 'write').mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject; }))
    .mockRejectedValueOnce(new Error('Retry outcome uncertain'));
  jest.spyOn(manualNoteSaveAdapter, 'reconcile').mockResolvedValue(null);
  mockParams = state.routes.at(-1).params; mounted = render(wrap(<NoteComposeScreen />));
  await screen.findByLabelText('Note text'); fireEvent.changeText(screen.getByLabelText('Note text'), 'Retained retry draft');
  fireEvent.changeText(screen.getByLabelText('Page, optional'), '42');
  fireEvent.press(screen.getByRole('button', { name: 'Change category' })); fireEvent.press(screen.getByRole('radio', { name: 'Question' }));
  fireEvent.press(screen.getByRole('button', { name: 'Save changes' })); await screen.findByText('Saving…');
  fireEvent.press(screen.getByRole('button', { name: 'Leave' }));
  fireEvent.press(screen.getAllByRole('button', { name: 'Leave' }).slice(-1)[0]); await settle(); mounted.unmount();
  expect(state.routes.at(-1).key).toBe(originalReaderKey);
  await act(async () => rejectFirst(new NoteWriteError('conflict', 'Saved note changed', { ...original, content: 'Saved V2', version: 2 })));
  expect(noteSaves.forBook('actor', 'book')[0].status).toBe('conflict');

  // Normal browsing may retain another reader for the same note; it is not the edit's destination.
  const browseToPending = () => {
    dispatch(StackActions.push('notes', { userBookId: 'book' }));
    dispatch(StackActions.push('note', { bookId: 'book', noteId: 'note', contextId: readerContext }));
    const otherReaderKey = state.routes.at(-1).key;
    dispatch(StackActions.push('notes', { userBookId: 'book' }));
    return otherReaderKey;
  };
  browseToPending(); mockParams = state.routes.at(-1).params;
  mounted = render(wrap(<NotesScreen />)); await screen.findByRole('button', { name: 'Open pending submission' });
  fireEvent.press(screen.getByRole('button', { name: 'Open pending submission' })); mounted.unmount();
  mockParams = state.routes.at(-1).params; mounted = render(wrap(<NoteComposeScreen />));
  await screen.findByRole('button', { name: 'Keep editing' }); fireEvent.press(screen.getByRole('button', { name: 'Keep editing' }));
  expect(screen.getByLabelText('Note text').props.value).toBe('Retained retry draft');
  fireEvent.press(screen.getByRole('button', { name: 'Save changes' })); await screen.findByRole('button', { name: 'Check status' });
  expect(write).toHaveBeenCalledTimes(2);
  expect(write).toHaveBeenLastCalledWith(expect.objectContaining({ noteId: 'note', origin: 'book', content: 'Retained retry draft', tag: 'question', page_number: 42 }));
  fireEvent.press(screen.getByRole('button', { name: 'Leave' }));
  fireEvent.press(screen.getAllByRole('button', { name: 'Leave' }).slice(-1)[0]); await settle(); mounted.unmount();
  expect(state.routes.at(-1).key).toBe(originalReaderKey);

  const competingReaderKey = browseToPending(); mockParams = state.routes.at(-1).params;
  mounted = render(wrap(<NotesScreen />)); await screen.findByRole('button', { name: 'Open pending submission' });
  fireEvent.press(screen.getByRole('button', { name: 'Open pending submission' })); mounted.unmount();
  mockParams = state.routes.at(-1).params; mounted = render(wrap(<NoteComposeScreen />));
  await screen.findByLabelText('Submitted note text');
  expect(screen.getByLabelText('Submitted note text').props.children).toBe('Retained retry draft');
  expect(screen.getByText('Category: Question')).toBeTruthy(); expect(screen.getByText('42')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Leave' }));
  fireEvent.press(screen.getAllByRole('button', { name: 'Leave' }).slice(-1)[0]); await settle(); mounted.unmount();
  expect(state.routes.at(-1).key).toBe(originalReaderKey);
  expect(state.routes.some((route: any) => route.key === competingReaderKey)).toBe(false);
  expect(state.routes.filter((route: any) => route.name === 'note-compose')).toHaveLength(0);
  expect(state.routes.filter((route: any) => route.name === 'note')).toHaveLength(1);
  expect(noteSaves.forBook('actor', 'book')[0].status).toBe('unknown'); expect(write).toHaveBeenCalledTimes(2);
}, 15000);
it('distinguishes failed Saved Pages loading from a successful empty read and supports retry', async () => {
  (userBookPagesService.getPagesForBook as jest.Mock).mockRejectedValueOnce(new Error('Offline'));
  render(wrap(<VaultPagesList userBookId="book" />)); await screen.findByText("Couldn't load saved pages.");
  expect(screen.queryByText(/No saved pages/)).toBeNull(); fireEvent.press(screen.getByRole('button', { name: 'Retry saved pages' }));
  await screen.findByText('No saved pages yet.'); expect(screen.queryByText(/NoteEditor|Save to Vault/)).toBeNull();
});
it('retains Saved Pages excerpts during refresh failure and preserves confirmed deletion', async () => {
  (userBookPagesService.getPagesForBook as jest.Mock).mockResolvedValue([page]); const alert = jest.spyOn(Alert, 'alert');
  render(wrap(<VaultPagesList userBookId="book" />)); await screen.findByText(page.content_excerpt);
  (userBookPagesService.getPagesForBook as jest.Mock).mockRejectedValueOnce(new Error('Offline'));
  await act(async () => { await client.refetchQueries({ queryKey: ['vault-pages', 'book'] }); });
  await screen.findByText("Couldn't refresh saved pages. Previously loaded pages are still shown."); expect(screen.getByText(page.content_excerpt)).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Delete page 12' })); expect(userBookPagesService.deletePage).not.toHaveBeenCalled();
  const buttons = alert.mock.calls.at(-1)![2]!; (userBookPagesService.deletePage as jest.Mock).mockResolvedValue(undefined);
  (userBookPagesService.getPagesForBook as jest.Mock).mockResolvedValue([]); act(() => buttons.find(button => button.text === 'Delete')!.onPress!());
  await screen.findByText('No saved pages yet.'); expect(userBookPagesService.deletePage).toHaveBeenCalledWith('page');
});
it('labels private book reviews as reviews while submitting only explicit visibility changes', async () => {
  const details: any = { id: 'book', user_id: 'actor', book_id: 'catalogue', reading_status: 'reading', ownership: 'owned', condition: 'good', rating: 4, review: 'My book review', review_is_public: true, available_for_lending: false,
    book: { id: 'catalogue', title: 'Selected book', authors: ['Author'], description: 'Book description', cover_url: null, page_count: 300, publisher: 'Publisher', isbn_13: '9780000000001' } };
  (booksService.getBookDetails as jest.Mock).mockImplementation(async () => details);
  (bookReviewService.update as jest.Mock).mockImplementation(async (_actor, _id, patch) => { Object.assign(details, patch); return details; });
  delete mockParams.noteId; render(wrap(<BookDetailScreen />));
  fireEvent.press(await screen.findByRole('button', { name: 'My review' })); await screen.findByText('Public Review');
  fireEvent.press(screen.getByTestId('library-review-privacy-toggle')); await screen.findByText('Private Review');
  expect(bookReviewService.update).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'actor' }), 'book', { review_is_public: false }); expect(screen.queryByText('Private Note')).toBeNull();
  fireEvent.press(screen.getByTestId('library-review-privacy-toggle')); await screen.findByText('Public Review');
  expect(bookReviewService.update).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'actor' }), 'book', { review_is_public: true });
});
it('clears deleted note data and controls in retained readers without replaying its old confirmation', async () => {
  authorizeSimulatedReaderDeletion();
  mockParams.userBookId = 'book';
  const sent: NoteSubmission = { id: 'confirmed-before-delete', actorId: 'actor', bookId: 'book', noteId: 'note', sessionId: 'old-session', mode: 'edit', origin: 'book', content: original.content, tag: original.tag, page_number: original.page_number, expectedVersion: 1 };
  jest.spyOn(manualNoteSaveAdapter, 'write').mockResolvedValueOnce({ ...original, version: 2, last_operation_id: sent.id });
  noteSaves.start(sent); await settle();
  jest.spyOn(manualNotesGateway, 'remove').mockImplementation(async () => { noteRecord = null; });
  const mounted = render(wrap(<><View testID="collection"><NotesScreen /></View><View testID="retained-reader"><NoteReaderScreen /></View><View testID="deleting-reader"><NoteReaderScreen /></View></>));
  await screen.findByText('1 saved note');
  const deletingReader = within(screen.getByTestId('deleting-reader'));
  await deletingReader.findByText(original.content);
  fireEvent.press(deletingReader.getByRole('button', { name: 'Delete note' }));
  expect(manualNotesGateway.remove).not.toHaveBeenCalled();
  fireEvent.press(deletingReader.getAllByRole('button', { name: 'Delete note' }).slice(-1)[0]);
  await screen.findByText('0 saved notes');
  const retained = within(screen.getByTestId('retained-reader'));
  await retained.findByText("This note is missing or couldn't be opened.");
  expect(retained.queryByText(original.content)).toBeNull();
  expect(retained.queryByRole('button', { name: 'Edit note' })).toBeNull();
  expect(retained.queryByRole('button', { name: 'Copy text' })).toBeNull();
  expect(client.getQueryData(noteKeys.record('actor', 'book', 'note'))).toBeNull();
  expect(noteSaves.get(sent.id)).toBeUndefined();
  // A later reader mount and unrelated operation must not restore the deleted snapshot.
  mounted.unmount(); render(wrap(<NoteReaderScreen />));
  jest.spyOn(manualNoteSaveAdapter, 'write').mockRejectedValueOnce(new NoteWriteError('definite', 'Other save rejected'));
  await act(async () => { noteSaves.start({ ...sent, id: 'unrelated', noteId: 'other-note', sessionId: 'other-session', mode: 'create', expectedVersion: undefined }); });
  await screen.findByText("This note is missing or couldn't be opened.");
  expect(screen.queryByText(original.content)).toBeNull();
  expect(client.getQueryData(noteKeys.record('actor', 'book', 'note'))).toBeNull();
});

it('does not replay a retained confirmation over a fresher reader after unrelated operations or remount', async () => {
  const sent: NoteSubmission = { id: 'old-confirmed', actorId: 'actor', bookId: 'book', noteId: 'note', sessionId: 'old-session', mode: 'edit', origin: 'book', content: original.content, tag: original.tag, page_number: original.page_number, expectedVersion: 1 };
  jest.spyOn(manualNoteSaveAdapter, 'write').mockResolvedValueOnce({ ...original, version: 2, last_operation_id: sent.id });
  noteSaves.start(sent); await settle();
  noteRecord = { ...original, content: 'Fresh saved V3', version: 3, last_operation_id: 'newer-operation' };
  const mounted = render(wrap(<NoteReaderScreen />)); await screen.findByText('Fresh saved V3');
  jest.spyOn(manualNoteSaveAdapter, 'write').mockRejectedValueOnce(new NoteWriteError('definite', 'Other save rejected'));
  await act(async () => { noteSaves.start({ ...sent, id: 'unrelated', noteId: 'other-note', sessionId: 'other-session', mode: 'create', expectedVersion: undefined }); });
  await waitFor(() => expect(noteSaves.get('unrelated')?.status).toBe('failed'));
  expect(client.getQueryData(noteKeys.record('actor', 'book', 'note'))).toMatchObject({ content: 'Fresh saved V3', version: 3 });
  expect(screen.getByText('Fresh saved V3')).toBeTruthy();
  expect(noteSaves.get(sent.id)?.status).toBe('confirmed');
  mounted.unmount(); render(wrap(<NoteReaderScreen />));
  await screen.findByText('Fresh saved V3');
  expect(client.getQueryData(noteKeys.record('actor', 'book', 'note'))).toMatchObject({ version: 3 });
  expect(screen.queryByText(original.content)).toBeNull();
});

it('keeps deleted data absent after a cancelled stale read and a late save confirmation', async () => {
  authorizeSimulatedReaderDeletion();
  let finishDelete!: () => void; let finishRead!: (record: ManualNote) => void; let finishWrite!: (record: ManualNote) => void;
  jest.spyOn(manualNotesGateway, 'remove').mockImplementation(() => new Promise(resolve => { finishDelete = () => { noteRecord = null; resolve(); }; }));
  render(wrap(<NoteReaderScreen />)); await screen.findByText(original.content);
  (manualNotesGateway.record as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finishRead = resolve; }));
  act(() => { void client.refetchQueries({ queryKey: noteKeys.record('actor', 'book', 'note'), exact: true }); });
  fireEvent.press(screen.getByRole('button', { name: 'Delete note' }));
  fireEvent.press(screen.getAllByRole('button', { name: 'Delete note' }).slice(-1)[0]);
  // Represents an already-open editor whose response races the confirmed deletion.
  jest.spyOn(manualNoteSaveAdapter, 'write').mockImplementation(() => new Promise(resolve => { finishWrite = resolve; }));
  const sent: NoteSubmission = { id: 'late-edit', actorId: 'actor', bookId: 'book', noteId: 'note', sessionId: 'late-session', mode: 'edit', origin: 'book', content: original.content, tag: original.tag, page_number: original.page_number, expectedVersion: 1 };
  act(() => { noteSaves.start(sent); });
  await act(async () => { finishDelete(); });
  await screen.findByText("This note is missing or couldn't be opened.");
  await act(async () => { finishRead(original); finishWrite({ ...original, version: 2, last_operation_id: sent.id }); });
  await waitFor(() => expect(noteSaves.get(sent.id)?.status).toBe('confirmed'));
  expect(client.getQueryData(noteKeys.record('actor', 'book', 'note'))).toBeNull();
  expect(screen.queryByText(original.content)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Edit note' })).toBeNull();
});

it('preserves a newer record when an older confirmation arrives for the first time through composer refresh', async () => {
  let finishWrite!: (record: ManualNote) => void;
  const sent: NoteSubmission = { id: 'first-late-confirmation', actorId: 'actor', bookId: 'book', noteId: 'note', sessionId: 'old-session', mode: 'edit', origin: 'book', content: original.content, tag: original.tag, page_number: original.page_number, expectedVersion: 1 };
  jest.spyOn(manualNoteSaveAdapter, 'write').mockImplementation(() => new Promise(resolve => { finishWrite = resolve; }));
  noteSaves.start(sent); mockParams.operationId = sent.id;
  noteRecord = { ...original, content: 'Already saved V3', version: 3, last_operation_id: 'newer-edit' };
  client.setQueryData(noteKeys.record('actor', 'book', 'note'), noteRecord);
  render(wrap(<><View testID="reader"><NoteReaderScreen /></View><NoteComposeScreen /></>));
  await within(screen.getByTestId('reader')).findByText('Already saved V3');
  await act(async () => { finishWrite({ ...original, version: 2, last_operation_id: sent.id }); });
  await waitFor(() => expect(mockRouter.back).toHaveBeenCalledTimes(1));
  expect(client.getQueryData(noteKeys.record('actor', 'book', 'note'))).toMatchObject({ content: 'Already saved V3', version: 3 });
  expect(within(screen.getByTestId('reader')).queryByText(original.content)).toBeNull();
  expect(manualNoteSaveAdapter.write).toHaveBeenCalledTimes(1);
});
