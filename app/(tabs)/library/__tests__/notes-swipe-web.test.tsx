/** @jest-environment jsdom */
import React, { act } from 'react';
import NotesSwipeScreen from '../notes-swipe';
import { BookFeedbackProvider } from '@/components/library/ui';
const { createRoot } = require('react-dom/client') as {
  createRoot: (container: HTMLElement) => { render: (children: React.ReactNode) => void; unmount: () => void };
};

// Use actual web hosts: BookButton's Pressable becomes a focusable BUTTON,
// and browser events bubble to the screen's actual window listener.
jest.mock('react-native', () => jest.requireActual('react-native-web'));
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: { View },
    useSharedValue: (initial: unknown) => React.useRef({ value: initial }).current,
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withTiming: (v: unknown) => v, withSpring: (v: unknown) => v, withSequence: (...v: unknown[]) => v[v.length - 1],
    interpolateColor: () => 'transparent',
  };
});
jest.mock('react-native-gesture-handler', () => {
  const chain = () => {
    const g: Record<string, unknown> = {};
    for (const key of ['enabled', 'minDistance', 'maxDistance', 'maxDuration', 'runOnJS', 'onStart', 'onUpdate', 'onEnd', 'onFinalize']) g[key] = () => g;
    return g;
  };
  return { Gesture: { Pan: chain, Tap: chain, Native: chain, Exclusive: () => ({}), Simultaneous: () => ({}) },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children };
});
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args) }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
jest.mock('expo-haptics', () => ({}));
jest.mock('expo-font', () => ({ useFonts: () => [false, null] }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'seed' }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({}), useRouter: () => ({ canGoBack: () => false }) }));
jest.mock('@react-navigation/native', () => ({ useRoute: () => ({ key: 'swipe' }), useIsFocused: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOffline: false }) }));
jest.mock('@/features/books/notes/useManualNotes', () => ({ useNoteContext: () => ({ actorId: 'actor', book: {} }) }));
jest.mock('@/components/library/notes-swipe/useNoteSwipeMotion', () => ({ useReducedNoteMotion: () => true, useNoteSwipeHint: () => false }));
const mockMove = jest.fn();
const mockRestart = jest.fn();
const mockDeck = { index: { data: [{ id: 'a' }] }, ids: ['a'], at: 1, noteId: null, card: undefined, undercards: [],
  move: mockMove, restart: mockRestart, abort: jest.fn() };
jest.mock('@/features/books/notes/useNoteDeck', () => ({ useNoteDeck: () => mockDeck }));

it('keeps the real end card unchanged for ArrowLeft/ArrowRight/Enter on its focused Start again BUTTON', async () => {
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await act(async () => { root.render(<BookFeedbackProvider><NotesSwipeScreen /></BookFeedbackProvider>); });
    const start = container.querySelector('[data-testid="note-start-again"]') as HTMLButtonElement;
    expect(start.tagName).toBe('BUTTON');
    act(() => start.focus());
    expect(document.activeElement).toBe(start);
    mockMove.mockClear(); mockRestart.mockClear();
    for (const key of ['ArrowLeft', 'ArrowRight', 'Enter']) {
      await act(async () => { document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); });
      expect(container.querySelector('[data-testid="note-end-heading"]')?.textContent).toBe("That's all for now.");
      expect(container.querySelector('[data-testid="note-start-again"]')).toBe(start);
      expect(mockDeck.at).toBe(1);
      expect(mockMove).not.toHaveBeenCalled();
      expect(mockRestart).not.toHaveBeenCalled();
    }
    // Positive control: the same real window listener moves from the end card
    // when focus is outside an interactive element. This prevents a vacuous pass.
    act(() => start.blur());
    await act(async () => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true })); });
    expect(mockMove).toHaveBeenCalledWith('previous');
    expect(errors).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    container.remove();
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    errors.mockRestore();
  }
});
