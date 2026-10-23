import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react-native';
import LibraryScreen from '../index';
import { booksService } from '@/features/books/services/booksService';
import { readingHistoryGateway } from '@/features/books/history/readingHistoryGateway';
import { BookFeedbackProvider } from '@/components/library/ui';

const gateway = readingHistoryGateway as unknown as {
  openReadsWithProgress: jest.Mock;
  openReadBookIds: jest.Mock;
  settings: jest.Mock;
  userBookTitle: jest.Mock;
  goal: jest.Mock;
  readsForUser: jest.Mock;
  readsForBook: jest.Mock;
};

let mockOffline = false;
let mockViewMode: string | null = null;
let mockArranging = false;
const mockRouterPush = jest.fn();

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockRouterPush(...args) }, useFocusEffect: jest.fn() }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'Light' },
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
    useSharedValue: jest.fn((v: unknown) => ({ value: v })),
    useAnimatedStyle: jest.fn((fn: () => unknown) => fn()),
    withSpring: jest.fn((v: unknown) => v),
    withTiming: jest.fn((v: unknown) => v),
    withDelay: jest.fn((_: number, v: unknown) => v),
    Easing: { bezier: () => (t: number) => t, linear: (t: number) => t },
  };
});
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => {
    if (key === 'library_viewMode') return Promise.resolve(mockViewMode);
    return Promise.resolve(null);
  }),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
jest.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ session: { user: { id: 'reader-1' } } }),
}));
jest.mock('@/features/books/services/booksService', () => ({
  booksService: { getUserLibrary: jest.fn(), updateReadingStatus: jest.fn() },
}));
jest.mock('@/features/books/history/readingHistoryGateway', () => ({
  readingHistoryGateway: {
    openReadsWithProgress: jest.fn(),
    openReadBookIds: jest.fn(),
    settings: jest.fn(),
    userBookTitle: jest.fn(),
    addProgress: jest.fn(),
    setTotalPages: jest.fn(),
    goal: jest.fn(),
    readsForUser: jest.fn(),
    readsForBook: jest.fn(),
    setGoal: jest.fn(),
  },
}));
jest.mock('@/features/books/hooks/useShelfArrangement', () => ({
  useShelfArrangement: (_userId: string, books: { id: string }[]) => ({
    orderedBooks: books,
    order: books.map((b) => b.id),
    tierIds: { top: [], bottom: [] },
    ready: true,
    active: mockArranging,
    saving: false,
    canUndo: false,
    message: null,
    readError: false,
    enter: jest.fn(),
    move: jest.fn(),
    moveHorizontal: jest.fn(),
    undo: jest.fn(),
    cancel: jest.fn(),
    save: jest.fn(),
    retryRead: jest.fn(),
  }),
}));
jest.mock('@/components/library/notes-swipe/NoteSwipeHomeTile', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    NoteSwipeHomeTile: () => React.createElement(View, { testID: 'note-swipe-home-tile' }, React.createElement(Text, null, 'tile')),
  };
});
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOffline: mockOffline }) }));
jest.mock('@/features/books/export/deliver', () => ({ exportDeliveryAvailable: () => false }));
jest.mock('@/features/books/export/useExportActions', () => ({
  useLibraryCsvExport: () => ({ run: jest.fn(), busy: false, feedback: null }),
}));
jest.mock('@/components/ui/GlassCard', () => ({
  GlassCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/components/ui/ScreenBackground', () => ({
  ScreenBackground: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/components/ui/Button', () => {
  const React = require('react');
  const { Text, TouchableOpacity } = require('react-native');
  return {
    Button: ({ title, onPress }: { title: string; onPress: () => void }) => (
      <TouchableOpacity onPress={onPress}>
        <Text>{title}</Text>
      </TouchableOpacity>
    ),
  };
});

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <BookFeedbackProvider>
          <LibraryScreen />
        </BookFeedbackProvider>
      </QueryClientProvider>,
    ),
  };
}

function orderOf(ui: ReturnType<typeof renderScreen>): string[] {
  const nodes = ui.UNSAFE_root.findAll(
    (node: { props?: { testID?: string } }) =>
      typeof node.props?.testID === 'string' &&
      (node.props.testID === 'note-swipe-home-tile' || node.props.testID === 'library-on-this-day'),
  );
  return nodes.map((n: { props: { testID: string } }) => n.props.testID);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-23T12:00:00.000Z'));
  const options = Intl.DateTimeFormat().resolvedOptions();
  jest.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
    ...options,
    timeZone: 'UTC',
  });
  mockOffline = false;
  mockViewMode = null;
  mockArranging = false;
  (booksService.getUserLibrary as jest.Mock).mockResolvedValue([
    {
      id: 'book-1',
      reading_status: 'completed',
      ownership: 'owned',
      book: { title: 'Hooked', authors: ['Nir Eyal'], cover_url: null },
    },
  ]);
  gateway.openReadBookIds.mockResolvedValue([]);
  gateway.openReadsWithProgress.mockResolvedValue([]);
  gateway.settings.mockResolvedValue(null);
  gateway.userBookTitle.mockResolvedValue(null);
  gateway.goal.mockResolvedValue(null);
  gateway.readsForUser.mockResolvedValue([
    {
      id: 'read-1',
      user_book_id: 'book-1',
      user_id: 'reader-1',
      read_number: 1,
      outcome: 'finished',
      started_at: null,
      ended_at: null,
      started_on: null,
      ended_on: '2025-10-23',
      start_unknown: false,
      end_unknown: false,
      total_pages: 300,
      counts_in_stats: true,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-02T00:00:00.000Z',
    },
  ]);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('Home On This Day line (Unit D)', () => {
  it.each(['shelf', 'list'] as const)('renders the line under the tile in %s view', async (view) => {
    mockViewMode = view;
    const ui = renderScreen();
    try {
      await act(async () => { await jest.advanceTimersByTimeAsync(100); });
      expect(ui.getByTestId('note-swipe-home-tile')).toBeOnTheScreen();
      expect(ui.getByTestId('library-on-this-day')).toBeOnTheScreen();
      const order = orderOf(ui);
      expect(order.indexOf('note-swipe-home-tile')).toBeGreaterThanOrEqual(0);
      expect(order.indexOf('library-on-this-day')).toBeGreaterThan(
        order.indexOf('note-swipe-home-tile'),
      );
      expect(ui.getAllByTestId('library-on-this-day')).toHaveLength(1);
    } finally {
      ui.unmount();
      ui.queryClient.clear();
    }
  });

  it.each(['shelf', 'list'] as const)('hides the line while arranging in %s view', async (view) => {
    mockViewMode = view;
    mockArranging = true;
    const ui = renderScreen();
    try {
      await act(async () => { await jest.advanceTimersByTimeAsync(100); });
      expect(ui.getByText('Hooked')).toBeOnTheScreen();
      expect(ui.queryByTestId('library-on-this-day')).toBeNull();
      expect(ui.queryByTestId('note-swipe-home-tile')).toBeNull();
    } finally {
      ui.unmount();
      ui.queryClient.clear();
    }
  });
});
