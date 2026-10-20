/** C1 presentation matrix: real composer/session/buttons, isolated native and save adapters.
 * Constructor seeds cover retained/uncommon states without changing production transitions.
 * Reverting the corresponding label, variant, caption or busy-action change must fail these tests.
 */
import React from 'react';
import { Image, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import NoteComposeScreen from '../../../../app/(tabs)/library/note-compose';
import { BookButton } from '@/components/library/ui';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import { getLibraryAppearance } from '@/components/library/LibraryAppearance';
import { expectSinglePrimary } from '@/test-utils/bookSection';
import { NoteCaptureSession, CaptureState, ComposeStep } from '@/features/books/notes/captureSession';
import { CaptureError } from '@/features/books/notes/captureAdapter';
import { FULL_CROP } from '@/features/books/notes/captureGeometry';
import { noteSaves } from '@/features/books/notes/manualNotesGateway';
import { registerNoteContext } from '@/features/books/notes/noteNavigation';

void [Image, KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, TextInput, View];
let mockParams: Record<string, string>;
let mockSeed: Partial<CaptureState>;
let mockSession: NoteCaptureSession;
let mockOffline = false;
let mockAvailable = true;
let mockId = 0;
const photo = { uri: 'fixture-photo', width: 1200, height: 800, sourceWidth: 1200, sourceHeight: 800, rotation: 0 };
const mockAdapter = { canRecognize: true, pick: jest.fn(), rotate: jest.fn(), transform: jest.fn(), recognize: jest.fn(), release: jest.fn() };
const mockNavigation = { dispatch: jest.fn(), isFocused: () => true, getState: () => ({ index: 1, routes: [{ name: '[bookId]', params: { bookId: 'book' } }, { name: 'note-compose', params: mockParams }] }) };
jest.mock('@/features/books/notes/captureSession', () => {
  const actual: typeof import('@/features/books/notes/captureSession') = jest.requireActual('@/features/books/notes/captureSession');
  return { ...actual, NoteCaptureSession: class extends actual.NoteCaptureSession {
    constructor(...args: ConstructorParameters<typeof actual.NoteCaptureSession>) { super(...args); Object.assign(this.snapshot(), mockSeed); mockSession = this; }
  } };
});
jest.mock('@/features/books/notes/captureAdapter', () => ({
  ...jest.requireActual('@/features/books/notes/captureAdapter'),
  createCaptureAdapter: () => mockAdapter,
  onDeviceAvailability: () => ({ available: mockAvailable, message: mockAvailable
    ? 'Scanning reads printed English text. Check the result before you save.'
    : "Scanning text isn't available in the browser. Use the BookConnect app to scan, or write your note here." }),
}));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, useRouter: () => ({ back: jest.fn(), replace: jest.fn(), canGoBack: () => true }), useNavigation: () => mockNavigation }));
jest.mock('expo-crypto', () => ({ randomUUID: () => `flow-c-${++mockId}` }));
jest.mock('@react-navigation/native', () => ({ usePreventRemove: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight', colors: {} }) }));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOffline: mockOffline }) }));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: mockParams.noteId ? { id: 'saved', content: 'Saved text', tag: null, page_number: null, version: 1 } : undefined, isPending: false, refetch: jest.fn() }) }));
jest.mock('@/features/books/notes/manualNotesGateway', () => {
  const { NoteSaveCoordinator } = require('@/features/books/notes/noteSaveCoordinator');
  return { noteSaves: new NoteSaveCoordinator({ write: jest.fn(), reconcile: jest.fn() }), manualNotesGateway: { record: jest.fn() } };
});
jest.mock('@/features/books/notes/useManualNotes', () => ({
  useNoteContext: () => ({ actorId: 'actor', book: { data: { id: 'book', title: 'Fixture book' }, refetch: jest.fn() } }),
  useNoteRefresh: () => jest.fn(), useNoteOperations: () => [],
}));

beforeEach(() => {
  jest.clearAllMocks(); mockOffline = false; mockAvailable = true; mockAdapter.canRecognize = true;
  mockAdapter.release.mockResolvedValue(undefined);
  noteSaves.setActor(null); noteSaves.setActor('actor');
  mockParams = { bookId: 'book', contextId: registerNoteContext({ actorId: 'actor', bookId: 'book', origin: 'book', canBack: true }) };
  mockSeed = {};
});
afterEach(() => noteSaves.setActor(null));

function mountScan(patch: Partial<CaptureState>, origin: ComposeStep = 'choose', edit = false) {
  if (edit) mockParams.noteId = 'saved';
  mockSeed = { step: 'intake', checkpoint: {
    actorId: 'actor', bookId: 'book', mode: edit ? 'edit' : 'create', step: origin,
    fields: { text: '', category: null, page: '' }, position: { scroll: 0, focus: null }, crop: FULL_CROP, cropMode: 'automatic',
  }, ...patch };
  render(<NoteComposeScreen />);
}
function variant(label: string) {
  const matches = screen.UNSAFE_getAllByType(BookButton).filter(button => button.props.label === label);
  expect(matches).toHaveLength(1);
  return matches[0].props.variant;
}
function primary(label: string) { expectSinglePrimary(screen); expect(variant(label)).toBe('primary'); }
function caption(message: string) {
  const node = screen.getByText(message);
  expect(StyleSheet.flatten(node.props.style)).toMatchObject(LIBRARY_TEXT.caption);
  expect(node.props.accessibilityLiveRegion).toBe('polite');
}
// DP-02: instruction sentences use body text; caption stays for short status/metadata lines.
function instruction(message: string) {
  const node = screen.getByText(message);
  expect(StyleSheet.flatten(node.props.style)).toMatchObject(LIBRARY_TEXT.body);
  expect(node.props.accessibilityLiveRegion).toBe('polite');
}
const press = (label: string) => fireEvent.press(screen.getByRole('button', { name: label }));

it('C1 intake names Take photo as the sole primary with plain intake copy and caption metadata', () => {
  mountScan({}); primary('Take photo');
  expect(variant('Choose photo')).toBe('secondary'); expect(variant('Write note instead')).toBe('text');
  expect(screen.getByText('Take a clear photo of a printed page, or choose one from this device.')).toBeTruthy();
  instruction('Scanning reads printed English text. Check the result before you save.');
  expect(StyleSheet.flatten(screen.getByText('Category: No category').props.style)).toMatchObject(LIBRARY_TEXT.caption);
});
it('C1 retained intake keeps Continue with this photo secondary', () => {
  mountScan({ photo }); primary('Take photo'); expect(variant('Continue with this photo')).toBe('secondary');
  press('Continue with this photo'); primary('Read text');
});
it('C1 picking announces Opening photos and disables every intake action', () => {
  mountScan({ photo, busy: 'picking' }); primary('Take photo'); caption('Opening photos…');
  for (const label of ['Take photo', 'Choose photo', 'Continue with this photo', 'Write note instead']) {
    expect(screen.getByRole('button', { name: label })).toBeDisabled();
  }
});
it.each(['PERMISSION_DENIED', 'CAMERA_UNAVAILABLE', 'INVALID_ASSET'] as const)('C1 intake %s is an announced error with a scan primary', code => {
  mountScan({ error: { code, message: new CaptureError(code).message, engine: false } }); primary('Take photo');
  expect(screen.getByRole('alert').props.children).toBe(new CaptureError(code).message);
  expect(StyleSheet.flatten(screen.getByRole('alert').props.style).color).toBe(getLibraryAppearance('daylight').error);
});
it('C1 later intake retains its origin and omits the first-scan writing action', () => {
  mountScan({}, 'write'); primary('Take photo');
  expect(screen.getByRole('button', { name: 'Back to note' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Write note instead' })).toBeNull();
});
it.each([['choose', false, 'Write note instead'], ['write', false, 'Back to note'], ['write', true, 'Back to edit'], ['review', false, 'Back to review']] as const)(
  'D07-19 unavailable intake from %s (edit %s) hides photo actions and offers the way back as its sole primary', (origin, edit, label) => {
    mockAvailable = false; mountScan({}, origin, edit); primary(label);
    for (const name of ['Take photo', 'Choose photo', 'Continue with this photo']) expect(screen.queryByRole('button', { name })).toBeNull();
    const message = screen.getByText("Scanning text isn't available in the browser. Use the BookConnect app to scan, or write your note here.");
    expect(StyleSheet.flatten(message.props.style)).toMatchObject(LIBRARY_TEXT.body);
    expect(screen.getAllByText(/isn't available in the browser/)).toHaveLength(1);
    const actions = screen.getAllByRole('button', { name: label }); fireEvent.press(actions[actions.length - 1]);
    expect(mockSession.snapshot().step).toBe(origin === 'choose' ? 'write' : origin);
  });
it.each(['automatic pending', 'automatic detected', 'manual'] as const)('C1 crop %s uses Read text as its sole primary', state => {
  mountScan({ step: 'crop', photo, cropMode: state === 'manual' ? 'manual' : 'automatic',
    ...(state === 'automatic detected' ? { autoDetection: { photoUri: photo.uri, crop: FULL_CROP, result: { version: 1, provider: 'on-device', languageHint: 'en', reviewText: 'Text', reviewOverflow: false } } } : {}) });
  primary('Read text'); expect(variant('Cancel scan')).toBe('text');
  for (const label of ['Adjust crop', 'Rotate photo', 'Choose another photo']) expect(variant(label)).toBe('secondary');
});
it('C1 adjusting keeps eight secondary edge alternatives and a text reset', () => {
  mountScan({ step: 'crop', photo }); press('Adjust crop'); primary('Read text');
  expect(variant('Done adjusting')).toBe('secondary'); expect(variant('Use full image')).toBe('text');
  for (const edge of ['Left', 'Top', 'Right', 'Bottom']) for (const direction of ['inward', 'outward']) {
    expect(variant(`${edge} edge ${direction}`)).toBe('secondary');
  }
});
it.each([
  ['detecting', 'Finding the printed text…'], ['recognizing', 'Reading the text…'],
] as const)('C1 busy %s uses Cancel reading in the header and as the only footer action', (busy, message) => {
  mountScan({ step: 'crop', photo, busy }); primary('Cancel reading'); caption(message);
  expect(screen.getAllByRole('button', { name: 'Cancel reading' })).toHaveLength(2);
  expect(screen.queryByRole('button', { name: 'Cancel scan' })).toBeNull();
  if (busy === 'recognizing') instruction("If you cancel, this result won't be used.");
  for (const label of ['Adjust crop', 'Rotate photo', 'Choose another photo']) expect(screen.getByRole('button', { name: label })).toBeDisabled();
  fireEvent.press(screen.getAllByRole('button', { name: 'Cancel reading' })[1]); primary('Read text');
});
it('C1 rotating announces its caption and disables crop actions', () => {
  mountScan({ step: 'crop', photo, busy: 'rotating' }); primary('Read text'); caption('Rotating the photo…');
  for (const label of ['Read text', 'Adjust crop', 'Rotate photo', 'Choose another photo']) expect(screen.getByRole('button', { name: label })).toBeDisabled();
});
it('C1 transform error stays on crop with an alert and Read text', () => {
  mountScan({ step: 'crop', photo, error: { code: 'TRANSFORM_FAILED', message: new CaptureError('TRANSFORM_FAILED').message, engine: false } });
  primary('Read text'); expect(screen.getByRole('alert').props.children).toBe("This photo couldn't be prepared. Your earlier text is still here.");
});
it.each([['choose', false, 'Write note instead'], ['write', false, 'Back to note'], ['write', true, 'Back to edit'], ['review', false, 'Back to review']] as const)(
  'C1 unavailable crop retains the %s origin fallback (edit %s)', (origin, edit, label) => {
    mockAvailable = false; mountScan({ step: 'crop', photo }, origin, edit); primary(label); expect(variant('Cancel scan')).toBe('text');
  });
it.each([['choose', false, 'Save note'], ['write', false, 'Save note'], ['write', true, 'Save changes']] as const)(
  'C1 review from %s (edit %s) keeps one Save primary and the correct caption', (origin, edit, label) => {
    mountScan({ step: 'review', photo }, origin, edit); primary(label);
    instruction(`Check the scanned text and fix any mistakes. Nothing is saved until you choose ${label}.`);
    expect(variant(origin === 'choose' ? 'Cancel note' : 'Cancel scan')).toBe('text'); expect(variant('Scan again')).toBe('secondary');
  });
it.each([false, true])('D07-19 partial review accepted=%s shows a calm notice in secondary ink and one Save primary', accepted => {
  mountScan({ step: 'review', photo, partial: { revision: 1, ...(accepted ? { acceptedRevision: 1 } : {}) } }); primary('Save note');
  const notice = screen.getByText(accepted ? 'You chose to use this scan. Check that nothing is missing before saving.' : 'Some text may be missing from this scan. Save will ask you to check it first.');
  expect(StyleSheet.flatten(notice.props.style).color).toBe(getLibraryAppearance('daylight').textSecondary);
  expect(notice.props.accessibilityRole).toBeUndefined(); expect(notice.props.accessibilityLiveRegion).toBe('polite');
});
it('D07-19 partial dialog explains the cut-off and accepts with Use this text', () => {
  mountScan({ step: 'review', photo, partial: { revision: 1 }, warningOpen: true });
  expect(screen.getByText('This page had more text than one scan can hold, so the end may be cut off. Check the text before you use it.')).toBeTruthy();
  press('Use this text'); expect(mockSession.partialUnaccepted).toBe(false);
});
it.each([true, false])('C1 no-text with photo=%s uses its recovery primary and English guidance', hasPhoto => {
  mountScan({ step: 'no-text', photo: hasPhoto ? photo : undefined }); primary(hasPhoto ? 'Adjust photo' : 'Choose another photo');
  expect(screen.getByRole('header', { name: 'No text found' })).toBeTruthy();
  expect(screen.getByText('No printed text was found. Try a sharper, well-lit photo of printed English text.')).toBeTruthy();
  expect(variant('Write note instead')).toBe('text');
});
it.each([
  [true, 'choose', false, 'Write note instead'], [true, 'write', false, 'Back to note'], [true, 'write', true, 'Back to edit'],
  [true, 'review', false, 'Back to review'], [false, 'choose', false, 'Choose another photo'], [false, 'write', false, 'Choose another photo'],
] as const)('C1 failure engine=%s origin=%s edit=%s exposes one recovery primary', (engine, origin, edit, label) => {
  const message = engine ? "Scanning text isn't available in this app. Your earlier text is still here." : "This page couldn't be read. Your earlier text is still here.";
  mountScan({ step: 'failure', error: { code: engine ? 'ON_DEVICE_UNAVAILABLE' : 'LOCAL_FAILED', message, engine } }, origin, edit);
  primary(label); expect(screen.getByRole('header', { name: "Couldn't read this page" })).toBeTruthy();
  expect(screen.getByRole('alert').props.children).toBe(message);
  if (!engine && origin === 'choose') expect(variant('Write note instead')).toBe('text');
  if (!engine && origin !== 'choose') expect(screen.queryByRole('button', { name: 'Write note instead' })).toBeNull();
});
it('C1 offline scan controls remain enabled from intake through crop; only Save needs a connection', () => {
  mockOffline = true; mountScan({ photo }); primary('Take photo');
  for (const label of ['Take photo', 'Choose photo', 'Continue with this photo']) expect(screen.getByRole('button', { name: label })).toBeEnabled();
  press('Continue with this photo'); primary('Read text');
  for (const label of ['Read text', 'Adjust crop', 'Rotate photo', 'Choose another photo']) expect(screen.getByRole('button', { name: label })).toBeEnabled();
  act(() => { mockSession.setFields({ text: 'Scanned text', category: null, page: '' }); mockSession.setStep('review'); });
  primary('Save note'); expect(screen.getByRole('button', { name: 'Save note' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Scan again' })).toBeEnabled(); caption('Saving needs a connection. Your text stays here.');
});
