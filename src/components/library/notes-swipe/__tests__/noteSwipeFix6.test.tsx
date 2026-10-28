jest.mock('@/features/books/organising/useOrganising', () => ({ useOrganising: () => ({ entities: { data: [] }, members: { data: [] }, refresh: jest.fn() }) }));
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { NoteSwipeStack } from '../NoteSwipeStack';
import { NOTE_SWIPE } from '@/features/books/notes/noteSwipeConstants';
import type { NoteDeckCard } from '@/features/books/notes/manualNoteContract';

jest.mock('@/hooks/useTheme', () => ({ useTheme: jest.fn(() => ({ phase: 'daylight' })) }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
let mockScreenDeck: any = null;
let mockScreenRouter: any = { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ order: 'shuffle' }),
  useRouter: () => (globalThis as any).__mockScreenRouter ?? { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() },
  useRoute: () => ({ key: 'swipe' }),
}));
jest.mock('@react-navigation/native', () => ({ useRoute: () => ({ key: 'swipe' }), useIsFocused: () => true }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'seed' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 10, bottom: 10, left: 0, right: 0 }) }));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOffline: false }) }));
jest.mock('@/features/books/notes/useManualNotes', () => ({ useNoteContext: () => ({ actorId: 'actor', book: {} }) }));
jest.mock('@/features/books/notes/useNoteDeck', () => ({ useNoteDeck: () => (globalThis as any).__mockScreenDeck }));
jest.mock('../useNoteSwipeMotion', () => ({ useReducedNoteMotion: () => false, useNoteSwipeHint: () => false }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(() => Promise.resolve()), ImpactFeedbackStyle: { Light: 'Light' } }));
type BridgeCall = { fn: (...args: any[]) => void; args: any[] };
let mockDeferredBridge = false;
const mockBridgeQueue: BridgeCall[] = [];
const mockUIQueue: Array<() => void> = [];
const mockScheduleOnRN = jest.fn((fn: (...a: any[]) => void, ...args: any[]) => {
  if (mockDeferredBridge) mockBridgeQueue.push({ fn, args });
  else fn(...args);
});
jest.mock('react-native-worklets', () => {
  const actual = jest.requireActual('react-native-worklets');
  return { ...actual, scheduleOnRN: (...args: any[]) => (mockScheduleOnRN as any)(...args),
    scheduleOnUI: (fn: () => void) => mockUIQueue.push(fn) };
});

type MockPanCallbacks = { onStart?: (e: any) => void; onUpdate?: (e: any) => void; onEnd?: (e: any) => void; onFinalize?: (e: any) => void };
const mockPanCallbacks: MockPanCallbacks[] = [];
const mockTapCallbacks: Array<(e: any, success: boolean) => void> = [];
const mockExclusiveCalls: unknown[][] = [];
let mockPanInstances: Record<string, jest.Mock>[] = [];
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const makeChainable = (store: any, isPan: boolean) => {
    const gesture: Record<string, jest.Mock> = {};
    for (const name of ['enabled', 'minDistance', 'maxDistance', 'maxDuration', 'numberOfTaps', 'maxDelay', 'runOnJS']) gesture[name] = jest.fn(() => gesture);
    gesture.onStart = jest.fn((cb: any) => { if (isPan) store.onStart = cb; return gesture; });
    gesture.onUpdate = jest.fn((cb: any) => { if (isPan) store.onUpdate = cb; return gesture; });
    gesture.onEnd = jest.fn((cb: any) => { if (isPan) store.onEnd = cb; else mockTapCallbacks.push(cb); return gesture; });
    gesture.onFinalize = jest.fn((cb: any) => { if (isPan) store.onFinalize = cb; return gesture; });
    return gesture;
  };
  return {
    Gesture: {
      Pan: jest.fn(() => { const store: any = {}; mockPanCallbacks.push(store); const g = makeChainable(store, true); mockPanInstances.push(g); return g; }),
      Tap: jest.fn(() => makeChainable({}, false)),
      Native: jest.fn(() => makeChainable({}, true)),
      Simultaneous: jest.fn((...args: unknown[]) => args[0]),
      Exclusive: jest.fn((...args: unknown[]) => { mockExclusiveCalls.push(args); return args[0]; }),
    },
    GestureDetector: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    GestureHandlerRootView: ({ children, ...props }: any) => {
      const { View: RNView } = require('react-native');
      return React.createElement(RNView, props, children);
    },
  };
});

function mockCard(id = 'note-1'): NoteDeckCard {
  return {
    note: { id, user_id: 'actor', user_book_id: 'book-1', content: 'A calm note body.', tag: null, page_number: null, created_at: '2026-10-20T00:00:00Z', updated_at: null },
    book: { id: 'book-1', title: 'Hooked', authors: ['Nir Eyal'], cover_url: null },
  };
}

function stackProps(over: Partial<React.ComponentProps<typeof NoteSwipeStack>> = {}) {
  return {
    card: mockCard(),
    undercards: [],
    at: 0,
    total: 2,
    reduced: false,
    hint: false,
    enabled: true,
    onMove: jest.fn(),
    onRead: jest.fn(),
    onLeave: jest.fn(),
    ...over,
  } as React.ComponentProps<typeof NoteSwipeStack>;
}

const Reanimated = require('react-native-reanimated');
type TimingCall = { value: any; opts: any; cb: any };
let timingCalls: TimingCall[] = [];
let stableSV: any[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  mockPanCallbacks.length = 0;
  mockTapCallbacks.length = 0;
  mockExclusiveCalls.length = 0;
  mockPanInstances = [];
  timingCalls = [];
  stableSV = [];
  mockDeferredBridge = false;
  mockBridgeQueue.length = 0;
  mockUIQueue.length = 0;
  mockScheduleOnRN.mockClear();
  jest.useRealTimers();
  (Platform as { OS: string }).OS = 'ios';
  const ReactForSV = require('react') as typeof React;
  jest.spyOn(Reanimated, 'useSharedValue').mockImplementation((initial: any) => {
    const ref = (ReactForSV as any).useRef(null) as { current: { value: any } | null };
    if (ref.current === null) {
      ref.current = { value: initial };
      stableSV.push(ref.current);
    }
    return ref.current;
  });
  jest.spyOn(Reanimated, 'withTiming').mockImplementation((value: any, opts?: any, cb?: any) => {
    timingCalls.push({ value, opts, cb });
    return value;
  });
  jest.spyOn(Reanimated, 'withSpring').mockImplementation((value: any) => value);
  jest.spyOn(Reanimated, 'withSequence').mockImplementation((...args: any[]) => args[args.length - 1]);
});

function deliver(call: BridgeCall) {
  act(() => call.fn(...call.args));
}

function drainBridge() {
  while (mockBridgeQueue.length) deliver(mockBridgeQueue.shift()!);
}

describe('round 7 deferred UI-to-JS flight delivery', () => {
  // These tests retain callbacks after cancellation and independently drain the
  // RN queue. Re-running an animation callback alone cannot exercise the JS fence.
  it.each(['start', 'completion'] as const)('rejects a stale %s after resize and a newer flight', pending => {
    jest.useFakeTimers();
    mockDeferredBridge = true;
    const RN = require('react-native');
    let dims = { width: 390, height: 844, scale: 1, fontScale: 1 };
    jest.spyOn(RN, 'useWindowDimensions').mockImplementation(() => dims);
    const onMove = jest.fn(); const onRead = jest.fn();
    const props = stackProps({ at: 1, total: 5, onMove, onRead });
    const ui = render(<NoteSwipeStack {...props} />);
    const pan = () => mockPanCallbacks[mockPanCallbacks.length - 1];
    swipeNext(pan());
    const oldAnimation = lastGestureFlight()!;
    if (pending === 'completion') {
      deliver(mockBridgeQueue.shift()!);
      act(() => oldAnimation.cb(false));
    }
    const obsolete = mockBridgeQueue.shift()!;
    dims = { ...dims, width: 360 };
    ui.rerender(<NoteSwipeStack {...props} />);
    swipeNext(pan());
    const newAnimation = lastGestureFlight()!;
    deliver(mockBridgeQueue.shift()!);
    // Deliver obsolete bridge work while the newer flight is active.
    if (pending === 'completion') deliver(obsolete);
    expect(onMove).not.toHaveBeenCalled();
    pressNext(ui);
    expect(onMove).not.toHaveBeenCalled();
    act(() => newAnimation.cb(true));
    drainBridge();
    expect(onMove).toHaveBeenCalledTimes(1);
    if (pending === 'start') deliver(obsolete);
    pressNext(ui);
    expect(onMove).toHaveBeenCalledTimes(2);
    // An old animation completing after the new start must not even enqueue a
    // completion for the new flight (the UI generation is independent of idle).
    const scheduled = mockScheduleOnRN.mock.calls.length;
    act(() => oldAnimation.cb(true));
    expect(mockScheduleOnRN).toHaveBeenCalledTimes(scheduled);
    drainBridge();
    swipeNext(pan()); completeLastFlight(); drainBridge();
    expect(onMove).toHaveBeenCalledTimes(3);
    pressNext(ui); pressRead(ui);
    expect(onMove).toHaveBeenCalledTimes(4);
    expect(onRead).toHaveBeenCalledTimes(1);
    expectIdleShared();
  });

  it('fences queued duplicate completions in JS while another flight owns the UI', () => {
    mockDeferredBridge = true;
    const onMove = jest.fn(); const onRead = jest.fn();
    const ui = render(<NoteSwipeStack {...stackProps({ at: 1, total: 5, onMove, onRead })} />);
    const pan = mockPanCallbacks[mockPanCallbacks.length - 1];
    swipeNext(pan); drainBridge();
    const first = lastGestureFlight()!;
    act(() => { first.cb(false); first.cb(true); });
    expect(mockBridgeQueue).toHaveLength(2);
    deliver(mockBridgeQueue.shift()!);
    expect(onMove).not.toHaveBeenCalled();
    const duplicate = mockBridgeQueue.shift()!;
    swipeNext(pan); drainBridge();
    deliver(duplicate);
    expect(onMove).not.toHaveBeenCalled();
    completeLastFlight(); drainBridge();
    expect(onMove).toHaveBeenCalledTimes(1);
    swipeNext(pan); completeLastFlight(); drainBridge();
    pressNext(ui); pressRead(ui);
    expect(onMove).toHaveBeenCalledTimes(3);
    expect(onRead).toHaveBeenCalledTimes(1);
    expectIdleShared();
  });

  it('keeps generations distinct when a cancelled Next callback arrives during leave', () => {
    mockDeferredBridge = true;
    const onMove = jest.fn(); const onLeave = jest.fn();
    const props = stackProps({ at: 1, onMove, onLeave });
    const ui = render(<NoteSwipeStack {...props} />);
    swipeNext(mockPanCallbacks[mockPanCallbacks.length - 1]); drainBridge();
    const obsoleteAnimation = lastGestureFlight()!;
    ui.rerender(<NoteSwipeStack {...props} reduced />);
    const pan = mockPanCallbacks[mockPanCallbacks.length - 1];
    pan.onStart!({});
    pan.onEnd!({ translationX: 0, translationY: 300, velocityX: 0, velocityY: 900 });
    drainBridge();
    const leaveAnimation = lastGestureFlight()!;
    const scheduled = mockScheduleOnRN.mock.calls.length;
    act(() => obsoleteAnimation.cb(false));
    expect(mockScheduleOnRN).toHaveBeenCalledTimes(scheduled);
    drainBridge();
    expect(onMove).not.toHaveBeenCalled();
    act(() => leaveAnimation.cb(true)); drainBridge();
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});

describe('round 7 first-visit hint ownership', () => {
  it('wiggles only once across card changes in a visit', () => {
    const sequence = jest.spyOn(Reanimated, 'withSequence');
    const props = stackProps({ hint: true });
    const ui = render(<NoteSwipeStack {...props} />);
    act(() => { while (mockUIQueue.length) mockUIQueue.shift()!(); });
    expect(sequence).toHaveBeenCalledTimes(1);
    ui.rerender(<NoteSwipeStack {...props} at={1} card={mockCard('second')} />);
    act(() => { while (mockUIQueue.length) mockUIQueue.shift()!(); });
    expect(sequence).toHaveBeenCalledTimes(1);
  });

  it.each(['drag', 'flight'] as const)('does not start a deferred hint during a %s', interaction => {
    const sequence = jest.spyOn(Reanimated, 'withSequence');
    const props = stackProps({ hint: false, card: undefined });
    const ui = render(<NoteSwipeStack {...props} />);
    const pan = mockPanCallbacks[mockPanCallbacks.length - 1];
    pan.onStart!({});
    pan.onUpdate!({ translationX: -60, translationY: 0 });
    if (interaction === 'flight') pan.onEnd!({ translationX: -60, translationY: 0, velocityX: -900, velocityY: 0 });
    const translation = stableSV[0].value;
    ui.rerender(<NoteSwipeStack {...props} hint card={mockCard()} />);
    act(() => { while (mockUIQueue.length) mockUIQueue.shift()!(); });
    expect(sequence).not.toHaveBeenCalled();
    expect(stableSV[0].value).toBe(translation);
    if (interaction === 'flight') completeLastFlight();
    else pan.onFinalize!({});
    ui.rerender(<NoteSwipeStack {...props} hint card={mockCard('later')} at={1} />);
    act(() => { while (mockUIQueue.length) mockUIQueue.shift()!(); });
    expect(sequence).not.toHaveBeenCalled();
  });
});

describe('unitC2-fix10 reduced-first hint defers the one-time wiggle', () => {
  it('defers the wiggle until reduce-motion resolves false, then plays exactly once', () => {
    const sequence = jest.spyOn(Reanimated, 'withSequence');
    const props = stackProps({ hint: true, reduced: true });
    const ui = render(<NoteSwipeStack {...props} />);
    act(() => { while (mockUIQueue.length) mockUIQueue.shift()!(); });
    expect(sequence).not.toHaveBeenCalled();
    ui.rerender(<NoteSwipeStack {...props} reduced={false} />);
    act(() => { while (mockUIQueue.length) mockUIQueue.shift()!(); });
    expect(sequence).toHaveBeenCalledTimes(1);
    ui.rerender(<NoteSwipeStack {...props} reduced={false} at={1} card={mockCard('second')} />);
    act(() => { while (mockUIQueue.length) mockUIQueue.shift()!(); });
    expect(sequence).toHaveBeenCalledTimes(1);
  });

  it('never schedules the hint while reduced stays true', () => {
    const sequence = jest.spyOn(Reanimated, 'withSequence');
    const props = stackProps({ hint: true, reduced: true });
    const ui = render(<NoteSwipeStack {...props} />);
    act(() => { while (mockUIQueue.length) mockUIQueue.shift()!(); });
    expect(sequence).not.toHaveBeenCalled();
    ui.rerender(<NoteSwipeStack {...props} reduced at={1} card={mockCard('second')} />);
    act(() => { while (mockUIQueue.length) mockUIQueue.shift()!(); });
    expect(sequence).not.toHaveBeenCalled();
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

// Gesture flights have a completion callback; the pure-visual Previous slide-in
// (withTiming without a callback) is excluded so the simulator tracks real flights.
function lastGestureFlight(): TimingCall | undefined {
  const flights = timingCalls.filter(c =>
    typeof c.cb === 'function' &&
    (c.opts?.duration === NOTE_SWIPE.exitMs || c.opts?.duration === NOTE_SWIPE.crossFadeMs));
  return flights[flights.length - 1];
}

function swipeNext(pan: MockPanCallbacks, translation = -60, velocity = -900, withUpdate = true) {
  pan.onStart!({} as any);
  if (withUpdate) pan.onUpdate!({ translationX: translation, translationY: 0 } as any);
  pan.onEnd!({ translationX: translation, translationY: 0, velocityX: velocity, velocityY: 0 } as any);
}

function swipePrev(pan: MockPanCallbacks, translation = 60, velocity = 900, withUpdate = true) {
  pan.onStart!({} as any);
  if (withUpdate) pan.onUpdate!({ translationX: translation, translationY: 0 } as any);
  pan.onEnd!({ translationX: translation, translationY: 0, velocityX: velocity, velocityY: 0 } as any);
}

function pressNext(ui: ReturnType<typeof render>) {
  const top = ui.getByTestId('note-card-slot-0', { includeHiddenElements: true });
  (top.props.onAccessibilityAction as any)({ nativeEvent: { actionName: 'next' } });
}

function pressPrev(ui: ReturnType<typeof render>) {
  const top = ui.getByTestId('note-card-slot-0', { includeHiddenElements: true });
  (top.props.onAccessibilityAction as any)({ nativeEvent: { actionName: 'previous' } });
}

function pressRead(ui: ReturnType<typeof render>) {
  const top = ui.getByTestId('note-card-slot-0', { includeHiddenElements: true });
  (top.props.onAccessibilityAction as any)({ nativeEvent: { actionName: 'read' } });
}

function swipeCategory(pan: MockPanCallbacks, translation = -60, velocity = -900, withUpdate = true) {
  pan.onStart!({} as any);
  if (withUpdate) pan.onUpdate!({ translationX: 0, translationY: translation } as any);
  pan.onEnd!({ translationX: 0, translationY: translation, velocityX: 0, velocityY: velocity } as any);
}

function pressCategory(ui: ReturnType<typeof render>) {
  const top = ui.getByTestId('note-card-slot-0', { includeHiddenElements: true });
  (top.props.onAccessibilityAction as any)({ nativeEvent: { actionName: 'category' } });
}

// Order (fix6 single-flight): x, y, axis, width, opacity, flight, panActive, ...
function expectIdleShared() {
  expect(stableSV[0].value).toBe(0);
  expect(stableSV[1].value).toBe(0);
  expect(stableSV[4].value).toBe(1);
  expect(stableSV[5].value).toBe(0);
}

function completeLastFlight(done: unknown = true) {
  const flight = lastGestureFlight();
  expect(flight?.cb).toEqual(expect.any(Function));
  act(() => { flight!.cb(done); });
}

function advanceAll() {
  act(() => { jest.advanceTimersByTime(NOTE_SWIPE.exitMs * 2 + NOTE_SWIPE.safetyMarginMs + 500); });
  // Drain any stored animation completions that were never run (skipped callbacks
  // must already have been fenced by the flight id; draining must not double-advance).
  for (const c of [...timingCalls]) {
    if (typeof c.cb === 'function') {
      try { act(() => { c.cb(true); }); } catch { /* ignore */ }
    }
  }
  act(() => { jest.advanceTimersByTime(1000); });
}

describe('unitC2-fix6 flight simulator: no deadlock across orderings', () => {
  it.each([
    ['previous-then-4-rights', 'prev+4prev'],
    ['next-then-prev-then-next', 'next-prev-next'],
    ['endcard-previous-then-swipes', 'end-prev-swipes'],
    ['swipe-plus-next-150ms', 'swipe-next150'],
    ['three-swipes-300ms-apart', '3x300ms'],
    ['completion-dropped-safety-only', 'safety-only'],
    ['done-false-then-double-cb', 'done-false-double'],
    ['effect-rerun-reduced-width', 'rerun-midflight'],
  ])('scenario %s stays idle and accepts the next inputs', (_label, key) => {
    jest.useFakeTimers();
    const onMove = jest.fn();
    const onRead = jest.fn();
    const total = 5;
    let at = key === 'end-prev-swipes' ? total : 2;
    const cardFor = (a: number) => (a >= total ? undefined : mockCard(`n-${a}`));
    const propsFor = () => stackProps({ onMove, onRead, at, total, card: cardFor(at) });
    const ui = render(<NoteSwipeStack {...propsFor()} />);
    const pan = () => mockPanCallbacks[mockPanCallbacks.length - 1];
    const rerenderAt = (next: number) => {
      at = next;
      ui.rerender(<NoteSwipeStack {...propsFor()} />);
    };

    if (key === 'prev+4prev') {
      // Previous then 4 right swipes (all `previous` direction): the old three-place
      // flight state deadlocked here (flightId stayed > lastFinished).
      swipePrev(pan());
      expect(onMove).toHaveBeenCalledTimes(1);
      rerenderAt(1);
      for (let i = 0; i < 4; i++) {
        if (at <= 0) {
          const before = onMove.mock.calls.length;
          swipePrev(pan());
          expect(onMove.mock.calls.length).toBe(before);
          break;
        }
        swipePrev(pan());
        rerenderAt(at - 1);
      }
    } else if (key === 'next-prev-next') {
      swipeNext(pan());
      completeLastFlight(true);
      expect(onMove).toHaveBeenCalledTimes(1);
      rerenderAt(at + 1);
      swipePrev(pan());
      expect(onMove).toHaveBeenCalledTimes(2);
      rerenderAt(at - 1);
      swipeNext(pan());
      completeLastFlight(false);
      expect(onMove).toHaveBeenCalledTimes(2);
      swipeNext(pan());
      completeLastFlight(true);
      expect(onMove).toHaveBeenCalledTimes(3);
      rerenderAt(at + 1);
    } else if (key === 'end-prev-swipes') {
      // End card (at == total, no card) -> Previous -> swipes.
      swipePrev(pan());
      expect(onMove).toHaveBeenCalledWith('previous');
      rerenderAt(total - 1);
      swipeNext(pan());
      completeLastFlight(true);
      rerenderAt(at + 1);
      swipePrev(pan());
      rerenderAt(at - 1);
    } else if (key === 'swipe-next150') {
      // Swipe + Next 150ms later: the button during the flight is ignored (documented
      // policy), the flight's own completion advances exactly once.
      swipeNext(pan());
      expect(onMove).not.toHaveBeenCalled();
      act(() => { jest.advanceTimersByTime(150); });
      pressNext(ui);
      expect(onMove).not.toHaveBeenCalled();
      completeLastFlight(true);
      expect(onMove).toHaveBeenCalledTimes(1);
      rerenderAt(at + 1);
    } else if (key === '3x300ms') {
      for (let i = 0; i < 3; i++) {
        swipeNext(pan());
        completeLastFlight(true);
        rerenderAt(at + 1);
        act(() => { jest.advanceTimersByTime(300); });
      }
      expect(onMove).toHaveBeenCalledTimes(3);
    } else if (key === 'safety-only') {
      // Completion callback dropped entirely: only the safety timer fires (no advance),
      // then the next inputs must work.
      swipeNext(pan());
      expect(onMove).not.toHaveBeenCalled();
      act(() => { jest.advanceTimersByTime(NOTE_SWIPE.exitMs * 2 + NOTE_SWIPE.safetyMarginMs + 50); });
      expect(onMove).not.toHaveBeenCalled();
      expectIdleShared();
    } else if (key === 'done-false-double') {
      swipeNext(pan());
      const flight = lastGestureFlight();
      act(() => { flight!.cb(false); });
      expect(onMove).not.toHaveBeenCalled();
      // Late duplicate completions (done=false cancellation + timeout + double call).
      act(() => { flight!.cb(false); flight!.cb(true); });
      expect(onMove).not.toHaveBeenCalled();
      swipeNext(pan());
      completeLastFlight(true);
      expect(onMove).toHaveBeenCalledTimes(1);
      rerenderAt(at + 1);
    } else {
      // Effect re-run mid-flight (reduced + window width change) cancels cleanly.
      // NOTE: the dimensions mock is NOT installed here (it would change the hook
      // count mid-test). Width is covered by the dedicated test below.
      swipeNext(pan());
      expect(onMove).not.toHaveBeenCalled();
      ui.rerender(<NoteSwipeStack {...stackProps({ onMove, onRead, at, total, reduced: true })} />);
      expect(onMove).not.toHaveBeenCalled();
      expectIdleShared();
      ui.rerender(<NoteSwipeStack {...propsFor()} />);
      // Late completion for the cancelled flight must not advance.
      for (const c of [...timingCalls]) {
        if (typeof c.cb === 'function') act(() => { try { c.cb(true); } catch { /* ignore */ } });
      }
      expect(onMove).not.toHaveBeenCalled();
    }

    advanceAll();
    expectIdleShared();
    // One more swipe, one Next/Previous press and one Read press must all work
    // (proves the JS flight ref is idle, not just the shared value). The end card
    // (at == total, no card) cannot Read, so step back first when needed.
    if (at >= total) {
      pressPrev(ui);
      expect(onMove).toHaveBeenCalledWith('previous');
      at = total - 1;
      ui.rerender(<NoteSwipeStack {...propsFor()} />);
      advanceAll();
      expectIdleShared();
    }
    const movesBefore = onMove.mock.calls.length;
    const readsBefore = onRead.mock.calls.length;
    if (at < total) {
      swipeNext(pan());
      completeLastFlight(true);
      expect(onMove.mock.calls.length).toBe(movesBefore + 1);
      at += 1;
      ui.rerender(<NoteSwipeStack {...propsFor()} />);
      advanceAll();
      expectIdleShared();
      // Back to a card so Read is available.
      if (at >= total) {
        pressPrev(ui);
        at = total - 1;
        ui.rerender(<NoteSwipeStack {...propsFor()} />);
        advanceAll();
        expectIdleShared();
      }
    }
    if (at > 0) {
      const prevCalls = onMove.mock.calls.length;
      pressPrev(ui);
      expect(onMove.mock.calls.length).toBe(prevCalls + 1);
      expect(onMove).toHaveBeenCalledWith('previous');
    } else {
      pressNext(ui);
    }
    pressRead(ui);
    expect(onRead.mock.calls.length).toBe(readsBefore + 1);
    advanceAll();
    expectIdleShared();
    ui.unmount();
  });

  it('covers dozens of seeded orderings without deadlock', () => {
    jest.useFakeTimers();
    // Deterministic PRNG (mulberry32) so the permutation run is reproducible.
    let seed = 0xC2F106;
    const rand = () => {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let iter = 0; iter < 30; iter++) {
      const onMove = jest.fn();
      const onRead = jest.fn();
      const total = 4;
      let at = 1 + Math.floor(rand() * 3);
      const propsFor = () => stackProps({ onMove, onRead, at, total, card: mockCard(`s-${at}`) });
      const ui = render(<NoteSwipeStack {...propsFor()} />);
      const pan = () => mockPanCallbacks[mockPanCallbacks.length - 1];
      const steps = 2 + Math.floor(rand() * 4);
      for (let s = 0; s < steps; s++) {
        const choice = rand();
        if (choice < 0.35 && at < total) {
          swipeNext(pan());
          // Randomly complete, double-complete, drop, or done=false.
          const mode = rand();
          if (mode < 0.6) completeLastFlight(mode < 0.3 ? false : true);
          else if (mode < 0.75) { const f = lastGestureFlight(); act(() => { f!.cb(true); f!.cb(false); }); }
          else { act(() => { jest.advanceTimersByTime(NOTE_SWIPE.exitMs * 2 + NOTE_SWIPE.safetyMarginMs + 10); }); }
          if (onMove.mock.calls.length > 0) {
            const lastDir = onMove.mock.calls[onMove.mock.calls.length - 1][0];
            if (lastDir === 'next') at = Math.min(total, at + 1);
            else if (lastDir === 'previous') at = Math.max(0, at - 1);
            ui.rerender(<NoteSwipeStack {...propsFor()} />);
          }
        } else if (choice < 0.7 && at > 0) {
          swipePrev(pan());
          const lastDir = onMove.mock.calls.length ? onMove.mock.calls[onMove.mock.calls.length - 1][0] : null;
          if (lastDir === 'previous') {
            at = Math.max(0, at - 1);
            ui.rerender(<NoteSwipeStack {...propsFor()} />);
          }
        } else if (choice < 0.85) {
          pressNext(ui);
          if (onMove.mock.calls.length) {
            const lastDir = onMove.mock.calls[onMove.mock.calls.length - 1][0];
            if (lastDir === 'next') at = Math.min(total, at + 1);
            else if (lastDir === 'previous') at = Math.max(0, at - 1);
            ui.rerender(<NoteSwipeStack {...propsFor()} />);
          }
        } else {
          // External position change mid-flight cancels without advancing.
          swipeNext(pan());
          const before = onMove.mock.calls.length;
          at = Math.min(total, at + 1);
          ui.rerender(<NoteSwipeStack {...propsFor()} />);
          for (const c of [...timingCalls]) {
            if (typeof c.cb === 'function') act(() => { try { c.cb(true); } catch { /* ignore */ } });
          }
          expect(onMove.mock.calls.length).toBe(before);
        }
        act(() => { jest.advanceTimersByTime(50); });
      }
      advanceAll();
      expectIdleShared();
      ui.unmount();
      timingCalls.length = 0;
    }
  });

  it('covers category flights in a seeded permutation run without deadlock (C3)', () => {
    jest.useFakeTimers();
    let seed = 0xC3CA7E;
    const rand = () => {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let iter = 0; iter < 20; iter++) {
      const onMove = jest.fn();
      const onCategory = jest.fn();
      const onRead = jest.fn();
      const total = 4;
      let at = 1 + Math.floor(rand() * 3);
      let cat = 'all';
      const propsFor = () => stackProps({ onMove, onRead, onCategory, canCategory: true, categoryKey: cat, at, total, card: mockCard(`s-${at}-${cat}`) });
      const ui = render(<NoteSwipeStack {...propsFor()} />);
      const pan = () => mockPanCallbacks[mockPanCallbacks.length - 1];
      const steps = 2 + Math.floor(rand() * 4);
      for (let s = 0; s < steps; s++) {
        const choice = rand();
        if (choice < 0.3) {
          swipeCategory(pan());
          const mode = rand();
          if (mode < 0.6) completeLastFlight(mode < 0.3 ? false : true);
          else if (mode < 0.75) { const f = lastGestureFlight(); act(() => { f!.cb(true); f!.cb(false); }); }
          else { act(() => { jest.advanceTimersByTime(NOTE_SWIPE.exitMs * 2 + NOTE_SWIPE.safetyMarginMs + 10); }); }
          if (onCategory.mock.calls.length > 0) {
            cat = cat === 'all' ? 'quote' : 'all';
            ui.rerender(<NoteSwipeStack {...propsFor()} />);
          }
        } else if (choice < 0.55 && at < total) {
          swipeNext(pan());
          completeLastFlight(true);
          if (onMove.mock.calls.length) {
            const lastDir = onMove.mock.calls[onMove.mock.calls.length - 1][0];
            if (lastDir === 'next') at = Math.min(total, at + 1);
            else if (lastDir === 'previous') at = Math.max(0, at - 1);
            ui.rerender(<NoteSwipeStack {...propsFor()} />);
          }
        } else if (choice < 0.7) {
          pressCategory(ui);
          if (onCategory.mock.calls.length) {
            cat = cat === 'all' ? 'quote' : 'all';
            ui.rerender(<NoteSwipeStack {...propsFor()} />);
          }
        } else if (choice < 0.85) {
          pressNext(ui);
          if (onMove.mock.calls.length) {
            const lastDir = onMove.mock.calls[onMove.mock.calls.length - 1][0];
            if (lastDir === 'next') at = Math.min(total, at + 1);
            else if (lastDir === 'previous') at = Math.max(0, at - 1);
            ui.rerender(<NoteSwipeStack {...propsFor()} />);
          }
        } else {
          swipeCategory(pan());
          const before = onCategory.mock.calls.length;
          cat = cat === 'all' ? 'quote' : 'all';
          ui.rerender(<NoteSwipeStack {...propsFor()} />);
          for (const c of [...timingCalls]) {
            if (typeof c.cb === 'function') act(() => { try { c.cb(true); } catch { /* ignore */ } });
          }
          expect(onCategory.mock.calls.length).toBe(before);
        }
        act(() => { jest.advanceTimersByTime(50); });
      }
      advanceAll();
      expectIdleShared();
      // Inputs during a category flight are ignored then recover.
      const movesBefore = onMove.mock.calls.length;
      const catsBefore = onCategory.mock.calls.length;
      swipeCategory(pan());
      pressNext(ui);
      expect(onMove.mock.calls.length).toBe(movesBefore);
      completeLastFlight(true);
      expect(onCategory.mock.calls.length).toBe(catsBefore + 1);
      ui.unmount();
      timingCalls.length = 0;
    }
  });
});

describe('unitC2-fix6 fling reliability', () => {
  it.each([
    ['left-with-update', -150, -2500, true, 'next'],
    ['left-without-update', -150, -2500, false, 'next'],
    ['right-with-update', 150, 2500, true, 'previous'],
    ['right-without-update', 150, 2500, false, 'previous'],
  ])('fling %s advances (translation=%s velocity=%s)', (_label, translation, velocity, withUpdate, expected) => {
    const onMove = jest.fn();
    render(<NoteSwipeStack {...stackProps({ onMove, at: 1, total: 3 })} />);
    const pan = mockPanCallbacks[mockPanCallbacks.length - 1];
    pan.onStart!({} as any);
    if (withUpdate) pan.onUpdate!({ translationX: translation, translationY: 0 } as any);
    // Fast fling: 150px in 60ms => velocity far above the 800px/s threshold. The
    // direction must agree with the drag sign (vx * x > 0) and must not be swallowed
    // as a tap/failed pan when onUpdate never ran.
    pan.onEnd!({ translationX: translation, translationY: 0, velocityX: velocity, velocityY: 0 } as any);
    if (expected === 'previous') {
      // Previous gestures finish synchronously (no exit animation).
      expect(onMove).toHaveBeenCalledWith('previous');
    } else {
      expect(lastGestureFlight()?.cb).toEqual(expect.any(Function));
      completeLastFlight(true);
      expect(onMove).toHaveBeenCalledWith('next');
    }
    expect(mockExclusiveCalls.length).toBeGreaterThan(0);
  });

  it('a fast fling is never swallowed as a tap', () => {
    const onMove = jest.fn();
    const onRead = jest.fn();
    render(<NoteSwipeStack {...stackProps({ onMove, onRead, at: 1, total: 3 })} />);
    const pan = mockPanCallbacks[mockPanCallbacks.length - 1];
    const tap = mockTapCallbacks[mockTapCallbacks.length - 1];
    // Fling without any onUpdate: pan must still claim via onEnd so the racing tap
    // (Exclusive second net) is blocked.
    pan.onStart!({} as any);
    pan.onEnd!({ translationX: -150, translationY: 0, velocityX: -2500, velocityY: 0 } as any);
    tap({} as any, true);
    expect(onRead).not.toHaveBeenCalled();
    completeLastFlight(true);
    expect(onMove).toHaveBeenCalledWith('next');
  });
});

describe('unitC2-fix6 window-width rerun cancels cleanly', () => {
  it('cancels a flight when the window width changes mid-flight, then accepts new input', () => {
    jest.useFakeTimers();
    const RN = require('react-native');
    let dimsValue: any = { width: 390, height: 844, scale: 1, fontScale: 1 };
    const dimsSpy = jest.spyOn(RN, 'useWindowDimensions').mockImplementation(() => dimsValue);
    try {
      const onMove = jest.fn();
      const onRead = jest.fn();
      const ui = render(<NoteSwipeStack {...stackProps({ onMove, onRead, at: 1, total: 3 })} />);
      const pan = mockPanCallbacks[mockPanCallbacks.length - 1];
      swipeNext(pan);
      expect(onMove).not.toHaveBeenCalled();
      dimsValue = { width: 360, height: 640, scale: 1, fontScale: 1 };
      ui.rerender(<NoteSwipeStack {...stackProps({ onMove, onRead, at: 1, total: 3 })} />);
      expect(onMove).not.toHaveBeenCalled();
      expectIdleShared();
      for (const c of [...timingCalls]) {
        if (typeof c.cb === 'function') act(() => { try { c.cb(true); } catch { /* ignore */ } });
      }
      expect(onMove).not.toHaveBeenCalled();
      advanceAll();
      expectIdleShared();
      swipeNext(pan);
      completeLastFlight(true);
      expect(onMove).toHaveBeenCalledWith('next');
      ui.unmount();
    } finally {
      dimsSpy.mockRestore();
    }
  });
});

describe('unitC2-fix6 sheet swipe-down closes only the sheet', () => {
  it('closes via the sheet header pan without leaving the deck, then the deck still swipes', () => {
    jest.useFakeTimers();
    const mockDeckMove = jest.fn();
    const mockBack = jest.fn();
    const mockRouter = { back: mockBack, canGoBack: () => true, replace: jest.fn(), push: jest.fn() };
    (globalThis as any).__mockScreenRouter = mockRouter;
    const cardA = mockCard('a');
    const baseDeck = {
      index: { data: [{ id: 'a' }], isError: false, isPending: false, isFetching: false, refetch: jest.fn() },
      ids: ['a', 'b'],
      at: 0,
      noteId: 'a',
      card: cardA,
      undercards: [mockCard('b')],
      move: mockDeckMove,
      abort: jest.fn(),
      restart: jest.fn(),
      retryCard: jest.fn(),
    };
    (globalThis as any).__mockScreenDeck = baseDeck;
    const Screen = require('../../../../../app/(tabs)/library/notes-swipe').default;
    const { BookFeedbackProvider } = require('../../ui');
    try {
      const ui = render(<BookFeedbackProvider><Screen /></BookFeedbackProvider>);
      // Open the sheet via the deck's Read action.
      fireEvent.press(ui.getByRole('button', { name: 'Read full note' }));
      expect(ui.getByTestId('note-full-sheet', { includeHiddenElements: true })).toBeTruthy();
      const deckPanIndex = 0;
      const deckPan = mockPanCallbacks[deckPanIndex];
      const sheetPan = mockPanCallbacks[mockPanCallbacks.length - 1];
      expect(sheetPan.onEnd).toEqual(expect.any(Function));
      // Swipe down on the sheet header (same thresholds as the deck leave).
      act(() => {
        sheetPan.onEnd!({ translationX: 0, translationY: 500, velocityX: 0, velocityY: 900 } as any);
      });
      expect(ui.queryByTestId('note-full-sheet', { includeHiddenElements: true })).toBeNull();
      // The same finger finishing a leave gesture on the deck must NOT leave the
      // screen: the deck stays disabled through the close grace.
      const leavesBefore = mockBack.mock.calls.length;
      act(() => {
        deckPan.onStart!({} as any);
        deckPan.onUpdate!({ translationX: 0, translationY: 300 } as any);
        deckPan.onEnd!({ translationX: 0, translationY: 300, velocityX: 0, velocityY: 900 } as any);
      });
      // Drain any stored gesture completions from that same touch.
      for (const c of [...timingCalls]) {
        if (typeof c.cb === 'function') act(() => { try { c.cb(true); } catch { /* ignore */ } });
      }
      expect(mockBack.mock.calls.length).toBe(leavesBefore);
      expect(mockDeckMove).not.toHaveBeenCalledWith('leave' as never);
      // After the grace the deck responds to a brand-new swipe.
      act(() => { jest.advanceTimersByTime(500); });
      ui.rerender(<BookFeedbackProvider><Screen /></BookFeedbackProvider>);
      const swipePan = [...mockPanCallbacks].reverse().find(p => typeof p?.onStart === 'function' && typeof p?.onEnd === 'function') ?? deckPan;
      act(() => {
        swipePan.onStart!({} as any);
        swipePan.onUpdate!({ translationX: -60, translationY: 0 } as any);
        swipePan.onEnd!({ translationX: -60, translationY: 0, velocityX: -900, velocityY: 0 } as any);
      });
      const flight = lastGestureFlight();
      if (flight?.cb) act(() => { flight.cb(true); });
      expect(mockDeckMove).toHaveBeenCalledWith('next');
      ui.unmount();
    } finally {
      delete (globalThis as any).__mockScreenDeck;
      delete (globalThis as any).__mockScreenRouter;
      jest.useRealTimers();
    }
  });
});
