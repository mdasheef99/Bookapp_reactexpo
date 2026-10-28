jest.mock('@/features/books/organising/useOrganising', () => ({ useOrganising: () => ({ entities: { data: [] }, members: { data: [] }, refresh: jest.fn() }) }));
import React from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { countPrimaryButtons, expectSinglePrimary } from '@/test-utils/bookSection';

const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) };
const mockRoute = { key: 'swipe-key' };
let mockParams: Record<string, string> = { scope: 'all' };
let mockBook: any = { data: undefined, isError: false, isPending: false, error: null, refetch: jest.fn() };
let mockDeck: any = null;
let mockNetwork: any = { isOffline: false };
let mockReduced = false;
let mockHint = false;
let mockStoredOrder: string | null = null;
let mockSetItemCalls: Array<[string, string]> = [];
let mockSeedCounter = 0;

jest.mock('@/features/auth/store/authStore', () => ({ useAuthStore: { subscribe: jest.fn() } }));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => mockRouter,
  useRoute: () => mockRoute,
}));
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useRoute: () => mockRoute,
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => `seed-${++mockSeedCounter}` }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 10, bottom: 10, left: 0, right: 0 }) }));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => mockNetwork }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
jest.mock('@/features/books/notes/useManualNotes', () => ({ useNoteContext: () => ({ actorId: 'actor', book: mockBook }) }));
jest.mock('@/features/books/notes/useNoteDeck', () => ({ useNoteDeck: (...args: any[]) => (globalThis as any).__mockDeckImpl?.(...args) ?? mockDeck, useNoteDeckIndex: () => ({}) }));
jest.mock('@/components/library/notes-swipe/useNoteSwipeMotion', () => ({
  useReducedNoteMotion: () => mockReduced,
  useNoteSwipeHint: () => mockHint,
}));
jest.mock('@/features/books/notes/noteNavigation', () => ({
  registerNoteContext: jest.fn(() => 'ctx'),
  readerHref: jest.fn(() => ({})),
  openNoteComposer: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve((globalThis as any).__mockStoredOrder ?? null)),
  setItem: jest.fn((k: string, v: string) => { (globalThis as any).__mockSetItemCalls.push([k, v]); return Promise.resolve(); }),
}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(() => Promise.resolve()), ImpactFeedbackStyle: { Light: 'Light' } }));
jest.mock('react-native-worklets', () => {
  const actual = jest.requireActual('react-native-worklets');
  return { ...actual, scheduleOnRN: (fn: any, ...args: any[]) => fn(...args), scheduleOnUI: (fn: any, ...args: any[]) => fn(...args) };
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
      { accessibilityRole: (rest as any).accessibilityRole ?? 'button', accessibilityLabel: name, testID, disabled, onPress, accessibilityState: { disabled, ...(rest.checked !== undefined ? { checked: rest.checked } : {}) }, 'aria-checked': (rest as any).checked },
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
    categories: ['all'],
    category: 'all',
    positions: {},
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (globalThis as any).__bookButtonFocusMocks = {};
  (globalThis as any).__mockStoredOrder = mockStoredOrder;
  (globalThis as any).__mockSetItemCalls = [];
  mockSetItemCalls = (globalThis as any).__mockSetItemCalls;
  const Reanimated = require('react-native-reanimated');
  jest.spyOn(Reanimated, 'withTiming').mockImplementation((value: any, _opts: any, cb: any) => { cb?.(true); return value; });
  jest.spyOn(Reanimated, 'useSharedValue').mockImplementation((initial: unknown) => {
    const ref = jest.requireActual('react').useRef(null);
    if (!ref.current) ref.current = { value: initial };
    return ref.current;
  });
  mockParams = { scope: 'all' };
  mockBook = { data: undefined, isError: false, isPending: false, error: null, refetch: jest.fn() };
  mockNetwork = { isOffline: false };
  mockReduced = false;
  mockHint = false;
  mockStoredOrder = null;
  (globalThis as any).__mockStoredOrder = null;
  mockSeedCounter = 1;
  (Platform as any).OS = 'ios';
  (globalThis as any).__mockDeckImpl = undefined;
  mockDeck = baseDeck();
  jest.useRealTimers();
});

describe('C3 screen: order loading and param precedence', () => {
  it('shows loading until the stored order loads, then renders the stack', async () => {
    (globalThis as any).__mockStoredOrder = 'newest';
    mockDeck = baseDeck();
    const ui = renderScreen();
    // First frame is loading (order not yet loaded).
    expect(ui.queryByText('Loading your notes…')).toBeTruthy();
    await waitFor(() => expect(ui.queryByRole('button', { name: 'Next' })).toBeTruthy());
    ui.unmount();
  });

  it('explicit order param beats the stored value', async () => {
    const seenOrders: unknown[] = [];
    (globalThis as any).__mockDeckImpl = (actor: string, init: any) => {
      seenOrders.push(init.order);
      const ids = init.order === 'newest' ? ['n1'] : init.order === 'oldest' ? ['o1'] : ['s1'];
      return baseDeck({ ids, at: 0, noteId: ids[0], card: card(ids[0]), categories: ['all'], category: 'all' });
    };
    try {
      // Explicit newest wins over stored oldest.
      (globalThis as any).__mockStoredOrder = 'oldest';
      mockParams = { scope: 'all', order: 'newest' };
      let ui = renderScreen();
      await waitFor(() => expect(ui.queryByRole('button', { name: 'Next' })).toBeTruthy());
      expect(ui.queryByText('Loading your notes…')).toBeNull();
      expect(seenOrders).toContain('newest');
      expect(seenOrders[seenOrders.length - 1]).toBe('newest');
      ui.unmount();
      // No param: the stored value is used.
      seenOrders.length = 0;
      (globalThis as any).__mockStoredOrder = 'oldest';
      mockParams = { scope: 'all' };
      ui = renderScreen();
      await waitFor(() => expect(ui.queryByRole('button', { name: 'Next' })).toBeTruthy());
      expect(seenOrders[seenOrders.length - 1]).toBe('oldest');
      ui.unmount();
    } finally {
      (globalThis as any).__mockDeckImpl = undefined;
    }
  });
});

describe('C3 screen: order menu, chips and primaries', () => {
  it('hides Order and chips in loading/empty/error, shows them when populated', async () => {
    (globalThis as any).__mockStoredOrder = 'shuffle';
    // Loading (index undefined).
    mockDeck = baseDeck({ index: { data: undefined, isError: false, isPending: true, isFetching: false, refetch: jest.fn() }, ids: [], noteId: null, card: undefined });
    let ui = renderScreen();
    await waitFor(() => expect(ui.queryByText('Loading your notes…')).toBeTruthy());
    expect(ui.queryByRole('button', { name: 'Order' })).toBeNull();
    expect(ui.queryByTestId('note-deck-chips')).toBeNull();
    ui.unmount();
    // Empty.
    mockDeck = baseDeck({ index: { data: [], isError: false, isPending: false, isFetching: false, refetch: jest.fn() }, ids: [], noteId: null, card: undefined });
    ui = renderScreen();
    await waitFor(() => expect(ui.queryByText('Your notes will show up here.')).toBeTruthy());
    expect(ui.queryByRole('button', { name: 'Order' })).toBeNull();
    expect(ui.queryByTestId('note-deck-chips')).toBeNull();
    expectSinglePrimary(ui as any);
    ui.unmount();
    // Populated.
    mockDeck = baseDeck({ categories: ['all', 'quote'], category: 'all' });
    ui = renderScreen();
    await waitFor(() => expect(ui.queryByRole('button', { name: 'Order' })).toBeTruthy());
    expect(ui.queryByTestId('note-deck-chips')).toBeTruthy();
    expectSinglePrimary(ui as any);
    ui.unmount();
  });

  it('choosing Shuffle writes storage with a new seed; Newest persists; re-choosing active just closes', async () => {
    (globalThis as any).__mockStoredOrder = 'shuffle';
    mockDeck = baseDeck({ categories: ['all'], category: 'all' });
    const ui = renderScreen();
    await waitFor(() => expect(ui.queryByRole('button', { name: 'Order' })).toBeTruthy());
    fireEvent.press(ui.getByRole('button', { name: 'Order' }));
    await waitFor(() => expect(ui.queryByTestId('note-order-backdrop', { includeHiddenElements: true })).toBeTruthy());
    expectSinglePrimary(ui as any);
    const setItem = require('@react-native-async-storage/async-storage').setItem as jest.Mock;
    setItem.mockClear();
    fireEvent.press(ui.getByRole('radio', { name: 'Shuffle' }));
    await waitFor(() => expect(ui.queryByTestId('note-order-backdrop', { includeHiddenElements: true })).toBeNull());
    expect(setItem).toHaveBeenCalledWith(expect.stringContaining('library_noteSwipeOrder'), 'shuffle');
    // Reopen and choose Newest.
    fireEvent.press(ui.getByRole('button', { name: 'Order' }));
    await waitFor(() => expect(ui.queryByTestId('note-order-backdrop', { includeHiddenElements: true })).toBeTruthy());
    setItem.mockClear();
    fireEvent.press(ui.getByRole('radio', { name: 'Newest first' }));
    await waitFor(() => expect(ui.queryByTestId('note-order-backdrop', { includeHiddenElements: true })).toBeNull());
    expect(setItem).toHaveBeenCalledWith(expect.stringContaining('library_noteSwipeOrder'), 'newest');
    ui.unmount();
  });

  it('announces category-qualified positions and hides background while the menu is open', async () => {
    (globalThis as any).__mockStoredOrder = 'shuffle';
    const { AccessibilityInfo } = require('react-native');
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    mockDeck = baseDeck({ ids: ['a', 'b', 'c'], at: 0, noteId: 'a', card: card('a'), categories: ['all', 'quote'], category: 'quote' });
    const ui = renderScreen();
    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.stringContaining('Quote. Note 1 of 3.')));
    spy.mockClear();
    fireEvent.press(ui.getByRole('button', { name: 'Order' }));
    await waitFor(() => expect(ui.queryByTestId('note-order-backdrop', { includeHiddenElements: true })).toBeTruthy());
    const bg = ui.getByTestId('note-swipe-content', { includeHiddenElements: true });
    expect(bg.props['aria-hidden']).toBe(true);
    expect(bg.props.importantForAccessibility).toBe('no-hide-descendants');
    expectSinglePrimary(ui as any);
    ui.unmount();
    spy.mockRestore();
  });

  it('reader-return fallback reflects the current category/order/seed', async () => {
    (globalThis as any).__mockStoredOrder = 'shuffle';
    mockParams = { scope: 'all', order: 'newest', seed: 'seed-9' };
    mockDeck = baseDeck({ ids: ['a'], at: 0, noteId: 'a', card: card('a'), categories: ['all', 'quote'], category: 'quote' });
    const nav = require('@/features/books/notes/noteNavigation');
    (nav.registerNoteContext as jest.Mock).mockClear();
    const ui = renderScreen();
    await waitFor(() => expect(ui.queryByRole('button', { name: 'Read full note' })).toBeTruthy());
    fireEvent.press(ui.getByRole('button', { name: 'Read full note' }));
    await waitFor(() => expect(ui.queryByTestId('note-full-sheet', { includeHiddenElements: true })).toBeTruthy());
    fireEvent.press(ui.getByRole('button', { name: 'Open note' }));
    expect(nav.registerNoteContext).toHaveBeenCalledWith(expect.objectContaining({
      swipe: expect.objectContaining({ category: 'quote', order: 'newest', seed: 'seed-9', noteId: 'a' }),
    }));
    ui.unmount();
  });

  it('ArrowUp switches category and is ignored while the menu is open or on buttons', async () => {
    (Platform as any).OS = 'web';
    const listeners: Array<{ type: string; handler: (e: any) => void }> = [];
    (global as any).window = {
      addEventListener: jest.fn((type: string, handler: (e: any) => void) => { listeners.push({ type, handler }); }),
      removeEventListener: jest.fn((type: string, handler: (e: any) => void) => {
        const at = listeners.findIndex(l => l.type === type && l.handler === handler);
        if (at >= 0) listeners.splice(at, 1);
      }),
    };
    try {
      (globalThis as any).__mockStoredOrder = 'shuffle';
      const seenCategories: unknown[] = [];
      // Live-category mock: category follows the screen's requested category.
      (globalThis as any).__mockDeckImpl = (actor: string, init: any) => {
        seenCategories.push(init.category);
        return baseDeck({ categories: ['all', 'quote'], category: init.category, ids: init.category === 'quote' ? ['q1'] : ['a'], at: 0, noteId: init.category === 'quote' ? 'q1' : 'a', card: card(init.category === 'quote' ? 'q1' : 'a') });
      };
      const ui = renderScreen();
      await waitFor(() => expect(ui.queryByTestId('note-deck-chips')).toBeTruthy());
      const handlers = () => listeners.filter(l => l.type === 'keydown').map(l => l.handler);
      expect(handlers().length).toBeGreaterThan(0);
      const neutral = () => ({ key: 'ArrowUp', target: { closest: () => null }, defaultPrevented: false, preventDefault: jest.fn() });
      const last = () => handlers()[handlers().length - 1];
      // ArrowUp cycles All -> Quote with the real effect.
      act(() => last()({ ...neutral(), key: 'ArrowUp' }));
      await waitFor(() => expect(seenCategories[seenCategories.length - 1]).toBe('quote'));
      await waitFor(() => expect(ui.getByRole('radio', { name: 'Quote' }).props.accessibilityState.checked).toBe(true));
      expect(ui.getByRole('radio', { name: 'All' }).props.accessibilityState.checked).toBe(false);
      await waitFor(() => expect(ui.getByTestId('note-move-announcement').props.children).toContain('Quote. Note 1 of 1.'));
      // Open the Order menu: ArrowUp is now ignored (overlay open).
      fireEvent.press(ui.getByRole('button', { name: 'Order' }));
      await waitFor(() => expect(ui.queryByTestId('note-order-backdrop', { includeHiddenElements: true })).toBeTruthy());
      const countBefore = seenCategories.length;
      // While open, ArrowUp does nothing (no crash, menu stays, no new category).
      for (const h of handlers()) h({ ...neutral(), key: 'ArrowUp' });
      expect(ui.queryByTestId('note-order-backdrop', { includeHiddenElements: true })).toBeTruthy();
      expect(seenCategories.length).toBe(countBefore);
      // Keys on a real button stay ignored.
      const buttonTarget = { closest: (s: string) => (s.includes('button') ? {} : null) };
      for (const h of handlers()) h({ key: 'ArrowUp', target: buttonTarget, defaultPrevented: false, preventDefault: jest.fn() });
      expect(ui.queryByTestId('note-order-backdrop', { includeHiddenElements: true })).toBeTruthy();
      expect(seenCategories.length).toBe(countBefore);
      ui.unmount();
    } finally {
      delete (global as any).window;
      (Platform as any).OS = 'ios';
      (globalThis as any).__mockDeckImpl = undefined;
    }
  });

  it('chip radio keys do not drive the deck (web)', async () => {
    (Platform as any).OS = 'web';
    const listeners: Array<{ type: string; handler: (e: any) => void }> = [];
    (global as any).window = {
      addEventListener: jest.fn((type: string, handler: (e: any) => void) => { listeners.push({ type, handler }); }),
      removeEventListener: jest.fn((type: string, handler: (e: any) => void) => {
        const at = listeners.findIndex(l => l.type === type && l.handler === handler);
        if (at >= 0) listeners.splice(at, 1);
      }),
    };
    try {
      (globalThis as any).__mockStoredOrder = 'shuffle';
      const sharedMove = jest.fn();
      const seenCategories: unknown[] = [];
      (globalThis as any).__mockDeckImpl = (actor: string, init: any) => {
        seenCategories.push(init.category);
        return baseDeck({ categories: ['all', 'quote'], category: init.category, ids: init.category === 'quote' ? ['q1'] : ['a'], at: 0, noteId: init.category === 'quote' ? 'q1' : 'a', card: card(init.category === 'quote' ? 'q1' : 'a'), move: sharedMove });
      };
      const ui = renderScreen();
      await waitFor(() => expect(ui.queryByTestId('note-deck-chips')).toBeTruthy());
      const handlers = () => listeners.filter(l => l.type === 'keydown').map(l => l.handler);
      const last = () => handlers()[handlers().length - 1];
      const neutral = () => ({ key: 'ArrowRight', target: { closest: () => null }, defaultPrevented: false, preventDefault: jest.fn() });
      const chipTarget = { closest: (s: string) => (s.includes('radio') ? {} : null) };
      // ArrowRight with a chip target must not move (only the chip handler acts).
      const movesBefore = sharedMove.mock.calls.length;
      const catsBefore = seenCategories.length;
      act(() => last()({ key: 'ArrowRight', target: chipTarget, defaultPrevented: false, preventDefault: jest.fn() }));
      expect(sharedMove.mock.calls.length).toBe(movesBefore);
      expect(seenCategories.length).toBe(catsBefore);
      // Positive control: same key on the card surface moves.
      act(() => last()({ ...neutral(), key: 'ArrowRight' }));
      expect(sharedMove).toHaveBeenCalledWith('next');
      // ArrowUp with a chip target must not cycle category.
      sharedMove.mockClear();
      const catsBeforeUp = seenCategories.length;
      act(() => last()({ key: 'ArrowUp', target: chipTarget, defaultPrevented: false, preventDefault: jest.fn() }));
      expect(seenCategories.length).toBe(catsBeforeUp);
      // Positive control: ArrowUp on the surface cycles to quote.
      act(() => last()({ key: 'ArrowUp', target: { closest: () => null }, defaultPrevented: false, preventDefault: jest.fn() }));
      await waitFor(() => expect(seenCategories[seenCategories.length - 1]).toBe('quote'));
      ui.unmount();
    } finally {
      delete (global as any).window;
      (Platform as any).OS = 'ios';
      (globalThis as any).__mockDeckImpl = undefined;
    }
  });

  it('returns focus to Order after the menu closes and to Read after the sheet closes', async () => {
    const previousWindow = (global as any).window;
    (global as any).window = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
    const priorOS = (Platform as any).OS;
    (Platform as any).OS = 'web';
    jest.useFakeTimers();
    mockParams = { scope: 'all', order: 'shuffle' };
    try {
      (globalThis as any).__mockStoredOrder = 'shuffle';
      mockDeck = baseDeck({ categories: ['all'], category: 'all' });
      (globalThis as any).__bookButtonFocusMocks = {};
      const ui = renderScreen();
      expect(ui.queryByRole('button', { name: 'Order' })).toBeTruthy();
      const mocks = () => (globalThis as any).__bookButtonFocusMocks as Record<string, jest.Mock>;
      // Order menu -> Close focuses Order, not Read.
      fireEvent.press(ui.getByRole('button', { name: 'Order' }));
      expect(ui.queryByTestId('note-order-backdrop', { includeHiddenElements: true })).toBeTruthy();
      mocks()['Order']?.mockClear?.();
      mocks()['Read full note']?.mockClear?.();
      fireEvent.press(ui.getByRole('button', { name: 'Close' }));
      expect(ui.queryByTestId('note-order-backdrop', { includeHiddenElements: true })).toBeNull();
      expect(mocks()['Order']).toBeDefined();
      expect(mocks()['Order']).toHaveBeenCalled();
      expect(mocks()['Read full note']?.mock.calls.length ?? 0).toBe(0);
      // Cooldown (400 ms) blocks the stack's run() after the menu closes; wait it out.
      await act(async () => { await jest.advanceTimersByTimeAsync(400); });
      // Full-note sheet -> Close focuses Read, not Order.
      mocks()['Order']?.mockClear?.();
      mocks()['Read full note']?.mockClear?.();
      fireEvent.press(ui.getByRole('button', { name: 'Read full note' }));
      expect(ui.queryByTestId('note-full-sheet', { includeHiddenElements: true })).toBeTruthy();
      fireEvent.press(ui.getByRole('button', { name: 'Close full note' }));
      expect(ui.queryByTestId('note-full-sheet', { includeHiddenElements: true })).toBeNull();
      expect(mocks()['Read full note']).toBeDefined();
      expect(mocks()['Read full note']).toHaveBeenCalled();
      ui.unmount();
    } finally {
      (global as any).window = previousWindow;
      jest.useRealTimers();
      (Platform as any).OS = priorOS;
    }
  });

  it('focuses Order after the menu closes on the end card (Read hidden)', async () => {
    const priorOS = (Platform as any).OS;
    (Platform as any).OS = 'web';
    try {
      (globalThis as any).__mockStoredOrder = 'shuffle';
      mockDeck = baseDeck({ ids: ['a'], at: 1, noteId: null, card: undefined, index: { data: [{ id: 'a' }], isError: false, isPending: false, isFetching: false, refetch: jest.fn() }, categories: ['all'], category: 'all' });
      (globalThis as any).__bookButtonFocusMocks = {};
      const ui = renderScreen();
      await waitFor(() => expect(ui.queryByTestId('note-end-heading', { includeHiddenElements: true })).toBeTruthy());
      expect(ui.queryByRole('button', { name: 'Read full note' })).toBeNull();
      fireEvent.press(ui.getByRole('button', { name: 'Order' }));
      await waitFor(() => expect(ui.queryByTestId('note-order-backdrop', { includeHiddenElements: true })).toBeTruthy());
      const mocks = () => (globalThis as any).__bookButtonFocusMocks as Record<string, jest.Mock>;
      mocks()['Order']?.mockClear?.();
      fireEvent.press(ui.getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(ui.queryByTestId('note-order-backdrop', { includeHiddenElements: true })).toBeNull());
      await waitFor(() => expect(mocks()['Order']).toBeDefined());
      expect(mocks()['Order']).toHaveBeenCalled();
      ui.unmount();
    } finally {
      (Platform as any).OS = priorOS;
    }
  });

  it('delivers new Shuffle seeds to the deck and reader fallback, preserves them for Newest/Oldest and reader return', async () => {
    jest.useFakeTimers();
    mockParams = { scope: 'all', order: 'shuffle', seed: 'seed-9' };
    let latest: any;
    (globalThis as any).__mockDeckImpl = (_actor: string, initial: any) => { latest = initial; return baseDeck(); };
    const nav = require('@/features/books/notes/noteNavigation');
    const actualNav = jest.requireActual('@/features/books/notes/noteNavigation');
    nav.registerNoteContext.mockImplementation(actualNav.registerNoteContext);
    nav.readerHref.mockImplementation(actualNav.readerHref);
    let ui = renderScreen();
    try {
      expect(latest.seed).toBe('seed-9');
      const setItem = require('@react-native-async-storage/async-storage').setItem as jest.Mock;
      const readerFallback = async (expectedOrder: string, expectedSeed: string) => {
        await act(async () => { await jest.advanceTimersByTimeAsync(400); });
        fireEvent.press(ui.getByRole('button', { name: 'Read full note' }));
        fireEvent.press(ui.getByRole('button', { name: 'Open note' }));
        const href = mockRouter.push.mock.calls.at(-1)![0] as any;
        expect(href.params.swipeSeed).toBe(expectedSeed);
        expect(href.params.swipeOrder).toBe(expectedOrder);
        return href;
      };
      let previous = latest.seed;
      for (const name of ['Shuffle', 'Shuffle', 'Newest first', 'Oldest first']) {
        fireEvent.press(ui.getByRole('button', { name: 'Order' }));
        fireEvent.press(ui.getByRole('radio', { name }));
        expect(ui.queryByTestId('note-order-backdrop', { includeHiddenElements: true })).toBeNull();
        const order = name === 'Shuffle' ? 'shuffle' : name === 'Newest first' ? 'newest' : 'oldest';
        expect(latest.order).toBe(order);
        if (name === 'Shuffle') expect(latest.seed).not.toBe(previous);
        else expect(latest.seed).toBe(previous);
        expect(setItem).toHaveBeenLastCalledWith(expect.stringContaining('library_noteSwipeOrder'), order);
        previous = latest.seed;
        const reader = await readerFallback(order, previous);
        // Use the real reload-style return path, then mount the returned screen.
        const context = actualNav.noteRouteContext(undefined, 'actor', 'b', reader.params);
        actualNav.returnFromNote(mockRouter, context, { getState: () => ({ index: 0, routes: [] }) });
        const returned = mockRouter.replace.mock.calls.at(-1)![0] as any;
        expect(returned.params).toMatchObject({ seed: previous, order });
        ui.unmount();
        mockParams = returned.params;
        ui = renderScreen();
        expect(latest.seed).toBe(previous);
        expect(latest.order).toBe(order);
      }
    } finally {
      ui.unmount();
      nav.registerNoteContext.mockReset().mockReturnValue('ctx');
      nav.readerHref.mockReset().mockReturnValue({});
      jest.useRealTimers();
    }
  });

  it('tapping chips switches category and restores the first category card', async () => {
    (globalThis as any).__mockStoredOrder = 'shuffle';
    const seenCategories: unknown[] = [];
    (globalThis as any).__mockDeckImpl = (actor: string, init: any) => {
      seenCategories.push(init.category);
      const isQuote = init.category === 'quote';
      return baseDeck({ categories: ['all', 'quote'], category: init.category, ids: isQuote ? ['q1'] : ['a1'], at: 0, noteId: isQuote ? 'q1' : 'a1', card: card(isQuote ? 'q1' : 'a1') });
    };
    try {
      const ui = renderScreen();
      await waitFor(() => expect(ui.queryByTestId('note-deck-chips')).toBeTruthy());
      expect(ui.getByRole('radio', { name: 'All' }).props.accessibilityState.checked).toBe(true);
      fireEvent.press(ui.getByRole('radio', { name: 'Quote' }));
      await waitFor(() => expect(seenCategories[seenCategories.length - 1]).toBe('quote'));
      await waitFor(() => expect(ui.getByRole('radio', { name: 'Quote' }).props.accessibilityState.checked).toBe(true));
      fireEvent.press(ui.getByRole('radio', { name: 'All' }));
      await waitFor(() => expect(seenCategories[seenCategories.length - 1]).toBe('all'));
      await waitFor(() => expect(ui.getByRole('radio', { name: 'All' }).props.accessibilityState.checked).toBe(true));
      ui.unmount();
    } finally {
      (globalThis as any).__mockDeckImpl = undefined;
    }
  });

  it('ArrowUp on the end card cycles category without crashing', async () => {
    (Platform as any).OS = 'web';
    const listeners: Array<{ type: string; handler: (e: any) => void }> = [];
    (global as any).window = {
      addEventListener: jest.fn((type: string, handler: (e: any) => void) => { listeners.push({ type, handler }); }),
      removeEventListener: jest.fn((type: string, handler: (e: any) => void) => {
        const at = listeners.findIndex(l => l.type === type && l.handler === handler);
        if (at >= 0) listeners.splice(at, 1);
      }),
    };
    const seenCategories: unknown[] = [];
    (globalThis as any).__mockDeckImpl = (actor: string, init: any) => {
      seenCategories.push(init.category);
      if (init.category === 'quote') {
        return baseDeck({ categories: ['all', 'quote'], category: 'quote', ids: ['q1'], at: 0, noteId: 'q1', card: card('q1') });
      }
      return baseDeck({ categories: ['all', 'quote'], category: 'all', ids: ['a'], at: 1, noteId: null, card: undefined, index: { data: [{ id: 'a' }], isError: false, isPending: false, isFetching: false, refetch: jest.fn() } });
    };
    try {
      (globalThis as any).__mockStoredOrder = 'shuffle';
      const ui = renderScreen();
      await waitFor(() => expect(ui.queryByTestId('note-end-heading', { includeHiddenElements: true })).toBeTruthy());
      const handlers = () => listeners.filter(l => l.type === 'keydown').map(l => l.handler);
      const last = () => handlers()[handlers().length - 1];
      expect(handlers().length).toBeGreaterThan(0);
      act(() => last()({ key: 'ArrowUp', target: { closest: () => null }, defaultPrevented: false, preventDefault: jest.fn() }));
      await waitFor(() => expect(seenCategories[seenCategories.length - 1]).toBe('quote'));
      await waitFor(() => expect(ui.queryByTestId('note-end-heading', { includeHiddenElements: true })).toBeNull());
      ui.unmount();
    } finally {
      delete (global as any).window;
      (Platform as any).OS = 'ios';
      (globalThis as any).__mockDeckImpl = undefined;
    }
  });

  it('Android back closes the Order menu first without leaving, second back leaves', async () => {
    const priorOS = (Platform as any).OS;
    (Platform as any).OS = 'android';
    const RN = require('react-native');
    const backHandlers: Array<(e?: unknown) => boolean> = [];
    const addSpy = jest.spyOn(RN.BackHandler, 'addEventListener').mockImplementation((...args: unknown[]) => {
      const [event, handler] = args as [string, (e?: unknown) => boolean];
      if (event === 'hardwareBackPress') backHandlers.push(handler);
      return { remove: jest.fn() } as unknown as { remove: () => void };
    });
    try {
      (globalThis as any).__mockStoredOrder = 'shuffle';
      mockDeck = baseDeck({ categories: ['all'], category: 'all' });
      mockRouter.back.mockClear();
      mockRouter.replace.mockClear();
      const ui = renderScreen();
      await waitFor(() => expect(ui.queryByRole('button', { name: 'Order' })).toBeTruthy());
      expect(backHandlers.length).toBeGreaterThan(0);
      const pressBack = () => (act(() => { backHandlers[backHandlers.length - 1](); }) as unknown);
      fireEvent.press(ui.getByRole('button', { name: 'Order' }));
      await waitFor(() => expect(ui.queryByTestId('note-order-backdrop', { includeHiddenElements: true })).toBeTruthy());
      pressBack();
      expect(ui.queryByTestId('note-order-backdrop', { includeHiddenElements: true })).toBeNull();
      expect(mockRouter.back).not.toHaveBeenCalled();
      expect(mockRouter.replace).not.toHaveBeenCalled();
      pressBack();
      expect(mockRouter.back).toHaveBeenCalledTimes(1);
      ui.unmount();
    } finally {
      addSpy.mockRestore();
      (Platform as any).OS = priorOS;
    }
  });

  it('keeps the category param while the index loads instead of falling back to All (G2)', async () => {
    (globalThis as any).__mockStoredOrder = 'shuffle';
    mockParams = { scope: 'all', category: 'distill' };
    const seenCategories: unknown[] = [];
    (globalThis as any).__mockDeckImpl = (actor: string, init: any) => {
      seenCategories.push(init.category);
      return baseDeck({
        index: { data: undefined, isError: false, isPending: true, isFetching: false, refetch: jest.fn() },
        ids: [],
        at: 0,
        noteId: null,
        card: undefined,
        categories: ['all'],
        category: 'all',
      });
    };
    try {
      const ui = renderScreen();
      await waitFor(() => expect(ui.queryByText('Loading your notes…')).toBeTruthy());
      await act(async () => {});
      expect(seenCategories[0]).toBe('distill');
      expect(seenCategories[seenCategories.length - 1]).toBe('distill');
      ui.unmount();
    } finally {
      (globalThis as any).__mockDeckImpl = undefined;
    }
  });

  it('hides chips and Order in the error state and cools the deck down after the menu closes', async () => {
    // Real timers for the AsyncStorage-gated load phases; fake timers only for
    // the 400 ms cooldown, with explicit promise flushing and no waitFor while fake.
    (globalThis as any).__mockStoredOrder = 'shuffle';
    mockDeck = baseDeck({ index: { data: undefined, isError: true, isPending: false, isFetching: false, refetch: jest.fn() }, ids: [], noteId: null, card: undefined });
    let ui = renderScreen();
    await waitFor(() => expect(ui.queryByText('Couldn\'t load your notes.')).toBeTruthy());
    expect(ui.queryByRole('button', { name: 'Order' })).toBeNull();
    expect(ui.queryByTestId('note-deck-chips')).toBeNull();
    expectSinglePrimary(ui as any);
    ui.unmount();
    // Cooldown: after the menu closes the deck ignores Next for 400ms.
    mockDeck = baseDeck({ categories: ['all'], category: 'all', move: jest.fn() });
    ui = renderScreen();
    await waitFor(() => expect(ui.queryByRole('button', { name: 'Order' })).toBeTruthy());
    fireEvent.press(ui.getByRole('button', { name: 'Order' }));
    await waitFor(() => expect(ui.queryByTestId('note-order-backdrop', { includeHiddenElements: true })).toBeTruthy());
    jest.useFakeTimers();
    try {
      fireEvent.press(ui.getByRole('radio', { name: 'Newest first' }));
      await act(async () => { await jest.advanceTimersByTimeAsync(0); });
      expect(ui.queryByTestId('note-order-backdrop', { includeHiddenElements: true })).toBeNull();
      const move = mockDeck.move as jest.Mock;
      move.mockClear();
      fireEvent.press(ui.getByRole('button', { name: 'Next' }));
      expect(move).not.toHaveBeenCalled();
      await act(async () => { await jest.advanceTimersByTimeAsync(500); });
      fireEvent.press(ui.getByRole('button', { name: 'Next' }));
      expect(move).toHaveBeenCalledWith('next');
    } finally {
      jest.useRealTimers();
    }
    ui.unmount();
  });
});
