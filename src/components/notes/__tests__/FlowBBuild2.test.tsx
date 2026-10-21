/** Flow B build B2: live word count, offline save, choose/write chips, picker keyboard. */
import React from 'react';
import { AccessibilityInfo, Platform, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import NoteComposeScreen from '../../../../app/(tabs)/library/note-compose';
import { CategoryPicker, NoteDialog, NoteForm } from '../ManualNoteUi';
import { getLibraryAppearance } from '@/components/library/LibraryAppearance';
import { BookButton } from '@/components/library/ui';
import { expectSinglePrimary } from '@/test-utils/bookSection';
import { manualNoteSaveAdapter, noteSaves } from '@/features/books/notes/manualNotesGateway';
import { ManualNote, NoteCategory, NoteSubmission, NoteWriteError } from '@/features/books/notes/manualNoteContract';
import { COLUMN_MAX_WIDTH } from '@/components/library/bookDetails/bookDetailsTokens';
import { registerNoteContext } from '@/features/books/notes/noteNavigation';

let mockParams: Record<string, string>;
let mockRecord: ManualNote | null;
let mockCollection: ManualNote[];
let mockBookError = false;
let mockId = 0;
let mockOffline = false;
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismiss: jest.fn(), canGoBack: jest.fn(() => true) };
const mockRefresh = jest.fn();
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockId}` }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, useRouter: () => mockRouter, useNavigation: () => ({ dispatch: jest.fn(), getState: () => ({ index: 2, routes: [{ name: '[bookId]', params: { bookId: 'book' } }, { name: 'note-compose', params: { bookId: 'book' } }] }) }) }));
jest.mock('@react-navigation/native', () => ({ usePreventRemove: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }) }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight', colors: {} }) }));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isConnected: !mockOffline, isOffline: mockOffline }) }));
jest.mock('@tanstack/react-query', () => ({ useQuery: (options: any) => ({ data: options.queryKey[0] === 'notes' ? mockCollection : mockRecord, isPending: false, isError: false, refetch: jest.fn(async () => ({ data: mockRecord })) }) }));
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
const words = (count: number) => Array(count).fill('word').join(' ');
const DAYLIGHT = getLibraryAppearance('daylight');
const countText = () => screen.getByTestId('note-word-count').props.children.join('');
const countColor = () => StyleSheet.flatten(screen.getByTestId('note-word-count').props.style).color;
const openWrite = () => { fireEvent.press(screen.getByRole('button', { name: 'Write note' })); };
beforeEach(() => {
  jest.clearAllMocks(); noteSaves.setActor(null); noteSaves.setActor('actor'); mockRecord = null; mockCollection = []; mockBookError = false; mockOffline = false;
  mockParams = { bookId: 'book', contextId: registerNoteContext({ actorId: 'actor', bookId: 'book', origin: 'book', canBack: true }) };
  (manualNoteSaveAdapter.write as jest.Mock).mockImplementation(async sent => saved(sent));
});
afterEach(() => { noteSaves.setActor(null); jest.restoreAllMocks(); });

describe('live word count', () => {
  it('keeps the Save-time overflow alert unchanged through edits and clears it at the limit', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    render(<NoteComposeScreen />); openWrite();
    fireEvent.changeText(screen.getByLabelText('Note text'), words(501));
    fireEvent.press(screen.getByRole('button', { name: 'Save note' }));
    expect(screen.getByRole('alert').props.children).toBe('Remove 1 word to save. Your text has been kept.');
    const announcements = announce.mock.calls.length;
    fireEvent.changeText(screen.getByLabelText('Note text'), words(502));
    const visible = screen.getByText('Remove 2 words to save. Your text has been kept.');
    expect(visible.props.accessibilityRole).toBeUndefined();
    expect(visible.props.accessibilityLiveRegion).toBeUndefined();
    expect(screen.getByRole('alert').props.children).toBe('Remove 1 word to save. Your text has been kept.');
    expect(announce).toHaveBeenCalledTimes(announcements);
    fireEvent.press(screen.getByRole('button', { name: 'Save note' }));
    expect(screen.getByRole('alert').props.children).toBe('Remove 2 words to save. Your text has been kept.');
    fireEvent.changeText(screen.getByLabelText('Note text'), words(503));
    expect(screen.getByRole('alert').props.children).toBe('Remove 2 words to save. Your text has been kept.');
    expect(announce).toHaveBeenCalledTimes(announcements);
    fireEvent.changeText(screen.getByLabelText('Note text'), words(500));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Remove 1 word to save. Your text has been kept.')).toBeNull();
    fireEvent.changeText(screen.getByLabelText('Note text'), words(503));
    expect(screen.getByRole('alert').props.children).toBe('Remove 3 words to save. Your text has been kept.');
    expect(manualNoteSaveAdapter.write).not.toHaveBeenCalled();
  });

  it('announces native overflow only on crossings, keeps changing copy quiet, and preserves Save alerts', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    render(<NoteComposeScreen />); openWrite();
    fireEvent.changeText(screen.getByLabelText('Note text'), words(500));
    expect(announce).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText('Note text'), words(501));
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenLastCalledWith('Remove 1 word to save. Your text has been kept.');
    fireEvent.changeText(screen.getByLabelText('Note text'), words(502));
    const visible = screen.getByText('Remove 2 words to save. Your text has been kept.');
    expect(visible.props.accessibilityLiveRegion).toBeUndefined();
    expect(visible.props.accessibilityRole).toBeUndefined();
    expect(announce).toHaveBeenCalledTimes(1);
    fireEvent.changeText(screen.getByLabelText('Note text'), words(500));
    fireEvent.changeText(screen.getByLabelText('Note text'), words(503));
    expect(announce).toHaveBeenCalledTimes(2);
    expect(announce).toHaveBeenLastCalledWith('Remove 3 words to save. Your text has been kept.');
    fireEvent.press(screen.getByRole('button', { name: 'Save note' }));
    expect(screen.getByRole('alert').props.children).toBe('Remove 3 words to save. Your text has been kept.');
    expect(manualNoteSaveAdapter.write).not.toHaveBeenCalled();
  });

  it('keeps one web polite region unchanged through successive overflow edits and resets below the limit', () => {
    const priorOS = Platform.OS;
    try {
      Platform.OS = 'web';
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
      const props = { fields: { text: words(500), category: null, page: '' }, onChange: jest.fn(), locked: false, showErrors: false };
      const tree = render(<NoteForm {...props} />);
      const update = (count: number) => tree.rerender(<NoteForm {...props} fields={{ ...props.fields, text: words(count) }} />);
      const region = () => screen.getByTestId('note-overflow-announcement');
      expect(region().props.children).toBe('');
      update(501);
      expect(region().props.accessibilityLiveRegion).toBe('polite');
      expect(region().props.children).toBe('Remove 1 word to save. Your text has been kept.');
      update(502);
      expect(region().props.children).toBe('Remove 1 word to save. Your text has been kept.');
      expect(screen.getByText('Remove 2 words to save. Your text has been kept.').props.accessibilityLiveRegion).toBeUndefined();
      expect(screen.getAllByTestId('note-overflow-announcement')).toHaveLength(1);
      update(500);
      expect(region().props.children).toBe('');
      update(503);
      expect(region().props.children).toBe('Remove 3 words to save. Your text has been kept.');
      expect(announce).not.toHaveBeenCalled();
    } finally { Platform.OS = priorOS; }
  });
  it('counts words, marks only overflow in error ink, and validates before Save', () => {
    render(<NoteComposeScreen />); openWrite();
    fireEvent.changeText(screen.getByLabelText('Note text'), 'one two three');
    expect(countText()).toBe('3 / 500 words');
    expect(countColor()).toBe(DAYLIGHT.textSecondary);

    fireEvent.changeText(screen.getByLabelText('Note text'), words(500));
    expect(countText()).toBe('500 / 500 words');
    expect(countColor()).toBe(DAYLIGHT.textSecondary);
    expect(screen.queryByText('Remove 1 word to save. Your text has been kept.')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.changeText(screen.getByLabelText('Note text'), words(501));
    expect(countText()).toBe('501 / 500 words');
    expect(countColor()).toBe(DAYLIGHT.error);
    expect(screen.getByText('Remove 1 word to save. Your text has been kept.')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Note text'), words(500));
    expect(countText()).toBe('500 / 500 words');
    expect(countColor()).toBe(DAYLIGHT.textSecondary);
    expect(screen.queryByText('Remove 1 word to save. Your text has been kept.')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('offline saving', () => {
  it('explains the offline conflict in the compare panel and keeps Replace disabled', async () => {
    mockRecord = { id: 'note', user_id: 'actor', user_book_id: 'book', content: 'Saved original', tag: null, page_number: null, created_at: '2026-10-09', updated_at: null, version: 1 };
    mockParams.noteId = 'note';
    const compared = { ...mockRecord, content: 'Latest saved body', version: 2 };
    (manualNoteSaveAdapter.write as jest.Mock).mockRejectedValueOnce(new NoteWriteError('conflict', 'Saved note changed', compared));
    render(<NoteComposeScreen />);
    fireEvent.changeText(screen.getByLabelText('Note text'), 'Retained replacement draft');
    fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
    await flush();
    mockOffline = true;
    screen.rerender(<NoteComposeScreen />);
    const compare = screen.getByText('Latest saved version').parent!.parent!;
    expect(within(compare).getByText('Saving needs a connection. Your text stays here.')).toBeTruthy();
    const replace = within(compare).getByRole('button', { name: 'Replace saved version' });
    expect(replace.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(replace);
    await flush();
    expect(manualNoteSaveAdapter.write).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Note text').props.value).toBe('Retained replacement draft');
    mockOffline = false;
    screen.rerender(<NoteComposeScreen />);
    expect(screen.queryByText('Saving needs a connection. Your text stays here.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Replace saved version' }).props.accessibilityState.disabled).toBe(false);
  });

  it('blocks an open Replace confirmation and its retained action after going offline, then permits it online', async () => {
    mockRecord = { id: 'note', user_id: 'actor', user_book_id: 'book', content: 'Saved original', tag: null, page_number: null, created_at: '2026-10-09', updated_at: null, version: 1 };
    mockParams.noteId = 'note';
    const compared = { ...mockRecord, content: 'Latest saved body', version: 2 };
    (manualNoteSaveAdapter.write as jest.Mock).mockRejectedValueOnce(new NoteWriteError('conflict', 'Saved note changed', compared));
    render(<NoteComposeScreen />);
    fireEvent.changeText(screen.getByLabelText('Note text'), 'Retained replacement draft');
    fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
    await flush();
    fireEvent.press(screen.getByRole('button', { name: 'Replace saved version' }));
    const retainedAction = screen.UNSAFE_getByType(NoteDialog).props.spec.action;
    mockOffline = true;
    screen.rerender(<NoteComposeScreen />);
    const confirm = within(screen.UNSAFE_getByType(NoteDialog)).getByRole('button', { name: 'Replace saved version' });
    expect(confirm.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(confirm, { stopPropagation: jest.fn() });
    act(() => retainedAction());
    await flush();
    expect(manualNoteSaveAdapter.write).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Replace saved version?')).toBeTruthy();

    mockOffline = false;
    screen.rerender(<NoteComposeScreen />);
    const onlineConfirm = within(screen.UNSAFE_getByType(NoteDialog)).getByRole('button', { name: 'Replace saved version' });
    expect(onlineConfirm.props.accessibilityState.disabled).toBe(false);
    fireEvent.press(onlineConfirm);
    await flush();
    expect(manualNoteSaveAdapter.write).toHaveBeenCalledTimes(2);
    expect(manualNoteSaveAdapter.write).toHaveBeenLastCalledWith(expect.objectContaining({ expectedVersion: 2, content: 'Retained replacement draft' }));
  });
  it('keeps the draft on screen and disables Save without a connection, then enables it online', async () => {
    mockOffline = true;
    render(<NoteComposeScreen />); openWrite();
    fireEvent.changeText(screen.getByLabelText('Note text'), 'Offline draft');
    expect(screen.getByText('Saving needs a connection. Your text stays here.')).toBeTruthy();
    const save = screen.getByRole('button', { name: 'Save note' });
    expect(save.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(save); await flush();
    expect(manualNoteSaveAdapter.write).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Note text').props.value).toBe('Offline draft');

    mockOffline = false;
    screen.rerender(<NoteComposeScreen />);
    expect(screen.queryByText('Saving needs a connection. Your text stays here.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save note' }).props.accessibilityState.disabled).toBe(false);
  });
});

describe('choose step', () => {
  it('shows only Write note as the web primary and hides Scan text in the write step', async () => {
    const priorOS = Platform.OS;
    Platform.OS = 'web';
    try {
      render(<NoteComposeScreen />);
      expectSinglePrimary(screen);
      expect(screen.getByRole('button', { name: 'Write note' })).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Scan text' })).toBeNull();
      openWrite();
      await flush();
      expectSinglePrimary(screen);
      expect(screen.getByLabelText('Note text')).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Scan text' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Scan again' })).toBeNull();
      expect(manualNoteSaveAdapter.write).not.toHaveBeenCalled();
      screen.unmount();
    } finally { Platform.OS = priorOS; }
  });

  it('gives Write and Scan equal primary weight, drops Skip category, and defaults to No category', () => {
    render(<NoteComposeScreen />);
    expectSinglePrimary(screen, { allow: 2 });
    expect(screen.UNSAFE_getAllByType(BookButton).filter(button => button.props.variant === 'primary').map(button => button.props.label))
      .toEqual(['Write note', 'Scan text']);
    expect(screen.queryByRole('button', { name: 'Skip category' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'No category' }).props.accessibilityState.checked).toBe(true);
    fireEvent.press(screen.getByRole('radio', { name: 'Quote' }));
    expect(screen.getByRole('radio', { name: 'Quote' }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole('radio', { name: 'No category' }).props.accessibilityState.checked).toBe(false);
    const content = screen.getByText('Category (optional)').parent!.parent!;
    expect(StyleSheet.flatten(content.props.style)).toMatchObject({ width: '100%', maxWidth: COLUMN_MAX_WIDTH, alignSelf: 'center' });
  });
});

describe('write step', () => {
  it('shows the inline chip group, no Change category button, and disables the chips while saving', async () => {
    (manualNoteSaveAdapter.write as jest.Mock).mockImplementation(() => new Promise(() => {}));
    render(<NoteComposeScreen />); openWrite();
    const group = screen.getByLabelText('Category, optional');
    const form = screen.UNSAFE_getByType(NoteForm);
    expect(StyleSheet.flatten(form.parent!.props.style)).toMatchObject({ width: '100%', maxWidth: COLUMN_MAX_WIDTH, alignSelf: 'center' });
    expect(group.props.accessibilityRole).toBe('radiogroup');
    expect(screen.getAllByRole('radio')).toHaveLength(6);
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio.props.accessibilityState.disabled).not.toBe(true);
    }
    expect(screen.queryByRole('button', { name: 'Change category' })).toBeNull();

    fireEvent.changeText(screen.getByLabelText('Note text'), 'Locked draft');
    fireEvent.press(screen.getByRole('button', { name: 'Save note' }));
    await screen.findByText('Saving…');
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio.props.accessibilityState.disabled).toBe(true);
    }
  });
});

describe('CategoryPicker keyboard', () => {
  function radios() {
    return screen.UNSAFE_root.findAll((node: any) => node.props.accessibilityRole === 'radio', { deep: false });
  }
  function pressArrow(label: string, key: 'ArrowLeft' | 'ArrowRight') {
    const radio = radios().find((node: any) => node.props.accessibilityLabel === label);
    expect(radio).toBeTruthy();
    const event = { key, nativeEvent: { key }, target: {}, currentTarget: {}, preventDefault: jest.fn() };
    act(() => { (radio!.props.onKeyDown as (value: unknown) => void)(event); });
    return event;
  }

  it('moves and selects with arrows and keeps a single tab stop', () => {
    const priorOS = Platform.OS;
    try {
      Platform.OS = 'web';
      const onChange = jest.fn();
      function Picker() {
        const [selected, setSelected] = React.useState<NoteCategory | null>('quote');
        return <CategoryPicker selected={selected} includeNone onChange={value => { onChange(value); setSelected(value); }} />;
      }
      function expectCheckedTabStop(label: string) {
        for (const radio of radios()) {
          const checked = radio.props.accessibilityLabel === label;
          expect(radio.props.accessibilityState.checked).toBe(checked);
          expect(radio.props.tabIndex).toBe(checked ? 0 : -1);
        }
        expect(radios().filter((node: any) => node.props.tabIndex === 0)).toHaveLength(1);
      }
      render(<Picker />);
      expectCheckedTabStop('Quote');
      const right = pressArrow('Quote', 'ArrowRight');
      expect(onChange).toHaveBeenLastCalledWith('reflect');
      expect(right.preventDefault).toHaveBeenCalled();
      expectCheckedTabStop('Thought');

      pressArrow('Thought', 'ArrowLeft');
      expectCheckedTabStop('Quote');
      pressArrow('Quote', 'ArrowLeft');
      expectCheckedTabStop('No category');
      const left = pressArrow('No category', 'ArrowLeft');
      expect(onChange).toHaveBeenLastCalledWith('question');
      expect(left.preventDefault).toHaveBeenCalled();
      expectCheckedTabStop('Question');
    } finally { Platform.OS = priorOS; }
  });
});
