import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { NoteDeckChips, chipLabel } from '../NoteDeckChips';
import { NoteOrderMenu } from '../NoteOrderMenu';
import { NoteSwipeStack } from '../NoteSwipeStack';
import { acceptsDeckKey } from '@/features/books/notes/noteDeck';
import { NOTE_SWIPE } from '@/features/books/notes/noteSwipeConstants';
import { getLibraryAppearance, MIN_TARGET } from '../../LibraryAppearance';
import type { NoteDeckCard } from '@/features/books/notes/manualNoteContract';

jest.mock('@/hooks/useTheme', () => ({ useTheme: jest.fn(() => ({ phase: 'daylight' })) }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
const mockImpact = jest.fn(() => Promise.resolve());
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
        for (const name of ['enabled', 'minDistance', 'maxDistance', 'maxDuration', 'runOnJS']) gesture[name] = jest.fn(() => gesture);
        gesture.onEnd = jest.fn((cb: any) => { mockTapCallbacks.push(cb); return gesture; });
        return gesture;
      }),
      Native: jest.fn(() => { const store: any = {}; const g = makeChainable(store); return g; }),
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
const colors = getLibraryAppearance('daylight');

function card(over: Partial<NoteDeckCard['note']> = {}): NoteDeckCard {
  return {
    note: { id: 'note-1', user_id: 'actor', user_book_id: 'book-1', content: 'A calm note body.', tag: 'quote', page_number: 42, created_at: '2026-10-20T00:00:00Z', updated_at: null, ...over },
    book: { id: 'book-1', title: 'Hooked', authors: ['Nir Eyal'], cover_url: null },
  };
}

const MockReanimated = require('react-native-reanimated');
jest.spyOn(MockReanimated, 'withTiming').mockImplementation((value: any, _opts?: any, cb?: any) => { if (typeof cb === 'function') cb(true); return value; });
jest.spyOn(MockReanimated, 'withSpring').mockImplementation((value: any) => value);
jest.spyOn(MockReanimated, 'withSequence').mockImplementation((...args: any[]) => args[args.length - 1]);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(MockReanimated, 'useSharedValue').mockImplementation((initial: any) => {
    const ref = React.useRef<{ value: any } | null>(null);
    if (!ref.current) ref.current = { value: initial };
    return ref.current;
  });
  mockPanCallbacks.length = 0;
  mockTapCallbacks.length = 0;
  mockExclusiveCalls.length = 0;
  mockPanInstances = [];
  mockImpact.mockClear();
  mockScheduleOnRN.mockClear();
  (Platform as { OS: string }).OS = 'ios';
});

describe('C3 chips: radio semantics and layout', () => {
  it('scales the chip label once at 200% and reserves only its native height plus padding', () => {
    const RN = require('react-native');
    const scale = jest.spyOn(RN.PixelRatio, 'getFontScale').mockReturnValue(2);
    try {
      const ui = render(<NoteDeckChips categories={['all', 'question']} selected="question" onSelect={jest.fn()} />);
      const chip = ui.getByRole('radio', { name: 'Question' });
      const label = chip.findByType(RN.Text);
      expect(StyleSheet.flatten(label.props.style).lineHeight).toBe(22);
      expect(label.props.allowFontScaling).not.toBe(false);
      expect(StyleSheet.flatten(chip.props.style).minHeight).toBe(62);
      ui.unmount();
    } finally { scale.mockRestore(); }
  });

  it('renders a radiogroup with only non-empty categories and marks the selected chip', () => {
    const onSelect = jest.fn();
    const ui = render(<NoteDeckChips categories={['all', 'quote', 'reflect']} selected="quote" onSelect={onSelect} />);
    const group = ui.getByTestId('note-deck-chips-bar');
    expect(group.props.accessibilityRole).toBe('radiogroup');
    expect(group.props.accessibilityLabel).toBe('Filter notes');
    expect(ui.getByRole('radio', { name: 'All' })).toBeTruthy();
    expect(ui.getByRole('radio', { name: 'Quote' })).toBeTruthy();
    expect(ui.queryByRole('radio', { name: 'Takeaway' })).toBeNull();
    const quote = ui.getByRole('radio', { name: 'Quote' });
    expect(quote.props.accessibilityState.checked).toBe(true);
    fireEvent.press(ui.getByRole('radio', { name: 'All' }));
    expect(onSelect).toHaveBeenCalledWith('all');
    ui.unmount();
  });

  it('keeps every chip at least 48dp on an opaque bar that never sits on the book colour', () => {
    const ui = render(<NoteDeckChips categories={['all', 'quote']} selected="all" onSelect={jest.fn()} />);
    const bar = ui.getByTestId('note-deck-chips-bar');
    expect(StyleSheet.flatten(bar.props.style).backgroundColor).toBe(colors.bgPrimary);
    for (const name of ['All', 'Quote']) {
      const chip = ui.getByRole('radio', { name });
      const flat = StyleSheet.flatten(chip.props.style);
      expect(flat.minHeight).toBeGreaterThanOrEqual(MIN_TARGET);
      expect(flat.minWidth).toBeGreaterThanOrEqual(MIN_TARGET);
    }
    expect(ui.getByTestId('note-deck-chips').props.showsHorizontalScrollIndicator).toBe(false);
    ui.unmount();
  });



  it('supports arrow keys on web with a roving tab stop', () => {
    const prior = (Platform as { OS: string }).OS;
    (Platform as { OS: string }).OS = 'web';
    try {
      const onSelect = jest.fn();
      const ui = render(<NoteDeckChips categories={['all', 'quote', 'reflect']} selected="all" onSelect={onSelect} />);
      const all = ui.getByRole('radio', { name: 'All' });
      const quote = ui.getByRole('radio', { name: 'Quote' });
      expect(all.props.tabIndex).toBe(0);
      expect(quote.props.tabIndex).toBe(-1);
      const prevent = jest.fn();
      (all.props as any).onKeyDown?.({ key: 'ArrowLeft', preventDefault: prevent });
      expect(onSelect).toHaveBeenCalledWith('reflect');
      expect(prevent).toHaveBeenCalled();
      ui.unmount();
    } finally {
      (Platform as { OS: string }).OS = prior;
    }
  });

  it('labels All and category names for the announcement', () => {
    expect(chipLabel('all')).toBe('All');
    expect(chipLabel('quote')).toBe('Quote');
  });
});

describe('C3 order menu: radio choices and overlay behaviour', () => {
  it('moves focus only with wrapping arrows and selects once with Space or Enter on web', () => {
    (Platform as { OS: string }).OS = 'web';
    const previousWindow = (global as any).window;
    (global as any).window = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
    const nodes: Record<string, { tabIndex?: number; focus: jest.Mock }> = {};
    const onSelect = jest.fn();
    const { BookFeedbackProvider } = require('../../ui');
    function Menu() {
      const [visible, setVisible] = React.useState(true);
      return <BookFeedbackProvider><NoteOrderMenu visible={visible} order="newest" onSelect={value => { onSelect(value); setVisible(false); }} onClose={() => setVisible(false)} /></BookFeedbackProvider>;
    }
    const ui = render(<Menu />);
    for (const name of ['Shuffle', 'Newest first', 'Oldest first']) nodes[name] = ui.getByRole('radio', { name }).parent!.instance;
    expect(nodes['Newest first'].tabIndex).toBe(0);
    expect(nodes.Shuffle.tabIndex).toBe(-1);
    const key = (name: string, value: string) => {
      const event = { key: value, preventDefault: jest.fn(), stopPropagation: jest.fn() };
      fireEvent(ui.getByRole('radio', { name }), 'keyDownCapture', event);
      expect(event.preventDefault).toHaveBeenCalledTimes(1);
      return event;
    };
    for (const [from, arrow, to] of [
      ['Newest first', 'ArrowUp', 'Shuffle'], ['Shuffle', 'ArrowLeft', 'Oldest first'],
      ['Oldest first', 'ArrowDown', 'Shuffle'], ['Shuffle', 'ArrowRight', 'Newest first'],
    ]) {
      key(from, arrow);
      expect(nodes[to].focus).toHaveBeenCalled();
      expect(nodes[to].tabIndex).toBe(0);
      expect(nodes[from].tabIndex).toBe(-1);
      expect(onSelect).not.toHaveBeenCalled();
    }
    key('Newest first', 'ArrowRight');
    key('Oldest first', ' ');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('oldest');
    expect(ui.queryByRole('radio', { name: 'Oldest first' })).toBeNull();
    ui.unmount();
    onSelect.mockClear();
    const ui2 = render(<Menu />);
    fireEvent(ui2.getByRole('radio', { name: 'Shuffle' }), 'keyDownCapture', { key: 'Enter', preventDefault: jest.fn(), stopPropagation: jest.fn() });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('shuffle');
    expect(ui2.queryByRole('radio', { name: 'Shuffle' })).toBeNull();
    ui2.unmount();
    (global as any).window = previousWindow;
  });

  function renderMenu(over: Partial<React.ComponentProps<typeof NoteOrderMenu>> = {}) {
    const { BookFeedbackProvider } = require('../../ui');
    return render(
      <BookFeedbackProvider>
        <NoteOrderMenu visible order="shuffle" onSelect={jest.fn()} onClose={jest.fn()} {...over} />
      </BookFeedbackProvider>,
    );
  }

  it('shows three radio choices, marks the current one and closes via Close', () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const ui = renderMenu({ order: 'newest', onSelect, onClose });
    expect(ui.getByRole('radio', { name: 'Shuffle' })).toBeTruthy();
    expect(ui.getByRole('radio', { name: 'Newest first' })).toBeTruthy();
    expect(ui.getByRole('radio', { name: 'Oldest first' })).toBeTruthy();
    expect(ui.getByRole('radio', { name: 'Newest first' }).props.accessibilityState.checked).toBe(true);
    fireEvent.press(ui.getByRole('radio', { name: 'Oldest first' }));
    expect(onSelect).toHaveBeenCalledWith('oldest');
    fireEvent.press(ui.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    ui.unmount();
  });

  it('uses its own GestureHandlerRootView and a dialog with toasts inside', () => {
    const ui = renderMenu({});
    expect(ui.getByTestId('note-order-backdrop', { includeHiddenElements: true })).toBeTruthy();
    const { GestureHandlerRootView } = require('react-native-gesture-handler');
    expect(ui.UNSAFE_queryByType(GestureHandlerRootView)).toBeTruthy();
    expect(ui.getByTestId('book-feedback-slot', { includeHiddenElements: true })).toBeTruthy();
    const { Modal } = require('react-native');
    expect(ui.UNSAFE_getAllByType(Modal).some((m: any) => m.props.role === 'dialog')).toBe(true);
    ui.unmount();
  });

  it('exposes the Order panel as one non-accessible element with reachable controls (G1)', () => {
    const ui = renderMenu({});
    const panel = ui.UNSAFE_getByProps({ accessibilityViewIsModal: true });
    expect(panel.props.accessible).toBe(false);
    expect(panel.props.focusable).toBe(false);
    expect(panel.props.accessibilityLabel).toBeUndefined();
    expect(ui.getByRole('radio', { name: 'Shuffle' })).toBeTruthy();
    expect(ui.getByRole('radio', { name: 'Newest first' })).toBeTruthy();
    expect(ui.getByRole('radio', { name: 'Oldest first' })).toBeTruthy();
    expect(ui.getByRole('button', { name: 'Close' })).toBeTruthy();
    expect(ui.getByRole('header', { name: 'Order' })).toBeTruthy();
    ui.unmount();
  });

  it('wraps the Order choices in a labelled radiogroup with exactly three radios (G4)', () => {
    const ui = renderMenu({});
    const group = ui.UNSAFE_getByProps({ accessibilityRole: 'radiogroup', accessibilityLabel: 'Order' });
    expect(group).toBeTruthy();
    expect(ui.getAllByRole('radio')).toHaveLength(3);
    ui.unmount();
  });

  it('closes via backdrop and Escape on web', () => {
    const onClose = jest.fn();
    const ui = renderMenu({ onClose });
    fireEvent.press(ui.getByTestId('note-order-backdrop', { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
    ui.unmount();
    const prior = (Platform as { OS: string }).OS;
    (Platform as { OS: string }).OS = 'web';
    (global as any).window = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
    try {
      const ui2 = renderMenu({ onClose });
      expect((global as any).window.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
      const escape = (global as any).window.addEventListener.mock.calls.find(([type]: any[]) => type === 'keydown')[1];
      const event = { key: 'Escape', preventDefault: jest.fn(), stopPropagation: jest.fn() };
      act(() => escape(event));
      expect(onClose).toHaveBeenCalledTimes(2);
      expect(event.preventDefault).toHaveBeenCalledTimes(1);
      expect(event.stopPropagation).toHaveBeenCalledTimes(1);
      ui2.unmount();
    } finally {
      delete (global as any).window;
      (Platform as { OS: string }).OS = prior;
    }
  });
});

describe('C3 stack: category flight and TalkBack action', () => {
  function stackProps(over: Partial<React.ComponentProps<typeof NoteSwipeStack>> = {}) {
    return {
      card: card(), undercards: [], at: 0, total: 2, reduced: false, hint: false,
      enabled: true, onMove: jest.fn(), onRead: jest.fn(), onLeave: jest.fn(),
      onCategory: jest.fn(), canCategory: true, categoryKey: 'all', ...over,
    } as React.ComponentProps<typeof NoteSwipeStack>;
  }

  it.each([false, true].flatMap(reduced => ['category', 'next', 'leave'].map(direction => ({ reduced, direction }))))(
    'cancels $direction with reduced=$reduced, releases input, and completes the following swipe once', ({ reduced, direction }) => {
      const completions: Array<(finished: boolean) => void> = [];
      (MockReanimated.withTiming as jest.Mock).mockImplementation((value: any, _opts: any, cb: any) => {
        if (cb) completions.push(cb);
        return value;
      });
      try {
        const props = stackProps({ reduced });
        const ref = React.createRef<import('../NoteSwipeStack').NoteSwipeControls>();
        const ui = render(<NoteSwipeStack {...props} ref={ref} />);
        const swipe = () => {
          const pan = mockPanCallbacks[mockPanCallbacks.length - 1];
          const event = { translationX: direction === 'next' ? -100 : 0, translationY: direction === 'category' ? -100 : direction === 'leave' ? 100 : 0, velocityX: direction === 'next' ? -900 : 0, velocityY: direction === 'category' ? -900 : 900 };
          act(() => { pan.onStart!({}); pan.onEnd!(event); });
        };
        swipe();
        const cancelled = completions.pop()!;
        expect(cancelled).toEqual(expect.any(Function));
        act(() => cancelled(false));
        expect(props.onCategory).not.toHaveBeenCalled();
        expect(props.onMove).not.toHaveBeenCalled();
        expect(props.onLeave).not.toHaveBeenCalled();
        expect(mockImpact).not.toHaveBeenCalled();
        const released = jest.fn();
        act(() => ref.current!.run(released));
        expect(released).toHaveBeenCalledTimes(1);
        swipe();
        const completed = completions.pop()!;
        act(() => { cancelled(true); completed(true); completed(true); });
        expect(props.onCategory).toHaveBeenCalledTimes(direction === 'category' ? 1 : 0);
        expect(props.onMove).toHaveBeenCalledTimes(direction === 'next' ? 1 : 0);
        expect(props.onLeave).toHaveBeenCalledTimes(direction === 'leave' ? 1 : 0);
        ui.unmount();
      } finally {
        (MockReanimated.withTiming as jest.Mock).mockImplementation((value: any, _opts: any, cb: any) => { cb?.(true); return value; });
      }
    },
  );

  it('offers Next category only when at least two categories exist', () => {
    const ui = render(<NoteSwipeStack {...stackProps({ canCategory: true })} />);
    const top = ui.getByTestId('note-card-slot-0', { includeHiddenElements: true });
    expect(top.props.accessibilityActions).toContainEqual({ name: 'category', label: 'Next category' });
    ui.unmount();
    const ui2 = render(<NoteSwipeStack {...stackProps({ canCategory: false })} />);
    const top2 = ui2.getByTestId('note-card-slot-0', { includeHiddenElements: true });
    expect(top2.props.accessibilityActions).not.toContainEqual({ name: 'category', label: 'Next category' });
    ui2.unmount();
  });

  it.each([false, true])('TalkBack uses a cancellable category flight and one haptic (reduced=%s)', reduced => {
    const completions: Array<(finished: boolean) => void> = [];
    (MockReanimated.withTiming as jest.Mock).mockImplementation((value: any, _opts: any, cb: any) => { if (cb) completions.push(cb); return value; });
    try {
      const onCategory = jest.fn();
      const ui = render(<NoteSwipeStack {...stackProps({ reduced, onCategory })} />);
      const nextCategory = () => fireEvent(ui.getByTestId('note-card-slot-0'), 'accessibilityAction', { nativeEvent: { actionName: 'category' } });
      nextCategory();
      expect(onCategory).not.toHaveBeenCalled();
      expect(mockImpact).not.toHaveBeenCalled();
      const cancelled = completions.pop()!;
      expect(cancelled).toEqual(expect.any(Function));
      nextCategory();
      expect(completions).toHaveLength(0);
      act(() => cancelled(false));
      expect(onCategory).not.toHaveBeenCalled();
      nextCategory();
      const complete = completions.pop()!;
      act(() => { complete(true); complete(true); });
      expect(onCategory).toHaveBeenCalledTimes(1);
      expect(mockImpact).toHaveBeenCalledTimes(1);
      expect((MockReanimated.withTiming as jest.Mock).mock.calls.some(([value, options]: any[]) => value === (reduced ? 0 : -require('react-native').Dimensions.get('window').height) && options.duration === (reduced ? NOTE_SWIPE.crossFadeMs : NOTE_SWIPE.exitMs))).toBe(true);
      ui.unmount();
    } finally {
      (MockReanimated.withTiming as jest.Mock).mockImplementation((value: any, _opts: any, cb: any) => { cb?.(true); return value; });
    }
  });

  it('swipe-up flight calls onCategory exactly once and haptics once', () => {
    const onCategory = jest.fn();
    render(<NoteSwipeStack {...stackProps({ onCategory, canCategory: true })} />);
    const pan = mockPanCallbacks[mockPanCallbacks.length - 1];
    pan.onStart!({} as any);
    pan.onUpdate!({ translationX: 0, translationY: -60 } as any);
    pan.onEnd!({ translationX: 0, translationY: -60, velocityX: 0, velocityY: -900 } as any);
    expect(onCategory).toHaveBeenCalledTimes(1);
    expect(mockImpact).toHaveBeenCalledTimes(1);
  });

  it('springs back below threshold and never calls onCategory', () => {
    const Reanimated = require('react-native-reanimated');
    const onCategory = jest.fn();
    render(<NoteSwipeStack {...stackProps({ onCategory, canCategory: true })} />);
    const pan = mockPanCallbacks[mockPanCallbacks.length - 1];
    (Reanimated.withSpring as jest.Mock).mockClear();
    pan.onStart!({} as any);
    pan.onUpdate!({ translationX: 0, translationY: -2 } as any);
    pan.onEnd!({ translationX: 0, translationY: -2, velocityX: 0, velocityY: 0 } as any);
    expect(Reanimated.withSpring).toHaveBeenCalled();
    expect(onCategory).not.toHaveBeenCalled();
  });

  it('ignores swipe-up when only one category exists', () => {
    const onCategory = jest.fn();
    render(<NoteSwipeStack {...stackProps({ onCategory, canCategory: false })} />);
    const pan = mockPanCallbacks[mockPanCallbacks.length - 1];
    pan.onStart!({} as any);
    pan.onUpdate!({ translationX: 0, translationY: -60 } as any);
    pan.onEnd!({ translationX: 0, translationY: -60, velocityX: 0, velocityY: -900 } as any);
    expect(onCategory).not.toHaveBeenCalled();
  });

  it('cross-fades with opacity only when reduced motion is on for category', () => {
    const Reanimated = require('react-native-reanimated');
    const onCategory = jest.fn();
    render(<NoteSwipeStack {...stackProps({ onCategory, canCategory: true, reduced: true })} />);
    const pan = mockPanCallbacks[mockPanCallbacks.length - 1];
    (Reanimated.withTiming as jest.Mock).mockClear();
    pan.onStart!({} as any);
    pan.onUpdate!({ translationX: 0, translationY: -60 } as any);
    pan.onEnd!({ translationX: 0, translationY: -60, velocityX: -900, velocityY: -900 } as any);
    expect(onCategory).toHaveBeenCalledTimes(1);
    const timingCalls = (Reanimated.withTiming as jest.Mock).mock.calls;
    expect(timingCalls.some((c: any[]) => c[0] === 0 && c[1]?.duration === NOTE_SWIPE.crossFadeMs)).toBe(true);
  });

  it('accepts ArrowUp with overlay gating and ignores it on buttons', () => {
    expect(acceptsDeckKey({ key: 'ArrowUp', target: { closest: () => null } }, false)).toBe(true);
    expect(acceptsDeckKey({ key: 'ArrowUp', target: { closest: () => null } }, true)).toBe(false);
    const button = { closest: (s: string) => (s.includes('button') ? {} : null) };
    expect(acceptsDeckKey({ key: 'ArrowUp', target: button }, false)).toBe(false);
  });
});
