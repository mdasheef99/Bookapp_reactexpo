/** Mounted production composer; capture/native results and saves are isolated adapters only. */
import React from 'react';
import { Image, KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import NoteComposeScreen from '../../../../app/(tabs)/library/note-compose';
import { manualNoteSaveAdapter, noteSaves } from '@/features/books/notes/manualNotesGateway';
import { registerNoteContext } from '@/features/books/notes/noteNavigation';
import type { ManualNote } from '@/features/books/notes/manualNoteContract';
import { usePreventRemove } from '@react-navigation/native';

// Initialize lazy RN primitives before behavioral test timing, retaining default timeouts.
void [Image, KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, TextInput, View];

let mockParams: Record<string, string>; let mockRecord: ManualNote | undefined; let mockActor = 'actor'; let mockId = 0;
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismiss: jest.fn(), canGoBack: () => true };
const mockNavigation = { dispatch: jest.fn(), isFocused: () => true, getState: () => ({ index: 2, routes: [{ name: '[bookId]', params: { bookId: 'book' } }, { name: 'note', params: { bookId: 'book', noteId: 'saved' } }, { name: 'note-compose', params: mockParams }] }) };
const mockPhoto = { uri: 'fixture-owned-photo', width: 1200, height: 800, sourceWidth: 1200, sourceHeight: 800, rotation: 0 };
const mockCaptureAdapter = { canRecognize: true, pick: jest.fn(), rotate: jest.fn(), transform: jest.fn(), recognize: jest.fn(), release: jest.fn() };
jest.mock('@/features/books/notes/captureAdapter', () => ({ createCaptureAdapter: () => mockCaptureAdapter, onDeviceAvailability: () => ({ available: true, message: 'English printed text supported in this isolated fixture.' }) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => `fixture-${++mockId}` }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, useRouter: () => mockRouter, useNavigation: () => mockNavigation }));
jest.mock('@react-navigation/native', () => ({ usePreventRemove: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight', colors: { textPrimary: '#111', textSecondary: '#444' } }) }));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: mockRecord, isPending: false, isError: false, refetch: jest.fn(async () => ({ data: mockRecord })) }) }));
jest.mock('@/features/books/notes/manualNotesGateway', () => {
  const { NoteSaveCoordinator } = require('@/features/books/notes/noteSaveCoordinator'); const adapter = { write: jest.fn(), reconcile: jest.fn() };
  return { noteSaves: new NoteSaveCoordinator(adapter), manualNoteSaveAdapter: adapter, manualNotesGateway: { record: jest.fn() } };
});
jest.mock('@/features/books/notes/useManualNotes', () => ({
  useNoteContext: () => ({ actorId: mockActor, book: { data: { id: mockParams.bookId, title: 'Synthetic fixture book' }, refetch: jest.fn() } }),
  useNoteRefresh: () => jest.fn(), useNoteOperations: () => {
    const { useSyncExternalStore } = require('react'); const { noteSaves: coordinator } = require('@/features/books/notes/manualNotesGateway');
    useSyncExternalStore(coordinator.subscribe, coordinator.snapshot, coordinator.snapshot); return coordinator.forBook(mockActor, mockParams.bookId);
  },
}));
const flush = async () => { await act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); }); };
const click = (label: string) => fireEvent.press(screen.getAllByRole('button', { name: label }).at(-1)!);
const recognized = (text: string, reviewOverflow = false) => ({ version: 1, provider: 'on-device', languageHint: 'en', reviewText: text, reviewOverflow, textBounds: [{ left: 120, top: 80, width: 480, height: 300 }] });
async function pickAndRead() {
  click('Choose photo'); await flush();
  if (screen.queryByRole('button', { name: 'Review recognized text' })) click('Review recognized text');
  else if (screen.queryByRole('button', { name: 'Find text and crop' })) click('Find text and crop');
  await flush();
}
beforeEach(() => {
  jest.clearAllMocks(); mockActor = 'actor'; noteSaves.setActor(null); noteSaves.setActor(mockActor); mockRecord = undefined;
  mockParams = { bookId: 'book', contextId: registerNoteContext({ actorId: 'actor', bookId: 'book', origin: 'book', canBack: true }) };
  mockCaptureAdapter.pick.mockResolvedValue(mockPhoto); mockCaptureAdapter.rotate.mockResolvedValue({ ...mockPhoto, uri: 'rotated', width: 800, height: 1200 });
  mockCaptureAdapter.transform.mockResolvedValue({ ...mockPhoto, uri: 'fixture-transformed' }); mockCaptureAdapter.recognize.mockResolvedValue(recognized('Candidate B'));
  mockCaptureAdapter.release.mockResolvedValue(undefined); (manualNoteSaveAdapter.write as jest.Mock).mockImplementation(async sent => ({ id: sent.noteId, user_id: sent.actorId, user_book_id: sent.bookId, content: sent.content, tag: sent.tag, page_number: sent.page_number, created_at: '2026-10-11', updated_at: null, version: 1 }));
});
afterEach(() => noteSaves.setActor(null));
it('automatically selects the printed-text area and does not save until explicit Save', async () => {
  render(<NoteComposeScreen />); click('Skip category'); click('Scan text'); click('Choose photo'); await flush();
  expect(screen.getByText('The printed text area was detected automatically. The outline shows what will be read.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Adjust crop' })).toBeTruthy(); expect(screen.queryByRole('button', { name: 'Left edge inward' })).toBeNull();
  click('Review recognized text'); await flush(); expect(screen.getByLabelText('Note text').props.value).toBe('Candidate B'); expect(screen.getByText('Category: No category')).toBeTruthy();
  expect(mockCaptureAdapter.recognize).toHaveBeenCalledTimes(1); expect(mockCaptureAdapter.recognize).toHaveBeenCalledWith(mockPhoto.uri, expect.any(AbortSignal));
  expect(mockCaptureAdapter.transform).toHaveBeenCalledWith(mockPhoto, { x: .08, y: .08, width: .44, height: .415 }); expect(manualNoteSaveAdapter.write).not.toHaveBeenCalled();
  click('Save note'); await flush(); expect(manualNoteSaveAdapter.write).toHaveBeenCalledWith(expect.objectContaining({ content: 'Candidate B', tag: null, mode: 'create' })); expect(mockRouter.replace).toHaveBeenCalledTimes(1);
});
it('runs a fresh recognition only after the reader adjusts the automatic crop', async () => {
  render(<NoteComposeScreen />); click('Scan text'); click('Choose photo'); await flush();
  click('Adjust crop'); click('Left edge inward'); click('Recognize text'); await flush();
  expect(mockCaptureAdapter.transform).toHaveBeenLastCalledWith(mockPhoto, { x: .13, y: .08, width: .39, height: .415 });
  expect(mockCaptureAdapter.recognize).toHaveBeenCalledTimes(2);
  expect(mockCaptureAdapter.recognize).toHaveBeenLastCalledWith('fixture-transformed', expect.any(AbortSignal));
  expect(screen.getByLabelText('Note text').props.value).toBe('Candidate B');
});
it('manual A -> candidate B -> Scan 2 cancel restores B with category/page and shared form', async () => {
  render(<NoteComposeScreen />); click('Write note'); fireEvent.changeText(screen.getByLabelText('Note text'), 'Draft A'); fireEvent.changeText(screen.getByLabelText('Page, optional'), '24');
  click('Change category'); fireEvent.press(screen.getByRole('radio', { name: 'Question' })); click('Scan text'); expect(screen.getByText('Replace text with a scan?')).toBeTruthy(); click('Scan text'); await pickAndRead();
  expect(screen.getByLabelText('Page, optional').props.value).toBe('24'); expect(screen.getByText('Category: Question')).toBeTruthy();
  click('Scan again'); click('Scan again'); click('Back to review'); expect(screen.getByLabelText('Note text').props.value).toBe('Candidate B');
  expect(screen.getByText('Category: Question')).toBeTruthy(); expect(manualNoteSaveAdapter.write).not.toHaveBeenCalled();
});
it('B09 scanning and protected cancel retain saved edit identity and local changes', async () => {
  mockRecord = { id: 'saved', user_id: 'actor', user_book_id: 'book', content: 'Saved A', tag: 'apply', page_number: 7, version: 9, created_at: '2026-10-10', updated_at: null };
  mockParams.noteId = 'saved'; render(<NoteComposeScreen />); fireEvent.changeText(screen.getByLabelText('Note text'), 'Edited A'); click('Scan text'); click('Scan text'); await pickAndRead();
  click('Cancel scan'); expect(screen.getByText('Discard this scan?')).toBeTruthy(); click('Keep scanning'); expect(screen.getByLabelText('Note text').props.value).toBe('Candidate B');
  click('Cancel scan'); click('Discard scan'); expect(screen.getByLabelText('Note text').props.value).toBe('Edited A');
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy(); expect(screen.getByLabelText('Page, optional').props.value).toBe('7');
  click('Scan text'); click('Scan text'); await pickAndRead(); click('Save changes'); await flush();
  expect(manualNoteSaveAdapter.write).toHaveBeenCalledWith(expect.objectContaining({ mode: 'edit', noteId: 'saved', expectedVersion: 9, tag: 'apply', page_number: 7, content: 'Candidate B' }));
});
it('partial acceptance returns to form, Save reopens warning after an edit, and validation remains mandatory', async () => {
  mockCaptureAdapter.recognize.mockResolvedValueOnce(recognized('Partial fixture text', true)); render(<NoteComposeScreen />); click('Scan text'); await pickAndRead();
  expect(screen.getByText('Some text may be missing')).toBeTruthy(); click('Keep editing'); click('Save note'); expect(screen.getByText('Some text may be missing')).toBeTruthy();
  click('Use incomplete text'); expect(manualNoteSaveAdapter.write).not.toHaveBeenCalled(); fireEvent.changeText(screen.getByLabelText('Note text'), 'Edited partial');
  click('Save note'); click('Use incomplete text'); fireEvent.changeText(screen.getByLabelText('Page, optional'), '24abc'); click('Save note');
  expect(screen.getByText('Enter a positive whole page number, or leave it blank.')).toBeTruthy(); expect(manualNoteSaveAdapter.write).not.toHaveBeenCalled();
});
it('no-text and engine failure have distinct recovery; replacement never opens a blank editor', async () => {
  render(<NoteComposeScreen />); click('Write note'); fireEvent.changeText(screen.getByLabelText('Note text'), 'Prior text'); click('Scan text'); click('Scan text');
  mockCaptureAdapter.recognize.mockRejectedValueOnce(Object.assign(new Error(), { code: 'NO_TEXT' })); await pickAndRead(); expect(screen.getByText('No text recognized')).toBeTruthy();
  click('Back to note'); click('Discard scan'); expect(screen.getByLabelText('Note text').props.value).toBe('Prior text');
  click('Scan text'); click('Scan text'); mockCaptureAdapter.recognize.mockRejectedValueOnce(Object.assign(new Error(), { code: 'ON_DEVICE_UNAVAILABLE' })); await pickAndRead();
  expect(screen.queryByRole('button', { name: 'Choose another photo' })).toBeNull(); click('Back to note'); click('Discard scan'); expect(screen.getByLabelText('Note text').props.value).toBe('Prior text');
});
it('native Back during recognition cancels only adoption and keeps the current crop', async () => {
  render(<NoteComposeScreen />); click('Scan text'); click('Choose photo'); await flush(); click('Adjust crop'); click('Left edge inward');
  mockCaptureAdapter.recognize.mockReturnValueOnce(new Promise(() => {})); click('Recognize text'); await flush();
  const callback = (usePreventRemove as jest.Mock).mock.calls.at(-1)![1]; act(() => callback({ data: { action: { type: 'GO_BACK' } } }));
  expect(screen.getByText('Left edge: 13%')).toBeTruthy(); expect(mockCaptureAdapter.recognize.mock.calls.at(-1)![1].aborted).toBe(true); expect(screen.queryByText("Couldn't scan this page")).toBeNull();
});
it('account/book changes clear capture and fields and invalidate late picker results', async () => {
  let resolve!: (photo: typeof mockPhoto) => void; mockCaptureAdapter.pick.mockReturnValueOnce(new Promise(done => { resolve = done; }));
  const mounted = render(<NoteComposeScreen />); click('Write note'); fireEvent.changeText(screen.getByLabelText('Note text'), 'Prior actor draft'); click('Scan text'); click('Scan text'); click('Choose photo');
  mockActor = 'other'; mockParams = { bookId: 'other-book' }; mounted.rerender(<NoteComposeScreen />); await flush(); await act(async () => resolve(mockPhoto)); await flush();
  click('Write note'); expect(screen.getByLabelText('Note text').props.value).toBe(''); expect(mockCaptureAdapter.recognize).not.toHaveBeenCalled(); expect(mockCaptureAdapter.release).toHaveBeenCalledWith(mockPhoto.uri);
});

it('native removal from restored clean B07 returns to crop and preserves edit identity on another recognition/cancel', async () => {
  mockRecord = { id: 'saved', user_id: 'actor', user_book_id: 'book', content: 'Saved A', tag: 'apply', page_number: 7, version: 9, created_at: '2026-10-10', updated_at: null };
  mockParams.noteId = 'saved'; mockCaptureAdapter.recognize.mockResolvedValueOnce(recognized('Saved A'));
  render(<NoteComposeScreen />); click('Scan text'); click('Scan text'); await pickAndRead();
  click('Scan again'); click('Scan again'); click('Back to review');
  expect(screen.getByLabelText('Note text').props.value).toBe('Saved A');
  expect((usePreventRemove as jest.Mock).mock.calls.at(-1)![0]).toBe(true);
  const callback = (usePreventRemove as jest.Mock).mock.calls.at(-1)![1];
  act(() => callback({ data: { action: { type: 'GO_BACK' } } }));
  expect(screen.getByText('The printed text area was detected automatically. The outline shows what will be read.')).toBeTruthy(); expect(mockNavigation.dispatch).not.toHaveBeenCalled();
  click('Adjust crop'); click('Left edge inward'); mockCaptureAdapter.recognize.mockResolvedValueOnce(recognized('Candidate C')); click('Recognize text'); await flush();
  click('Cancel scan'); click('Discard scan'); expect(screen.getByLabelText('Note text').props.value).toBe('Saved A');
  expect(screen.getByLabelText('Page, optional').props.value).toBe('7'); expect(screen.getByText('Category: Action')).toBeTruthy();
  expect(manualNoteSaveAdapter.write).not.toHaveBeenCalled(); click('Save changes'); await flush();
  expect(manualNoteSaveAdapter.write).toHaveBeenCalledWith(expect.objectContaining({ mode: 'edit', noteId: 'saved', expectedVersion: 9, content: 'Saved A', tag: 'apply', page_number: 7 }));
});

it('unchanged saved edit without a photo leaves native removal unguarded', () => {
  mockRecord = { id: 'saved', user_id: 'actor', user_book_id: 'book', content: 'Saved A', tag: null, page_number: null, version: 9, created_at: '2026-10-10', updated_at: null };
  mockParams.noteId = 'saved'; render(<NoteComposeScreen />);
  expect(screen.getByLabelText('Note text').props.value).toBe('Saved A');
  expect((usePreventRemove as jest.Mock).mock.calls.at(-1)![0]).toBe(false);
  expect(manualNoteSaveAdapter.write).not.toHaveBeenCalled();
});
