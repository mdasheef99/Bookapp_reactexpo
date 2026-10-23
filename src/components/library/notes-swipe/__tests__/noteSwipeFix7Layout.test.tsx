import React from 'react';
import { PixelRatio, Platform, StyleSheet, Text, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { NoteSwipeCard } from '../NoteSwipeCard';
import NotesSwipeScreen from '../../../../../app/(tabs)/library/notes-swipe';
import { BookButton } from '../../ui/BookButton';
import { LIBRARY_TEXT_BASE, scaledLineHeight } from '../../LibraryTypography';
import type { NoteDeckCard } from '@/features/books/notes/manualNoteContract';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ order: 'shuffle' }), useRouter: () => ({ canGoBack: () => true, back: jest.fn(), replace: jest.fn() }) }));
jest.mock('@react-navigation/native', () => ({ useRoute: () => ({ key: 'swipe' }), useIsFocused: () => true }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'seed' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 10, bottom: 10, left: 0, right: 0 }) }));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOffline: false }) }));
jest.mock('@/features/books/notes/useManualNotes', () => ({ useNoteContext: () => ({ actorId: 'actor', book: {} }) }));
jest.mock('@/features/books/notes/useNoteDeck', () => ({ useNoteDeck: () => ({
  index: { data: [{ id: 'a' }] }, ids: ['a'], at: 0, noteId: 'a', card: mockCard(), undercards: [],
  move: jest.fn(), abort: jest.fn(), restart: jest.fn(), retryCard: jest.fn(),
  categories: ['all', 'quote', 'question'], category: 'question',
}) }));
jest.mock('../useNoteSwipeMotion', () => ({ useReducedNoteMotion: () => true, useNoteSwipeHint: () => false }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'Light' } }));
jest.mock('react-native-worklets', () => ({ ...jest.requireActual('react-native-worklets'), scheduleOnRN: (fn: (...args: any[]) => void, ...args: any[]) => fn(...args) }));
jest.mock('react-native-gesture-handler', () => {
  const chain = () => {
    const gesture: Record<string, any> = {};
    for (const key of ['enabled', 'minDistance', 'maxDistance', 'maxDuration', 'runOnJS', 'onStart', 'onUpdate', 'onEnd', 'onFinalize']) gesture[key] = () => gesture;
    return gesture;
  };
  return { Gesture: { Pan: chain, Tap: chain, Native: chain, Exclusive: (pan: unknown) => pan, Simultaneous: (pan: unknown) => pan }, GestureDetector: ({ children }: any) => children, GestureHandlerRootView: ({ children }: any) => children };
});

function mockCard(): NoteDeckCard {
  return {
    note: { id: 'a', user_id: 'actor', user_book_id: 'book', content: 'A long note. '.repeat(100), tag: 'quote', page_number: 42, created_at: '2026-10-20T00:00:00Z', updated_at: null },
    book: { id: 'book', title: 'Hooked', authors: ['Nir Eyal'], cover_url: null },
  };
}

const hidden = { includeHiddenElements: true };
type UI = ReturnType<typeof render>;
const flat = (node: { props: any }) => StyleSheet.flatten(node.props.style) ?? {};
function layout(node: Parameters<typeof fireEvent>[0], width: number, height: number) {
  fireEvent(node, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width, height } } });
}

// Jest has no native text/Yoga engine. Feed native-style measurements through the
// component's real onLayout handlers: Android converts numeric lineHeight from
// SP when allowFontScaling is true (TextAttributeProps.setLineHeight). The 1.25
// font metric is only a deterministic stand-in for platform-default button text;
// no fixed lineHeight is required for those labels to use their native metrics.
function nativeLine(node: { props: any }, scale: number) {
  const style = flat(node);
  return (style.lineHeight ?? style.fontSize * 1.25) * (node.props.allowFontScaling === false ? 1 : scale);
}

function cardFeedback(ui: UI, height: number, scale: number) {
  const paper = ui.getByTestId('note-card-paper', hidden);
  const footer = ui.getByTestId('note-card-footer', hidden);
  const meta = ui.getByTestId('note-card-meta', hidden);
  const footerTextHeight = nativeLine(ui.getByText('Hooked', hidden), scale) + nativeLine(ui.getByText('Nir Eyal', hidden), scale);
  const cover = ui.queryByTestId('note-cover-placeholder', hidden);
  const footerHeight = Math.max(footerTextHeight, cover ? flat(cover).height : 0);
  const gap = flat(paper).gap;
  const chrome = flat(paper).paddingVertical * 2 + nativeLine(meta, scale) + footerHeight + gap * 2;
  // The text column is independent of the decorative thumbnail. Older source
  // lacks this callback; still deliver its real footer measurement so the old
  // cover -> footer -> compact -> cover cycle is reproduced, not hidden by a mock.
  let textColumn = ui.getByText('Hooked', hidden).parent;
  while (textColumn && !(flat(textColumn).flex === 1 && flat(textColumn).minWidth === 0)) textColumn = textColumn.parent;
  act(() => {
    layout(paper, 312, height);
    layout(meta, 264, nativeLine(meta, scale));
    if (textColumn?.props.onLayout) layout(textColumn, 224, footerTextHeight);
    layout(footer, 264, footerHeight);
    layout(ui.getByTestId('note-card-body', hidden), 264, Math.max(0, height - chrome));
  });
  return { cover: !!ui.queryByTestId('note-cover-placeholder', hidden), chrome };
}

beforeEach(() => {
  (Platform as { OS: string }).OS = 'android';
  const Reanimated = require('react-native-reanimated');
  jest.spyOn(Reanimated, 'useSharedValue').mockImplementation((initial: unknown) => {
    const value = React.useRef({ value: initial });
    return value.current;
  });
});
afterEach(() => jest.restoreAllMocks());

it('converges at the compact-cover boundary instead of alternating 40/46dp footers', () => {
  const RN = require('react-native');
  jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 360, height: 560, scale: 1, fontScale: 1 });
  let commits = 0;
  const ui = render(<React.Profiler id="card" onRender={() => { commits += 1; }}><NoteSwipeCard card={mockCard()} /></React.Profiler>);
  const visibility: boolean[] = [];
  for (let pass = 0; pass < 8; pass += 1) visibility.push(cardFeedback(ui, 160, 1).cover);
  expect(visibility.slice(-4)).toEqual([false, false, false, false]);
  expect(commits).toBeLessThan(8);
  const body = ui.getByText(mockCard().note.content, hidden);
  expect(body.props.numberOfLines).toBe(1);
  expect(nativeLine(body, 1)).toBe(26);
});

it('measures converging screen/card layout with single native scaling in all four small windows', () => {
  const RN = require('react-native');
  for (const height of [640, 560]) for (const scale of [1, 2]) {
    jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 360, height, scale: 1, fontScale: scale });
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(scale);
    let commits = 0;
    const ui = render(<React.Profiler id="screen" onRender={() => { commits += 1; }}><NotesSwipeScreen /></React.Profiler>);
    // Measure the rendered top/progress/control bars, including wrapped labels.
    const title = ui.getByRole('header', { name: 'Your notes' });
    expect(nativeLine(title, scale)).toBe(27 * scale);
    const back = ui.getByRole('button', { name: 'Back' });
    const backText = back.findByType(Text);
    const topHeight = Math.max(nativeLine(title, scale), nativeLine(backText, scale) + flat(back).paddingVertical * 2 + 2) + flat(ui.getByTestId('note-swipe-top-bar')).paddingVertical * 2;
    const bar = ui.getByTestId('note-swipe-button-bar');
    const slotWidth = (360 - flat(bar).paddingHorizontal * 2 - flat(bar).gap * 2) / 3;
    let buttonHeight = 0;
    for (const label of ['Previous', 'Read full note', 'Next']) {
      const button = ui.getByRole('button', { name: label });
      const text = ui.getByText(label);
      const charsPerLine = Math.floor((slotWidth - flat(button).paddingHorizontal * 2 - 2) / (flat(text).fontSize * scale * 0.5));
      const labelLines = Math.ceil(label.length / charsPerLine);
      buttonHeight = Math.max(buttonHeight, nativeLine(text, scale) * labelLines + flat(button).paddingVertical * 2 + 2);
      expect(flat(button).height).toBeUndefined();
      expect(flat(button).maxHeight).toBeUndefined();
      expect(text.props.numberOfLines).toBeUndefined();
    }
    const progressHeight = 3 + flat(ui.getByTestId('note-position-bar', hidden)).paddingVertical * 2;
    const chip = ui.getByRole('radio', { name: 'Question' });
    const chipText = chip.findByType(Text);
    expect(flat(chipText).lineHeight).toBe(LIBRARY_TEXT_BASE.label.lineHeight);
    expect(nativeLine(chipText, scale)).toBe(22 * scale);
    const chipHeight = Math.max(flat(chip).minHeight, nativeLine(chipText, scale) + flat(chip).paddingVertical * 2 + 2);
    const chipsHeight = chipHeight + flat(ui.getByTestId('note-deck-chips-bar')).paddingVertical * 2;
    const available = height - 20 - topHeight - progressHeight - buttonHeight - flat(bar).paddingVertical * 2 - chipsHeight;
    // Known limit (recorded in the tracker): at 200% text on the shortest windows the screen has almost no room for the
    // card even before the category chips row (13dp at 560dp, 93dp at 640dp); the chips row costs at most 80dp more.
    // Guards: the pre-chips budget stays positive, and the chips row never grows beyond that. Normal text keeps full room.
    expect(chipsHeight).toBeLessThanOrEqual(80);
    if (scale === 2) expect(available + chipsHeight).toBeGreaterThan(0);
    else expect(available).toBeGreaterThan(0);
    if (available <= 0) { ui.unmount(); continue; }
    layout(ui.getByTestId('note-stack-wrap'), 360, available);
    const stage = ui.getByTestId('note-stack-fixed-parent');
    layout(stage, 360, available);
    const outer = ui.getByTestId('note-card-slot-0', hidden);
    const cardHeight = available - flat(outer).top - flat(outer).bottom;
    const history = [];
    for (let pass = 0; pass < 8; pass += 1) history.push(cardFeedback(ui, cardHeight, scale));
    expect(history.slice(-3)).toEqual([history[7], history[7], history[7]]);
    expect(commits).toBeLessThan(15);
    expect(flat(stage).minHeight).toBeLessThanOrEqual(available);
    const body = ui.queryByText(mockCard().note.content, hidden);
    const remaining = Math.max(0, cardHeight - history[7].chrome);
    if (body) {
      expect(nativeLine(body, scale)).toBe(26 * scale);
      expect(body.props.numberOfLines * nativeLine(body, scale)).toBeLessThanOrEqual(remaining);
    } else expect(remaining).toBeLessThan(26 * scale);
    expect(nativeLine(ui.getByTestId('note-card-meta', hidden), scale)).toBe(20 * scale);
    expect(nativeLine(ui.getByText('Hooked', hidden), scale)).toBe(20 * scale);
    expect(nativeLine(ui.getByTestId('note-quote-mark', hidden), scale)).toBe(40 * scale);
    ui.unmount();
  }
});

it('swipe buttons use the scaled label token while default BookButton stays on native metrics', () => {
  // Default shared button (no prop) is unchanged for other Library screens.
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
  try {
    for (const label of ['\u2190', 'Previous', 'Read full note', 'Next']) {
      const ui = render(<View><BookButton label={label} variant="text" onPress={jest.fn()} /></View>);
      const text = ui.getByText(label);
      expect(flat(text).fontSize).toBe(16);
      expect(flat(text).lineHeight).toBeUndefined();
      expect(text.props.allowFontScaling).not.toBe(false);
      expect(text.props.numberOfLines).toBeUndefined();
      const button = ui.getByRole('button', { name: label });
      expect(flat(button).minHeight).toBeGreaterThanOrEqual(48);
      expect(flat(button).height).toBeUndefined();
      expect(flat(button).overflow).not.toBe('hidden');
      ui.unmount();
    }
  } finally {
    jest.restoreAllMocks();
    (Platform as { OS: string }).OS = 'android';
    const Reanimated = require('react-native-reanimated');
    jest.spyOn(Reanimated, 'useSharedValue').mockImplementation((initial: unknown) => {
      const value = React.useRef({ value: initial });
      return value.current;
    });
  }
  // Swipe screen buttons receive the explicit scaled token at fontScale 1 and 2.
  const RN = require('react-native');
  for (const scale of [1, 2]) {
    jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 360, height: 640, scale: 1, fontScale: scale });
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(scale);
    const expected = scaledLineHeight(LIBRARY_TEXT_BASE.label.lineHeight, scale);
    try {
      const ui = render(<NotesSwipeScreen />);
      for (const label of ['Previous', 'Read full note', 'Next']) {
        const text = ui.getByText(label, hidden);
        expect(flat(text).lineHeight).toBe(expected);
        expect(text.props.numberOfLines).toBeUndefined();
      }
      const backText = ui.getByText('\u2190', hidden);
      expect(flat(backText).lineHeight).toBe(expected);
      expect(backText.props.numberOfLines).toBeUndefined();
      ui.unmount();
    } finally {
      jest.restoreAllMocks();
      (Platform as { OS: string }).OS = 'android';
      const Reanimated = require('react-native-reanimated');
      jest.spyOn(Reanimated, 'useSharedValue').mockImplementation((initial: unknown) => {
        const value = React.useRef({ value: initial });
        return value.current;
      });
    }
  }
});

it('swipe screen stops passing the scaled token fails (prop-required guard)', () => {
  const RN = require('react-native');
  jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 360, height: 640, scale: 1, fontScale: 2 });
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
  try {
    const ui = render(<NotesSwipeScreen />);
    const expected = scaledLineHeight(LIBRARY_TEXT_BASE.label.lineHeight, 2);
    // Every swipe-screen button must carry the token; dropping labelLineHeight
    // from any of them (mutation) turns its lineHeight undefined and fails here.
    for (const label of ['Previous', 'Read full note', 'Next', '\u2190']) {
      expect(flat(ui.getByText(label, hidden)).lineHeight).toBe(expected);
    }
    ui.unmount();
  } finally {
    jest.restoreAllMocks();
  }
});
