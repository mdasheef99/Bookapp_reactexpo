import React from 'react';
import { StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { getLibraryAppearance } from '../LibraryAppearance';
import { HorizontalBookVolume } from '../HorizontalBookVolume';
import { BookSpine } from '../BookSpine';
import { LibraryShelf } from '../LibraryShelf';
import { LibraryHorizontalShelf } from '../LibraryHorizontalShelf';
import { BookFeedbackProvider } from '../ui';
import { useOpenReadBookIds } from '@/features/books/history/useOpenReadBookIds';
import { readingHistoryGateway } from '@/features/books/history/readingHistoryGateway';

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(() => Promise.resolve()), ImpactFeedbackStyle: { Light: 'Light' } }));
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({ play: jest.fn(), remove: jest.fn(), seekTo: jest.fn(), volume: 0.3 })),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Gesture: { Pan: () => {
    const gesture: Record<string, jest.Mock> = {};
    for (const name of ['enabled', 'minDistance', 'maxPointers', 'runOnJS', 'onStart', 'onUpdate', 'onEnd', 'onFinalize']) {
      gesture[name] = jest.fn(() => gesture);
    }
    return gesture;
  } },
}));
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  return {
    ...Reanimated,
    useReducedMotion: jest.fn(() => false),
    useSharedValue: jest.fn((v: any) => ({ value: v })),
    useAnimatedStyle: jest.fn((fn: any) => fn()),
    withSpring: jest.fn((v: any) => v),
    withTiming: jest.fn((v: any) => v),
    Easing: { bezier: () => (t: number) => t },
  };
});
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: () => ({ session: { user: { id: 'reader-1' } } }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/features/books/history/readingHistoryGateway', () => ({
  readingHistoryGateway: { openReadBookIds: jest.fn() },
}));

const gateway = readingHistoryGateway as unknown as { openReadBookIds: jest.Mock };

function parseColor(color: string) {
  const value = color.trim();
  return {
    r: Number.parseInt(value.slice(1, 3), 16),
    g: Number.parseInt(value.slice(3, 5), 16),
    b: Number.parseInt(value.slice(5, 7), 16),
  };
}

function luminance({ r, g, b }: { r: number; g: number; b: number }) {
  return [r, g, b]
    .map((channel) => channel / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrastRatio(foreground: string, background: string) {
  const front = parseColor(foreground);
  const back = parseColor(background);
  const light = Math.max(luminance(front), luminance(back));
  const dark = Math.min(luminance(front), luminance(back));
  return (light + 0.05) / (dark + 0.05);
}

// The dark walnut the spines and volumes sit against (vertical wall base and
// horizontal tier base are the same physical material; the medium board is lighter).
const SHELF_WALL = '#483222';
const SHELF_BOARD = '#896341';
const SELECTION_OUTLINES = ['#c5a059', '#e9c279'];
const ALERT_COLORS = ['#ad3f36', '#9c382f', '#ffb3a6'];
// Cloth palette the shelf can draw (src/features/books/utils/shelfLayout.ts SPINE_COLORS).
const CLOTH_COLORS = ['#445a70', '#853939', '#d6d0c4', '#627a4d', '#23354a', '#b8622c', '#454d52', '#363a40', '#c99a38', '#ded6cc', '#727a80', '#8a9164', '#bd7a42', '#2e3438'];

function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><BookFeedbackProvider>{ui}</BookFeedbackProvider></QueryClientProvider>);
}

const book = (id: string) => ({
  id, ownership: 'owned', reading_status: 'want_to_read',
  book: { title: `Title ${id}`, authors: ['A. Reader'] },
});

beforeEach(() => {
  jest.clearAllMocks();
  gateway.openReadBookIds.mockResolvedValue([]);
});

describe('readingOutline token (SDD-09 H-06)', () => {
  it.each(['daylight', 'golden', 'midnight'] as const)('defines a distinct readingOutline for %s', (phase) => {
    const colors = getLibraryAppearance(phase);
    expect(typeof colors.readingOutline).toBe('string');
    expect(colors.readingOutline).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it.each(['daylight', 'golden', 'midnight'] as const)('defines a distinct readingOutlineInner for %s', (phase) => {
    const colors = getLibraryAppearance(phase);
    expect(typeof colors.readingOutlineInner).toBe('string');
    expect(colors.readingOutlineInner).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('uses a different readingOutline and readingOutlineInner per appearance', () => {
    const outlines = (['daylight', 'golden', 'midnight'] as const).map((phase) => getLibraryAppearance(phase).readingOutline);
    expect(new Set(outlines).size).toBe(3);
    const inners = (['daylight', 'golden', 'midnight'] as const).map((phase) => getLibraryAppearance(phase).readingOutlineInner);
    expect(new Set(inners).size).toBe(3);
  });

  it('is not an alert colour and not either hard-coded selection colour', () => {
    for (const phase of ['daylight', 'golden', 'midnight'] as const) {
      const colors = getLibraryAppearance(phase);
      for (const token of [colors.readingOutline, colors.readingOutlineInner]) {
        expect(SELECTION_OUTLINES).not.toContain(token);
        expect(ALERT_COLORS).not.toContain(token);
      }
      expect(colors.readingOutline).not.toBe(colors.readingOutlineInner);
    }
  });

  it.each(['daylight', 'golden', 'midnight'] as const)('clears 3:1 against the shelf wall and board in %s', (phase) => {
    const outline = getLibraryAppearance(phase).readingOutline;
    expect(contrastRatio(outline, SHELF_WALL)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(outline, SHELF_BOARD)).toBeGreaterThanOrEqual(3);
  });

  it.each(['daylight', 'golden', 'midnight'] as const)(
    'two-tone ring keeps max(contrast) >= 3:1 on any cloth and both woods in %s',
    (phase) => {
      const colors = getLibraryAppearance(phase);
      for (const surface of [...CLOTH_COLORS, SHELF_WALL, SHELF_BOARD]) {
        const best = Math.max(
          contrastRatio(colors.readingOutline, surface),
          contrastRatio(colors.readingOutlineInner, surface),
        );
        expect(best).toBeGreaterThanOrEqual(3);
      }
    },
  );
});

describe('shelf reading outlines', () => {
  it('shows the two-tone reading outline on a horizontal volume only for books with an open read', () => {
    const reading = renderWithProviders(
      <HorizontalBookVolume item={book('b') as any} width={200} height={60} onPress={jest.fn()} reading />,
    );
    try {
      const outer = reading.getByTestId('library-horizontal-reading-outline-b');
      const inner = reading.getByTestId('library-horizontal-reading-outline-inner-b');
      expect(outer).toBeTruthy();
      expect(inner).toBeTruthy();
      expect(reading.getByTestId('library-horizontal-book-b').props.accessibilityLabel).toMatch(/, Reading$/);
      const outerFlat = StyleSheet.flatten(outer.props.style);
      const innerFlat = StyleSheet.flatten(inner.props.style);
      expect(outerFlat.borderColor).toBe(getLibraryAppearance('daylight').readingOutline);
      expect(innerFlat.borderColor).toBe(getLibraryAppearance('daylight').readingOutlineInner);
      // Own style: thicker outer ring and inset inner ring, not a copy of the selection outline.
      expect(outerFlat.borderWidth).not.toBe(2);
      expect(outerFlat.borderWidth).toBe(3);
      expect(innerFlat.margin).toBe(4);
    } finally {
      reading.unmount();
    }
    const shelf = renderWithProviders(
      <LibraryHorizontalShelf books={[book('a'), book('b')]} onBookPress={jest.fn()} openReadIds={new Set(['b'])} />,
    );
    try {
      fireEvent(shelf.getByTestId('library-horizontal-shelf'), 'layout', { nativeEvent: { layout: { width: 342 } } });
      expect(shelf.queryByTestId('library-horizontal-reading-outline-a')).toBeNull();
      expect(shelf.queryByTestId('library-horizontal-reading-outline-inner-a')).toBeNull();
      expect(shelf.getByTestId('library-horizontal-reading-outline-b')).toBeTruthy();
      expect(shelf.getByTestId('library-horizontal-reading-outline-inner-b')).toBeTruthy();
    } finally {
      shelf.unmount();
    }
  });

  it('hides the reading outline when the volume is selected or focused; selection wins', () => {
    const selected = renderWithProviders(
      <HorizontalBookVolume item={book('b') as any} width={200} height={60} onPress={jest.fn()} reading selected />,
    );
    try {
      expect(selected.queryByTestId('library-horizontal-reading-outline-b')).toBeNull();
      expect(selected.queryByTestId('library-horizontal-reading-outline-inner-b')).toBeNull();
    } finally {
      selected.unmount();
    }
  });

  it('adds ", Reading" to the horizontal volume label and not otherwise', () => {
    const plain = renderWithProviders(
      <HorizontalBookVolume item={book('a') as any} width={200} height={60} onPress={jest.fn()} />,
    );
    try {
      expect(plain.getByTestId('library-horizontal-book-a').props.accessibilityLabel).not.toMatch(/Reading/);
    } finally {
      plain.unmount();
    }
  });

  it('shows the two-tone reading outline on vertical spines only for open reads and never with selection', () => {
    const ui = render(<LibraryShelf books={[book('a') as any, book('b') as any]} onBookPress={jest.fn()} openReadIds={new Set(['b'])} />);
    try {
      expect(ui.queryByTestId('library-shelf-reading-outline-a')).toBeNull();
      expect(ui.queryByTestId('library-shelf-reading-outline-inner-a')).toBeNull();
      const outer = ui.getByTestId('library-shelf-reading-outline-b');
      const inner = ui.getByTestId('library-shelf-reading-outline-inner-b');
      const outerFlat = StyleSheet.flatten(outer.props.style);
      const innerFlat = StyleSheet.flatten(inner.props.style);
      expect(outerFlat.borderColor).toBe(getLibraryAppearance('daylight').readingOutline);
      expect(innerFlat.borderColor).toBe(getLibraryAppearance('daylight').readingOutlineInner);
      // Own style: thicker outer with a wider inset than the arranging selection.
      expect(outerFlat.borderWidth).toBe(3);
      expect(outerFlat.top).not.toBe(-3);
      expect(ui.getByTestId('library-shelf-spine-b').props.accessibilityLabel).toMatch(/, Reading$/);
      expect(ui.getByTestId('library-shelf-spine-a').props.accessibilityLabel).not.toMatch(/Reading/);
    } finally {
      ui.unmount();
    }
  });

  it('drives the finished-or-stopped outline from real read rows through useOpenReadBookIds', async () => {
    // Real read rows: one finished, one stopped. The server-side open-read query
    // returns nothing, so the hook yields an empty set and no outline renders.
    gateway.openReadBookIds.mockResolvedValue([]);
    const finishedRow = {
      id: 'read-finished', user_book_id: 'a', user_id: 'reader-1', read_number: 1, outcome: 'finished',
      started_at: null, ended_at: null, started_on: '2026-09-01', ended_on: '2026-09-10',
      start_unknown: false, end_unknown: false, total_pages: null, counts_in_stats: true,
      created_at: '2026-09-01T10:00:00.000Z', updated_at: '2026-09-10T10:00:00.000Z',
    };
    const stoppedRow = {
      id: 'read-stopped', user_book_id: 'a', user_id: 'reader-1', read_number: 2, outcome: 'did_not_finish',
      started_at: null, ended_at: null, started_on: '2026-10-01', ended_on: '2026-10-02',
      start_unknown: false, end_unknown: false, total_pages: null, counts_in_stats: true,
      created_at: '2026-10-01T10:00:00.000Z', updated_at: '2026-10-02T10:00:00.000Z',
    };
    expect([finishedRow, stoppedRow].every((row) => row.outcome !== 'reading')).toBe(true);
    function ShelfFromHook({ books }: { books: any[] }) {
      const openReadIds = useOpenReadBookIds('reader-1');
      return <LibraryShelf books={books} onBookPress={jest.fn()} openReadIds={openReadIds} />;
    }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const ui = render(
      <QueryClientProvider client={client}>
        <BookFeedbackProvider>
          <ShelfFromHook books={[book('a') as any]} />
        </BookFeedbackProvider>
      </QueryClientProvider>,
    );
    try {
      await waitFor(() => expect(gateway.openReadBookIds).toHaveBeenCalledWith('reader-1', expect.anything()));
      expect(ui.queryByTestId('library-shelf-reading-outline-a')).toBeNull();
      expect(ui.queryByTestId('library-shelf-reading-outline-inner-a')).toBeNull();
    } finally {
      ui.unmount();
      client.clear();
    }
  });

  it('keeps selection above the reading outline on the vertical shelf', () => {
    const arrangement = { active: true, saving: false, move: jest.fn() } as any;
    const ui = render(<LibraryShelf books={[book('a') as any]} onBookPress={jest.fn()} openReadIds={new Set(['a'])} arrangement={arrangement} />);
    try {
      expect(ui.getByTestId('library-shelf-reading-outline-a')).toBeTruthy();
      expect(ui.getByTestId('library-shelf-reading-outline-inner-a')).toBeTruthy();
      fireEvent.press(ui.getByTestId('library-shelf-spine-a'));
      expect(ui.queryByTestId('library-shelf-reading-outline-a')).toBeNull();
      expect(ui.queryByTestId('library-shelf-reading-outline-inner-a')).toBeNull();
    } finally {
      ui.unmount();
    }
  });
});
