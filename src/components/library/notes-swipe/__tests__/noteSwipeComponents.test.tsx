import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { NoteSwipeCard, noteCardName } from '../NoteSwipeCard';
import { NoteSwipeStack } from '../NoteSwipeStack';
import { NoteFullNoteSheet } from '../NoteFullNoteSheet';
import { NoteSwipeHomeTile, nextNoteDayDelay } from '../NoteSwipeHomeTile';
import { acceptsDeckKey, parseDeckScope, reconcilePosition, deckOrder, dailyNoteSeed } from '@/features/books/notes/noteDeck';
import { NOTE_SWIPE, swipeDirection } from '@/features/books/notes/noteSwipeConstants';
import { getLibraryAppearance, MIN_TARGET } from '../../LibraryAppearance';
import { spineColorFromTitle } from '@/features/books/utils/shelfLayout';
import type { NoteDeckCard } from '@/features/books/notes/manualNoteContract';

jest.mock('@/hooks/useTheme', () => ({ useTheme: jest.fn(() => ({ phase: 'daylight' })) }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
const mockImpact = jest.fn((..._args: unknown[]) => Promise.resolve());
jest.mock('expo-haptics', () => ({ impactAsync: (...args: unknown[]) => (mockImpact as any)(...args), ImpactFeedbackStyle: { Light: 'Light' } }));
const mockScheduleOnRN = jest.fn((fn: (...a: any[]) => void, ...args: any[]) => { fn(...args); });
jest.mock('react-native-worklets', () => {
  const actual = jest.requireActual('react-native-worklets');
  return { ...actual, scheduleOnRN: (...args: any[]) => (mockScheduleOnRN as any)(...args),
    scheduleOnUI: (fn: (...args: any[]) => void, ...args: any[]) => fn(...args) };
});

type MockPanCallbacks = { onStart?: (e: any) => void; onUpdate?: (e: any) => void; onEnd?: (e: any) => void; onFinalize?: (e: any) => void };
const mockPanCallbacks: MockPanCallbacks[] = [];
const mockTapCallbacks: Array<(e: any, success: boolean) => void> = [];
const mockExclusiveCalls: unknown[][] = [];
const mockSimultaneousCalls: unknown[][] = [];
const mockNativeInstances: Record<string, jest.Mock>[] = [];
const mockDetectorGestures: unknown[] = [];
let mockPanInstances: Record<string, jest.Mock>[] = [];
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const makeChainable = (store: any) => {
    const gesture: Record<string, jest.Mock> = {};
    for (const name of ['enabled', 'minDistance', 'runOnJS']) gesture[name] = jest.fn(() => gesture);
    gesture.onStart = jest.fn((cb: any) => { store.onStart = cb; return gesture; });
    gesture.onUpdate = jest.fn((cb: any) => { store.onUpdate = cb; return gesture; });
    gesture.onEnd = jest.fn((cb: any) => { store.onEnd = cb; return gesture; });
    gesture.onFinalize = jest.fn((cb: any) => { store.onFinalize = cb; return gesture; });
    return gesture;
  };
  return {
    Gesture: {
      Pan: jest.fn(() => { const store: any = {}; mockPanCallbacks.push(store); const g = makeChainable(store); mockPanInstances.push(g); return g; }),
      Tap: jest.fn(() => {
        const gesture: Record<string, jest.Mock> = {};
        for (const name of ['enabled', 'minDistance', 'maxDistance', 'maxDuration', 'numberOfTaps', 'maxDelay', 'runOnJS']) gesture[name] = jest.fn(() => gesture);
        gesture.onEnd = jest.fn((cb: any) => { mockTapCallbacks.push(cb); return gesture; });
        return gesture;
      }),
      Native: jest.fn(() => { const store: any = {}; const g = makeChainable(store); mockNativeInstances.push(g); return g; }),
      Simultaneous: jest.fn((...args: unknown[]) => { mockSimultaneousCalls.push(args); return args[0]; }),
      Exclusive: jest.fn((...args: unknown[]) => { mockExclusiveCalls.push(args); return args[0]; }),
    },
    GestureDetector: ({ children, gesture }: { children: React.ReactNode; gesture?: unknown }) => {
      mockDetectorGestures.push(gesture);
      return <>{children}</>;
    },
    GestureHandlerRootView: ({ children, ...props }: any) => {
      const { View: RNView } = require('react-native');
      return React.createElement(RNView, props, children);
    },
  };
});
const colors = getLibraryAppearance('daylight');

function card(over: Partial<NoteDeckCard['note']> = {}): NoteDeckCard {
  return {
    note: {
      id: 'note-1',
      user_id: 'actor',
      user_book_id: 'book-1',
      content: 'A calm note body.',
      tag: 'quote',
      page_number: 42,
      created_at: '2026-10-20T00:00:00Z',
      updated_at: null,
      ...over,
    },
    book: { id: 'book-1', title: 'Hooked', authors: ['Nir Eyal'], cover_url: null },
  };
}

const MockReanimated = require('react-native-reanimated');
jest.spyOn(MockReanimated, 'withTiming').mockImplementation((value: any, _opts?: any, cb?: any) => { if (typeof cb === 'function') cb(true); return value; });
jest.spyOn(MockReanimated, 'withSpring').mockImplementation((value: any) => value);
jest.spyOn(MockReanimated, 'withSequence').mockImplementation((...args: any[]) => args[args.length - 1]);

beforeEach(() => {
  jest.clearAllMocks();
  // Reanimated retains each shared value across renders. The real measured
  // card reports its chrome height after mounting, so model that lifetime too.
  jest.spyOn(MockReanimated, 'useSharedValue').mockImplementation((initial: any) => {
    const ref = React.useRef<{ value: any } | null>(null);
    if (!ref.current) ref.current = { value: initial };
    return ref.current;
  });
  mockPanCallbacks.length = 0;
  mockTapCallbacks.length = 0;
  mockExclusiveCalls.length = 0;
  mockSimultaneousCalls.length = 0;
  mockNativeInstances.length = 0;
  mockDetectorGestures.length = 0;
  mockPanInstances = [];
  mockImpact.mockClear();
  mockScheduleOnRN.mockClear();
  (globalThis as any).__mockPanCallbacks = mockPanCallbacks;
  (globalThis as any).__mockTapCallbacks = mockTapCallbacks;
  (globalThis as any).__mockExclusiveCalls = mockExclusiveCalls;
  (globalThis as any).__mockSimultaneousCalls = mockSimultaneousCalls;
  (globalThis as any).__mockPanInstances = mockPanInstances;
  (Platform as { OS: string }).OS = 'ios';
});

describe('swipe card look, name and tokens', () => {
  it('names the top card with position, category, book and page before the visible text', () => {
    expect(noteCardName(card(), 2, 12)).toBe(
      'Note 3 of 12. Quote. From Hooked by Nir Eyal. Page 42. A calm note body.',
    );
  });

  it('truncates the accessible name to the visible text (≈200 chars with ellipsis)', () => {
    const long = 'x'.repeat(500);
    const name = noteCardName(card({ content: long }), 0, 1);
    const tail = name.split('Page 42. ')[1] ?? name;
    expect(tail.length).toBeLessThanOrEqual(201);
    expect(tail.endsWith('…')).toBe(true);
    expect(name).not.toContain(long);
    const short = noteCardName(card({ content: 'short' }), 0, 1);
    expect(short.endsWith('short')).toBe(true);
  });

  it('renders one accessible card surface with caption meta, serif body and book footer', () => {
    const ui = render(<NoteSwipeCard card={card()} />);
    const paper = ui.getByTestId('note-card-paper', { includeHiddenElements: true });
    expect(StyleSheet.flatten(paper.props.style).backgroundColor).toBe(colors.bgCard);
    expect(ui.getByText('Quote · p. 42', { includeHiddenElements: true })).toBeTruthy();
    expect(ui.getByText('A calm note body.', { includeHiddenElements: true }).props.numberOfLines).toBeGreaterThan(0);
    expect(ui.getByText('Hooked', { includeHiddenElements: true })).toBeTruthy();
    expect(ui.getByText('Nir Eyal', { includeHiddenElements: true })).toBeTruthy();
  });

  it('hides the quote mark and cover art from screen readers and uses the cloth placeholder without a cover', () => {
    const ui = render(<NoteSwipeCard card={card()} />);
    const quote = ui.getByTestId('note-quote-mark', { includeHiddenElements: true });
    expect(quote.props.accessible).toBe(false);
    const placeholder = ui.getByTestId('note-cover-placeholder', { includeHiddenElements: true });
    expect(StyleSheet.flatten(placeholder.props.style).backgroundColor).toBe(colors.coverPlaceholder);
    const spine = ui.getByTestId('note-spine-strip', { includeHiddenElements: true });
    expect(StyleSheet.flatten(spine.props.style).backgroundColor).toBeTruthy();
    expect(spine.props.children ?? null).toBeNull();
  });
});

describe('swipe stack containers, shadows and focus', () => {
  function stackProps(over: Partial<React.ComponentProps<typeof NoteSwipeStack>> = {}) {
    return {
      card: card(),
      undercards: [card({ id: 'note-2' }), card({ id: 'note-3' })],
      at: 0,
      total: 5,
      reduced: false,
      hint: false,
      enabled: true,
      onMove: jest.fn(),
      onRead: jest.fn(),
      onLeave: jest.fn(),
      ...over,
    } as React.ComponentProps<typeof NoteSwipeStack>;
  }

  it('keeps three fixed sibling slots with collapsable={false} and hides decoration', () => {
    const ui = render(<NoteSwipeStack {...stackProps()} />);
    for (const id of ['note-card-slot-0', 'note-card-slot-1', 'note-card-slot-2']) {
      const slot = ui.getByTestId(id, { includeHiddenElements: true });
      expect(slot.props.collapsable).toBe(false);
    }
    const topInner = ui.getByTestId('note-card-slot-0-inner', { includeHiddenElements: true });
    expect(topInner.props.collapsable).toBe(false);
    expect(StyleSheet.flatten(topInner.props.style).overflow).toBe('hidden');
    expect(StyleSheet.flatten(topInner.props.style).backgroundColor).toBe(colors.bgCard);
    for (const id of ['note-card-slot-1-inner', 'note-card-slot-2-inner']) {
      const inner = ui.getByTestId(id, { includeHiddenElements: true });
      expect(inner.props.collapsable).toBe(false);
      const flat = StyleSheet.flatten(inner.props.style);
      expect(flat.overflow).toBe('hidden');
      expect(flat.backgroundColor).toBe(colors.bgSecondary);
      expect(flat.borderColor).toBe(colors.controlBorder);
      expect(flat.borderWidth).toBe(1);
    }
    const background = ui.getByTestId('note-book-background', { includeHiddenElements: true });
    expect(background.props.collapsable).toBe(false);
    expect(background.props['aria-hidden']).toBe(true);
    expect(background.props.importantForAccessibility).toBe('no-hide-descendants');
    for (const id of ['note-shine', 'note-drag-hint']) {
      const layer = ui.getByTestId(id, { includeHiddenElements: true });
      expect(layer.props.collapsable).toBe(false);
      expect(layer.props['aria-hidden']).toBe(true);
      expect(layer.props.importantForAccessibility).toBe('no-hide-descendants');
    }
    expect(ui.getByTestId('note-card-slot-1', { includeHiddenElements: true }).props['aria-hidden']).toBe(true);
    expect(ui.getByTestId('note-card-slot-2', { includeHiddenElements: true }).props['aria-hidden']).toBe(true);
  });

  it('puts the shadow on a non-clipping outer wrapper, not on the overflow-hidden inner', () => {
    const ui = render(<NoteSwipeStack {...stackProps()} />);
    for (const id of ['note-card-slot-0', 'note-card-slot-1', 'note-card-slot-2']) {
      const outer = ui.getByTestId(id, { includeHiddenElements: true });
      const flat = StyleSheet.flatten(outer.props.style);
      expect(flat.shadowOpacity).toBeGreaterThan(0);
      expect(flat.overflow).not.toBe('hidden');
    }
  });

  it('keeps the top card non-focusable with a single accessible name and custom actions', () => {
    const onMove = jest.fn();
    const onRead = jest.fn();
    const ui = render(<NoteSwipeStack {...stackProps({ onMove, onRead, at: 1, total: 5 })} />);
    const top = ui.getByTestId('note-card-slot-0', { includeHiddenElements: true });
    expect(top.props.focusable).toBe(false);
    expect(top.props.accessibilityLabel).toBe(noteCardName(card(), 1, 5));
    expect(top.props.accessibilityActions).toEqual([
      { name: 'next', label: 'Next' },
      { name: 'previous', label: 'Previous' },
      { name: 'activate', label: 'Read full note' },
      { name: 'read', label: 'Read full note' },
    ]);
    top.props.onAccessibilityAction({ nativeEvent: { actionName: 'next' } });
    expect(onMove).toHaveBeenCalledWith('next');
    top.props.onAccessibilityAction({ nativeEvent: { actionName: 'previous' } });
    expect(onMove).toHaveBeenCalledWith('previous');
    top.props.onAccessibilityAction({ nativeEvent: { actionName: 'read' } });
    expect(onRead).toHaveBeenCalledTimes(1);
  });

  it('rejects keys on real buttons/fields but allows them after clicking the non-focusable card', () => {
    const button = { closest: (selector: string) => (selector.includes('button') ? {} : null) };
    expect(acceptsDeckKey({ key: 'ArrowRight', target: button }, false)).toBe(false);
    expect(acceptsDeckKey({ key: 'ArrowRight', target: { closest: () => null } }, false)).toBe(true);
    const ui = render(<NoteSwipeStack {...stackProps()} />);
    const top = ui.getByTestId('note-card-slot-0', { includeHiddenElements: true });
    expect(top.props.focusable).toBe(false);
  });

  it('keeps web cards non-selectable with touch-action none', () => {
    const priorOS = Platform.OS;
    (Platform as { OS: string }).OS = 'web';
    try {
      const ui = render(<NoteSwipeStack {...stackProps()} />);
      const top = ui.getByTestId('note-card-slot-0', { includeHiddenElements: true });
      const style = StyleSheet.flatten(top.props.style);
      expect(style).toMatchObject({ userSelect: 'none', touchAction: 'none' });
    } finally {
      (Platform as { OS: string }).OS = priorOS;
    }
  });
});

describe('swipe gesture runs pan callbacks with constants, spring-back, busy guard and Exclusive', () => {
  it('prioritizes double tap collection selection and retains the accessible read and collection actions', () => {
    const onRead = jest.fn(), onCollections = jest.fn();
    const view = render(<NoteSwipeStack card={card()} undercards={[]} at={0} total={3} reduced={false} hint={false} enabled onMove={jest.fn()} onRead={onRead} onCollections={onCollections} onLeave={jest.fn()} />);
    const composition = mockExclusiveCalls[mockExclusiveCalls.length - 1] as any[];
    expect(composition).toHaveLength(3);
    expect(composition[1].numberOfTaps).toHaveBeenCalledWith(2);
    expect(composition[1].maxDelay).toHaveBeenCalledWith(250);
    mockTapCallbacks[mockTapCallbacks.length - 1]({}, true);
    expect(onCollections).toHaveBeenCalledTimes(1); expect(onRead).not.toHaveBeenCalled();
    const surface = view.getByTestId('note-card-slot-0', { includeHiddenElements: true });
    expect(surface.props.accessibilityActions).toContainEqual({ name: 'collections', label: 'Add to collection' });
    surface.props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } });
    expect(onRead).toHaveBeenCalledTimes(1);
  });
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

  it('uses the single constants file (10px lock, 12deg tilt, 30%/20%/800) and freezes it', () => {
    expect(NOTE_SWIPE).toMatchObject({
      axisLock: 10,
      maxTilt: 12,
      horizontalFraction: 0.3,
      verticalFraction: 0.2,
      velocity: 800,
      batchSize: 20,
      pageSize: 1000,
    });
    expect(Object.isFrozen(NOTE_SWIPE)).toBe(true);
    const onMove = jest.fn();
    render(<NoteSwipeStack {...stackProps({ onMove, at: 1, total: 2 })} />);
    expect(mockPanInstances.length).toBeGreaterThan(0);
    const lastPan = mockPanInstances[mockPanInstances.length - 1];
    expect(lastPan.minDistance).toHaveBeenCalledWith(NOTE_SWIPE.axisLock);
    expect(lastPan.enabled).toHaveBeenCalled();
  });

  it('maps drags to next/previous/leave/category from the thresholds (C3 swipe-up)', () => {
    expect(swipeDirection(1, -40, 0, -900, 0, 100, 800)).toBe('next');
    expect(swipeDirection(1, 40, 0, 900, 0, 100, 800)).toBe('previous');
    expect(swipeDirection(2, 0, 200, 0, 900, 100, 800)).toBe('leave');
    expect(swipeDirection(2, 0, -200, 0, -900, 100, 800)).toBe('category');
    expect(swipeDirection(2, 0, -10, 0, -900, 100, 800)).toBe('category');
    expect(swipeDirection(2, 0, -10, 0, 900, 100, 800)).toBe('cancel');
    expect(swipeDirection(2, 0, -5, 0, 0, 100, 800)).toBe('cancel');
    expect(swipeDirection(1, 0, -200, 0, -900, 100, 800)).toBe('cancel');
    expect(swipeDirection(1, -5, 0, 0, 0, 100, 800)).toBe('cancel');
    expect(swipeDirection(1, 10, 0, -900, 0, 100, 800)).toBe('cancel');
    expect(swipeDirection(1, 10, 0, 900, 0, 100, 800)).toBe('previous');
  });

  it('runs onStart/onUpdate/onEnd/onFinalize with axis lock, Exclusive(pan,tap) and haptics bridge', () => {
    const onMove = jest.fn();
    const onRead = jest.fn();
    render(<NoteSwipeStack {...stackProps({ onMove, onRead, at: 1, total: 2 })} />);
    expect(mockPanCallbacks.length).toBeGreaterThan(0);
    const pan = mockPanCallbacks[mockPanCallbacks.length - 1];
    expect(typeof pan.onStart).toBe('function');
    expect(typeof pan.onUpdate).toBe('function');
    expect(typeof pan.onEnd).toBe('function');
    expect(typeof pan.onFinalize).toBe('function');
    expect(mockExclusiveCalls.length).toBeGreaterThan(0);
    const lastExclusive = mockExclusiveCalls[mockExclusiveCalls.length - 1];
    expect(lastExclusive.length).toBe(2);
    expect((lastExclusive[0] as any).onUpdate).toBeDefined();
    expect((lastExclusive[1] as any).onUpdate).not.toBeDefined();
    pan.onStart!({} as any);
    pan.onUpdate!({ translationX: 3, translationY: 1 } as any);
    pan.onUpdate!({ translationX: 40, translationY: 5 } as any);
    pan.onEnd!({ translationX: 40, translationY: 5, velocityX: 900, velocityY: 0 } as any);
    expect(onMove).toHaveBeenCalledWith('previous');
    expect(mockImpact).toHaveBeenCalled();
    expect(mockScheduleOnRN).toHaveBeenCalled();
    const onMove2 = jest.fn();
    render(<NoteSwipeStack {...stackProps({ onMove: onMove2, at: 0, total: 2 })} />);
    const pan2 = mockPanCallbacks[mockPanCallbacks.length - 1];
    pan2.onStart!({} as any);
    pan2.onUpdate!({ translationX: -50, translationY: 2 } as any);
    pan2.onEnd!({ translationX: -50, translationY: 2, velocityX: -900, velocityY: 0 } as any);
    expect(onMove2).toHaveBeenCalledWith('next');
  });

  it('springs back on cancel and guards busy', () => {
    const onMove = jest.fn();
    render(<NoteSwipeStack {...stackProps({ onMove })} />);
    const pan = mockPanCallbacks[mockPanCallbacks.length - 1];
    const Reanimated = require('react-native-reanimated');
    Reanimated.withSpring.mockClear();
    pan.onStart!({} as any);
    pan.onUpdate!({ translationX: 2, translationY: 1 } as any);
    pan.onEnd!({ translationX: 2, translationY: 1, velocityX: 0, velocityY: 0 } as any);
    expect(Reanimated.withSpring).toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();
  });

  it('flies the current card off left for next but slides the previous in from the left', () => {
    const Reanimated = require('react-native-reanimated');
    const onMoveNext = jest.fn();
    render(<NoteSwipeStack {...stackProps({ onMove: onMoveNext, at: 0, total: 2 })} />);
    const panNext = mockPanCallbacks[mockPanCallbacks.length - 1];
    Reanimated.withTiming.mockClear();
    panNext.onStart!({} as any);
    panNext.onUpdate!({ translationX: -60, translationY: 0 } as any);
    panNext.onEnd!({ translationX: -60, translationY: 0, velocityX: -900, velocityY: 0 } as any);
    const timingCallsNext = (Reanimated.withTiming as jest.Mock).mock.calls.map((c: any[]) => c[0]);
    expect(timingCallsNext.some((v: unknown) => typeof v === 'number' && v < -100)).toBe(true);
    expect(onMoveNext).toHaveBeenCalledWith('next');
    // Previous: the current card is NOT flown off to the right; the previous card slides in from the left.
    // Track the shared x translation so the slide-in entry (starts at -width, ends at 0) is really exercised.
    const xSets: number[] = [];
    const xHolder = { _v: 0 };
    const xObj = {};
    Object.defineProperty(xObj, 'value', {
      get() { return (xHolder as any)._v; },
      set(v: number) { (xHolder as any)._v = v; if (typeof v === 'number') xSets.push(v); },
      configurable: true,
    });
    const origSV = Reanimated.useSharedValue;
    let svCalls = 0;
    const svSpy = jest.spyOn(Reanimated, 'useSharedValue').mockImplementation((initial: any) => {
      const idx = svCalls++ % 11;
      const ref = React.useRef<any>(null);
      if (!ref.current) ref.current = idx === 0 ? xObj : { value: initial };
      return ref.current;
    });
    try {
      const onMovePrev = jest.fn();
      const prevFirst = card({ id: 'note-prev' });
      const prevSecond = card({ id: 'note-cur' });
      const uiPrev = render(<NoteSwipeStack {...stackProps({ onMove: onMovePrev, at: 1, total: 2, card: prevSecond, undercards: [prevFirst] })} />);
      const panPrev = mockPanCallbacks[mockPanCallbacks.length - 1];
      Reanimated.withTiming.mockClear();
      xSets.length = 0;
      panPrev.onStart!({} as any);
      panPrev.onUpdate!({ translationX: 60, translationY: 0 } as any);
      panPrev.onEnd!({ translationX: 60, translationY: 0, velocityX: 900, velocityY: 0 } as any);
      const timingCallsPrev = (Reanimated.withTiming as jest.Mock).mock.calls.map((c: any[]) => c[0]);
      expect(timingCallsPrev.some((v: unknown) => typeof v === 'number' && v > 100)).toBe(false);
      expect(onMovePrev).toHaveBeenCalledWith('previous');
      // Rerender with the previous card so the slide-in effect runs: entry starts from -width and ends at 0.
      Reanimated.withTiming.mockClear();
      xSets.length = 0;
      uiPrev.rerender(<NoteSwipeStack {...stackProps({ onMove: onMovePrev, at: 0, total: 2, card: prevFirst, undercards: [prevSecond] })} />);
      expect(xSets.some(v => typeof v === 'number' && v < -100)).toBe(true);
      const entryCalls = (Reanimated.withTiming as jest.Mock).mock.calls;
      expect(entryCalls.some((c: any[]) => c[0] === 0 && c[1]?.duration === NOTE_SWIPE.exitMs)).toBe(true);
      expect(entryCalls.some((c: any[]) => typeof c[0] === 'number' && c[0] > 100)).toBe(false);
      uiPrev.unmount();
    } finally {
      svSpy.mockRestore();
    }
  });

  it('cross-fades with opacity only when reduced motion is on (no translate/tilt/shine/wiggle)', () => {
    const Reanimated = require('react-native-reanimated');
    const onMove = jest.fn();
    const ui = render(<NoteSwipeStack {...stackProps({ onMove, reduced: true, at: 0, total: 2 })} />);
    const pan = mockPanCallbacks[mockPanCallbacks.length - 1];
    Reanimated.withTiming.mockClear();
    (Reanimated.withSpring as jest.Mock).mockClear();
    (Reanimated.withSequence as jest.Mock).mockClear();
    pan.onStart!({} as any);
    pan.onUpdate!({ translationX: -60, translationY: 0 } as any);
    pan.onEnd!({ translationX: -60, translationY: 0, velocityX: -900, velocityY: 0 } as any);
    expect(onMove).toHaveBeenCalledWith('next');
    const timingCalls = (Reanimated.withTiming as jest.Mock).mock.calls;
    // Opacity cross-fade specifically: withTiming(0, { duration: crossFadeMs }).
    expect(timingCalls.some((c: any[]) => c[0] === 0 && c[1]?.duration === NOTE_SWIPE.crossFadeMs)).toBe(true);
    // No translate fly-off (exitMs) and no background fade.
    expect(timingCalls.some((c: any[]) => c[1]?.duration === NOTE_SWIPE.exitMs)).toBe(false);
    expect(timingCalls.some((c: any[]) => c[1]?.duration === NOTE_SWIPE.backgroundMs)).toBe(false);
    expect(Reanimated.withSequence).not.toHaveBeenCalled();
    expect(Reanimated.withSpring).not.toHaveBeenCalled();
    // No tilt/shine: undercards stay at 0deg, shine and drag hints stay at opacity 0.
    const underOuter = ui.getByTestId('note-card-slot-1', { includeHiddenElements: true });
    expect(JSON.stringify(StyleSheet.flatten(underOuter.props.style).transform ?? '')).toContain('0deg');
    const shine = ui.getByTestId('note-shine', { includeHiddenElements: true });
    expect(JSON.stringify(shine.props.style)).toContain('"opacity":0');
    ui.unmount();
  });

  it('disables tilt, shine, wiggle and fade when reduced motion is on', () => {
    const Reanimated = require('react-native-reanimated');
    Reanimated.withTiming.mockClear();
    Reanimated.withSequence.mockClear();
    const uiReduced = render(<NoteSwipeStack {...stackProps({ reduced: true, hint: true, at: 0, total: 2 })} />);
    const underOuter = uiReduced.getByTestId('note-card-slot-1', { includeHiddenElements: true });
    const underFlat = StyleSheet.flatten(underOuter.props.style);
    const underTransform = JSON.stringify(underFlat.transform ?? underFlat);
    expect(underTransform).toContain('0deg');
    expect(underTransform).not.toContain('-3deg');
    expect(Reanimated.withSequence).not.toHaveBeenCalled();
    const bgCalls = (Reanimated.withTiming as jest.Mock).mock.calls.filter((c: any[]) => c[1]?.duration === NOTE_SWIPE.backgroundMs);
    expect(bgCalls.length).toBe(0);
    uiReduced.unmount();
    Reanimated.withTiming.mockClear();
    Reanimated.withSequence.mockClear();
    const uiFull = render(<NoteSwipeStack {...stackProps({ reduced: false, hint: true, at: 0, total: 2 })} />);
    expect(Reanimated.withSequence).toHaveBeenCalled();
    const bgCallsFull = (Reanimated.withTiming as jest.Mock).mock.calls.filter((c: any[]) => c[1]?.duration === NOTE_SWIPE.backgroundMs);
    expect(bgCallsFull.length).toBeGreaterThan(0);
    uiFull.unmount();
  });
});

describe('swipe keyboard gating and scope parsing', () => {
  it('ignores keys while a sheet is open, with modifiers, or on fields and buttons', () => {
    const button = { closest: (selector: string) => (selector.includes('button') ? {} : null) };
    expect(acceptsDeckKey({ key: 'ArrowRight', target: null }, true)).toBe(false);
    expect(acceptsDeckKey({ key: 'ArrowRight', target: null, defaultPrevented: true }, false)).toBe(false);
    expect(acceptsDeckKey({ key: 'ArrowRight', target: null, ctrlKey: true }, false)).toBe(false);
    expect(acceptsDeckKey({ key: 'ArrowRight', target: button }, false)).toBe(false);
    expect(
      acceptsDeckKey({ key: 'ArrowRight', target: { closest: () => null } }, false),
    ).toBe(true);
    expect(acceptsDeckKey({ key: 'a', target: { closest: () => null } }, false)).toBe(false);
  });

  it('accepts keys on the deck surface after mouse focus but still ignores real buttons/fields', () => {
    const deckCard = { closest: (selector: string) => (selector.includes('data-note-deck-card') ? {} : null), isContentEditable: false };
    const realButton = {
      closest: (selector: string) => (selector.includes('data-note-deck-card') ? null : selector.includes('button') ? {} : null),
      isContentEditable: false,
    };
    const realInput = {
      closest: (selector: string) => (selector.includes('data-note-deck-card') ? null : selector.includes('input') ? {} : null),
      isContentEditable: false,
    };
    const realLink = {
      closest: (selector: string) => (selector.includes('data-note-deck-card') ? null : selector.includes(',a,') || selector.includes('[href]') ? {} : null),
      isContentEditable: false,
    };
    // After mousedown/click/drag focus on the card (which carries role="button"), arrows/Enter still act.
    expect(acceptsDeckKey({ key: 'ArrowRight', target: deckCard }, false)).toBe(true);
    expect(acceptsDeckKey({ key: 'ArrowLeft', target: deckCard }, false)).toBe(true);
    expect(acceptsDeckKey({ key: 'Enter', target: deckCard }, false)).toBe(true);
    // On a real button, link or field the keys stay ignored.
    expect(acceptsDeckKey({ key: 'ArrowRight', target: realButton }, false)).toBe(false);
    expect(acceptsDeckKey({ key: 'Enter', target: realButton }, false)).toBe(false);
    expect(acceptsDeckKey({ key: 'ArrowRight', target: realInput }, false)).toBe(false);
    expect(acceptsDeckKey({ key: 'ArrowRight', target: realLink }, false)).toBe(false);
    // The top card carries the deck-surface marker so mouse focus does not block keys.
    const ui = render(<NoteSwipeStack {...(() => {
      const p = {
        card: card(), undercards: [], at: 0, total: 1, reduced: false, hint: false,
        enabled: true, onMove: jest.fn(), onRead: jest.fn(), onLeave: jest.fn(),
      } as React.ComponentProps<typeof NoteSwipeStack>;
      return p;
    })()} />);
    const priorOS = Platform.OS;
    (Platform as any).OS = 'web';
    try {
      const uiWeb = render(<NoteSwipeStack {...(() => {
        const p = {
          card: card(), undercards: [], at: 0, total: 1, reduced: false, hint: false,
          enabled: true, onMove: jest.fn(), onRead: jest.fn(), onLeave: jest.fn(),
        } as React.ComponentProps<typeof NoteSwipeStack>;
        return p;
      })()} />);
      const top = uiWeb.getByTestId('note-card-slot-0', { includeHiddenElements: true });
      expect(top.props['data-note-deck-card']).toBe('true');
      uiWeb.unmount();
    } finally {
      (Platform as any).OS = priorOS;
    }
    ui.unmount();
  });

  it('parses the scope in one place, defaults unknown scopes and never broadens a missing book', () => {
    expect(parseDeckScope({ scope: 'book', userBookId: 'book-1' })).toEqual({ kind: 'book', userBookId: 'book-1' });
    expect(parseDeckScope({ scope: 'unknown', userBookId: 'book-1' })).toEqual({ kind: 'all' });
    expect(parseDeckScope({ scope: 'book' })).toEqual({ kind: 'book', userBookId: '' });
  });

  it('keeps an unset deck position distinct from the end card', () => {
    expect(reconcilePosition([], [], undefined)).toBeUndefined();
    expect(reconcilePosition([], ['a'], undefined)).toBe('a');
    expect(reconcilePosition(['a'], ['a', 'b'], 'a')).toBe('a');
  });
});

describe('full-note sheet and home tile structure', () => {
  it('focuses Close when the full-note dialog shows on web', () => {
    (Platform as { OS: string }).OS = 'web';
    const previousWindow = (global as any).window;
    (global as any).window = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
    const { Modal } = require('react-native');
    const { fireEvent } = require('@testing-library/react-native');
    const { BookFeedbackProvider } = require('../../ui');
    const ui = render(<BookFeedbackProvider><NoteFullNoteSheet card={card()} reduced onClose={jest.fn()} onOpenNote={jest.fn()} onOpenBook={jest.fn()} /></BookFeedbackProvider>);
    try {
      const close = ui.getByRole('button', { name: 'Close full note' });
      const focus = close.parent!.instance.focus;
      focus.mockClear();
      fireEvent(ui.UNSAFE_getAllByType(Modal).find(node => node.props.animationType === 'none')!, 'show');
      expect(focus).toHaveBeenCalledTimes(1);
    } finally { ui.unmount(); (global as any).window = previousWindow; }
  });
  it('opens the note as the sheet primary with Open book secondary and toasts inside', () => {
    const { BookFeedbackProvider } = require('../../ui');
    const ui = render(
      <BookFeedbackProvider>
        <NoteFullNoteSheet card={card()} reduced={false} onClose={jest.fn()} onOpenNote={jest.fn()} onOpenBook={jest.fn()} />
      </BookFeedbackProvider>,
    );
    expect(ui.getByRole('button', { name: 'Open note' })).toBeOnTheScreen();
    expect(ui.getByRole('button', { name: 'Open book' })).toBeOnTheScreen();
    expect(ui.getByTestId('note-full-sheet', { includeHiddenElements: true })).toBeTruthy();
  });

  it('carries a ≥48dp grabber header that is hidden from screen readers and uses constants', () => {
    const { BookFeedbackProvider } = require('../../ui');
    const ui = render(
      <BookFeedbackProvider>
        <NoteFullNoteSheet card={card()} reduced={false} onClose={jest.fn()} onOpenNote={jest.fn()} onOpenBook={jest.fn()} />
      </BookFeedbackProvider>,
    );
    const handle = ui.getByTestId('note-sheet-handle', { includeHiddenElements: true });
    const flat = StyleSheet.flatten(handle.props.style);
    expect(flat.minHeight).toBeGreaterThanOrEqual(MIN_TARGET);
    const grabber = ui.getByTestId('note-sheet-grabber', { includeHiddenElements: true });
    expect(grabber.props.accessible).toBe(false);
    expect(grabber.props['aria-hidden']).toBe(true);
    expect(NOTE_SWIPE.verticalFraction).toBe(0.2);
    expect(NOTE_SWIPE.velocity).toBe(800);
    expect(NOTE_SWIPE.axisLock).toBe(10);
    ui.unmount();
  });

  it('uses separate gesture instances with the native gesture only on the ScrollView', () => {
    const { BookFeedbackProvider } = require('../../ui');
    const { Gesture } = require('react-native-gesture-handler');
    (Gesture.Pan as jest.Mock).mockClear();
    (Gesture.Native as jest.Mock).mockClear();
    mockDetectorGestures.length = 0;
    mockNativeInstances.length = 0;
    mockSimultaneousCalls.length = 0;
    const ui = render(
      <BookFeedbackProvider>
        <NoteFullNoteSheet card={card()} reduced={false} onClose={jest.fn()} onOpenNote={jest.fn()} onOpenBook={jest.fn()} />
      </BookFeedbackProvider>,
    );
    expect(Gesture.Pan).toHaveBeenCalled();
    expect(Gesture.Native).toHaveBeenCalledTimes(1);
    expect(mockNativeInstances.length).toBe(1);
    expect(mockSimultaneousCalls.length).toBe(0);
    expect(mockDetectorGestures.length).toBeGreaterThanOrEqual(2);
    const unique = new Set(mockDetectorGestures);
    expect(unique.size).toBe(mockDetectorGestures.length);
    ui.unmount();
  });

  it('dismisses from the header grabber regardless of scroll position and resets the flag on reopen', () => {
    const { BookFeedbackProvider } = require('../../ui');
    const { fireEvent } = require('@testing-library/react-native');
    const onClose = jest.fn();
    const ui = render(
      <BookFeedbackProvider>
        <NoteFullNoteSheet card={card()} reduced={false} onClose={onClose} onOpenNote={jest.fn()} onOpenBook={jest.fn()} />
      </BookFeedbackProvider>,
    );
    const { ScrollView } = require('react-native');
    const scroll = ui.UNSAFE_getByType(ScrollView);
    fireEvent(scroll, 'scroll', { nativeEvent: { contentOffset: { y: 120 } } });
    // Header pan still dismisses even though the content is scrolled (no atTop gate).
    const headerPan = mockPanCallbacks[mockPanCallbacks.length - 1];
    expect(typeof headerPan.onEnd).toBe('function');
    headerPan.onEnd!({ translationY: 500, velocityY: 900 } as any);
    expect(onClose).toHaveBeenCalledTimes(1);
    ui.unmount();
    // Reopen with a short note: swipe-down still dismisses (flag was reset, not stuck not-at-top).
    onClose.mockClear();
    mockPanCallbacks.length = 0;
    const ui2 = render(
      <BookFeedbackProvider>
        <NoteFullNoteSheet card={card({ content: 'short' })} reduced={false} onClose={onClose} onOpenNote={jest.fn()} onOpenBook={jest.fn()} />
      </BookFeedbackProvider>,
    );
    const headerPan2 = mockPanCallbacks[mockPanCallbacks.length - 1];
    headerPan2.onEnd!({ translationY: 500, velocityY: 900 } as any);
    expect(onClose).toHaveBeenCalledTimes(1);
    ui2.unmount();
  });

  it('bounds the home tile by line counts with a 48dp target and pluralises the count', async () => {
    const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
    const deckModule = require('@/features/books/notes/useNoteDeck');
    const cacheModule = require('@/features/books/notes/noteDeckCache');
    const React = require('react');
    const { fireEvent, waitFor } = require('@testing-library/react-native');
    const one: any = { id: 'one', user_id: 'actor', user_book_id: 'b', tag: null, created_at: '2026-10-20T00:00:00Z' };
    const indexSpy = jest.spyOn(deckModule, 'useNoteDeckIndex').mockReturnValue({ data: [one], isPending: false, isError: false } as any);
    const cardsSpy = jest.spyOn(cacheModule, 'loadDeckCards').mockResolvedValue([{ note: { ...one, content: 'hello', user_id: 'actor' }, book: { id: 'b', title: 'T', authors: [] } } as any]);
    const onPress = jest.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const ui = render(
      React.createElement(QueryClientProvider, { client }, React.createElement(NoteSwipeHomeTile, { actorId: 'actor', onPress })),
    );
    await waitFor(() => expect(ui.queryByTestId('note-swipe-home-tile')).toBeTruthy());
    expect(ui.getByText('Your notes · 1 note', { includeHiddenElements: true })).toBeTruthy();
    const hello = ui.getByText('hello', { includeHiddenElements: true });
    expect(hello.props.numberOfLines).toBe(2);
    expect(ui.getByText('Your notes · 1 note', { includeHiddenElements: true }).props.numberOfLines).toBe(1);
    expect(ui.getByText('T', { includeHiddenElements: true }).props.numberOfLines).toBe(1);
    const tile = ui.getByTestId('note-swipe-home-tile');
    const flat = StyleSheet.flatten(tile.props.style);
    expect(flat.minHeight).toBeGreaterThanOrEqual(MIN_TARGET);
    fireEvent.press(tile);
    expect(onPress).toHaveBeenCalledTimes(1);
    ui.unmount();
    indexSpy.mockRestore();
    cardsSpy.mockRestore();
    client.clear();
  });

  it('hides the home tile for no notes, loading, failure and hidden', async () => {
    const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
    const deckModule = require('@/features/books/notes/useNoteDeck');
    const cacheModule = require('@/features/books/notes/noteDeckCache');
    const React = require('react');
    const { waitFor } = require('@testing-library/react-native');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const renderTile = (indexValue: any, hidden = false) => {
      const indexSpy = jest.spyOn(deckModule, 'useNoteDeckIndex').mockReturnValue(indexValue);
      const cardsSpy = jest.spyOn(cacheModule, 'loadDeckCards').mockResolvedValue([]);
      const ui = render(
        React.createElement(QueryClientProvider, { client }, React.createElement(NoteSwipeHomeTile, { actorId: 'actor', hidden, onPress: jest.fn() })),
      );
      return { ui, indexSpy, cardsSpy };
    };
    let r = renderTile({ data: [], isPending: false, isError: false } as any);
    expect(r.ui.queryByTestId('note-swipe-home-tile')).toBeNull();
    r.ui.unmount(); r.indexSpy.mockRestore(); r.cardsSpy.mockRestore();
    r = renderTile({ data: undefined, isPending: true, isError: false } as any);
    expect(r.ui.queryByTestId('note-swipe-home-tile')).toBeNull();
    r.ui.unmount(); r.indexSpy.mockRestore(); r.cardsSpy.mockRestore();
    r = renderTile({ data: undefined, isPending: false, isError: true } as any);
    expect(r.ui.queryByTestId('note-swipe-home-tile')).toBeNull();
    r.ui.unmount(); r.indexSpy.mockRestore(); r.cardsSpy.mockRestore();
    r = renderTile({ data: [{ id: 'one', user_id: 'actor', user_book_id: 'b', tag: null, created_at: '2026-10-20T00:00:00Z' }], isPending: false, isError: false } as any, true);
    expect(r.ui.queryByTestId('note-swipe-home-tile')).toBeNull();
    r.ui.unmount(); r.indexSpy.mockRestore(); r.cardsSpy.mockRestore();
    client.clear();
    const fs = require('fs');
    const path = require('path');
    const indexSrc = fs.readFileSync(path.join(__dirname, '../../../../../app/(tabs)/library/index.tsx'), 'utf8');
    expect(indexSrc).toContain('!arrangement.active');
    expect(indexSrc).toContain('NoteSwipeHomeTile');
  });

  it('keeps the daily seed stable within a day and changing at local midnight with explicit zones', () => {
    expect(dailyNoteSeed('America/New_York', new Date('2026-06-15T03:59:00Z'))).toBe(dailyNoteSeed('America/New_York', new Date('2026-06-15T03:00:00Z')));
    expect(dailyNoteSeed('America/New_York', new Date('2026-06-15T04:00:00Z'))).not.toBe(dailyNoteSeed('America/New_York', new Date('2026-06-15T03:59:00Z')));
    expect(dailyNoteSeed('Asia/Kolkata', new Date('2026-12-31T18:29:00Z'))).toBe('2026-12-31');
    expect(dailyNoteSeed('Asia/Kolkata', new Date('2026-12-31T18:30:00Z'))).toBe('2027-01-01');
  });

  it('computes the next day delay across a DST change with an explicit zone', () => {
    const before = new Date('2026-03-07T06:00:00Z');
    const delay = nextNoteDayDelay('America/New_York', before);
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(27 * 60 * 60 * 1000);
    const springForward = new Date('2026-03-08T06:30:00Z');
    expect(nextNoteDayDelay('America/New_York', springForward)).toBeGreaterThan(0);
  });

  it('does not recompute the daily pick on rerender with unchanged inputs (memoised)', async () => {
    const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
    const deckModule = require('@/features/books/notes/useNoteDeck');
    const cacheModule = require('@/features/books/notes/noteDeckCache');
    const orderModule = require('@/features/books/notes/noteDeck');
    const React = require('react');
    const { waitFor } = require('@testing-library/react-native');
    const one: any = { id: 'one', user_id: 'actor', user_book_id: 'b', tag: null, created_at: '2026-10-20T00:00:00Z' };
    const two: any = { id: 'two', user_id: 'actor', user_book_id: 'b', tag: null, created_at: '2026-10-21T00:00:00Z' };
    const indexValue = { data: [one], isPending: false, isError: false } as any;
    const indexSpy = jest.spyOn(deckModule, 'useNoteDeckIndex').mockReturnValue(indexValue);
    const cardsSpy = jest.spyOn(cacheModule, 'loadDeckCards').mockImplementation((async (...args: any[]) => {
      const ids = args[2] as string[];
      return ids.map(id => ({ note: { ...(id === 'two' ? two : one), content: `hello-${id}`, user_id: 'actor' }, book: { id: 'b', title: 'T', authors: [] } } as any));
    }) as any);
    const orderSpy = jest.spyOn(orderModule, 'deckOrder');
    orderSpy.mockClear();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const tilePress = jest.fn();
    const ui = render(React.createElement(QueryClientProvider, { client }, React.createElement(NoteSwipeHomeTile, { actorId: 'actor', onPress: tilePress })));
    await waitFor(() => expect(ui.queryByTestId('note-swipe-home-tile')).toBeTruthy());
    const afterMount = orderSpy.mock.calls.length;
    expect(afterMount).toBeGreaterThan(0);
    // Rerender with a NEW element (new props object, same values): React must re-render,
    // but the memoised daily pick must not recompute deckOrder.
    ui.rerender(React.createElement(QueryClientProvider, { client }, React.createElement(NoteSwipeHomeTile, { actorId: 'actor', onPress: tilePress })));
    await waitFor(() => expect(ui.queryByTestId('note-swipe-home-tile')).toBeTruthy());
    expect(orderSpy.mock.calls.length).toBe(afterMount);
    const changed = { data: [one, two], isPending: false, isError: false } as any;
    indexSpy.mockReturnValue(changed);
    ui.rerender(React.createElement(QueryClientProvider, { client }, React.createElement(NoteSwipeHomeTile, { actorId: 'actor', onPress: jest.fn() })));
    await waitFor(() => expect(ui.queryByTestId('note-swipe-home-tile')).toBeTruthy());
    expect(orderSpy.mock.calls.length).toBeGreaterThan(afterMount);
    ui.unmount();
    indexSpy.mockRestore();
    cardsSpy.mockRestore();
    orderSpy.mockRestore();
    client.clear();
  });

  it('renders the home tile with zero console.error calls', async () => {
    const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
    const deckModule = require('@/features/books/notes/useNoteDeck');
    const cacheModule = require('@/features/books/notes/noteDeckCache');
    const React = require('react');
    const { waitFor } = require('@testing-library/react-native');
    const one: any = { id: 'one', user_id: 'actor', user_book_id: 'b', tag: null, created_at: '2026-10-20T00:00:00Z' };
    const indexSpy = jest.spyOn(deckModule, 'useNoteDeckIndex').mockReturnValue({ data: [one], isPending: false, isError: false } as any);
    const cardsSpy = jest.spyOn(cacheModule, 'loadDeckCards').mockResolvedValue([{ note: { ...one, content: 'hello', user_id: 'actor' }, book: { id: 'b', title: 'T', authors: [] } } as any]);
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    try {
      const ui = render(React.createElement(QueryClientProvider, { client }, React.createElement(NoteSwipeHomeTile, { actorId: 'actor', onPress: jest.fn() })));
      await waitFor(() => expect(ui.queryByTestId('note-swipe-home-tile')).toBeTruthy());
      expect(err).not.toHaveBeenCalled();
      ui.unmount();
    } finally {
      err.mockRestore();
      indexSpy.mockRestore();
      cardsSpy.mockRestore();
      client.clear();
    }
  });

  it('keeps home-tile decorative layers inside the tile box so they cannot steal Continue-card taps', async () => {
    const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
    const deckModule = require('@/features/books/notes/useNoteDeck');
    const cacheModule = require('@/features/books/notes/noteDeckCache');
    const React = require('react');
    const { waitFor } = require('@testing-library/react-native');
    const one: any = { id: 'one', user_id: 'actor', user_book_id: 'b', tag: null, created_at: '2026-10-20T00:00:00Z' };
    const indexSpy = jest.spyOn(deckModule, 'useNoteDeckIndex').mockReturnValue({ data: [one], isPending: false, isError: false } as any);
    const cardsSpy = jest.spyOn(cacheModule, 'loadDeckCards').mockResolvedValue([{ note: { ...one, content: 'hello', user_id: 'actor' }, book: { id: 'b', title: 'T', authors: [] } } as any]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const ui = render(React.createElement(QueryClientProvider, { client }, React.createElement(NoteSwipeHomeTile, { actorId: 'actor', onPress: jest.fn() })));
    try {
    await waitFor(() => expect(ui.queryByTestId('note-swipe-home-tile')).toBeTruthy());
    for (const id of ['note-home-under-0', 'note-home-under-1', 'note-home-underclip']) {
      const layer = ui.getByTestId(id, { includeHiddenElements: true });
      expect(layer.props.pointerEvents).toBe('none');
      const flat = StyleSheet.flatten(layer.props.style);
      for (const key of ['marginTop', 'marginBottom', 'marginVertical', 'top', 'bottom'] as const) {
        const v = (flat as any)?.[key];
        if (typeof v === 'number') expect(v).toBeGreaterThanOrEqual(0);
      }
    }
    const tile = ui.getByTestId('note-swipe-home-tile');
    const tileFlat = StyleSheet.flatten(tile.props.style);
    expect((tileFlat as any)?.overflow).toBe('hidden');
    // The front occupies the padded content box; both undercards must expose
    // edges beyond it while their offsets remain inside the tile's own bounds.
    const frontBottom = tileFlat.paddingBottom ?? 0;
    const frontSide = tileFlat.paddingHorizontal ?? 0;
    const bottoms: number[] = [];
    for (const id of ['note-home-under-0', 'note-home-under-1']) {
      const edge = StyleSheet.flatten(ui.getByTestId(id, { includeHiddenElements: true }).props.style);
      expect(edge.bottom).toBeGreaterThanOrEqual(0);
      expect(edge.bottom).toBeLessThan(frontBottom);
      expect(edge.left).toBeGreaterThanOrEqual(0);
      expect(edge.left).toBeLessThan(frontSide);
      expect(edge.right).toBeGreaterThanOrEqual(0);
      expect(edge.right).toBeLessThan(frontSide);
      bottoms.push(edge.bottom as number);
    }
    expect(bottoms[0]).not.toBe(bottoms[1]);
    const upper = StyleSheet.flatten(ui.getByTestId('note-home-under-0', { includeHiddenElements: true }).props.style);
    const lower = StyleSheet.flatten(ui.getByTestId('note-home-under-1', { includeHiddenElements: true }).props.style);
    expect(upper.zIndex).toBeGreaterThan(lower.zIndex);
    for (const key of ['marginTop', 'marginBottom', 'marginVertical', 'margin', 'top'] as const) {
      const v = (tileFlat as any)?.[key];
      if (typeof v === 'number') expect(v).toBeGreaterThanOrEqual(0);
    }
    expect(JSON.stringify(tileFlat)).not.toContain('-');
    } finally {
      ui.unmount();
      indexSpy.mockRestore();
      cardsSpy.mockRestore();
      client.clear();
    }
  });

  it('distinguishes undercards from the top card with a darker surface token and a control border', () => {
    const ui = render(<NoteSwipeStack {...(() => {
      const c = card();
      const u1 = card({ id: 'note-2' });
      const u2 = card({ id: 'note-3' });
      return { card: c, undercards: [u1, u2], at: 0, total: 3, reduced: false, hint: false, enabled: false, onMove: jest.fn(), onRead: jest.fn(), onLeave: jest.fn() } as React.ComponentProps<typeof NoteSwipeStack>;
    })()} />);
    const topInner = ui.getByTestId('note-card-slot-0-inner', { includeHiddenElements: true });
    const under1 = ui.getByTestId('note-card-slot-1-inner', { includeHiddenElements: true });
    const under2 = ui.getByTestId('note-card-slot-2-inner', { includeHiddenElements: true });
    const topBg = StyleSheet.flatten(topInner.props.style).backgroundColor;
    const u1Bg = StyleSheet.flatten(under1.props.style).backgroundColor;
    const u2Bg = StyleSheet.flatten(under2.props.style).backgroundColor;
    expect(u1Bg).not.toBe(topBg);
    expect(u2Bg).not.toBe(topBg);
    expect(u1Bg).toBe(colors.bgSecondary);
    expect(u2Bg).toBe(colors.bgSecondary);
    expect(StyleSheet.flatten(under1.props.style).borderColor).toBe(colors.controlBorder);
    expect(StyleSheet.flatten(under1.props.style).borderWidth).toBe(1);
    expect(StyleSheet.flatten(under2.props.style).borderColor).toBe(colors.controlBorder);
    ui.unmount();
  });

  it('shows the first-visit hint once only per user', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const { renderHook, waitFor, act } = require('@testing-library/react-native');
    const { useNoteSwipeHint, noteSwipeHintKey } = require('../useNoteSwipeMotion');
    const getSpy = jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue(null);
    const setSpy = jest.spyOn(AsyncStorage, 'setItem').mockResolvedValue(undefined);
    const first = renderHook(() => useNoteSwipeHint('actor-1', true));
    await waitFor(() => expect(first.result.current).toBe(true));
    expect(setSpy).toHaveBeenCalledWith(noteSwipeHintKey('actor-1'), '1');
    first.unmount();
    getSpy.mockResolvedValue('1');
    setSpy.mockClear();
    const second = renderHook(() => useNoteSwipeHint('actor-1', true));
    await waitFor(() => expect(second.result.current).toBe(false));
    expect(setSpy).not.toHaveBeenCalled();
    second.unmount();
    getSpy.mockRestore();
    setSpy.mockRestore();
  });
});

describe('unitC2-fix3 item1 shared deck-card query (no skipToken observers)', () => {
  it('mounts swipe AND home tile together, invalidates the prefix, keeps zero console.error and no error state', async () => {
    const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
    const { renderHook, waitFor, act } = require('@testing-library/react-native');
    const React = require('react');
    const gateway = require('@/features/books/notes/manualNotesGateway').manualNotesGateway;
    const deckKeys = require('@/features/books/notes/manualNoteContract').noteKeys;
    const { useNoteDeck } = require('@/features/books/notes/useNoteDeck');
    const row = { id: 'a', user_id: 'actor', user_book_id: 'b', tag: null, created_at: '2026-10-20T00:00:00Z' };
    const origIndex = gateway.deckIndex;
    const origCards = gateway.deckCards;
    gateway.deckIndex = jest.fn(async () => [row]);
    gateway.deckCards = jest.fn(async (_actor: string, ids: string[]) => ids.map(id => ({
      note: { id, user_id: 'actor', user_book_id: 'b', content: `body-${id}`, tag: null, page_number: null, created_at: '2026-10-20T00:00:00Z', updated_at: null },
      book: { id: 'b', title: 'T', authors: ['A'], cover_url: null },
    })));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    const wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(QueryClientProvider, { client }, children);
    try {
      const swipe = renderHook(() => useNoteDeck('actor', { scope: { kind: 'all' }, category: 'all', order: 'oldest', seed: 's', noteId: 'a' }, true), { wrapper });
      const ui = render(React.createElement(QueryClientProvider, { client }, React.createElement(NoteSwipeHomeTile, { actorId: 'actor', onPress: jest.fn() })));
      await waitFor(() => expect(ui.queryByTestId('note-swipe-home-tile')).toBeTruthy());
      await waitFor(() => expect(swipe.result.current.ids).toEqual(['a']));
      expect(err).not.toHaveBeenCalled();
      await act(async () => { await client.invalidateQueries({ queryKey: deckKeys.deck('actor') }); });
      await waitFor(() => expect(client.getQueryState(deckKeys.deckCard('actor', 'a'))?.fetchStatus).not.toBe('fetching'));
      expect(err).not.toHaveBeenCalled();
      expect(ui.queryByTestId('note-swipe-home-tile')).toBeTruthy();
      expect(client.getQueryState(deckKeys.deckCard('actor', 'a'))?.status).not.toBe('error');
      // No code path may log queryFn: the swipe surface registers no fetch observers for deck-card keys.
      const fs = require('fs');
      const path = require('path');
      const src = fs.readFileSync(path.join(__dirname, '../../../../../src/features/books/notes/useNoteDeck.ts'), 'utf8');
      expect(src).not.toContain('skipToken');
      expect(src).not.toContain("No queryFn");
      expect(src).toContain('getQueryData');
      expect(src).toContain('getQueryCache().subscribe');
      swipe.unmount();
      ui.unmount();
    } finally {
      err.mockRestore();
      gateway.deckIndex = origIndex;
      gateway.deckCards = origCards;
      client.clear();
    }
  });

  it('mounts the swipe deck alone, swipes several cards, keeps zero console.error and no observers', async () => {
    const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
    const { renderHook, waitFor, act } = require('@testing-library/react-native');
    const React = require('react');
    const gateway = require('@/features/books/notes/manualNotesGateway').manualNotesGateway;
    const deckKeys = require('@/features/books/notes/manualNoteContract').noteKeys;
    const { useNoteDeck } = require('@/features/books/notes/useNoteDeck');
    const rows = ['a', 'b', 'c'].map(id => ({ id, user_id: 'actor', user_book_id: 'b', tag: null, created_at: '2026-10-20T00:00:00Z' }));
    const origIndex = gateway.deckIndex;
    const origCards = gateway.deckCards;
    gateway.deckIndex = jest.fn(async () => rows);
    gateway.deckCards = jest.fn(async (_actor: string, ids: string[]) => ids.map(id => ({
      note: { id, user_id: 'actor', user_book_id: 'b', content: `body-${id}`, tag: null, page_number: null, created_at: '2026-10-20T00:00:00Z', updated_at: null },
      book: { id: 'b', title: 'T', authors: ['A'], cover_url: null },
    })));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    const wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(QueryClientProvider, { client }, children);
    try {
      const hook = renderHook(() => useNoteDeck('actor', { scope: { kind: 'all' }, category: 'all', order: 'oldest', seed: 's', noteId: 'a' }, true), { wrapper });
      await waitFor(() => expect(hook.result.current.ids).toEqual(['a', 'b', 'c']));
      expect(err).not.toHaveBeenCalled();
      act(() => { hook.result.current.move('next'); });
      await waitFor(() => expect(hook.result.current.noteId).toBe('b'));
      act(() => { hook.result.current.move('next'); });
      await waitFor(() => expect(hook.result.current.noteId).toBe('c'));
      await waitFor(() => expect(client.getQueryState(deckKeys.deckCard('actor', 'c'))?.fetchStatus).not.toBe('fetching'));
      expect(err).not.toHaveBeenCalled();
      const cardQueries = client.getQueryCache().getAll().filter((q: any) => Array.isArray(q.queryKey) && q.queryKey[0] === 'library-note-deck' && q.queryKey[2] === 'card');
      for (const q of cardQueries) {
        const count = typeof (q as any).getObserversCount === 'function' ? (q as any).getObserversCount() : (q as any).observers?.length ?? 0;
        expect(count).toBe(0);
      }
      hook.unmount();
    } finally {
      err.mockRestore();
      gateway.deckIndex = origIndex;
      gateway.deckCards = origCards;
      client.clear();
    }
  });
});

describe('unitC2-fix3 item3 measured lines at 200%', () => {
  it('bounds numberOfLines, shrinks with available height, keeps footer visible', () => {
    const RN = require('react-native');
    const { fireEvent } = require('@testing-library/react-native');
    const long = 'Line 1 of the long note about testing. Line 2 of the long note about testing. Line 3 continues. Line 4 continues. Line 5 continues. Line 6 continues. Line 7 continues. Line 8 continues.';
    const mk = (over: Partial<NoteDeckCard['note']> = {}): NoteDeckCard => ({
      note: { id: 'n1', user_id: 'actor', user_book_id: 'b', content: long, tag: 'quote', page_number: 42, created_at: '2026-10-20T00:00:00Z', updated_at: null, ...over },
      book: { id: 'b', title: 'T', authors: ['A'], cover_url: null },
    });
    const tallSpy = jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 360, height: 400, scale: 1, fontScale: 2 });
    try {
      const ui = render(<NoteSwipeStack card={mk()} undercards={[]} at={0} total={1} reduced={false} hint={false} enabled={false} onMove={jest.fn()} onRead={jest.fn()} onLeave={jest.fn()} />);
      const bodyText = ui.getByText(long.slice(0, 20), { includeHiddenElements: true, exact: false });
      const linesTall = (bodyText.props as any).numberOfLines;
      expect(Number.isInteger(linesTall)).toBe(true);
      expect(linesTall).toBeGreaterThanOrEqual(1);
      expect(linesTall).toBeLessThanOrEqual(8);
      expect(ui.getByText('T', { includeHiddenElements: true })).toBeTruthy();
      expect(ui.getByText('A', { includeHiddenElements: true })).toBeTruthy();
      ui.unmount();
      tallSpy.mockRestore();
      const shortSpy = jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 360, height: 300, scale: 1, fontScale: 2 });
      try {
        const ui2 = render(<NoteSwipeStack card={mk()} undercards={[]} at={0} total={1} reduced={false} hint={false} enabled={false} onMove={jest.fn()} onRead={jest.fn()} onLeave={jest.fn()} />);
        const body2 = ui2.getByText(long.slice(0, 20), { includeHiddenElements: true, exact: false });
        const linesShort = (body2.props as any).numberOfLines;
        expect(Number.isInteger(linesShort)).toBe(true);
        expect(linesShort).toBeGreaterThanOrEqual(1);
        expect(linesShort).toBeLessThanOrEqual(linesTall);
        expect(linesShort).toBeLessThanOrEqual(8);
        if (linesTall > 1) expect(linesShort).toBeLessThan(linesTall);
        expect(ui2.getByText('T', { includeHiddenElements: true })).toBeTruthy();
        expect(ui2.getByText('A', { includeHiddenElements: true })).toBeTruthy();
        ui2.unmount();
      } finally {
        shortSpy.mockRestore();
      }
    } finally {
      if ((tallSpy as any).mockRestore) { try { tallSpy.mockRestore(); } catch { /* already restored */ } }
    }
  });

  it('uses the measured body height so the ellipsis is a whole number of lines', () => {
    const { act } = require('@testing-library/react-native');
    const long = 'Measured body line one. Measured body line two. Measured body line three. Measured body line four.';
    const c: NoteDeckCard = {
      note: { id: 'm', user_id: 'actor', user_book_id: 'b', content: long, tag: null, page_number: null, created_at: '2026-10-20T00:00:00Z', updated_at: null },
      book: { id: 'b', title: 'T', authors: ['A'], cover_url: null },
    };
    const ui = render(<NoteSwipeCard card={c} lines={8} />);
    const body = ui.getByTestId('note-card-body', { includeHiddenElements: true });
    const textBefore = ui.getByText(long.slice(0, 10), { includeHiddenElements: true, exact: false });
    expect((textBefore.props as any).numberOfLines).toBe(8);
    act(() => { (body.props as any).onLayout({ nativeEvent: { layout: { height: 104, width: 300 } } }); });
    const textAfter = ui.getByText(long.slice(0, 10), { includeHiddenElements: true, exact: false });
    const lines = (textAfter.props as any).numberOfLines;
    expect(Number.isInteger(lines)).toBe(true);
    expect(lines).toBeGreaterThanOrEqual(1);
    ui.unmount();
  });
});

describe('unitC2-fix3 item4 undercard contrast and offset', () => {
  it('keeps angles, uses token border, and offsets undercards horizontally beyond the previous value', () => {
    const ui = render(<NoteSwipeStack card={card()} undercards={[card({ id: 'note-2' }), card({ id: 'note-3' })]} at={0} total={3} reduced={false} hint={false} enabled={false} onMove={jest.fn()} onRead={jest.fn()} onLeave={jest.fn()} />);
    const topOuter = ui.getByTestId('note-card-slot-0', { includeHiddenElements: true });
    const underOuter1 = ui.getByTestId('note-card-slot-1', { includeHiddenElements: true });
    const underOuter2 = ui.getByTestId('note-card-slot-2', { includeHiddenElements: true });
    const topFlat = StyleSheet.flatten(topOuter.props.style);
    const u1Flat = StyleSheet.flatten(underOuter1.props.style);
    const u2Flat = StyleSheet.flatten(underOuter2.props.style);
    expect((u1Flat as any).left).toBeGreaterThan((topFlat as any).left);
    expect((u1Flat as any).right).toBeGreaterThan((topFlat as any).right);
    expect((u2Flat as any).left).toBeGreaterThan((u1Flat as any).left);
    expect((u2Flat as any).right).toBeGreaterThan((u1Flat as any).right);
    expect((u1Flat as any).left - (topFlat as any).left).toBeGreaterThanOrEqual(6);
    expect((u2Flat as any).left - (u1Flat as any).left).toBeGreaterThanOrEqual(6);
    const under1Inner = ui.getByTestId('note-card-slot-1-inner', { includeHiddenElements: true });
    const under2Inner = ui.getByTestId('note-card-slot-2-inner', { includeHiddenElements: true });
    expect(StyleSheet.flatten(under1Inner.props.style).borderColor).toBe(colors.controlBorder);
    expect(StyleSheet.flatten(under2Inner.props.style).borderColor).toBe(colors.controlBorder);
    expect(StyleSheet.flatten(under1Inner.props.style).borderWidth).toBe(1);
    expect(JSON.stringify((u1Flat as any).transform ?? '')).toContain('-3deg');
    expect(JSON.stringify((u2Flat as any).transform ?? '')).toContain('2deg');
    expect((u1Flat as any).shadowOpacity).toBeGreaterThan(0);
    expect((u1Flat as any).overflow).not.toBe('hidden');
    ui.unmount();
  });
});

describe('unitC2-fix3 item2 home tile tap target', () => {
  it('presses only the tile Pressable, keeps decoration inside the box, and routes to swipe', async () => {
    const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
    const deckModule = require('@/features/books/notes/useNoteDeck');
    const cacheModule = require('@/features/books/notes/noteDeckCache');
    const React = require('react');
    const { fireEvent, waitFor } = require('@testing-library/react-native');
    const { View, Text, Pressable } = require('react-native');
    const one: any = { id: 'one', user_id: 'actor', user_book_id: 'b', tag: null, created_at: '2026-10-20T00:00:00Z' };
    const indexSpy = jest.spyOn(deckModule, 'useNoteDeckIndex').mockReturnValue({ data: [one], isPending: false, isError: false } as any);
    const cardsSpy = jest.spyOn(cacheModule, 'loadDeckCards').mockResolvedValue([{ note: { ...one, content: 'hello', user_id: 'actor' }, book: { id: 'b', title: 'T', authors: [] } } as any]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const tilePress = jest.fn();
    const continueUpdate = jest.fn();
    const ui = render(
      React.createElement(QueryClientProvider, { client },
        React.createElement(View, null,
          React.createElement(View, { testID: 'library-continue-reading-card' },
            React.createElement(Text, null, 'Continue reading'),
            React.createElement(Pressable, { testID: 'library-continue-reading-update', onPress: continueUpdate },
              React.createElement(Text, null, 'Update'))),
          React.createElement(NoteSwipeHomeTile, { actorId: 'actor', onPress: tilePress }))),
    );
    try {
      await waitFor(() => expect(ui.queryByTestId('note-swipe-home-tile')).toBeTruthy());
      const tile = ui.getByTestId('note-swipe-home-tile');
      fireEvent.press(tile);
      expect(tilePress).toHaveBeenCalledTimes(1);
      expect(continueUpdate).not.toHaveBeenCalled();
      fireEvent.press(ui.getByTestId('library-continue-reading-update'));
      expect(continueUpdate).toHaveBeenCalledTimes(1);
      expect(tilePress).toHaveBeenCalledTimes(1);
      const underclip = ui.getByTestId('note-home-underclip', { includeHiddenElements: true });
      expect(underclip.props.pointerEvents).toBe('none');
      for (const id of ['note-home-under-0', 'note-home-under-1']) {
        expect(ui.getByTestId(id, { includeHiddenElements: true }).props.pointerEvents).toBe('none');
      }
      const tileFlat = StyleSheet.flatten(tile.props.style);
      expect((tileFlat as any)?.overflow).toBe('hidden');
      const fs = require('fs');
      const path = require('path');
      const tileSrc = fs.readFileSync(path.join(__dirname, '../../../../../src/components/library/notes-swipe/NoteSwipeHomeTile.tsx'), 'utf8');
      expect(tileSrc).not.toContain('pointerEvents="auto"');
      const indexSrc = fs.readFileSync(path.join(__dirname, '../../../../../app/(tabs)/library/index.tsx'), 'utf8');
      const continuePos = indexSrc.indexOf('{continueReadingCard}');
      const tilePos = indexSrc.indexOf('<NoteSwipeHomeTile');
      expect(continuePos).toBeGreaterThanOrEqual(0);
      expect(tilePos).toBeGreaterThan(continuePos);
    } finally {
      ui.unmount();
      indexSpy.mockRestore();
      cardsSpy.mockRestore();
      client.clear();
    }
  });
});
