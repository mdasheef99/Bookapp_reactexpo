import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { NoteSwipeStack } from '../NoteSwipeStack';
import NotesSwipeScreen from '../../../../../app/(tabs)/library/notes-swipe';
import { BookFeedbackProvider } from '../../ui';
import { getLibraryAppearance } from '../../LibraryAppearance';
import { NOTE_SWIPE } from '@/features/books/notes/noteSwipeConstants';
import type { NoteDeckCard } from '@/features/books/notes/manualNoteContract';

jest.mock('@/hooks/useTheme', () => ({ useTheme: jest.fn(() => ({ phase: 'daylight' })) }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
const mockBack = jest.fn();
const mockMove = jest.fn();
const mockRouter = { back: mockBack, canGoBack: () => true, replace: jest.fn() };
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ order: 'shuffle' }), useRouter: () => mockRouter }));
jest.mock('@react-navigation/native', () => ({ useRoute: () => ({ key: 'swipe' }), useIsFocused: () => true }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'seed' }));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOffline: false }) }));
jest.mock('@/features/books/notes/useManualNotes', () => ({ useNoteContext: () => ({ actorId: 'actor', book: {} }) }));
jest.mock('@/features/books/notes/useNoteDeck', () => ({ useNoteDeck: () => ({
  index: { data: [1, 2, 3] }, ids: ['a', 'b', 'c'], at: 0, noteId: 'a', card: mockCard(), undercards: [],
  move: mockMove, abort: jest.fn(), restart: jest.fn(), retryCard: jest.fn(),
}) }));
jest.mock('../useNoteSwipeMotion', () => ({ useReducedNoteMotion: () => false, useNoteSwipeHint: () => false }));
const mockImpact = jest.fn(() => Promise.resolve());
jest.mock('expo-haptics', () => ({ impactAsync: (...args: unknown[]) => (mockImpact as any)(...args), ImpactFeedbackStyle: { Light: 'Light' } }));
const mockScheduleOnRN = jest.fn((fn: (...a: any[]) => void, ...args: any[]) => { fn(...args); });
jest.mock('react-native-worklets', () => {
  const actual = jest.requireActual('react-native-worklets');
  return { ...actual, scheduleOnRN: (...args: any[]) => (mockScheduleOnRN as any)(...args) };
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
    for (const name of ['enabled', 'minDistance', 'maxDistance', 'maxDuration', 'runOnJS']) gesture[name] = jest.fn(() => gesture);
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
const card = mockCard;

function stackProps(over: Partial<React.ComponentProps<typeof NoteSwipeStack>> = {}) {
  return {
    card: card(),
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
  mockImpact.mockClear();
  mockScheduleOnRN.mockClear();
  jest.useRealTimers();
  (Platform as { OS: string }).OS = 'ios';
  // Stable shared values per hook order (like the real Reanimated runtime): the same
  // component instance keeps the same objects across rerenders so the monotonic
  // flight id survives data arrival (undefined → defined) mid-flight.
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

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

function lastFlightCall() {
  const flights = timingCalls.filter(c => c.opts?.duration === NOTE_SWIPE.exitMs || c.opts?.duration === NOTE_SWIPE.crossFadeMs);
  return flights[flights.length - 1];
}

function swipeNext(pan: MockPanCallbacks, translation = -60, velocity = -900) {
  pan.onStart!({} as any);
  pan.onUpdate!({ translationX: translation, translationY: 0 } as any);
  pan.onEnd!({ translationX: translation, translationY: 0, velocityX: velocity, velocityY: 0 } as any);
}

describe('unitC2-fix4 item1 swipe reliability', () => {
  it('(1) mid-flight data arrival still advances exactly once', () => {
    const onMove = jest.fn();
    // Start with no card data (lazy cache miss) at the same position.
    const ui = render(<NoteSwipeStack {...stackProps({ card: undefined, onMove, at: 0, total: 2 })} />);
    const pan = mockPanCallbacks[mockPanCallbacks.length - 1];
    swipeNext(pan);
    // Flight started but not yet completed (completion stored, not invoked).
    expect(onMove).not.toHaveBeenCalled();
    expect(lastFlightCall()?.cb).toEqual(expect.any(Function));
    // Mid-flight the card data ARRIVES (same position, changed card prop).
    ui.rerender(<NoteSwipeStack {...stackProps({ card: card('note-1'), onMove, at: 0, total: 2 })} />);
    expect(onMove).not.toHaveBeenCalled();
    // A cancelled completion never advances, including a late successful duplicate.
    const cancelled = lastFlightCall();
    cancelled.cb(false);
    expect(onMove).not.toHaveBeenCalled();
    cancelled.cb(true);
    expect(onMove).not.toHaveBeenCalled();
    swipeNext(mockPanCallbacks[mockPanCallbacks.length - 1]);
    lastFlightCall().cb(true);
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith('next');
    ui.unmount();
  });

  it('(2) two swipes in quick succession move exactly twice with busy released', () => {
    const onMove = jest.fn();
    const ui = render(<NoteSwipeStack {...stackProps({ card: undefined, onMove, at: 0, total: 3 })} />);
    // First swipe with mid-flight data arrival (would be lost without the fix).
    swipeNext(mockPanCallbacks[mockPanCallbacks.length - 1]);
    ui.rerender(<NoteSwipeStack {...stackProps({ card: card('a'), onMove, at: 0, total: 3 })} />);
    lastFlightCall().cb(false);
    expect(onMove).not.toHaveBeenCalled();
    swipeNext(mockPanCallbacks[mockPanCallbacks.length - 1]);
    lastFlightCall().cb(true);
    expect(onMove).toHaveBeenCalledTimes(1);
    // Parent advances the deck: new position, new card.
    ui.rerender(<NoteSwipeStack {...stackProps({ card: card('b'), onMove, at: 1, total: 3 })} />);
    // Second swipe right after the move uses the new position (no stale closure, no stuck busy).
    swipeNext(mockPanCallbacks[mockPanCallbacks.length - 1]);
    lastFlightCall().cb(true);
    expect(onMove).toHaveBeenCalledTimes(2);
    expect(onMove).toHaveBeenNthCalledWith(1, 'next');
    expect(onMove).toHaveBeenNthCalledWith(2, 'next');
    ui.rerender(<NoteSwipeStack {...stackProps({ card: card('c'), onMove, at: 2, total: 3 })} />);
    // Busy released: a cancel swipe still springs back instead of being dropped.
    Reanimated.withSpring.mockClear();
    const pan = mockPanCallbacks[mockPanCallbacks.length - 1];
    pan.onStart!({} as any);
    pan.onUpdate!({ translationX: 2, translationY: 1 } as any);
    pan.onEnd!({ translationX: 2, translationY: 1, velocityX: 0, velocityY: 0 } as any);
    expect(Reanimated.withSpring).toHaveBeenCalled();
    expect(onMove).toHaveBeenCalledTimes(2);
    ui.unmount();
  });

  it('(3) done=false releases input without advancing and late duplicates stay fenced', () => {
    const onMove = jest.fn();
    render(<NoteSwipeStack {...stackProps({ onMove, at: 0, total: 2 })} />);
    swipeNext(mockPanCallbacks[mockPanCallbacks.length - 1]);
    const flight = lastFlightCall();
    expect(typeof flight?.cb).toBe('function');
    flight.cb(false);
    expect(onMove).not.toHaveBeenCalled();
    flight.cb(false);
    flight.cb(true);
    expect(onMove).not.toHaveBeenCalled();
    swipeNext(mockPanCallbacks[mockPanCallbacks.length - 1]);
    lastFlightCall().cb(true);
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('(4) pan activity in the same gesture blocks the tap sheet', () => {
    const onRead = jest.fn();
    render(<NoteSwipeStack {...stackProps({ onRead, at: 0, total: 2 })} />);
    const pan = mockPanCallbacks[mockPanCallbacks.length - 1];
    const tap = mockTapCallbacks[mockTapCallbacks.length - 1];
    // Tap wins the race before the pan claims: pan moved (> tap maxDistance) then tap ends.
    pan.onStart!({} as any);
    pan.onUpdate!({ translationX: 40, translationY: 2 } as any);
    tap({} as any, true);
    expect(onRead).not.toHaveBeenCalled();
    // A pure tap with no prior pan activity still opens the sheet.
    const onRead2 = jest.fn();
    render(<NoteSwipeStack {...stackProps({ onRead: onRead2, at: 0, total: 2 })} />);
    const tap2 = mockTapCallbacks[mockTapCallbacks.length - 1];
    tap2({} as any, true);
    expect(onRead2).toHaveBeenCalledTimes(1);
  });

  it('(5) safety timeout releases a stuck flight and resets x/y to 0', () => {
    jest.useFakeTimers();
    const onMove = jest.fn();
    const ui = render(<NoteSwipeStack {...stackProps({ onMove, at: 0, total: 2 })} />);
    // Order (fix6 single-flight): x, y, axis, width, opacity, flight, panActive, ...
    const xObj = stableSV[0]; const yObj = stableSV[1]; const flightObj = stableSV[5];
    swipeNext(mockPanCallbacks[mockPanCallbacks.length - 1]);
    // Stuck: the animation completion never arrives (no callback invoked).
    expect(onMove).not.toHaveBeenCalled();
    expect(flightObj.value).not.toBe(0);
    // Card is translated off-screen while stuck.
    expect(typeof xObj.value === 'number' && xObj.value < -100).toBe(true);
    jest.advanceTimersByTime(NOTE_SWIPE.exitMs * 2 + NOTE_SWIPE.safetyMarginMs + 50);
    expect(flightObj.value).toBe(0);
    expect(xObj.value).toBe(0);
    expect(yObj.value).toBe(0);
    expect(onMove).not.toHaveBeenCalled();
    // Flight released: the next swipe is not dropped.
    swipeNext(mockPanCallbacks[mockPanCallbacks.length - 1]);
    lastFlightCall().cb(true);
    expect(onMove).toHaveBeenCalledTimes(1);
    ui.unmount();
  });

  it('uses event translation (not stale x) and Exclusive(pan, tap) with bounded tap', () => {
    const onMove = jest.fn();
    render(<NoteSwipeStack {...stackProps({ onMove, at: 0, total: 2 })} />);
    expect(mockPanInstances.length).toBeGreaterThan(0);
    const lastPan = mockPanInstances[mockPanInstances.length - 1];
    expect(lastPan.minDistance).toHaveBeenCalledWith(NOTE_SWIPE.axisLock);
    const { Gesture } = require('react-native-gesture-handler');
    const tapMock = (Gesture.Tap as jest.Mock).mock.results[(Gesture.Tap as jest.Mock).mock.results.length - 1].value;
    expect(tapMock.maxDistance).toHaveBeenCalledWith(NOTE_SWIPE.tapMaxDistance);
    expect(tapMock.maxDuration).toHaveBeenCalledWith(NOTE_SWIPE.tapMaxDuration);
    expect(mockExclusiveCalls.length).toBeGreaterThan(0);
    // Update is below threshold; only the END event crosses it, with zero velocity.
    const pan = mockPanCallbacks[mockPanCallbacks.length - 1];
    pan.onStart!({} as any);
    pan.onUpdate!({ translationX: -5, translationY: 0 } as any);
    pan.onEnd!({ translationX: -200, translationY: 0, velocityX: 0, velocityY: 0 } as any);
    expect(lastFlightCall()?.cb).toEqual(expect.any(Function));
    lastFlightCall().cb(true);
    expect(onMove).toHaveBeenCalledWith('next');
  });
});

describe('unitC2-fix5 stack regressions', () => {
  it.each([false, true])('reserves distinct visible undercard strips (reduced=%s)', reduced => {
    const ui = render(<NoteSwipeStack {...stackProps({ reduced, undercards: [card('b'), card('c')] })} />);
    const slots = [0, 1, 2].map(i => ui.getByTestId(`note-card-slot-${i}`, { includeHiddenElements: true }));
    const bottoms = slots.map(slot => StyleSheet.flatten(slot.props.style).bottom as number);
    expect(bottoms[0]).toBeGreaterThan(bottoms[1]);
    expect(bottoms[1]).toBeGreaterThan(bottoms[2]);
    const colors = getLibraryAppearance('daylight');
    for (const i of [1, 2]) {
      const inner = ui.getByTestId(`note-card-slot-${i}-inner`, { includeHiddenElements: true });
      expect(StyleSheet.flatten(inner.props.style)).toMatchObject({ backgroundColor: colors.bgSecondary, borderColor: colors.controlBorder });
    }
    for (const slot of slots) expect(slot.props.collapsable).toBe(false);
    ui.unmount();
  });

  it('ignores Next during a swipe flight, resets every transform and accepts the following swipe', () => {
    const ui = render(<BookFeedbackProvider><NotesSwipeScreen /></BookFeedbackProvider>);
    const pan = mockPanCallbacks[0];
    act(() => swipeNext(pan));
    const flightCall = lastFlightCall();
    fireEvent.press(ui.getByRole('button', { name: 'Next' }));
    expect(mockMove).not.toHaveBeenCalled();
    act(() => flightCall.cb(true));
    expect(mockMove).toHaveBeenCalledTimes(1);
    expect(stableSV[0].value).toBe(0);
    expect(stableSV[1].value).toBe(0);
    expect(stableSV[4].value).toBe(1);
    expect(stableSV[5].value).toBe(0);
    act(() => swipeNext(pan));
    act(() => lastFlightCall().cb(true));
    expect(mockMove).toHaveBeenCalledTimes(2);
    ui.unmount();
  });

  it('budgets the minimum stage from measured metadata and footer heights at 200%', () => {
    const RN = require('react-native');
    const dims = jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 360, height: 640, scale: 1, fontScale: 2 });
    const metaCard = card(); metaCard.note.tag = 'quote';
    const ui = render(<NoteSwipeStack {...stackProps({ card: metaCard })} availableHeight={500} />);
    try {
      fireEvent(ui.getByTestId('note-card-meta', { includeHiddenElements: true }), 'layout', { nativeEvent: { layout: { width: 280, height: 56 } } });
      fireEvent(ui.getByTestId('note-card-footer', { includeHiddenElements: true }), 'layout', { nativeEvent: { layout: { width: 280, height: 104 } } });
      const stage = StyleSheet.flatten(ui.getByTestId('note-stack-fixed-parent').props.style);
      // 16 padding + 56 metadata + 104 footer + 24 gaps + 52 note line + 80 stage chrome.
      expect(stage.minHeight).toBeGreaterThanOrEqual(332);
      expect(stage.minHeight).toBeLessThanOrEqual(500);
    } finally { ui.unmount(); dims.mockRestore(); }
  });

  it.each([true, false])('Back invalidates a downward flight before its late completion (done=%s)', done => {
    const ui = render(<BookFeedbackProvider><NotesSwipeScreen /></BookFeedbackProvider>);
    const pan = mockPanCallbacks[0];
    act(() => {
      pan.onStart!({});
      pan.onUpdate!({ translationX: 0, translationY: 300 });
      pan.onEnd!({ translationX: 0, translationY: 300, velocityX: 0, velocityY: 900 });
    });
    const flight = lastFlightCall();
    fireEvent.press(ui.getByRole('button', { name: 'Back' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
    fireEvent.press(ui.getByRole('button', { name: 'Back' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
    act(() => { flight.cb(done); flight.cb(!done); });
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockMove).not.toHaveBeenCalled();
    ui.unmount();
  });

  it.each(['blur', 'unmount'])('invalidates every pending leave callback on %s', departure => {
    const onLeave = jest.fn();
    const props = stackProps({ onLeave });
    const ui = render(<NoteSwipeStack {...props} />);
    const pan = mockPanCallbacks[0];
    pan.onStart!({});
    pan.onEnd!({ translationX: 0, translationY: 300, velocityX: 0, velocityY: 900 });
    const flight = lastFlightCall();
    if (departure === 'blur') ui.rerender(<NoteSwipeStack {...props} enabled={false} />);
    else ui.unmount();
    flight.cb(true); flight.cb(false);
    expect(onLeave).not.toHaveBeenCalled();
    expect(props.onMove).not.toHaveBeenCalled();
    if (departure === 'blur') ui.unmount();
  });
});
