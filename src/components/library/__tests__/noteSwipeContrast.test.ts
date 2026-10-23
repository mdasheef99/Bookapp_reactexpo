import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { fireEvent, render, within } from '@testing-library/react-native';
import { getLibraryAppearance } from '../LibraryAppearance';
import { spineColorFromTitle } from '@/features/books/utils/shelfLayout';
import { NoteSwipeCard } from '../notes-swipe/NoteSwipeCard';
import { NoteSwipeStack } from '../notes-swipe/NoteSwipeStack';
import { NoteFullNoteSheet } from '../notes-swipe/NoteFullNoteSheet';
import type { NoteDeckCard } from '@/features/books/notes/manualNoteContract';
import NotesSwipeScreen from '../../../../app/(tabs)/library/notes-swipe';
import { BookFeedbackProvider } from '../ui';

let mockDeck: ReturnType<typeof makeDeck>;
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ scope: 'all', seed: 'contrast', order: 'shuffle' }),
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true }),
}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true, useRoute: () => ({ key: 'contrast' }) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'contrast' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOffline: false }) }));
jest.mock('@/features/books/notes/useManualNotes', () => ({
  useNoteContext: () => ({ actorId: 'a', book: { data: undefined, isError: false } }),
}));
jest.mock('@/features/books/notes/useNoteDeck', () => ({ useNoteDeck: () => mockDeck }));
jest.mock('@/components/library/notes-swipe/useNoteSwipeMotion', () => ({
  useReducedNoteMotion: () => true, useNoteSwipeHint: () => false,
}));
jest.mock('@/features/books/notes/noteNavigation', () => ({
  openNoteComposer: jest.fn(), readerHref: jest.fn(), registerNoteContext: jest.fn(),
}));

jest.mock('@/hooks/useTheme', () => ({ useTheme: jest.fn(() => ({ phase: 'daylight' })) }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(() => Promise.resolve()), ImpactFeedbackStyle: { Light: 'Light' } }));
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  const chainable = () => {
    const gesture: Record<string, jest.Mock> = {};
    for (const name of ['enabled', 'minDistance', 'maxDistance', 'maxDuration', 'runOnJS']) gesture[name] = jest.fn(() => gesture);
    for (const name of ['onStart', 'onUpdate', 'onEnd', 'onFinalize']) gesture[name] = jest.fn(() => gesture);
    return gesture;
  };
  return {
    Gesture: {
      Pan: jest.fn(() => chainable()),
      Tap: jest.fn(() => chainable()),
      Native: jest.fn(() => chainable()),
      Simultaneous: jest.fn((...args: unknown[]) => args[0]),
      Exclusive: jest.fn((...args: unknown[]) => args[0]),
    },
    GestureDetector: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    GestureHandlerRootView: ({ children, ...props }: any) => React.createElement(View, props, children),
  };
});

const PHASES = ['daylight', 'golden', 'midnight'] as const;
// Every reference swatch in shelfLayout, rather than a few arbitrary title hashes.
const SPINE_TITLES = [
  'The Alchemist', 'Sapiens', 'Atomic Habits', 'The Power of Now', 'Deep Work', 'The 5 AM Club',
  'Thinking, Fast and Slow', 'The Midnight Library', 'Rich Dad Poor Dad', 'The Psychology of Money',
  'Zero to One', 'Make Time', 'Ikigai', 'The Daily Stoic',
] as const;
type RenderNode = ReturnType<typeof render>['root'];

function makeCard(title: string, id = 'n'): NoteDeckCard {
  return {
    note: { id, user_id: 'a', user_book_id: 'b', content: 'A calm note body with enough text.', tag: 'quote', page_number: 42, created_at: '2026-10-20T00:00:00Z', updated_at: null },
    book: { id: 'b', title, authors: ['Author'], cover_url: null },
  };
}

function makeDeck(card: NoteDeckCard) {
  return {
    index: { data: [{ id: 'previous' }, { id: card.note.id }, { id: 'next' }], isError: false, refetch: jest.fn() },
    ids: ['previous', card.note.id, 'next'], at: 1, noteId: card.note.id, card,
    undercards: [makeCard(card.book.title, 'next'), makeCard(card.book.title, 'later')],
    move: jest.fn(), restart: jest.fn(), abort: jest.fn(), retryCard: jest.fn(), detailError: false,
  };
}

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseColor(color: string): Rgba {
  const value = color.trim();
  if (value === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (value.startsWith('rgba')) {
    const parts = value
      .slice(value.indexOf('(') + 1, value.lastIndexOf(')'))
      .split(',')
      .map(part => Number.parseFloat(part.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] };
  }
  if (value.startsWith('rgb(')) {
    const parts = value
      .slice(4, -1)
      .split(',')
      .map(part => Number.parseFloat(part.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: 1 };
  }
  return {
    r: Number.parseInt(value.slice(1, 3), 16),
    g: Number.parseInt(value.slice(3, 5), 16),
    b: Number.parseInt(value.slice(5, 7), 16),
    a: 1,
  };
}

const composite = (top: Rgba, bottom: Rgba): Rgba => ({
  r: top.r * top.a + bottom.r * (1 - top.a),
  g: top.g * top.a + bottom.g * (1 - top.a),
  b: top.b * top.a + bottom.b * (1 - top.a),
  a: 1,
});

const luminance = ({ r, g, b }: Rgba) =>
  [r, g, b]
    .map(channel => channel / 255)
    .map(channel => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);

function contrastRatio(foreground: string, background: string): number {
  const paper: Rgba = { r: 255, g: 255, b: 255, a: 1 };
  const back = composite(parseColor(background), paper);
  const front = composite(parseColor(foreground), back);
  const light = Math.max(luminance(front), luminance(back));
  const dark = Math.min(luminance(front), luminance(back));
  return (light + 0.05) / (dark + 0.05);
}

function shineOverCard(phase: (typeof PHASES)[number]): string {
  const colors = getLibraryAppearance(phase);
  const over = composite(parseColor(colors.cardShine), parseColor(colors.bgCard));
  return `rgb(${Math.round(over.r)},${Math.round(over.g)},${Math.round(over.b)})`;
}

function opaqueRgb(color: string): string {
  const { r, g, b } = parseColor(color);
  return `rgb(${r},${g},${b})`;
}

// Inspect host paint, not the Text's own (usually absent) background or a
// composite component's forwarded style. Stop at the local paint region: the
// page's distant background must not disguise transparent chrome beside the
// independently coloured stack, nor a transparent sheet/card surface.
function paintedBackground(node: RenderNode, boundary: RenderNode, spine: string): string {
  const layers: Rgba[] = [];
  let opaque = false;
  let reachedBoundary = false;
  for (let current: RenderNode | null = node; current; current = current.parent) {
    if (typeof current.type === 'string') {
      const style = StyleSheet.flatten(current.props.style);
      const background = style?.backgroundColor;
      if (typeof background === 'string' && parseColor(background).a > 0) {
        expect(background.toLowerCase()).not.toBe(spine);
        if (!opaque) {
          const paint = parseColor(background);
          layers.push(paint);
          opaque = paint.a === 1 && (style.opacity ?? 1) === 1;
        }
      }
    }
    if (current === boundary) { reachedBoundary = true; break; }
  }
  expect(reachedBoundary).toBe(true);
  if (!opaque) throw new Error(`No opaque painted ancestor inside ${boundary.props.testID ?? 'control region'}`);
  const paint = layers.reverse().reduce((under, over) => composite(over, under));
  return `rgb(${paint.r},${paint.g},${paint.b})`;
}

function expectTextPaint(region: RenderNode, spine: string, boundary = region) {
  const texts = within(region).UNSAFE_queryAllByType(Text);
  expect(texts.length).toBeGreaterThan(0);
  for (const text of texts) {
    const background = paintedBackground(text, boundary, spine);
    const color = StyleSheet.flatten(text.props.style)?.color;
    expect(typeof color).toBe('string');
    expect(contrastRatio(color as string, background)).toBeGreaterThanOrEqual(4.5);
  }
}

function expectControlPaint(control: RenderNode, region: RenderNode, spine: string) {
  // The outside of a boundary is its ancestor's paint, not the control's fill.
  expect(control.parent).not.toBeNull();
  const outside = paintedBackground(control.parent!, region, spine);
  const style = StyleSheet.flatten(control.props.style);
  const border = style?.borderColor;
  const fill = style?.backgroundColor;
  const boundary = typeof border === 'string' && (style.borderWidth ?? 0) > 0 && parseColor(border).a > 0 ? border : fill;
  if (typeof boundary === 'string' && parseColor(boundary).a > 0) {
    expect(boundary.toLowerCase()).not.toBe(spine);
    expect(contrastRatio(boundary, outside)).toBeGreaterThanOrEqual(3);
  } else {
    // Text-only controls have no visible outline; their label supplies it.
    expectTextPaint(control, spine, region);
  }
}

beforeEach(() => {
  // Reanimated values retain identity in the app. Its stock Jest mock creates a
  // new value on every render, spuriously firing the stack's unmount cleanup
  // after the card reports its chrome height and disabling the real Read button.
  const reanimated = require('react-native-reanimated');
  jest.spyOn(reanimated, 'useSharedValue').mockImplementation((initial: unknown) =>
    jest.requireActual('react').useRef({ value: initial }).current);
});
afterEach(() => { jest.restoreAllMocks(); });

describe('swipe position line and card shine contrast (all three phases)', () => {
  it.each(PHASES)('keeps the position track and fill readable against the %s bar', phase => {
    const colors = getLibraryAppearance(phase);
    expect(contrastRatio(colors.controlBorder, colors.bgPrimary)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(colors.accent, colors.bgPrimary)).toBeGreaterThanOrEqual(3);
  });

  it.each(PHASES)('keeps card text >= 4.5:1 with the shine at full strength on %s', phase => {
    const colors = getLibraryAppearance(phase);
    const surface = shineOverCard(phase);
    expect(contrastRatio(colors.textPrimary, surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.textSecondary, surface)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(PHASES)('composites the shine to a visibly different colour on %s (≥6 in one channel)', phase => {
    const colors = getLibraryAppearance(phase);
    const bg = parseColor(colors.bgCard);
    for (const token of [colors.cardShine, colors.cardShineEdge] as const) {
      const over = composite(parseColor(token), bg);
      const diff = Math.max(Math.abs(over.r - bg.r), Math.abs(over.g - bg.g), Math.abs(over.b - bg.b));
      expect(diff).toBeGreaterThanOrEqual(6);
    }
  });

  it.each(PHASES)('keeps text >= 4.5:1 with the shine over the text too on %s', phase => {
    const colors = getLibraryAppearance(phase);
    const bg = parseColor(colors.bgCard);
    const shine = parseColor(colors.cardShine);
    const surface = composite(shine, bg);
    for (const token of [colors.textPrimary, colors.textSecondary] as const) {
      const under = composite(shine, parseColor(token));
      const light = Math.max(luminance(under), luminance(surface));
      const dark = Math.min(luminance(under), luminance(surface));
      expect((light + 0.05) / (dark + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('renders no text or control boundary directly on a spine colour', () => {
    const { useTheme } = require('@/hooks/useTheme');
    const titles = [...SPINE_TITLES, 'A Fixture Title Of Roughly One Hundred Characters', '', 'x'];
    const spineColours = new Set(titles.map(title => spineColorFromTitle(title).toLowerCase()));
    expect(spineColours.size).toBeGreaterThan(1);
    expect(spineColours.size).toBe(14);
    for (const phase of PHASES) {
      (useTheme as jest.Mock).mockReturnValue({ phase });
      const colors = getLibraryAppearance(phase);
      const opaqueSurfaces = new Set(
        [colors.bgCard, colors.bgPrimary, colors.bgRaised, colors.controlBorder, colors.accent].map(c => c.toLowerCase()),
      );
      for (const title of titles) {
        const spine = spineColorFromTitle(title).toLowerCase();
        expect(opaqueSurfaces.has(spine)).toBe(false);
        const deckCard: NoteDeckCard = {
          note: { id: 'n', user_id: 'a', user_book_id: 'b', content: 'A calm note body with enough text.', tag: 'quote', page_number: 42, created_at: '2026-10-20T00:00:00Z', updated_at: null },
          book: { id: 'b', title, authors: ['Author'], cover_url: null },
        };
        const ui = render(React.createElement(NoteSwipeStack, { card: deckCard, undercards: [], at: 0, total: 1, reduced: false, hint: false, enabled: false, onMove: () => {}, onRead: () => {}, onLeave: () => {} }));
        const paper = ui.getByTestId('note-card-paper', { includeHiddenElements: true });
        expect(StyleSheet.flatten(paper.props.style).backgroundColor).toBe(colors.bgCard);
        const spineStrip = ui.getByTestId('note-spine-strip', { includeHiddenElements: true });
        expect(StyleSheet.flatten(spineStrip.props.style).backgroundColor?.toString().toLowerCase()).toBe(spine);
        expect(spineStrip.props.children ?? null).toBeNull();
        const texts = ui.UNSAFE_queryAllByType(Text);
        expect(texts.length).toBeGreaterThan(0);
        for (const t of texts) {
          const flat = StyleSheet.flatten(t.props.style);
          const bg = (Array.isArray(flat) ? (flat as any[]).map(s => s?.backgroundColor).find(Boolean) : (flat as any)?.backgroundColor) as string | undefined;
          if (bg) expect(bg.toLowerCase()).not.toBe(spine);
        }
        ui.unmount();
        const cardUi = render(React.createElement(NoteSwipeCard, { card: deckCard }));
        const cardPaper = cardUi.getByTestId('note-card-paper', { includeHiddenElements: true });
        expect(StyleSheet.flatten(cardPaper.props.style).backgroundColor).toBe(colors.bgCard);
        cardUi.unmount();
      }
      const sheetCard: NoteDeckCard = {
        note: { id: 'n', user_id: 'a', user_book_id: 'b', content: 'Body', tag: null, page_number: null, created_at: '2026-10-20T00:00:00Z', updated_at: null },
        book: { id: 'b', title: 'Sheet Book', authors: ['Author'], cover_url: null },
      };
      const sheetUi = render(React.createElement(BookFeedbackProvider, null, React.createElement(NoteFullNoteSheet, { card: sheetCard, reduced: false, onClose: () => {}, onOpenNote: () => {}, onOpenBook: () => {} })));
      const panel = sheetUi.getByTestId('note-full-sheet', { includeHiddenElements: true });
      const panelBg = StyleSheet.flatten(panel.props.style).backgroundColor as string;
      expect(panelBg.toLowerCase()).toBe(colors.bgRaised.toLowerCase());
      expect(spineColours.has(panelBg.toLowerCase())).toBe(false);
      sheetUi.unmount();
    }
  });

  describe.each(PHASES)('rendered screen chrome and sheet on %s', phase => {
    it.each(SPINE_TITLES)('keeps text and control boundaries on opaque paint for %s', title => {
      const { useTheme } = require('@/hooks/useTheme');
      (useTheme as jest.Mock).mockReturnValue({ phase });
      const colors = getLibraryAppearance(phase);
      const spine = spineColorFromTitle(title).toLowerCase();
      mockDeck = makeDeck(makeCard(title));
      // Render actual screen/stack/card/sheet and BookButtons. Only navigation,
      // motion preference and the deck's data source are replaced above.
      const ui = render(React.createElement(BookFeedbackProvider, null, React.createElement(NotesSwipeScreen)));
      try {
        const topBar = ui.getByTestId('note-swipe-top-bar');
        const buttonBar = ui.getByTestId('note-swipe-button-bar');
        const positionBar = ui.getByTestId('note-position-bar', { includeHiddenElements: true });
        for (const region of [topBar, buttonBar]) {
          expectTextPaint(region, spine);
          const controls = within(region).getAllByRole('button');
          expect(controls.length).toBeGreaterThan(0);
          for (const control of controls) expectControlPaint(control, region, spine);
        }
        expect(within(topBar).getByRole('button', { name: 'Back' })).toBeTruthy();
        for (const name of ['Previous', 'Read full note', 'Next']) {
          expect(within(buttonBar).getByRole('button', { name })).toBeTruthy();
        }

        const fill = ui.getByTestId('note-position-fill', { includeHiddenElements: true });
        let track = fill.parent;
        while (track && typeof track.type !== 'string') track = track.parent;
        expect(track).not.toBeNull();
        const barPaint = paintedBackground(track!.parent!, positionBar, spine);
        expect(StyleSheet.flatten(track!.props.style).backgroundColor).toBe(colors.controlBorder);
        expect(StyleSheet.flatten(fill.props.style).backgroundColor).toBe(colors.accent);
        for (const line of [track!, fill]) {
          expect(contrastRatio(StyleSheet.flatten(line.props.style).backgroundColor as string, barPaint)).toBeGreaterThanOrEqual(3);
        }

        // The coloured stage is real. All three sibling cards and their text
        // have their own paper; root page paint cannot satisfy these checks.
        expect(StyleSheet.flatten(ui.getByTestId('note-book-background', { includeHiddenElements: true }).props.style).backgroundColor.toLowerCase()).toBe(spine);
        const papers = ui.getAllByTestId('note-card-paper', { includeHiddenElements: true });
        expect(papers).toHaveLength(3);
        for (const [index, paper] of papers.entries()) {
          expect(StyleSheet.flatten(paper.props.style).backgroundColor).toBe(index === 0 ? colors.bgCard : colors.bgSecondary);
          expectTextPaint(paper, spine);
          const strip = within(paper).getByTestId('note-spine-strip', { includeHiddenElements: true });
          expect(StyleSheet.flatten(strip.props.style).backgroundColor.toLowerCase()).toBe(spine);
          expect(strip.props.children ?? null).toBeNull();
        }
        // The accessible card boundary also sits on neutral paper over the
        // stage's spine background, as do the visual swipe-direction hints.
        const cardSlot = ui.getByTestId('note-card-slot-0', { includeHiddenElements: true });
        const cardInner = ui.getByTestId('note-card-slot-0-inner', { includeHiddenElements: true });
        expect(cardSlot.props.accessibilityRole).toBe('button');
        expect(paintedBackground(cardInner, cardSlot, spine)).toBe(opaqueRgb(colors.bgCard));
        expectTextPaint(cardInner, spine);

        fireEvent.press(ui.getByRole('button', { name: 'Read full note' }));
        const panel = ui.getByTestId('note-full-sheet', { includeHiddenElements: true });
        expect(StyleSheet.flatten(panel.props.style).backgroundColor).toBe(colors.bgRaised);
        expectTextPaint(panel, spine);
        for (const name of ['Close full note', 'Open note', 'Open book']) {
          const control = within(panel).getByRole('button', { name });
          expectControlPaint(control, panel, spine);
        }
        const grabber = within(panel).getByTestId('note-sheet-grabber', { includeHiddenElements: true });
        expect(paintedBackground(grabber.parent!, panel, spine)).toBe(opaqueRgb(colors.bgRaised));
        expect(StyleSheet.flatten(grabber.props.style).backgroundColor).toBe(colors.controlBorder);
      } finally {
        ui.unmount();
      }
    });
  });
});
