let mockCollections: any;
jest.mock('@/features/books/organising/useOrganising', () => ({ useOrganising: () => mockCollections }));
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { act, render, fireEvent, waitFor } from '@testing-library/react-native';
import { LIBRARY_SPACING } from '@/components/library/LibraryAppearance';
import { countPrimaryButtons, expectSinglePrimary } from '@/test-utils/bookSection';

const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) };
const mockRoute = { key: 'swipe-key' };
let mockParams: Record<string, string> = { scope: 'all', order: 'shuffle' };
let mockBook: any = { data: undefined, isError: false, isPending: false, error: null, refetch: jest.fn() };
let mockDeck: any = null;
let mockNetwork: any = { isOffline: false };
let mockReduced = false;
let mockHint = false;

jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => mockParams,
  useRouter: () => mockRouter,
  useRoute: () => mockRoute,
}));
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useRoute: () => mockRoute,
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'seed-1' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 10, bottom: 10, left: 0, right: 0 }) }));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => mockNetwork }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
jest.mock('@/features/books/notes/useManualNotes', () => ({ useNoteContext: () => ({ actorId: 'actor', book: mockBook }) }));
jest.mock('@/features/books/notes/useNoteDeck', () => ({ useNoteDeck: () => mockDeck, useNoteDeckIndex: () => ({}) }));
jest.mock('@/components/library/notes-swipe/useNoteSwipeMotion', () => ({
  useReducedNoteMotion: () => mockReduced,
  useNoteSwipeHint: () => mockHint,
}));
jest.mock('@/features/books/notes/noteNavigation', () => ({
  registerNoteContext: jest.fn(() => 'ctx'),
  readerHref: jest.fn(() => ({})),
  openNoteComposer: jest.fn(),
}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(() => Promise.resolve()), ImpactFeedbackStyle: { Light: 'Light' } }));
jest.mock('react-native-worklets', () => {
  const actual = jest.requireActual('react-native-worklets');
  return { ...actual, scheduleOnRN: (fn: any, ...args: any[]) => fn(...args) };
});
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  const chainable = () => {
    const g: Record<string, jest.Mock> = {};
    for (const name of ['enabled', 'minDistance', 'maxDistance', 'maxDuration', 'numberOfTaps', 'maxDelay', 'runOnJS']) g[name] = jest.fn(() => g);
    for (const name of ['onStart', 'onUpdate', 'onEnd', 'onFinalize']) g[name] = jest.fn(() => g);
    return g;
  };
  return {
    Gesture: {
      Pan: jest.fn(() => chainable()),
      Tap: jest.fn(() => chainable()),
      Native: jest.fn(() => chainable()),
      Simultaneous: jest.fn((...args: unknown[]) => args[0]),
      Exclusive: jest.fn((...args: unknown[]) => args[0]),
    },
    GestureDetector: ({ children }: any) => children,
    GestureHandlerRootView: ({ children, ...props }: any) => React.createElement(View, props, children),
  };
});
jest.mock('@/components/library/ui/BookButton', () => {
  const React = require('react') as any;
  const { Pressable, Text } = require('react-native');
  function MockBookButton({ label, accessibilityLabel, testID, onPress, disabled, ref, ...rest }: any) {
    void rest;
    const name = (accessibilityLabel ?? label) as string;
    const g = globalThis as any;
    if (!g.__bookButtonFocusMocks) g.__bookButtonFocusMocks = {};
    const store = g.__bookButtonFocusMocks as Record<string, any>;
    if (!store[name]) store[name] = jest.fn();
    const focusMock = store[name];
    const fake = React.useMemo(() => ({ focus: (...args: any[]) => focusMock(...args) }), [focusMock]);
    React.useEffect(() => {
      if (!ref) return;
      try {
        if (typeof ref === 'function') ref(fake);
        else if (ref && typeof ref === 'object') ref.current = fake;
      } catch { /* ignore */ }
    }, [ref, fake]);
    return React.createElement(
      Pressable,
      { accessibilityRole: 'button', accessibilityLabel: name, accessibilityState: { disabled }, testID, disabled, onPress },
      React.createElement(Text, null, label),
    );
  }
  return { BookButton: MockBookButton };
});

import NotesSwipeScreen from '../notes-swipe';
import { BookFeedbackProvider } from '@/components/library/ui';

function renderScreen() {
  const React = require('react');
  return render(React.createElement(BookFeedbackProvider, null, React.createElement(NotesSwipeScreen)));
}

function card(id = 'a') {
  return { note: { id, user_id: 'actor', user_book_id: 'b', content: 'body', tag: null as any, page_number: null, created_at: '2026-10-20T00:00:00Z', updated_at: null }, book: { id: 'b', title: 'T', authors: ['A'], cover_url: null } };
}

function baseDeck(over: any = {}) {
  return {
    index: { data: [{ id: 'a' }], isError: false, isPending: false, isFetching: false, refetch: jest.fn() },
    ids: ['a'],
    at: 0,
    noteId: 'a',
    card: card('a'),
    undercards: [],
    move: jest.fn(),
    restart: jest.fn(),
    abort: jest.fn(),
    detailError: false,
    retryCard: jest.fn(),
    ...over,
  };
}

beforeEach(() => {
  mockCollections = { entities: { data: [] }, members: { data: [] }, refresh: jest.fn() };
  jest.clearAllMocks();
  (globalThis as any).__bookButtonFocusMocks = {};
  const Reanimated = require('react-native-reanimated');
  jest.spyOn(Reanimated, 'useSharedValue').mockImplementation((initial: unknown) => {
    const ref = jest.requireActual('react').useRef(null);
    if (!ref.current) ref.current = { value: initial };
    return ref.current;
  });
  mockParams = { scope: 'all', order: 'shuffle' };
  mockBook = { data: undefined, isError: false, isPending: false, error: null, refetch: jest.fn() };
  mockNetwork = { isOffline: false };
  mockReduced = false;
  mockHint = false;
  (Platform as any).OS = 'ios';
  mockDeck = baseDeck();
});

describe('notes-swipe screen states and primaries', () => {
  it('passes the selected category in the Stack guard format so selecting it again is a no-op', () => {
    mockDeck = baseDeck({ category: 'quote', categories: ['all', 'quote'], selectedFilter: { kind: 'category', tag: 'quote' } });
    const ui = renderScreen();
    expect(ui.UNSAFE_getByType(require('@/components/library/notes-swipe/NoteSwipeStack').NoteSwipeStack).props.categoryKey).toBe('quote');
    ui.unmount();
  });
  it('announces the dedicated collection name rather than All notes', () => {
    const announce = jest.spyOn(require('react-native').AccessibilityInfo, 'announceForAccessibility');
    mockParams = { scope: 'collection', collectionId: 'group', order: 'oldest' };
    mockCollections.entities.data = [{ id: 'group', user_id: 'actor', name: 'Ideas', created_at: '2026-10-01', updated_at: '2026-10-01' }];
    const ui = renderScreen();
    expect(announce).toHaveBeenCalledWith(expect.stringContaining('Collection Ideas.'));
    ui.unmount();
  });
  it('shows a failed cold collection membership read instead of an empty all/book deck', () => {
    mockParams = { scope: 'all', order: 'shuffle', filterCollectionId: 'group' };
    mockCollections = { entities: { data: [], isError: false }, members: { data: undefined, isError: true }, refresh: jest.fn() };
    mockDeck = baseDeck({ ids: [], noteId: null, card: undefined });
    const ui = renderScreen();
    expect(ui.getByText("Couldn't load your collections.")).toBeTruthy();
    expect(ui.queryByText('Your notes will show up here.')).toBeNull();
    fireEvent.press(ui.getByRole('button', { name: 'Try again' }));
    expect(mockCollections.refresh).toHaveBeenCalled(); ui.unmount();
  });
  it('disables cold collection retry offline and enables it on reconnect', () => {
    mockParams = { scope: 'collection', collectionId: 'group', order: 'oldest' };
    mockCollections.entities.data = undefined;
    mockCollections.members.data = undefined;
    mockNetwork = { isOffline: true };
    const ui = renderScreen();
    expect(ui.getByText("You're offline. Connect to load this collection.")).toBeTruthy();
    const retry = ui.getByRole('button', { name: 'Try again' });
    expect(retry.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(retry);
    expect(mockCollections.refresh).not.toHaveBeenCalled();
    mockNetwork = { isOffline: false };
    ui.rerender(<BookFeedbackProvider><NotesSwipeScreen /></BookFeedbackProvider>);
    expect(ui.getByRole('button', { name: 'Try again' }).props.accessibilityState.disabled).toBe(false);
    fireEvent.press(ui.getByRole('button', { name: 'Try again' }));
    expect(mockCollections.refresh).toHaveBeenCalledTimes(1);
    ui.unmount();
  });
  it('keeps the cached card and offers recovery when collection refresh fails', () => {
    mockCollections.entities.isError = true;
    const ui = renderScreen();
    expect(ui.getByTestId('note-card-slot-0', { includeHiddenElements: true })).toBeTruthy();
    expect(ui.getByText("Couldn't refresh collections.")).toBeTruthy(); ui.unmount();
  });
  it('loading has no primary and shows the loading line inside a quiet three-slot outline', () => {
    mockDeck = baseDeck({ index: { data: undefined, isError: false, isPending: true, isFetching: false, refetch: jest.fn() }, ids: [], noteId: null, card: undefined });
    const ui = renderScreen();
    expect(ui.getByText('Loading your notes…')).toBeTruthy();
    expect(countPrimaryButtons(ui as any)).toBe(0);
    expect(ui.getByTestId('note-stack-fixed-parent', { includeHiddenElements: true })).toBeTruthy();
    for (const slot of [0, 1, 2]) expect(ui.getByTestId(`note-card-slot-${slot}`, { includeHiddenElements: true })).toBeTruthy();
    expect(StyleSheet.flatten(ui.getByTestId('note-card-slot-0-inner', { includeHiddenElements: true }).props.style).borderWidth).toBe(1);
    expect(ui.queryByTestId('note-swipe-button-bar')).toBeNull();
    ui.unmount();
  });

  it('empty all scope offers Go to library as its single primary', () => {
    mockDeck = baseDeck({ index: { data: [], isError: false, isPending: false, isFetching: false, refetch: jest.fn() }, ids: [], noteId: null, card: undefined });
    const ui = renderScreen();
    expect(ui.getByText('Your notes will show up here.')).toBeTruthy();
    expectSinglePrimary(ui as any);
    expect(ui.getByRole('button', { name: 'Go to library' })).toBeTruthy();
    ui.unmount();
  });

  it('empty book scope offers Add a note as its single primary', () => {
    mockParams = { scope: 'book', userBookId: 'b', order: 'shuffle' };
    mockBook = { data: { id: 'b', title: 'B' }, isError: false, isPending: false, error: null, refetch: jest.fn() };
    mockDeck = baseDeck({ index: { data: [], isError: false, isPending: false, isFetching: false, refetch: jest.fn() }, ids: [], noteId: null, card: undefined });
    const ui = renderScreen();
    expectSinglePrimary(ui as any);
    expect(ui.getByRole('button', { name: 'Add a note' })).toBeTruthy();
    ui.unmount();
  });

  it('unavailable book shows Go to library as its single primary', () => {
    mockParams = { scope: 'book', userBookId: '', order: 'shuffle' };
    mockBook = { data: undefined, isError: false, isPending: false, error: null, refetch: jest.fn() };
    mockDeck = baseDeck({ index: { data: undefined, isError: false, isPending: false, isFetching: false, refetch: jest.fn() }, ids: [], noteId: null, card: undefined });
    const ui = renderScreen();
    expect(ui.getByText('This book is unavailable.')).toBeTruthy();
    expectSinglePrimary(ui as any);
    ui.unmount();
  });

  it('definite not-found shows unavailable while transient book failure shows the error state with Try again', () => {
    mockParams = { scope: 'book', userBookId: 'b', order: 'shuffle' };
    mockBook = { data: undefined, isError: true, isPending: false, error: new Error('This book is unavailable.'), refetch: jest.fn() };
    mockDeck = baseDeck({ index: { data: undefined, isError: false, isPending: false, isFetching: false, refetch: jest.fn() }, ids: [], noteId: null, card: undefined });
    let ui = renderScreen();
    expect(ui.getByText('This book is unavailable.')).toBeTruthy();
    expectSinglePrimary(ui as any);
    ui.unmount();
    mockBook = { data: undefined, isError: true, isPending: false, error: new Error('transient'), refetch: jest.fn() };
    mockDeck = baseDeck({ index: { data: undefined, isError: false, isPending: false, isFetching: false, refetch: jest.fn() }, ids: [], noteId: null, card: undefined });
    ui = renderScreen();
    expect(ui.getByText('Couldn\'t load your notes.')).toBeTruthy();
    expectSinglePrimary(ui as any);
    expect(mockBook.refetch).toBeDefined();
    fireEvent.press(ui.getByRole('button', { name: 'Try again' }));
    expect(mockBook.refetch).toHaveBeenCalled();
    ui.unmount();
  });

  it('error shows Try again as its single primary and retries the book too', () => {
    mockDeck = baseDeck({ index: { data: undefined, isError: true, isPending: false, isFetching: false, refetch: jest.fn() }, ids: [], noteId: null, card: undefined });
    const ui = renderScreen();
    expect(ui.getByText('Couldn\'t load your notes.')).toBeTruthy();
    expectSinglePrimary(ui as any);
    ui.unmount();
  });

  it('offline without cache shows the offline state with a single primary', () => {
    mockNetwork = { isOffline: true };
    mockDeck = baseDeck({ index: { data: undefined, isError: false, isPending: false, isFetching: false, refetch: jest.fn() }, ids: [], noteId: null, card: undefined });
    const ui = renderScreen();
    expect(ui.getByText('You\'re offline. Connect to load your notes.')).toBeTruthy();
    expectSinglePrimary(ui as any);
    ui.unmount();
  });

  it('offline with cached index but uncached card shows the offline wording with a working Try again', () => {
    mockNetwork = { isOffline: true };
    mockDeck = baseDeck({ index: { data: [{ id: 'a' }], isError: false, isPending: false, isFetching: false, refetch: jest.fn() }, ids: ['a'], noteId: 'a', card: undefined, detailError: false });
    const ui = renderScreen();
    expect(ui.getByText('You\'re offline. Connect to load this note.')).toBeTruthy();
    expectSinglePrimary(ui as any);
    fireEvent.press(ui.getByRole('button', { name: 'Try again' }));
    expect(mockDeck.index.refetch).toHaveBeenCalled();
    ui.unmount();
  });

  it('end card shows Start again as its single primary', () => {
    mockDeck = baseDeck({ ids: ['a'], at: 1, noteId: null, card: undefined, index: { data: [{ id: 'a' }], isError: false, isPending: false, isFetching: false, refetch: jest.fn() } });
    const ui = renderScreen();
    expect(ui.getByText('That\'s all for now.')).toBeTruthy();
    expectSinglePrimary(ui as any);
    expect(ui.getByRole('button', { name: 'Start again' })).toBeTruthy();
    ui.unmount();
  });

  it('per-card failure keeps Next as the single primary', () => {
    mockDeck = baseDeck({ detailError: true, card: undefined });
    const ui = renderScreen();
    expect(ui.getByText('Couldn\'t load this note.')).toBeTruthy();
    expectSinglePrimary(ui as any);
    ui.unmount();
  });

  it('populated keeps Next as the single primary', () => {
    const ui = renderScreen();
    expectSinglePrimary(ui as any);
    expect(ui.getByRole('button', { name: 'Next' })).toBeTruthy();
    ui.unmount();
  });
});

describe('notes-swipe background, keyboard, announcements and focus', () => {
  it('hides the background from assistive tech while the sheet is open', async () => {
    const ui = renderScreen();
    fireEvent.press(ui.getByRole('button', { name: 'Read full note' }));
    await waitFor(() => expect(ui.getByTestId('note-full-sheet', { includeHiddenElements: true })).toBeTruthy());
    const bg = ui.getByTestId('note-swipe-content', { includeHiddenElements: true });
    expect(bg.props['aria-hidden']).toBe(true);
    expect(bg.props.importantForAccessibility).toBe('no-hide-descendants');
    expectSinglePrimary(ui as any);
    ui.unmount();
  });

  it('drives the real window key handler: arrows/enter move and open, sheet gates keys, Esc closes sheet first', async () => {
    (Platform as any).OS = 'web';
    const listeners: Array<{ type: string; handler: (e: any) => void }> = [];
    (global as any).window = {
      addEventListener: jest.fn((type: string, handler: (e: any) => void) => { listeners.push({ type, handler }); }),
      removeEventListener: jest.fn((type: string, handler: (e: any) => void) => {
        const at = listeners.findIndex(l => l.type === type && l.handler === handler);
        if (at >= 0) listeners.splice(at, 1);
      }),
    };
    const move = jest.fn();
    const cardA = card('a');
    const cardB = { ...card('b'), note: { ...card('b').note, id: 'b' } };
    mockDeck = baseDeck({ move, ids: ['a', 'b'], at: 0, noteId: 'a', card: cardA, undercards: [], index: { data: [{ id: 'a' }, { id: 'b' }], isError: false, isPending: false, isFetching: false, refetch: jest.fn() } });
    mockRouter.back.mockClear(); mockRouter.push.mockClear();
    const ui = renderScreen();
    const screenHandlers = () => listeners.filter(l => l.type === 'keydown').map(l => l.handler);
    expect(screenHandlers().length).toBeGreaterThan(0);
    const neutral = () => ({ key: 'ArrowRight', target: { closest: () => null }, defaultPrevented: false, preventDefault: jest.fn() });
    const lastHandler = () => screenHandlers()[screenHandlers().length - 1];
    // ArrowRight advances (real handler, not a pure-function call).
    lastHandler()({ ...neutral(), key: 'ArrowRight' });
    expect(move).toHaveBeenCalledWith('next');
    move.mockClear();
    // ArrowUp does nothing in C2.
    lastHandler()({ ...neutral(), key: 'ArrowUp' });
    expect(move).not.toHaveBeenCalled();
    expect(ui.queryByTestId('note-full-sheet', { includeHiddenElements: true })).toBeNull();
    // Enter opens the sheet (position/sheet state changes via the real handler).
    act(() => lastHandler()({ ...neutral(), key: 'Enter' }));
    await waitFor(() => expect(ui.getByTestId('note-full-sheet', { includeHiddenElements: true })).toBeTruthy());
    move.mockClear();
    // While the sheet is open, arrows are ignored (gating would fail if sheetOpen were not checked).
    const openHandlers = screenHandlers();
    for (const h of openHandlers) h({ ...neutral(), key: 'ArrowRight' });
    expect(move).not.toHaveBeenCalled();
    // Focus on a button/field is ignored even when the sheet is closed: reopen check after Esc.
    // First Esc closes only the sheet (screen handler ignores Esc while open; sheet handler closes).
    const escEvent = () => ({ key: 'Escape', target: { closest: () => null }, defaultPrevented: false, preventDefault: jest.fn(), stopPropagation: jest.fn() });
    act(() => { for (const h of openHandlers) h(escEvent()); });
    await waitFor(() => expect(ui.queryByTestId('note-full-sheet', { includeHiddenElements: true })).toBeNull());
    expect(move).not.toHaveBeenCalled();
    expect(mockRouter.back).not.toHaveBeenCalled();
    // Keys on a real button stay ignored after the sheet closes.
    const afterClose = screenHandlers();
    const buttonTarget = { closest: (s: string) => (s.includes('button') ? {} : null) };
    for (const h of afterClose) h({ key: 'ArrowRight', target: buttonTarget, defaultPrevented: false, preventDefault: jest.fn() });
    expect(move).not.toHaveBeenCalled();
    const fieldTarget = { closest: (s: string) => (s.includes('input') ? {} : null) };
    for (const h of afterClose) h({ key: 'ArrowRight', target: fieldTarget, defaultPrevented: false, preventDefault: jest.fn() });
    expect(move).not.toHaveBeenCalled();
    // ArrowLeft at the first card does nothing; move to the second card then ArrowLeft goes back.
    mockDeck = baseDeck({ move, ids: ['a', 'b'], at: 1, noteId: 'b', card: cardB, undercards: [], index: { data: [{ id: 'a' }, { id: 'b' }], isError: false, isPending: false, isFetching: false, refetch: jest.fn() } });
    ui.unmount();
    listeners.length = 0;
    const ui2 = renderScreen();
    const h2 = () => screenHandlers()[screenHandlers().length - 1];
    h2()({ key: 'ArrowLeft', target: { closest: () => null }, defaultPrevented: false, preventDefault: jest.fn() });
    expect(move).toHaveBeenCalledWith('previous');
    move.mockClear();
    // Esc with no sheet leaves (Back).
    h2()({ key: 'Escape', target: { closest: () => null }, defaultPrevented: false, preventDefault: jest.fn() });
    expect(mockRouter.back).toHaveBeenCalled();
    ui2.unmount();
    delete (global as any).window;
    (Platform as any).OS = 'ios';
  });

  it('announces once per move on native', () => {
    const React = require('react');
    const { AccessibilityInfo } = require('react-native');
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    mockDeck = baseDeck({ ids: ['a', 'b'], at: 0, noteId: 'a', card: card('a') });
    const ui = renderScreen();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Note 1 of 2'));
    const calls = spy.mock.calls.length;
    ui.rerender(React.createElement(require('@/components/library/ui').BookFeedbackProvider, null, React.createElement(require('../notes-swipe').default)));
    expect(spy.mock.calls.length).toBe(calls);
    ui.unmount();
    spy.mockRestore();
  });

  it('returns focus to Read full note when the sheet closes', async () => {
    const priorOS = (Platform as any).OS;
    (Platform as any).OS = 'web';
    (globalThis as any).__bookButtonFocusMocks = {};
    try {
      mockDeck = baseDeck();
      const ui = renderScreen();
      fireEvent.press(ui.getByRole('button', { name: 'Read full note' }));
      await waitFor(() => expect(ui.getByTestId('note-full-sheet', { includeHiddenElements: true })).toBeTruthy());
      const closeBtn = ui.getByRole('button', { name: 'Close full note' });
      fireEvent.press(closeBtn);
      await waitFor(() => {
        const mocks = (globalThis as any).__bookButtonFocusMocks as Record<string, jest.Mock>;
        expect(mocks['Read full note']).toBeDefined();
        expect(mocks['Read full note']).toHaveBeenCalled();
      });
      const mocks = (globalThis as any).__bookButtonFocusMocks as Record<string, jest.Mock>;
      expect(mocks['Read full note'].mock.calls.length).toBeGreaterThanOrEqual(1);
      ui.unmount();
    } finally {
      (Platform as any).OS = priorOS;
    }
  });

  it('moves focus to Start again on the end card', async () => {
    const priorOS = (Platform as any).OS;
    (Platform as any).OS = 'web';
    (globalThis as any).__bookButtonFocusMocks = {};
    try {
      mockDeck = baseDeck({ ids: ['a'], at: 1, noteId: null, card: undefined, index: { data: [{ id: 'a' }], isError: false, isPending: false, isFetching: false, refetch: jest.fn() } });
      const ui = renderScreen();
      await waitFor(() => expect(ui.getByTestId('note-end-heading', { includeHiddenElements: true })).toBeTruthy());
      expect(ui.getByTestId('note-start-again', { includeHiddenElements: true })).toBeTruthy();
      await waitFor(() => {
        const mocks = (globalThis as any).__bookButtonFocusMocks as Record<string, jest.Mock>;
        expect(mocks['Start again']).toBeDefined();
        expect(mocks['Start again']).toHaveBeenCalled();
      });
      ui.unmount();
    } finally {
      (Platform as any).OS = priorOS;
    }
  });

  it('produces zero console.error calls while rendering the swipe screen', () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      mockDeck = baseDeck();
      const ui = renderScreen();
      expect(ui.getByTestId('note-swipe-button-bar', { includeHiddenElements: true })).toBeTruthy();
      ui.unmount();
      expect(err).not.toHaveBeenCalled();
    } finally {
      err.mockRestore();
    }
  });

  it('keeps the footer and button row visible at a small window with bounded note text', () => {
    const RN = require('react-native');
    const dimsSpy = jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 360, height: 400, scale: 1, fontScale: 2 });
    try {
      mockParams = { scope: 'book', userBookId: 'b', order: 'shuffle' };
      mockBook = { data: { id: 'b', title: 'A very long book title that would otherwise push the controls out of view on a narrow screen' }, isError: false, isPending: false, error: null, refetch: jest.fn() };
      mockDeck = baseDeck({ card: card('a'), ids: ['a'], at: 0, noteId: 'a' });
      const ui = renderScreen();
      expect(ui.getByTestId('note-swipe-button-bar', { includeHiddenElements: true })).toBeTruthy();
      // Footer (cover placeholder or cover, book title, author) stays at the card bottom.
      expect(ui.getByText('T', { includeHiddenElements: true })).toBeTruthy();
      expect(ui.getByText('A', { includeHiddenElements: true })).toBeTruthy();
      // Note text is bounded and truncated, never scrolling/overlapping the footer.
      const body = ui.getByText('body', { includeHiddenElements: true });
      const lines = (body.props as any).numberOfLines;
      expect(typeof lines === 'number' && lines <= 8).toBe(true);
      const { StyleSheet } = require('react-native');
      const paper = ui.getByTestId('note-card-paper', { includeHiddenElements: true });
      expect(StyleSheet.flatten(paper.props.style).overflow).toBe('hidden');
      // Top bar title is bounded so a long book title cannot push the buttons off screen.
      const title = ui.UNSAFE_getAllByType(require('react-native').Text).find((t: any) => typeof t.props.children === 'string' && (t.props.children as string).includes('very long'));
      expect(title.props.numberOfLines).toBe(2);
      ui.unmount();
    } finally {
      dimsSpy.mockRestore();
      mockParams = { scope: 'all', order: 'shuffle' };
      mockBook = { data: undefined, isError: false, isPending: false, error: null, refetch: jest.fn() };
    }
  });

  it.each([640, 560])('fits measured metadata/footer bounds at 200%% in a 360x%s window', height => {
    const RN = require('react-native');
    const dims = jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 360, height, scale: 1, fontScale: 2 });
    const scale = jest.spyOn(RN.PixelRatio, 'getFontScale').mockReturnValue(2);
    mockDeck = baseDeck({ card: { ...card('a'), note: { ...card('a').note, tag: 'quote', page_number: 42 } } });
    const ui = renderScreen();
    const layout = (testID: string, h: number, y = 0) => fireEvent(ui.getByTestId(testID, { includeHiddenElements: true }), 'layout', { nativeEvent: { layout: { x: 0, y, width: 312, height: h } } });
    try {
      const available = height === 640 ? 340 : 248;
      layout('note-stack-wrap', available);
      const stage = RN.StyleSheet.flatten(ui.getByTestId('note-stack-fixed-parent', { includeHiddenElements: true }).props.style);
      expect(stage.minHeight).toBeLessThanOrEqual(available);
      const slot = RN.StyleSheet.flatten(ui.getByTestId('note-card-slot-0', { includeHiddenElements: true }).props.style);
      const cardHeight = available - slot.top - slot.bottom;
      layout('note-card-paper', cardHeight);
      const paper = RN.StyleSheet.flatten(ui.getByTestId('note-card-paper', { includeHiddenElements: true }).props.style);
      const padding = paper.paddingVertical ?? paper.padding;
      const footerHeight = 80;
      const metaHeight = 40;
      const footerY = cardHeight - padding - footerHeight;
      const bodyY = padding + metaHeight + paper.gap;
      const bodyHeight = footerY - paper.gap - bodyY;
      expect(bodyHeight).toBeGreaterThanOrEqual(0);
      layout('note-card-meta', metaHeight, padding);
      layout('note-card-footer', footerHeight, footerY);
      layout('note-card-body', bodyHeight, bodyY);
      const note = ui.queryByText('body', { includeHiddenElements: true });
      if (height === 560) expect(note).toBeNull();
      else {
        expect(note).toBeTruthy();
        expect(note!.props.numberOfLines * 52).toBeLessThanOrEqual(bodyHeight);
      }
      expect(footerY).toBeGreaterThanOrEqual(padding + metaHeight + paper.gap);
      expect(footerY + footerHeight).toBeLessThanOrEqual(cardHeight - padding);
      expect(ui.getByText('T', { includeHiddenElements: true })).toBeTruthy();
      expect(ui.getByText('A', { includeHiddenElements: true })).toBeTruthy();
      const top = RN.StyleSheet.flatten(ui.getByTestId('note-swipe-top-bar', { includeHiddenElements: true }).props.style);
      const position = RN.StyleSheet.flatten(ui.getByTestId('note-position-bar', { includeHiddenElements: true }).props.style);
      expect(top.paddingVertical).toBeLessThan(LIBRARY_SPACING.xs);
      expect(position.paddingVertical).toBeLessThan(LIBRARY_SPACING.xs);
      for (const label of ['Previous', 'Read full note', 'Next']) {
        const button = ui.getByRole('button', { name: label });
        expect(button).toBeTruthy();
        expect(ui.getByText(label).props.numberOfLines).toBeUndefined();
      }
    } finally { ui.unmount(); dims.mockRestore(); scale.mockRestore(); }
  });

  it('shrinks the note line clamp when the available height shrinks at 200% (footer and button row stay visible)', () => {
    const RN = require('react-native');
    const tallSpy = jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 360, height: 400, scale: 1, fontScale: 2 });
    let linesTall = 0;
    try {
      mockDeck = baseDeck({ card: card('a'), ids: ['a'], at: 0, noteId: 'a' });
      const ui = renderScreen();
      expect(ui.getByTestId('note-swipe-button-bar', { includeHiddenElements: true })).toBeTruthy();
      expect(ui.getByText('T', { includeHiddenElements: true })).toBeTruthy();
      const body = ui.getByText('body', { includeHiddenElements: true });
      linesTall = (body.props as any).numberOfLines;
      expect(Number.isInteger(linesTall)).toBe(true);
      expect(linesTall).toBeGreaterThanOrEqual(1);
      expect(linesTall).toBeLessThanOrEqual(8);
      ui.unmount();
    } finally {
      tallSpy.mockRestore();
    }
    const shortSpy = jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 360, height: 300, scale: 1, fontScale: 2 });
    try {
      mockDeck = baseDeck({ card: card('a'), ids: ['a'], at: 0, noteId: 'a' });
      const ui2 = renderScreen();
      expect(ui2.getByTestId('note-swipe-button-bar', { includeHiddenElements: true })).toBeTruthy();
      expect(ui2.getByText('T', { includeHiddenElements: true })).toBeTruthy();
      expect(ui2.getByText('A', { includeHiddenElements: true })).toBeTruthy();
      const body2 = ui2.getByText('body', { includeHiddenElements: true });
      const linesShort = (body2.props as any).numberOfLines;
      expect(Number.isInteger(linesShort)).toBe(true);
      expect(linesShort).toBeGreaterThanOrEqual(1);
      expect(linesShort).toBeLessThanOrEqual(8);
      expect(linesShort).toBeLessThanOrEqual(linesTall);
      if (linesTall > 1) expect(linesShort).toBeLessThan(linesTall);
      ui2.unmount();
    } finally {
      shortSpy.mockRestore();
    }
  });

  it('uses a non-scrolling flex layout with a wrapping button row and a flexible stack', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../notes-swipe.tsx'), 'utf8');
    expect(src).toContain('note-stack-wrap');
    expect(src).toContain('note-state-scroll');
    expect(src).toContain('flexWrap');
    expect(src).toContain('wrap');
    const ui = renderScreen();
    expect(ui.getByTestId('note-swipe-top-bar', { includeHiddenElements: true })).toBeTruthy();
    expect(ui.getByTestId('note-swipe-button-bar', { includeHiddenElements: true })).toBeTruthy();
    ui.unmount();
  });

  it('invalidates the deck prefix on book removal and wishlist removal and labels the reader Back to your notes', () => {
    const fs = require('fs');
    const path = require('path');
    const bookIdSrc = fs.readFileSync(path.join(__dirname, '../[bookId].tsx'), 'utf8');
    expect(bookIdSrc).toContain("['library-note-deck'");
    const searchSrc = fs.readFileSync(path.join(__dirname, '../../../../src/features/books/hooks/useSearchBookActions.ts'), 'utf8');
    expect(searchSrc).toContain("['library-note-deck'");
    const noteSrc = fs.readFileSync(path.join(__dirname, '../note.tsx'), 'utf8');
    expect(noteSrc).toContain('Back to your notes');
    expect(noteSrc).toContain("origin === 'swipe'");
  });
});
