let mockCollections = false;
jest.mock('@/features/books/organising/useOrganising', () => ({ useOrganising: () => ({ entities: { data: mockCollections ? [{ id: 'collection', user_id: 'actor', name: 'Collected notes', created_at: '2026-10-25', updated_at: '2026-10-25' }] : [] }, members: { data: [] }, refresh: jest.fn() }) }));
import React from 'react';
import { PixelRatio, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { NoteSwipeCard } from '../NoteSwipeCard';
import { NoteSwipeStack } from '../NoteSwipeStack';
import { NoteFullNoteSheet } from '../NoteFullNoteSheet';
import NotesSwipeScreen from '../../../../../app/(tabs)/library/notes-swipe';
import { BookButton } from '../../ui/BookButton';
import { LIBRARY_TEXT_BASE } from '../../LibraryTypography';
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
  filters: [{ kind: 'all' }, { kind: 'category', tag: 'quote' }, { kind: 'category', tag: 'question' }, ...(mockCollections ? [{ kind: 'collection', collectionId: 'collection' }] : [])],
}) }));
jest.mock('../useNoteSwipeMotion', () => ({ useReducedNoteMotion: () => true, useNoteSwipeHint: () => false }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'Light' } }));
jest.mock('react-native-worklets', () => ({ ...jest.requireActual('react-native-worklets'), scheduleOnRN: (fn: (...args: any[]) => void, ...args: any[]) => fn(...args) }));
jest.mock('react-native-gesture-handler', () => {
  const chain = () => {
    const gesture: Record<string, any> = {};
    for (const key of ['enabled', 'minDistance', 'maxDistance', 'maxDuration', 'numberOfTaps', 'maxDelay', 'runOnJS', 'onStart', 'onUpdate', 'onEnd', 'onFinalize']) gesture[key] = () => gesture;
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
  mockCollections = false;
  (Platform as { OS: string }).OS = 'android';
  const Reanimated = require('react-native-reanimated');
  jest.spyOn(Reanimated, 'useSharedValue').mockImplementation((initial: unknown) => {
    const value = React.useRef({ value: initial });
    return value.current;
  });
});
afterEach(() => jest.restoreAllMocks());

it.each([560, 640])('keeps four controls and chips in separate scroll areas at 200%% text in a %idp window', height => {
  const RN = require('react-native');
  jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 360, height, scale: 1, fontScale: 2 });
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
  const ui = render(<NotesSwipeScreen />);
  for (const label of ['Previous', 'Read full note', 'Add to collection', 'Next']) expect(ui.getByRole('button', { name: label })).toBeTruthy();
  const chrome = ui.getByTestId('note-swipe-chrome-scroll'), controls = ui.getByTestId('note-swipe-controls-scroll');
  const scrolls = ui.UNSAFE_getAllByType(ScrollView);
  expect(scrolls.filter((node: { props: { testID?: string } }) => node.props.testID === 'note-swipe-chrome-scroll')).toHaveLength(1);
  expect(scrolls.filter((node: { props: { testID?: string } }) => node.props.testID === 'note-swipe-controls-scroll')).toHaveLength(1);
  expect(flat(chrome).maxHeight + flat(controls).maxHeight).toBeLessThanOrEqual((height - 20) / 2);
  // Vertical scrolling is confined to chrome/control siblings, outside the pan surface.
  expect(chrome.findAll((node: { props: { testID?: string } }) => node.props.testID === 'note-card-slot-0')).toHaveLength(0);
  expect(controls.findAll((node: { props: { testID?: string } }) => node.props.testID === 'note-card-slot-0')).toHaveLength(0);
  expect(flat(ui.getByTestId('note-swipe-button-bar')).flexWrap).toBe('wrap');
  ui.unmount();
});

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

it('resets the Android rounded clip border to zero when a loading slot becomes a note', () => {
  const props = { undercards: [], at: 0, total: 1, reduced: false, hint: false,
    enabled: true, onMove: jest.fn(), onRead: jest.fn(), onLeave: jest.fn() };
  const ui = render(<NoteSwipeStack {...props} />);
  const viewport = () => flat(ui.getByTestId('note-card-slot-0-inner', hidden));
  // Loading supplies a 1dp border. Removing that native prop on data arrival
  // leaves Android's rounded padding-box clip invalid: text has layout and
  // accessibility bounds but does not paint. Explicit zero resets the insets.
  // Round-4 device probes reproduce this transition with bfd02ef's stack.
  expect(viewport().borderWidth).toBe(1);
  for (const reduced of [false, true]) {
    ui.rerender(<NoteSwipeStack {...props} reduced={reduced} card={mockCard()} />);
    expect(viewport().overflow).toBe('hidden');
    expect(viewport().borderWidth).toBe(0);
    expect(viewport().borderRadius).toBeGreaterThan(0);
    expect(ui.getByText(mockCard().note.content, hidden)).toBeTruthy();
    ui.rerender(<NoteSwipeStack {...props} reduced={reduced} />);
    expect(viewport().borderWidth).toBe(1);
  }
});

it('measures converging E/F chrome, four controls and a complete note line in small windows', () => {
  const RN = require('react-native');
  for (const height of [640, 560]) for (const scale of [1, 2]) for (const collections of [false, true]) for (const tabHeight of [0, 73]) {
    mockCollections = collections;
    jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 360, height, scale: 1, fontScale: scale });
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(scale);
    let commits = 0;
    const ui = render(<React.Profiler id="screen" onRender={() => { commits += 1; }}><NotesSwipeScreen /></React.Profiler>);
    // The screen can sit above tab navigation: budget its actual measured height,
    // not useWindowDimensions alone. No emulator size/settings override is needed.
    layout(ui.getByTestId('note-swipe-content'), 360, height - tabHeight);
    // Measure E/F's Order button and all four wrapped controls, not C2's old trio.
    // RNTL bubbles a layout event to the nearest ancestor WITH a handler when the
    // target has none (13.3.3 findEventHandler walks to the parent); a real device
    // never bubbles onLayout. The bars below have no onLayout of their own, so each
    // fired layout would clobber contentHeight. Restore it right after (same for
    // the ScrollView viewports below) so the budgets are measured, not the artefact.
    const title = ui.getByRole('header', { name: 'Your notes' });
    expect(nativeLine(title, scale)).toBe(27 * scale);
    const back = ui.getByRole('button', { name: 'Back' });
    const backText = back.findByType(Text);
    const order = ui.getByRole('button', { name: 'Order' });
    const topBar = flat(ui.getByTestId('note-swipe-top-bar'));
    const naturalWidth = (button: { props: any }, text: { props: any }, label: string) => label.length * flat(text).fontSize * scale * 0.5 + flat(button).paddingHorizontal * 2 + 2;
    const titleWidth = 360 - topBar.paddingHorizontal * 2 - topBar.gap * 2 - naturalWidth(back, backText, '\u2190') - naturalWidth(order, order.findByType(Text), 'Order');
    const titleLines = Math.min(2, Math.ceil('Your notes'.length * flat(title).fontSize * scale * 0.5 / titleWidth));
    const topHeight = Math.max(nativeLine(title, scale) * titleLines, nativeLine(backText, scale) + flat(back).paddingVertical * 2 + 2) + topBar.paddingVertical * 2;
    const bar = ui.getByTestId('note-swipe-button-bar');
    const barWidth = 360 - flat(bar).paddingHorizontal * 2;
    let buttonHeight = 0, rowWidth = 0, rowHeight = 0;
    for (const label of ['Previous', 'Read full note', 'Add to collection', 'Next']) {
      const button = ui.getByRole('button', { name: label });
      const text = ui.getByText(label);
      const buttonWidth = Math.min(barWidth, naturalWidth(button, text, label));
      if (rowWidth && rowWidth + flat(bar).gap + buttonWidth > barWidth) {
        buttonHeight += rowHeight + flat(bar).gap; rowWidth = 0; rowHeight = 0;
      }
      const charsPerLine = Math.max(1, Math.floor((buttonWidth - flat(button).paddingHorizontal * 2 - 2) / (flat(text).fontSize * scale * 0.5)));
      const labelLines = Math.ceil(label.length / charsPerLine);
      rowHeight = Math.max(rowHeight, nativeLine(text, scale) * labelLines + flat(button).paddingVertical * 2 + 2);
      rowWidth += (rowWidth ? flat(bar).gap : 0) + buttonWidth;
      expect(flat(button).height).toBeUndefined();
      expect(flat(button).maxHeight).toBeUndefined();
      expect(text.props.numberOfLines).toBeUndefined();
    }
    buttonHeight += rowHeight + flat(bar).paddingVertical * 2;
    const progressHeight = 3 + flat(ui.getByTestId('note-position-bar', hidden)).paddingVertical * 2;
    const chip = ui.getByRole('radio', { name: 'Question' });
    const chipText = chip.findByType(Text);
    expect(flat(chipText).lineHeight).toBe(LIBRARY_TEXT_BASE.label.lineHeight);
    expect(nativeLine(chipText, scale)).toBe(22 * scale);
    const chipHeight = Math.max(flat(chip).minHeight, nativeLine(chipText, scale) + flat(chip).paddingVertical * 2 + 2);
    const chipsHeight = chipHeight + flat(ui.getByTestId('note-deck-chips-bar')).paddingVertical * 2;
    if (collections) expect(ui.getByRole('radio', { name: 'Collection: Collected notes' })).toBeTruthy();
    expect(ui.getByTestId('note-deck-chips').props.horizontal).toBe(true);
    layout(ui.getByTestId('note-swipe-top-bar'), 360, topHeight);
    layout(ui.getByTestId('note-position-bar', hidden), 360, progressHeight);
    layout(ui.getByTestId('note-deck-chips-bar'), 360, chipsHeight);
    layout(bar, 360, buttonHeight);
    layout(ui.getByTestId('note-swipe-content'), 360, height - tabHeight);
    const chrome = ui.getByTestId('note-swipe-chrome-scroll'), controls = ui.getByTestId('note-swipe-controls-scroll');
    // ScrollView's native flexGrow fills its bounded viewport even when its
    // content is shorter. Both viewport budgets must leave room for the card.
    const chromeHeight = flat(chrome).maxHeight, controlsHeight = flat(controls).maxHeight;
    layout(chrome, 360, chromeHeight); layout(controls, 360, controlsHeight);
    layout(ui.getByTestId('note-swipe-content'), 360, height - tabHeight);
    const available = height - tabHeight - 20 - chromeHeight - controlsHeight;
    expect(chipsHeight).toBeLessThanOrEqual(80);
    expect(available).toBeGreaterThan(0);
    layout(ui.getByTestId('note-stack-wrap'), 360, available);
    const stage = ui.getByTestId('note-stack-fixed-parent');
    layout(stage, 360, available);
    const outer = ui.getByTestId('note-card-slot-0', hidden);
    const cardHeight = available - flat(outer).top - flat(outer).bottom;
    if (scale === 2) expect(cardHeight).toBeGreaterThanOrEqual(212);
    const history = [];
    for (let pass = 0; pass < 8; pass += 1) history.push(cardFeedback(ui, cardHeight, scale));
    expect(history.slice(-3)).toEqual([history[7], history[7], history[7]]);
    expect(commits).toBeLessThan(20);
    expect(flat(stage).minHeight).toBeLessThanOrEqual(available);
    const body = ui.getByText(mockCard().note.content, hidden);
    const remaining = Math.max(0, cardHeight - history[7].chrome);
    expect(nativeLine(body, scale)).toBe(26 * scale);
    expect(body.props.numberOfLines).toBeGreaterThanOrEqual(1);
    expect(body.props.numberOfLines * nativeLine(body, scale)).toBeLessThanOrEqual(remaining);
    expect(nativeLine(ui.getByTestId('note-card-meta', hidden), scale)).toBe(20 * scale);
    expect(nativeLine(ui.getByText('Hooked', hidden), scale)).toBe(20 * scale);
    expect(nativeLine(ui.getByTestId('note-quote-mark', hidden), scale)).toBe(40 * scale);
    ui.unmount();
  }
});

it('swipe buttons scale the base label line height once while default BookButton stays on native metrics', () => {
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
  // Swipe screen buttons receive the explicit base token at fontScale 1 and 2.
  const RN = require('react-native');
  for (const scale of [1, 2]) {
    jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 360, height: 640, scale: 1, fontScale: scale });
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(scale);
    const expected = LIBRARY_TEXT_BASE.label.lineHeight;
    try {
      const ui = render(<NotesSwipeScreen />);
      for (const label of ['Previous', 'Read full note', 'Next']) {
        const text = ui.getByText(label, hidden);
        expect(flat(text).lineHeight).toBe(expected);
        expect(nativeLine(text, scale)).toBe(22 * scale);
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

it('swipe screen supplies a base line height to every button', () => {
  const RN = require('react-native');
  jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 360, height: 640, scale: 1, fontScale: 2 });
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
  try {
    const ui = render(<NotesSwipeScreen />);
    const expected = LIBRARY_TEXT_BASE.label.lineHeight;
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

it('scales the sheet Close line height once at 200% while keeping its touch target', () => {
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
  const { BookFeedbackProvider } = require('../../ui');
  const ui = render(<BookFeedbackProvider><NoteFullNoteSheet card={mockCard()} reduced onClose={jest.fn()} onOpenNote={jest.fn()} onOpenBook={jest.fn()} /></BookFeedbackProvider>);
  const close = ui.getByRole('button', { name: 'Close full note' });
  expect(nativeLine(ui.getByText('Close'), 2)).toBe(44);
  expect(flat(close).minHeight).toBeGreaterThanOrEqual(48);
  ui.unmount();
});
