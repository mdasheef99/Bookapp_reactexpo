import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react-native';
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
};

let mockOffline = false;
let mockViewMode: string | null = null;
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
    setGoal: jest.fn(),
  },
}));
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

function validRead(overrides: Record<string, unknown> = {}) {
  return {
    id: 'read-1',
    user_book_id: 'reading-entry',
    user_id: 'reader-1',
    read_number: 1,
    outcome: 'reading',
    started_at: '2026-10-01T10:00:00.000Z',
    ended_at: null,
    started_on: null,
    ended_on: null,
    start_unknown: false,
    end_unknown: false,
    total_pages: 320,
    counts_in_stats: true,
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-20T10:00:00.000Z',
    ...overrides,
  };
}

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

beforeEach(() => {
  jest.clearAllMocks();
  mockOffline = false;
  mockViewMode = null;
  (booksService.getUserLibrary as jest.Mock).mockResolvedValue([
    {
      id: 'reading-entry',
      reading_status: 'reading',
      ownership: 'owned',
      available_for_lending: false,
      book: { title: 'Actual Reading Book', authors: ['Reader Author'], cover_url: null },
    },
  ]);
  gateway.openReadBookIds.mockResolvedValue(['reading-entry']);
  gateway.openReadsWithProgress.mockResolvedValue([
    {
      read: validRead(),
      bookTitle: 'Actual Reading Book',
      latestProgress: {
        id: 'progress-1',
        read_id: 'read-1',
        user_id: 'reader-1',
        page: 142,
        percent: null,
        recorded_at: '2026-10-10T10:00:00.000Z',
      },
    },
  ]);
  gateway.settings.mockResolvedValue(null);
  gateway.userBookTitle.mockResolvedValue(null);
  gateway.goal.mockResolvedValue(null);
  gateway.readsForUser.mockResolvedValue([]);
});

describe('Home continue-reading card placement (H-12)', () => {
  it('list view renders the card once under the controls', async () => {
    mockViewMode = 'list';
    const ui = renderScreen();
    try {
      await ui.findByTestId('library-continue-reading-card');
      await waitFor(() =>
        expect(ui.getAllByTestId('library-continue-reading-card')).toHaveLength(1),
      );
      expect(ui.getByTestId('library-continue-reading-progress')).toHaveTextContent('p. 142 of 320');
      expect(ui.getAllByText('Actual Reading Book').length).toBeGreaterThanOrEqual(1);
    } finally {
      ui.unmount();
      ui.queryClient.clear();
    }
  });

  it('shelf view renders the card once with no duplicate', async () => {
    mockViewMode = 'shelf';
    const ui = renderScreen();
    try {
      await waitFor(() =>
        expect(ui.getAllByTestId('library-continue-reading-card')).toHaveLength(1),
      );
      expect(ui.getByTestId('library-continue-reading-progress')).toHaveTextContent('p. 142 of 320');
    } finally {
      ui.unmount();
      ui.queryClient.clear();
    }
  });
});

describe('Home goal entry (H-16)', () => {
  function goalReads(count: number) {
    return Array.from({ length: count }, (_, index) => ({
      ...validRead(),
      id: `goal-read-${index}`,
      user_book_id: `goal-book-${index}`,
      outcome: 'finished',
      started_on: '2026-03-10',
      ended_on: '2026-03-12',
      total_pages: 300,
      counts_in_stats: true,
    }));
  }

  it.each(['list', 'shelf'] as const)('shows exactly "14 of 24 books in 2026" in %s view', async (view) => {
    mockViewMode = view;
    gateway.goal.mockResolvedValue({
      user_id: 'reader-1',
      year: 2026,
      target_books: 24,
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    gateway.readsForUser.mockResolvedValue(goalReads(14));
    const ui = renderScreen();
    try {
      expect(await ui.findByTestId('library-goal-summary-link')).toBeOnTheScreen();
      expect(await ui.findByText('14 of 24 books in 2026')).toBeOnTheScreen();
    } finally {
      ui.unmount();
      ui.queryClient.clear();
    }
  });

  it.each(['list', 'shelf'] as const)('shows quiet "Reading stats" with no goal in %s view', async (view) => {
    mockViewMode = view;
    gateway.goal.mockResolvedValue(null);
    gateway.readsForUser.mockResolvedValue(goalReads(2));
    const ui = renderScreen();
    try {
      expect(await ui.findByText('Reading stats')).toBeOnTheScreen();
      expect(ui.queryByText(/of \d+ books/)).toBeNull();
    } finally {
      ui.unmount();
      ui.queryClient.clear();
    }
  });
});
