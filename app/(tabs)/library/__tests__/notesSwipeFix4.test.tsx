jest.mock('@/features/books/organising/useOrganising', () => ({ useOrganising: () => ({ entities: { data: [] }, members: { data: [] }, refresh: jest.fn() }) }));
import React from 'react';
import { Platform, PixelRatio, StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { MIN_TARGET } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT_BASE } from '@/components/library/LibraryTypography';

const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) };
const mockRoute = { key: 'swipe-key' };
let mockParams: Record<string, string> = { scope: 'all', order: 'shuffle' };
let mockBook: any = { data: undefined, isError: false, isPending: false, error: null, refetch: jest.fn() };
let mockDeck: any = null;
let mockNetwork: any = { isOffline: false };

jest.mock('expo-router', () => ({
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
  useReducedNoteMotion: () => false,
  useNoteSwipeHint: () => false,
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

import NotesSwipeScreen from '../notes-swipe';
import { BookFeedbackProvider } from '@/components/library/ui';

function card(id = 'a') {
  return { note: { id, user_id: 'actor', user_book_id: 'b', content: 'body', tag: null as any, page_number: null, created_at: '2026-10-20T00:00:00Z', updated_at: null }, book: { id: 'b', title: 'T', authors: ['A'], cover_url: null } };
}

function baseDeck(over: any = {}) {
  return {
    index: { data: [{ id: 'a' }, { id: 'b' }], isError: false, isPending: false, isFetching: false, refetch: jest.fn() },
    ids: ['a', 'b'],
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

function renderScreen() {
  const React = require('react');
  return render(React.createElement(BookFeedbackProvider, null, React.createElement(NotesSwipeScreen)));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { scope: 'all', order: 'shuffle' };
  mockBook = { data: undefined, isError: false, isPending: false, error: null, refetch: jest.fn() };
  mockNetwork = { isOffline: false };
  (Platform as any).OS = 'ios';
  mockDeck = baseDeck();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('unitC2-fix4 item2 large-text layout', () => {
  it('button row wraps with natural height and growing slots; labels never truncated', () => {
    const RN = require('react-native');
    const dimsSpy = jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 360, height: 640, scale: 1, fontScale: 2 });
    const scaleSpy = jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
    try {
      const ui = renderScreen();
      const bar = ui.getByTestId('note-swipe-button-bar', { includeHiddenElements: true });
      const flat = StyleSheet.flatten(bar.props.style);
      expect(flat.flexWrap).toBe('wrap');
      expect((flat as any).height).toBeUndefined();
      expect((flat as any).flexShrink).toBe(0);
      // Slots grow so the row wraps instead of pushing the card off-screen.
      for (const id of ['note-swipe-button-slot-prev', 'note-swipe-button-slot-read', 'note-swipe-button-slot-next']) {
        const slot = ui.getByTestId(id, { includeHiddenElements: true });
        const sflat = StyleSheet.flatten(slot.props.style);
        expect((sflat as any).flexGrow).toBeGreaterThanOrEqual(1);
        expect((sflat as any).minWidth).toBeGreaterThanOrEqual(MIN_TARGET);
      }
      for (const label of ['Previous', 'Read full note', 'Next']) {
        const text = ui.getByText(label, { includeHiddenElements: true });
        // Never cut to a single line; wrapping (undefined or >=2) is required at 200%.
        expect(text.props.numberOfLines === undefined || text.props.numberOfLines >= 2).toBe(true);
      }
      ui.unmount();
    } finally {
      dimsSpy.mockRestore();
      scaleSpy.mockRestore();
    }
  });

  it('back button keeps a 48dp target with base label line height (fontScale 1 and 2)', () => {
    const RN = require('react-native');
    for (const scale of [1, 2]) {
      const dimsSpy = jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 360, height: 640, scale: 1, fontScale: scale });
      const scaleSpy = jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(scale);
      try {
        const ui = renderScreen();
        const back = ui.getByRole('button', { name: 'Back' });
        const flat = StyleSheet.flatten(back.props.style);
        expect((flat as any).minHeight).toBeGreaterThanOrEqual(MIN_TARGET);
        expect((flat as any).minWidth).toBeGreaterThanOrEqual(MIN_TARGET);
        // Glyph centred (existing BookButton pattern) with the base label token.
        expect((flat as any).alignItems).toBe('center');
        expect((flat as any).justifyContent).toBe('center');
        const glyph = ui.getByText('←', { includeHiddenElements: true });
        const lflat = StyleSheet.flatten(glyph.props.style);
        // Swipe-screen fix8: explicit base line height so 200% glyphs never clip.
        expect((lflat as any).lineHeight).toBe(LIBRARY_TEXT_BASE.label.lineHeight);
        expect((lflat as any).fontSize).toBe(16);
        expect(glyph.props.allowFontScaling).not.toBe(false);
        expect(glyph.props.numberOfLines).toBeUndefined();
        ui.unmount();
      } finally {
        dimsSpy.mockRestore();
        scaleSpy.mockRestore();
      }
    }
  });

  it('swipe screen passes the base label token to every swipe button (fails without the prop)', () => {
    const RN = require('react-native');
    const { BookButton } = require('@/components/library/ui/BookButton');
    for (const scale of [1, 2]) {
      const dimsSpy = jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 360, height: 640, scale: 1, fontScale: scale });
      const scaleSpy = jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(scale);
      try {
        const ui = renderScreen();
        const expected = LIBRARY_TEXT_BASE.label.lineHeight;
        for (const label of ['Previous', 'Read full note', 'Next']) {
          const text = ui.getByText(label, { includeHiddenElements: true });
          expect(StyleSheet.flatten(text.props.style).lineHeight).toBe(expected);
          expect(text.props.numberOfLines).toBeUndefined();
        }
        // Default BookButton (no prop) stays on native metrics for other screens.
        const def = render(<BookButton label="Edit" variant="primary" onPress={jest.fn()} />);
        const defText = def.getByText('Edit', { includeHiddenElements: true });
        expect(StyleSheet.flatten(defText.props.style).lineHeight).toBeUndefined();
        def.unmount();
        ui.unmount();
      } finally {
        dimsSpy.mockRestore();
        scaleSpy.mockRestore();
      }
    }
  });

  it('start-again button uses the base label token at fontScale 2', () => {
    const RN = require('react-native');
    const dimsSpy = jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 360, height: 640, scale: 1, fontScale: 2 });
    const scaleSpy = jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
    try {
      mockDeck = baseDeck({ noteId: null, card: undefined, at: 1 });
      const ui = renderScreen();
      const text = ui.getByText('Start again', { includeHiddenElements: true });
      expect(StyleSheet.flatten(text.props.style).lineHeight).toBe(
        LIBRARY_TEXT_BASE.label.lineHeight,
      );
      expect(text.props.numberOfLines).toBeUndefined();
      ui.unmount();
    } finally {
      dimsSpy.mockRestore();
      scaleSpy.mockRestore();
    }
  });

  it('stack gives up height first (flex:1) while footer title/author stay rendered', () => {
    const RN = require('react-native');
    const dimsSpy = jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 360, height: 640, scale: 1, fontScale: 2 });
    try {
      const ui = renderScreen();
      const wrap = ui.getByTestId('note-stack-wrap', { includeHiddenElements: true });
      const wflat = StyleSheet.flatten(wrap.props.style);
      expect((wflat as any).flex).toBe(1);
      expect((wflat as any).flexShrink).toBe(1);
      expect(ui.getByTestId('note-card-footer', { includeHiddenElements: true })).toBeTruthy();
      expect(ui.getByText('T', { includeHiddenElements: true })).toBeTruthy();
      expect(ui.getByText('A', { includeHiddenElements: true })).toBeTruthy();
      // Next stays the one primary.
      expect(ui.getByRole('button', { name: 'Next' })).toBeTruthy();
      ui.unmount();
    } finally {
      dimsSpy.mockRestore();
    }
  });

  it('hides only the cover thumbnail at the smallest stage, never title/author', () => {
    const RN = require('react-native');
    const dimsSpy = jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 360, height: 300, scale: 1, fontScale: 2 });
    try {
      const ui = renderScreen();
      const paper = ui.getByTestId('note-card-paper', { includeHiddenElements: true });
      fireEvent(paper, 'layout', { nativeEvent: { layout: { height: 150, width: 300 } } });
      // Thumbnail gives up room; title and author remain.
      expect(ui.queryByTestId('note-cover-placeholder', { includeHiddenElements: true })).toBeNull();
      expect(ui.getByText('T', { includeHiddenElements: true })).toBeTruthy();
      expect(ui.getByText('A', { includeHiddenElements: true })).toBeTruthy();
      ui.unmount();
    } finally {
      dimsSpy.mockRestore();
    }
  });
});
