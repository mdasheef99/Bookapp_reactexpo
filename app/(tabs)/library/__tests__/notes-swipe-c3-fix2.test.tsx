import React from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) };
const mockRoute = { key: 'swipe-key' };
let mockParams: Record<string, string> = { scope: 'all' };
let mockBook: any = { data: undefined, isError: false, isPending: false, error: null, refetch: jest.fn() };
let mockDeck: any = null;
let mockNetwork: any = { isOffline: false };
let mockReduced = false;
let mockHint = false;
let mockStoredOrder: string | null = null;
let mockSeedCounter = 0;

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
type MockPanCallbacks = { onStart?: (e: any) => void; onUpdate?: (e: any) => void; onEnd?: (e: any) => void; onFinalize?: (e: any) => void };
const mockPanCallbacks: MockPanCallbacks[] = [];
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  const makePan = () => {
    const store: MockPanCallbacks = {};
    mockPanCallbacks.push(store);
    const g: Record<string, jest.Mock> = {};
    for (const name of ['enabled', 'minDistance', 'maxDistance', 'maxDuration', 'runOnJS']) g[name] = jest.fn(() => g);
    g.onStart = jest.fn((cb: any) => { store.onStart = cb; return g; });
    g.onUpdate = jest.fn((cb: any) => { store.onUpdate = cb; return g; });
    g.onEnd = jest.fn((cb: any) => { store.onEnd = cb; return g; });
    g.onFinalize = jest.fn((cb: any) => { store.onFinalize = cb; return g; });
    return g;
  };
  const chainable = () => {
    const g: Record<string, jest.Mock> = {};
    for (const name of ['enabled', 'minDistance', 'maxDistance', 'maxDuration', 'runOnJS']) g[name] = jest.fn(() => g);
    for (const name of ['onStart', 'onUpdate', 'onEnd', 'onFinalize']) g[name] = jest.fn(() => g);
    return g;
  };
  return {
    Gesture: {
      Pan: jest.fn(() => makePan()),
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
    return React.createElement(
      Pressable,
      { accessibilityRole: (rest as any).accessibilityRole ?? 'button', accessibilityLabel: name, testID, disabled, onPress, accessibilityState: { disabled } },
      React.createElement(Text, null, label),
    );
  }
  return { BookButton: MockBookButton };
});

import NotesSwipeScreen from '../notes-swipe';
import { BookFeedbackProvider } from '@/components/library/ui';
import { NOTE_SWIPE } from '@/features/books/notes/noteSwipeConstants';

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

type TimingCall = { value: any; opts: any; cb: any };
let timingCalls: TimingCall[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  (globalThis as any).__bookButtonFocusMocks = {};
  (globalThis as any).__mockStoredOrder = mockStoredOrder;
  (globalThis as any).__mockSetItemCalls = [];
  const Reanimated = require('react-native-reanimated');
  jest.spyOn(Reanimated, 'useSharedValue').mockImplementation((initial: unknown) => {
    const ref = jest.requireActual('react').useRef(null);
    if (!ref.current) ref.current = { value: initial };
    return ref.current;
  });
  timingCalls = [];
  jest.spyOn(Reanimated, 'withTiming').mockImplementation((value: any, opts?: any, cb?: any) => {
    timingCalls.push({ value, opts, cb });
    return value;
  });
  jest.spyOn(Reanimated, 'withSpring').mockImplementation((value: any) => value);
  jest.spyOn(Reanimated, 'withSequence').mockImplementation((...args: any[]) => args[args.length - 1]);
  mockPanCallbacks.length = 0;
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

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

function lastGestureFlight(): TimingCall | undefined {
  const flights = timingCalls.filter(c =>
    typeof c.cb === 'function' &&
    (c.opts?.duration === NOTE_SWIPE.exitMs || c.opts?.duration === NOTE_SWIPE.crossFadeMs));
  return flights[flights.length - 1];
}

describe('C3-fix2 G3: chips and ArrowUp respect the flight gate', () => {
  it('chip tap mid-flight is ignored, a later one works, in-flight swipe completes once', async () => {
    (globalThis as any).__mockStoredOrder = 'shuffle';
    const seenCategories: unknown[] = [];
    const sharedMove = jest.fn();
    (globalThis as any).__mockDeckImpl = (actor: string, init: any) => {
      seenCategories.push(init.category);
      const isQuote = init.category === 'question';
      return baseDeck({
        categories: ['all', 'quote', 'question'],
        category: init.category,
        ids: isQuote ? ['q1'] : ['a1', 'a2'],
        at: 0,
        noteId: isQuote ? 'q1' : 'a1',
        card: card(isQuote ? 'q1' : 'a1'),
        move: sharedMove,
      });
    };
    try {
      const ui = renderScreen();
      await waitFor(() => expect(ui.queryByTestId('note-deck-chips')).toBeTruthy());
      const pan = () => mockPanCallbacks.find(p => p.onStart && p.onUpdate && p.onEnd)!;
      expect(pan().onEnd).toEqual(expect.any(Function));
      act(() => {
        pan().onStart!({} as any);
        pan().onUpdate!({ translationX: -60, translationY: 0 } as any);
        pan().onEnd!({ translationX: -60, translationY: 0, velocityX: -900, velocityY: 0 } as any);
      });
      expect(sharedMove).not.toHaveBeenCalled();
      expect(lastGestureFlight()?.cb).toEqual(expect.any(Function));
      const catsBefore = seenCategories.length;
      fireEvent.press(ui.getByRole('radio', { name: 'Question' }));
      expect(seenCategories.length).toBe(catsBefore);
      const flight = lastGestureFlight()!;
      act(() => {
        flight.cb(true);
      });
      expect(sharedMove).toHaveBeenCalledTimes(1);
      expect(sharedMove).toHaveBeenCalledWith('next');
      // Selecting the current category does not start an animation.
      const beforeSelected = timingCalls.length;
      fireEvent.press(ui.getByRole('radio', { name: 'All' }));
      expect(timingCalls).toHaveLength(beforeSelected);
      fireEvent.press(ui.getByRole('radio', { name: 'Question' }));
      expect(seenCategories[seenCategories.length - 1]).toBe('all');
      const categoryFlight = lastGestureFlight()!;
      expect(categoryFlight).not.toBe(flight);
      expect(categoryFlight.value).toBeLessThan(0);
      const beforeTap = timingCalls.length;
      fireEvent.press(ui.getByRole('radio', { name: 'Question' }));
      expect(timingCalls).toHaveLength(beforeTap);
      act(() => categoryFlight.cb(false));
      expect(seenCategories[seenCategories.length - 1]).toBe('all');
      fireEvent.press(ui.getByRole('radio', { name: 'Question' }));
      const retry = lastGestureFlight()!;
      act(() => { categoryFlight.cb(true); retry.cb(true); retry.cb(true); });
      await waitFor(() => expect(seenCategories[seenCategories.length - 1]).toBe('question'));
      await waitFor(() => expect(ui.getByRole('radio', { name: 'Question' }).props.accessibilityState.checked).toBe(true));
      ui.unmount();
    } finally {
      (globalThis as any).__mockDeckImpl = undefined;
    }
  });

  it('ArrowUp mid-flight is ignored, a later one works, in-flight swipe completes once', async () => {
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
      const sharedMove = jest.fn();
      (globalThis as any).__mockDeckImpl = (actor: string, init: any) => {
        seenCategories.push(init.category);
        const isQuote = init.category === 'quote';
        return baseDeck({
          categories: ['all', 'quote'],
          category: init.category,
          ids: isQuote ? ['q1'] : ['a1', 'a2'],
          at: 0,
          noteId: isQuote ? 'q1' : 'a1',
          card: card(isQuote ? 'q1' : 'a1'),
          move: sharedMove,
        });
      };
      const ui = renderScreen();
      await waitFor(() => expect(ui.queryByTestId('note-deck-chips')).toBeTruthy());
      const handlers = () => listeners.filter(l => l.type === 'keydown').map(l => l.handler);
      expect(handlers().length).toBeGreaterThan(0);
      const last = () => handlers()[handlers().length - 1];
      const pan = () => mockPanCallbacks.find(p => p.onStart && p.onUpdate && p.onEnd)!;
      act(() => {
        pan().onStart!({} as any);
        pan().onUpdate!({ translationX: -60, translationY: 0 } as any);
        pan().onEnd!({ translationX: -60, translationY: 0, velocityX: -900, velocityY: 0 } as any);
      });
      expect(sharedMove).not.toHaveBeenCalled();
      const catsBefore = seenCategories.length;
      const neutral = { key: 'ArrowUp', target: { closest: () => null }, defaultPrevented: false, preventDefault: jest.fn() };
      act(() => last()({ ...neutral }));
      expect(seenCategories.length).toBe(catsBefore);
      const flight = lastGestureFlight()!;
      act(() => {
        flight.cb(true);
      });
      expect(sharedMove).toHaveBeenCalledTimes(1);
      act(() => last()({ ...neutral, preventDefault: jest.fn() }));
      expect(seenCategories[seenCategories.length - 1]).toBe('all');
      const categoryFlight = lastGestureFlight()!;
      expect(categoryFlight).not.toBe(flight);
      act(() => categoryFlight.cb(false));
      expect(seenCategories[seenCategories.length - 1]).toBe('all');
      act(() => last()({ ...neutral, preventDefault: jest.fn() }));
      const retry = lastGestureFlight()!;
      act(() => { retry.cb(true); retry.cb(true); });
      await waitFor(() => expect(seenCategories[seenCategories.length - 1]).toBe('quote'));
      ui.unmount();
    } finally {
      delete (global as any).window;
      (Platform as any).OS = 'ios';
      (globalThis as any).__mockDeckImpl = undefined;
    }
  });
});
